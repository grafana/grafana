package http

import (
	"context"
	"fmt"

	"github.com/aws/smithy-go/middleware"
)

// ComputeContentLength provides a middleware to set the content-length
// header for the length of a serialize request body.
type ComputeContentLength struct {
}

// AddComputeContentLengthMiddleware adds ComputeContentLength to the middleware
// stack's Build step.
func AddComputeContentLengthMiddleware(stack *middleware.Stack) error {
	return stack.Build.Add(&ComputeContentLength{}, middleware.After)
}

// ID returns the identifier for the ComputeContentLength.
func (m *ComputeContentLength) ID() string { return "ComputeContentLength" }

// HandleBuild adds the length of the serialized request to the HTTP header
// if the length can be determined.
func (m *ComputeContentLength) HandleBuild(
	ctx context.Context, in middleware.BuildInput, next middleware.BuildHandler,
) (
	out middleware.BuildOutput, metadata middleware.Metadata, err error,
) {
	req, ok := in.Request.(*Request)
	if !ok {
		return out, metadata, fmt.Errorf("unknown request type %T", req)
	}

	// do nothing if request content-length was set to 0 or above.
	if req.ContentLength >= 0 {
		return next.HandleBuild(ctx, in)
	}

	// attempt to compute stream length
	if n, ok, err := req.StreamLength(); err != nil {
		return out, metadata, fmt.Errorf(
			"failed getting length of request stream, %w", err)
	} else if ok {
		req.ContentLength = n
	}

	return next.HandleBuild(ctx, in)
}

// validateContentLength provides a middleware to validate the content-length
// is valid (greater than zero), for the serialized request payload.
type validateContentLength struct{}

// ValidateContentLengthHeader adds middleware that validates request content-length
// is set to value greater than zero.
func ValidateContentLengthHeader(stack *middleware.Stack) error {
	return stack.Build.Add(&validateContentLength{}, middleware.After)
}

// ID returns the identifier for the ComputeContentLength.
func (m *validateContentLength) ID() string { return "ValidateContentLength" }

// HandleBuild adds the length of the serialized request to the HTTP header
// if the length can be determined.
func (m *validateContentLength) HandleBuild(
	ctx context.Context, in middleware.BuildInput, next middleware.BuildHandler,
) (
	out middleware.BuildOutput, metadata middleware.Metadata, err error,
) {
	req, ok := in.Request.(*Request)
	if !ok {
		return out, metadata, fmt.Errorf("unknown request type %T", req)
	}

	// if request content-length was set to less than 0, return an error
	if req.ContentLength < 0 {
		return out, metadata, fmt.Errorf(
			"content length for payload is required and must be at least 0")
	}

	return next.HandleBuild(ctx, in)
}
