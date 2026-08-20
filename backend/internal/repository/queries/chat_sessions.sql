-- name: CreateSession :one
INSERT INTO chat_sessions (id, user_id, title, document_ids, created_at, updated_at)
VALUES ($1, $2, $3, $4, now(), now())
RETURNING id, user_id, title, document_ids, created_at, updated_at, last_message;

-- name: GetSessionByID :one
SELECT id, user_id, title, document_ids, created_at, updated_at, last_message
FROM chat_sessions
WHERE id = $1;

-- name: GetSessionByIDForUser :one
SELECT id, user_id, title, document_ids, created_at, updated_at, last_message
FROM chat_sessions
WHERE id = $1 AND user_id = $2;

-- name: ListSessionsByUser :many
SELECT id, user_id, title, document_ids, created_at, updated_at, last_message
FROM chat_sessions
WHERE user_id = $1
ORDER BY updated_at DESC NULLS LAST, created_at DESC;

-- name: UpdateSessionLastMessage :exec
UPDATE chat_sessions
SET last_message = $2,
    updated_at   = now()
WHERE id = $1;

-- name: DeleteSession :execrows
DELETE FROM chat_sessions
WHERE id = $1 AND user_id = $2;
