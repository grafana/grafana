package concurrency

import (
	"context"

	"github.com/sourcegraph/conc/pool"
)

type Pool = pool.ContextPool

// NewPool returns a new pool where each task respects context cancellation.
// Wait() will only return the first error seen.
func NewPool(ctx context.Context, maxGoroutines int) *Pool {
	return pool.New().
		WithContext(ctx).
		WithCancelOnError().
		WithFirstError().
		WithMaxGoroutines(maxGoroutines)
}

// TrySendThroughChannel attempts to send an object through a channel.
// If the context is canceled, it will not send the object.
func TrySendThroughChannel[T any](ctx context.Context, msg T, channel chan<- T) bool {
	select {
	case <-ctx.Done():
		return false
	case channel <- msg:
		return true
	}
}
