//go:build integration

package integration

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"mime/multipart"
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

// newDocTestServer builds a server backed by a temp local-storage dir so
// uploads don't pollute ./uploads and are cleaned up after the test.
func newDocTestServer(t *testing.T) (*httptest.Server, *pgxpool.Pool) {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL not set; skipping integration test")
	}
	if err := repository.Migrate(dsn); err != nil {
		t.Fatalf("apply migrations: %v", err)
	}
	pool, err := pgxpool.New(context.Background(), dsn)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	if err := pool.Ping(context.Background()); err != nil {
		t.Fatalf("ping: %v", err)
	}

	cfg := &config.Config{
		APIPrefix:                "/api",
		ProjectName:              "test",
		SecretKey:                "integration-test-secret",
		Algorithm:                "HS256",
		AccessTokenExpireMinutes: 30,
		RefreshTokenExpireDays:   7,
		CORSOrigins:              []string{"http://localhost:3000"},
		MaxUploadSizeMB:          50,
		StorageType:              "local",
		LocalStoragePath:         t.TempDir(),
	}
	log := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelError}))
	srv := httptest.NewServer(api.NewRouter(cfg, pool, log))
	t.Cleanup(srv.Close)
	t.Cleanup(pool.Close)
	return srv, pool
}

// registerAndLogin creates a fresh user and returns its access token + id.
func registerAndLogin(t *testing.T, srv *httptest.Server, pool *pgxpool.Pool) (token, username string) {
	t.Helper()
	username = "doc_user_" + itoa(time.Now().UnixNano())
	email := username + "@example.com"
	password := "Str0ngPass"

	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), "DELETE FROM users WHERE username = $1", username)
	})

	resp := postJSON(t, srv.URL+"/api/auth/register", map[string]any{
		"username": username, "email": email, "password": password,
	}, "")
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("register: expected 201, got %d", resp.StatusCode)
	}
	resp.Body.Close()

	resp = postJSON(t, srv.URL+"/api/auth/login", map[string]any{
		"username": username, "password": password,
	}, "")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("login: expected 200, got %d", resp.StatusCode)
	}
	var tok struct {
		AccessToken string `json:"access_token"`
	}
	json.NewDecoder(resp.Body).Decode(&tok)
	resp.Body.Close()
	if tok.AccessToken == "" {
		t.Fatal("login: missing access token")
	}
	return tok.AccessToken, username
}

func uploadFile(t *testing.T, srv *httptest.Server, token, filename string, content []byte) *http.Response {
	t.Helper()
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	fw, err := mw.CreateFormFile("file", filename)
	if err != nil {
		t.Fatalf("create form file: %v", err)
	}
	fw.Write(content)
	mw.Close()

	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/upload", &buf)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("upload request: %v", err)
	}
	return resp
}

func authGet(t *testing.T, url, token string) *http.Response {
	t.Helper()
	req, _ := http.NewRequest(http.MethodGet, url, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("GET %s: %v", url, err)
	}
	return resp
}

type docJSON struct {
	ID               int32  `json:"id"`
	Filename         string `json:"filename"`
	OriginalFilename string `json:"original_filename"`
	FilePath         string `json:"file_path"`
	FileType         string `json:"file_type"`
	FileSize         string `json:"file_size"`
	Processed        bool   `json:"processed"`
	Status           string `json:"status"`
	UserID           int32  `json:"user_id"`
}

func TestDocumentLifecycle(t *testing.T) {
	srv, pool := newDocTestServer(t)
	token, _ := registerAndLogin(t, srv, pool)

	content := []byte("col1,col2\n1,2\n3,4\n")

	// 1) Upload
	resp := uploadFile(t, srv, token, "data.csv", content)
	if resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("upload: expected 201, got %d (%s)", resp.StatusCode, body)
	}
	var doc docJSON
	json.NewDecoder(resp.Body).Decode(&doc)
	resp.Body.Close()

	if doc.ID == 0 {
		t.Fatal("upload: expected a document id")
	}
	if doc.OriginalFilename != "data.csv" {
		t.Fatalf("upload: original_filename = %q, want data.csv", doc.OriginalFilename)
	}
	if doc.Status != "uploaded" || doc.Processed {
		t.Fatalf("upload: expected status=uploaded processed=false, got status=%q processed=%v", doc.Status, doc.Processed)
	}
	if doc.FileSize != itoa(int64(len(content))) {
		t.Fatalf("upload: file_size = %q, want %q", doc.FileSize, itoa(int64(len(content))))
	}

	// 2) List (owned)
	resp = authGet(t, srv.URL+"/api/documents", token)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("list: expected 200, got %d", resp.StatusCode)
	}
	var docs []docJSON
	json.NewDecoder(resp.Body).Decode(&docs)
	resp.Body.Close()
	if len(docs) != 1 || docs[0].ID != doc.ID {
		t.Fatalf("list: expected the uploaded doc, got %+v", docs)
	}

	// 3) Get by id
	resp = authGet(t, srv.URL+"/api/documents/"+itoa(int64(doc.ID)), token)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("get: expected 200, got %d", resp.StatusCode)
	}
	resp.Body.Close()

	// 4) Download and check bytes round-trip
	resp = authGet(t, srv.URL+"/api/documents/"+itoa(int64(doc.ID))+"/download", token)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("download: expected 200, got %d", resp.StatusCode)
	}
	got, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	if !bytes.Equal(got, content) {
		t.Fatalf("download: bytes mismatch\n got: %q\nwant: %q", got, content)
	}

	// 5) Favorite toggle on, then it appears in favorites
	resp = postJSON(t, srv.URL+"/api/documents/"+itoa(int64(doc.ID))+"/favorite",
		map[string]any{"favorite": true}, token)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("favorite on: expected 200, got %d", resp.StatusCode)
	}
	resp.Body.Close()

	resp = authGet(t, srv.URL+"/api/documents/favorites", token)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("favorites: expected 200, got %d", resp.StatusCode)
	}
	var favs []docJSON
	json.NewDecoder(resp.Body).Decode(&favs)
	resp.Body.Close()
	if len(favs) != 1 || favs[0].ID != doc.ID {
		t.Fatalf("favorites: expected 1 favorite (the doc), got %+v", favs)
	}

	// 6) Favorite toggle off → favorites empty
	resp = postJSON(t, srv.URL+"/api/documents/"+itoa(int64(doc.ID))+"/favorite",
		map[string]any{"favorite": false}, token)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("favorite off: expected 200, got %d", resp.StatusCode)
	}
	resp.Body.Close()

	resp = authGet(t, srv.URL+"/api/documents/favorites", token)
	var favsAfter []docJSON
	json.NewDecoder(resp.Body).Decode(&favsAfter)
	resp.Body.Close()
	if len(favsAfter) != 0 {
		t.Fatalf("favorites after un-favorite: expected 0, got %d", len(favsAfter))
	}

	// 7) Extraction stubs → 404
	for _, sub := range []string{"/extraction", "/content", "/table-markdown"} {
		resp = authGet(t, srv.URL+"/api/documents/"+itoa(int64(doc.ID))+sub, token)
		if resp.StatusCode != http.StatusNotFound {
			t.Fatalf("stub %s: expected 404, got %d", sub, resp.StatusCode)
		}
		resp.Body.Close()
	}

	// 8) Delete → 204, then get → 404
	req, _ := http.NewRequest(http.MethodDelete, srv.URL+"/api/documents/"+itoa(int64(doc.ID)), nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("delete request: %v", err)
	}
	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("delete: expected 204, got %d", resp.StatusCode)
	}
	resp.Body.Close()

	resp = authGet(t, srv.URL+"/api/documents/"+itoa(int64(doc.ID)), token)
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("get after delete: expected 404, got %d", resp.StatusCode)
	}
	resp.Body.Close()
}

func TestUploadRejectsUnsupportedType(t *testing.T) {
	srv, pool := newDocTestServer(t)
	token, _ := registerAndLogin(t, srv, pool)

	resp := uploadFile(t, srv, token, "notes.txt", []byte("hello"))
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400 for .txt upload, got %d", resp.StatusCode)
	}
	resp.Body.Close()
}

func TestDocumentAccessControl(t *testing.T) {
	srv, pool := newDocTestServer(t)
	ownerToken, _ := registerAndLogin(t, srv, pool)
	otherToken, _ := registerAndLogin(t, srv, pool)

	// Owner uploads.
	resp := uploadFile(t, srv, ownerToken, "owned.csv", []byte("a,b\n1,2\n"))
	var doc docJSON
	json.NewDecoder(resp.Body).Decode(&doc)
	resp.Body.Close()

	// Another user cannot access it → 403.
	resp = authGet(t, srv.URL+"/api/documents/"+itoa(int64(doc.ID)), otherToken)
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("cross-user get: expected 403, got %d", resp.StatusCode)
	}
	resp.Body.Close()

	// Missing document → 404.
	resp = authGet(t, srv.URL+"/api/documents/99999999", ownerToken)
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("missing doc: expected 404, got %d", resp.StatusCode)
	}
	resp.Body.Close()
}
