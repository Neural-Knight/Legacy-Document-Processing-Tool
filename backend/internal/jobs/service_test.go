package jobs

import (
	"testing"
	"time"
)

func TestIdempotencyKey(t *testing.T) {
	if got := IdempotencyKey(42); got != "doc:42" {
		t.Fatalf("IdempotencyKey(42) = %q, want doc:42", got)
	}
	// Same document always yields the same key (so re-enqueue is a no-op).
	if IdempotencyKey(7) != IdempotencyKey(7) {
		t.Fatal("IdempotencyKey must be stable for the same document")
	}
}

func TestBackoff(t *testing.T) {
	cases := []struct {
		attempt int32
		want    time.Duration
	}{
		{0, 30 * time.Second}, // clamped up to 1
		{1, 30 * time.Second},
		{2, 2 * time.Minute},
		{3, 10 * time.Minute},
		{4, 10 * time.Minute}, // clamped to last
		{99, 10 * time.Minute},
	}
	for _, c := range cases {
		if got := Backoff(c.attempt); got != c.want {
			t.Errorf("Backoff(%d) = %v, want %v", c.attempt, got, c.want)
		}
	}
}

func TestBackoffMonotonic(t *testing.T) {
	prev := time.Duration(0)
	for a := int32(1); a <= 3; a++ {
		d := Backoff(a)
		if d < prev {
			t.Fatalf("backoff decreased at attempt %d: %v < %v", a, d, prev)
		}
		prev = d
	}
}
