package md2sql

import (
	"strings"
	"testing"
)

func TestSanitizeIdent(t *testing.T) {
	cases := map[string]string{
		"Sales 2024":     "sales_2024",
		"Total ($)":      "total",
		"first-name":     "first_name",
		"  Weird__Name ": "weird_name",
		"Col!!!Name":     "col_name",
	}
	for in, want := range cases {
		if got := sanitizeIdent(in); got != want {
			t.Errorf("sanitizeIdent(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestMarkdownToSQLBasic(t *testing.T) {
	md := `## Sales Report
| Region | Revenue |
|--------|---------|
| North  | 100     |
| South  | 200     |
`
	tables, stmts, err := MarkdownToSQL(md, "ts_p1")
	if err != nil {
		t.Fatalf("MarkdownToSQL: %v", err)
	}
	if len(tables) != 1 {
		t.Fatalf("expected 1 table, got %d", len(tables))
	}
	tbl := tables[0]
	if !strings.HasPrefix(tbl.Name, "ts_p1_1_sales_report") {
		t.Fatalf("unexpected table name %q", tbl.Name)
	}
	// region is unique → no synthetic id; revenue is NUMERIC.
	if tbl.HasSynthID {
		t.Error("did not expect a synthetic id (region column is unique)")
	}
	var revenue *Column
	for i := range tbl.Columns {
		if tbl.Columns[i].Name == "revenue" {
			revenue = &tbl.Columns[i]
		}
	}
	if revenue == nil || revenue.Type != "NUMERIC" {
		t.Fatalf("expected revenue NUMERIC, got %+v", revenue)
	}
	// 1 CREATE + 2 INSERTs.
	if len(stmts) != 3 {
		t.Fatalf("expected 3 statements, got %d: %v", len(stmts), stmts)
	}
	if !strings.HasPrefix(stmts[0], "CREATE TABLE") {
		t.Fatalf("first statement should be CREATE, got %q", stmts[0])
	}
}

func TestMarkdownToSQLSyntheticID(t *testing.T) {
	// Duplicate first-column values → a synthetic unique_id PK is prepended.
	md := `## Dupes
| Category | Value |
|----------|-------|
| A        | 1     |
| A        | 2     |
`
	tables, _, _ := MarkdownToSQL(md, "ts_p1")
	if len(tables) != 1 || !tables[0].HasSynthID {
		t.Fatalf("expected synthetic id for duplicate first column, got %+v", tables)
	}
	if tables[0].Columns[0].Name != "unique_id" {
		t.Fatalf("expected first column unique_id, got %q", tables[0].Columns[0].Name)
	}
}

func TestMarkdownToSQLNoTable(t *testing.T) {
	tables, stmts, _ := MarkdownToSQL("just some text, no pipes", "ts_p1")
	if len(tables) != 0 || len(stmts) != 0 {
		t.Fatalf("expected no tables, got %d tables %d stmts", len(tables), len(stmts))
	}
}

// TestMarkdownToSQLInjection ensures malicious cell content and headers cannot
// break out of the string literal / identifier quoting.
func TestMarkdownToSQLInjection(t *testing.T) {
	md := "## Users\n" +
		"| name | note |\n" +
		"|------|------|\n" +
		"| a'; DROP TABLE users;-- | x |\n" +
		"| b | '); DELETE FROM documents;-- |\n"
	_, stmts, err := MarkdownToSQL(md, "ts_p1")
	if err != nil {
		t.Fatalf("MarkdownToSQL: %v", err)
	}
	joined := strings.Join(stmts, "\n")
	// The dangerous content must be escaped inside a single-quoted literal, so
	// the doubled quote appears and no bare "DROP TABLE users;" statement forms.
	if !strings.Contains(joined, "a''; DROP TABLE users;--") {
		t.Fatalf("expected the quote to be escaped (doubled), got:\n%s", joined)
	}
	// There must be no statement that IS a DROP/DELETE (injection escaped, not executed).
	for _, s := range stmts {
		up := strings.ToUpper(strings.TrimSpace(s))
		if strings.HasPrefix(up, "DROP") || strings.HasPrefix(up, "DELETE") {
			t.Fatalf("injection produced a dangerous standalone statement: %q", s)
		}
	}
}

func TestQuoteIdent(t *testing.T) {
	if got := quoteIdent(`weird"name`); got != `"weird""name"` {
		t.Fatalf("quoteIdent escaping wrong: %q", got)
	}
}
