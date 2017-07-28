package xlog

import (
	"net/http"

	. "code.google.com/p/go.net/context"
)

// ============================================================================

// key is unexported and used for Context
type key int

const (
	xlogKey key = 0
)

func NewContext(ctx Context, xl *Logger) Context {

	return WithValue(ctx, xlogKey, xl)
}

func NewContextWithReq(ctx Context, req *http.Request) Context {

	return NewContext(ctx, NewWithReq(req))
}

// Born a context with:
// 	1. provided req id (if @a is reqIder)
// 	2. provided header (if @a is header)
//	3. **DUMMY** trace recorder (if @a cannot record)
//
func NewContextWith(ctx Context, a interface{}) Context {

	return NewContext(ctx, NewWith(a))
}

func NewContextWithRW(ctx Context, w http.ResponseWriter, r *http.Request) Context {

	return NewContext(ctx, New(w, r))
}

func FromContext(ctx Context) (xl *Logger, ok bool) {

	xl, ok = ctx.Value(xlogKey).(*Logger)
	return
}

func FromContextSafe(ctx Context) (xl *Logger) {

	xl, ok := ctx.Value(xlogKey).(*Logger)
	if !ok {
		xl = NewDummy()
	}
	return
}

// ============================================================================
