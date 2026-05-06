package http

import (
	"context"
	"fmt"
	"github.com/aws/smithy-go/middleware"
	smithyhttp "github.com/aws/smithy-go/transport/http"
)

// removeContentTypeHeader is a build middleware that removes
// content type header if content-length header is unset or
// is set to zero,
type removeContentTypeHeader struct {
}

// ID the name of the middleware.
func (m *removeContentTypeHeader) ID() string {
	return "RemoveContentTypeHeader"
}

// HandleBuild adds or appends the constructed user agent to the request.
func (m *removeContentTypeHeader) HandleBuild(ctx context.Context, in middleware.BuildInput, next middleware.BuildHandler) (
	out middleware.BuildOutput, metadata middleware.Metadata, err error,
) {
	req, ok := in.Request.(*smithyhttp.Request)
	if !ok {
		return out, metadata, fmt.Errorf("unknown transport type %T", in)
	}

	// remove contentTypeHeader when content-length is zero
	if req.ContentLength == 0 {
		req.Header.Del("content-type")
	}

	return next.HandleBuild(ctx, in)
}

// RemoveContentTypeHeader removes content-type header if
// content length is unset or equal to zero.
func RemoveContentTypeHeader(stack *middleware.Stack) error {
	return stack.Build.Add(&removeContentTypeHeader{}, middleware.After)
}
