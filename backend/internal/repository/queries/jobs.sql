-- name: EnqueueJob :one
-- Insert a pending job for a document. The idempotency_key ("doc:{id}") makes
-- re-enqueue a no-op: on conflict we return the existing row instead of a dup.
INSERT INTO processing_jobs (document_id, idempotency_key, status, stage)
VALUES ($1, $2, 'pending', 'extract')
ON CONFLICT (idempotency_key) DO UPDATE SET updated_at = processing_jobs.updated_at
RETURNING id, document_id, status, stage, attempt, max_attempts, error,
          idempotency_key, locked_at, locked_by, run_after, created_at, updated_at;

-- name: ClaimNextJob :one
-- Atomically claim the oldest due pending job for this worker.
UPDATE processing_jobs
SET status     = 'running',
    locked_at  = now(),
    locked_by  = $1,
    attempt    = attempt + 1,
    updated_at = now()
WHERE id = (
    SELECT id FROM processing_jobs
    WHERE status = 'pending' AND run_after <= now()
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
    LIMIT 1
)
RETURNING id, document_id, status, stage, attempt, max_attempts, error,
          idempotency_key, locked_at, locked_by, run_after, created_at, updated_at;

-- name: CompleteJob :exec
UPDATE processing_jobs
SET status     = 'completed',
    locked_at  = NULL,
    locked_by  = NULL,
    error      = NULL,
    updated_at = now()
WHERE id = $1;

-- name: RetryJob :exec
-- Return a failed attempt to the queue with a delayed run_after (backoff).
UPDATE processing_jobs
SET status     = 'pending',
    locked_at  = NULL,
    locked_by  = NULL,
    error      = $2,
    run_after  = $3,
    updated_at = now()
WHERE id = $1;

-- name: FailJob :exec
-- Terminal failure (no attempts remaining).
UPDATE processing_jobs
SET status     = 'failed',
    locked_at  = NULL,
    locked_by  = NULL,
    error      = $2,
    updated_at = now()
WHERE id = $1;

-- name: CancelJobsByDocumentID :execrows
UPDATE processing_jobs
SET status     = 'cancelled',
    locked_at  = NULL,
    locked_by  = NULL,
    updated_at = now()
WHERE document_id = $1 AND status IN ('pending', 'running');

-- name: GetJobByDocumentID :one
SELECT id, document_id, status, stage, attempt, max_attempts, error,
       idempotency_key, locked_at, locked_by, run_after, created_at, updated_at
FROM processing_jobs
WHERE document_id = $1
ORDER BY created_at DESC
LIMIT 1;

-- name: ReclaimStaleJobs :execrows
-- Reset jobs whose worker died (locked_at older than the visibility timeout)
-- back to pending so another worker can claim them.
UPDATE processing_jobs
SET status     = 'pending',
    locked_at  = NULL,
    locked_by  = NULL,
    updated_at = now()
WHERE status = 'running' AND locked_at < $1;
