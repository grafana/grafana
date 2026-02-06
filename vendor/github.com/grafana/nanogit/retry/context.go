package retry

import "context"

// Package retry provides context helpers for injecting and retrieving retriers.

// retrierKey is the key for the retrier in the context.
type retrierKey struct{}

// ToContext adds the retrier to the context.
func ToContext(ctx context.Context, retrier Retrier) context.Context {
	return context.WithValue(ctx, retrierKey{}, retrier)
}

// FromContext gets the retrier from the context.
// Always returns a retrier - if none is set, returns a NoopRetrier.
// This ensures callers can always use the retrier without nil checks.
func FromContext(ctx context.Context) Retrier {
	retrier, ok := ctx.Value(retrierKey{}).(Retrier)
	if !ok {
		return &NoopRetrier{}
	}

	return retrier
}

// FromContextOrNoop returns the retrier from the context, or a NoopRetrier if none is set.
// This is now equivalent to FromContext since FromContext always returns a retrier.
// Kept for backward compatibility.
func FromContextOrNoop(ctx context.Context) Retrier {
	return FromContext(ctx)
}

