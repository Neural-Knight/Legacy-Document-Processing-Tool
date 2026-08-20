package handlers

import (
	"encoding/json"
	"io"
	"net/http"
)

// writeJSON serializes v as JSON with the given status code.
func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// decodeJSON decodes the request body into v.
func decodeJSON(r *http.Request, v interface{}) error {
	return json.NewDecoder(r.Body).Decode(v)
}

// copyStream streams src into w without buffering the whole payload.
func copyStream(w io.Writer, src io.Reader) (int64, error) {
	return io.Copy(w, src)
}

// errorResponse is the JSON error body shape: {"detail": "..."}.
type errorResponse struct {
	Detail string `json:"detail"`
}

// writeError emits a JSON error body ({"detail": "..."}).
func writeError(w http.ResponseWriter, status int, detail string) {
	writeJSON(w, status, errorResponse{Detail: detail})
}
