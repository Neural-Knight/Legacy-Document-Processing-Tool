# Backend (Go)

Go rewrite of the Legacy Document Processing Tool backend — a modular monolith
using chi, pgx/v5 + pgxpool, sqlc, log/slog, golang-jwt, and argon2.

Implemented so far (see `../MIGRATION.md`):
- **Phase 0/0b**: foundation, health probes, full auth parity, pure-Go migrations.
- **Phase 1**: document CRUD, favorites, streaming upload/download, local + S3
  storage.
- **Phase 2**: PostgreSQL-backed job queue + a dedicated worker process. Upload
  enqueues an extraction job; the worker claims it (`FOR UPDATE SKIP LOCKED`)
  with bounded concurrency, backoff retries, and stale-lock reclaim.
- **Phase 3**: real PDF extraction in the worker (`internal/extraction`) — per-page
  text via poppler (`pdftotext`), scanned-page detection with optional
  `tesseract` OCR, optional Gemini table markdown, and `md2sql` loading of
  extracted tables into dynamic SQL tables. `/content` returns the flat
  structured PDF JSON the frontend expects; `/table-markdown` serves the
  per-page markdown.
- **Phase 4**: indexing + RAG chat. After extraction the worker chunks content
  into `vector_entries` (`internal/indexer`). `POST /api/chat` retrieves the most
  relevant chunks (keyword overlap) and answers via Gemini (`GEMINI_KEYS`), or a
  template response when no keys are set. Chat sessions/history are persisted and
  managed via `/api/chat/*`. Real embeddings + pgvector are deferred (Phase 6);
  the `vector` column stays NULL.

## Layout

```
backend/
├── cmd/
│   ├── api/                 # HTTP server entrypoint
│   ├── migrate/             # migration runner (golang-migrate)
│   └── worker/              # document-processing worker entrypoint
├── internal/
│   ├── config/              # env-based configuration
│   ├── auth/                # argon2 hashing, JWT, refresh-token service
│   ├── storage/             # ObjectStorage interface + local & S3 backends
│   ├── documents/           # document domain service (id gen, validation, upload/delete/enqueue)
│   ├── jobs/                # job-queue façade (enqueue/cancel) + backoff schedule
│   ├── worker/              # poll/claim runner + real (PDF) / placeholder processor
│   ├── extraction/          # PDF pipeline: poppler text, OCR, Gemini tables, structured JSON
│   ├── md2sql/              # markdown tables → dynamic SQL tables (statement-by-statement)
│   ├── indexer/             # extraction JSON → vector_entries chunks (RAG)
│   ├── rag/                 # keyword retrieval + LLM/template answer generation
│   ├── gemini/              # shared Gemini text-generation client (chat)
│   ├── api/
│   │   ├── router.go        # chi routes
│   │   ├── middleware/      # request id, logging, CORS, recovery
│   │   └── handlers/        # auth, health, document handlers, auth middleware
│   └── repository/          # sqlc-generated queries + Migrate() helper
├── migrations/              # golang-migrate SQL (embedded); schema source of truth
├── test/
│   ├── integration/         # end-to-end tests incl. PDF extraction (build tag: integration)
│   └── testdata/extraction/ # sample PDF + golden JSON fixture
├── Dockerfile               # Go multi-stage build (api + migrate + worker binaries)
├── docker-compose.yml       # db + migrate + backend + worker
└── sqlc.yaml
```

The database schema is pure Go — managed by **golang-migrate**, no Alembic and
no Python. Migrations live in `migrations/` and are embedded into the `migrate`
binary via `go:embed`.

## Environment variables

Copy `.env.example` to `.env` and adjust. Key vars:

| Var | Purpose | Default |
|-----|---------|---------|
| `SECRET_KEY` | JWT signing secret — **required**, server won't start without it | — |
| `DATABASE_URL` | Full Postgres DSN (or set `POSTGRES_*` parts) | — |
| `POSTGRES_SERVER/PORT/USER/PASSWORD/DB` | Used to assemble the DSN if `DATABASE_URL` is unset | — |
| `API_V1_STR` | API path prefix | `/api` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Access-token lifetime | `30` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Refresh-token lifetime (with remember-me) | `7` |
| `BACKEND_CORS_ORIGINS` | Allowed origins (comma-separated or JSON array) | `http://localhost:3000,http://127.0.0.1:3000` |
| `HOST` / `PORT` | Bind address | `0.0.0.0` / `8000` |
| `MAX_CONCURRENT_JOBS` | Worker: max jobs processed at once | `2` |
| `JOB_POLL_INTERVAL_MS` | Worker: queue poll interval | `1000` |
| `JOB_LOCK_TIMEOUT_MINUTES` | Worker: reclaim jobs locked longer than this | `30` |
| `WORKER_ID` | Worker: identifier stamped on claimed jobs | hostname |

## Run locally

```bash
# 1. Apply the database schema (Go migrations, against an empty database).
DATABASE_URL=postgresql://user:pass@localhost:5432/documentManager \
  go run ./cmd/migrate

# 2. Start the API.
cp .env.example .env   # then edit values
go run ./cmd/api

# 3. In another terminal, start the worker (processes uploaded documents).
go run ./cmd/worker
```

The server listens on `:8000` and the frontend continues to call
`http://localhost:8000/api`.

## Run with Docker

```bash
# Requires POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB / SECRET_KEY in the
# environment or an .env file next to docker-compose.yml.
docker compose up --build

# Clean slate (drop volumes, re-migrate from empty). REQUIRED when a new
# migration is added (e.g. 000002_processing_jobs) if you have an old volume:
docker compose down -v && docker compose up --build
```

Compose brings up Postgres, runs the Go `migrate` binary (which exits 0 on
success), then starts the API on `:8000` **and** the worker. Both share the
`uploads_data` volume for local storage.

> **Gotcha:** model/key settings (`GEMINI_KEYS`, `GEMINI_MODEL`, `CHAT_MODEL`,
> `CHUNK_*`) are sourced from `.env` via `env_file` only. An exported shell var
> of the same name would otherwise win over `.env` in `${VAR}` substitution, so
> run compose without such exports (e.g. `unset CHAT_MODEL GEMINI_MODEL`) and
> pass `--env-file .env`:
>
> ```bash
> unset CHAT_MODEL GEMINI_MODEL
> docker compose --env-file .env up -d --build
> docker compose exec backend printenv CHAT_MODEL GEMINI_MODEL   # → gemini-2.5-flash
> ```

## Local end-to-end test (frontend + backend)

Full manual smoke test with the React frontend talking to the Go stack:

```bash
# 1. Backend stack (db + migrate + backend + worker). Set GEMINI_KEYS in .env
#    for real chat answers + table extraction (optional; works without).
cd backend
cp .env.example .env            # edit POSTGRES_*, SECRET_KEY, optionally GEMINI_KEYS
docker compose --env-file .env down -v
docker compose --env-file .env up --build -d

# 2. Frontend dev server (proxies /api → :8000).
cd ../frontend
cp .env.example .env            # VITE_API_URL=http://localhost:8000/api
npm install
npm run dev                     # http://localhost:3000
```

Then in the browser:

1. Register, then log in.
2. Upload a PDF. The document list polls `GET /api/documents/{id}` until
   `processed` is true (or `processing_error` is set).
3. Open the document viewer — it renders the extracted content
   (`GET /api/documents/{id}/content`); with `GEMINI_KEYS` set, the tables tab
   loads `GET /api/documents/{id}/table-markdown`.
4. Query Agent: select the document and ask a question. The answer comes from
   `POST /api/chat` (real Gemini answer when `GEMINI_KEYS` is set, otherwise a
   template response over the retrieved chunks).
5. Reload the page — chat continues on the same conversation (`conversation_id`).

`GEMINI_KEYS` must be present for **both** the API (chat answer generation) and
the worker (PDF table extraction); the compose file passes it to both.

## Architecture: async document processing

Upload no longer processes inline. Instead:

1. `POST /api/upload` stores the file, inserts the document (`status=uploaded`),
   enqueues a `processing_jobs` row (`idempotency_key = doc:{id}`), and returns
   201 immediately.
2. The **worker** (`cmd/worker`) polls the queue and claims the oldest due job
   with `UPDATE ... WHERE id = (SELECT ... FOR UPDATE SKIP LOCKED)`, so multiple
   workers never grab the same job. Concurrency is bounded by
   `MAX_CONCURRENT_JOBS`.
3. The processor sets `status=processing`, runs extraction (see below), writes
   the `extractions` row (`status=completed`), then sets `status=processed,
   processed=true`. On failure the job retries with backoff (30s → 2m → 10m) up
   to `max_attempts`, then is marked `failed` and the document `status=error`.
4. Jobs locked longer than `JOB_LOCK_TIMEOUT_MINUTES` (a crashed worker) are
   reclaimed as `pending`. Deleting a document cancels its open jobs.

This replaces the Python backend's unsafe `asyncio.create_task(db_session)`,
which had no persistence, retries, or safe session handling.

## PDF extraction

For PDFs the worker's `RealProcessor` runs the `internal/extraction` pipeline:

1. **Type detection** — per-page text is extracted with poppler `pdftotext`; a
   page with fewer than ~50 non-space chars is treated as scanned. The document
   is classified `machine-readable` / `scanned` / `mixed` / `Empty PDF`.
2. **OCR fallback** — scanned pages are rendered (`pdftoppm`) and run through
   `tesseract` when it's installed. If tesseract is absent, OCR is skipped and
   the page keeps empty text (the job still completes).
3. **Gemini tables** (optional) — when `GEMINI_KEYS` is set, each page image is
   sent to Gemini for table markdown, written to `tables/p{N}.md`. Per-document
   page work is bounded by `MAX_PAGE_WORKERS`; keys rotate across calls. With no
   keys, table extraction is skipped gracefully.
4. **Artifacts** — written under
   `{LOCAL_STORAGE_PATH}/extractions/doc_{id}/{ts}_{basename}/`
   (`extraction.json`, `tables/p{N}.md`), matching the Python layout.
5. **md2sql** — any `tables/*.md` are parsed and loaded into dynamic SQL tables
   (`{base36ts}_p{N}_*`), executed **one statement at a time** via pgx, and
   recorded in `tables_metadata`. Table-load failures are logged, not fatal.
6. **Stored content** — the flat structured JSON
   (`document_type`, `title`, `author`, `pages[].{page_number, page_content,
   image_content, isScanned, tables}`) is stored in `extractions.content` and
   returned by `GET /content`.

Non-PDF types (csv/xlsx/xls/json/xml) keep the placeholder wrapper (real
tabular parsers are out of scope for Phase 3).

### Extraction env vars

| Var | Purpose | Default |
|-----|---------|---------|
| `GEMINI_KEYS` | Space-separated Gemini API keys, no brackets (rotation); empty → tables skipped | *(empty)* |
| `GEMINI_MODEL` | Gemini model for PDF table extraction (worker) | `gemini-2.5-flash` |
| `OCR_LANGUAGE` | tesseract language(s), e.g. `eng` or `eng+hin` | `eng` |
| `MAX_PAGE_WORKERS` | Bounded page concurrency for Gemini/OCR per document | `4` |
| `JOB_LOCK_TIMEOUT_MINUTES` | Reclaim window (raised for long PDFs) | `120` |

Google AI Studio keys (the `AQ.` format) are valid; put them space-separated in
`GEMINI_KEYS` with no brackets. The key is sent in the `x-goog-api-key` request
header (never in the URL), so it does not appear in logs.

### Worker dependencies

The worker needs `poppler-utils` (`pdftotext`, `pdftoppm`) for PDF text/render
and, optionally, `tesseract-ocr` for scanned pages. Both are installed in the
Docker image. Locally, install them via your package manager (e.g.
`brew install poppler tesseract`). The pipeline degrades gracefully when
tesseract or `GEMINI_KEYS` are absent.

### Golden fixture

`test/testdata/extraction/` holds a small machine-readable sample PDF and a
golden JSON. `TestGoldenExtractionShape` compares extraction output against it
and supports `go test ./internal/extraction/ -run TestGoldenExtractionShape -update`
to regenerate; see that folder's `README.md` for how the fixtures were produced.

## Indexing + chat

After a successful extraction the worker indexes the content for retrieval
(`internal/indexer`), then chat answers questions over it (`internal/rag`):

1. **Indexing** — `IndexDocument` deletes any existing `vector_entries` for the
   document (idempotent re-index) and inserts fresh chunks: per-page text
   (`CHUNK_SIZE`/`CHUNK_OVERLAP`, broken at paragraph/sentence boundaries), a
   title metadata chunk, and one chunk per extracted table. Chunk metadata is
   stored in the `message_metadata` column (fixing Python's wrong `metadata=`
   kwarg). The `vector` column stays NULL until Phase 6. Indexing failure is
   logged and does not fail the job (same best-effort policy as md2sql).
2. **Retrieval** — `POST /api/chat` scores candidate chunks by keyword overlap
   (filtered to `document_ids` when provided) and takes the top 5. Vector
   similarity search is not yet implemented.
3. **Generation** — with `GEMINI_KEYS` set, the retrieved context + question are
   sent to Gemini (`CHAT_MODEL`, default `gemini-2.5-flash`) via the shared
   `internal/gemini` client (key rotation). With no keys — or if the LLM call
   fails — a template response over the retrieved chunks is returned (the
   failure is logged at Warn, without the key). Either way the answer, `sources`
   (document_id as a string to match the frontend), and `conversation_id` come
   back.
4. **Sessions** — a `chat_sessions` row is created (or resumed via
   `conversation_id`), and both user and assistant `chat_messages` are persisted;
   `/api/chat/sessions` and `/api/chat/{id}/history` read them back.

### Chat env vars

| Var | Purpose | Default |
|-----|---------|---------|
| `GEMINI_KEYS` | Reused for chat answers; empty → template response | *(empty)* |
| `CHAT_MODEL` | Gemini model for chat | `gemini-2.5-flash` |
| `CHUNK_SIZE` | Indexer chunk size (chars) | `1000` |
| `CHUNK_OVERLAP` | Indexer chunk overlap (chars) | `200` |

## Migrations

Schema is managed by **golang-migrate**. Migration SQL lives in `migrations/`
(`{version}_{name}.up.sql` / `.down.sql`) and is embedded into the `migrate`
binary, so it applies against an empty database with no external files.

```bash
# Apply all pending migrations (idempotent):
go run ./cmd/migrate

# Or, using the golang-migrate CLI directly:
migrate -path migrations -database "$DATABASE_URL" up
migrate -path migrations -database "$DATABASE_URL" down 1   # roll back one
migrate -path migrations -database "$DATABASE_URL" version  # current version
```

To add a schema change, create a new numbered pair
(`migrations/000002_<name>.up.sql` + `.down.sql`) and keep
`internal/repository/schema.sql` in sync so sqlc generates matching types.

## Endpoints

Health + auth (Phase 0):

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/health` | — | liveness → `{"status":"healthy"}` |
| GET | `/ready` | — | readiness; pings DB, 503 if unreachable |
| GET | `/` | — | welcome message |
| POST | `/api/auth/register` | — | 201; 400 on duplicate email/username |
| POST | `/api/auth/login` | — | username-or-email; `remember_me` → 7d else 24h |
| POST | `/api/auth/login/access-token` | — | OAuth2 form-encoded variant |
| POST | `/api/auth/refresh-token` | — | rotates: revokes old, issues new |
| POST | `/api/auth/logout` | — | revokes one refresh token |
| POST | `/api/auth/logout-all-devices` | Bearer | revokes all user tokens |
| GET | `/api/auth/me` | Bearer | current user |
| PUT | `/api/auth/me` | Bearer | update profile / password |

Documents + upload (Phase 1, all require Bearer auth):

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/upload` | multipart `file`; 201 Document; 400 unsupported ext; 413 too large |
| GET | `/api/documents` | `skip`, `limit`, `owned_only` (default true); superuser + `owned_only=false` → all |
| GET | `/api/documents/favorites` | user's favorite documents |
| GET | `/api/documents/{id}` | 404 not found / 403 not owner |
| DELETE | `/api/documents/{id}` | 204; deletes file + row (CASCADE) |
| GET | `/api/documents/{id}/download` | streams the file; ignores any `filePath` query param |
| POST | `/api/documents/{id}/favorite` | body `{"favorite": bool}` → `{"success": true}` |
| GET | `/api/documents/{id}/extraction` | `{status, extraction_date, error, content_available}`; 404 if no extraction row |
| GET | `/api/documents/{id}/content` | extraction content JSON — flat structured PDF shape (`document_type`, `title`, `author`, `pages[]`) for PDFs, placeholder wrapper for non-PDF; not-completed → 200 `{status, message}`; no row → 404 |
| GET | `/api/documents/{id}/table-markdown` | requires completed extraction; `?page_number=N` → `{page, content}`, else `{pages: {N: md}}`; not-completed → 200 `{status, message}`; missing files → 404 |

Chat / RAG (Phase 4, all require Bearer auth):

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/chat` | body `{message, document_ids?, conversation_id?}` (`document_ids` accepts string[] or number[]); → `{response, sources, conversation_id}`; 403 if a referenced document isn't owned |
| GET | `/api/chat/sessions` | user's chat sessions, newest first |
| GET | `/api/chat/{conversationId}/history` | messages for the session; 404 if not found/owned |
| DELETE | `/api/chat/sessions/{conversationId}` | 204; CASCADE deletes messages |

Mounted at `/api/chat` (Python's `/api/api/chat` double-prefix bug is fixed).

Access control matches the Python backend: a user may act on their own
documents; a superuser may act on any.

Passwords are hashed with **argon2id** in passlib-compatible PHC format, so
hashes created by the previous Python service remain verifiable.

## Storage

`STORAGE_TYPE` selects the backend:
- `local` (default) — files under `LOCAL_STORAGE_PATH` (default `./uploads`),
  keyed `{base36-timestamp}_{original-filename}`. Streamed via `io.Copy`.
- `s3` — objects in `S3_BUCKET_NAME` (region/credentials from `S3_*` / `AWS_*`,
  else the default AWS credential chain). Streamed via the managed uploader.

Uploads are bounded by `MAX_UPLOAD_SIZE` (MB) using an `io.LimitReader`, so an
oversized file is rejected (413) rather than buffered.

### Smoke-test upload + download with curl

```bash
# 1. Register + login to get an access token.
curl -s -X POST localhost:8000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"demo","email":"demo@example.com","password":"Str0ngPass"}'

TOKEN=$(curl -s -X POST localhost:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"demo","password":"Str0ngPass"}' | jq -r .access_token)

# 2. Upload a file (multipart field must be named "file").
echo "col1,col2
1,2" > sample.csv
curl -s -X POST localhost:8000/api/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@sample.csv"          # → 201 with Document JSON (note the "id")

# 3. List, then download by id (replace 1 with the returned id).
curl -s localhost:8000/api/documents -H "Authorization: Bearer $TOKEN"
curl -s localhost:8000/api/documents/1/download -H "Authorization: Bearer $TOKEN" -o out.csv
diff sample.csv out.csv && echo "round-trip OK"

# 4. With the worker running, within ~1-2s the document is processed.
#    Extraction status should report completed + content_available=true.
curl -s localhost:8000/api/documents/1/extraction -H "Authorization: Bearer $TOKEN"
# {"status":"completed","content_available":true, ...}
curl -s localhost:8000/api/documents/1 -H "Authorization: Bearer $TOKEN"
# {... "status":"processed","processed":true ...}
curl -s localhost:8000/api/documents/1/content -H "Authorization: Bearer $TOKEN"
# {"metadata":{...},"content":{"message":"Extraction deferred to Phase 3"},"extraction_status":"placeholder"}
```

## Tests

```bash
go build ./...                                   # compiles all packages
go test ./...                                    # unit tests (no DB needed)

# End-to-end tests: auth flow, document lifecycle, job/worker, and PDF
# extraction. Needs a reachable database; the test applies the Go migrations
# itself. The PDF extraction test additionally needs poppler on PATH
# (`brew install poppler`); it skips gracefully if poppler is absent.
TEST_DATABASE_URL=postgres://user:pass@localhost:5432/documentManager \
  go test -tags=integration ./test/integration/...
```

## Regenerating repository code

```bash
sqlc generate    # regenerates internal/repository/*.sql.go from queries/
```
