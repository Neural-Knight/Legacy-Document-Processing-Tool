// Command api starts the HTTP server for the Legacy Document Processing Tool
// Go backend (Phase 0: health + auth).
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/legacy-document-processing-tool/backend/internal/api"
	"github.com/legacy-document-processing-tool/backend/internal/config"
)

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(log)

	if err := run(log); err != nil {
		log.Error("server exited with error", slog.Any("error", err))
		os.Exit(1)
	}
}

func run(log *slog.Logger) error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}

	// pgxpool with limits from the plan (§11.2): MaxConns=25, MinConns=5,
	// MaxConnLifetime=1h, HealthCheckPeriod=30s.
	poolCfg, err := pgxpool.ParseConfig(normalizeDSN(cfg.DatabaseURL))
	if err != nil {
		return err
	}
	poolCfg.MaxConns = 25
	poolCfg.MinConns = 5
	poolCfg.MaxConnLifetime = time.Hour
	poolCfg.HealthCheckPeriod = 30 * time.Second

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	pool, err := pgxpool.NewWithConfig(ctx, poolCfg)
	if err != nil {
		return err
	}
	defer pool.Close()

	router, err := api.NewRouter(cfg, pool, log)
	if err != nil {
		return err
	}

	srv := &http.Server{
		Addr:              cfg.Host + ":" + cfg.Port,
		Handler:           router,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	serverErr := make(chan error, 1)
	go func() {
		log.Info("starting server",
			slog.String("addr", srv.Addr),
			slog.String("project", cfg.ProjectName),
		)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErr <- err
		}
	}()

	select {
	case err := <-serverErr:
		return err
	case <-ctx.Done():
		log.Info("shutdown signal received, draining connections")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		return srv.Shutdown(shutdownCtx)
	}
}

// normalizeDSN accepts both the SQLAlchemy-style "postgresql://" scheme used by
// the Python settings and the "postgres://" scheme; pgx understands both, so we
// pass it through unchanged.
func normalizeDSN(dsn string) string {
	return dsn
}
