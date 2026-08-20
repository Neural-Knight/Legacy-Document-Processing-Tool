package indexer

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/legacy-document-processing-tool/backend/internal/extraction"
)

func TestChunkTextShortReturnsSingle(t *testing.T) {
	got := chunkText("hello world", 1000, 200)
	if len(got) != 1 || got[0] != "hello world" {
		t.Fatalf("expected single chunk, got %v", got)
	}
}

func TestChunkTextOverlapAndProgress(t *testing.T) {
	// Build text well over the chunk size with sentence boundaries.
	sentence := "This is a sentence. "
	text := strings.Repeat(sentence, 200) // ~4000 chars
	chunks := chunkText(text, 1000, 200)
	if len(chunks) < 2 {
		t.Fatalf("expected multiple chunks, got %d", len(chunks))
	}
	// Every chunk should be non-empty and no chunk absurdly larger than size+window.
	for i, c := range chunks {
		if len(c) == 0 {
			t.Fatalf("chunk %d empty", i)
		}
		if len([]rune(c)) > 1000+150 {
			t.Fatalf("chunk %d too large: %d runes", i, len([]rune(c)))
		}
	}
}

func TestTableToText(t *testing.T) {
	got := tableToText([]string{"name", "age"}, [][]string{{"alice", "30"}, {"bob", "25"}}, 2, 0)
	want := "Table 1 on page 2:\nname | age\nalice | 30\nbob | 25"
	if got != want {
		t.Fatalf("tableToText mismatch:\n got: %q\nwant: %q", got, want)
	}
}

func TestBuildChunksMetadataFieldNames(t *testing.T) {
	ix := New(1000, 200)
	content := extraction.StructuredContent{
		Title: "My Doc",
		Pages: []extraction.Page{
			{PageNumber: 1, PageContent: "Some page text here.", IsScanned: false,
				Tables: []extraction.Table{{Headers: []string{"h1"}, Data: [][]string{{"v1"}}}}},
			{PageNumber: 2, PageContent: "   "}, // blank → skipped
		},
	}
	chunks := ix.buildChunks(7, "my_doc.pdf", content)

	// Expect: page-1 text chunk + title chunk + page-1 table chunk = 3.
	if len(chunks) != 3 {
		t.Fatalf("expected 3 chunks, got %d", len(chunks))
	}

	// Text chunk metadata uses the correct field names.
	textMeta := chunks[0].metadata
	for _, k := range []string{"document_id", "document_name", "page_number", "chunk_index", "is_scanned"} {
		if _, ok := textMeta[k]; !ok {
			t.Errorf("text chunk metadata missing %q", k)
		}
	}
	if textMeta["document_name"] != "my_doc.pdf" {
		t.Errorf("document_name = %v", textMeta["document_name"])
	}

	// Serialize to confirm it's valid JSON (goes into message_metadata column).
	if _, err := json.Marshal(textMeta); err != nil {
		t.Fatalf("metadata not JSON-serializable: %v", err)
	}

	// Title chunk present.
	foundTitle := false
	for _, c := range chunks {
		if c.text == "Document Title: My Doc" {
			foundTitle = true
			if c.metadata["content_type"] != "metadata" {
				t.Errorf("title chunk content_type = %v", c.metadata["content_type"])
			}
		}
	}
	if !foundTitle {
		t.Error("expected a title metadata chunk")
	}

	// Table chunk present with content_type=table.
	foundTable := false
	for _, c := range chunks {
		if c.metadata["content_type"] == "table" {
			foundTable = true
			if !strings.HasPrefix(c.text, "Table 1 on page 1:") {
				t.Errorf("table chunk text unexpected: %q", c.text)
			}
		}
	}
	if !foundTable {
		t.Error("expected a table chunk")
	}
}
