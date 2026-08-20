-- Phase 2: PostgreSQL-backed job queue. This replaces Python's unsafe
-- asyncio.create_task(db_session) background extraction with a durable queue
-- claimed by a dedicated worker via FOR UPDATE SKIP LOCKED.

BEGIN;

CREATE TABLE processing_jobs (
    id              BIGSERIAL PRIMARY KEY,
    document_id     INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
        -- pending | running | completed | failed | cancelled
    stage           VARCHAR(50) NOT NULL DEFAULT 'extract',
    attempt         INTEGER NOT NULL DEFAULT 0,
    max_attempts    INTEGER NOT NULL DEFAULT 3,
    error           TEXT,
    idempotency_key VARCHAR(64) NOT NULL UNIQUE,
    locked_at       TIMESTAMPTZ,
    locked_by       VARCHAR(100),
    run_after       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial index supporting the claim query (pending, due, oldest first).
CREATE INDEX idx_jobs_claim ON processing_jobs(status, run_after, created_at)
    WHERE status = 'pending';

CREATE INDEX idx_jobs_document_id ON processing_jobs(document_id);

COMMIT;
