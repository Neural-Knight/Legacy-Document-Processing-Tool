-- name: DeleteVectorEntriesByDocumentID :exec
DELETE FROM vector_entries WHERE document_id = $1;

-- name: InsertVectorEntry :one
INSERT INTO vector_entries (document_id, chunk_text, message_metadata, page_number, vector, created_at)
VALUES ($1, $2, $3, $4, NULL, now())
RETURNING id, document_id, chunk_text, message_metadata, page_number, vector, created_at;

-- name: ListVectorEntries :many
-- All chunks (used when no document filter is supplied).
SELECT id, document_id, chunk_text, message_metadata, page_number, vector, created_at
FROM vector_entries
ORDER BY id;

-- name: ListVectorEntriesByDocumentIDs :many
-- Chunks restricted to the given document ids (RAG retrieval with a filter).
SELECT id, document_id, chunk_text, message_metadata, page_number, vector, created_at
FROM vector_entries
WHERE document_id = ANY(sqlc.arg(document_ids)::int[])
ORDER BY id;

-- name: CountVectorEntriesByDocumentID :one
SELECT COUNT(*) FROM vector_entries WHERE document_id = $1;
