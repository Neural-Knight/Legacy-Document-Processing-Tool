package worker

import (
	"encoding/json"
	"testing"

	"github.com/legacy-document-processing-tool/backend/internal/repository"
)

func strptr(s string) *string { return &s }

func TestFileExt(t *testing.T) {
	cases := []struct {
		doc  repository.Document
		want string
	}{
		{repository.Document{FilePath: strptr("abc_report.PDF")}, "pdf"},
		{repository.Document{FilePath: strptr("x/y/data.csv")}, "csv"},
		{repository.Document{OriginalFilename: strptr("sheet.xlsx")}, "xlsx"},
		{repository.Document{}, ""},
	}
	for _, c := range cases {
		if got := fileExt(c.doc); got != c.want {
			t.Errorf("fileExt(%+v) = %q, want %q", c.doc, got, c.want)
		}
	}
}

func TestPlaceholderContentShape(t *testing.T) {
	doc := repository.Document{
		OriginalFilename: strptr("data.csv"),
		FilePath:         strptr("abc_data.csv"),
	}
	raw, err := placeholderContent(doc)
	if err != nil {
		t.Fatalf("placeholderContent: %v", err)
	}
	var payload map[string]any
	if err := json.Unmarshal(raw, &payload); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if payload["extraction_status"] != "placeholder" {
		t.Fatalf("expected extraction_status=placeholder, got %v", payload["extraction_status"])
	}
	meta, ok := payload["metadata"].(map[string]any)
	if !ok || meta["filename"] != "data.csv" {
		t.Fatalf("expected metadata.filename=data.csv, got %v", payload["metadata"])
	}
}

func TestPlaceholderContentExcelLabel(t *testing.T) {
	for _, ext := range []string{"xlsx", "xls"} {
		doc := repository.Document{
			OriginalFilename: strptr("book." + ext),
			FilePath:         strptr("id_book." + ext),
		}
		raw, _ := placeholderContent(doc)
		var payload map[string]any
		json.Unmarshal(raw, &payload)
		meta := payload["metadata"].(map[string]any)
		if meta["file_type"] != "excel" {
			t.Errorf("%s: expected file_type=excel, got %v", ext, meta["file_type"])
		}
	}
}
