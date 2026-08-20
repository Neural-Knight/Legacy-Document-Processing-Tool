package rag

import (
	"testing"

	"github.com/legacy-document-processing-tool/backend/internal/repository"
)

func ve(id int32, text string) repository.VectorEntry {
	return repository.VectorEntry{ID: id, ChunkText: text}
}

func TestScoreChunk(t *testing.T) {
	terms := []string{"invoice", "total"}
	if s := scoreChunk("The invoice total is due", terms); s != 2 {
		t.Fatalf("expected score 2, got %d", s)
	}
	if s := scoreChunk("unrelated text", terms); s != 0 {
		t.Fatalf("expected score 0, got %d", s)
	}
	// Case-insensitive.
	if s := scoreChunk("INVOICE", []string{"invoice"}); s != 1 {
		t.Fatalf("expected case-insensitive match, got %d", s)
	}
}

func TestRetrieveRelevantRanksAndLimits(t *testing.T) {
	chunks := []repository.VectorEntry{
		ve(1, "apple banana cherry"),   // matches 3
		ve(2, "apple"),                 // matches 1
		ve(3, "nothing here"),          // matches 0 → excluded
		ve(4, "apple banana"),          // matches 2
		ve(5, "banana cherry apple x"), // matches 3
		ve(6, "cherry"),                // matches 1
		ve(7, "apple banana cherry z"), // matches 3
	}
	got := retrieveRelevant("apple banana cherry", chunks)

	// Excludes the zero-score chunk, caps at 5.
	if len(got) != 5 {
		t.Fatalf("expected 5 results, got %d", len(got))
	}
	for _, g := range got {
		if g.ID == 3 {
			t.Fatal("zero-score chunk should be excluded")
		}
	}
	// Highest score first; among equal scores, insertion order (stable).
	if got[0].ID != 1 || got[1].ID != 5 || got[2].ID != 7 {
		t.Fatalf("unexpected top-3 order: %d,%d,%d", got[0].ID, got[1].ID, got[2].ID)
	}
}

func TestRetrieveRelevantEmpty(t *testing.T) {
	if got := retrieveRelevant("query", nil); len(got) != 0 {
		t.Fatalf("expected no results, got %d", len(got))
	}
}

func TestTemplateResponseNoChunks(t *testing.T) {
	svc := NewService(nil, nil)
	got := svc.generate(nil, "anything", nil)
	if got == "" || !contains(got, "couldn't find") {
		t.Fatalf("expected no-info template, got %q", got)
	}
}

func contains(s, sub string) bool {
	return len(s) >= len(sub) && (indexOf(s, sub) >= 0)
}
func indexOf(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}
