# Backend

Go HTTP API and background worker for the Legacy Document Processing Tool.

This service replaced a Python/FastAPI backend while preserving `/api` routes, JSON response shapes, and status codes expected by the React frontend. Schema and migrations are managed entirely in Go.

## Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| HTTP router | [chi](https://github.com/go-chi/chi) | Lightweight, stdlib-friendly, explicit middleware chain |
| Database | PostgreSQL 14+ via [pgx/v5](https://github.com/jackc/pgx) | Same database as the Python app; connection pooling built in |
| Queries | [sqlc](https://sqlc.dev/) | Type-safe SQL from annotated queries; no ORM |
| Migrations | [golang-migrate](https://github.com/golang-migrate/migrate) | Embedded SQL migrations; no Alembic or Python migrate step |
| Auth | HS256 JWT + DB-backed refresh tokens | Matches prior API contract; refresh rotation on every use |
| Passwords | argon2id (PHC string) | Compatible with passlib hashes from the Python service |
| Logging | `log/slog` | Structured JSON logs in Docker |

## Processes

Two binaries share one codebase and one database:

| Binary | Entry | Role |
|--------|-------|------|
| **api** | `cmd/api` | Serves HTTP on `:8000` — auth, documents, chat |
| **worker** | `cmd/worker` | Polls `processing_jobs`, runs PDF extraction and indexing |
| **migrate** | `cmd/migrate` | Applies embedded SQL migrations, then exits |

In Docker Compose, `migrate` runs once on startup; `api` and `worker` stay running.

## Project layout

```
backend/
├── cmd/
│   ├── api/              HTTP server
│   ├── worker/           Job processor
│   └── migrate/          Migration runner
├── internal/
│   ├── api/              Router, middleware, handlers
│   ├── auth/             JWT, refresh tokens, argon2
│   ├── config/           Environment configuration
│   ├── documents/        Upload, list, delete, favorites
│   ├── jobs/             Enqueue, cancel, backoff schedule
│   ├── worker/           Queue polling, job claiming, processor
│   ├── extraction/       PDF pipeline (poppler, OCR, Gemini tables)
│   ├── md2sql/           Markdown tables → dynamic SQL tables
│   ├── indexer/          Extraction JSON → vector_entries chunks
│   ├── rag/              Retrieval + answer generation
│   ├── gemini/           Gemini REST client (chat)
│   ├── storage/          Local filesystem or S3
│   └── repository/       sqlc-generated queries
├── migrations/           golang-migrate SQL (embedded)
├── test/integration/     End-to-end tests (build tag: integration)
└── docker-compose.yml    db + migrate + api + worker
```

## Document processing pipeline

Upload does not block on extraction.

```
POST /api/upload
  → store file (local or S3)
  → insert documents row (status=uploaded)
  → enqueue processing_jobs (idempotency_key=doc:{id})
  → return 201

worker loop
  → claim oldest due job (FOR UPDATE SKIP LOCKED)
  → set document status=processing
  → extract → store extractions row
  → index vector_entries
  → set document status=processed
```

**Job queue design**

Jobs live in Postgres, not Redis. This avoids an extra dependency for a single-tenant or small deployment. Claiming uses row-level locking so multiple worker replicas are safe. Failed jobs retry with backoff (30s → 2m → 10m) until `max_attempts`, then mark the document `error`. Jobs locked longer than `JOB_LOCK_TIMEOUT_MINUTES` are reclaimed if a worker crashes mid-run.

**PDF extraction** (`internal/extraction`)

1. Per-page text via poppler `pdftotext`
2. Pages with very little text are treated as scanned; optional `tesseract` OCR via `pdftoppm` render
3. Optional Gemini table extraction per page when `GEMINI_KEYS` is set
4. Artifacts written under `{LOCAL_STORAGE_PATH}/extractions/doc_{id}/...`
5. Table markdown loaded into dynamic SQL tables via `md2sql` (failures are logged, not fatal)
6. Flat structured JSON stored in `extractions.content` for `GET /api/documents/{id}/content`

Non-PDF uploads receive a placeholder extraction wrapper until dedicated parsers exist.

**Indexing and chat**

After extraction, the worker chunks text into `vector_entries` (character windows with overlap, plus metadata chunks for title and tables). The `vector` column exists for future embedding storage but is currently NULL.

Chat flow (`POST /api/chat`):

1. Validate the user owns referenced documents
2. Create or resume a `chat_sessions` row
3. Retrieve top chunks by **keyword overlap** (not cosine similarity)
4. Call Gemini with retrieved context, or return a template concatenation of chunks if Gemini is disabled or fails
5. Persist user and assistant messages

The frontend Query Agent calls this endpoint. Session tabs may be cached in IndexedDB for UI convenience; the backend is the source of truth for messages when using the API directly.

## Configuration

Copy `.env.example` to `.env`. The API refuses to start without `SECRET_KEY` (tokens would invalidate on every restart if it were random).

### Required

| Variable | Description |
|----------|-------------|
| `SECRET_KEY` | JWT signing secret (stable across restarts) |
| `DATABASE_URL` | Postgres DSN (or set `POSTGRES_*` components) |

### Common optional

| Variable | Default | Description |
|----------|---------|-------------|
| `API_V1_STR` | `/api` | Route prefix |
| `PORT` | `8000` | API listen port |
| `BACKEND_CORS_ORIGINS` | `http://localhost:3000,...` | CORS allowlist |
| `MAX_UPLOAD_SIZE` | `50` | Upload limit (MB) |
| `STORAGE_TYPE` | `local` | `local` or `s3` |
| `LOCAL_STORAGE_PATH` | `./uploads` | Local storage root |

### Worker

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_CONCURRENT_JOBS` | `2` | Parallel jobs per worker process |
| `JOB_POLL_INTERVAL_MS` | `1000` | Queue poll interval |
| `JOB_LOCK_TIMEOUT_MINUTES` | `120` | Stale lock reclaim (long PDFs) |
| `OCR_LANGUAGE` | `eng` | tesseract language |
| `MAX_PAGE_WORKERS` | `4` | Per-document page concurrency |

### Gemini

Used by **both** the worker (table extraction) and the API (chat answers).

| Variable | Default | Description |
|----------|---------|-------------|
| `GEMINI_KEYS` | *(empty)* | Space-separated keys; `AQ.` AI Studio format is supported |
| `GEMINI_MODEL` | `gemini-3.6-flash` | Table extraction model |
| `CHAT_MODEL` | `gemini-3.6-flash` | Chat answer model |

Keys are sent in the `x-goog-api-key` header, not in the URL.

If Gemini returns `404 NOT_FOUND`, the model name may have been retired for your account. List models via the Generative Language API and update both variables in `.env`.

**Docker Compose gotcha:** if you `export CHAT_MODEL=...` in your shell, it can override `.env` when Compose substitutes `${VAR}`. Model settings are loaded from `env_file` only. Run:

```bash
unset CHAT_MODEL GEMINI_MODEL
docker compose --env-file .env up -d --build
docker compose exec backend printenv CHAT_MODEL GEMINI_MODEL
```

### Indexing

| Variable | Default | Description |
|----------|---------|-------------|
| `CHUNK_SIZE` | `1000` | Characters per chunk |
| `CHUNK_OVERLAP` | `200` | Overlap between chunks |

## Run locally

### Docker (recommended)

```bash
cp .env.example .env
# edit POSTGRES_*, SECRET_KEY, GEMINI_*

unset CHAT_MODEL GEMINI_MODEL
docker compose --env-file .env up --build -d
docker compose down          # stop
docker compose down -v       # stop and delete volumes
```

Services: Postgres `:5432`, API `:8000`, worker (no exposed port).

### Native

Requires Postgres reachable at `DATABASE_URL`, plus `poppler-utils` and optionally `tesseract` on PATH for PDF tests.

```bash
cp .env.example .env

# Apply migrations
go run ./cmd/migrate

# Terminal 1 — API
go run ./cmd/api

# Terminal 2 — worker
go run ./cmd/worker
```

Go does not load `.env` automatically when running binaries directly; export variables or use a tool like `direnv`.

## Local end-to-end test (with frontend)

```bash
# Backend
cd backend
cp .env.example .env
unset CHAT_MODEL GEMINI_MODEL
docker compose --env-file .env up --build -d

# Frontend
cd ../frontend
cp .env.example .env.local
npm install
npm run dev    # http://localhost:3000
```

In the browser: register → upload a PDF → wait for **processed** → open viewer → ask a question in Query Agent.

## API reference

All authenticated routes expect `Authorization: Bearer <access_token>`.

### Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness |
| GET | `/ready` | Readiness (DB ping) |

### Auth

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | JSON login; returns access + refresh tokens |
| POST | `/api/auth/login/access-token` | Form-encoded variant (Swagger UI) |
| POST | `/api/auth/refresh-token` | Rotate refresh token |
| POST | `/api/auth/logout` | Revoke refresh token |
| POST | `/api/auth/logout-all-devices` | Revoke all refresh tokens (Bearer) |
| GET | `/api/auth/me` | Current user |
| PUT | `/api/auth/me` | Update profile or password |

### Documents

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/upload` | Multipart field `file` |
| GET | `/api/documents` | List (`skip`, `limit`, `owned_only`) |
| GET | `/api/documents/favorites` | Favorites |
| GET | `/api/documents/{id}` | Metadata + processing status |
| DELETE | `/api/documents/{id}` | Delete file and row |
| GET | `/api/documents/{id}/download` | Stream original file |
| POST | `/api/documents/{id}/favorite` | Toggle favorite |
| GET | `/api/documents/{id}/extraction` | Extraction status summary |
| GET | `/api/documents/{id}/content` | Structured extraction JSON |
| GET | `/api/documents/{id}/table-markdown` | Table markdown (`?page_number=N` optional) |

### Chat

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/chat` | `{message, document_ids?, conversation_id?}` |
| GET | `/api/chat/sessions` | List sessions |
| GET | `/api/chat/{id}/history` | Messages for session |
| DELETE | `/api/chat/sessions/{id}` | Delete session |

Access control: users see only their own documents; superusers can access all documents when `owned_only=false` on list.

## Storage

`STORAGE_TYPE=local` stores files under `LOCAL_STORAGE_PATH` with a timestamp-prefixed filename. Upload size is capped with `io.LimitReader` before buffering.

`STORAGE_TYPE=s3` uses the AWS SDK default credential chain. Upload and download stream through the SDK; large files are not fully buffered in memory.

**Known gap:** PDF extraction reads from the local filesystem path. Documents stored only in S3 are not yet downloaded into the worker for extraction.

## Migrations

SQL files live in `migrations/` and are embedded into the migrate binary.

```bash
go run ./cmd/migrate

# Or with the migrate CLI:
migrate -path migrations -database "$DATABASE_URL" up
migrate -path migrations -database "$DATABASE_URL" down 1
```

After changing schema, update `internal/repository/schema.sql` and run `sqlc generate`.

Current migrations:

| Version | Purpose |
|---------|---------|
| 000001 | Core tables (users, documents, extractions, chat, vector_entries, …) |
| 000002 | `processing_jobs` queue |
| 000003 | `tables_metadata` for md2sql |
| 000004 | Chat/indexing adjustments |

## Tests

```bash
go build ./...
go test ./...

# Integration (requires Postgres + poppler for PDF tests)
TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/documentManager \
  go test -tags=integration ./test/integration/... -count=1
```

Integration tests apply migrations to the target database and create isolated test users per run.

Golden PDF fixture: `test/testdata/extraction/` — see that folder for regeneration instructions.

### curl smoke test

```bash
# Register + login
curl -s -X POST localhost:8000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"demo","email":"demo@example.com","password":"Str0ngPass"}'

TOKEN=$(curl -s -X POST localhost:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"demo","password":"Str0ngPass"}' | jq -r .access_token)

# Upload (field name must be "file")
curl -s -X POST localhost:8000/api/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test/testdata/extraction/sample_text.pdf"
```

## Operational notes

- **Scaling workers:** run additional `cmd/worker` processes or Compose replicas; queue locking prevents duplicate processing
- **Logs:** `docker compose logs -f backend worker`
- **Gemini errors:** worker logs table extraction failures; API logs chat LLM failures at WARN before template fallback
- **Not yet implemented:** pgvector embeddings, HTTP rate limiting, S3-aware extraction download

## Regenerating repository code

```bash
sqlc generate    # regenerates internal/repository/*.sql.go from queries/
```

## Related docs

- [../README.md](../README.md) — project overview and quick start
- [../MIGRATION.md](../MIGRATION.md) — Python→Go migration checklist
- [../frontend/.env.example](../frontend/.env.example) — frontend API URL
