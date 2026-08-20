package documents

import "time"

const base36Chars = "0123456789abcdefghijklmnopqrstuvwxyz"

// base36Encode encodes a non-negative integer into base36, matching the Python
// app/utils/id_utils.py base36_encode (0 -> "0").
func base36Encode(n int64) string {
	if n == 0 {
		return "0"
	}
	var buf []byte
	for n > 0 {
		buf = append([]byte{base36Chars[n%36]}, buf...)
		n /= 36
	}
	return string(buf)
}

// generateDocumentID returns a base36 encoding of the current Unix timestamp,
// porting generate_document_id() from the Python backend. It is used to prefix
// stored filenames so uploads with the same original name don't collide.
func generateDocumentID() string {
	return base36Encode(time.Now().Unix())
}
