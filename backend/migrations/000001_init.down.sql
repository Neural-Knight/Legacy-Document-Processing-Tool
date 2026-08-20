-- Reverse of 000001_init.up.sql. Dropped in FK-dependency order (children
-- before parents). CASCADE would also work, but explicit ordering keeps the
-- intent clear.

BEGIN;

DROP TABLE IF EXISTS vector_entries;
DROP TABLE IF EXISTS extractions;
DROP TABLE IF EXISTS chat_messages;
DROP TABLE IF EXISTS chat_sessions;
DROP TABLE IF EXISTS user_favorites;
DROP TABLE IF EXISTS documents;
DROP TABLE IF EXISTS refresh_tokens;
DROP TABLE IF EXISTS users;

COMMIT;
