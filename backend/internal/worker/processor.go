// Package worker contains the document-processing worker: the job Processor
// interface and the StubProcessor, which performs the status transitions and
// writes a placeholder extraction WITHOUT running any real extraction.
package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"path/filepath"
	"strings"

	"github.com/legacy-document-processing-tool/backend/internal/repository"
)

// Processor performs the work for a claimed job against its document.
// Implementations must be safe to call from multiple goroutines.
type Processor interface {
	Process(ctx context.Context, job repository.ProcessingJob, doc repository.Document) error
}

// StubProcessor implements the placeholder pipeline:
//
//	document status → "processing"
//	write an extractions row with placeholder content (status="completed")
//	document processed=true, status="processed"
//
// On any error the caller (worker loop) records the failure; this processor
// itself only returns the error.
type StubProcessor struct {
	queries *repository.Queries
}

// NewStubProcessor builds the stub processor.
func NewStubProcessor(queries *repository.Queries) *StubProcessor {
	return &StubProcessor{queries: queries}
}

// Process runs the stub pipeline for one document.
func (p *StubProcessor) Process(ctx context.Context, job repository.ProcessingJob, doc repository.Document) error {
	// 1) Mark the document as processing.
	if err := p.setStatus(ctx, doc.ID, "processing", false, nil); err != nil {
		return fmt.Errorf("set processing: %w", err)
	}

	// 2) Build placeholder extraction content for the file type.
	content, err := placeholderContent(doc)
	if err != nil {
		return fmt.Errorf("build placeholder: %w", err)
	}

	// 3) Replace any existing extraction row, then insert the placeholder with
	//    status="completed" on success.
	if err := p.queries.DeleteExtractionsByDocumentID(ctx, doc.ID); err != nil {
		return fmt.Errorf("clear extractions: %w", err)
	}
	completed := "completed"
	if _, err := p.queries.UpsertExtraction(ctx, repository.UpsertExtractionParams{
		DocumentID: doc.ID,
		Content:    content,
		Status:     &completed,
		Error:      nil,
	}); err != nil {
		return fmt.Errorf("write extraction: %w", err)
	}

	// 4) Mark the document processed.
	if err := p.setStatus(ctx, doc.ID, "processed", true, nil); err != nil {
		return fmt.Errorf("set processed: %w", err)
	}
	return nil
}

func (p *StubProcessor) setStatus(ctx context.Context, docID int32, status string, processed bool, procErr *string) error {
	_, err := p.queries.UpdateDocumentStatus(ctx, repository.UpdateDocumentStatusParams{
		ID:              docID,
		Status:          &status,
		Processed:       &processed,
		ProcessingError: procErr,
	})
	return err
}

// fileExt returns the lowercase extension (no dot) for a document, derived from
// its stored path or original filename.
func fileExt(doc repository.Document) string {
	name := ""
	if doc.FilePath != nil {
		name = *doc.FilePath
	} else if doc.OriginalFilename != nil {
		name = *doc.OriginalFilename
	}
	return strings.TrimPrefix(strings.ToLower(filepath.Ext(name)), ".")
}

// placeholderContent returns the JSON stored in extractions.content. The shape
// is metadata + content + extraction_status, with a note that real extraction
// is deferred.
func placeholderContent(doc repository.Document) ([]byte, error) {
	filename := ""
	if doc.OriginalFilename != nil {
		filename = *doc.OriginalFilename
	}
	ext := fileExt(doc)

	fileTypeLabel := ext
	switch ext {
	case "xlsx", "xls":
		fileTypeLabel = "excel"
	}

	payload := map[string]any{
		"metadata": map[string]any{
			"filename":  filename,
			"file_type": fileTypeLabel,
		},
		"content": map[string]any{
			"message": "Content extraction is implemented as a placeholder",
		},
		"extraction_status": "placeholder",
	}
	return json.Marshal(payload)
}
