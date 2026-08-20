package auth

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"

	"golang.org/x/crypto/argon2"
)

// The Python backend hashes passwords with passlib's argon2 handler
// (CryptContext(schemes=["argon2"])), which produces argon2id hashes in the
// standard PHC string format:
//
//	$argon2id$v=19$m=<mem>,t=<time>,p=<par>$<b64salt>$<b64hash>
//
// We emit the same format and verify hashes by parsing their embedded
// parameters, so hashes created by the Python service remain verifiable here
// and vice versa. Defaults below match passlib's argon2 defaults.
const (
	argonTimeCost   = 3     // passlib default rounds
	argonMemoryCost = 65536 // 64 MiB (passlib default memory_cost, in KiB)
	argonThreads    = 4     // passlib default parallelism
	argonSaltLen    = 16    // passlib default salt size (bytes)
	argonKeyLen     = 32    // passlib default hash length (bytes)
	argonVersion    = argon2.Version
)

// HashPassword returns a passlib-compatible argon2id PHC hash string.
func HashPassword(password string) (string, error) {
	salt := make([]byte, argonSaltLen)
	if _, err := rand.Read(salt); err != nil {
		return "", fmt.Errorf("generate salt: %w", err)
	}
	hash := argon2.IDKey([]byte(password), salt, argonTimeCost, argonMemoryCost, argonThreads, argonKeyLen)

	// passlib omits base64 padding, matching the reference argon2 CLI format.
	b64 := base64.RawStdEncoding
	return fmt.Sprintf(
		"$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
		argonVersion, argonMemoryCost, argonTimeCost, argonThreads,
		b64.EncodeToString(salt), b64.EncodeToString(hash),
	), nil
}

// VerifyPassword checks a plaintext password against an encoded argon2id hash.
// It reads the cost parameters from the encoded string so hashes produced with
// different settings (e.g. by an older Python deployment) still verify.
func VerifyPassword(password, encoded string) bool {
	params, salt, want, err := decodeArgon2(encoded)
	if err != nil {
		return false
	}
	got := argon2.IDKey([]byte(password), salt, params.time, params.memory, params.threads, uint32(len(want)))
	return subtle.ConstantTimeCompare(got, want) == 1
}

type argon2Params struct {
	memory  uint32
	time    uint32
	threads uint8
}

var errBadHash = errors.New("invalid argon2 hash format")

func decodeArgon2(encoded string) (argon2Params, []byte, []byte, error) {
	// Expected: $argon2id$v=19$m=...,t=...,p=...$salt$hash
	parts := strings.Split(encoded, "$")
	if len(parts) != 6 || parts[0] != "" {
		return argon2Params{}, nil, nil, errBadHash
	}
	if parts[1] != "argon2id" && parts[1] != "argon2i" && parts[1] != "argon2d" {
		return argon2Params{}, nil, nil, errBadHash
	}

	var version int
	if _, err := fmt.Sscanf(parts[2], "v=%d", &version); err != nil {
		return argon2Params{}, nil, nil, errBadHash
	}

	var p argon2Params
	if _, err := fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &p.memory, &p.time, &p.threads); err != nil {
		return argon2Params{}, nil, nil, errBadHash
	}

	b64 := base64.RawStdEncoding
	salt, err := b64.DecodeString(parts[4])
	if err != nil {
		return argon2Params{}, nil, nil, errBadHash
	}
	hash, err := b64.DecodeString(parts[5])
	if err != nil {
		return argon2Params{}, nil, nil, errBadHash
	}
	return p, salt, hash, nil
}
