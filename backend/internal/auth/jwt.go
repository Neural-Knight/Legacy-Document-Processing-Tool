package auth

import (
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// Claims is the JWT token payload: sub (user id as string), exp, iat, jti, type.
type Claims struct {
	Sub  string `json:"sub"`
	Type string `json:"type"`
	Jti  string `json:"jti"`
	jwt.RegisteredClaims
}

// TokenService issues and validates HS256 access tokens.
type TokenService struct {
	secret    []byte
	accessTTL time.Duration
}

// NewTokenService builds a token service with the configured signing secret
// and access-token lifetime.
func NewTokenService(secret string, accessTTL time.Duration) *TokenService {
	return &TokenService{secret: []byte(secret), accessTTL: accessTTL}
}

// CreateAccessToken issues a signed access token for the given user id,
// with the claim set: sub, exp, iat, jti, type="access".
func (s *TokenService) CreateAccessToken(userID int64) (string, error) {
	now := time.Now().UTC()
	claims := Claims{
		Sub:  strconv.FormatInt(userID, 10),
		Type: "access",
		Jti:  uuid.NewString(),
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(s.accessTTL)),
			IssuedAt:  jwt.NewNumericDate(now),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.secret)
}

// ErrInvalidToken is returned when a token is malformed, expired, or not an
// access token.
var ErrInvalidToken = errors.New("could not validate credentials")

// ParseAccessToken validates the signature, expiry, and token type, returning
// the subject user id.
func (s *TokenService) ParseAccessToken(tokenStr string) (int64, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return s.secret, nil
	})
	if err != nil || !token.Valid {
		return 0, ErrInvalidToken
	}
	if claims.Type != "access" {
		return 0, ErrInvalidToken
	}
	id, err := strconv.ParseInt(claims.Sub, 10, 64)
	if err != nil {
		return 0, ErrInvalidToken
	}
	return id, nil
}
