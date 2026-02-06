// Copyright (c) The go-grpc-middleware Authors.
// Licensed under the Apache License 2.0.

//go:build retrynotrace

package retry

// retrynotrace can be used to avoid importing golang.org/x/net/trace,
// which allows for more aggressive deadcode elimination, which can
// yield improvements in binary size when tracing is not needed.

import (
	"context"
	"fmt"
)

type notrace struct{}

func (notrace) LazyLog(x fmt.Stringer, sensitive bool) {}
func (notrace) LazyPrintf(format string, a ...any)     {}
func (notrace) SetError()                              {}
func (notrace) SetRecycler(f func(any))                {}
func (notrace) SetTraceInfo(traceID, spanID uint64)    {}
func (notrace) SetMaxEvents(m int)                     {}
func (notrace) Finish()                                {}

func traceFromCtx(ctx context.Context) (notrace, bool) {
	return notrace{}, true
}
