# ---- Build stage ----
FROM golang:1.26-alpine AS build

WORKDIR /src

# Cache module downloads.
COPY go.mod go.sum ./
RUN go mod download

# Build both binaries: the API server and the migration runner. Migrations are
# embedded into the migrate binary (see migrations/embed.go), so no SQL files
# need to ship in the runtime image.
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api && \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/migrate ./cmd/migrate

# ---- Runtime stage ----
FROM alpine:3.20

# TLS roots for any outbound HTTPS (e.g. future S3/Gemini); harmless otherwise.
RUN apk add --no-cache ca-certificates && adduser -D -u 10001 appuser

COPY --from=build /out/api /usr/local/bin/api
COPY --from=build /out/migrate /usr/local/bin/migrate

USER appuser
EXPOSE 8000

# Default to the API server; the compose migrate service overrides the command
# to run /usr/local/bin/migrate.
ENTRYPOINT ["/usr/local/bin/api"]
