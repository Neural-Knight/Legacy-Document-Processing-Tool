package extraction

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// pdfDPI is the render resolution for Gemini/OCR page images (150 dpi).
const pdfDPI = 150

// PDFExtractor implements Extractor for PDFs. It detects the PDF type, extracts
// per-page text (OCR fallback for low-text pages when OCR is available), and
// optionally renders pages for Gemini table markdown. Artifacts are written
// under extractionsRoot/doc_{id}/{ts}_{basename}/.
type PDFExtractor struct {
	deps            Deps
	extractionsRoot string // {LOCAL_STORAGE_PATH}/extractions
	maxPageWorkers  int
}

// NewPDFExtractor builds a PDF extractor. extractionsRoot is the directory under
// which per-document output folders are created.
func NewPDFExtractor(deps Deps, extractionsRoot string, maxPageWorkers int) *PDFExtractor {
	if maxPageWorkers < 1 {
		maxPageWorkers = 1
	}
	if deps.Log == nil {
		deps.Log = slog.Default()
	}
	return &PDFExtractor{deps: deps, extractionsRoot: extractionsRoot, maxPageWorkers: maxPageWorkers}
}

// Extract runs the PDF pipeline and returns the structured content plus the
// output directory where tables/CreateDB.sql/extraction.json were written.
func (e *PDFExtractor) Extract(ctx context.Context, filePath string, documentID int32) (*StructuredContent, string, error) {
	log := e.deps.Log.With(slog.Int("document_id", int(documentID)))

	pageCount, err := e.deps.PDF.PageCount(ctx, filePath)
	if err != nil {
		return nil, "", fmt.Errorf("page count: %w", err)
	}
	if pageCount == 0 {
		return &StructuredContent{DocumentType: string(PDFEmpty), Title: "Untitled", Author: "Unknown", Pages: []Page{}}, "", nil
	}

	title, author, _ := e.deps.PDF.Metadata(ctx, filePath)
	if title == "" {
		title = "Untitled"
	}
	if author == "" {
		author = "Unknown"
	}

	// Prepare the output directory.
	base := strings.TrimSuffix(filepath.Base(filePath), filepath.Ext(filePath))
	ts := time.Now().Format("20060102_150405")
	outputDir := filepath.Join(e.extractionsRoot, fmt.Sprintf("doc_%d", documentID), fmt.Sprintf("%s_%s", ts, base))
	tablesDir := filepath.Join(outputDir, "tables")
	imagesDir := filepath.Join(outputDir, "page_images")
	if err := os.MkdirAll(tablesDir, 0o755); err != nil {
		return nil, "", fmt.Errorf("mkdir tables: %w", err)
	}
	if err := os.MkdirAll(imagesDir, 0o755); err != nil {
		return nil, "", fmt.Errorf("mkdir page_images: %w", err)
	}

	// First pass: per-page text + scanned detection.
	pages := make([]Page, 0, pageCount)
	scannedCount, readableCount := 0, 0
	for p := 1; p <= pageCount; p++ {
		text, terr := e.deps.PDF.PageText(ctx, filePath, p)
		if terr != nil {
			log.Warn("page text extraction failed", slog.Int("page", p), slog.Any("error", terr))
			text = ""
		}
		isScanned := len(strings.TrimSpace(text)) < TextThreshold
		method := "text"
		if isScanned {
			scannedCount++
			// OCR fallback when available.
			if e.deps.OCR != nil && e.deps.OCR.Available() {
				if img, rerr := e.deps.PDF.RenderPagePNG(ctx, filePath, p, imagesDir, pdfDPI); rerr == nil {
					if ocrText, oerr := e.deps.OCR.OCRImage(ctx, img); oerr == nil && strings.TrimSpace(ocrText) != "" {
						text = ocrText
						method = "tesseract_ocr"
					} else if oerr != nil {
						log.Warn("ocr failed", slog.Int("page", p), slog.Any("error", oerr))
					}
				}
			}
		} else {
			readableCount++
		}
		pages = append(pages, Page{
			PageNumber:       p,
			PageContent:      text,
			ImageContent:     []Image{},
			IsScanned:        isScanned,
			ExtractionMethod: method,
		})
	}

	docType := detectType(pageCount, scannedCount, readableCount)

	// Second pass (optional): Gemini table markdown per page → tables/p{N}.md,
	// and populate pages[].tables presence.
	if e.deps.Tables != nil && e.deps.Tables.Enabled() {
		e.extractTables(ctx, log, filePath, imagesDir, tablesDir, pages)
	} else {
		log.Info("table extraction skipped (no Gemini keys configured)")
	}

	content := &StructuredContent{
		DocumentType: string(docType),
		Title:        title,
		Author:       author,
		Pages:        pages,
	}

	// Write extraction.json.
	if data, merr := json.MarshalIndent(content, "", "  "); merr == nil {
		_ = os.WriteFile(filepath.Join(outputDir, "extraction.json"), data, 0o644)
	}

	// Clean up rendered page images after saving.
	_ = os.RemoveAll(imagesDir)

	return content, outputDir, nil
}

// extractTables renders each page and asks the TableExtractor for markdown,
// writing tables/p{N}.md and marking pages that produced tables. Concurrency is
// bounded by maxPageWorkers.
func (e *PDFExtractor) extractTables(ctx context.Context, log *slog.Logger, filePath, imagesDir, tablesDir string, pages []Page) {
	sem := make(chan struct{}, e.maxPageWorkers)
	type result struct {
		idx      int
		markdown string
	}
	results := make(chan result, len(pages))
	dispatched := 0

	for i := range pages {
		p := pages[i].PageNumber
		idx := i
		dispatched++
		sem <- struct{}{}
		go func() {
			defer func() { <-sem }()
			img, err := e.deps.PDF.RenderPagePNG(ctx, filePath, p, imagesDir, pdfDPI)
			if err != nil {
				log.Warn("render page for tables failed", slog.Int("page", p), slog.Any("error", err))
				results <- result{idx, ""}
				return
			}
			md, err := e.deps.Tables.ExtractTables(ctx, img)
			if err != nil {
				log.Warn("gemini table extraction failed", slog.Int("page", p), slog.Any("error", err))
				results <- result{idx, ""}
				return
			}
			results <- result{idx, md}
		}()
	}

	for i := 0; i < dispatched; i++ {
		r := <-results
		if strings.TrimSpace(r.markdown) == "" {
			continue
		}
		page := pages[r.idx]
		mdPath := filepath.Join(tablesDir, fmt.Sprintf("p%d.md", page.PageNumber))
		if err := os.WriteFile(mdPath, []byte(r.markdown), 0o644); err != nil {
			log.Warn("write table markdown failed", slog.Int("page", page.PageNumber), slog.Any("error", err))
			continue
		}
		// Mark table presence so the frontend shows the Tables tab. The parsed
		// header/data are populated from the markdown for the content payload.
		pages[r.idx].Tables = parseMarkdownTables(r.markdown)
	}
}

// detectType maps page counts to a PDFType.
func detectType(total, scanned, readable int) PDFType {
	switch {
	case total == 0:
		return PDFEmpty
	case scanned == total:
		return PDFScanned
	case readable == total:
		return PDFMachineReadable
	default:
		return PDFMixed
	}
}
