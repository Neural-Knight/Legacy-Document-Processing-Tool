-- name: GetExtractionByDocumentID :one
SELECT id, document_id, content, extraction_date, status, error
FROM extractions
WHERE document_id = $1;

-- name: UpsertExtraction :one
-- Insert or replace the extraction row for a document. There is no unique
-- constraint on document_id in the base schema, so we delete any existing row
-- first (done in a tx by the caller) — this query performs the insert.
INSERT INTO extractions (document_id, content, extraction_date, status, error)
VALUES ($1, $2, now(), $3, $4)
RETURNING id, document_id, content, extraction_date, status, error;

-- name: DeleteExtractionsByDocumentID :exec
DELETE FROM extractions WHERE document_id = $1;
