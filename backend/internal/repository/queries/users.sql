-- name: GetUserByID :one
SELECT id, email, username, hashed_password, first_name, last_name,
       is_active, is_superuser, created_at, updated_at
FROM users
WHERE id = $1;

-- name: GetUserByEmail :one
SELECT id, email, username, hashed_password, first_name, last_name,
       is_active, is_superuser, created_at, updated_at
FROM users
WHERE email = $1;

-- name: GetUserByUsername :one
SELECT id, email, username, hashed_password, first_name, last_name,
       is_active, is_superuser, created_at, updated_at
FROM users
WHERE username = $1;

-- name: CreateUser :one
INSERT INTO users (email, username, hashed_password, first_name, last_name, is_active, is_superuser)
VALUES ($1, $2, $3, $4, $5, $6, false)
RETURNING id, email, username, hashed_password, first_name, last_name,
          is_active, is_superuser, created_at, updated_at;

-- name: UpdateUser :one
UPDATE users
SET email           = $2,
    first_name      = $3,
    last_name       = $4,
    hashed_password = $5,
    updated_at      = now()
WHERE id = $1
RETURNING id, email, username, hashed_password, first_name, last_name,
          is_active, is_superuser, created_at, updated_at;
