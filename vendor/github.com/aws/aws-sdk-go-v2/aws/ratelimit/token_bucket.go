package ratelimit

import (
	"sync"
)

// TokenBucket provides a concurrency safe utility for adding and removing
// tokens from the available token bucket.
type TokenBucket struct {
	remainingTokens uint
	maxCapacity     uint
	minCapacity     uint
	mu              sync.Mutex
}

// NewTokenBucket returns an initialized TokenBucket with the capacity
// specified.
func NewTokenBucket(i uint) *TokenBucket {
	return &TokenBucket{
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
func (t *TokenBucket) Retrieve(amount uint) (available uint, retrieved bool) {
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
func (t *TokenBucket) Refund(amount uint) {
	t.mu.Lock()
	defer t.mu.Unlock()

	// Capacity cannot exceed max capacity.
	t.remainingTokens = uintMin(t.remainingTokens+amount, t.maxCapacity)
}

// Capacity returns the maximum capacity of tokens that the bucket could
// contain.
func (t *TokenBucket) Capacity() uint {
	t.mu.Lock()
	defer t.mu.Unlock()

	return t.maxCapacity
}

// Remaining returns the number of tokens that remaining in the bucket.
func (t *TokenBucket) Remaining() uint {
	t.mu.Lock()
	defer t.mu.Unlock()

	return t.remainingTokens
}

// Resize adjusts the size of the token bucket. Returns the capacity remaining.
func (t *TokenBucket) Resize(size uint) uint {
	t.mu.Lock()
	defer t.mu.Unlock()

	t.maxCapacity = uintMax(size, t.minCapacity)

	// Capacity needs to be capped at max capacity, if max size reduced.
	t.remainingTokens = uintMin(t.remainingTokens, t.maxCapacity)

	return t.remainingTokens
}

func uintMin(a, b uint) uint {
	if a < b {
		return a
	}
	return b
}

func uintMax(a, b uint) uint {
	if a > b {
		return a
	}
	return b
}
