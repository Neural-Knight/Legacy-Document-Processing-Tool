# Backend (Go)

Go rewrite of the Legacy Document Processing Tool backend — a modular monolith
using chi, pgx/v5 + pgxpool, sqlc, log/slog, golang-jwt, and argon2.

This is **Phase 0**: foundation, health probes, and full auth parity with the
old Python/FastAPI service. Documents, upload, extraction, RAG, and the worker
are intentionally not implemented yet (see `../MIGRATION.md`).

## Layout

```
backend/
├── cmd/
│   ├── api/                 # HTTP server entrypoint
│   └── migrate/             # migration runner (golang-migrate)
├── internal/
│   ├── config/              # env-based configuration
│   ├── auth/                # argon2 hashing, JWT, refresh-token service
│   ├── api/
│   │   ├── router.go        # chi routes
│   │   ├── middleware/      # request id, logging, CORS, recovery
│   │   └── handlers/        # auth + health handlers, auth middleware
│   └── repository/          # sqlc-generated queries + Migrate() helper
├── migrations/              # golang-migrate SQL (embedded); schema source of truth
├── test/integration/        # end-to-end auth tests (build tag: integration)
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

## Run locally

```bash
# 1. Apply the database schema (Go migrations, against an empty database).
DATABASE_URL=postgresql://user:pass@localhost:5432/documentManager \
  go run ./cmd/migrate

# 2. Start the API.
cp .env.example .env   # then edit values
go run ./cmd/api
```

The server listens on `:8000` and the frontend continues to call
`http://localhost:8000/api`.

## Run with Docker

```bash
# Requires POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB / SECRET_KEY in the
# environment or an .env file next to docker-compose.yml.
docker compose up --build

# Clean slate (drop volumes, re-migrate from empty):
docker compose down -v && docker compose up --build
```

Compose brings up Postgres, runs the Go `migrate` binary via the `migrate`
service (which exits 0 on success), then starts the Go API on `:8000`.

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

## Endpoints (Phase 0)

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

Passwords are hashed with **argon2id** in passlib-compatible PHC format, so
hashes created by the previous Python service remain verifiable.

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
