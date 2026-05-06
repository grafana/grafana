package http

import (
	"fmt"
	"net/http"
)

// Response provides the HTTP specific response structure for HTTP specific
// middleware steps to use to deserialize the response from an operation call.
type Response struct {
	*http.Response
}

// ResponseError provides the HTTP centric error type wrapping the underlying
// error with the HTTP response value.
type ResponseError struct {
	Response *Response
	Err      error
}

// HTTPStatusCode returns the HTTP response status code received from the service.
func (e *ResponseError) HTTPStatusCode() int { return e.Response.StatusCode }

// HTTPResponse returns the HTTP response received from the service.
func (e *ResponseError) HTTPResponse() *Response { return e.Response }

// Unwrap returns the nested error if any, or nil.
func (e *ResponseError) Unwrap() error { return e.Err }

func (e *ResponseError) Error() string {
	return fmt.Sprintf(
		"http response error StatusCode: %d, %v",
		e.Response.StatusCode, e.Err)
}
