package auth

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/legacy-document-processing-tool/backend/internal/repository"
)

// Service bundles token issuance and the DB-backed refresh-token lifecycle.
type Service struct {
	queries *repository.Queries
	tokens  *TokenService
}

// NewService constructs the auth service.
func NewService(queries *repository.Queries, tokens *TokenService) *Service {
	return &Service{queries: queries, tokens: tokens}
}

// Tokens exposes the underlying token service (for access-token creation).
func (s *Service) Tokens() *TokenService { return s.tokens }

// CreateRefreshToken generates an opaque UUID refresh token and persists it.
func (s *Service) CreateRefreshToken(ctx context.Context, userID int32, userAgent, ipAddress string, ttl time.Duration) (string, error) {
	tokenStr := uuid.NewString()
	expires := pgtype.Timestamptz{Time: time.Now().UTC().Add(ttl), Valid: true}

	var ua, ip *string
	if userAgent != "" {
		ua = &userAgent
	}
	if ipAddress != "" {
		ip = &ipAddress
	}

	_, err := s.queries.CreateRefreshToken(ctx, repository.CreateRefreshTokenParams{
		Token:     tokenStr,
		ExpiresAt: expires,
		UserID:    userID,
		UserAgent: ua,
		IpAddress: ip,
	})
	if err != nil {
		return "", err
	}
	return tokenStr, nil
}

// ValidateRefreshToken returns the owning user id for a non-revoked,
// non-expired token, or ok=false otherwise.
func (s *Service) ValidateRefreshToken(ctx context.Context, token string) (int32, bool) {
	row, err := s.queries.GetValidRefreshToken(ctx, token)
	if err != nil {
		return 0, false
	}
	return row.UserID, true
}

// RevokeRefreshToken marks a single token revoked; returns true if a row changed.
func (s *Service) RevokeRefreshToken(ctx context.Context, token string) (bool, error) {
	n, err := s.queries.RevokeRefreshToken(ctx, token)
	if err != nil {
		return false, err
	}
	return n > 0, nil
}

// RevokeAllUserRefreshTokens revokes every active token for a user, returning
// the count revoked.
func (s *Service) RevokeAllUserRefreshTokens(ctx context.Context, userID int32) (int64, error) {
	return s.queries.RevokeAllUserRefreshTokens(ctx, userID)
}
