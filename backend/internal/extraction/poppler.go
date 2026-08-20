package extraction

import (
	"bytes"
	"context"
	"fmt"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
)

// PopplerEngine is a PDFTextEngine backed by the poppler CLI tools
// (pdftotext, pdfinfo, pdftoppm). It requires no CGO and is portable across
// platforms where poppler is installed. This replaces the Python PyMuPDF/fitz
// usage for the text path; see MIGRATION.md for the rationale.
type PopplerEngine struct{}

// NewPopplerEngine returns a poppler-backed engine.
func NewPopplerEngine() *PopplerEngine { return &PopplerEngine{} }

// PopplerAvailable reports whether the required poppler binaries are on PATH.
func PopplerAvailable() bool {
	for _, bin := range []string{"pdftotext", "pdfinfo"} {
		if _, err := exec.LookPath(bin); err != nil {
			return false
		}
	}
	return true
}

// PageCount uses pdfinfo to read the page count.
func (e *PopplerEngine) PageCount(ctx context.Context, path string) (int, error) {
	out, err := runCmd(ctx, "pdfinfo", path)
	if err != nil {
		return 0, fmt.Errorf("pdfinfo: %w", err)
	}
	for _, line := range strings.Split(out, "\n") {
		if strings.HasPrefix(line, "Pages:") {
			f := strings.TrimSpace(strings.TrimPrefix(line, "Pages:"))
			return strconv.Atoi(f)
		}
	}
	return 0, fmt.Errorf("pdfinfo: page count not found")
}

// PageText extracts a single page's text with pdftotext (-f/-l bound the page).
func (e *PopplerEngine) PageText(ctx context.Context, path string, page int) (string, error) {
	p := strconv.Itoa(page)
	// "-" writes to stdout; -layout preserves reading order reasonably.
	out, err := runCmd(ctx, "pdftotext", "-f", p, "-l", p, "-layout", path, "-")
	if err != nil {
		return "", fmt.Errorf("pdftotext page %d: %w", page, err)
	}
	return out, nil
}

// Metadata reads Title/Author from pdfinfo.
func (e *PopplerEngine) Metadata(ctx context.Context, path string) (string, string, error) {
	out, err := runCmd(ctx, "pdfinfo", path)
	if err != nil {
		return "", "", err
	}
	var title, author string
	for _, line := range strings.Split(out, "\n") {
		switch {
		case strings.HasPrefix(line, "Title:"):
			title = strings.TrimSpace(strings.TrimPrefix(line, "Title:"))
		case strings.HasPrefix(line, "Author:"):
			author = strings.TrimSpace(strings.TrimPrefix(line, "Author:"))
		}
	}
	return title, author, nil
}

// RenderPagePNG renders a page to PNG via pdftoppm at the requested DPI.
func (e *PopplerEngine) RenderPagePNG(ctx context.Context, path string, page int, dir string, dpi int) (string, error) {
	p := strconv.Itoa(page)
	prefix := filepath.Join(dir, fmt.Sprintf("page_%03d", page))
	// pdftoppm -png -r DPI -f p -l p in prefix  →  prefix-<page>.png (or prefix.png single)
	if _, err := runCmd(ctx, "pdftoppm", "-png", "-r", strconv.Itoa(dpi), "-f", p, "-l", p, "-singlefile", path, prefix); err != nil {
		return "", fmt.Errorf("pdftoppm page %d: %w", page, err)
	}
	return prefix + ".png", nil
}

// runCmd runs a command and returns stdout, capturing stderr in the error.
func runCmd(ctx context.Context, name string, args ...string) (string, error) {
	cmd := exec.CommandContext(ctx, name, args...)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("%s: %v: %s", name, err, strings.TrimSpace(stderr.String()))
	}
	return stdout.String(), nil
}
