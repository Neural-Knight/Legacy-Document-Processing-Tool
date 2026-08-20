package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"path/filepath"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/legacy-document-processing-tool/backend/internal/extraction"
	"github.com/legacy-document-processing-tool/backend/internal/md2sql"
	"github.com/legacy-document-processing-tool/backend/internal/repository"
)

// RealProcessor implements the Phase 3 pipeline. For PDFs it runs the extraction
// package (text + optional OCR + optional Gemini tables), writes artifacts, runs
// md2sql on any tables/*.md, and stores the flat structured JSON. Non-PDF types
// keep the Python placeholder wrapper. Status transitions match StubProcessor:
// uploaded → processing → processed (or error on failure).
//
// It satisfies worker.Processor, so cmd/worker can swap it in without touching
// the Runner.
type RealProcessor struct {
	queries   *repository.Queries
	pool      *pgxpool.Pool
	pdf       extraction.Extractor
	localRoot string // LOCAL_STORAGE_PATH; used to resolve the absolute file path
	log       *slog.Logger
}

// NewRealProcessor builds the real processor. pdf may be nil (then all types use
// the placeholder path — useful when poppler is unavailable).
func NewRealProcessor(queries *repository.Queries, pool *pgxpool.Pool, pdf extraction.Extractor, localRoot string, log *slog.Logger) *RealProcessor {
	if log == nil {
		log = slog.Default()
	}
	return &RealProcessor{queries: queries, pool: pool, pdf: pdf, localRoot: localRoot, log: log}
}

// Process runs extraction for one document.
func (p *RealProcessor) Process(ctx context.Context, job repository.ProcessingJob, doc repository.Document) error {
	if err := p.setStatus(ctx, doc.ID, "processing", false, nil); err != nil {
		return fmt.Errorf("set processing: %w", err)
	}

	originalName := ""
	if doc.OriginalFilename != nil {
		originalName = *doc.OriginalFilename
	}
	relPath := ""
	if doc.FilePath != nil {
		relPath = *doc.FilePath
	}
	absPath := filepath.Join(p.localRoot, relPath)

	var content []byte

	if extraction.IsPDF(originalName) && p.pdf != nil {
		structured, outputDir, err := p.pdf.Extract(ctx, absPath, doc.ID)
		if err != nil {
			return fmt.Errorf("pdf extract: %w", err)
		}
		b, err := json.Marshal(structured)
		if err != nil {
			return fmt.Errorf("marshal content: %w", err)
		}
		content = b

		// Load any extracted tables into dynamic SQL tables (md2sql). Best-effort:
		// table load failures are logged but don't fail the job, matching Python.
		if outputDir != "" {
			tablesDir := filepath.Join(outputDir, "tables")
			prefix := base36Timestamp()
			if _, errs := md2sql.ProcessDirectory(ctx, p.pool, p.queries, tablesDir, prefix, doc.ID); len(errs) > 0 {
				for _, e := range errs {
					p.log.Warn("md2sql", slog.Int("document_id", int(doc.ID)), slog.Any("error", e))
				}
			}
		}
	} else {
		// Non-PDF: keep the Python placeholder wrapper.
		content = extraction.PlaceholderContent(originalName, relPath)
	}

	// Replace any existing extraction row, then insert completed.
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

	if err := p.setStatus(ctx, doc.ID, "processed", true, nil); err != nil {
		return fmt.Errorf("set processed: %w", err)
	}
	return nil
}

func (p *RealProcessor) setStatus(ctx context.Context, docID int32, status string, processed bool, procErr *string) error {
	_, err := p.queries.UpdateDocumentStatus(ctx, repository.UpdateDocumentStatusParams{
		ID:              docID,
		Status:          &status,
		Processed:       &processed,
		ProcessingError: procErr,
	})
	return err
}
