package rueidis

import (
	"context"
	"runtime"
	"time"

	"github.com/redis/rueidis/internal/util"
)

const (
	defaultMaxRetries    = 20
	defaultMaxRetryDelay = 1 * time.Second
)

// RetryDelayFn returns the delay that should be used before retrying the
// attempt. Will return negative delay if the delay could not be determined or do not retry.
type RetryDelayFn func(attempts int, cmd Completed, err error) time.Duration

// defaultRetryDelayFn delays the next retry exponentially without considering the error.
// max delay is 1 second.
// This "Equal Jitter" delay produced by this implementation is not monotonic increasing. ref: https://aws.amazon.com/ko/blogs/architecture/exponential-backoff-and-jitter/
func defaultRetryDelayFn(attempts int, _ Completed, _ error) time.Duration {
	base := 1 << min(defaultMaxRetries, attempts)
	jitter := util.FastRand(base)
	return min(defaultMaxRetryDelay, time.Duration(base+jitter)*time.Microsecond)
}

type retryHandler interface {
	// RetryDelay returns the delay that should be used before retrying the
	// attempt. Will return negative delay if the delay could not be determined or do
	// not retry.
	// If the delay is zero, the next retry should be attempted immediately.
	RetryDelay(attempts int, cmd Completed, err error) time.Duration

	// WaitForRetry waits until the next retry should be attempted.
	WaitForRetry(ctx context.Context, duration time.Duration)

	// WaitOrSkipRetry waits until the next retry should be attempted
	// or returns false if the command should not be retried.
	// Returns false immediately if the command should not be retried.
	// Returns true after the delay if the command should be retried.
	WaitOrSkipRetry(ctx context.Context, attempts int, cmd Completed, err error) bool
}

type retryer struct {
	RetryDelayFn RetryDelayFn
}

var _ retryHandler = (*retryer)(nil)

func newRetryer(retryDelayFn RetryDelayFn) *retryer {
	return &retryer{RetryDelayFn: retryDelayFn}
}

func (r *retryer) RetryDelay(attempts int, cmd Completed, err error) time.Duration {
	return r.RetryDelayFn(attempts, cmd, err)
}

func (r *retryer) WaitForRetry(ctx context.Context, duration time.Duration) {
	if duration > 0 {
		if ch := ctx.Done(); ch != nil {
			tm := time.NewTimer(duration)
			defer tm.Stop()
			select {
			case <-ch:
			case <-tm.C:
			}
		} else {
			time.Sleep(duration)
		}
	}
}

func (r *retryer) WaitOrSkipRetry(
	ctx context.Context, attempts int, cmd Completed, err error,
) bool {
	if delay := r.RetryDelay(attempts, cmd, err); delay == 0 {
		runtime.Gosched()
		return true
	} else if delay > 0 {
		if dl, ok := ctx.Deadline(); !ok || time.Until(dl) > delay {
			r.WaitForRetry(ctx, delay)
			return true
		}
	}
	return false
}
