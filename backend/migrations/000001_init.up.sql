-- Baseline schema for the Go backend, managed by golang-migrate.
--
-- This consolidates the full Alembic head from the archive/python branch
-- (revisions a4325417313d → 3433b6c11700 → 47abacc1105d → a694cc315a17
--  → 1fa2cc95c28e → 20e0b9db090c) into a single migration applied to an
-- empty database. Table shapes, indexes, and foreign keys match that head;
-- see ../MIGRATION.md for the (minor) DDL differences noted vs Alembic.

BEGIN;

-- ---------------------------------------------------------------------------
-- users  (Alembic 3433b6c11700)
-- ---------------------------------------------------------------------------
CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    email           VARCHAR NOT NULL,
    username        VARCHAR NOT NULL,
    hashed_password VARCHAR NOT NULL,
    first_name      VARCHAR,
    last_name       VARCHAR,
    is_active       BOOLEAN,
    is_superuser    BOOLEAN,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ
);
CREATE UNIQUE INDEX ix_users_email ON users (email);
CREATE INDEX ix_users_id ON users (id);
CREATE UNIQUE INDEX ix_users_username ON users (username);

-- ---------------------------------------------------------------------------
-- refresh_tokens  (Alembic 3433b6c11700)
-- ---------------------------------------------------------------------------
CREATE TABLE refresh_tokens (
    id         SERIAL PRIMARY KEY,
    token      VARCHAR NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked    BOOLEAN,
    user_id    INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    user_agent VARCHAR,
    ip_address VARCHAR,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ix_refresh_tokens_id ON refresh_tokens (id);
CREATE UNIQUE INDEX ix_refresh_tokens_token ON refresh_tokens (token);

-- ---------------------------------------------------------------------------
-- documents  (Alembic 47abacc1105d + 20e0b9db090c)
--   20e0b9db090c added `status` and changed file_size INTEGER -> VARCHAR(100).
-- ---------------------------------------------------------------------------
CREATE TABLE documents (
    id                SERIAL PRIMARY KEY,
    filename          VARCHAR(255),
    original_filename VARCHAR(255),
    file_path         VARCHAR(512),
    file_type         VARCHAR(100),
    file_size         VARCHAR(100),
    upload_date       TIMESTAMPTZ DEFAULT now(),
    processed         BOOLEAN DEFAULT false,
    processing_error  TEXT,
    user_id           INTEGER REFERENCES users (id),
    status            VARCHAR(50)
);
CREATE INDEX ix_documents_id ON documents (id);
CREATE INDEX ix_documents_filename ON documents (filename);
CREATE UNIQUE INDEX ix_documents_file_path ON documents (file_path);
CREATE INDEX idx_document_filename_processed ON documents (filename, processed);

-- ---------------------------------------------------------------------------
-- user_favorites  (Alembic a694cc315a17)
-- ---------------------------------------------------------------------------
CREATE TABLE user_favorites (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    document_id INTEGER NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
    CONSTRAINT unique_user_document_favorite UNIQUE (user_id, document_id)
);
CREATE INDEX ix_user_favorites_id ON user_favorites (id);

-- ---------------------------------------------------------------------------
-- chat_sessions  (Alembic 1fa2cc95c28e)
-- ---------------------------------------------------------------------------
CREATE TABLE chat_sessions (
    id           VARCHAR PRIMARY KEY,
    user_id      INTEGER REFERENCES users (id),
    title        VARCHAR NOT NULL,
    document_ids INTEGER[],
    created_at   TIMESTAMP,
    updated_at   TIMESTAMP,
    last_message TEXT
);

-- ---------------------------------------------------------------------------
-- chat_messages  (Alembic 1fa2cc95c28e)
-- ---------------------------------------------------------------------------
CREATE TABLE chat_messages (
    id               SERIAL PRIMARY KEY,
    session_id       VARCHAR REFERENCES chat_sessions (id) ON DELETE CASCADE,
    content          TEXT NOT NULL,
    role             VARCHAR NOT NULL,
    created_at       TIMESTAMP,
    message_metadata JSON
);
CREATE INDEX ix_chat_messages_id ON chat_messages (id);

-- ---------------------------------------------------------------------------
-- extractions  (Alembic 1fa2cc95c28e)
-- ---------------------------------------------------------------------------
CREATE TABLE extractions (
    id              SERIAL PRIMARY KEY,
    document_id     INTEGER NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
    content         JSON,
    extraction_date TIMESTAMP,
    status          VARCHAR,
    error           TEXT
);
CREATE INDEX ix_extractions_id ON extractions (id);

-- ---------------------------------------------------------------------------
-- vector_entries  (Alembic 1fa2cc95c28e)
-- ---------------------------------------------------------------------------
CREATE TABLE vector_entries (
    id               SERIAL PRIMARY KEY,
    document_id      INTEGER REFERENCES documents (id) ON DELETE CASCADE,
    chunk_text       TEXT NOT NULL,
    message_metadata JSON,
    page_number      INTEGER,
    vector           TEXT,
    created_at       TIMESTAMP
);
CREATE INDEX ix_vector_entries_id ON vector_entries (id);

COMMIT;
