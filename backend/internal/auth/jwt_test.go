package auth

import (
	"testing"
	"time"
)

func TestAccessTokenRoundTrip(t *testing.T) {
	ts := NewTokenService("test-secret-key", 30*time.Minute)
	token, err := ts.CreateAccessToken(42)
	if err != nil {
		t.Fatalf("CreateAccessToken: %v", err)
	}
	id, err := ParseFor(t, ts, token)
	if err != nil {
		t.Fatalf("ParseAccessToken: %v", err)
	}
	if id != 42 {
		t.Fatalf("expected subject 42, got %d", id)
	}
}

func TestAccessTokenRejectsWrongSecret(t *testing.T) {
	issuer := NewTokenService("secret-a", 30*time.Minute)
	verifier := NewTokenService("secret-b", 30*time.Minute)
	token, _ := issuer.CreateAccessToken(1)
	if _, err := verifier.ParseAccessToken(token); err == nil {
		t.Fatal("expected verification with a different secret to fail")
	}
}

func TestAccessTokenRejectsExpired(t *testing.T) {
	ts := NewTokenService("secret", -1*time.Minute) // already expired
	token, _ := ts.CreateAccessToken(1)
	if _, err := ts.ParseAccessToken(token); err == nil {
		t.Fatal("expected expired token to be rejected")
	}
}

// ParseFor is a tiny helper so the round-trip test reads clearly.
func ParseFor(t *testing.T, ts *TokenService, token string) (int64, error) {
	t.Helper()
	return ts.ParseAccessToken(token)
}
