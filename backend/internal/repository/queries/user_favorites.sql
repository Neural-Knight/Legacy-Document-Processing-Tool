-- name: ListFavoriteDocuments :many
SELECT d.id, d.filename, d.original_filename, d.file_path, d.file_type, d.file_size,
       d.upload_date, d.processed, d.processing_error, d.user_id, d.status
FROM documents d
JOIN user_favorites uf ON uf.document_id = d.id
WHERE uf.user_id = $1
ORDER BY d.id;

-- name: FavoriteExists :one
SELECT EXISTS (
    SELECT 1 FROM user_favorites
    WHERE user_id = $1 AND document_id = $2
);

-- name: AddFavorite :exec
INSERT INTO user_favorites (user_id, document_id)
VALUES ($1, $2)
ON CONFLICT ON CONSTRAINT unique_user_document_favorite DO NOTHING;

-- name: RemoveFavorite :execrows
DELETE FROM user_favorites
WHERE user_id = $1 AND document_id = $2;
