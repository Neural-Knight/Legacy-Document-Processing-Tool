//go:build integration

// Package integration contains end-to-end auth tests that run against a real
// PostgreSQL database. They are excluded from the default `go test ./...` run
// via the `integration` build tag.
//
// Run with:
//
//	TEST_DATABASE_URL=postgres://user:pass@localhost:5432/documentManager \
//	  go test -tags=integration ./test/integration/...
//
// The schema is applied by the Go migrations (golang-migrate) at test start —
// no Alembic. The target database only needs to be reachable and empty (or
// already at the latest migration; re-running is a no-op). Each test uses a
// unique username/email so runs do not collide; created rows are cleaned up.
package integration

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/legacy-document-processing-tool/backend/internal/api"
	"github.com/legacy-document-processing-tool/backend/internal/config"
	"github.com/legacy-document-processing-tool/backend/internal/repository"
)

func newTestServer(t *testing.T) (*httptest.Server, *pgxpool.Pool) {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL not set; skipping integration test")
	}

	// Apply Go migrations to bring the schema up (idempotent).
	if err := repository.Migrate(dsn); err != nil {
		t.Fatalf("apply migrations: %v", err)
	}

	pool, err := pgxpool.New(context.Background(), dsn)
	if err != nil {
		t.Fatalf("connect to test db: %v", err)
	}
	if err := pool.Ping(context.Background()); err != nil {
		t.Fatalf("ping test db: %v", err)
	}

	cfg := &config.Config{
		APIPrefix:                "/api",
		ProjectName:              "test",
		SecretKey:                "integration-test-secret",
		Algorithm:                "HS256",
		AccessTokenExpireMinutes: 30,
		RefreshTokenExpireDays:   7,
		CORSOrigins:              []string{"http://localhost:3000"},
	}
	log := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelError}))
	srv := httptest.NewServer(api.NewRouter(cfg, pool, log))
	t.Cleanup(srv.Close)
	t.Cleanup(pool.Close)
	return srv, pool
}

func postJSON(t *testing.T, url string, body interface{}, bearer string) *http.Response {
	t.Helper()
	b, _ := json.Marshal(body)
	req, _ := http.NewRequest(http.MethodPost, url, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	if bearer != "" {
		req.Header.Set("Authorization", "Bearer "+bearer)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("request %s: %v", url, err)
	}
	return resp
}

func TestAuthFlow(t *testing.T) {
	srv, pool := newTestServer(t)

	unique := time.Now().UnixNano()
	username := "itest_user_" + itoa(unique)
	email := username + "@example.com"
	password := "Str0ngPass"

	// Cleanup any rows we create.
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(),
			"DELETE FROM users WHERE username = $1", username)
	})

	// 1) Register
	resp := postJSON(t, srv.URL+"/api/auth/register", map[string]interface{}{
		"username": username,
		"email":    email,
		"password": password,
	}, "")
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("register: expected 201, got %d", resp.StatusCode)
	}
	resp.Body.Close()

	// 2) Login
	resp = postJSON(t, srv.URL+"/api/auth/login", map[string]interface{}{
		"username":    username,
		"password":    password,
		"remember_me": true,
	}, "")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("login: expected 200, got %d", resp.StatusCode)
	}
	var tok struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		TokenType    string `json:"token_type"`
		ExpiresIn    int    `json:"expires_in"`
	}
	json.NewDecoder(resp.Body).Decode(&tok)
	resp.Body.Close()
	if tok.AccessToken == "" || tok.RefreshToken == "" {
		t.Fatal("login: missing tokens")
	}
	if tok.TokenType != "bearer" {
		t.Fatalf("login: expected token_type bearer, got %q", tok.TokenType)
	}

	// 3) GET /me with access token
	req, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/auth/me", nil)
	req.Header.Set("Authorization", "Bearer "+tok.AccessToken)
	meResp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("me request: %v", err)
	}
	if meResp.StatusCode != http.StatusOK {
		t.Fatalf("me: expected 200, got %d", meResp.StatusCode)
	}
	var me struct {
		Username string `json:"username"`
		FullName string `json:"full_name"`
	}
	json.NewDecoder(meResp.Body).Decode(&me)
	meResp.Body.Close()
	if me.Username != username {
		t.Fatalf("me: expected username %q, got %q", username, me.Username)
	}

	// 4) Refresh (rotation) — old token must stop working afterward
	resp = postJSON(t, srv.URL+"/api/auth/refresh-token", map[string]interface{}{
		"refresh_token": tok.RefreshToken,
	}, "")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("refresh: expected 200, got %d", resp.StatusCode)
	}
	var newTok struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
	}
	json.NewDecoder(resp.Body).Decode(&newTok)
	resp.Body.Close()
	if newTok.RefreshToken == tok.RefreshToken {
		t.Fatal("refresh: expected a rotated refresh token")
	}

	// Old refresh token should now be revoked.
	resp = postJSON(t, srv.URL+"/api/auth/refresh-token", map[string]interface{}{
		"refresh_token": tok.RefreshToken,
	}, "")
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("reuse old refresh: expected 401, got %d", resp.StatusCode)
	}
	resp.Body.Close()

	// 5) Logout with the new refresh token
	resp = postJSON(t, srv.URL+"/api/auth/logout", map[string]interface{}{
		"refresh_token": newTok.RefreshToken,
	}, "")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("logout: expected 200, got %d", resp.StatusCode)
	}
	var logoutBody struct {
		Success bool `json:"success"`
	}
	json.NewDecoder(resp.Body).Decode(&logoutBody)
	resp.Body.Close()
	if !logoutBody.Success {
		t.Fatal("logout: expected success=true")
	}
}

func TestMeRequiresAuth(t *testing.T) {
	srv, _ := newTestServer(t)
	resp, err := http.Get(srv.URL + "/api/auth/me")
	if err != nil {
		t.Fatalf("me request: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("me without token: expected 401, got %d", resp.StatusCode)
	}
}

func TestHealthAndReady(t *testing.T) {
	srv, _ := newTestServer(t)

	resp, err := http.Get(srv.URL + "/health")
	if err != nil {
		t.Fatalf("health: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("health: expected 200, got %d", resp.StatusCode)
	}
	resp.Body.Close()

	resp, err = http.Get(srv.URL + "/ready")
	if err != nil {
		t.Fatalf("ready: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("ready: expected 200 (db reachable), got %d", resp.StatusCode)
	}
	resp.Body.Close()
}

// itoa avoids importing strconv just for one conversion in test setup.
func itoa(n int64) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	var buf [20]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		buf[i] = '-'
	}
	return string(buf[i:])
}
