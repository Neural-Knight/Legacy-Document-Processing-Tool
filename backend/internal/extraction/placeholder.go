package extraction

import (
	"encoding/json"
	"path/filepath"
	"strings"
)

// PlaceholderContent returns the raw JSON stored for non-PDF file types
// (csv, xlsx, xls, json, xml): {metadata, content:{message,file_path},
// extraction_status:"placeholder"}. Real parsers for these types are not yet
// implemented; extraction currently focuses on PDF.
func PlaceholderContent(originalFilename, filePath string) []byte {
	ext := strings.TrimPrefix(strings.ToLower(filepath.Ext(originalFilename)), ".")

	fileType := ext
	var message string
	switch ext {
	case "csv":
		fileType = "csv"
		message = "CSV content extraction is implemented as a placeholder"
	case "xlsx", "xls":
		fileType = "excel"
		message = "Excel content extraction is implemented as a placeholder"
	default:
		message = strings.ToUpper(ext) + " content extraction is implemented as a placeholder"
	}

	payload := map[string]any{
		"metadata": map[string]any{
			"filename":  filepath.Base(originalFilename),
			"file_type": fileType,
		},
		"content": map[string]any{
			"message":   message,
			"file_path": filePath,
		},
		"extraction_status": "placeholder",
	}
	b, _ := json.Marshal(payload)
	return b
}

// IsPDF reports whether the filename has a .pdf extension.
func IsPDF(name string) bool {
	return strings.EqualFold(filepath.Ext(name), ".pdf")
}
