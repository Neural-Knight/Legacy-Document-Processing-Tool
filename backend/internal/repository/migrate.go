package repository

import (
	"errors"
	"fmt"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/pgx/v5"
	"github.com/golang-migrate/migrate/v4/source/iofs"

	"github.com/legacy-document-processing-tool/backend/migrations"
)

// Migrate applies all pending "up" migrations from the embedded migration set
// against the given database URL. It is a no-op (nil error) when the schema is
// already at the latest version.
//
// The database URL may use the "postgresql://" scheme (as the Python settings
// produced) or "postgres://"; both are normalized to the "pgx5://" driver that
// golang-migrate expects.
func Migrate(databaseURL string) error {
	src, err := iofs.New(migrations.FS, ".")
	if err != nil {
		return fmt.Errorf("load embedded migrations: %w", err)
	}

	m, err := migrate.NewWithSourceInstance("iofs", src, toPgxURL(databaseURL))
	if err != nil {
		return fmt.Errorf("init migrate: %w", err)
	}
	defer m.Close()

	if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("apply migrations: %w", err)
	}
	return nil
}

// ensure the pgx v5 database driver is registered (blank import side effect).
var _ = pgx.Postgres{}

// toPgxURL rewrites the URL scheme to pgx5:// so golang-migrate uses the pgx/v5
// driver, matching the driver the application uses at runtime.
func toPgxURL(url string) string {
	switch {
	case len(url) >= 13 && url[:13] == "postgresql://":
		return "pgx5://" + url[13:]
	case len(url) >= 11 && url[:11] == "postgres://":
		return "pgx5://" + url[11:]
	default:
		return url
	}
}
