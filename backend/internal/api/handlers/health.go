package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// HealthHandler serves liveness and readiness probes.
type HealthHandler struct {
	pool *pgxpool.Pool
}

// NewHealthHandler builds the health handler.
func NewHealthHandler(pool *pgxpool.Pool) *HealthHandler {
	return &HealthHandler{pool: pool}
}

// Health is a liveness probe: the process is up (GET /health).
// Body matches the Python backend: {"status": "healthy"}.
func (h *HealthHandler) Health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "healthy"})
}

// Ready is a readiness probe: the DB is reachable via pgxpool ping
// (GET /ready). Returns 503 when the database is unavailable.
func (h *HealthHandler) Ready(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()

	if err := h.pool.Ping(ctx); err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{
			"status":   "unavailable",
			"database": "unreachable",
		})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{
		"status":   "ready",
		"database": "ok",
	})
}
