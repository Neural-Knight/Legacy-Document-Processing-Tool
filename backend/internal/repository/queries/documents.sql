-- name: CreateDocument :one
INSERT INTO documents (
    filename, original_filename, file_path, file_type, file_size,
    processed, processing_error, user_id, status
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING id, filename, original_filename, file_path, file_type, file_size,
          upload_date, processed, processing_error, user_id, status;

-- name: GetDocument :one
SELECT id, filename, original_filename, file_path, file_type, file_size,
       upload_date, processed, processing_error, user_id, status
FROM documents
WHERE id = $1;

-- name: ListDocumentsByUser :many
SELECT id, filename, original_filename, file_path, file_type, file_size,
       upload_date, processed, processing_error, user_id, status
FROM documents
WHERE user_id = $1
ORDER BY id
OFFSET $2
LIMIT $3;

-- name: ListAllDocuments :many
SELECT id, filename, original_filename, file_path, file_type, file_size,
       upload_date, processed, processing_error, user_id, status
FROM documents
ORDER BY id
OFFSET $1
LIMIT $2;

-- name: DeleteDocument :execrows
DELETE FROM documents
WHERE id = $1;

-- name: UpdateDocumentStatus :one
UPDATE documents
SET status           = $2,
    processed        = $3,
    processing_error = $4
WHERE id = $1
RETURNING id, filename, original_filename, file_path, file_type, file_size,
          upload_date, processed, processing_error, user_id, status;
