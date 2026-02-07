package tracing

import "context"

type (
	operationTracerKey struct{}
	spanLineageKey     struct{}
)

// GetSpan returns the active trace Span on the context.
//
// The boolean in the return indicates whether a Span was actually in the
// context, but a no-op implementation will be returned if not, so callers
// can generally disregard the boolean unless they wish to explicitly confirm
// presence/absence of a Span.
func GetSpan(ctx context.Context) (Span, bool) {
	lineage := getLineage(ctx)
	if len(lineage) == 0 {
		return nopSpan{}, false
	}

	return lineage[len(lineage)-1], true
}

// WithSpan sets the active trace Span on the context.
func WithSpan(parent context.Context, span Span) context.Context {
	lineage := getLineage(parent)
	if len(lineage) == 0 {
		return context.WithValue(parent, spanLineageKey{}, []Span{span})
	}

	lineage = append(lineage, span)
	return context.WithValue(parent, spanLineageKey{}, lineage)
}

// PopSpan pops the current Span off the context, setting the active Span on
// the returned Context back to its parent and returning the REMOVED one.
//
// PopSpan on a context with no active Span will return a no-op instance.
//
// This is mostly necessary for the runtime to manage base trace spans due to
// the wrapped-function nature of the middleware stack. End-users of Smithy
// clients SHOULD NOT generally be using this API.
func PopSpan(parent context.Context) (context.Context, Span) {
	lineage := getLineage(parent)
	if len(lineage) == 0 {
		return parent, nopSpan{}
	}

	span := lineage[len(lineage)-1]
	lineage = lineage[:len(lineage)-1]
	return context.WithValue(parent, spanLineageKey{}, lineage), span
}

func getLineage(ctx context.Context) []Span {
	v := ctx.Value(spanLineageKey{})
	if v == nil {
		return nil
	}

	return v.([]Span)
}

// GetOperationTracer returns the embedded operation-scoped Tracer on a
// Context.
//
// The boolean in the return indicates whether a Tracer was actually in the
// context, but a no-op implementation will be returned if not, so callers
// can generally disregard the boolean unless they wish to explicitly confirm
// presence/absence of a Tracer.
func GetOperationTracer(ctx context.Context) (Tracer, bool) {
	v := ctx.Value(operationTracerKey{})
	if v == nil {
		return nopTracer{}, false
	}

	return v.(Tracer), true
}

// WithOperationTracer returns a child Context embedding the given Tracer.
//
// The runtime will use this embed a scoped tracer for client operations,
// Smithy/SDK client callers DO NOT need to do this explicitly.
func WithOperationTracer(parent context.Context, tracer Tracer) context.Context {
	return context.WithValue(parent, operationTracerKey{}, tracer)
}

// StartSpan is a convenience API for creating tracing Spans from a Context.
//
// StartSpan uses the operation-scoped Tracer, previously stored using
// [WithOperationTracer], to start the Span. If a Tracer has not been embedded
// the returned Span will be a no-op implementation.
func StartSpan(ctx context.Context, name string, opts ...SpanOption) (context.Context, Span) {
	tracer, _ := GetOperationTracer(ctx)
	return tracer.StartSpan(ctx, name, opts...)
}
