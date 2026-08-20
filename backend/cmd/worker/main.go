// Command worker runs the document-processing worker: it polls the
// processing_jobs queue and runs the extraction processor with bounded
// concurrency. It assumes the schema already exists (docker-compose runs the
// migrate service first); it does not migrate.
package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/legacy-document-processing-tool/backend/internal/config"
	"github.com/legacy-document-processing-tool/backend/internal/extraction"
	"github.com/legacy-document-processing-tool/backend/internal/repository"
	"github.com/legacy-document-processing-tool/backend/internal/worker"
)

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(log)

	if err := run(log); err != nil {
		log.Error("worker exited with error", slog.Any("error", err))
		os.Exit(1)
	}
}

func run(log *slog.Logger) error {
	cfg, err := config.LoadForWorker()
	if err != nil {
		return err
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	queries := repository.New(pool)

	// Build the Phase 3 extraction pipeline. The PDF text engine (poppler) is
	// used when the binaries are present; Gemini table extraction and OCR are
	// optional and degrade gracefully when unconfigured/unavailable.
	var pdfExtractor extraction.Extractor
	if extraction.PopplerAvailable() {
		deps := extraction.Deps{
			PDF:    extraction.NewPopplerEngine(),
			Tables: extraction.NewGeminiClient(),
			OCR:    extraction.NewTesseractOCR(cfg.OCRLanguage),
			Log:    log,
		}
		extractionsRoot := filepath.Join(cfg.LocalStoragePath, "extractions")
		pdfExtractor = extraction.NewPDFExtractor(deps, extractionsRoot, cfg.MaxPageWorkers)
		log.Info("PDF extraction enabled (poppler)",
			slog.Bool("gemini_tables", deps.Tables.Enabled()),
			slog.Bool("ocr", deps.OCR.Available()),
		)
	} else {
		log.Warn("poppler not found; PDFs will use placeholder extraction (install poppler-utils)")
	}

	processor := worker.NewRealProcessor(queries, pool, pdfExtractor, cfg.LocalStoragePath, log)

	runner := worker.NewRunner(queries, processor, log, worker.Options{
		WorkerID:      cfg.WorkerID,
		MaxConcurrent: cfg.MaxConcurrentJobs,
		PollInterval:  time.Duration(cfg.JobPollIntervalMS) * time.Millisecond,
		LockTimeout:   time.Duration(cfg.JobLockTimeoutMinutes) * time.Minute,
	})

	runner.Run(ctx) // blocks until ctx is cancelled, then drains
	log.Info("worker stopped")
	return nil
}
