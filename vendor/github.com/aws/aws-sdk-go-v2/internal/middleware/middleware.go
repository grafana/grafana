package middleware

import (
	"context"
	"sync/atomic"
	"time"

	internalcontext "github.com/aws/aws-sdk-go-v2/internal/context"
	"github.com/aws/smithy-go/middleware"
)

// AddTimeOffsetMiddleware sets a value representing clock skew on the request context.
// This can be read by other operations (such as signing) to correct the date value they send
// on the request
type AddTimeOffsetMiddleware struct {
	Offset *atomic.Int64
}

// ID the identifier for AddTimeOffsetMiddleware
func (m *AddTimeOffsetMiddleware) ID() string { return "AddTimeOffsetMiddleware" }

// HandleBuild sets a value for attemptSkew on the request context if one is set on the client.
func (m AddTimeOffsetMiddleware) HandleBuild(ctx context.Context, in middleware.BuildInput, next middleware.BuildHandler) (
	out middleware.BuildOutput, metadata middleware.Metadata, err error,
) {
	if m.Offset != nil {
		offset := time.Duration(m.Offset.Load())
		ctx = internalcontext.SetAttemptSkewContext(ctx, offset)
	}
	return next.HandleBuild(ctx, in)
}

// HandleDeserialize gets the clock skew context from the context, and if set, sets it on the pointer
// held by AddTimeOffsetMiddleware
func (m *AddTimeOffsetMiddleware) HandleDeserialize(ctx context.Context, in middleware.DeserializeInput, next middleware.DeserializeHandler) (
	out middleware.DeserializeOutput, metadata middleware.Metadata, err error,
) {
	if v := internalcontext.GetAttemptSkewContext(ctx); v != 0 {
		m.Offset.Store(v.Nanoseconds())
	}
	return next.HandleDeserialize(ctx, in)
}
