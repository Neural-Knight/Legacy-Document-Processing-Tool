# ---- Build stage ----
FROM golang:1.26-alpine AS build

WORKDIR /src

# Cache module downloads.
COPY go.mod go.sum ./
RUN go mod download

# Build all three binaries: the API server, the migration runner, and the
# processing worker. Migrations are embedded into the migrate binary (see
# migrations/embed.go), so no SQL files need to ship in the runtime image.
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api && \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/migrate ./cmd/migrate && \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/worker ./cmd/worker

# ---- Runtime stage ----
FROM alpine:3.20

# ca-certificates: TLS roots for outbound HTTPS (Gemini API).
# poppler-utils: pdftotext/pdftoppm/pdfinfo — the worker's PDF text/render path.
# tesseract-ocr: OCR for scanned pages (optional; worker degrades if absent).
# NOTE: the Go OCR path shells out to `tesseract` on rendered page images; it
# does NOT use ocrmypdf (a deliberate simplification — see MIGRATION.md). If you
# later switch to the ocrmypdf pipeline, add the `ocrmypdf` package here.
# The API image doesn't need the extraction tools, but the worker (same image)
# does; they're small enough to include in the shared runtime.
RUN apk add --no-cache ca-certificates poppler-utils tesseract-ocr \
    && adduser -D -u 10001 appuser

COPY --from=build /out/api /usr/local/bin/api
COPY --from=build /out/migrate /usr/local/bin/migrate
COPY --from=build /out/worker /usr/local/bin/worker

# Local-storage upload directory (mounted as a volume in docker-compose).
# Owned by appuser so the non-root process can write to it.
RUN mkdir -p /app/uploads && chown -R appuser:appuser /app

WORKDIR /app
USER appuser
EXPOSE 8000

# Default to the API server; the compose migrate service overrides the command
# to run /usr/local/bin/migrate.
ENTRYPOINT ["/usr/local/bin/api"]
