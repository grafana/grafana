package s3shared

import (
	"errors"
	"fmt"

	awshttp "github.com/aws/aws-sdk-go-v2/aws/transport/http"
)

// ResponseError provides the HTTP centric error type wrapping the underlying error
// with the HTTP response value and the deserialized RequestID.
type ResponseError struct {
	*awshttp.ResponseError

	// HostID associated with response error
	HostID string
}

// ServiceHostID returns the host id associated with Response Error
func (e *ResponseError) ServiceHostID() string { return e.HostID }

// Error returns the formatted error
func (e *ResponseError) Error() string {
	return fmt.Sprintf(
		"https response error StatusCode: %d, RequestID: %s, HostID: %s, %v",
		e.Response.StatusCode, e.RequestID, e.HostID, e.Err)
}

// As populates target and returns true if the type of target is a error type that
// the ResponseError embeds, (e.g.S3 HTTP ResponseError)
func (e *ResponseError) As(target interface{}) bool {
	return errors.As(e.ResponseError, target)
}
