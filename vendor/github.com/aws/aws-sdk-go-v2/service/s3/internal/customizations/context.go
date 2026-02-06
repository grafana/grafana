package customizations

import (
	"context"

	"github.com/aws/smithy-go/middleware"
)

type bucketKey struct{}

// SetBucket stores a bucket name within the request context, which is required
// for a variety of custom S3 behaviors.
func SetBucket(ctx context.Context, bucket string) context.Context {
	return middleware.WithStackValue(ctx, bucketKey{}, bucket)
}

// GetBucket retrieves a stored bucket name within a context.
func GetBucket(ctx context.Context) string {
	v, _ := middleware.GetStackValue(ctx, bucketKey{}).(string)
	return v
}
