package s3

// This contains helper methods to set resolver URI into the context object. If they are ever used for
// something other than S3, they should be moved to internal/context/context.go

import (
	"context"

	"github.com/aws/smithy-go/middleware"
)

type s3resolvedURI struct{}

// setS3ResolvedURI sets the URI as resolved by the EndpointResolverV2
func setS3ResolvedURI(ctx context.Context, value string) context.Context {
	return middleware.WithStackValue(ctx, s3resolvedURI{}, value)
}

// getS3ResolvedURI gets the URI as resolved by EndpointResolverV2
func getS3ResolvedURI(ctx context.Context) string {
	v, _ := middleware.GetStackValue(ctx, s3resolvedURI{}).(string)
	return v
}
