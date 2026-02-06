package ratelimit

import (
	"context"
	"fmt"
)

type rateToken struct {
	tokenCost uint
	bucket    *TokenBucket
}

func (t rateToken) release() error {
	t.bucket.Refund(t.tokenCost)
	return nil
}

// TokenRateLimit provides a Token Bucket RateLimiter implementation
// that limits the overall number of retry attempts that can be made across
// operation invocations.
type TokenRateLimit struct {
	bucket *TokenBucket
}

// NewTokenRateLimit returns an TokenRateLimit with default values.
// Functional options can configure the retry rate limiter.
func NewTokenRateLimit(tokens uint) *TokenRateLimit {
	return &TokenRateLimit{
		bucket: NewTokenBucket(tokens),
	}
}

type canceledError struct {
	Err error
}

func (c canceledError) CanceledError() bool { return true }
func (c canceledError) Unwrap() error       { return c.Err }
func (c canceledError) Error() string {
	return fmt.Sprintf("canceled, %v", c.Err)
}

// GetToken may cause a available pool of retry quota to be
// decremented. Will return an error if the decremented value can not be
// reduced from the retry quota.
func (l *TokenRateLimit) GetToken(ctx context.Context, cost uint) (func() error, error) {
	select {
	case <-ctx.Done():
		return nil, canceledError{Err: ctx.Err()}
	default:
	}
	if avail, ok := l.bucket.Retrieve(cost); !ok {
		return nil, QuotaExceededError{Available: avail, Requested: cost}
	}

	return rateToken{
		tokenCost: cost,
		bucket:    l.bucket,
	}.release, nil
}

// AddTokens increments the token bucket by a fixed amount.
func (l *TokenRateLimit) AddTokens(v uint) error {
	l.bucket.Refund(v)
	return nil
}

// Remaining returns the number of remaining tokens in the bucket.
func (l *TokenRateLimit) Remaining() uint {
	return l.bucket.Remaining()
}

// QuotaExceededError provides the SDK error when the retries for a given
// token bucket have been exhausted.
type QuotaExceededError struct {
	Available uint
	Requested uint
}

func (e QuotaExceededError) Error() string {
	return fmt.Sprintf("retry quota exceeded, %d available, %d requested",
		e.Available, e.Requested)
}
