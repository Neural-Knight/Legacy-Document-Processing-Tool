package worker

import "time"

const base36Chars = "0123456789abcdefghijklmnopqrstuvwxyz"

// base36Timestamp returns a base36 encoding of the current Unix timestamp,
// used as the table-name prefix for md2sql (matches the Python timestamp_base36
// prefix passed to process_markdown_directory).
func base36Timestamp() string {
	n := time.Now().Unix()
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
