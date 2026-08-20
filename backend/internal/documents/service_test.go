package documents

import (
	"bytes"
	"context"
	"errors"
	"io"
	"strings"
	"testing"

	"github.com/legacy-document-processing-tool/backend/internal/storage"
)

func TestIsValidExtension(t *testing.T) {
	valid := []string{"a.pdf", "b.PDF", "c.xlsx", "d.xls", "e.csv", "f.json", "g.xml", "path/to/h.Csv"}
	for _, f := range valid {
		if !IsValidExtension(f) {
			t.Errorf("expected %q to be valid", f)
		}
	}
	invalid := []string{"a.txt", "b.exe", "c", "d.docx", "e.png", ""}
	for _, f := range invalid {
		if IsValidExtension(f) {
			t.Errorf("expected %q to be invalid", f)
		}
	}
}

// fakeStore is an in-memory ObjectStorage for exercising the service without a
// real filesystem or S3.
type fakeStore struct {
	objects  map[string][]byte
	uploaded string
	deleted  []string
	failNext bool
}

func newFakeStore() *fakeStore { return &fakeStore{objects: map[string][]byte{}} }

func (f *fakeStore) Upload(ctx context.Context, key string, r io.Reader, size int64, contentType string) (storage.Metadata, error) {
	if f.failNext {
		return storage.Metadata{}, errors.New("boom")
	}
	b, err := io.ReadAll(r)
	if err != nil {
		return storage.Metadata{}, err
	}
	f.objects[key] = b
	f.uploaded = key
	return storage.Metadata{
		Filename:    key,
		FilePath:    key,
		FileSize:    int64(len(b)),
		FileType:    contentType,
		ContentType: contentType,
	}, nil
}

func (f *fakeStore) Download(ctx context.Context, key string) (io.ReadCloser, error) {
	b, ok := f.objects[key]
	if !ok {
		return nil, storage.ErrNotFound
	}
	return io.NopCloser(bytes.NewReader(b)), nil
}

func (f *fakeStore) Delete(ctx context.Context, key string) error {
	f.deleted = append(f.deleted, key)
	delete(f.objects, key)
	return nil
}

func TestUploadRejectsUnsupportedType(t *testing.T) {
	svc := NewService(nil, newFakeStore(), 50, nil)
	_, err := svc.Upload(context.Background(), 1, "notes.txt", "text/plain", strings.NewReader("hi"))
	if !errors.Is(err, ErrUnsupportedType) {
		t.Fatalf("expected ErrUnsupportedType, got %v", err)
	}
}

func TestUploadEnforcesSizeLimit(t *testing.T) {
	store := newFakeStore()
	// 1 MB limit; feed ~2 MB of data.
	svc := NewService(nil, store, 1, nil)
	big := bytes.Repeat([]byte("x"), 2*1024*1024)

	_, err := svc.Upload(context.Background(), 1, "big.csv", "text/csv", bytes.NewReader(big))
	if !errors.Is(err, ErrTooLarge) {
		t.Fatalf("expected ErrTooLarge, got %v", err)
	}
	// The oversized object must be cleaned up from storage.
	if len(store.deleted) == 0 {
		t.Fatal("expected oversized upload to be deleted from storage")
	}
}

func TestLimitTrackingReader(t *testing.T) {
	// The guard must flag reads strictly greater than max, and not at/under it.
	cases := []struct {
		name    string
		max     int64
		payload int
		want    bool
	}{
		{"under limit", 100, 50, false},
		{"exactly at limit", 100, 100, false},
		{"over limit", 100, 101, true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			src := bytes.NewReader(bytes.Repeat([]byte("z"), c.payload))
			// Mirror how Upload wraps the reader: LimitReader(max+1) + tracker.
			ltr := &limitTrackingReader{r: io.LimitReader(src, c.max+1), max: c.max}
			_, _ = io.ReadAll(ltr)
			if ltr.exceeded != c.want {
				t.Fatalf("payload=%d max=%d: exceeded=%v, want %v", c.payload, c.max, ltr.exceeded, c.want)
			}
		})
	}
}
