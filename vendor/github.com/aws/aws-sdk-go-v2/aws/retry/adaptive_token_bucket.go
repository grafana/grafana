package retry

import (
	"math"
	"sync"
)

// adaptiveTokenBucket provides a concurrency safe utility for adding and
// removing tokens from the available token bucket.
type adaptiveTokenBucket struct {
	remainingTokens float64
	maxCapacity     float64
	minCapacity     float64
	mu              sync.Mutex
}

// newAdaptiveTokenBucket returns an initialized adaptiveTokenBucket with the
// capacity specified.
func newAdaptiveTokenBucket(i float64) *adaptiveTokenBucket {
	return &adaptiveTokenBucket{
		remainingTokens: i,
		maxCapacity:     i,
		minCapacity:     1,
	}
}

// Retrieve attempts to reduce the available tokens by the amount requested. If
// there are tokens available true will be returned along with the number of
// available tokens remaining. If amount requested is larger than the available
// capacity, false will be returned along with the available capacity. If the
// amount is less than the available capacity, the capacity will be reduced by
// that amount, and the remaining capacity and true will be returned.
func (t *adaptiveTokenBucket) Retrieve(amount float64) (available float64, retrieved bool) {
	t.mu.Lock()
	defer t.mu.Unlock()

	if amount > t.remainingTokens {
		return t.remainingTokens, false
	}

	t.remainingTokens -= amount
	return t.remainingTokens, true
}

// Refund returns the amount of tokens back to the available token bucket, up
// to the initial capacity.
func (t *adaptiveTokenBucket) Refund(amount float64) {
	t.mu.Lock()
	defer t.mu.Unlock()

	// Capacity cannot exceed max capacity.
	t.remainingTokens = math.Min(t.remainingTokens+amount, t.maxCapacity)
}

// Capacity returns the maximum capacity of tokens that the bucket could
// contain.
func (t *adaptiveTokenBucket) Capacity() float64 {
	t.mu.Lock()
	defer t.mu.Unlock()

	return t.maxCapacity
}

// Remaining returns the number of tokens that remaining in the bucket.
func (t *adaptiveTokenBucket) Remaining() float64 {
	t.mu.Lock()
	defer t.mu.Unlock()

	return t.remainingTokens
}

// Resize adjusts the size of the token bucket. Returns the capacity remaining.
func (t *adaptiveTokenBucket) Resize(size float64) float64 {
	t.mu.Lock()
	defer t.mu.Unlock()

	t.maxCapacity = math.Max(size, t.minCapacity)

	// Capacity needs to be capped at max capacity, if max size reduced.
	t.remainingTokens = math.Min(t.remainingTokens, t.maxCapacity)

	return t.remainingTokens
}
