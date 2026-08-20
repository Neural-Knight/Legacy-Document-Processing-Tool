// Package documents holds the document domain service: filename/ID generation,
// extension validation, upload-size enforcement, and the upload/delete flows.
// It ports the relevant behavior of the Python document_processor and
// storage_service, minus extraction (deferred to Phase 3).
package documents

import (
	"context"
	"errors"
	"fmt"
	"io"
	"mime"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/legacy-document-processing-tool/backend/internal/repository"
	"github.com/legacy-document-processing-tool/backend/internal/storage"
)

// SupportedExtensions is the upload whitelist, matching
// DocumentProcessor.SUPPORTED_EXTENSIONS in the Python backend.
var SupportedExtensions = []string{"pdf", "xlsx", "xls", "csv", "json", "xml"}

// Sentinel errors mapped to HTTP status codes by the handler layer.
var (
	// ErrUnsupportedType → 400 (Python: "Unsupported file type").
	ErrUnsupportedType = errors.New("Unsupported file type")
	// ErrTooLarge → 413; upload exceeded MAX_UPLOAD_SIZE.
	ErrTooLarge = errors.New("File exceeds maximum upload size")
)

// Service orchestrates document persistence and file storage.
type Service struct {
	queries     *repository.Queries
	store       storage.ObjectStorage
	maxUploadMB int
}

// NewService builds the document service.
func NewService(queries *repository.Queries, store storage.ObjectStorage, maxUploadMB int) *Service {
	return &Service{queries: queries, store: store, maxUploadMB: maxUploadMB}
}

// IsValidExtension reports whether filename has a supported extension
// (case-insensitive), matching the Python _is_valid_file_type check.
func IsValidExtension(filename string) bool {
	ext := strings.TrimPrefix(strings.ToLower(filepath.Ext(filename)), ".")
	for _, e := range SupportedExtensions {
		if e == ext {
			return true
		}
	}
	return false
}

// UploadResult is returned to the handler after a successful upload.
type UploadResult struct {
	Document repository.Document
}

// Upload validates the file, streams it to storage under a base36-prefixed key,
// enforces the size limit, and inserts a document row with status="uploaded"
// and processed=false. Extraction is NOT triggered (Phase 1).
//
// The reader is wrapped in an io.LimitReader so an oversized upload is rejected
// rather than buffered. contentType is the client-declared MIME type; when
// empty it is guessed from the extension.
func (s *Service) Upload(ctx context.Context, userID int32, originalFilename, contentType string, r io.Reader) (repository.Document, error) {
	if !IsValidExtension(originalFilename) {
		return repository.Document{}, ErrUnsupportedType
	}

	if contentType == "" {
		contentType = guessContentType(originalFilename)
	}

	key := generateDocumentID() + "_" + originalFilename

	// Enforce MAX_UPLOAD_SIZE: allow up to the limit, and use one extra byte to
	// detect an overflow. If the reader still has data past the limit, reject.
	maxBytes := int64(s.maxUploadMB) * 1024 * 1024
	limited := &limitTrackingReader{r: io.LimitReader(r, maxBytes+1), max: maxBytes}

	meta, err := s.store.Upload(ctx, key, limited, -1, contentType)
	if err != nil {
		return repository.Document{}, fmt.Errorf("store upload: %w", err)
	}
	if limited.exceeded {
		// Clean up the partial/oversized object we just wrote.
		_ = s.store.Delete(ctx, key)
		return repository.Document{}, ErrTooLarge
	}

	fileSize := strconv.FormatInt(meta.FileSize, 10) // stored as string, matches Python
	status := "uploaded"
	processed := false
	filename := meta.Filename
	filePath := meta.FilePath
	fileType := meta.FileType

	doc, err := s.queries.CreateDocument(ctx, repository.CreateDocumentParams{
		Filename:         &filename,
		OriginalFilename: &originalFilename,
		FilePath:         &filePath,
		FileType:         &fileType,
		FileSize:         &fileSize,
		Processed:        &processed,
		ProcessingError:  nil,
		UserID:           &userID,
		Status:           &status,
	})
	if err != nil {
		// Roll back the stored file if the DB insert fails.
		_ = s.store.Delete(ctx, key)
		return repository.Document{}, fmt.Errorf("create document: %w", err)
	}
	return doc, nil
}

// Download opens the stored object for a document for streaming to the client.
func (s *Service) Download(ctx context.Context, doc repository.Document) (io.ReadCloser, error) {
	if doc.FilePath == nil {
		return nil, storage.ErrNotFound
	}
	return s.store.Download(ctx, *doc.FilePath)
}

// Delete removes the stored file (best effort) then the DB row. CASCADE on the
// schema handles favorites/extractions/vector_entries.
func (s *Service) Delete(ctx context.Context, doc repository.Document) error {
	if doc.FilePath != nil {
		if err := s.store.Delete(ctx, *doc.FilePath); err != nil {
			return fmt.Errorf("delete file: %w", err)
		}
	}
	if _, err := s.queries.DeleteDocument(ctx, doc.ID); err != nil {
		return fmt.Errorf("delete document: %w", err)
	}
	return nil
}

// guessContentType returns a MIME type for the filename, defaulting to
// application/octet-stream (mirrors the Python mimetypes fallback).
func guessContentType(filename string) string {
	if ct := mime.TypeByExtension(filepath.Ext(filename)); ct != "" {
		return ct
	}
	return "application/octet-stream"
}

// limitTrackingReader wraps an io.LimitReader (bounded to max+1) and flags when
// more than `max` bytes were read, so the caller can reject oversized uploads.
type limitTrackingReader struct {
	r        io.Reader
	max      int64
	read     int64
	exceeded bool
}

func (l *limitTrackingReader) Read(p []byte) (int, error) {
	n, err := l.r.Read(p)
	l.read += int64(n)
	if l.read > l.max {
		l.exceeded = true
	}
	return n, err
}
