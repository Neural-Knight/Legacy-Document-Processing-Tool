// Command migrate applies all pending database migrations, then exits 0 on
// success. It is used as the docker-compose "migrate" step and can also be run
// locally. The database URL comes from DATABASE_URL, or is assembled from the
// POSTGRES_* env vars (same resolution as the API server).
package main

import (
	"log/slog"
	"os"

	"github.com/legacy-document-processing-tool/backend/internal/config"
	"github.com/legacy-document-processing-tool/backend/internal/repository"
)

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))

	cfg, err := config.LoadForMigrate()
	if err != nil {
		log.Error("configuration error", slog.Any("error", err))
		os.Exit(1)
	}

	log.Info("applying migrations")
	if err := repository.Migrate(cfg.DatabaseURL); err != nil {
		log.Error("migration failed", slog.Any("error", err))
		os.Exit(1)
	}
	log.Info("migrations applied successfully")
}
