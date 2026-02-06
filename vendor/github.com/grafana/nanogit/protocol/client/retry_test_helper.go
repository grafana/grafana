package client

import (
	"context"
	"errors"
	"sync"
	"time"
)

// testRetrier is a simple retrier implementation for testing
type testRetrier struct {
	maxAttempts      int
	shouldRetryFunc  func(ctx context.Context, err error, attempt int) bool
	waitFunc         func(ctx context.Context, attempt int) error
	shouldRetryCalls int
	waitCalls        int
	mu               sync.Mutex
}

func newTestRetrier(maxAttempts int) *testRetrier {
	return &testRetrier{
		maxAttempts: maxAttempts,
		shouldRetryFunc: func(ctx context.Context, err error, attempt int) bool {
			// Default: retry only on network errors (matches real retrier behavior)
			var netErr interface {
				Error() string
				Timeout() bool
				Temporary() bool
			}
			return errors.As(err, &netErr)
		},
	}
}

func (t *testRetrier) ShouldRetry(ctx context.Context, err error, attempt int) bool {
	t.mu.Lock()
	t.shouldRetryCalls++
	t.mu.Unlock()
	if t.shouldRetryFunc != nil {
		return t.shouldRetryFunc(ctx, err, attempt)
	}
	return false
}

func (t *testRetrier) Wait(ctx context.Context, attempt int) error {
	t.mu.Lock()
	t.waitCalls++
	t.mu.Unlock()
	if t.waitFunc != nil {
		return t.waitFunc(ctx, attempt)
	}
	// Default: fast wait for testing
	time.Sleep(10 * time.Millisecond)
	return nil
}

func (t *testRetrier) MaxAttempts() int {
	return t.maxAttempts
}

func (t *testRetrier) ShouldRetryCallCount() int {
	t.mu.Lock()
	defer t.mu.Unlock()
	return t.shouldRetryCalls
}

func (t *testRetrier) WaitCallCount() int {
	t.mu.Lock()
	defer t.mu.Unlock()
	return t.waitCalls
}
