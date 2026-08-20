// Package jobs manages the PostgreSQL-backed processing-job queue: enqueueing a
// job when a document is uploaded, cancelling jobs when a document is deleted,
// and the retry-backoff schedule used by the worker.
package jobs

import (
	"context"
	"fmt"
	"time"

	"github.com/legacy-document-processing-tool/backend/internal/repository"
)

// Service is the queue façade used by the API (enqueue/cancel). The worker uses
// the repository queries directly for claim/complete/fail.
type Service struct {
	queries *repository.Queries
}

// NewService builds the jobs service.
func NewService(queries *repository.Queries) *Service {
	return &Service{queries: queries}
}

// IdempotencyKey returns the per-document key ("doc:{id}") that guarantees one
// active job per document on upload.
func IdempotencyKey(documentID int32) string {
	return fmt.Sprintf("doc:%d", documentID)
}

// Enqueue inserts a pending extraction job for the document. It is idempotent:
// a second call for the same document returns the existing job rather than
// creating a duplicate (enforced by the unique idempotency_key).
func (s *Service) Enqueue(ctx context.Context, documentID int32) (repository.ProcessingJob, error) {
	return s.queries.EnqueueJob(ctx, repository.EnqueueJobParams{
		DocumentID:     documentID,
		IdempotencyKey: IdempotencyKey(documentID),
	})
}

// CancelForDocument cancels any pending/running jobs for the document, returning
// how many were cancelled. Called before deleting a document.
func (s *Service) CancelForDocument(ctx context.Context, documentID int32) (int64, error) {
	return s.queries.CancelJobsByDocumentID(ctx, documentID)
}

// backoffSchedule is the delay applied before the Nth retry (1-indexed attempt
// that just failed). Beyond the list, the last value is reused.
var backoffSchedule = []time.Duration{
	30 * time.Second,
	2 * time.Minute,
	10 * time.Minute,
}

// Backoff returns the delay before re-running a job after its Nth failed
// attempt (attempt is the value AFTER incrementing, i.e. the attempt that just
// ran: 1, 2, 3, ...). attempt <= 0 is treated as 1.
func Backoff(attempt int32) time.Duration {
	if attempt < 1 {
		attempt = 1
	}
	idx := int(attempt) - 1
	if idx >= len(backoffSchedule) {
		idx = len(backoffSchedule) - 1
	}
	return backoffSchedule[idx]
}
