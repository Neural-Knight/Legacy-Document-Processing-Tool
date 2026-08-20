// Package config loads application configuration from environment variables.
//
// Env var names mirror the Python backend's pydantic settings so the same
// .env works for both: POSTGRES_* / DATABASE_URL, SECRET_KEY, API prefix, etc.
package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

// Config holds all runtime configuration.
type Config struct {
	// API
	APIPrefix   string // matches Python API_V1_STR, default "/api"
	ProjectName string
	Host        string
	Port        string

	// Security
	SecretKey                string
	Algorithm                string // JWT signing alg, "HS256"
	AccessTokenExpireMinutes int
	RefreshTokenExpireDays   int

	// Database
	DatabaseURL string

	// CORS
	CORSOrigins []string

	// Uploads (parsed now for parity; enforced in later phases)
	MaxUploadSizeMB int
}

// Load reads configuration from the environment, applying defaults that match
// the Python backend. It returns an error only for values it cannot recover.
func Load() (*Config, error) {
	c := &Config{
		APIPrefix:                getEnv("API_V1_STR", "/api"),
		ProjectName:              getEnv("PROJECT_NAME", "Document Management System"),
		Host:                     getEnv("HOST", "0.0.0.0"),
		Port:                     getEnv("PORT", "8000"),
		SecretKey:                os.Getenv("SECRET_KEY"),
		Algorithm:                getEnv("ALGORITHM", "HS256"),
		AccessTokenExpireMinutes: getEnvInt("ACCESS_TOKEN_EXPIRE_MINUTES", 30),
		RefreshTokenExpireDays:   getEnvInt("REFRESH_TOKEN_EXPIRE_DAYS", 7),
		MaxUploadSizeMB:          getEnvInt("MAX_UPLOAD_SIZE", 50),
	}

	c.DatabaseURL = resolveDatabaseURL()
	if c.DatabaseURL == "" {
		return nil, fmt.Errorf("database configuration missing: set DATABASE_URL or POSTGRES_* env vars")
	}

	// SECRET_KEY must be provided explicitly. The Python default generated a
	// random key per restart, which invalidated all tokens on every boot; we
	// treat that as a misconfiguration and fail fast.
	if c.SecretKey == "" {
		return nil, fmt.Errorf("SECRET_KEY is required and must be set explicitly")
	}

	c.CORSOrigins = parseCORS(getEnv("BACKEND_CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"))

	return c, nil
}

// LoadForMigrate loads only the configuration the migrate command needs (the
// database URL), without requiring SECRET_KEY or other API settings.
func LoadForMigrate() (*Config, error) {
	c := &Config{DatabaseURL: resolveDatabaseURL()}
	if c.DatabaseURL == "" {
		return nil, fmt.Errorf("database configuration missing: set DATABASE_URL or POSTGRES_* env vars")
	}
	return c, nil
}

// resolveDatabaseURL prefers an explicit DATABASE_URL, otherwise assembles one
// from POSTGRES_* parts exactly like the Python Settings.DATABASE_URL property.
func resolveDatabaseURL() string {
	if url := os.Getenv("DATABASE_URL"); url != "" {
		return url
	}
	server := os.Getenv("POSTGRES_SERVER")
	user := os.Getenv("POSTGRES_USER")
	password := os.Getenv("POSTGRES_PASSWORD")
	db := os.Getenv("POSTGRES_DB")
	if server == "" || user == "" || db == "" {
		return ""
	}
	port := getEnv("POSTGRES_PORT", "5432")
	return fmt.Sprintf("postgresql://%s:%s@%s:%s/%s", user, password, server, port, db)
}

func parseCORS(raw string) []string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}
	// Support JSON-array style ["a","b"] as well as comma-separated, matching
	// the Python assemble_cors_origins validator.
	if strings.HasPrefix(raw, "[") {
		raw = strings.Trim(raw, "[]")
		raw = strings.ReplaceAll(raw, "\"", "")
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if v := strings.TrimSpace(p); v != "" {
			out = append(out, v)
		}
	}
	return out
}

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func getEnvInt(key string, def int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}
