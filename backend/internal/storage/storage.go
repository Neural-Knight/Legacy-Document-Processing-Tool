// Package storage abstracts object storage behind an ObjectStorage interface,
// with local-filesystem and S3 implementations. It streams data (io.Copy)
// rather than buffering whole files in memory.
package storage

import (
	"context"
	"fmt"
	"io"
	"strings"

	"github.com/legacy-document-processing-tool/backend/internal/config"
)

// Metadata describes a stored object after a successful upload.
type Metadata struct {
	Filename    string // storage-side name (unique_id + "_" + original)
	FilePath    string // key/relative path used to retrieve the object
	FileSize    int64  // bytes actually written
	FileType    string // content type
	ContentType string // alias of FileType, kept for clarity at call sites
}

// ObjectStorage is the storage abstraction used by the documents service.
type ObjectStorage interface {
	// Upload streams r (at most `size` bytes are meaningful; size may be <=0 if
	// unknown) into the object identified by key, returning its metadata.
	Upload(ctx context.Context, key string, r io.Reader, size int64, contentType string) (Metadata, error)
	// Download opens the object for streaming reads. Caller must Close it.
	Download(ctx context.Context, key string) (io.ReadCloser, error)
	// Delete removes the object. Deleting a missing object is not an error.
	Delete(ctx context.Context, key string) error
}

// ErrNotFound is returned by Download when the object does not exist.
var ErrNotFound = fmt.Errorf("object not found")

// New returns the storage backend selected by STORAGE_TYPE ("local" | "s3").
// Defaults to local.
func New(cfg *config.Config) (ObjectStorage, error) {
	switch strings.ToLower(cfg.StorageType) {
	case "s3":
		return NewS3Storage(cfg)
	case "local", "":
		return NewLocalStorage(cfg.LocalStoragePath)
	default:
		return nil, fmt.Errorf("unknown STORAGE_TYPE %q (expected 'local' or 's3')", cfg.StorageType)
	}
}
