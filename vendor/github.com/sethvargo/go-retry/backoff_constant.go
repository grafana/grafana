package retry

import (
	"context"
	"time"
)

// Constant is a wrapper around Retry that uses a constant backoff. It panics if
// the given base is less than zero.
func Constant(ctx context.Context, t time.Duration, f RetryFunc) error {
	return Do(ctx, NewConstant(t), f)
}

// NewConstant creates a new constant backoff using the value t. The wait time
// is the provided constant value. It panics if the given base is less than
// zero.
func NewConstant(t time.Duration) Backoff {
	if t <= 0 {
		panic("t must be greater than 0")
	}

	return BackoffFunc(func() (time.Duration, bool) {
		return t, false
	})
}
