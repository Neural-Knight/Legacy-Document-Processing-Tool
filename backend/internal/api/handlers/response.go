package handlers

import (
	"encoding/json"
	"net/http"
)

// writeJSON serializes v as JSON with the given status code.
func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// errorResponse mirrors FastAPI's error body shape: {"detail": "..."}.
type errorResponse struct {
	Detail string `json:"detail"`
}

// writeError emits a FastAPI-compatible error body.
func writeError(w http.ResponseWriter, status int, detail string) {
	writeJSON(w, status, errorResponse{Detail: detail})
}
