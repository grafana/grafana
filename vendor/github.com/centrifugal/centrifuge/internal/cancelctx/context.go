package cancelctx

import (
	"context"
	"time"
)

// customCancelContext wraps context and cancels as soon as channel closed.
type customCancelContext struct {
	context.Context
	ch <-chan struct{}
}

// Deadline not used.
func (c customCancelContext) Deadline() (time.Time, bool) { return time.Time{}, false }

// Done returns channel that will be closed as soon as connection closed.
func (c customCancelContext) Done() <-chan struct{} { return c.ch }

// Err returns context error.
func (c customCancelContext) Err() error {
	select {
	case <-c.ch:
		return context.Canceled
	default:
		return nil
	}
}

// New returns a wrapper context around original context that will
// be canceled on channel close.
func New(ctx context.Context, ch <-chan struct{}) context.Context {
	return customCancelContext{Context: ctx, ch: ch}
}
