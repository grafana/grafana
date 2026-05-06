package s3shared

import (
	"context"

	awsmiddleware "github.com/aws/aws-sdk-go-v2/aws/middleware"
	awshttp "github.com/aws/aws-sdk-go-v2/aws/transport/http"
	"github.com/aws/smithy-go/middleware"
	smithyhttp "github.com/aws/smithy-go/transport/http"
)

// AddResponseErrorMiddleware adds response error wrapper middleware
func AddResponseErrorMiddleware(stack *middleware.Stack) error {
	// add error wrapper middleware before request id retriever middleware so that it can wrap the error response
	// returned by operation deserializers
	return stack.Deserialize.Insert(&errorWrapper{}, metadataRetrieverID, middleware.Before)
}

type errorWrapper struct {
}

// ID returns the middleware identifier
func (m *errorWrapper) ID() string {
	return "ResponseErrorWrapper"
}

func (m *errorWrapper) HandleDeserialize(ctx context.Context, in middleware.DeserializeInput, next middleware.DeserializeHandler) (
	out middleware.DeserializeOutput, metadata middleware.Metadata, err error,
) {
	out, metadata, err = next.HandleDeserialize(ctx, in)
	if err == nil {
		// Nothing to do when there is no error.
		return out, metadata, err
	}

	resp, ok := out.RawResponse.(*smithyhttp.Response)
	if !ok {
		// No raw response to wrap with.
		return out, metadata, err
	}

	// look for request id in metadata
	reqID, _ := awsmiddleware.GetRequestIDMetadata(metadata)
	// look for host id in metadata
	hostID, _ := GetHostIDMetadata(metadata)

	// Wrap the returned smithy error with the request id retrieved from the metadata
	err = &ResponseError{
		ResponseError: &awshttp.ResponseError{
			ResponseError: &smithyhttp.ResponseError{
				Response: resp,
				Err:      err,
			},
			RequestID: reqID,
		},
		HostID: hostID,
	}

	return out, metadata, err
}
