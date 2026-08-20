package storage

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
)

// LocalStorage stores objects on the local filesystem under rootPath. The
// object key is a path relative to rootPath (matching the Python
// LocalStorageService, which stored just the filename as the relative path).
type LocalStorage struct {
	rootPath string
}

// NewLocalStorage creates the root directory if needed and returns the backend.
func NewLocalStorage(rootPath string) (*LocalStorage, error) {
	if rootPath == "" {
		rootPath = "./uploads"
	}
	if err := os.MkdirAll(rootPath, 0o755); err != nil {
		return nil, fmt.Errorf("create storage root: %w", err)
	}
	return &LocalStorage{rootPath: rootPath}, nil
}

// Upload streams r to <root>/<key> via io.Copy (no full-file buffering) and
// reports the number of bytes written.
func (s *LocalStorage) Upload(ctx context.Context, key string, r io.Reader, size int64, contentType string) (Metadata, error) {
	full := s.fullPath(key)
	if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
		return Metadata{}, fmt.Errorf("create dir: %w", err)
	}

	f, err := os.Create(full)
	if err != nil {
		return Metadata{}, fmt.Errorf("create file: %w", err)
	}
	written, copyErr := io.Copy(f, r)
	closeErr := f.Close()
	if copyErr != nil {
		_ = os.Remove(full) // best-effort cleanup of a partial write
		return Metadata{}, fmt.Errorf("write file: %w", copyErr)
	}
	if closeErr != nil {
		return Metadata{}, fmt.Errorf("close file: %w", closeErr)
	}

	return Metadata{
		Filename:    filepath.Base(key),
		FilePath:    key,
		FileSize:    written,
		FileType:    contentType,
		ContentType: contentType,
	}, nil
}

// Download opens <root>/<key> for reading.
func (s *LocalStorage) Download(ctx context.Context, key string) (io.ReadCloser, error) {
	f, err := os.Open(s.fullPath(key))
	if err != nil {
		if os.IsNotExist(err) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return f, nil
}

// Delete removes <root>/<key>; a missing file is not an error.
func (s *LocalStorage) Delete(ctx context.Context, key string) error {
	err := os.Remove(s.fullPath(key))
	if err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

func (s *LocalStorage) fullPath(key string) string {
	return filepath.Join(s.rootPath, filepath.Clean("/"+key))
}
