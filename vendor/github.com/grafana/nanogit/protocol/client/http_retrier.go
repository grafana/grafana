package client

import (
	"context"
	"errors"
	"net/http"

	"github.com/grafana/nanogit/retry"
)

// temporaryErrorRetrier wraps another retrier and handles server unavailable errors:
// - Server unavailable errors (ErrServerUnavailable) that are retryable based on HTTP method/status
//
// If the error is a retryable server unavailable error, it always retries. Otherwise, it delegates to the wrapped retrier.
// Network errors and context cancellation are handled by the wrapped retrier (e.g., ExponentialBackoffRetrier).
//
// This is an internal type used automatically by the rawClient.do method.
type temporaryErrorRetrier struct {
	// wrapped is the underlying retrier that provides the retry logic
	// (backoff timing, max attempts, etc.)
	wrapped retry.Retrier
}

// newTemporaryErrorRetrier creates a new temporaryErrorRetrier that wraps the given retrier.
func newTemporaryErrorRetrier(wrapped retry.Retrier) *temporaryErrorRetrier {
	if wrapped == nil {
		wrapped = &retry.NoopRetrier{}
	}
	return &temporaryErrorRetrier{
		wrapped: wrapped,
	}
}

// ShouldRetry determines if an error should be retried.
// If the error is a retryable server unavailable error, returns true (always retry).
// Otherwise, delegates to the wrapped retrier (which handles network errors and context cancellation).
//
// A server unavailable error is retryable if:
//   - POST operations are not retried on 5xx because request body is consumed
//   - GET and DELETE operations can be retried on 5xx (they are idempotent)
//   - HTTP 429 (Too Many Requests) can be retried for all operations
//
// Max attempts are handled by retry.Do, not by this method.
func (r *temporaryErrorRetrier) ShouldRetry(ctx context.Context, err error, attempt int) bool {
	if err == nil {
		return false
	}

	// Check for server unavailable errors that are retryable
	var serverErr *ServerUnavailableError
	if errors.As(err, &serverErr) {
		if r.isRetryableOperation(serverErr.Operation, serverErr.StatusCode) {
			return true
		}
		// Server unavailable but not retryable, delegate to wrapped retrier.
		// The retrier is retrieved from the context. If no retrier is found, a NoopRetrier is used (no retries will be performed).
		return r.wrapped.ShouldRetry(ctx, err, attempt)
	}

	// Not a server unavailable error, delegate to wrapped retrier (handles network errors, context cancellation, etc.).
	// The retrier is retrieved from the context. If no retrier is found, a NoopRetrier is used (no retries will be performed).
	return r.wrapped.ShouldRetry(ctx, err, attempt)
}

// isRetryableOperation determines if an operation should be retried based on HTTP method and status code.
func (r *temporaryErrorRetrier) isRetryableOperation(operation string, statusCode int) bool {
	// HTTP 429 (Too Many Requests) can be retried for all operations
	if statusCode == http.StatusTooManyRequests {
		return true
	}
	// Check for specific 5xx status codes
	switch statusCode {
	case http.StatusInternalServerError,
		http.StatusBadGateway,
		http.StatusServiceUnavailable,
		http.StatusGatewayTimeout:
		// POST operations cannot be retried on 5xx because request body is consumed
		// GET and DELETE operations can be retried on 5xx (they are idempotent)
		return operation == http.MethodGet || operation == http.MethodDelete
	default:
		return false
	}
}

// Wait waits before the next retry attempt by delegating to the wrapped retrier.
func (r *temporaryErrorRetrier) Wait(ctx context.Context, attempt int) error {
	return r.wrapped.Wait(ctx, attempt)
}

// MaxAttempts returns the maximum number of attempts by delegating to the wrapped retrier.
func (r *temporaryErrorRetrier) MaxAttempts() int {
	return r.wrapped.MaxAttempts()
}
