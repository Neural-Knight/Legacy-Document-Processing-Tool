-- name: CreateMessage :one
INSERT INTO chat_messages (session_id, content, role, created_at, message_metadata)
VALUES ($1, $2, $3, now(), $4)
RETURNING id, session_id, content, role, created_at, message_metadata;

-- name: ListMessagesBySessionID :many
SELECT id, session_id, content, role, created_at, message_metadata
FROM chat_messages
WHERE session_id = $1
ORDER BY id;
