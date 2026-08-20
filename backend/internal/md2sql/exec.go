package md2sql

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/legacy-document-processing-tool/backend/internal/repository"
)

var pageFileRe = regexp.MustCompile(`^p(\d+)\.md$`)

// ProcessDirectory reads every tables/p{N}.md file in tablesDir, converts each
// to SQL, executes the statements one at a time against the pool, and records
// each created table in tables_metadata. tablePrefix is the base36-timestamp
// prefix; we normalize trailing underscores.
//
// A per-file parse/exec error is logged via the returned error slice but does
// not abort the whole directory (best-effort).
// Returns the CreateDB.sql text that was executed (for on-disk parity) and any
// non-fatal errors.
func ProcessDirectory(ctx context.Context, pool *pgxpool.Pool, queries *repository.Queries, tablesDir, tablePrefix string, documentID int32) (string, []error) {
	entries, err := os.ReadDir(tablesDir)
	if err != nil {
		return "", []error{fmt.Errorf("read tables dir: %w", err)}
	}

	// Deterministic order by page number.
	type mdFile struct {
		name string
		page int32
	}
	var files []mdFile
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		m := pageFileRe.FindStringSubmatch(e.Name())
		if m == nil {
			continue
		}
		var pg int
		fmt.Sscanf(m[1], "%d", &pg)
		files = append(files, mdFile{name: e.Name(), page: int32(pg)})
	}
	sort.Slice(files, func(i, j int) bool { return files[i].page < files[j].page })

	prefix := strings.TrimRight(tablePrefix, "_")
	var allSQL strings.Builder
	var errs []error

	for _, f := range files {
		raw, err := os.ReadFile(filepath.Join(tablesDir, f.name))
		if err != nil {
			errs = append(errs, fmt.Errorf("%s: %w", f.name, err))
			continue
		}
		// Per-file prefix: "{ts}_p{N}" (filename without extension is "p{N}").
		filePrefix := fmt.Sprintf("%s_%s", prefix, strings.TrimSuffix(f.name, ".md"))
		tables, stmts, err := MarkdownToSQL(string(raw), filePrefix)
		if err != nil {
			errs = append(errs, fmt.Errorf("%s: parse: %w", f.name, err))
			continue
		}

		for _, s := range stmts {
			allSQL.WriteString(s)
			allSQL.WriteString(";\n")
		}

		if err := executeStatements(ctx, pool, stmts); err != nil {
			errs = append(errs, fmt.Errorf("%s: exec: %w", f.name, err))
			continue
		}

		// Record metadata for each created table.
		if queries != nil {
			active := "active"
			docID := documentID
			page := f.page
			for _, t := range tables {
				name := t.Name
				if err := queries.UpsertTableMetadata(ctx, repository.UpsertTableMetadataParams{
					TableID:    &t.Name,
					TableName:  &name,
					DocumentID: &docID,
					PageNumber: &page,
					Status:     &active,
				}); err != nil {
					errs = append(errs, fmt.Errorf("%s: metadata: %w", t.Name, err))
				}
			}
		}
	}
	return allSQL.String(), errs
}

// executeStatements runs each statement individually inside a transaction so a
// single bad row doesn't leave a half-loaded table. Statements are executed
// individually, never as a whole-file blob.
func executeStatements(ctx context.Context, pool *pgxpool.Pool, stmts []string) error {
	if len(stmts) == 0 {
		return nil
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck // rolled back if not committed

	for _, s := range stmts {
		if strings.TrimSpace(s) == "" {
			continue
		}
		if _, err := tx.Exec(ctx, s); err != nil {
			return fmt.Errorf("statement failed: %w", err)
		}
	}
	return tx.Commit(ctx)
}
