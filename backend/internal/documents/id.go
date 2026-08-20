package documents

import (
	"crypto/rand"
	"time"
)

const base36Chars = "0123456789abcdefghijklmnopqrstuvwxyz"

// base36Encode encodes a non-negative integer into base36 (0 -> "0").
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

// generateDocumentID returns a base36 encoding of the current Unix timestamp
// with a short random base36 suffix appended.
//
// The suffix guards against collisions from whole-second timestamp resolution:
// two uploads of the same filename within one second would otherwise produce
// identical storage keys and collide on the unique file_path index. The suffix
// makes the key unique while preserving the base36-timestamp scheme.
func generateDocumentID() string {
	return base36Encode(time.Now().Unix()) + randomBase36(4)
}

// randomBase36 returns n random base36 characters.
func randomBase36(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		// crypto/rand should not fail; fall back to a fixed suffix rather than panic.
		return "0000"[:n]
	}
	out := make([]byte, n)
	for i := range b {
		out[i] = base36Chars[int(b[i])%36]
	}
	return string(out)
}
