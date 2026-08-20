package indexer

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/legacy-document-processing-tool/backend/internal/extraction"
	"github.com/legacy-document-processing-tool/backend/internal/repository"
)

// Indexer chunks extraction content and writes vector_entries.
type Indexer struct {
	chunkSize    int
	chunkOverlap int
}

// New builds an Indexer. Non-positive values fall back to the defaults.
func New(chunkSize, chunkOverlap int) *Indexer {
	if chunkSize <= 0 {
		chunkSize = DefaultChunkSize
	}
	if chunkOverlap < 0 || chunkOverlap >= chunkSize {
		chunkOverlap = DefaultChunkOverlap
	}
	return &Indexer{chunkSize: chunkSize, chunkOverlap: chunkOverlap}
}

// chunk is one text chunk plus its metadata (stored in message_metadata).
type chunk struct {
	text       string
	pageNumber *int32
	metadata   map[string]any
}

// IndexDocument re-indexes a document: it deletes existing vector_entries for
// the document (idempotent), then inserts fresh chunks derived from the
// extraction content. Non-PDF placeholder content (no pages) produces no chunks
// and is a no-op beyond the delete.
//
// Metadata is written to the message_metadata column (NOT "metadata").
func (ix *Indexer) IndexDocument(ctx context.Context, queries *repository.Queries, doc repository.Document, extractionContent []byte) error {
	var content extraction.StructuredContent
	if err := json.Unmarshal(extractionContent, &content); err != nil {
		// Non-structured (e.g. placeholder wrapper) — nothing to chunk.
		return nil
	}

	docName := ""
	if doc.Filename != nil {
		docName = *doc.Filename
	}
	chunks := ix.buildChunks(doc.ID, docName, content)

	// Idempotent re-index: clear existing chunks first.
	if err := queries.DeleteVectorEntriesByDocumentID(ctx, &doc.ID); err != nil {
		return fmt.Errorf("clear vector entries: %w", err)
	}

	docID := doc.ID
	for _, c := range chunks {
		metaJSON, err := json.Marshal(c.metadata)
		if err != nil {
			return fmt.Errorf("marshal chunk metadata: %w", err)
		}
		if _, err := queries.InsertVectorEntry(ctx, repository.InsertVectorEntryParams{
			DocumentID:      &docID,
			ChunkText:       c.text,
			MessageMetadata: metaJSON,
			PageNumber:      c.pageNumber,
		}); err != nil {
			return fmt.Errorf("insert vector entry: %w", err)
		}
	}
	return nil
}

// buildChunks produces the indexable chunks for a document: per-page text
// chunks, a title metadata chunk, and per-table chunks.
func (ix *Indexer) buildChunks(docID int32, docName string, content extraction.StructuredContent) []chunk {
	var chunks []chunk

	// Per-page text chunks.
	for _, page := range content.Pages {
		if len(trimSpace(page.PageContent)) == 0 {
			continue
		}
		pageNum := int32(page.PageNumber)
		for i, text := range chunkText(page.PageContent, ix.chunkSize, ix.chunkOverlap) {
			pn := pageNum
			chunks = append(chunks, chunk{
				text:       text,
				pageNumber: &pn,
				metadata: map[string]any{
					"document_id":   docID,
					"document_name": docName,
					"page_number":   page.PageNumber,
					"chunk_index":   i,
					"is_scanned":    page.IsScanned,
				},
			})
		}
	}

	// Title metadata chunk.
	if content.Title != "" {
		chunks = append(chunks, chunk{
			text: "Document Title: " + content.Title,
			metadata: map[string]any{
				"document_id":    docID,
				"document_name":  docName,
				"content_type":   "metadata",
				"metadata_field": "title",
			},
		})
	}

	// Per-table chunks.
	for _, page := range content.Pages {
		for i, table := range page.Tables {
			pn := int32(page.PageNumber)
			chunks = append(chunks, chunk{
				text:       tableToText(table.Headers, table.Data, page.PageNumber, i),
				pageNumber: &pn,
				metadata: map[string]any{
					"document_id":   docID,
					"document_name": docName,
					"page_number":   page.PageNumber,
					"content_type":  "table",
					"table_index":   i,
				},
			})
		}
	}

	return chunks
}

func trimSpace(s string) string {
	// local helper avoids importing strings just for TrimSpace in one spot
	start, end := 0, len(s)
	for start < end && isSpace(s[start]) {
		start++
	}
	for end > start && isSpace(s[end-1]) {
		end--
	}
	return s[start:end]
}

func isSpace(b byte) bool {
	return b == ' ' || b == '\t' || b == '\n' || b == '\r' || b == '\v' || b == '\f'
}
