# Backend (Go)

Go rewrite of the Legacy Document Processing Tool backend — a modular monolith
using chi, pgx/v5 + pgxpool, sqlc, log/slog, golang-jwt, and argon2.

Implemented so far (see `../MIGRATION.md`):
- **Phase 0/0b**: foundation, health probes, full auth parity, pure-Go migrations.
- **Phase 1**: document CRUD, favorites, streaming upload/download, local + S3
  storage.
- **Phase 2**: PostgreSQL-backed job queue + a dedicated worker process. Upload
  enqueues an extraction job; the worker claims it (`FOR UPDATE SKIP LOCKED`)
  and runs a **stub** processor that sets the document to `processed` and writes
  a placeholder extraction. Real PDF/table extraction is still deferred (Phase
  3); `/content` returns the placeholder, `/table-markdown` is still a 404 stub.

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
│   ├── worker/              # poll/claim runner + stub processor
│   ├── api/
│   │   ├── router.go        # chi routes
│   │   ├── middleware/      # request id, logging, CORS, recovery
│   │   └── handlers/        # auth, health, document handlers, auth middleware
│   └── repository/          # sqlc-generated queries + Migrate() helper
├── migrations/              # golang-migrate SQL (embedded); schema source of truth
├── test/integration/        # end-to-end auth + document + job/worker tests (build tag: integration)
├── Dockerfile               # Go multi-stage build (api + migrate binaries)
├── docker-compose.yml       # db + migrate (Go) + backend
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

## Architecture: async document processing

Upload no longer processes inline. Instead:

1. `POST /api/upload` stores the file, inserts the document (`status=uploaded`),
   enqueues a `processing_jobs` row (`idempotency_key = doc:{id}`), and returns
   201 immediately.
2. The **worker** (`cmd/worker`) polls the queue and claims the oldest due job
   with `UPDATE ... WHERE id = (SELECT ... FOR UPDATE SKIP LOCKED)`, so multiple
   workers never grab the same job. Concurrency is bounded by
   `MAX_CONCURRENT_JOBS`.
3. The Phase 2 **stub** processor sets `status=processing`, writes a placeholder
   `extractions` row (`status=completed`), then sets `status=processed,
   processed=true`. On failure the job retries with backoff (30s → 2m → 10m) up
   to `max_attempts`, then is marked `failed` and the document `status=error`.
4. Jobs locked longer than `JOB_LOCK_TIMEOUT_MINUTES` (a crashed worker) are
   reclaimed as `pending`. Deleting a document cancels its open jobs.

This replaces the Python backend's unsafe `asyncio.create_task(db_session)`,
which had no persistence, retries, or safe session handling.

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
| GET | `/api/documents/{id}/content` | extraction content JSON (placeholder until Phase 3); 404 if no row |
| GET | `/api/documents/{id}/table-markdown` | **stub** → 404 until Phase 3 |

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

# End-to-end auth flow (register → login → /me → refresh → logout).
# Needs a reachable database; the test applies the Go migrations itself.
TEST_DATABASE_URL=postgres://user:pass@localhost:5432/documentManager \
  go test -tags=integration ./test/integration/...
```

## Regenerating repository code

```bash
sqlc generate    # regenerates internal/repository/*.sql.go from queries/
```
