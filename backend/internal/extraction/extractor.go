package extraction

import (
	"context"
	"log/slog"
)

// Extractor produces structured content for a document file. Implementations
// are chosen by file type inside the Service.
type Extractor interface {
	// Extract reads the file at path and returns the structured content plus the
	// directory (if any) where side-effect artifacts (extraction.json,
	// tables/p{N}.md, CreateDB.sql) were written. outputDir is empty for
	// placeholder extractors.
	Extract(ctx context.Context, filePath string, documentID int32) (content *StructuredContent, outputDir string, err error)
}

// PDFTextEngine extracts per-page text (and basic metadata) from a PDF. The
// default implementation shells out to poppler (pdftotext); a CGO MuPDF backend
// could be substituted behind this interface.
type PDFTextEngine interface {
	// PageCount returns the number of pages.
	PageCount(ctx context.Context, path string) (int, error)
	// PageText returns the extracted text for a 1-based page.
	PageText(ctx context.Context, path string, page int) (string, error)
	// Metadata returns document title/author when available.
	Metadata(ctx context.Context, path string) (title, author string, err error)
	// RenderPagePNG renders a 1-based page to a PNG file in dir at the given DPI,
	// returning the file path. Used to feed Gemini/OCR.
	RenderPagePNG(ctx context.Context, path string, page int, dir string, dpi int) (string, error)
}

// TableExtractor turns a rendered page image into table markdown (## header +
// pipe table). The Gemini implementation is optional; when disabled it is nil.
type TableExtractor interface {
	// ExtractTables returns markdown for the page image, or "" if none/skip.
	ExtractTables(ctx context.Context, imagePath string) (markdown string, err error)
	// Enabled reports whether table extraction is configured (e.g. keys present).
	Enabled() bool
}

// OCREngine extracts text from a scanned page image. Optional; nil when no OCR
// binary is available.
type OCREngine interface {
	// OCRImage returns recognized text for the image.
	OCRImage(ctx context.Context, imagePath string) (string, error)
	// Available reports whether the OCR backend is usable.
	Available() bool
}

// Deps bundles the pluggable pieces used by the PDF extractor.
type Deps struct {
	PDF    PDFTextEngine
	Tables TableExtractor
	OCR    OCREngine
	Log    *slog.Logger
}
