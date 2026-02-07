package tracing

import (
	"context"
	"fmt"

	"github.com/opentracing/opentracing-go"
	"github.com/opentracing/opentracing-go/ext"
	otlog "github.com/opentracing/opentracing-go/log"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

// Span is either an OpenTracing span or an OpenTelemetry span.
// It could also be a noop span.
type Span struct {
	opentracingSpan opentracing.Span
	otelSpan        trace.Span
}

// StartSpanFromContext starts a new opentracing span if opentracing is registered, otherwise it starts a new otel span.
func StartSpanFromContext(ctx context.Context, operation string, options ...SpanOption) (*Span, context.Context) {
	if opentracing.IsGlobalTracerRegistered() {
		var opentracingOptions []opentracing.StartSpanOption
		for _, opt := range options {
			opentracingOptions = append(opentracingOptions, opt.opentracingSpanOptions()...)
		}
		span, ctx := opentracing.StartSpanFromContext(ctx, operation, opentracingOptions...)
		s := &Span{opentracingSpan: span}
		for _, opt := range options {
			opt.apply(s)
		}
		return s, ctx
	}

	var otelOptions []trace.SpanStartOption
	for _, opt := range options {
		otelOptions = append(otelOptions, opt.otelSpanOptions()...)
	}
	ctx, span := tracer.Start(ctx, operation, otelOptions...)
	s := &Span{otelSpan: span}
	for _, opt := range options {
		opt.apply(s)
	}
	return s, ctx
}

func (s *Span) SetTag(name string, value any) {
	if s.opentracingSpan != nil {
		s.opentracingSpan.SetTag(name, value)
	}
	if s.otelSpan != nil {
		s.otelSpan.SetAttributes(KeyValueToOTelAttribute(name, value))
	}
}

func (s *Span) SetError() {
	if s.otelSpan != nil {
		s.otelSpan.SetStatus(codes.Error, "error")
		return
	}
	if s.opentracingSpan != nil {
		ext.Error.Set(s.opentracingSpan, true)
	}
}

func (s *Span) LogError(err error) {
	if s.otelSpan != nil {
		s.otelSpan.RecordError(err)
		return
	}
	if s.opentracingSpan != nil {
		s.opentracingSpan.LogFields(otlog.Error(err))
	}
}

func (s *Span) Finish() {
	if s.opentracingSpan != nil {
		s.opentracingSpan.Finish()
	}
	if s.otelSpan != nil {
		s.otelSpan.End()
	}
}

func SpanFromContext(ctx context.Context) (otelSpan trace.Span, opentracingSpan opentracing.Span, sampled bool) {
	if opentracingSpan = opentracing.SpanFromContext(ctx); opentracingSpan != nil {
		_, sampled = ExtractSampledTraceID(ctx)
		return nil, opentracingSpan, sampled
	}

	otelSpan = trace.SpanFromContext(ctx)
	otelSpanContext := otelSpan.SpanContext()
	if otelSpanContext.IsValid() {
		return otelSpan, nil, otelSpanContext.IsSampled()
	}

	// noop not sample span.
	// TODO: we could also return the otelSpan here, but at this point it's probably more performant to not-call the opentracing span.
	return nil, opentracing.NoopTracer{}.StartSpan("noop"), false
}

func KeyValueToOTelAttribute(key string, val any) attribute.KeyValue {
	var attr attribute.KeyValue
	switch v := val.(type) {
	case string:
		attr = attribute.String(key, v)
	case int:
		attr = attribute.Int(key, v)
	case int64:
		attr = attribute.Int64(key, v)
	case float64:
		attr = attribute.Float64(key, v)
	case bool:
		attr = attribute.Bool(key, v)
	case []string:
		attr = attribute.StringSlice(key, v)
	case []int:
		attr = attribute.IntSlice(key, v)
	case []int64:
		attr = attribute.Int64Slice(key, v)
	case fmt.Stringer:
		attr = attribute.Stringer(key, v)
	case []byte:
		attr = attribute.String(key, string(v))
	default:
		// Fallback to string representation for unsupported types.
		attr = attribute.String(key, fmt.Sprintf("%v", val))
	}
	return attr
}
