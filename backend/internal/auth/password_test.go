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
	// Hashes use the standard argon2id PHC prefix.
	if len(hash) < 10 || hash[:10] != "$argon2id$" {
		t.Fatalf("expected $argon2id$ PHC prefix, got %q", hash)
	}
}

func TestHashDecodesToArgon2Params(t *testing.T) {
	// A produced hash must decode back to its embedded parameters, so hashes in
	// the standard argon2id PHC format (argon2id, v=19, m=65536, t=3, p=4)
	// verify correctly regardless of which service created them.
	got, err := HashPassword("Str0ngPass")
	if err != nil {
		t.Fatalf("HashPassword: %v", err)
	}
	if _, _, _, err := decodeArgon2(got); err != nil {
		t.Fatalf("produced hash should decode: %v", err)
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
