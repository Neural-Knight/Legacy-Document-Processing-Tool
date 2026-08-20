//go:build integration

package integration

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/legacy-document-processing-tool/backend/internal/extraction"
	"github.com/legacy-document-processing-tool/backend/internal/repository"
	"github.com/legacy-document-processing-tool/backend/internal/worker"
)

// runRealProcessorOnce claims the next due job and runs the Phase 3
// RealProcessor (poppler PDF path, no Gemini/OCR) synchronously.
func runRealProcessorOnce(t *testing.T, pool *pgxpool.Pool, localRoot string) bool {
	t.Helper()
	q := repository.New(pool)
	workerID := "test-real-worker"
	job, err := q.ClaimNextJob(context.Background(), &workerID)
	if err != nil {
		return false
	}
	doc, err := q.GetDocument(context.Background(), job.DocumentID)
	if err != nil {
		_ = q.CompleteJob(context.Background(), job.ID)
		return true
	}
	var pdf extraction.Extractor
	if extraction.PopplerAvailable() {
		pdf = extraction.NewPDFExtractor(
			extraction.Deps{PDF: extraction.NewPopplerEngine()},
			localRoot+"/extractions", 2,
		)
	}
	proc := worker.NewRealProcessor(q, pool, pdf, localRoot, nil)
	if err := proc.Process(context.Background(), job, doc); err != nil {
		t.Fatalf("real processor: %v", err)
	}
	if err := q.CompleteJob(context.Background(), job.ID); err != nil {
		t.Fatalf("complete job: %v", err)
	}
	return true
}

func drainRealJobs(t *testing.T, pool *pgxpool.Pool, localRoot string) {
	t.Helper()
	for i := 0; i < 100; i++ {
		if !runRealProcessorOnce(t, pool, localRoot) {
			return
		}
	}
}

func TestPDFExtractionEndToEnd(t *testing.T) {
	if !extraction.PopplerAvailable() {
		t.Skip("poppler not installed; skipping PDF extraction integration test")
	}

	// Use a temp storage root so the uploaded PDF and extraction artifacts are
	// isolated and cleaned up.
	root := t.TempDir()
	srv, pool := newDocTestServerWithStorage(t, root)
	token, _ := registerAndLogin(t, srv, pool)

	pdfBytes, err := os.ReadFile("../testdata/extraction/sample_text.pdf")
	if err != nil {
		t.Fatalf("read fixture: %v", err)
	}

	// Upload the PDF (unique name to avoid the file_path unique-index collision).
	resp := uploadFile(t, srv, token, "sample_"+itoa(time.Now().UnixNano())+".pdf", pdfBytes)
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("upload: expected 201, got %d", resp.StatusCode)
	}
	var doc docJSON
	json.NewDecoder(resp.Body).Decode(&doc)
	resp.Body.Close()

	// Process via the real processor.
	drainRealJobs(t, pool, root)

	// Poll for processed.
	deadline := time.Now().Add(5 * time.Second)
	var got docJSON
	for time.Now().Before(deadline) {
		r := authGet(t, srv.URL+"/api/documents/"+itoa(int64(doc.ID)), token)
		json.NewDecoder(r.Body).Decode(&got)
		r.Body.Close()
		if got.Status == "processed" {
			break
		}
		time.Sleep(50 * time.Millisecond)
	}
	if got.Status != "processed" || !got.Processed {
		t.Fatalf("expected processed, got %q/%v", got.Status, got.Processed)
	}

	// /extraction → completed.
	r := authGet(t, srv.URL+"/api/documents/"+itoa(int64(doc.ID))+"/extraction", token)
	if r.StatusCode != http.StatusOK {
		t.Fatalf("extraction: expected 200, got %d", r.StatusCode)
	}
	var ext struct {
		Status           string `json:"status"`
		ContentAvailable bool   `json:"content_available"`
	}
	json.NewDecoder(r.Body).Decode(&ext)
	r.Body.Close()
	if ext.Status != "completed" || !ext.ContentAvailable {
		t.Fatalf("extraction: expected completed/true, got %q/%v", ext.Status, ext.ContentAvailable)
	}

	// /content → flat PDF JSON with document_type + pages.
	r = authGet(t, srv.URL+"/api/documents/"+itoa(int64(doc.ID))+"/content", token)
	if r.StatusCode != http.StatusOK {
		t.Fatalf("content: expected 200, got %d", r.StatusCode)
	}
	var content map[string]any
	json.NewDecoder(r.Body).Decode(&content)
	r.Body.Close()
	if content["document_type"] != "machine-readable" {
		t.Fatalf("content: expected document_type machine-readable, got %v", content["document_type"])
	}
	pages, ok := content["pages"].([]any)
	if !ok || len(pages) != 1 {
		t.Fatalf("content: expected 1 page, got %v", content["pages"])
	}

	// /table-markdown → 404 (no Gemini keys, so no table files were written).
	r = authGet(t, srv.URL+"/api/documents/"+itoa(int64(doc.ID))+"/table-markdown", token)
	if r.StatusCode != http.StatusNotFound {
		t.Fatalf("table-markdown (no tables): expected 404, got %d", r.StatusCode)
	}
	r.Body.Close()
}
