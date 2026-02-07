package tracing

import (
	"github.com/opentracing/opentracing-go"
	"github.com/opentracing/opentracing-go/ext"
	"go.opentelemetry.io/otel/trace"
)

var _ SpanOption = SpanKindRPCClient{}

type SpanOption interface {
	opentracingSpanOptions() []opentracing.StartSpanOption
	otelSpanOptions() []trace.SpanStartOption
	apply(*Span)
}

type SpanKindRPCClient struct{}

func (SpanKindRPCClient) opentracingSpanOptions() []opentracing.StartSpanOption { return nil }

func (SpanKindRPCClient) otelSpanOptions() []trace.SpanStartOption {
	return []trace.SpanStartOption{trace.WithSpanKind(trace.SpanKindClient)}
}

func (SpanKindRPCClient) apply(span *Span) {
	if span.opentracingSpan != nil {
		ext.SpanKindRPCClient.Set(span.opentracingSpan)
	}
}
