package extraction

import (
	"context"
	"fmt"
	"os/exec"
	"strings"
)

// TesseractOCR shells out to the `tesseract` binary. If tesseract is not
// installed, Available() returns false and the pipeline skips OCR (scanned
// pages get empty text but the job still completes), degrading gracefully when
// OCR deps are missing.
type TesseractOCR struct {
	lang string
}

// NewTesseractOCR builds an OCR engine. lang defaults to "eng" when empty.
func NewTesseractOCR(lang string) *TesseractOCR {
	if lang == "" {
		lang = "eng"
	}
	return &TesseractOCR{lang: lang}
}

// Available reports whether the tesseract binary is on PATH.
func (o *TesseractOCR) Available() bool {
	_, err := exec.LookPath("tesseract")
	return err == nil
}

// OCRImage runs `tesseract <image> stdout -l <lang>`.
func (o *TesseractOCR) OCRImage(ctx context.Context, imagePath string) (string, error) {
	if !o.Available() {
		return "", fmt.Errorf("tesseract not available")
	}
	out, err := runCmd(ctx, "tesseract", imagePath, "stdout", "-l", o.lang)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(out), nil
}
