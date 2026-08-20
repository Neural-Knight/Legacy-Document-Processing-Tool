// Package md2sql ports backend/app/services/md2sql.py: it turns Gemini/pdfplumber
// markdown tables (## header + pipe table) into CREATE TABLE + INSERT SQL, and
// executes that SQL one statement at a time via pgx (never the whole file at
// once). It is worker-only; raw SQL execution is never exposed over HTTP.
package md2sql

import (
	"fmt"
	"regexp"
	"strings"
)

// Table is one parsed markdown table ready to become SQL.
type Table struct {
	Name      string   // full sanitized table name (<= 63 chars)
	Columns   []Column // ordered columns
	Rows      [][]string
	HasSynthID bool // true when a synthetic unique_id PK was prepended
}

// Column is a parsed column with its inferred SQL type.
type Column struct {
	Name string // sanitized (<= 59 chars)
	Type string // "NUMERIC" | "TEXT" | "INTEGER" (synthetic id)
}

var (
	sectionSplit = regexp.MustCompile(`(?m)^## `)
	headerRe     = regexp.MustCompile(`(?m)^(?:Table Name:\s*)?(.*?)(?:\n|$)`)
	htmlTagRe    = regexp.MustCompile(`<[^>]*>`)
	numericRe    = regexp.MustCompile(`^-?\d+(\.\d+)?$`)
	nonIdentRe   = regexp.MustCompile(`[^a-zA-Z0-9_]`)
	underscoreRe = regexp.MustCompile(`_+`)
	boldRe       = regexp.MustCompile(`^\*\*(.*)\*\*$`)
)

// sanitizeIdent lowercases and replaces non-alphanumerics with underscores,
// collapsing repeats and trimming — matching the Python regex behavior.
func sanitizeIdent(s string) string {
	s = nonIdentRe.ReplaceAllString(s, "_")
	s = underscoreRe.ReplaceAllString(s, "_")
	s = strings.Trim(s, "_")
	return strings.ToLower(s)
}

// MarkdownToSQL parses markdown into SQL statements. tableNamePrefix is prepended
// to every table name (e.g. "{base36ts}_p1"); the result is
// "{prefix}_{counter}_{description}" truncated to 63 chars, matching Python.
// It returns the parsed tables (for metadata) and the SQL statements
// (CREATEs first, then INSERTs, as separate statements).
func MarkdownToSQL(markdown, tableNamePrefix string) ([]Table, []string, error) {
	var tables []Table

	// Split on "## " section boundaries (Python: re.split(r'(?=^## )', ...)).
	sections := sectionSplit.Split(markdown, -1)
	counter := 0
	for _, section := range sections {
		section = strings.TrimSpace(section)
		if section == "" || !strings.Contains(section, "|") {
			continue // no table in this section
		}
		counter++
		tbl, ok := parseSection(section, tableNamePrefix, counter)
		if ok {
			tables = append(tables, tbl)
		}
	}

	var stmts []string
	for _, t := range tables {
		stmts = append(stmts, createTableSQL(t))
	}
	for _, t := range tables {
		stmts = append(stmts, insertSQL(t)...)
	}
	return tables, stmts, nil
}

func parseSection(section, prefix string, counter int) (Table, bool) {
	lines := strings.Split(section, "\n")
	if len(lines) == 0 {
		return Table{}, false
	}

	// First line is the header ("## " already stripped by the split).
	m := headerRe.FindStringSubmatch(lines[0])
	desc := "table"
	if len(m) > 1 && strings.TrimSpace(m[1]) != "" {
		desc = sanitizeIdent(m[1])
	}
	if desc == "" {
		desc = "table"
	}

	fullName := fmt.Sprintf("%s_%d_%s", prefix, counter, desc)
	if len(fullName) > 63 {
		fullName = fullName[:63]
	}

	// Find the header row (first line containing '|').
	headerIdx := -1
	for i := 1; i < len(lines); i++ {
		if strings.Contains(lines[i], "|") {
			headerIdx = i
			break
		}
	}
	if headerIdx == -1 {
		return Table{}, false
	}

	headers := splitPipeRow(lines[headerIdx])
	if len(headers) == 0 {
		return Table{}, false
	}

	// Data starts two lines after the header (skip the |---| separator).
	var rows [][]string
	for i := headerIdx + 2; i < len(lines); i++ {
		line := strings.TrimSpace(lines[i])
		if line == "" || strings.HasPrefix(line, "*") {
			continue
		}
		if !strings.Contains(line, "|") {
			continue
		}
		cells := splitPipeRow(lines[i])
		// Normalize width to the header count.
		for len(cells) < len(headers) {
			cells = append(cells, "")
		}
		if len(cells) > len(headers) {
			cells = cells[:len(headers)]
		}
		rows = append(rows, cells)
	}

	cols := make([]Column, 0, len(headers)+1)
	// Column type inference: NUMERIC if all non-empty values are numeric.
	for ci, h := range headers {
		name := sanitizeIdent(h)
		if name == "" {
			name = fmt.Sprintf("column_%d", ci)
		}
		if len(name) > 59 {
			name = name[:59]
		}
		cols = append(cols, Column{Name: name, Type: inferType(rows, ci)})
	}

	table := Table{Name: fullName, Columns: cols, Rows: rows}

	// If the first column's values aren't all unique, prepend a synthetic PK.
	if !firstColumnUnique(rows) {
		table.HasSynthID = true
		table.Columns = append([]Column{{Name: "unique_id", Type: "INTEGER"}}, table.Columns...)
	}
	return table, true
}

// splitPipeRow splits a "| a | b |" row into trimmed cells, dropping the outer
// empties, stripping HTML tags and bold markers.
func splitPipeRow(line string) []string {
	parts := strings.Split(line, "|")
	if len(parts) <= 2 {
		return nil
	}
	parts = parts[1 : len(parts)-1] // drop leading/trailing empties
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		p = htmlTagRe.ReplaceAllString(p, "")
		if m := boldRe.FindStringSubmatch(p); m != nil {
			p = strings.TrimSpace(m[1])
		}
		out = append(out, p)
	}
	return out
}

func inferType(rows [][]string, col int) string {
	hasValue := false
	for _, r := range rows {
		if col >= len(r) {
			continue
		}
		v := strings.TrimSpace(r[col])
		if v == "" {
			continue
		}
		hasValue = true
		if !numericRe.MatchString(v) {
			return "TEXT"
		}
	}
	if hasValue {
		return "NUMERIC"
	}
	return "TEXT"
}

func firstColumnUnique(rows [][]string) bool {
	seen := make(map[string]bool, len(rows))
	for _, r := range rows {
		if len(r) == 0 {
			continue
		}
		v := strings.TrimSpace(r[0])
		if v == "" {
			continue
		}
		if seen[v] {
			return false
		}
		seen[v] = true
	}
	return true
}

// createTableSQL builds the CREATE TABLE statement with quoted identifiers.
func createTableSQL(t Table) string {
	var b strings.Builder
	fmt.Fprintf(&b, "CREATE TABLE IF NOT EXISTS %s (", quoteIdent(t.Name))
	for i, c := range t.Columns {
		if i > 0 {
			b.WriteString(", ")
		}
		fmt.Fprintf(&b, "%s %s", quoteIdent(c.Name), c.Type)
		if c.Name == "unique_id" && t.HasSynthID && i == 0 {
			b.WriteString(" PRIMARY KEY")
		}
	}
	b.WriteString(")")
	return b.String()
}

// insertSQL builds one INSERT statement per row. Values are literal-escaped
// (numeric raw, empty→NULL, else single-quoted with '' escaping) — matching the
// Python generator. Identifiers are quoted.
func insertSQL(t Table) []string {
	colNames := make([]string, len(t.Columns))
	for i, c := range t.Columns {
		colNames[i] = quoteIdent(c.Name)
	}
	var stmts []string
	for ri, row := range t.Rows {
		vals := make([]string, len(t.Columns))
		dataCols := t.Columns
		offset := 0
		if t.HasSynthID {
			vals[0] = fmt.Sprintf("%d", ri+1) // synthetic id
			dataCols = t.Columns[1:]
			offset = 1
		}
		for ci, c := range dataCols {
			raw := ""
			if ci < len(row) {
				raw = strings.TrimSpace(row[ci])
			}
			vals[ci+offset] = literalValue(raw, c.Type)
		}
		stmts = append(stmts, fmt.Sprintf(
			"INSERT INTO %s (%s) VALUES (%s)",
			quoteIdent(t.Name), strings.Join(colNames, ", "), strings.Join(vals, ", "),
		))
	}
	return stmts
}

func literalValue(v, typ string) string {
	if v == "" {
		return "NULL"
	}
	if typ == "NUMERIC" || typ == "INTEGER" {
		if numericRe.MatchString(v) {
			return v
		}
	}
	return "'" + strings.ReplaceAll(v, "'", "''") + "'"
}

// quoteIdent wraps an identifier in double quotes, escaping embedded quotes —
// equivalent to pgx.Identifier{...}.Sanitize() for a single element.
func quoteIdent(s string) string {
	return `"` + strings.ReplaceAll(s, `"`, `""`) + `"`
}
