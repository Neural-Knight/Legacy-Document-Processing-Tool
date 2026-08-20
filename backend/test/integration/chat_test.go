//go:build integration

package integration

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/legacy-document-processing-tool/backend/internal/extraction"
	"github.com/legacy-document-processing-tool/backend/internal/repository"
)

// TestChatFlow exercises the Phase 4 RAG/chat pipeline end to end: upload a PDF,
// run extraction+indexing, confirm vector_entries exist, then chat and manage
// sessions. With no GEMINI_KEYS the chat falls back to the template response —
// still a valid 200 with a conversation_id.
func TestChatFlow(t *testing.T) {
	if !extraction.PopplerAvailable() {
		t.Skip("poppler not installed; skipping chat/RAG integration test (needs a processed PDF)")
	}

	root := t.TempDir()
	srv, pool := newDocTestServerWithStorage(t, root)
	token, _ := registerAndLogin(t, srv, pool)
	q := repository.New(pool)

	// Upload a PDF fixture and process it (extraction + indexing).
	pdf, err := os.ReadFile("../testdata/extraction/sample_text.pdf")
	if err != nil {
		t.Fatalf("read fixture: %v", err)
	}
	resp := uploadFile(t, srv, token, "chat_"+itoa(time.Now().UnixNano())+".pdf", pdf)
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("upload: expected 201, got %d", resp.StatusCode)
	}
	var doc docJSON
	json.NewDecoder(resp.Body).Decode(&doc)
	resp.Body.Close()

	drainRealJobs(t, pool, root)

	// Verify indexing produced vector_entries for the document.
	n, err := q.CountVectorEntriesByDocumentID(context.Background(), &doc.ID)
	if err != nil {
		t.Fatalf("count vector entries: %v", err)
	}
	if n == 0 {
		t.Fatal("expected vector_entries rows after processing")
	}

	// POST /api/chat with the document id.
	resp = postJSON(t, srv.URL+"/api/chat", map[string]any{
		"message":      "what is this document about",
		"document_ids": []int32{doc.ID},
	}, token)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("chat: expected 200, got %d", resp.StatusCode)
	}
	var chatResp struct {
		Response       string `json:"response"`
		ConversationID string `json:"conversation_id"`
		Sources        []struct {
			DocumentID string `json:"document_id"`
		} `json:"sources"`
	}
	json.NewDecoder(resp.Body).Decode(&chatResp)
	resp.Body.Close()
	if chatResp.ConversationID == "" {
		t.Fatal("chat: expected a conversation_id")
	}
	if chatResp.Response == "" {
		t.Fatal("chat: expected a non-empty response")
	}

	// GET /api/chat/sessions lists the new session.
	resp = authGet(t, srv.URL+"/api/chat/sessions", token)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("sessions: expected 200, got %d", resp.StatusCode)
	}
	var sessions []struct {
		ID string `json:"id"`
	}
	json.NewDecoder(resp.Body).Decode(&sessions)
	resp.Body.Close()
	found := false
	for _, s := range sessions {
		if s.ID == chatResp.ConversationID {
			found = true
		}
	}
	if !found {
		t.Fatalf("sessions: expected to find %s", chatResp.ConversationID)
	}

	// GET /api/chat/{id}/history has the user + assistant messages.
	resp = authGet(t, srv.URL+"/api/chat/"+chatResp.ConversationID+"/history", token)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("history: expected 200, got %d", resp.StatusCode)
	}
	var hist struct {
		Messages []struct {
			Role    string `json:"role"`
			Content string `json:"content"`
		} `json:"messages"`
	}
	json.NewDecoder(resp.Body).Decode(&hist)
	resp.Body.Close()
	if len(hist.Messages) < 2 {
		t.Fatalf("history: expected >=2 messages, got %d", len(hist.Messages))
	}
	if hist.Messages[0].Role != "user" {
		t.Fatalf("history: first message role = %q, want user", hist.Messages[0].Role)
	}

	// Second chat turn on the same conversation resumes the session.
	resp = postJSON(t, srv.URL+"/api/chat", map[string]any{
		"message":         "tell me more",
		"conversation_id": chatResp.ConversationID,
	}, token)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("chat turn 2: expected 200, got %d", resp.StatusCode)
	}
	var chat2 struct {
		ConversationID string `json:"conversation_id"`
	}
	json.NewDecoder(resp.Body).Decode(&chat2)
	resp.Body.Close()
	if chat2.ConversationID != chatResp.ConversationID {
		t.Fatalf("chat turn 2: expected same conversation, got %s", chat2.ConversationID)
	}

	// DELETE /api/chat/sessions/{id} → 204, then history → 404.
	req, _ := http.NewRequest(http.MethodDelete, srv.URL+"/api/chat/sessions/"+chatResp.ConversationID, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	dresp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("delete session: %v", err)
	}
	if dresp.StatusCode != http.StatusNoContent {
		t.Fatalf("delete session: expected 204, got %d", dresp.StatusCode)
	}
	dresp.Body.Close()

	resp = authGet(t, srv.URL+"/api/chat/"+chatResp.ConversationID+"/history", token)
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("history after delete: expected 404, got %d", resp.StatusCode)
	}
	resp.Body.Close()
}

// TestChatForbidsForeignDocument verifies a user can't chat over another user's
// document (403).
func TestChatForbidsForeignDocument(t *testing.T) {
	srv, pool := newDocTestServer(t)
	ownerToken, _ := registerAndLogin(t, srv, pool)
	otherToken, _ := registerAndLogin(t, srv, pool)

	resp := uploadFile(t, srv, ownerToken, "owned_"+itoa(time.Now().UnixNano())+".csv", []byte("a,b\n1,2\n"))
	var doc docJSON
	json.NewDecoder(resp.Body).Decode(&doc)
	resp.Body.Close()

	resp = postJSON(t, srv.URL+"/api/chat", map[string]any{
		"message":      "secret?",
		"document_ids": []int32{doc.ID},
	}, otherToken)
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("cross-user chat: expected 403, got %d", resp.StatusCode)
	}
	resp.Body.Close()
}
