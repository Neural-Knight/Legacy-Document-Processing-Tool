-- Schema snapshot used by sqlc for type generation ONLY.
-- The authoritative schema is owned by golang-migrate
-- (backend/migrations/000001_init.up.sql). Keep this file in sync with that
-- baseline migration. Do not run this file against the database directly;
-- run `migrate -path migrations -database $DATABASE_URL up` instead.

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

CREATE TABLE user_favorites (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    document_id INTEGER NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
    CONSTRAINT unique_user_document_favorite UNIQUE (user_id, document_id)
);

CREATE TABLE chat_sessions (
    id           VARCHAR PRIMARY KEY,
    user_id      INTEGER REFERENCES users (id),
    title        VARCHAR NOT NULL,
    document_ids INTEGER[],
    created_at   TIMESTAMP,
    updated_at   TIMESTAMP,
    last_message TEXT
);

CREATE TABLE chat_messages (
    id               SERIAL PRIMARY KEY,
    session_id       VARCHAR REFERENCES chat_sessions (id) ON DELETE CASCADE,
    content          TEXT NOT NULL,
    role             VARCHAR NOT NULL,
    created_at       TIMESTAMP,
    message_metadata JSON
);

CREATE TABLE extractions (
    id              SERIAL PRIMARY KEY,
    document_id     INTEGER NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
    content         JSON,
    extraction_date TIMESTAMP,
    status          VARCHAR,
    error           TEXT
);

CREATE TABLE vector_entries (
    id               SERIAL PRIMARY KEY,
    document_id      INTEGER REFERENCES documents (id) ON DELETE CASCADE,
    chunk_text       TEXT NOT NULL,
    message_metadata JSON,
    page_number      INTEGER,
    vector           TEXT,
    created_at       TIMESTAMP
);
