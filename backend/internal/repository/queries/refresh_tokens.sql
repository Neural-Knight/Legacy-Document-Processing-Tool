-- name: CreateRefreshToken :one
INSERT INTO refresh_tokens (token, expires_at, user_id, user_agent, ip_address, revoked)
VALUES ($1, $2, $3, $4, $5, false)
RETURNING id, token, expires_at, revoked, user_id, user_agent, ip_address, created_at;

-- name: GetValidRefreshToken :one
SELECT id, token, expires_at, revoked, user_id, user_agent, ip_address, created_at
FROM refresh_tokens
WHERE token = $1
  AND revoked = false
  AND expires_at > now();

-- name: RevokeRefreshToken :execrows
UPDATE refresh_tokens
SET revoked = true
WHERE token = $1;

-- name: RevokeAllUserRefreshTokens :execrows
UPDATE refresh_tokens
SET revoked = true
WHERE user_id = $1
  AND revoked = false;
