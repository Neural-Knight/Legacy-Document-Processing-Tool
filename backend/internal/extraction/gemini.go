package extraction

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

// defaultGeminiModel is used when the caller does not specify one.
const defaultGeminiModel = "gemini-2.5-flash"

// geminiPrompt is the table-extraction prompt: emit "## table_name"
// + SQL-friendly markdown tables, or exactly "NO TABLES FOUND".
const geminiPrompt = `You are given an image of a document page. If it contains one or more tables, ` +
	`for each table output a line "## table_name" where table_name is a short (<=50 chars) ` +
	`SQL-compatible descriptive title (lowercase, underscores, no spaces), followed by a ` +
	`markdown table. Column headers must be lowercase with underscores instead of spaces. ` +
	`Use "|---|" as the header separator row. Split merged multi-row headers sensibly. ` +
	`Write multiple tables separately. If there are NO tables, respond with exactly: NO TABLES FOUND. ` +
	`Use minimal formatting.`

// GeminiClient calls the Gemini generateContent REST API to turn a page image
// into table markdown. Keys come from GEMINI_KEYS (space-separated) and are
// rotated on quota errors. When no keys are configured, Enabled() is false and
// the pipeline skips table extraction gracefully.
type GeminiClient struct {
	keys       []string
	model      string
	http       *http.Client
	maxRetries int

	mu  sync.Mutex
	idx int // round-robin key index
}

// NewGeminiClient reads GEMINI_KEYS from the environment (space-separated) and
// uses the given model (falling back to defaultGeminiModel when empty).
func NewGeminiClient(model string) *GeminiClient {
	if model == "" {
		model = defaultGeminiModel
	}
	var keys []string
	for _, k := range strings.Fields(os.Getenv("GEMINI_KEYS")) {
		if k != "" {
			keys = append(keys, k)
		}
	}
	return &GeminiClient{
		keys:       keys,
		model:      model,
		http:       &http.Client{Timeout: 50 * time.Second},
		maxRetries: 10,
	}
}

// Enabled reports whether any API key is configured.
func (g *GeminiClient) Enabled() bool { return len(g.keys) > 0 }

// nextKey returns the current key and advances the round-robin index.
func (g *GeminiClient) nextKey() string {
	g.mu.Lock()
	defer g.mu.Unlock()
	k := g.keys[g.idx%len(g.keys)]
	g.idx++
	return k
}

type geminiRequest struct {
	Contents []geminiContent `json:"contents"`
}
type geminiContent struct {
	Parts []geminiPart `json:"parts"`
}
type geminiPart struct {
	Text       string            `json:"text,omitempty"`
	InlineData *geminiInlineData `json:"inline_data,omitempty"`
}
type geminiInlineData struct {
	MimeType string `json:"mime_type"`
	Data     string `json:"data"`
}
type geminiResponse struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				Text string `json:"text"`
			} `json:"parts"`
		} `json:"content"`
	} `json:"candidates"`
}

// ExtractTables sends the page image to Gemini and returns table markdown, or ""
// when the model reports no tables. Retries with key rotation on failure.
func (g *GeminiClient) ExtractTables(ctx context.Context, imagePath string) (string, error) {
	if !g.Enabled() {
		return "", nil
	}
	imgBytes, err := os.ReadFile(imagePath)
	if err != nil {
		return "", fmt.Errorf("read page image: %w", err)
	}
	reqBody, err := json.Marshal(geminiRequest{
		Contents: []geminiContent{{
			Parts: []geminiPart{
				{Text: geminiPrompt},
				{InlineData: &geminiInlineData{MimeType: "image/png", Data: base64.StdEncoding.EncodeToString(imgBytes)}},
			},
		}},
	})
	if err != nil {
		return "", err
	}

	var lastErr error
	for attempt := 0; attempt < g.maxRetries; attempt++ {
		key := g.nextKey()
		text, err := g.call(ctx, key, reqBody)
		if err != nil {
			lastErr = err
			continue // rotate to the next key and retry
		}
		text = strings.TrimSpace(stripCodeFence(text))
		if text == "" || strings.EqualFold(text, "NO TABLES FOUND") {
			return "", nil
		}
		return text, nil
	}
	return "", fmt.Errorf("gemini failed after %d attempts: %w", g.maxRetries, lastErr)
}

func (g *GeminiClient) call(ctx context.Context, key string, body []byte) (string, error) {
	// The API key is sent in the x-goog-api-key header (never in the URL/query,
	// so it can't leak into logs).
	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent", g.model)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-goog-api-key", key)
	resp, err := g.http.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("gemini status %d: %s", resp.StatusCode, readErrorBody(resp.Body))
	}
	var out geminiResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return "", err
	}
	if len(out.Candidates) == 0 || len(out.Candidates[0].Content.Parts) == 0 {
		return "", nil
	}
	var sb strings.Builder
	for _, p := range out.Candidates[0].Content.Parts {
		sb.WriteString(p.Text)
	}
	return sb.String(), nil
}

// stripCodeFence removes ```markdown / ``` fences the model sometimes adds.
func stripCodeFence(s string) string {
	s = strings.TrimSpace(s)
	s = strings.TrimPrefix(s, "```markdown")
	s = strings.TrimPrefix(s, "```")
	s = strings.TrimSuffix(s, "```")
	return strings.TrimSpace(s)
}

// readErrorBody reads up to 500 bytes of a non-2xx response body for
// diagnostics. It never includes request headers, so the API key is not logged.
func readErrorBody(r io.Reader) string {
	b, _ := io.ReadAll(io.LimitReader(r, 500))
	return strings.TrimSpace(string(b))
}
