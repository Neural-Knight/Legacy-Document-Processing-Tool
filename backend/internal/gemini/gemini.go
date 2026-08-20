// Package gemini is a small text-generation client for the Gemini
// generateContent REST API, with GEMINI_KEYS space-separated key rotation.
// It is used by the RAG chat service to generate answers. (The extraction
// package has its own image-oriented Gemini client; this one is text-only and
// kept separate to avoid coupling chat to extraction.)
package gemini

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

// DefaultModel is used when no model is configured.
const DefaultModel = "gemini-2.5-flash"

// Client calls Gemini for text generation. When no keys are configured,
// Enabled() is false and callers should fall back to a template response.
type Client struct {
	keys       []string
	model      string
	http       *http.Client
	maxRetries int

	mu  sync.Mutex
	idx int
}

// NewClient reads GEMINI_KEYS (space-separated) from the environment. model
// defaults to DefaultModel when empty (CHAT_MODEL override).
func NewClient(model string) *Client {
	if model == "" {
		model = DefaultModel
	}
	var keys []string
	for _, k := range strings.Fields(os.Getenv("GEMINI_KEYS")) {
		if k != "" {
			keys = append(keys, k)
		}
	}
	return &Client{
		keys:       keys,
		model:      model,
		http:       &http.Client{Timeout: 50 * time.Second},
		maxRetries: 10,
	}
}

// Enabled reports whether any API key is configured.
func (c *Client) Enabled() bool { return len(c.keys) > 0 }

func (c *Client) nextKey() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	k := c.keys[c.idx%len(c.keys)]
	c.idx++
	return k
}

type request struct {
	Contents          []content `json:"contents"`
	SystemInstruction *content  `json:"systemInstruction,omitempty"`
}
type content struct {
	Parts []part `json:"parts"`
}
type part struct {
	Text string `json:"text"`
}
type response struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				Text string `json:"text"`
			} `json:"parts"`
		} `json:"content"`
	} `json:"candidates"`
}

// Generate sends a system instruction + user prompt and returns the model's
// text. Retries with key rotation on failure. Returns an error if no keys are
// configured (callers should check Enabled() first).
func (c *Client) Generate(ctx context.Context, systemPrompt, userPrompt string) (string, error) {
	if !c.Enabled() {
		return "", fmt.Errorf("no gemini keys configured")
	}
	req := request{
		Contents: []content{{Parts: []part{{Text: userPrompt}}}},
	}
	if systemPrompt != "" {
		req.SystemInstruction = &content{Parts: []part{{Text: systemPrompt}}}
	}
	body, err := json.Marshal(req)
	if err != nil {
		return "", err
	}

	var lastErr error
	for attempt := 0; attempt < c.maxRetries; attempt++ {
		text, err := c.call(ctx, c.nextKey(), body)
		if err != nil {
			lastErr = err
			continue
		}
		return strings.TrimSpace(text), nil
	}
	return "", fmt.Errorf("gemini failed after %d attempts: %w", c.maxRetries, lastErr)
}

func (c *Client) call(ctx context.Context, key string, body []byte) (string, error) {
	// The API key is sent in the x-goog-api-key header (never in the URL/query,
	// so it can't leak into logs).
	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent", c.model)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-goog-api-key", key)
	resp, err := c.http.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("gemini status %d: %s", resp.StatusCode, readErrorBody(resp.Body))
	}
	var out response
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

// readErrorBody reads up to 500 bytes of a non-2xx response body for
// diagnostics. It never includes request headers, so the API key is not logged.
func readErrorBody(r io.Reader) string {
	b, _ := io.ReadAll(io.LimitReader(r, 500))
	return strings.TrimSpace(string(b))
}
