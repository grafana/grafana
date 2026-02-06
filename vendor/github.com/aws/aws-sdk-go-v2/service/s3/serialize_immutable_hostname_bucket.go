package s3

import (
	"context"
	"fmt"
	"path"

	awsmiddleware "github.com/aws/aws-sdk-go-v2/aws/middleware"

	"github.com/aws/aws-sdk-go-v2/internal/endpoints/awsrulesfn"
	smithy "github.com/aws/smithy-go"
	"github.com/aws/smithy-go/encoding/httpbinding"
	"github.com/aws/smithy-go/middleware"
	smithyhttp "github.com/aws/smithy-go/transport/http"
)

// serializeImmutableHostnameBucketMiddleware handles injecting the bucket name into
// "immutable" hostnames resolved via v1 EndpointResolvers. This CANNOT be done in
// serialization, since v2 endpoint resolution requires removing the {Bucket} path
// segment from all S3 requests.
//
// This will only be done for non-ARN buckets, as the features that use those require
// virtualhost manipulation to function and we previously (pre-ep2) expected the caller
// to handle that in their resolver.
type serializeImmutableHostnameBucketMiddleware struct {
	UsePathStyle bool
}

func (*serializeImmutableHostnameBucketMiddleware) ID() string {
	return "serializeImmutableHostnameBucket"
}

func (m *serializeImmutableHostnameBucketMiddleware) HandleSerialize(
	ctx context.Context, in middleware.SerializeInput, next middleware.SerializeHandler,
) (
	out middleware.SerializeOutput, metadata middleware.Metadata, err error,
) {
	request, ok := in.Request.(*smithyhttp.Request)
	if !ok {
		return out, metadata, &smithy.SerializationError{Err: fmt.Errorf("unknown transport type %T", in.Request)}
	}

	bucket, ok := bucketFromInput(in.Parameters)
	if !ok {
		return next.HandleSerialize(ctx, in)
	}

	// a bucket being un-vhostable will also force us to use path style
	usePathStyle := m.UsePathStyle || !awsrulesfn.IsVirtualHostableS3Bucket(bucket, request.URL.Scheme != "https")

	if !smithyhttp.GetHostnameImmutable(ctx) &&
		!(awsmiddleware.GetRequiresLegacyEndpoints(ctx) && usePathStyle) {
		return next.HandleSerialize(ctx, in)
	}

	parsedBucket := awsrulesfn.ParseARN(bucket)

	// disallow ARN buckets except for MRAP arns
	if parsedBucket != nil && len(parsedBucket.Region) > 0 {
		return next.HandleSerialize(ctx, in)
	}

	request.URL.Path = path.Join(request.URL.Path, bucket)
	request.URL.RawPath = path.Join(request.URL.RawPath, httpbinding.EscapePath(bucket, true))

	return next.HandleSerialize(ctx, in)
}

func addSerializeImmutableHostnameBucketMiddleware(stack *middleware.Stack, options Options) error {
	return stack.Serialize.Insert(
		&serializeImmutableHostnameBucketMiddleware{
			UsePathStyle: options.UsePathStyle,
		},
		"OperationSerializer",
		middleware.Before,
	)
}
