package tracing

import "context"

// NopTracerProvider is a no-op tracing implementation.
type NopTracerProvider struct{}

var _ TracerProvider = (*NopTracerProvider)(nil)

// Tracer returns a tracer which creates no-op spans.
func (NopTracerProvider) Tracer(string, ...TracerOption) Tracer {
	return nopTracer{}
}

type nopTracer struct{}

var _ Tracer = (*nopTracer)(nil)

func (nopTracer) StartSpan(ctx context.Context, name string, opts ...SpanOption) (context.Context, Span) {
	return ctx, nopSpan{}
}

type nopSpan struct{}

var _ Span = (*nopSpan)(nil)

func (nopSpan) Name() string                    { return "" }
func (nopSpan) Context() SpanContext            { return SpanContext{} }
func (nopSpan) AddEvent(string, ...EventOption) {}
func (nopSpan) SetProperty(any, any)            {}
func (nopSpan) SetStatus(SpanStatus)            {}
func (nopSpan) End()                            {}
