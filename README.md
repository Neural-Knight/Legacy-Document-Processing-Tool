# Legacy Document Processing Tool

A document management application with PDF upload, asynchronous extraction, structured content viewing, and a Query Agent that answers questions over your uploaded documents.

The backend was rewritten from Python/FastAPI to Go while keeping the existing React frontend and `/api` contracts. The previous Python implementation is preserved on the `archive/python` branch for reference.

## What it does

- **Auth** — register, login, JWT access tokens, refresh-token rotation stored in Postgres
- **Documents** — upload, list, download, favorites, per-user access control
- **Processing** — uploads enqueue a background job; a worker extracts PDF text (poppler), optionally OCRs scanned pages (tesseract), optionally extracts tables (Gemini), and indexes content for search
- **Viewer** — frontend renders extracted JSON and table markdown from the API
- **Query Agent** — `POST /api/chat` retrieves relevant text chunks and generates an answer via Gemini (or a deterministic fallback when Gemini is unavailable)

## Repository layout

```
Legacy_Document_Processing_Tool/
├── backend/          Go API + worker + migrations (see backend/README.md)
├── frontend/         React + Vite + MUI SPA
├── MIGRATION.md      Python→Go migration tracker (historical execution log)
└── README.md         this file
```

## Architecture (high level)

```
Browser (React, :3000)
        │  HTTP  /api/*
        ▼
┌───────────────────────────────────────┐
│  Go API  (cmd/api, :8000)             │
│  auth · documents · chat              │
└───────────────┬───────────────────────┘
                │
        ┌───────┴────────┐
        ▼                ▼
   PostgreSQL      Object storage
   (schema +       (local disk or S3)
    job queue +
    chat + chunks)
                ▲
                │  claims jobs
        ┌───────┴───────────────────────┐
        │  Go worker  (cmd/worker)        │
        │  PDF extract · md2sql · index   │
        └───────────────────────────────┘
                │
                ▼
           Gemini API  (optional: tables + chat answers)
```

**Why API and worker are separate processes**

Upload returns immediately. Extraction can take seconds to minutes depending on page count, OCR, and Gemini calls. The worker polls a Postgres-backed job queue (`processing_jobs`) using `FOR UPDATE SKIP LOCKED`, so you can run multiple workers without double-processing the same job.

**Why keyword retrieval instead of vector search (for now)**

Chunks are stored in `vector_entries`, but the `vector` column is unused. Chat retrieval scores chunks by keyword overlap. This keeps the system working without pgvector setup. Semantic embeddings are planned as a follow-up.

## Quick start (local)

### Prerequisites

- Docker (recommended) or Postgres 14+ locally
- Node.js 18+ for the frontend
- Gemini API keys (optional; needed for table extraction and LLM chat answers)

### 1. Backend

```bash
cd backend
cp .env.example .env
# Edit .env: POSTGRES_*, SECRET_KEY, GEMINI_KEYS, GEMINI_MODEL, CHAT_MODEL

# Avoid shell exports overriding .env in Docker Compose
unset CHAT_MODEL GEMINI_MODEL

docker compose --env-file .env up --build -d
curl http://localhost:8000/health   # → {"status":"healthy"}
```

See [backend/README.md](backend/README.md) for native (non-Docker) setup, env reference, and API details.

**Gemini models:** Google periodically retires model names. If you see `404 NOT_FOUND` from Gemini, list available models for your key and set `GEMINI_MODEL` and `CHAT_MODEL` in `.env` (currently `gemini-3.6-flash` for new AI Studio accounts).

### 2. Frontend

```bash
cd frontend
cp .env.example .env.local    # optional; defaults to http://localhost:8000/api
npm install
npm run dev                   # http://localhost:3000
```

Vite proxies `/api` to `http://localhost:8000` during development.

### 3. Smoke test in the browser

1. Register and log in
2. Upload a PDF — wait until status is **processed**
3. Open the document viewer (content + tables tabs)
4. Query Agent — select the document and ask a question

If chat returns `"Here's what I found in the documents:"` verbatim, Gemini is not being used (missing keys, wrong model, or API error). Check `docker compose logs backend worker`.

### Stop the stack

```bash
cd backend
docker compose down           # keep DB + uploads
docker compose down -v        # wipe volumes (fresh database)
```

## Frontend notes

- **Dev:** `npm run dev` — use this for local work
- **Production build:** `npm run build` currently fails on pre-existing TypeScript strictness issues; fix those before shipping a production bundle
- Chat session tabs are cached in IndexedDB for UI state; answers come from the backend

## Backend notes

- Password hashes use **argon2id** in passlib-compatible PHC format, so users created by the old Python service can still log in
- Migrations are **golang-migrate** SQL embedded in the migrate binary — no Alembic, no Python runtime
- S3 storage is supported for uploads, but PDF extraction reads from local paths today; S3 + extraction together needs additional work
- HTTP rate limiting is not implemented in the Go backend

Full backend documentation: [backend/README.md](backend/README.md)
