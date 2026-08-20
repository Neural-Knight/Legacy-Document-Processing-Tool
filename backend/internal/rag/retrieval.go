// Package rag ports the Python rag_service.py: keyword retrieval over
// vector_entries plus response generation. Phase 4 uses a real Gemini LLM when
// GEMINI_KEYS is set, falling back to the Python-style template otherwise.
// Vector similarity search is deferred to Phase 6 (pgvector).
package rag

import (
	"sort"
	"strings"

	"github.com/legacy-document-processing-tool/backend/internal/repository"
)

// topN is the number of chunks returned by retrieval (matches Python's 5).
const topN = 5

// scoreChunk counts how many query terms appear in the chunk text (case-
// insensitive substring match), matching the Python _retrieve_relevant_chunks
// scoring.
func scoreChunk(chunkText string, queryTerms []string) int {
	text := strings.ToLower(chunkText)
	score := 0
	for _, term := range queryTerms {
		if term != "" && strings.Contains(text, term) {
			score++
		}
	}
	return score
}

// retrieveRelevant scores all candidate chunks by keyword overlap and returns
// the top-N with score > 0, highest first. Ports the Python scoring + sort +
// top-5 slice. Stable sort keeps insertion order among equal scores.
func retrieveRelevant(query string, chunks []repository.VectorEntry) []repository.VectorEntry {
	terms := strings.Fields(strings.ToLower(query))

	type scored struct {
		entry repository.VectorEntry
		score int
		idx   int
	}
	var scoredChunks []scored
	for i, c := range chunks {
		s := scoreChunk(c.ChunkText, terms)
		if s > 0 {
			scoredChunks = append(scoredChunks, scored{entry: c, score: s, idx: i})
		}
	}

	sort.SliceStable(scoredChunks, func(a, b int) bool {
		if scoredChunks[a].score != scoredChunks[b].score {
			return scoredChunks[a].score > scoredChunks[b].score
		}
		return scoredChunks[a].idx < scoredChunks[b].idx
	})

	limit := topN
	if len(scoredChunks) < limit {
		limit = len(scoredChunks)
	}
	out := make([]repository.VectorEntry, 0, limit)
	for i := 0; i < limit; i++ {
		out = append(out, scoredChunks[i].entry)
	}
	return out
}
