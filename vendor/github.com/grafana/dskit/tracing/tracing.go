// Provenance-includes-location: https://github.com/weaveworks/common/blob/main/tracing/tracing.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: Weaveworks Ltd.

package tracing

import (
	"context"

	"github.com/opentracing/opentracing-go"
	"github.com/pkg/errors"
	jaeger "github.com/uber/jaeger-client-go"
	"go.opentelemetry.io/otel/trace"
)

var (
	// ErrBlankJaegerTraceConfiguration is an error to notify client to provide valid trace report agent or config server.
	ErrBlankJaegerTraceConfiguration = errors.New("no Jaeger trace report agent, config server, or collector endpoint specified")
)

// ExtractTraceID extracts the trace id, if any from the context.
func ExtractTraceID(ctx context.Context) (string, bool) {
	if tid, _, ok := extractJaegerContext(ctx); ok {
		return tid.String(), true
	}
	if tid, _, ok := extractOTelContext(ctx); ok {
		return tid.String(), true
	}
	return "", false
}

// ExtractTraceSpanID extracts the trace id, span id if any from the context.
func ExtractTraceSpanID(ctx context.Context) (string, string, bool) {
	if tid, sid, ok := extractJaegerContext(ctx); ok {
		return tid.String(), sid.String(), true
	}
	if tid, sid, ok := extractOTelContext(ctx); ok {
		return tid.String(), sid.String(), true
	}
	return "", "", false
}

func extractJaegerContext(ctx context.Context) (tid jaeger.TraceID, sid jaeger.SpanID, success bool) {
	sp := opentracing.SpanFromContext(ctx)
	if sp == nil {
		return
	}
	jsp, ok := sp.Context().(jaeger.SpanContext)
	if !ok {
		return
	}
	return jsp.TraceID(), jsp.SpanID(), true
}

func extractOTelContext(ctx context.Context) (tid trace.TraceID, sid trace.SpanID, success bool) {
	sp := trace.SpanFromContext(ctx)
	sc := sp.SpanContext()
	if !sc.IsValid() {
		return
	}
	return sc.TraceID(), sc.SpanID(), true
}

// ExtractSampledTraceID works like ExtractTraceID but the returned bool is only
// true if the returned trace id is sampled.
func ExtractSampledTraceID(ctx context.Context) (string, bool) {
	tid, ok := extractSampledJaegerTraceID(ctx)
	if tid.IsValid() {
		return tid.String(), ok
	}

	otid, ok := extractSampledOTelTraceID(ctx)
	if otid.IsValid() {
		return otid.String(), ok
	}

	return "", false
}

func extractSampledOTelTraceID(ctx context.Context) (traceID trace.TraceID, sampled bool) {
	sp := trace.SpanFromContext(ctx)
	sc := sp.SpanContext()
	return sc.TraceID(), sc.IsValid() && sc.IsSampled()
}

func extractSampledJaegerTraceID(ctx context.Context) (traceID jaeger.TraceID, sampled bool) {
	sp := opentracing.SpanFromContext(ctx)
	if sp == nil {
		return
	}
	sctx, ok := sp.Context().(jaeger.SpanContext)
	if !ok {
		return
	}

	return sctx.TraceID(), sctx.IsSampled()
}
