package s3

import (
	"context"

	"github.com/aws/aws-sdk-go-v2/service/s3/internal/customizations"
	"github.com/aws/smithy-go/middleware"
)

// putBucketContextMiddleware stores the input bucket name within the request context (if
// present) which is required for a variety of custom S3 behaviors
type putBucketContextMiddleware struct{}

func (*putBucketContextMiddleware) ID() string {
	return "putBucketContext"
}

func (m *putBucketContextMiddleware) HandleSerialize(
	ctx context.Context, in middleware.SerializeInput, next middleware.SerializeHandler,
) (
	out middleware.SerializeOutput, metadata middleware.Metadata, err error,
) {
	if bucket, ok := m.bucketFromInput(in.Parameters); ok {
		ctx = customizations.SetBucket(ctx, bucket)
	}
	return next.HandleSerialize(ctx, in)
}

func (m *putBucketContextMiddleware) bucketFromInput(params interface{}) (string, bool) {
	v, ok := params.(bucketer)
	if !ok {
		return "", false
	}

	return v.bucket()
}

func addPutBucketContextMiddleware(stack *middleware.Stack) error {
	// This is essentially a post-Initialize task - only run it once the input
	// has received all modifications from that phase. Therefore we add it as
	// an early Serialize step.
	//
	// FUTURE: it would be nice to have explicit phases that only we as SDK
	// authors can hook into (such as between phases like this really should
	// be)
	return stack.Serialize.Add(&putBucketContextMiddleware{}, middleware.Before)
}
