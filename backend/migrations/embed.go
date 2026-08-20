// Package migrations embeds the SQL migration files so they travel inside the
// compiled binary — the migrate command and tests can apply them without the
// files being present on disk at runtime.
package migrations

import "embed"

// FS holds the *.up.sql / *.down.sql migration files.
//
//go:embed *.sql
var FS embed.FS
