package puddle

import (
	"context"
	"time"
)

// valueCancelCtx combines two contexts into one. One context is used for values and the other is used for cancellation.
type valueCancelCtx struct {
	valueCtx  context.Context
	cancelCtx context.Context
}

func (ctx *valueCancelCtx) Deadline() (time.Time, bool) { return ctx.cancelCtx.Deadline() }
func (ctx *valueCancelCtx) Done() <-chan struct{}       { return ctx.cancelCtx.Done() }
func (ctx *valueCancelCtx) Err() error                  { return ctx.cancelCtx.Err() }
func (ctx *valueCancelCtx) Value(key any) any           { return ctx.valueCtx.Value(key) }

func newValueCancelCtx(valueCtx, cancelContext context.Context) context.Context {
	return &valueCancelCtx{
		valueCtx:  valueCtx,
		cancelCtx: cancelContext,
	}
}
