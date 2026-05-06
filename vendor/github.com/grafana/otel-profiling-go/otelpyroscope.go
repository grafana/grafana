package otelpyroscope

import (
	"context"
	"runtime/pprof"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"go.opentelemetry.io/otel/trace/noop"
)

const (
	spanIDLabelName   = "span_id"
	spanNameLabelName = "span_name"
)

var profileIDSpanAttributeKey = attribute.Key("pyroscope.profile.id")

// tracerProvider satisfies open telemetry TracerProvider interface.
type tracerProvider struct {
	noop.TracerProvider
	tp     trace.TracerProvider
	config config
}

type config struct {
	spanNameScope scope
	spanIDScope   scope
}

type Option func(*tracerProvider)

// NewTracerProvider creates a new tracer provider that annotates pprof
// samples with span_id label. This allows to establish a relationship
// between pprof profiles and reported tracing spans.
func NewTracerProvider(tp trace.TracerProvider, options ...Option) trace.TracerProvider {
	p := tracerProvider{
		tp: tp,
		config: config{
			spanNameScope: scopeRootSpan,
			spanIDScope:   scopeRootSpan,
		},
	}
	for _, o := range options {
		o(&p)
	}
	return &p
}

func (w *tracerProvider) Tracer(name string, opts ...trace.TracerOption) trace.Tracer {
	return &profileTracer{p: w, tr: w.tp.Tracer(name, opts...)}
}

type profileTracer struct {
	noop.Tracer
	p  *tracerProvider
	tr trace.Tracer
}

func (w *profileTracer) Start(ctx context.Context, spanName string, opts ...trace.SpanStartOption) (context.Context, trace.Span) {
	ctx, span := w.tr.Start(ctx, spanName, opts...)
	spanCtx := span.SpanContext()
	addSpanIDLabel := w.p.config.spanIDScope != scopeNone && spanCtx.IsSampled()
	addSpanNameLabel := w.p.config.spanNameScope != scopeNone && spanName != ""
	if !(addSpanIDLabel || addSpanNameLabel) {
		return ctx, span
	}

	spanID := spanCtx.SpanID().String()
	s := spanWrapper{
		Span: span,
		ctx:  ctx,
		p:    w.p,
	}

	rs, ok := rootSpanFromContext(ctx)
	if !ok {
		// This is the first local span.
		rs.id = spanID
		rs.name = spanName
		ctx = withRootSpan(ctx, rs)
	}

	// We mark spans with "pyroscope.profile.id" attribute,
	// only if they _can_ have profiles. Presence of the attribute
	// does not indicate the fact that we actually have collected
	// any samples for the span.
	if (w.p.config.spanIDScope == scopeRootSpan && spanID == rs.id) ||
		w.p.config.spanIDScope == scopeAllSpans {
		span.SetAttributes(profileIDSpanAttributeKey.String(spanID))
	}
	labels := make([]string, 0, 4)
	if addSpanNameLabel {
		if w.p.config.spanNameScope == scopeRootSpan {
			spanName = rs.name
		}
		labels = append(labels, spanNameLabelName, spanName)
	}
	if addSpanIDLabel {
		if w.p.config.spanIDScope == scopeRootSpan {
			spanID = rs.id
		}
		labels = append(labels, spanIDLabelName, spanID)
	}

	ctx = pprof.WithLabels(ctx, pprof.Labels(labels...))
	pprof.SetGoroutineLabels(ctx)
	return ctx, &s
}

type spanWrapper struct {
	trace.Span
	ctx context.Context
	p   *tracerProvider
}

func (s spanWrapper) End(options ...trace.SpanEndOption) {
	s.Span.End(options...)
	pprof.SetGoroutineLabels(s.ctx)
}

type rootSpanCtxKey struct{}

type rootSpan struct {
	id   string
	name string
}

func withRootSpan(ctx context.Context, s rootSpan) context.Context {
	return context.WithValue(ctx, rootSpanCtxKey{}, s)
}

func rootSpanFromContext(ctx context.Context) (rootSpan, bool) {
	s, ok := ctx.Value(rootSpanCtxKey{}).(rootSpan)
	return s, ok
}

// TODO(kolesnikovae): Make options public.

// withSpanNameLabelScope specifies whether the current span name should be
// added to the profile labels. If the name is dynamic, i.e. includes
// span-specific identifiers, such as URL or SQL query, this may significantly
// deteriorate performance.
//
// By default, only the local root span name is recorded. Samples collected
// during the child span execution will be included into the root span profile.
func withSpanNameLabelScope(scope scope) Option {
	return func(tp *tracerProvider) {
		tp.config.spanNameScope = scope
	}
}

// withSpanIDScope specifies whether the current span ID should be added to
// the profile labels.
//
// By default, only the local root span ID is recorded. Samples collected
// during the child span execution will be included into the root span profile.
func withSpanIDScope(scope scope) Option {
	return func(tp *tracerProvider) {
		tp.config.spanNameScope = scope
	}
}

type scope uint

const (
	scopeNone = iota
	scopeRootSpan
	scopeAllSpans
)
