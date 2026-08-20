package extraction

import (
	"context"
	"encoding/json"
	"flag"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// updateGolden regenerates the committed golden file when set (-update).
var updateGolden = flag.Bool("update", false, "regenerate extraction golden files")

// fixturePDF is the minimal text PDF committed under test/testdata/extraction.
const fixturePDF = "../../test/testdata/extraction/sample_text.pdf"

// requirePoppler skips a test when the poppler binaries are not installed.
func requirePoppler(t *testing.T) {
	t.Helper()
	if !PopplerAvailable() {
		t.Skip("poppler (pdftotext/pdfinfo) not installed; skipping")
	}
}

func TestPopplerEngineOnFixture(t *testing.T) {
	requirePoppler(t)
	e := NewPopplerEngine()
	ctx := context.Background()

	n, err := e.PageCount(ctx, fixturePDF)
	if err != nil {
		t.Fatalf("PageCount: %v", err)
	}
	if n != 1 {
		t.Fatalf("expected 1 page, got %d", n)
	}
	text, err := e.PageText(ctx, fixturePDF, 1)
	if err != nil {
		t.Fatalf("PageText: %v", err)
	}
	if !strings.Contains(text, "Hello world extraction test") {
		t.Fatalf("unexpected page text: %q", text)
	}
}

func TestPDFExtractorOnFixture(t *testing.T) {
	requirePoppler(t)
	tmp := t.TempDir()
	deps := Deps{PDF: NewPopplerEngine()} // no Gemini, no OCR
	ex := NewPDFExtractor(deps, tmp, 2)

	content, outDir, err := ex.Extract(context.Background(), fixturePDF, 999)
	if err != nil {
		t.Fatalf("Extract: %v", err)
	}
	if content.DocumentType != string(PDFMachineReadable) {
		t.Fatalf("expected machine-readable, got %q", content.DocumentType)
	}
	if len(content.Pages) != 1 {
		t.Fatalf("expected 1 page, got %d", len(content.Pages))
	}
	if content.Pages[0].PageNumber != 1 || content.Pages[0].IsScanned {
		t.Fatalf("unexpected page: %+v", content.Pages[0])
	}
	if !strings.Contains(content.Pages[0].PageContent, "Hello world") {
		t.Fatalf("page content missing text: %q", content.Pages[0].PageContent)
	}
	// extraction.json should be written to the output dir.
	if _, err := os.Stat(filepath.Join(outDir, "extraction.json")); err != nil {
		t.Fatalf("expected extraction.json in %s: %v", outDir, err)
	}
}

// TestGoldenExtractionShape compares the extractor's structured output against a
// committed golden file (normalizing volatile fields). The golden was produced
// by this Go pipeline on the fixture PDF (see test/testdata/extraction/README).
func TestGoldenExtractionShape(t *testing.T) {
	requirePoppler(t)
	goldenPath := "../../test/testdata/extraction/sample_text.golden.json"

	deps := Deps{PDF: NewPopplerEngine()}
	ex := NewPDFExtractor(deps, t.TempDir(), 2)
	content, _, err := ex.Extract(context.Background(), fixturePDF, 1)
	if err != nil {
		t.Fatalf("Extract: %v", err)
	}

	if *updateGolden {
		b, _ := json.MarshalIndent(content, "", "  ")
		if werr := os.WriteFile(goldenPath, b, 0o644); werr != nil {
			t.Fatalf("write golden: %v", werr)
		}
		t.Logf("golden updated: %s", goldenPath)
		return
	}

	goldenRaw, err := os.ReadFile(goldenPath)
	if err != nil {
		t.Skipf("golden file missing (%v); run with -update to generate", err)
	}

	var got, want map[string]any
	gb, _ := json.Marshal(content)
	json.Unmarshal(gb, &got)
	json.Unmarshal(goldenRaw, &want)

	// Compare the stable top-level keys and page structure.
	for _, key := range []string{"document_type"} {
		if got[key] != want[key] {
			t.Errorf("%s: got %v, want %v", key, got[key], want[key])
		}
	}
	gotPages, _ := got["pages"].([]any)
	wantPages, _ := want["pages"].([]any)
	if len(gotPages) != len(wantPages) {
		t.Fatalf("page count: got %d, want %d", len(gotPages), len(wantPages))
	}
}
