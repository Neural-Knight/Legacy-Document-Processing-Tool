// Package indexer turns a document's extraction JSON into text chunks and
// writes them to vector_entries for RAG retrieval. Embeddings are not yet
// implemented; the vector column stays NULL.
package indexer

import "strings"

// Defaults are chunk_size=1000, overlap=200.
const (
	DefaultChunkSize    = 1000
	DefaultChunkOverlap = 200
)

// chunkText splits text into overlapping chunks, breaking at paragraph/sentence
// boundaries where possible.
func chunkText(text string, size, overlap int) []string {
	runes := []rune(text)
	n := len(runes)
	if n <= size {
		return []string{text}
	}

	var chunks []string
	start := 0
	for start < n {
		end := start + size
		if end >= n {
			chunks = append(chunks, string(runes[start:]))
			break
		}
		boundary := findBoundary(runes, end)
		chunks = append(chunks, string(runes[start:boundary]))
		start = boundary - overlap
		// Ensure forward progress.
		if start < 0 || start >= n-10 {
			break
		}
	}
	return chunks
}

// findBoundary finds the nearest paragraph, then sentence, then word boundary
// at/after position, scanning within a small window.
func findBoundary(runes []rune, position int) int {
	n := len(runes)

	// Paragraph break ("\n\n").
	hi := min(position+100, n-1)
	for i := hi; i >= position; i-- {
		if runes[i] == '\n' && i+1 < n && runes[i+1] == '\n' {
			return i + 2
		}
	}
	// Sentence break (". " / "! " / "? ").
	for i := hi; i >= position; i-- {
		if (runes[i] == '.' || runes[i] == '!' || runes[i] == '?') && i+1 < n && runes[i+1] == ' ' {
			return i + 2
		}
	}
	// Word break (space).
	hi2 := min(position+50, n-1)
	for i := hi2; i >= position; i-- {
		if runes[i] == ' ' {
			return i + 1
		}
	}
	return position
}

// tableToText renders a table as pipe-delimited text.
func tableToText(headers []string, data [][]string, pageNumber, tableIndex int) string {
	var parts []string
	parts = append(parts, sprintfTableHeader(tableIndex, pageNumber))
	if len(headers) > 0 {
		parts = append(parts, strings.Join(headers, " | "))
	}
	for _, row := range data {
		parts = append(parts, strings.Join(row, " | "))
	}
	return strings.Join(parts, "\n")
}

func sprintfTableHeader(tableIndex, pageNumber int) string {
	// "Table N on page P:" — table number is 1-based.
	return "Table " + itoa(tableIndex+1) + " on page " + itoa(pageNumber) + ":"
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	var b [20]byte
	i := len(b)
	for n > 0 {
		i--
		b[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		b[i] = '-'
	}
	return string(b[i:])
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
