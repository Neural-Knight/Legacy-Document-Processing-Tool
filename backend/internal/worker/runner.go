package worker

import (
	"context"
	"errors"
	"log/slog"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/legacy-document-processing-tool/backend/internal/jobs"
	"github.com/legacy-document-processing-tool/backend/internal/repository"
)

// Runner polls the job queue and dispatches claimed jobs to the Processor with
// bounded concurrency. It runs in-process — no Redis, no external queue.
type Runner struct {
	queries       *repository.Queries
	processor     Processor
	log           *slog.Logger
	workerID      string
	maxConcurrent int
	pollInterval  time.Duration
	lockTimeout   time.Duration
}

// Options configures a Runner.
type Options struct {
	WorkerID      string
	MaxConcurrent int
	PollInterval  time.Duration
	LockTimeout   time.Duration
}

// NewRunner builds a worker runner.
func NewRunner(queries *repository.Queries, processor Processor, log *slog.Logger, opts Options) *Runner {
	if opts.MaxConcurrent < 1 {
		opts.MaxConcurrent = 1
	}
	if opts.PollInterval <= 0 {
		opts.PollInterval = time.Second
	}
	if opts.LockTimeout <= 0 {
		opts.LockTimeout = 30 * time.Minute
	}
	if opts.WorkerID == "" {
		opts.WorkerID = "worker"
	}
	return &Runner{
		queries:       queries,
		processor:     processor,
		log:           log,
		workerID:      opts.WorkerID,
		maxConcurrent: opts.MaxConcurrent,
		pollInterval:  opts.PollInterval,
		lockTimeout:   opts.LockTimeout,
	}
}

// Run polls until ctx is cancelled, then drains in-flight jobs before
// returning. Concurrency is bounded by a semaphore of size maxConcurrent.
func (r *Runner) Run(ctx context.Context) {
	sem := make(chan struct{}, r.maxConcurrent)
	var wg sync.WaitGroup

	ticker := time.NewTicker(r.pollInterval)
	defer ticker.Stop()

	// Periodically reclaim jobs abandoned by dead workers.
	reclaimTicker := time.NewTicker(r.lockTimeout / 2)
	defer reclaimTicker.Stop()

	r.log.Info("worker started",
		slog.String("worker_id", r.workerID),
		slog.Int("max_concurrent", r.maxConcurrent),
		slog.Duration("poll_interval", r.pollInterval),
	)

	for {
		select {
		case <-ctx.Done():
			r.log.Info("worker shutting down, draining in-flight jobs")
			wg.Wait()
			return

		case <-reclaimTicker.C:
			r.reclaimStale(ctx)

		case <-ticker.C:
			// Claim as many jobs as we have free slots for this tick.
			for {
				select {
				case sem <- struct{}{}:
				default:
					// No free slot; stop claiming this tick.
					goto doneClaiming
				}

				job, ok := r.claim(ctx)
				if !ok {
					<-sem // release the reserved slot; nothing to do
					goto doneClaiming
				}

				wg.Add(1)
				go func(j repository.ProcessingJob) {
					defer wg.Done()
					defer func() { <-sem }()
					r.handle(ctx, j)
				}(job)
			}
		doneClaiming:
		}
	}
}

// claim attempts to claim the next due job. Returns ok=false when the queue is
// empty or on a transient error.
func (r *Runner) claim(ctx context.Context) (repository.ProcessingJob, bool) {
	workerID := r.workerID
	job, err := r.queries.ClaimNextJob(ctx, &workerID)
	if err != nil {
		if !errors.Is(err, pgx.ErrNoRows) {
			r.log.Error("claim job failed", slog.Any("error", err))
		}
		return repository.ProcessingJob{}, false
	}
	return job, true
}

// handle runs the processor for a claimed job and records the outcome.
func (r *Runner) handle(ctx context.Context, job repository.ProcessingJob) {
	start := time.Now()
	log := r.log.With(
		slog.Int64("job_id", job.ID),
		slog.Int("document_id", int(job.DocumentID)),
		slog.String("stage", job.Stage),
		slog.Int("attempt", int(job.Attempt)),
	)

	doc, err := r.queries.GetDocument(ctx, job.DocumentID)
	if err != nil {
		// Document gone (e.g. deleted) — nothing to process; complete the job so
		// it isn't retried. The cascade may also have removed the job already.
		log.Warn("document not found for job; completing", slog.Any("error", err))
		_ = r.queries.CompleteJob(ctx, job.ID)
		return
	}

	err = r.processor.Process(ctx, job, doc)
	if err != nil {
		r.recordFailure(ctx, log, job, doc, err)
		return
	}

	if cerr := r.queries.CompleteJob(ctx, job.ID); cerr != nil {
		log.Error("complete job failed", slog.Any("error", cerr))
		return
	}
	log.Info("job completed", slog.Duration("duration", time.Since(start)))
}

// recordFailure either retries the job (with backoff) or marks it terminally
// failed and sets the document to error status.
func (r *Runner) recordFailure(ctx context.Context, log *slog.Logger, job repository.ProcessingJob, doc repository.Document, procErr error) {
	msg := procErr.Error()

	if job.Attempt < job.MaxAttempts {
		delay := jobs.Backoff(job.Attempt)
		runAfter := pgtype.Timestamptz{Time: time.Now().Add(delay), Valid: true}
		if err := r.queries.RetryJob(ctx, repository.RetryJobParams{
			ID:       job.ID,
			Error:    &msg,
			RunAfter: runAfter,
		}); err != nil {
			log.Error("retry job failed", slog.Any("error", err))
			return
		}
		log.Warn("job failed; scheduled retry",
			slog.String("error", msg),
			slog.Duration("retry_in", delay),
		)
		return
	}

	// Terminal failure: mark job failed and document errored.
	if err := r.queries.FailJob(ctx, repository.FailJobParams{ID: job.ID, Error: &msg}); err != nil {
		log.Error("fail job failed", slog.Any("error", err))
	}
	errStatus := "error"
	processed := false
	if _, err := r.queries.UpdateDocumentStatus(ctx, repository.UpdateDocumentStatusParams{
		ID:              doc.ID,
		Status:          &errStatus,
		Processed:       &processed,
		ProcessingError: &msg,
	}); err != nil {
		log.Error("set document error failed", slog.Any("error", err))
	}
	log.Error("job failed permanently", slog.String("error", msg))
}

// reclaimStale resets jobs whose lock is older than the visibility timeout.
func (r *Runner) reclaimStale(ctx context.Context) {
	cutoff := pgtype.Timestamptz{Time: time.Now().Add(-r.lockTimeout), Valid: true}
	n, err := r.queries.ReclaimStaleJobs(ctx, cutoff)
	if err != nil {
		r.log.Error("reclaim stale jobs failed", slog.Any("error", err))
		return
	}
	if n > 0 {
		r.log.Info("reclaimed stale jobs", slog.Int64("count", n))
	}
}
