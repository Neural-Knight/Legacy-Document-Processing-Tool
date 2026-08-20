package extraction

import (
	"encoding/json"
	"testing"
)

func TestDetectType(t *testing.T) {
	cases := []struct {
		total, scanned, readable int
		want                     PDFType
	}{
		{0, 0, 0, PDFEmpty},
		{3, 3, 0, PDFScanned},
		{3, 0, 3, PDFMachineReadable},
		{3, 1, 2, PDFMixed},
	}
	for _, c := range cases {
		if got := detectType(c.total, c.scanned, c.readable); got != c.want {
			t.Errorf("detectType(%d,%d,%d) = %q, want %q", c.total, c.scanned, c.readable, got, c.want)
		}
	}
}

func TestPlaceholderContentShapes(t *testing.T) {
	cases := map[string]string{
		"a.csv":  "csv",
		"b.xlsx": "excel",
		"c.xls":  "excel",
		"d.json": "json",
		"e.xml":  "xml",
	}
	for fn, wantType := range cases {
		raw := PlaceholderContent(fn, "stored_"+fn)
		var p map[string]any
		if err := json.Unmarshal(raw, &p); err != nil {
			t.Fatalf("%s: unmarshal: %v", fn, err)
		}
		if p["extraction_status"] != "placeholder" {
			t.Errorf("%s: extraction_status = %v", fn, p["extraction_status"])
		}
		meta := p["metadata"].(map[string]any)
		if meta["file_type"] != wantType {
			t.Errorf("%s: file_type = %v, want %v", fn, meta["file_type"], wantType)
		}
	}
}

func TestIsPDF(t *testing.T) {
	if !IsPDF("report.PDF") || !IsPDF("x/y.pdf") {
		t.Fatal("expected .pdf/.PDF to be recognized")
	}
	if IsPDF("a.csv") {
		t.Fatal("csv should not be a PDF")
	}
}

func TestParseMarkdownTables(t *testing.T) {
	md := "## sales\n" +
		"| region | revenue |\n" +
		"|--------|---------|\n" +
		"| north  | 100 |\n" +
		"| south  | 200 |\n"
	tables := parseMarkdownTables(md)
	if len(tables) != 1 {
		t.Fatalf("expected 1 table, got %d", len(tables))
	}
	if len(tables[0].Headers) != 2 || tables[0].Headers[0] != "region" {
		t.Fatalf("unexpected headers: %v", tables[0].Headers)
	}
	if len(tables[0].Data) != 2 || tables[0].Data[1][1] != "200" {
		t.Fatalf("unexpected data: %v", tables[0].Data)
	}
}

func TestParseMarkdownTablesNone(t *testing.T) {
	if got := parseMarkdownTables("no tables here"); len(got) != 0 {
		t.Fatalf("expected 0 tables, got %d", len(got))
	}
}

func TestGeminiDisabledWhenNoKeys(t *testing.T) {
	t.Setenv("GEMINI_KEYS", "")
	g := NewGeminiClient("")
	if g.Enabled() {
		t.Fatal("expected Gemini disabled when GEMINI_KEYS empty")
	}
	// ExtractTables must be a no-op (no error, empty result) when disabled.
	md, err := g.ExtractTables(nil, "/nonexistent.png")
	if err != nil || md != "" {
		t.Fatalf("disabled client should return empty/no error, got %q / %v", md, err)
	}
}

func TestGeminiEnabledWithKeys(t *testing.T) {
	t.Setenv("GEMINI_KEYS", "key1 key2  key3")
	g := NewGeminiClient("")
	if !g.Enabled() {
		t.Fatal("expected Gemini enabled with keys")
	}
	if len(g.keys) != 3 {
		t.Fatalf("expected 3 parsed keys, got %d", len(g.keys))
	}
	// Round-robin key selection.
	if g.nextKey() != "key1" || g.nextKey() != "key2" || g.nextKey() != "key3" || g.nextKey() != "key1" {
		t.Fatal("key rotation not round-robin")
	}
}
