package context

import (
	"context"
	"time"

	"github.com/aws/smithy-go/middleware"
)

type s3BackendKey struct{}
type checksumInputAlgorithmKey struct{}
type clockSkew struct{}

const (
	// S3BackendS3Express identifies the S3Express backend
	S3BackendS3Express = "S3Express"
)

// SetS3Backend stores the resolved endpoint backend within the request
// context, which is required for a variety of custom S3 behaviors.
func SetS3Backend(ctx context.Context, typ string) context.Context {
	return middleware.WithStackValue(ctx, s3BackendKey{}, typ)
}

// GetS3Backend retrieves the stored endpoint backend within the context.
func GetS3Backend(ctx context.Context) string {
	v, _ := middleware.GetStackValue(ctx, s3BackendKey{}).(string)
	return v
}

// SetChecksumInputAlgorithm sets the request checksum algorithm on the
// context.
func SetChecksumInputAlgorithm(ctx context.Context, value string) context.Context {
	return middleware.WithStackValue(ctx, checksumInputAlgorithmKey{}, value)
}

// GetChecksumInputAlgorithm returns the checksum algorithm from the context.
func GetChecksumInputAlgorithm(ctx context.Context) string {
	v, _ := middleware.GetStackValue(ctx, checksumInputAlgorithmKey{}).(string)
	return v
}

// SetAttemptSkewContext sets the clock skew value on the context
func SetAttemptSkewContext(ctx context.Context, v time.Duration) context.Context {
	return middleware.WithStackValue(ctx, clockSkew{}, v)
}

// GetAttemptSkewContext gets the clock skew value from the context
func GetAttemptSkewContext(ctx context.Context) time.Duration {
	x, _ := middleware.GetStackValue(ctx, clockSkew{}).(time.Duration)
	return x
}
