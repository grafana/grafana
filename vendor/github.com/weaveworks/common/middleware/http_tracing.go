package middleware

import (
	"fmt"
	"net/http"

	"github.com/opentracing-contrib/go-stdlib/nethttp"
	"github.com/opentracing/opentracing-go"
	jaeger "github.com/uber/jaeger-client-go"
	"golang.org/x/net/context"
)

// Dummy dependency to enforce that we have a nethttp version newer
// than the one which implements Websockets. (No semver on nethttp)
var _ = nethttp.MWURLTagFunc

// Tracer is a middleware which traces incoming requests.
type Tracer struct {
	RouteMatcher RouteMatcher
	SourceIPs    *SourceIPExtractor
}

// Wrap implements Interface
func (t Tracer) Wrap(next http.Handler) http.Handler {
	options := []nethttp.MWOption{
		nethttp.OperationNameFunc(func(r *http.Request) string {
			op := getRouteName(t.RouteMatcher, r)
			if op == "" {
				return "HTTP " + r.Method
			}

			return fmt.Sprintf("HTTP %s - %s", r.Method, op)
		}),
	}
	if t.SourceIPs != nil {
		options = append(options, nethttp.MWSpanObserver(func(sp opentracing.Span, r *http.Request) {
			sp.SetTag("sourceIPs", t.SourceIPs.Get(r))
		}))
	}

	return nethttp.Middleware(opentracing.GlobalTracer(), next, options...)
}

// ExtractTraceID extracts the trace id, if any from the context.
func ExtractTraceID(ctx context.Context) (string, bool) {
	sp := opentracing.SpanFromContext(ctx)
	if sp == nil {
		return "", false
	}
	sctx, ok := sp.Context().(jaeger.SpanContext)
	if !ok {
		return "", false
	}

	return sctx.TraceID().String(), true
}

// ExtractSampledTraceID works like ExtractTraceID but the returned bool is only
// true if the returned trace id is sampled.
func ExtractSampledTraceID(ctx context.Context) (string, bool) {
	sp := opentracing.SpanFromContext(ctx)
	if sp == nil {
		return "", false
	}
	sctx, ok := sp.Context().(jaeger.SpanContext)
	if !ok {
		return "", false
	}

	return sctx.TraceID().String(), sctx.IsSampled()
}
