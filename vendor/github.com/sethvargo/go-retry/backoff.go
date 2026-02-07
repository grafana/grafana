package retry

import (
	"sync"
	"time"
)

// Backoff is an interface that backs off.
type Backoff interface {
	// Next returns the time duration to wait and whether to stop.
	Next() (next time.Duration, stop bool)
}

var _ Backoff = (BackoffFunc)(nil)

// BackoffFunc is a backoff expressed as a function.
type BackoffFunc func() (time.Duration, bool)

// Next implements Backoff.
func (b BackoffFunc) Next() (time.Duration, bool) {
	return b()
}

// WithJitter wraps a backoff function and adds the specified jitter. j can be
// interpreted as "+/- j". For example, if j were 5 seconds and the backoff
// returned 20s, the value could be between 15 and 25 seconds. The value can
// never be less than 0.
func WithJitter(j time.Duration, next Backoff) Backoff {
	r := newLockedRandom(time.Now().UnixNano())

	return BackoffFunc(func() (time.Duration, bool) {
		val, stop := next.Next()
		if stop {
			return 0, true
		}

		diff := time.Duration(r.Int63n(int64(j)*2) - int64(j))
		val = val + diff
		if val < 0 {
			val = 0
		}
		return val, false
	})
}

// WithJitterPercent wraps a backoff function and adds the specified jitter
// percentage. j can be interpreted as "+/- j%". For example, if j were 5 and
// the backoff returned 20s, the value could be between 19 and 21 seconds. The
// value can never be less than 0 or greater than 100.
func WithJitterPercent(j uint64, next Backoff) Backoff {
	r := newLockedRandom(time.Now().UnixNano())

	return BackoffFunc(func() (time.Duration, bool) {
		val, stop := next.Next()
		if stop {
			return 0, true
		}

		// Get a value between -j and j, the convert to a percentage
		top := r.Int63n(int64(j)*2) - int64(j)
		pct := 1 - float64(top)/100.0

		val = time.Duration(float64(val) * pct)
		if val < 0 {
			val = 0
		}
		return val, false
	})
}

// WithMaxRetries executes the backoff function up until the maximum attempts.
func WithMaxRetries(max uint64, next Backoff) Backoff {
	var l sync.Mutex
	var attempt uint64

	return BackoffFunc(func() (time.Duration, bool) {
		l.Lock()
		defer l.Unlock()

		if attempt >= max {
			return 0, true
		}
		attempt++

		val, stop := next.Next()
		if stop {
			return 0, true
		}

		return val, false
	})
}

// WithCappedDuration sets a maximum on the duration returned from the next
// backoff. This is NOT a total backoff time, but rather a cap on the maximum
// value a backoff can return. Without another middleware, the backoff will
// continue infinitely.
func WithCappedDuration(cap time.Duration, next Backoff) Backoff {
	return BackoffFunc(func() (time.Duration, bool) {
		val, stop := next.Next()
		if stop {
			return 0, true
		}

		if val <= 0 || val > cap {
			val = cap
		}
		return val, false
	})
}

// WithMaxDuration sets a maximum on the total amount of time a backoff should
// execute. It's best-effort, and should not be used to guarantee an exact
// amount of time.
func WithMaxDuration(timeout time.Duration, next Backoff) Backoff {
	start := time.Now()

	return BackoffFunc(func() (time.Duration, bool) {
		diff := timeout - time.Since(start)
		if diff <= 0 {
			return 0, true
		}

		val, stop := next.Next()
		if stop {
			return 0, true
		}

		if val <= 0 || val > diff {
			val = diff
		}
		return val, false
	})
}
