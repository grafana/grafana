package s3

import (
	"context"
	"strings"

	awsmiddleware "github.com/aws/aws-sdk-go-v2/aws/middleware"
	"github.com/aws/smithy-go/middleware"
)

// isExpressUserAgent tracks whether the caller is using S3 Express
//
// we can only derive this at runtime, so the middleware needs to hold a handle
// to the underlying user-agent manipulator to set the feature flag as
// necessary
type isExpressUserAgent struct {
	ua *awsmiddleware.RequestUserAgent
}

func (*isExpressUserAgent) ID() string {
	return "isExpressUserAgent"
}

func (m *isExpressUserAgent) HandleSerialize(ctx context.Context, in middleware.SerializeInput, next middleware.SerializeHandler) (
	out middleware.SerializeOutput, metadata middleware.Metadata, err error,
) {
	const expressSuffix = "--x-s3"

	bucket, ok := bucketFromInput(in.Parameters)
	if ok && strings.HasSuffix(bucket, expressSuffix) {
		m.ua.AddUserAgentFeature(awsmiddleware.UserAgentFeatureS3ExpressBucket)
	}
	return next.HandleSerialize(ctx, in)
}

func addIsExpressUserAgent(stack *middleware.Stack) error {
	ua, err := getOrAddRequestUserAgent(stack)
	if err != nil {
		return err
	}

	return stack.Serialize.Add(&isExpressUserAgent{ua}, middleware.After)
}
