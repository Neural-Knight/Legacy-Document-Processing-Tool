package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/legacy-document-processing-tool/backend/internal/rag"
	"github.com/legacy-document-processing-tool/backend/internal/repository"
)

// ChatHandler serves the /api/chat and /api/chat/* endpoints for RAG chat and
// session management.
type ChatHandler struct {
	queries *repository.Queries
	rag     *rag.Service
}

// NewChatHandler builds the chat handler.
func NewChatHandler(queries *repository.Queries, ragSvc *rag.Service) *ChatHandler {
	return &ChatHandler{queries: queries, rag: ragSvc}
}

// chatRequest is the POST /api/chat body. document_ids accepts JSON numbers OR
// strings (the frontend sends string[]); flexIDs handles both.
type chatRequest struct {
	Message        string  `json:"message"`
	DocumentIDs    flexIDs `json:"document_ids"`
	ConversationID string  `json:"conversation_id"`
}

// flexIDs decodes a JSON array whose elements may be numbers or numeric strings
// into []int32.
type flexIDs []int32

func (f *flexIDs) UnmarshalJSON(b []byte) error {
	if string(b) == "null" {
		return nil
	}
	var raw []json.RawMessage
	if err := json.Unmarshal(b, &raw); err != nil {
		return err
	}
	out := make([]int32, 0, len(raw))
	for _, r := range raw {
		s := string(r)
		if len(s) >= 2 && s[0] == '"' {
			var str string
			if err := json.Unmarshal(r, &str); err != nil {
				return err
			}
			n, err := strconv.Atoi(str)
			if err != nil {
				return err
			}
			out = append(out, int32(n))
			continue
		}
		var n int32
		if err := json.Unmarshal(r, &n); err != nil {
			return err
		}
		out = append(out, n)
	}
	*f = out
	return nil
}

// Chat handles POST /api/chat.
func (h *ChatHandler) Chat(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		respondUnauthorized(w, "Could not validate credentials")
		return
	}

	var req chatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusUnprocessableEntity, "Invalid request body")
		return
	}
	if req.Message == "" {
		writeError(w, http.StatusUnprocessableEntity, "message is required")
		return
	}

	resp, err := h.rag.ProcessQuery(r.Context(), user.ID, isSuperuser(user), rag.Request{
		Message:        req.Message,
		DocumentIDs:    []int32(req.DocumentIDs),
		ConversationID: req.ConversationID,
	})
	if err != nil {
		if errors.Is(err, rag.ErrForbiddenDocuments) {
			writeError(w, http.StatusForbidden, "You do not have permission to access one or more of the referenced documents")
			return
		}
		writeError(w, http.StatusInternalServerError, "Error processing chat request")
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

// sessionResponse is the JSON shape for a chat session (frontend uses `any`).
type sessionResponse struct {
	ID          string     `json:"id"`
	Title       string     `json:"title"`
	DocumentIDs []int32    `json:"document_ids"`
	LastMessage *string    `json:"last_message"`
	CreatedAt   *time.Time `json:"created_at"`
	UpdatedAt   *time.Time `json:"updated_at"`
}

func toSessionResponse(s repository.ChatSession) sessionResponse {
	resp := sessionResponse{
		ID:          s.ID,
		Title:       s.Title,
		DocumentIDs: s.DocumentIds,
		LastMessage: s.LastMessage,
	}
	if s.CreatedAt.Valid {
		t := s.CreatedAt.Time
		resp.CreatedAt = &t
	}
	if s.UpdatedAt.Valid {
		t := s.UpdatedAt.Time
		resp.UpdatedAt = &t
	}
	return resp
}

// ListSessions handles GET /api/chat/sessions (newest first).
func (h *ChatHandler) ListSessions(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		respondUnauthorized(w, "Could not validate credentials")
		return
	}
	sessions, err := h.queries.ListSessionsByUser(r.Context(), &user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Could not list chat sessions")
		return
	}
	out := make([]sessionResponse, 0, len(sessions))
	for _, s := range sessions {
		out = append(out, toSessionResponse(s))
	}
	writeJSON(w, http.StatusOK, out)
}

// messageResponse is one message in a session history.
type messageResponse struct {
	ID        int32          `json:"id"`
	Role      string         `json:"role"`
	Content   string         `json:"content"`
	CreatedAt *time.Time     `json:"created_at"`
	Metadata  map[string]any `json:"metadata,omitempty"`
}

// History handles GET /api/chat/{conversationId}/history.
func (h *ChatHandler) History(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		respondUnauthorized(w, "Could not validate credentials")
		return
	}
	convID := chi.URLParam(r, "conversationId")

	// 404 if the session is missing or not owned by the user.
	session, err := h.queries.GetSessionByIDForUser(r.Context(), repository.GetSessionByIDForUserParams{
		ID:     convID,
		UserID: &user.ID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "Conversation not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "Could not load conversation")
		return
	}

	sid := session.ID
	msgs, err := h.queries.ListMessagesBySessionID(r.Context(), &sid)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Could not load messages")
		return
	}
	out := make([]messageResponse, 0, len(msgs))
	for _, m := range msgs {
		mr := messageResponse{ID: m.ID, Role: m.Role, Content: m.Content}
		if m.CreatedAt.Valid {
			t := m.CreatedAt.Time
			mr.CreatedAt = &t
		}
		if len(m.MessageMetadata) > 0 {
			var md map[string]any
			if json.Unmarshal(m.MessageMetadata, &md) == nil {
				mr.Metadata = md
			}
		}
		out = append(out, mr)
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"conversation_id": session.ID,
		"title":           session.Title,
		"messages":        out,
	})
}

// DeleteSession handles DELETE /api/chat/sessions/{conversationId} → 204.
func (h *ChatHandler) DeleteSession(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		respondUnauthorized(w, "Could not validate credentials")
		return
	}
	convID := chi.URLParam(r, "conversationId")

	n, err := h.queries.DeleteSession(r.Context(), repository.DeleteSessionParams{
		ID:     convID,
		UserID: &user.ID,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Could not delete conversation")
		return
	}
	if n == 0 {
		writeError(w, http.StatusNotFound, "Conversation not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
