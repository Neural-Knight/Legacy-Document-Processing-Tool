// Package extraction ports the Python PDF extraction pipeline
// (backend/app/extractors/*) to Go: PDF type detection, text/table/metadata
// extraction, optional Gemini table markdown, optional OCR, and the structured
// JSON output shape the frontend consumes.
//
// The pipeline is built from small interfaces so the heavy/optional pieces
// (a CGO MuPDF binding, the Gemini API, OCR subprocesses) can be swapped or
// disabled without changing the orchestration. The default PDF text engine uses
// the poppler `pdftotext`/`pdftoppm` subprocesses (no CGO), which are portable
// and match the artifacts the frontend needs.
package extraction

// StructuredContent is the JSON stored in extractions.content and returned by
// GET /api/documents/{id}/content. Field names and shape match the Python
// PdfContentExtractor.get_structured_content() output that
// DocumentContentViewer.tsx reads.
type StructuredContent struct {
	DocumentType string     `json:"document_type"`
	Title        string     `json:"title"`
	Author       string     `json:"author"`
	Pages        []Page     `json:"pages"`
	Bookmarks    []Bookmark `json:"bookmarks,omitempty"`
	Images       []Image    `json:"images,omitempty"` // flattened, top-level (with page)
}

// Page mirrors one entry of pages[] in the Python output.
type Page struct {
	PageNumber       int       `json:"page_number"`
	PageContent      string    `json:"page_content"`
	ImageContent     []Image   `json:"image_content"`
	IsScanned        bool      `json:"isScanned"`
	ExtractionMethod string    `json:"extraction_method,omitempty"`
	Tables           []Table   `json:"tables,omitempty"`
	Hyperlinks       []Link    `json:"hyperlinks,omitempty"`
	Layout           []Layout  `json:"layout,omitempty"`
}

// Table is a page table: header row + data rows (matches {headers, data}).
type Table struct {
	Headers []string   `json:"headers"`
	Data    [][]string `json:"data"`
}

// Image describes an embedded/rendered image (image_content[] item).
type Image struct {
	Index     int    `json:"index"`
	Extension string `json:"extension"`
	MimeType  string `json:"mime_type"`
	Path      string `json:"path"`
	URL       string `json:"url"`
	Page      int    `json:"page,omitempty"` // only set in top-level images[]
}

// Link is a hyperlink annotation.
type Link struct {
	URI  string    `json:"uri"`
	Bbox []float64 `json:"bbox"`
}

// Layout is a page layout descriptor.
type Layout struct {
	Width  float64                  `json:"width"`
	Height float64                  `json:"height"`
	Blocks []map[string]interface{} `json:"blocks"`
}

// Bookmark is a document outline entry.
type Bookmark struct {
	Title string `json:"title"`
	Page  int    `json:"page"`
	Level int    `json:"level"`
}

// PDFType is the detected document category.
type PDFType string

const (
	PDFMachineReadable PDFType = "machine-readable"
	PDFScanned         PDFType = "scanned"
	PDFMixed           PDFType = "mixed"
	PDFEmpty           PDFType = "Empty PDF"
)

// TextThreshold is the per-page char count below which a page is treated as
// scanned (matches the Python default of 50).
const TextThreshold = 50
