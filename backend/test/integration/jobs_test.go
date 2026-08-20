//go:build integration

package integration

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/legacy-document-processing-tool/backend/internal/jobs"
	"github.com/legacy-document-processing-tool/backend/internal/repository"
	"github.com/legacy-document-processing-tool/backend/internal/worker"
)

// runWorkerOnce claims and processes exactly one due job with the stub
// processor, returning true if a job was handled. It mirrors what the worker
// loop does per claim, but synchronously for deterministic tests.
func runWorkerOnce(t *testing.T, q *repository.Queries) bool {
	t.Helper()
	workerID := "test-worker"
	job, err := q.ClaimNextJob(context.Background(), &workerID)
	if err != nil {
		return false // no due job
	}
	doc, err := q.GetDocument(context.Background(), job.DocumentID)
	if err != nil {
		// Document vanished (e.g. deleted by another test); just complete it.
		_ = q.CompleteJob(context.Background(), job.ID)
		return true
	}
	proc := worker.NewStubProcessor(q)
	if err := proc.Process(context.Background(), job, doc); err != nil {
		t.Fatalf("processor: %v", err)
	}
	if err := q.CompleteJob(context.Background(), job.ID); err != nil {
		t.Fatalf("complete job: %v", err)
	}
	return true
}

// drainJobs processes all currently-due pending jobs. Since the integration
// tests share one database, other tests' jobs may sit in the queue; draining
// guarantees our document's job is processed regardless of claim order.
func drainJobs(t *testing.T, q *repository.Queries) {
	t.Helper()
	for i := 0; i < 100; i++ {
		if !runWorkerOnce(t, q) {
			return
		}
	}
}

func TestUploadEnqueuesAndWorkerProcesses(t *testing.T) {
	srv, pool := newDocTestServer(t)
	token, _ := registerAndLogin(t, srv, pool)
	q := repository.New(pool)

	// Upload → 201, status "uploaded". Unique filename avoids the same-second
	// base36-id + filename collision on the unique file_path index.
	resp := uploadFile(t, srv, token, "enqueue_"+itoa(time.Now().UnixNano())+".csv", []byte("a,b\n1,2\n"))
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("upload: expected 201, got %d", resp.StatusCode)
	}
	var doc docJSON
	json.NewDecoder(resp.Body).Decode(&doc)
	resp.Body.Close()
	if doc.Status != "uploaded" || doc.Processed {
		t.Fatalf("expected uploaded/false right after upload, got %q/%v", doc.Status, doc.Processed)
	}

	// A pending job must exist for the document.
	job, err := q.GetJobByDocumentID(context.Background(), doc.ID)
	if err != nil {
		t.Fatalf("expected a job for document: %v", err)
	}
	if job.Status != "pending" {
		t.Fatalf("expected pending job, got %q", job.Status)
	}

	// Drain the queue; our document's job will be processed (tests share a DB,
	// so other pending jobs may exist — draining handles claim ordering).
	drainJobs(t, q)

	// Poll the document status via API until processed (fast, but tolerate lag).
	deadline := time.Now().Add(3 * time.Second)
	var got docJSON
	for time.Now().Before(deadline) {
		r := authGet(t, srv.URL+"/api/documents/"+itoa(int64(doc.ID)), token)
		json.NewDecoder(r.Body).Decode(&got)
		r.Body.Close()
		if got.Status == "processed" {
			break
		}
		time.Sleep(50 * time.Millisecond)
	}
	if got.Status != "processed" || !got.Processed {
		t.Fatalf("expected processed/true, got %q/%v", got.Status, got.Processed)
	}

	// GET /extraction should now report completed + content_available.
	r := authGet(t, srv.URL+"/api/documents/"+itoa(int64(doc.ID))+"/extraction", token)
	if r.StatusCode != http.StatusOK {
		t.Fatalf("extraction status: expected 200, got %d", r.StatusCode)
	}
	var ext struct {
		Status           string `json:"status"`
		ContentAvailable bool   `json:"content_available"`
	}
	json.NewDecoder(r.Body).Decode(&ext)
	r.Body.Close()
	if ext.Status != "completed" || !ext.ContentAvailable {
		t.Fatalf("extraction: expected completed/true, got %q/%v", ext.Status, ext.ContentAvailable)
	}

	// GET /content should return the placeholder JSON.
	r = authGet(t, srv.URL+"/api/documents/"+itoa(int64(doc.ID))+"/content", token)
	if r.StatusCode != http.StatusOK {
		t.Fatalf("content: expected 200, got %d", r.StatusCode)
	}
	var content map[string]any
	json.NewDecoder(r.Body).Decode(&content)
	r.Body.Close()
	if content["extraction_status"] != "placeholder" {
		t.Fatalf("content: expected placeholder, got %v", content["extraction_status"])
	}
}

func TestEnqueueIsIdempotent(t *testing.T) {
	_, pool := newDocTestServer(t)
	q := repository.New(pool)

	// Create a user + document row directly so we can enqueue against it.
	ctx := context.Background()
	active := true
	hashed := "$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
	uname := "job_user_" + itoa(time.Now().UnixNano())
	user, err := q.CreateUser(ctx, repository.CreateUserParams{
		Email: uname + "@example.com", Username: uname, HashedPassword: hashed, IsActive: &active,
	})
	if err != nil {
		t.Fatalf("create user: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, "DELETE FROM users WHERE id=$1", user.ID) })

	uniq := itoa(time.Now().UnixNano())
	fn, fp, ft, fs, st := "f.csv", "x_"+uniq+"_f.csv", "text/csv", "10", "uploaded"
	proc := false
	doc, err := q.CreateDocument(ctx, repository.CreateDocumentParams{
		Filename: &fn, OriginalFilename: &fn, FilePath: &fp, FileType: &ft, FileSize: &fs,
		Processed: &proc, UserID: &user.ID, Status: &st,
	})
	if err != nil {
		t.Fatalf("create document: %v", err)
	}

	svc := jobs.NewService(q)
	j1, err := svc.Enqueue(ctx, doc.ID)
	if err != nil {
		t.Fatalf("enqueue 1: %v", err)
	}
	j2, err := svc.Enqueue(ctx, doc.ID)
	if err != nil {
		t.Fatalf("enqueue 2: %v", err)
	}
	if j1.ID != j2.ID {
		t.Fatalf("expected idempotent enqueue to return the same job, got %d and %d", j1.ID, j2.ID)
	}
}

func TestDeleteCancelsPendingJob(t *testing.T) {
	srv, pool := newDocTestServer(t)
	token, _ := registerAndLogin(t, srv, pool)
	q := repository.New(pool)

	resp := uploadFile(t, srv, token, "delete_"+itoa(time.Now().UnixNano())+".csv", []byte("a,b\n1,2\n"))
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("upload: expected 201, got %d", resp.StatusCode)
	}
	var doc docJSON
	json.NewDecoder(resp.Body).Decode(&doc)
	resp.Body.Close()

	// Delete the document (should cancel the pending job before the row cascades).
	req, _ := http.NewRequest(http.MethodDelete, srv.URL+"/api/documents/"+itoa(int64(doc.ID)), nil)
	req.Header.Set("Authorization", "Bearer "+token)
	dresp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("delete: %v", err)
	}
	if dresp.StatusCode != http.StatusNoContent {
		t.Fatalf("delete: expected 204, got %d", dresp.StatusCode)
	}
	dresp.Body.Close()

	// The job for this document must no longer be pending/running (it was
	// cancelled on delete, and the row cascades away with the document).
	if _, err := q.GetDocument(context.Background(), doc.ID); err == nil {
		t.Fatal("expected the document to be deleted")
	}
	// Any job row for the deleted document is gone via cascade; a fresh lookup
	// returns no rows.
	if _, err := q.GetJobByDocumentID(context.Background(), doc.ID); err == nil {
		t.Fatal("expected no job row for the deleted document")
	}
}
