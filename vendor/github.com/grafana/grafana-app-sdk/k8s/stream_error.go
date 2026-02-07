package k8s

import (
	"context"
	"io"
	"net/http"
	"strings"

	"k8s.io/client-go/rest"

	"github.com/grafana/grafana-app-sdk/logging"
)

// streamConnectionError is a custom error type that implements the net.Error interface
// and will be recognized by net.IsProbableEOF and net.IsTimeout checks in client-go.
// This allows transient stream errors to be treated as connection issues that trigger
// automatic reconnection rather than permanently failing the watch.
type streamConnectionError struct {
	err error
}

func (s *streamConnectionError) Error() string {
	return s.err.Error()
}

func (s *streamConnectionError) Unwrap() error {
	return s.err
}

// Timeout implements net.Error interface - return true to make net.IsTimeout return true
func (*streamConnectionError) Timeout() bool {
	return true
}

// Temporary implements net.Error interface - return true to make net.IsProbableEOF return true
func (*streamConnectionError) Temporary() bool {
	return true
}

// isStreamError checks if the error is a gRPC stream error that should be treated
// as a connection issue rather than a permanent failure.
func isStreamError(err error) bool {
	if err == nil {
		return false
	}

	errStr := err.Error()

	// Check for gRPC stream errors
	if strings.Contains(errStr, "stream error:") {
		return true
	}

	// Check for HTTP/2 GOAWAY frames that cause watch connection failures
	if strings.Contains(errStr, "GOAWAY") {
		return true
	}

	// Check for other common connection-related errors
	if strings.Contains(errStr, "INTERNAL_ERROR") ||
		strings.Contains(errStr, "received from peer") ||
		strings.Contains(errStr, "connection reset") ||
		strings.Contains(errStr, "broken pipe") {
		return true
	}

	return false
}

// streamErrorTransport wraps the HTTP transport to intercept and transform
// gRPC stream errors into connection-like errors that trigger reconnection.
type streamErrorTransport struct {
	base http.RoundTripper
}

func (t *streamErrorTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	logger := logging.FromContext(req.Context()).With(
		"path", req.URL.Path,
		"method", req.Method,
	)

	logger.Debug("roundtripping request")

	resp, err := t.base.RoundTrip(req)
	if err != nil {
		isStream := isStreamError(err)

		logger.Error("error roundtripping request",
			"error", err,
			"isStream", isStream,
		)

		if isStream {
			return resp, &streamConnectionError{err: err}
		}
	}

	// If this is a watch request, wrap the response body to intercept read errors
	if resp != nil {
		logger.Debug("wrapping response body")
		resp.Body = &streamErrorReadCloser{
			ReadCloser: resp.Body,
			context:    req.Context(),
		}
	}

	return resp, err
}

// streamErrorReadCloser wraps the response body to intercept read errors
// and transform stream errors into connection errors.
type streamErrorReadCloser struct {
	io.ReadCloser
	context context.Context
}

func (s *streamErrorReadCloser) Read(p []byte) (n int, err error) {
	n, err = s.ReadCloser.Read(p)
	if err != nil {
		// Transform gRPC stream errors into connection-like errors
		if isStreamError(err) {
			logging.FromContext(s.context).Debug("transforming stream error to connection error", "error", err)
			return n, &streamConnectionError{err: err}
		}
	}
	return n, err
}

// WrapWithStreamErrorHandling wraps the HTTP transport in the provided rest.Config
// to handle transient gRPC stream errors gracefully. This enables automatic reconnection
// on errors like "stream error:", "INTERNAL_ERROR", "connection reset", and "broken pipe"
// instead of permanently failing the watch connection.
//
// This function modifies the WrapTransport field in the config to chain the stream error
// handling transport wrapper with any existing transport wrapper.
func WrapWithStreamErrorHandling(cfg *rest.Config) {
	existingWrapTransport := cfg.WrapTransport
	cfg.WrapTransport = func(rt http.RoundTripper) http.RoundTripper {
		// Apply any existing transport wrapper first
		if existingWrapTransport != nil {
			rt = existingWrapTransport(rt)
		}
		// Then wrap with stream error handling
		return &streamErrorTransport{
			base: rt,
		}
	}
}
