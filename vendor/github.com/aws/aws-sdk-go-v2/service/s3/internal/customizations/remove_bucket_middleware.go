package customizations

import (
	"context"
	"fmt"

	awsmiddleware "github.com/aws/aws-sdk-go-v2/aws/middleware"
	"github.com/aws/smithy-go/middleware"
	"github.com/aws/smithy-go/transport/http"
)

// removeBucketFromPathMiddleware needs to be executed after serialize step is performed
type removeBucketFromPathMiddleware struct {
}

func (m *removeBucketFromPathMiddleware) ID() string {
	return "S3:RemoveBucketFromPathMiddleware"
}

func (m *removeBucketFromPathMiddleware) HandleSerialize(
	ctx context.Context, in middleware.SerializeInput, next middleware.SerializeHandler,
) (
	out middleware.SerializeOutput, metadata middleware.Metadata, err error,
) {
	if !awsmiddleware.GetRequiresLegacyEndpoints(ctx) {
		return next.HandleSerialize(ctx, in)
	}

	// check if a bucket removal from HTTP path is required
	bucket, ok := getRemoveBucketFromPath(ctx)
	if !ok {
		return next.HandleSerialize(ctx, in)
	}

	req, ok := in.Request.(*http.Request)
	if !ok {
		return out, metadata, fmt.Errorf("unknown request type %T", req)
	}

	removeBucketFromPath(req.URL, bucket)
	return next.HandleSerialize(ctx, in)
}

type removeBucketKey struct {
	bucket string
}

// setBucketToRemoveOnContext sets the bucket name to be removed.
//
// Scoped to stack values. Use github.com/aws/smithy-go/middleware#ClearStackValues
// to clear all stack values.
func setBucketToRemoveOnContext(ctx context.Context, bucket string) context.Context {
	return middleware.WithStackValue(ctx, removeBucketKey{}, bucket)
}

// getRemoveBucketFromPath returns the bucket name to remove from the path.
//
// Scoped to stack values. Use github.com/aws/smithy-go/middleware#ClearStackValues
// to clear all stack values.
func getRemoveBucketFromPath(ctx context.Context) (string, bool) {
	v, ok := middleware.GetStackValue(ctx, removeBucketKey{}).(string)
	return v, ok
}
