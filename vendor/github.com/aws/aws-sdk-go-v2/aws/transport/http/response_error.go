package http

import (
	"errors"
	"fmt"

	smithyhttp "github.com/aws/smithy-go/transport/http"
)

// ResponseError provides the HTTP centric error type wrapping the underlying error
// with the HTTP response value and the deserialized RequestID.
type ResponseError struct {
	*smithyhttp.ResponseError

	// RequestID associated with response error
	RequestID string
}

// ServiceRequestID returns the request id associated with Response Error
func (e *ResponseError) ServiceRequestID() string { return e.RequestID }

// Error returns the formatted error
func (e *ResponseError) Error() string {
	return fmt.Sprintf(
		"https response error StatusCode: %d, RequestID: %s, %v",
		e.Response.StatusCode, e.RequestID, e.Err)
}

// As populates target and returns true if the type of target is a error type that
// the ResponseError embeds, (e.g.AWS HTTP ResponseError)
func (e *ResponseError) As(target interface{}) bool {
	return errors.As(e.ResponseError, target)
}
