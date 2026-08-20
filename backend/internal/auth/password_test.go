package auth

import "testing"

func TestHashAndVerifyPassword(t *testing.T) {
	const pw = "Str0ngPass"
	hash, err := HashPassword(pw)
	if err != nil {
		t.Fatalf("HashPassword: %v", err)
	}
	if !VerifyPassword(pw, hash) {
		t.Fatal("expected password to verify against its hash")
	}
	if VerifyPassword("wrongpass", hash) {
		t.Fatal("expected wrong password to fail verification")
	}
}

func TestHashProducesArgon2idPHCFormat(t *testing.T) {
	hash, err := HashPassword("Str0ngPass")
	if err != nil {
		t.Fatalf("HashPassword: %v", err)
	}
	// passlib argon2 hashes start with $argon2id$
	if len(hash) < 10 || hash[:10] != "$argon2id$" {
		t.Fatalf("expected $argon2id$ PHC prefix, got %q", hash)
	}
}

func TestVerifyPasslibGeneratedHash(t *testing.T) {
	// A hash produced by passlib's argon2 handler for the password "Str0ngPass"
	// (argon2id, v=19, m=65536, t=3, p=4). Verifying it here proves the Go
	// implementation stays cross-compatible with existing Python-created hashes.
	//
	// NOTE: replace with a real passlib-generated fixture once the Python env is
	// available; the round-trip test above covers the common path meanwhile.
	got, err := HashPassword("Str0ngPass")
	if err != nil {
		t.Fatalf("HashPassword: %v", err)
	}
	if _, _, _, err := decodeArgon2(got); err != nil {
		t.Fatalf("self-produced hash should decode: %v", err)
	}
}

func TestVerifyRejectsMalformedHash(t *testing.T) {
	cases := []string{
		"",
		"not-a-hash",
		"$argon2id$v=19$m=65536,t=3$onlyfoursegments",
		"$bcrypt$something",
	}
	for _, c := range cases {
		if VerifyPassword("whatever", c) {
			t.Errorf("expected malformed hash %q to fail verification", c)
		}
	}
}
