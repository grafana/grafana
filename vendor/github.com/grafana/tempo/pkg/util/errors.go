package util

import (
	"errors"
	"fmt"
	"net/http"
)

var (
	// ErrTraceNotFound can be used when we don't find a trace
	ErrTraceNotFound = errors.New("trace not found")

	// StatusClientClosedRequest is the status code for when a client request cancellation of an http request
	StatusClientClosedRequest     = 499
	StatusTextClientClosedRequest = "Request Cancelled"

	ErrUnsupported = fmt.Errorf("unsupported")
)

func StatusText(code int) string {
	switch code {
	case StatusClientClosedRequest:
		// 499 doesn't have status text in http package, so we define it here
		return StatusTextClientClosedRequest
	default:
		return http.StatusText(code)
	}
}
