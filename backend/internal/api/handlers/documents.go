package handlers

import (
	"errors"
	"mime"
	"net/http"
	"path/filepath"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/legacy-document-processing-tool/backend/internal/documents"
	"github.com/legacy-document-processing-tool/backend/internal/repository"
	"github.com/legacy-document-processing-tool/backend/internal/storage"
)

// DocumentHandler serves /api/upload and /api/documents/* endpoints, porting
// app/api/routes/documents.py. Auth is enforced by RequireAuth middleware;
// ownership rules (owner OR is_superuser) are checked per-request.
type DocumentHandler struct {
	queries *repository.Queries
	docs    *documents.Service
}

// NewDocumentHandler builds the document handler.
func NewDocumentHandler(queries *repository.Queries, docs *documents.Service) *DocumentHandler {
	return &DocumentHandler{queries: queries, docs: docs}
}

// ---- DTO (matches app/schemas/document.py Document shape) ----

type documentResponse struct {
	ID               int32      `json:"id"`
	Filename         string     `json:"filename"`
	OriginalFilename string     `json:"original_filename"`
	FilePath         string     `json:"file_path"`
	FileType         string     `json:"file_type"`
	FileSize         string     `json:"file_size"` // string, matching Python
	UploadDate       *time.Time `json:"upload_date"`
	Processed        bool       `json:"processed"`
	ProcessingError  *string    `json:"processing_error"`
	UserID           *int32     `json:"user_id"`
	Status           *string    `json:"status"`
}

func toDocumentResponse(d repository.Document) documentResponse {
	resp := documentResponse{
		ID:              d.ID,
		ProcessingError: d.ProcessingError,
		UserID:          d.UserID,
		Status:          d.Status,
	}
	resp.Filename = deref(d.Filename)
	resp.OriginalFilename = deref(d.OriginalFilename)
	resp.FilePath = deref(d.FilePath)
	resp.FileType = deref(d.FileType)
	resp.FileSize = deref(d.FileSize)
	if d.Processed != nil {
		resp.Processed = *d.Processed
	}
	if d.UploadDate.Valid {
		t := d.UploadDate.Time
		resp.UploadDate = &t
	}
	return resp
}

func toDocumentResponses(ds []repository.Document) []documentResponse {
	out := make([]documentResponse, 0, len(ds))
	for _, d := range ds {
		out = append(out, toDocumentResponse(d))
	}
	return out
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

type favoriteRequest struct {
	Favorite bool `json:"favorite"`
}

// ---- Handlers ----

// Upload accepts a multipart "file" field, stores it, and creates a document
// (POST /api/upload → 201).
func (h *DocumentHandler) Upload(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		respondUnauthorized(w, "Could not validate credentials")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, "file field is required")
		return
	}
	defer file.Close()

	contentType := header.Header.Get("Content-Type")

	doc, err := h.docs.Upload(r.Context(), user.ID, header.Filename, contentType, file)
	if err != nil {
		switch {
		case errors.Is(err, documents.ErrUnsupportedType):
			writeError(w, http.StatusBadRequest, documents.ErrUnsupportedType.Error())
		case errors.Is(err, documents.ErrTooLarge):
			writeError(w, http.StatusRequestEntityTooLarge, documents.ErrTooLarge.Error())
		default:
			writeError(w, http.StatusInternalServerError, "Internal server error")
		}
		return
	}
	writeJSON(w, http.StatusCreated, toDocumentResponse(doc))
}

// ListDocuments returns documents with pagination. Regular users (and admins
// with owned_only=true) get their own; a superuser with owned_only=false gets
// all (GET /api/documents).
func (h *DocumentHandler) ListDocuments(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		respondUnauthorized(w, "Could not validate credentials")
		return
	}

	skip := parseIntDefault(r.URL.Query().Get("skip"), 0)
	limit := parseIntDefault(r.URL.Query().Get("limit"), 100)
	ownedOnly := parseBoolDefault(r.URL.Query().Get("owned_only"), true)

	var (
		docs []repository.Document
		err  error
	)
	if ownedOnly || !isSuperuser(user) {
		docs, err = h.queries.ListDocumentsByUser(r.Context(), repository.ListDocumentsByUserParams{
			UserID: &user.ID,
			Offset: int32(skip),
			Limit:  int32(limit),
		})
	} else {
		docs, err = h.queries.ListAllDocuments(r.Context(), repository.ListAllDocumentsParams{
			Offset: int32(skip),
			Limit:  int32(limit),
		})
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal server error")
		return
	}
	writeJSON(w, http.StatusOK, toDocumentResponses(docs))
}

// GetDocument returns a single document by id, enforcing ownership
// (GET /api/documents/{id}).
func (h *DocumentHandler) GetDocument(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		respondUnauthorized(w, "Could not validate credentials")
		return
	}
	doc, found := h.loadOwned(w, r, user, "You do not have permission to access this document")
	if !found {
		return
	}
	writeJSON(w, http.StatusOK, toDocumentResponse(doc))
}

// DeleteDocument deletes the file and DB row (DELETE /api/documents/{id} → 204).
func (h *DocumentHandler) DeleteDocument(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		respondUnauthorized(w, "Could not validate credentials")
		return
	}
	doc, found := h.loadOwned(w, r, user, "You do not have permission to delete this document")
	if !found {
		return
	}
	if err := h.docs.Delete(r.Context(), doc); err != nil {
		writeError(w, http.StatusInternalServerError, "Internal server error")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// Download streams the stored file. Any filePath query param is ignored, as in
// Python (GET /api/documents/{id}/download).
func (h *DocumentHandler) Download(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		respondUnauthorized(w, "Could not validate credentials")
		return
	}
	doc, found := h.loadOwned(w, r, user, "You do not have permission to download this document")
	if !found {
		return
	}

	body, err := h.docs.Download(r.Context(), doc)
	if err != nil {
		if errors.Is(err, storage.ErrNotFound) {
			writeError(w, http.StatusNotFound, "File not found in storage")
			return
		}
		writeError(w, http.StatusInternalServerError, "Internal server error")
		return
	}
	defer body.Close()

	filename := filepath.Base(deref(doc.FilePath))
	contentType := mime.TypeByExtension(filepath.Ext(filename))
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Content-Disposition", `attachment; filename="`+filename+`"`)
	w.WriteHeader(http.StatusOK)
	_, _ = copyStream(w, body)
}

// ListFavorites returns the user's favorite documents
// (GET /api/documents/favorites).
func (h *DocumentHandler) ListFavorites(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		respondUnauthorized(w, "Could not validate credentials")
		return
	}
	docs, err := h.queries.ListFavoriteDocuments(r.Context(), user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Could not retrieve favorite documents")
		return
	}
	writeJSON(w, http.StatusOK, toDocumentResponses(docs))
}

// ToggleFavorite adds/removes a document from the user's favorites
// (POST /api/documents/{id}/favorite → {"success": true}).
func (h *DocumentHandler) ToggleFavorite(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		respondUnauthorized(w, "Could not validate credentials")
		return
	}
	doc, found := h.loadOwned(w, r, user, "You do not have permission to favorite this document")
	if !found {
		return
	}

	var req favoriteRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusUnprocessableEntity, "Invalid request body")
		return
	}

	if req.Favorite {
		err := h.queries.AddFavorite(r.Context(), repository.AddFavoriteParams{
			UserID:     user.ID,
			DocumentID: doc.ID,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "Could not update favorite status")
			return
		}
	} else {
		if _, err := h.queries.RemoveFavorite(r.Context(), repository.RemoveFavoriteParams{
			UserID:     user.ID,
			DocumentID: doc.ID,
		}); err != nil {
			writeError(w, http.StatusInternalServerError, "Could not update favorite status")
			return
		}
	}
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

// ---- Extraction ----

// GetExtractionStatus returns the extraction status for a document, matching
// Python: {status, extraction_date, error, content_available}. 404 when no
// extraction row exists yet (GET /api/documents/{id}/extraction).
func (h *DocumentHandler) GetExtractionStatus(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		respondUnauthorized(w, "Could not validate credentials")
		return
	}
	doc, found := h.loadOwned(w, r, user, "Not enough permissions")
	if !found {
		return
	}
	ext, err := h.queries.GetExtractionByDocumentID(r.Context(), doc.ID)
	if err != nil {
		writeError(w, http.StatusNotFound, "Extraction not found")
		return
	}

	var extractionDate *time.Time
	if ext.ExtractionDate.Valid {
		t := ext.ExtractionDate.Time
		extractionDate = &t
	}
	status := deref(ext.Status)
	writeJSON(w, http.StatusOK, map[string]any{
		"status":            status,
		"extraction_date":   extractionDate,
		"error":             ext.Error,
		"content_available": status == "completed",
	})
}

// GetExtractionContent returns the extracted content JSON. Until Phase 3 the
// worker writes a placeholder, so a completed extraction returns that
// placeholder; a not-yet-completed one returns a status message; missing → 404
// (GET /api/documents/{id}/content).
func (h *DocumentHandler) GetExtractionContent(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		respondUnauthorized(w, "Could not validate credentials")
		return
	}
	doc, found := h.loadOwned(w, r, user, "Not enough permissions")
	if !found {
		return
	}
	ext, err := h.queries.GetExtractionByDocumentID(r.Context(), doc.ID)
	if err != nil {
		writeError(w, http.StatusNotFound, "Extraction not found")
		return
	}
	status := deref(ext.Status)
	if status != "completed" {
		writeJSON(w, http.StatusOK, map[string]any{
			"status":  status,
			"message": "Content extraction is " + status,
		})
		return
	}
	// ext.Content is raw JSON; write it through unchanged.
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	if len(ext.Content) > 0 {
		_, _ = w.Write(ext.Content)
	} else {
		_, _ = w.Write([]byte("null"))
	}
}

// GetTableMarkdown remains a 404 stub until real table extraction lands in
// Phase 3 (GET /api/documents/{id}/table-markdown).
func (h *DocumentHandler) GetTableMarkdown(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		respondUnauthorized(w, "Could not validate credentials")
		return
	}
	if _, found := h.loadOwned(w, r, user, "Not enough permissions"); !found {
		return
	}
	writeError(w, http.StatusNotFound, "Extraction not found")
}

// ---- helpers ----

// loadOwned fetches the {id} document and enforces owner-or-superuser access.
// It writes the appropriate error (404 not found / 403 forbidden) and returns
// found=false on failure. forbiddenMsg matches the Python per-route wording.
func (h *DocumentHandler) loadOwned(w http.ResponseWriter, r *http.Request, user repository.User, forbiddenMsg string) (repository.Document, bool) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusNotFound, "Document not found")
		return repository.Document{}, false
	}
	doc, err := h.queries.GetDocument(r.Context(), int32(id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "Document not found")
		} else {
			writeError(w, http.StatusInternalServerError, "Internal server error")
		}
		return repository.Document{}, false
	}
	if !canAccess(user, doc) {
		writeError(w, http.StatusForbidden, forbiddenMsg)
		return repository.Document{}, false
	}
	return doc, true
}

// canAccess is the owner-OR-superuser rule from Python.
func canAccess(user repository.User, doc repository.Document) bool {
	if isSuperuser(user) {
		return true
	}
	return doc.UserID != nil && *doc.UserID == user.ID
}

func isSuperuser(user repository.User) bool {
	return user.IsSuperuser != nil && *user.IsSuperuser
}

func parseIntDefault(s string, def int) int {
	if s == "" {
		return def
	}
	if n, err := strconv.Atoi(s); err == nil {
		return n
	}
	return def
}

func parseBoolDefault(s string, def bool) bool {
	if s == "" {
		return def
	}
	if b, err := strconv.ParseBool(s); err == nil {
		return b
	}
	return def
}
