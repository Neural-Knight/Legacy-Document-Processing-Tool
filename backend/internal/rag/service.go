package rag

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/legacy-document-processing-tool/backend/internal/gemini"
	"github.com/legacy-document-processing-tool/backend/internal/repository"
)

// Errors surfaced to the handler for status mapping.
var (
	// ErrForbiddenDocuments → 403: the user doesn't own a referenced document.
	ErrForbiddenDocuments = errors.New("you do not have access to one or more of the referenced documents")
)

// LLM is the text-generation dependency (satisfied by *gemini.Client). It's an
// interface so tests can inject a stub without network calls.
type LLM interface {
	Enabled() bool
	Generate(ctx context.Context, systemPrompt, userPrompt string) (string, error)
}

// Service implements the chat/RAG flow over vector_entries + chat tables.
type Service struct {
	queries *repository.Queries
	llm     LLM
}

// NewService builds the RAG service. llm may be a *gemini.Client (disabled when
// no keys) — the service falls back to a template response when llm is nil or
// not Enabled().
func NewService(queries *repository.Queries, llm LLM) *Service {
	return &Service{queries: queries, llm: llm}
}

// NewDefaultService wires a gemini.Client from config for convenience.
func NewDefaultService(queries *repository.Queries, chatModel string) *Service {
	return &Service{queries: queries, llm: gemini.NewClient(chatModel)}
}

// Request is the decoded POST /api/chat body. document_ids accepts either JSON
// numbers or strings (the frontend sends string[]).
type Request struct {
	Message        string
	DocumentIDs    []int32
	ConversationID string
}

// Source is one retrieved-chunk reference returned to the frontend. document_id
// is serialized as a string to match chatService.ts ChatSource.
type Source struct {
	DocumentID string         `json:"document_id"`
	PageNumber *int32         `json:"page_number,omitempty"`
	Metadata   map[string]any `json:"metadata,omitempty"`
}

// Response is the ChatResponse returned to the frontend.
type Response struct {
	Response       string   `json:"response"`
	Sources        []Source `json:"sources"`
	ConversationID string   `json:"conversation_id"`
}

// ProcessQuery runs the full RAG flow: resolve/create session, validate
// ownership, save the user message, retrieve chunks, generate a response, save
// the assistant message, and update the session.
func (s *Service) ProcessQuery(ctx context.Context, userID int32, isSuperuser bool, req Request) (*Response, error) {
	// 1) Validate document ownership up front (403 on any foreign doc).
	if err := s.validateOwnership(ctx, userID, isSuperuser, req.DocumentIDs); err != nil {
		return nil, err
	}

	// 2) Resolve or create the chat session.
	session, err := s.resolveSession(ctx, userID, req)
	if err != nil {
		return nil, err
	}

	// 3) Save the user message.
	userMeta := map[string]any{}
	if len(req.DocumentIDs) > 0 {
		userMeta["document_ids"] = req.DocumentIDs
	}
	if err := s.saveMessage(ctx, session.ID, "user", req.Message, userMeta); err != nil {
		return nil, err
	}

	// 4) Retrieve relevant chunks (filtered by document_ids when provided).
	chunks, err := s.retrieve(ctx, req.Message, req.DocumentIDs)
	if err != nil {
		return nil, err
	}

	// 5) Generate the response (LLM when configured, else template).
	responseText := s.generate(ctx, req.Message, chunks)

	// 6) Build sources and save the assistant message.
	sources := chunksToSources(chunks)
	assistantMeta := map[string]any{"sources": sources}
	if err := s.saveMessage(ctx, session.ID, "assistant", responseText, assistantMeta); err != nil {
		return nil, err
	}

	// 7) Update session.last_message (truncated).
	last := responseText
	if len(last) > 100 {
		last = last[:100] + "..."
	}
	if err := s.queries.UpdateSessionLastMessage(ctx, repository.UpdateSessionLastMessageParams{
		ID:          session.ID,
		LastMessage: &last,
	}); err != nil {
		return nil, err
	}

	return &Response{Response: responseText, Sources: sources, ConversationID: session.ID}, nil
}

func (s *Service) validateOwnership(ctx context.Context, userID int32, isSuperuser bool, docIDs []int32) error {
	if isSuperuser {
		return nil
	}
	for _, id := range docIDs {
		doc, err := s.queries.GetDocument(ctx, id)
		if err != nil {
			return ErrForbiddenDocuments // missing doc → treat as no access
		}
		if doc.UserID == nil || *doc.UserID != userID {
			return ErrForbiddenDocuments
		}
	}
	return nil
}

func (s *Service) resolveSession(ctx context.Context, userID int32, req Request) (repository.ChatSession, error) {
	if req.ConversationID != "" {
		session, err := s.queries.GetSessionByIDForUser(ctx, repository.GetSessionByIDForUserParams{
			ID:     req.ConversationID,
			UserID: &userID,
		})
		if err == nil {
			return session, nil
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return repository.ChatSession{}, fmt.Errorf("get session: %w", err)
		}
		// Not found (or not owned) → fall through to create a new session when
		// the id is unknown.
	}

	title := req.Message
	if len(title) > 50 {
		title = title[:50] + "..."
	}
	session, err := s.queries.CreateSession(ctx, repository.CreateSessionParams{
		ID:          uuid.NewString(),
		UserID:      &userID,
		Title:       title,
		DocumentIds: req.DocumentIDs,
	})
	if err != nil {
		return repository.ChatSession{}, fmt.Errorf("create session: %w", err)
	}
	return session, nil
}

func (s *Service) saveMessage(ctx context.Context, sessionID, role, content string, meta map[string]any) error {
	metaJSON, err := json.Marshal(meta)
	if err != nil {
		return fmt.Errorf("marshal message metadata: %w", err)
	}
	sid := sessionID
	if _, err := s.queries.CreateMessage(ctx, repository.CreateMessageParams{
		SessionID:       &sid,
		Content:         content,
		Role:            role,
		MessageMetadata: metaJSON,
	}); err != nil {
		return fmt.Errorf("create %s message: %w", role, err)
	}
	return nil
}

func (s *Service) retrieve(ctx context.Context, query string, docIDs []int32) ([]repository.VectorEntry, error) {
	var all []repository.VectorEntry
	var err error
	if len(docIDs) > 0 {
		all, err = s.queries.ListVectorEntriesByDocumentIDs(ctx, docIDs)
	} else {
		all, err = s.queries.ListVectorEntries(ctx)
	}
	if err != nil {
		return nil, fmt.Errorf("list vector entries: %w", err)
	}
	return retrieveRelevant(query, all), nil
}

// generate produces the answer. With an enabled LLM it builds a context prompt
// from the chunks; otherwise it returns the template answer.
func (s *Service) generate(ctx context.Context, query string, chunks []repository.VectorEntry) string {
	if len(chunks) == 0 {
		return "I couldn't find any relevant information in the selected documents to answer your query."
	}

	if s.llm != nil && s.llm.Enabled() {
		text, err := s.llm.Generate(ctx, chatSystemPrompt, buildUserPrompt(query, chunks))
		if err == nil && strings.TrimSpace(text) != "" {
			return text
		}
		// On LLM error/empty, log and fall through to the template (graceful
		// degrade). The error text never contains the API key.
		if err != nil {
			slog.Warn("chat LLM generation failed; using template response", slog.Any("error", err))
		}
	}
	return templateResponse(chunks)
}

const chatSystemPrompt = "You are a helpful assistant answering questions about the user's documents. " +
	"Use only the provided context excerpts to answer. If the context doesn't contain the answer, say so. " +
	"Be concise and cite page numbers when relevant."

func buildUserPrompt(query string, chunks []repository.VectorEntry) string {
	var sb strings.Builder
	sb.WriteString("Context excerpts:\n\n")
	for i, c := range chunks {
		sb.WriteString("[")
		sb.WriteString(strconv.Itoa(i + 1))
		sb.WriteString("]")
		if c.PageNumber != nil {
			sb.WriteString(" (page ")
			sb.WriteString(strconv.Itoa(int(*c.PageNumber)))
			sb.WriteString(")")
		}
		sb.WriteString("\n")
		sb.WriteString(c.ChunkText)
		sb.WriteString("\n\n")
	}
	sb.WriteString("Question: ")
	sb.WriteString(query)
	return sb.String()
}

// templateResponse builds a fallback answer from the chunks.
func templateResponse(chunks []repository.VectorEntry) string {
	var sb strings.Builder
	sb.WriteString("Here's what I found in the documents:\n\n")
	for _, c := range chunks {
		docName := "Unknown document"
		if md := decodeMeta(c.MessageMetadata); md != nil {
			if v, ok := md["document_name"].(string); ok && v != "" {
				docName = v
			}
		}
		sb.WriteString("From document '")
		sb.WriteString(docName)
		sb.WriteString("'")
		if c.PageNumber != nil {
			sb.WriteString(", page ")
			sb.WriteString(strconv.Itoa(int(*c.PageNumber)))
		}
		sb.WriteString(":\n")
		text := c.ChunkText
		if len(text) > 200 {
			text = text[:200] + "..."
		}
		sb.WriteString(text)
		sb.WriteString("\n\n")
	}
	return sb.String()
}

// chunksToSources maps chunks to frontend ChatSource entries (document_id as
// string).
func chunksToSources(chunks []repository.VectorEntry) []Source {
	sources := make([]Source, 0, len(chunks))
	for _, c := range chunks {
		src := Source{Metadata: decodeMeta(c.MessageMetadata)}
		if c.DocumentID != nil {
			src.DocumentID = strconv.Itoa(int(*c.DocumentID))
		}
		if c.PageNumber != nil {
			pn := *c.PageNumber
			src.PageNumber = &pn
		}
		sources = append(sources, src)
	}
	return sources
}

func decodeMeta(raw []byte) map[string]any {
	if len(raw) == 0 {
		return nil
	}
	var m map[string]any
	if err := json.Unmarshal(raw, &m); err != nil {
		return nil
	}
	return m
}
