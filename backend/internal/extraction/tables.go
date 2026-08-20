package extraction

import "strings"

// parseMarkdownTables extracts {headers, data} tables from Gemini/pdfplumber
// markdown (## header + pipe table). This drives the pages[].tables field the
// frontend uses to show the Tables tab; the raw markdown is still written to
// tables/p{N}.md for the /table-markdown endpoint and md2sql.
func parseMarkdownTables(md string) []Table {
	var tables []Table
	var cur *Table
	inTable := false

	flush := func() {
		if cur != nil && len(cur.Headers) > 0 {
			tables = append(tables, *cur)
		}
		cur = nil
		inTable = false
	}

	for _, raw := range strings.Split(md, "\n") {
		line := strings.TrimSpace(raw)
		if strings.HasPrefix(line, "## ") {
			flush()
			continue
		}
		if !strings.Contains(line, "|") {
			if inTable {
				flush()
			}
			continue
		}
		cells := splitPipe(line)
		if isSeparatorRow(cells) {
			continue // the |---|---| row
		}
		if !inTable {
			cur = &Table{Headers: cells}
			inTable = true
			continue
		}
		cur.Data = append(cur.Data, cells)
	}
	flush()
	return tables
}

func splitPipe(line string) []string {
	parts := strings.Split(line, "|")
	if len(parts) <= 2 {
		return nil
	}
	parts = parts[1 : len(parts)-1]
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		out = append(out, strings.TrimSpace(p))
	}
	return out
}

func isSeparatorRow(cells []string) bool {
	if len(cells) == 0 {
		return false
	}
	for _, c := range cells {
		c = strings.TrimSpace(c)
		if c == "" {
			continue
		}
		// A separator cell is only dashes/colons.
		if strings.Trim(c, "-:") != "" {
			return false
		}
	}
	return true
}
