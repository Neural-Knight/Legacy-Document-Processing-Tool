package handlers

import (
	"context"
	"net/http"
	"strings"

	"github.com/legacy-document-processing-tool/backend/internal/auth"
	"github.com/legacy-document-processing-tool/backend/internal/repository"
)

type userCtxKey struct{}

// UserFromContext retrieves the authenticated user placed by RequireAuth.
func UserFromContext(ctx context.Context) (repository.User, bool) {
	u, ok := ctx.Value(userCtxKey{}).(repository.User)
	return u, ok
}

// RequireAuth validates the Bearer access token and loads the user. On failure
// it responds 401 and stops the chain.
func RequireAuth(tokens *auth.TokenService, queries *repository.Queries) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authz := r.Header.Get("Authorization")
			if authz == "" || !strings.HasPrefix(strings.ToLower(authz), "bearer ") {
				respondUnauthorized(w, "Could not validate credentials")
				return
			}
			token := strings.TrimSpace(authz[len("Bearer "):])

			userID, err := tokens.ParseAccessToken(token)
			if err != nil {
				respondUnauthorized(w, "Could not validate credentials")
				return
			}

			user, err := queries.GetUserByID(r.Context(), int32(userID))
			if err != nil {
				respondUnauthorized(w, "User not found")
				return
			}
			if user.IsActive == nil || !*user.IsActive {
				respondUnauthorized(w, "Inactive user")
				return
			}

			ctx := context.WithValue(r.Context(), userCtxKey{}, user)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
