package client

import (
	"errors"
	"fmt"
	"net/http"
)

// ErrServerUnavailable is returned when the Git server is unavailable (HTTP 5xx status codes).
// This error should only be used with errors.Is() for comparison, not for type assertions.
var ErrServerUnavailable = errors.New("server unavailable")

// ServerUnavailableError provides structured information about a Git server that is unavailable.
type ServerUnavailableError struct {
	// StatusCode is the HTTP status code (5xx)
	StatusCode int
	// Operation is the HTTP method that failed (e.g., "GET", "POST", "PUT")
	Operation string
	// Underlying is the underlying error
	Underlying error
}

func (e *ServerUnavailableError) Error() string {
	if e.Underlying != nil {
		if e.Operation != "" {
			return fmt.Sprintf("server unavailable (operation %s, status code %d): %v", e.Operation, e.StatusCode, e.Underlying)
		}
		return fmt.Sprintf("server unavailable (status code %d): %v", e.StatusCode, e.Underlying)
	}
	if e.Operation != "" {
		return fmt.Sprintf("server unavailable (operation %s, status code %d)", e.Operation, e.StatusCode)
	}
	return fmt.Sprintf("server unavailable (status code %d)", e.StatusCode)
}

// Unwrap returns the underlying error, preserving the error chain.
func (e *ServerUnavailableError) Unwrap() error {
	return e.Underlying
}

// Is enables errors.Is() compatibility with ErrServerUnavailable.
func (e *ServerUnavailableError) Is(target error) bool {
	return target == ErrServerUnavailable
}

// NewServerUnavailableError creates a new ServerUnavailableError with the specified operation, status code, and underlying error.
// Operation can be empty if the HTTP method is unknown.
func NewServerUnavailableError(operation string, statusCode int, underlying error) *ServerUnavailableError {
	return &ServerUnavailableError{
		Operation:  operation,
		StatusCode: statusCode,
		Underlying: underlying,
	}
}

// CheckServerUnavailable checks if an HTTP response indicates server unavailability.
// It checks for:
//   - Server errors (5xx status codes)
//   - Too Many Requests (429 status code)
//
// If the response is server unavailable, it returns a ServerUnavailableError.
// The HTTP method is extracted from the response's request.
// The caller is responsible for closing the response body.
func CheckServerUnavailable(res *http.Response) error {
	if res.StatusCode >= 500 || res.StatusCode == http.StatusTooManyRequests {
		operation := ""
		if res.Request != nil {
			operation = res.Request.Method
		}
		return NewServerUnavailableError(operation, res.StatusCode, fmt.Errorf("got status code %d: %s", res.StatusCode, res.Status))
	}
	return nil
}
