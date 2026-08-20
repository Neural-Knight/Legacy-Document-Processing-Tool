package storage

import (
	"context"
	"errors"
	"fmt"
	"io"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/feature/s3/manager"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"

	appconfig "github.com/legacy-document-processing-tool/backend/internal/config"
)

// S3Storage stores objects in an AWS S3 bucket, streaming both directions.
type S3Storage struct {
	client   *s3.Client
	uploader *manager.Uploader
	bucket   string
}

// NewS3Storage builds an S3-backed store from config (bucket, region,
// credentials), mirroring the Python S3StorageService.
func NewS3Storage(cfg *appconfig.Config) (*S3Storage, error) {
	if cfg.S3BucketName == "" {
		return nil, fmt.Errorf("S3_BUCKET_NAME is required when STORAGE_TYPE=s3")
	}

	opts := []func(*awsconfig.LoadOptions) error{}
	if cfg.S3Region != "" {
		opts = append(opts, awsconfig.WithRegion(cfg.S3Region))
	}
	// Use explicit static credentials when provided; otherwise fall back to the
	// default AWS credential chain (env, shared config, IAM role, etc.).
	if cfg.AWSAccessKeyID != "" && cfg.AWSSecretAccessKey != "" {
		opts = append(opts, awsconfig.WithCredentialsProvider(
			credentials.NewStaticCredentialsProvider(cfg.AWSAccessKeyID, cfg.AWSSecretAccessKey, ""),
		))
	}

	awsCfg, err := awsconfig.LoadDefaultConfig(context.Background(), opts...)
	if err != nil {
		return nil, fmt.Errorf("load aws config: %w", err)
	}

	client := s3.NewFromConfig(awsCfg)
	return &S3Storage{
		client:   client,
		uploader: manager.NewUploader(client),
		bucket:   cfg.S3BucketName,
	}, nil
}

// Upload streams r to s3://bucket/key using the managed uploader (which handles
// multipart streaming without buffering the whole object in memory).
func (s *S3Storage) Upload(ctx context.Context, key string, r io.Reader, size int64, contentType string) (Metadata, error) {
	in := &s3.PutObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
		Body:   r,
	}
	if contentType != "" {
		in.ContentType = aws.String(contentType)
	}
	if _, err := s.uploader.Upload(ctx, in); err != nil {
		return Metadata{}, fmt.Errorf("s3 upload: %w", err)
	}

	// The managed uploader does not report bytes written; when the caller knows
	// the size (from the multipart header) it is passed through, else -1.
	return Metadata{
		Filename:    key,
		FilePath:    key,
		FileSize:    size,
		FileType:    contentType,
		ContentType: contentType,
	}, nil
}

// Download opens the object body for streaming reads.
func (s *S3Storage) Download(ctx context.Context, key string) (io.ReadCloser, error) {
	out, err := s.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		var nsk *types.NoSuchKey
		if errors.As(err, &nsk) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("s3 get: %w", err)
	}
	return out.Body, nil
}

// Delete removes the object; S3 delete is idempotent for missing keys.
func (s *S3Storage) Delete(ctx context.Context, key string) error {
	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return fmt.Errorf("s3 delete: %w", err)
	}
	return nil
}
