// Package api wires the chi router, middleware, and route handlers.
package api

import (
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/legacy-document-processing-tool/backend/internal/api/handlers"
	appmw "github.com/legacy-document-processing-tool/backend/internal/api/middleware"
	"github.com/legacy-document-processing-tool/backend/internal/auth"
	"github.com/legacy-document-processing-tool/backend/internal/config"
	"github.com/legacy-document-processing-tool/backend/internal/repository"
)

// NewRouter builds the fully-wired HTTP handler.
//
// Route layout preserves the Python contracts:
//   - GET  /health, GET /ready         (health probes)
//   - GET  /                           (welcome message)
//   - {API_V1_STR}/auth/*              (auth endpoints; default /api/auth/*)
func NewRouter(cfg *config.Config, pool *pgxpool.Pool, log *slog.Logger) http.Handler {
	queries := repository.New(pool)
	tokens := auth.NewTokenService(cfg.SecretKey, durationMinutes(cfg.AccessTokenExpireMinutes))
	authSvc := auth.NewService(queries, tokens)

	authHandler := handlers.NewAuthHandler(queries, authSvc, cfg.AccessTokenExpireMinutes, cfg.RefreshTokenExpireDays)
	healthHandler := handlers.NewHealthHandler(pool)

	r := chi.NewRouter()

	// Global middleware chain (outermost first).
	r.Use(appmw.RequestID)
	r.Use(appmw.Logger(log))
	r.Use(appmw.Recoverer(log))
	r.Use(appmw.CORS(cfg.CORSOrigins))

	// Root + health (unprefixed, matching Python).
	r.Get("/", func(w http.ResponseWriter, _ *http.Request) {
		writeWelcome(w)
	})
	r.Get("/health", healthHandler.Health)
	r.Get("/ready", healthHandler.Ready)

	requireAuth := handlers.RequireAuth(tokens, queries)

	// {API_V1_STR}/auth/*
	r.Route(cfg.APIPrefix+"/auth", func(ar chi.Router) {
		ar.Post("/register", authHandler.Register)
		ar.Post("/login", authHandler.Login)
		ar.Post("/login/access-token", authHandler.LoginAccessToken)
		ar.Post("/refresh-token", authHandler.RefreshToken)
		ar.Post("/logout", authHandler.Logout)

		ar.Group(func(pr chi.Router) {
			pr.Use(requireAuth)
			pr.Post("/logout-all-devices", authHandler.LogoutAllDevices)
			pr.Get("/me", authHandler.Me)
			pr.Put("/me", authHandler.UpdateMe)
		})
	})

	return r
}

func writeWelcome(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"message":"Welcome to the Legacy Document Manager APIs. See /docs for documentation."}`))
}
