// Copyright (c) The go-grpc-middleware Authors.
// Licensed under the Apache License 2.0.

//go:build !retrynotrace

package retry

import (
	"context"

	t "golang.org/x/net/trace"
)

func traceFromCtx(ctx context.Context) (t.Trace, bool) {
	return t.FromContext(ctx)
}
