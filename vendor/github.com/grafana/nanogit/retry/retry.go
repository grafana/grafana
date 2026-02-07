package retry

import (
	"context"
	"fmt"

	"github.com/grafana/nanogit/log"
)

// Package retry provides retry wrapper functions that execute operations with retry logic.

// Do executes a function with retry logic based on the retrier in the context.
// The function will be retried if it returns an error that the retrier determines should be retried.
//
// The retrier is retrieved from the context. If no retrier is found, a NoopRetrier is used
// (no retries will be performed).
//
// Parameters:
//   - ctx: Context for cancellation and retrier retrieval
//   - fn: Function to execute and potentially retry
//
// Returns:
//   - The result of the function if it succeeds
//   - The last error if all retry attempts are exhausted
func Do[T any](ctx context.Context, fn func() (T, error)) (T, error) {
	var zero T
	retrier := FromContext(ctx)
	logger := log.FromContext(ctx)

	maxAttempts := retrier.MaxAttempts()
	if maxAttempts <= 1 {
		return fn()
	}

	var lastErr error
	for attempt := 1; attempt <= maxAttempts; attempt++ {
		result, err := fn()
		if err == nil {
			return result, nil
		}

		lastErr = err

		// Check if we should retry
		if !retrier.ShouldRetry(ctx, err, attempt) {
			logger.Debug("Error not retryable, stopping",
				"attempt", attempt,
				"max_attempts", maxAttempts,
				"error", err.Error())
			return zero, err
		}

		// Wait before retrying (only if not the last attempt)
		if attempt < maxAttempts {
			// Log retry attempt
			logger.Debug("Retrying after error",
				"attempt", attempt,
				"max_attempts", maxAttempts,
				"error", err.Error())

			// Wait before retrying
			if waitErr := retrier.Wait(ctx, attempt); waitErr != nil {
				// Context was cancelled during wait
				return zero, fmt.Errorf("context cancelled during retry wait: %w", waitErr)
			}
		}
	}

	// All attempts exhausted
	logger.Debug("Max retry attempts reached",
		"max_attempts", maxAttempts,
		"error", lastErr.Error())
	return zero, fmt.Errorf("max retry attempts (%d) reached: %w", maxAttempts, lastErr)
}

// DoVoid executes a function with retry logic that returns only an error.
// This is a convenience wrapper for functions that don't return a value.
func DoVoid(ctx context.Context, fn func() error) error {
	_, err := Do(ctx, func() (struct{}, error) {
		return struct{}{}, fn()
	})
	return err
}
