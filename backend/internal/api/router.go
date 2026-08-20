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
	"github.com/legacy-document-processing-tool/backend/internal/documents"
	"github.com/legacy-document-processing-tool/backend/internal/repository"
	"github.com/legacy-document-processing-tool/backend/internal/storage"
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

	// Storage backend (local | s3) for documents. A construction error (e.g. an
	// S3 misconfiguration) is logged; local storage never fails here.
	store, err := storage.New(cfg)
	if err != nil {
		log.Error("storage init failed; document endpoints will error until fixed", slog.Any("error", err))
	}
	docSvc := documents.NewService(queries, store, cfg.MaxUploadSizeMB)
	docHandler := handlers.NewDocumentHandler(queries, docSvc)

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

	// Documents + upload (all require auth). Paths preserved from Python:
	//   POST   {prefix}/upload
	//   GET    {prefix}/documents
	//   GET    {prefix}/documents/favorites
	//   GET    {prefix}/documents/{id}
	//   DELETE {prefix}/documents/{id}
	//   GET    {prefix}/documents/{id}/download
	//   POST   {prefix}/documents/{id}/favorite
	//   GET    {prefix}/documents/{id}/extraction | /content | /table-markdown (stubs)
	r.Group(func(pr chi.Router) {
		pr.Use(requireAuth)

		pr.Post(cfg.APIPrefix+"/upload", docHandler.Upload)

		pr.Route(cfg.APIPrefix+"/documents", func(dr chi.Router) {
			dr.Get("/", docHandler.ListDocuments)
			// Static route registered before the {id} param route.
			dr.Get("/favorites", docHandler.ListFavorites)

			dr.Get("/{id}", docHandler.GetDocument)
			dr.Delete("/{id}", docHandler.DeleteDocument)
			dr.Get("/{id}/download", docHandler.Download)
			dr.Post("/{id}/favorite", docHandler.ToggleFavorite)
			dr.Get("/{id}/extraction", docHandler.GetExtractionStatus)
			dr.Get("/{id}/content", docHandler.GetExtractionContent)
			dr.Get("/{id}/table-markdown", docHandler.GetTableMarkdown)
		})
	})

	return r
}

func writeWelcome(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"message":"Welcome to the Legacy Document Manager APIs. See /docs for documentation."}`))
}
