package tracing

import (
	"context"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"go.opentelemetry.io/otel/trace/embedded"

	"github.com/grafana/grafana-plugin-sdk-go/internal/tenant"
)

const (
	attributeNameTenantID = "tenant_id"
)

// contextualTracer is a wrapper around a trace.Tracer that adds contextual attributes to spans.
// This is the default tracer used by the SDK.
type contextualTracer struct {
	embedded.Tracer

	tracer trace.Tracer
}

// setContextualSpanAttributes adds contextual attributes to the span.
func (t *contextualTracer) setContextualSpanAttributes(ctx context.Context, span trace.Span) {
	if tid := tenant.IDFromContext(ctx); tid != "" {
		span.SetAttributes(attribute.String(attributeNameTenantID, tid))
	}
}

// Start starts a span with the given name and options using the underlying tracer.
// It then sets the contextual span attrbutes, and returns the span with the contextual attributes,
// along with the new context.
func (t *contextualTracer) Start(ctx context.Context, spanName string, opts ...trace.SpanStartOption) (context.Context, trace.Span) {
	ctx, span := t.tracer.Start(ctx, spanName, opts...)
	t.setContextualSpanAttributes(ctx, span)
	return ctx, span
}
