// Provenance-includes-location: https://github.com/weaveworks/common/blob/main/middleware/http_tracing.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: Weaveworks Ltd.

package middleware

import (
	"context"
	"fmt"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/opentracing-contrib/go-stdlib/nethttp"
	"github.com/opentracing/opentracing-go"
	"github.com/opentracing/opentracing-go/ext"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	semconv "go.opentelemetry.io/otel/semconv/v1.37.0" // otelhttp uses semconv v1.37.0 so we stick to the same version in order to produce consistent attributes on HTTP and HTTPGRPC spans.
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc"

	"github.com/grafana/dskit/httpgrpc"
)

var tracer = otel.Tracer("dskit/middleware")

// Dummy dependency to enforce that we have a nethttp version newer
// than the one which implements Websockets. (No semver on nethttp)
var _ = nethttp.MWURLTagFunc

// Tracer is a middleware which traces incoming requests.
// An empty Tracer is valid, but consider using NewTracer to access all its features.
type Tracer struct {
	SourceIPs *SourceIPExtractor

	traceHeaders         bool
	httpHeadersToExclude map[string]bool
}

// NewTracer creates a new tracer optionally configuring the tracing of HTTP headers.
// The configuration for HTTP headers tracing only applies to OpenTelemetry spans.
func NewTracer(sourceIPs *SourceIPExtractor, traceHeaders bool, excludeHeaders []string) Tracer {
	httpHeadersToExclude := map[string]bool{}
	for header := range AlwaysExcludedHeaders {
		httpHeadersToExclude[header] = true
	}
	for _, header := range excludeHeaders {
		httpHeadersToExclude[header] = true
	}

	return Tracer{
		SourceIPs: sourceIPs,

		traceHeaders:         traceHeaders,
		httpHeadersToExclude: httpHeadersToExclude,
	}
}

// Wrap implements Interface
func (t Tracer) Wrap(next http.Handler) http.Handler {
	if opentracing.IsGlobalTracerRegistered() {
		return t.wrapWithOpenTracing(next)
	}
	// If no OpenTracing, let's do OTel.
	return t.wrapWithOTel(next)
}

func (t Tracer) wrapWithOpenTracing(next http.Handler) http.Handler {
	// Do OpenTracing when it's registered.
	options := []nethttp.MWOption{
		nethttp.OperationNameFunc(httpOperationName),
		nethttp.MWSpanObserver(func(sp opentracing.Span, r *http.Request) {
			// Add a tag with the client's user agent to the span.
			// We add this regardless the traceHeaders flag, for backwards compatibility.
			userAgent := r.Header.Get("User-Agent")
			if userAgent != "" {
				sp.SetTag("http.user_agent", userAgent)
			}

			// Add the content type, useful when query requests are sent as POST.
			// We add this regardless the traceHeaders flag, for backwards compatibility.
			if ct := r.Header.Get("Content-Type"); ct != "" {
				sp.SetTag("http.content_type", ct)
			}

			// add a tag with the client's sourceIPs to the span, if a
			// SourceIPExtractor is given.
			if t.SourceIPs != nil {
				sp.SetTag("sourceIPs", t.SourceIPs.Get(r))
			}
		}),
	}

	return nethttp.Middleware(opentracing.GlobalTracer(), next, options...)
}

func (t Tracer) wrapWithOTel(next http.Handler) http.Handler {
	addSpanAttributes := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sp := trace.SpanFromContext(r.Context())
		if !sp.SpanContext().IsValid() {
			// Span is not valid (which implies it is not sampled), there's no need to waste time adding attributes.
			next.ServeHTTP(w, r)
			return
		}

		attributes := make([]attribute.KeyValue, 0, len(r.Header)+1)

		if route := ExtractRouteName(r.Context()); route != "" {
			attributes = append(attributes, semconv.HTTPRoute(route))
		}

		// Add an attribute with the client's sourceIPs to the span, if a SourceIPExtractor is given.
		if t.SourceIPs != nil {
			attributes = append(attributes, attribute.String("source_ips", t.SourceIPs.Get(r)))
		}

		if t.traceHeaders {
			const maxHeadersToAddAsSpanAttributes = 100

			var notAddedHeaders []string
			if len(r.Header) > maxHeadersToAddAsSpanAttributes {
				notAddedHeaders = make([]string, len(r.Header)-maxHeadersToAddAsSpanAttributes)
			}

			added := 0
			for header, values := range r.Header {
				if added >= maxHeadersToAddAsSpanAttributes {
					notAddedHeaders = append(notAddedHeaders, header)
					continue
				}
				added++
				if _, ok := t.httpHeadersToExclude[header]; ok {
					// Do not add excluded headers to the span attributes, but note that they were sent.
					attributes = append(attributes, attribute.String("http.header."+header+".present", "true"))
					continue
				}
				attributes = append(attributes, attribute.StringSlice("http.header."+header, values))
			}

			if len(notAddedHeaders) > 0 {
				sp.AddEvent("Client sent too many headers, some of them were not included in the span attributes: ", trace.WithAttributes(
					attribute.Int("headers_total", len(r.Header)),
					attribute.StringSlice("headers_not_added_as_span_attributes", notAddedHeaders)),
				)
			}
		}

		if len(attributes) > 0 {
			sp.SetAttributes(attributes...)
		}
		next.ServeHTTP(w, r)
	})

	return otelhttp.NewHandler(addSpanAttributes, "http.tracing", otelhttp.WithSpanNameFormatter(func(_ string, r *http.Request) string {
		return httpOperationName(r)
	}))
}

// HTTPGRPCTracingInterceptor adds additional information about the encapsulated HTTP request
// to httpgrpc trace spans.
//
// The httpgrpc client wraps HTTP requests up into a generic httpgrpc.HTTP/Handle gRPC method.
// The httpgrpc server unwraps httpgrpc.HTTP/Handle gRPC requests into HTTP requests
// and forwards them to its own internal HTTP router.
//
// By default, the server-side tracing spans for the httpgrpc.HTTP/Handle gRPC method
// have no data about the wrapped HTTP request being handled.
//
// HTTPGRPCTracer.Wrap starts a child span with span name and tags following the approach in
// Tracer.Wrap's usage of opentracing-contrib/go-stdlib/nethttp.Middleware
// and attaches the HTTP server span tags to the parent httpgrpc.HTTP/Handle gRPC span, allowing
// tracing tooling to differentiate the HTTP requests represented by the httpgrpc.HTTP/Handle spans.
//
// Note that we cannot do this in the httpgrpc Server implementation, as some applications (eg.
// Mimir's queriers) call Server.Handle() directly, which means we'd attach HTTP-request related
// span tags to whatever parent span is active in the caller, rather than the /httpgrpc.HTTP/Handle
// span created by the tracing middleware for requests that arrive over the network.
func HTTPGRPCTracingInterceptor(router *mux.Router) grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (resp any, err error) {
		if info.FullMethod != "/httpgrpc.HTTP/Handle" {
			return handler(ctx, req)
		}

		httpgrpcRequest, ok := req.(*httpgrpc.HTTPRequest)
		if !ok {
			return handler(ctx, req)
		}

		httpRequest, err := httpgrpc.ToHTTPRequest(ctx, httpgrpcRequest)
		if err != nil {
			return handler(ctx, req)
		}

		if opentracing.IsGlobalTracerRegistered() {
			return handleHTTPGRPCRequestWithOpenTracing(ctx, req, httpRequest, router, handler)
		}

		return handleHTTPGRPCRequestWithOTel(ctx, req, httpRequest, router, handler)
	}
}

func handleHTTPGRPCRequestWithOpenTracing(ctx context.Context, req any, httpRequest *http.Request, router *mux.Router, handler grpc.UnaryHandler) (any, error) {
	tracer := opentracing.GlobalTracer()
	parentSpan := opentracing.SpanFromContext(ctx)

	// extract relevant span & tag data from request
	method := httpRequest.Method
	routeName := getRouteName(router, httpRequest)
	urlPath := httpRequest.URL.Path
	userAgent := httpRequest.Header.Get("User-Agent")

	// tag parent httpgrpc.HTTP/Handle server span, if it exists
	if parentSpan != nil {
		parentSpan.SetTag(string(ext.HTTPUrl), urlPath)
		parentSpan.SetTag(string(ext.HTTPMethod), method)
		parentSpan.SetTag("http.route", routeName)
		parentSpan.SetTag("http.user_agent", userAgent)
	}

	// create and start child HTTP span
	// mirroring opentracing-contrib/go-stdlib/nethttp.Middleware span name and tags
	childSpanName := getOperationName(routeName, httpRequest)
	startSpanOpts := []opentracing.StartSpanOption{
		ext.SpanKindRPCServer,
		opentracing.Tag{Key: string(ext.Component), Value: "net/http"},
		opentracing.Tag{Key: string(ext.HTTPUrl), Value: urlPath},
		opentracing.Tag{Key: string(ext.HTTPMethod), Value: method},
		opentracing.Tag{Key: "http.route", Value: routeName},
		opentracing.Tag{Key: "http.user_agent", Value: userAgent},
	}
	if parentSpan != nil {
		startSpanOpts = append(
			startSpanOpts,
			opentracing.SpanReference{
				Type:              opentracing.ChildOfRef,
				ReferencedContext: parentSpan.Context(),
			})
	}

	childSpan := tracer.StartSpan(childSpanName, startSpanOpts...)
	defer childSpan.Finish()
	ctx = opentracing.ContextWithSpan(ctx, childSpan)
	return handler(ctx, req)
}

func handleHTTPGRPCRequestWithOTel(ctx context.Context, req any, httpRequest *http.Request, router *mux.Router, handler grpc.UnaryHandler) (any, error) {
	// extract relevant span & tag data from request
	method := httpRequest.Method
	routeName := getRouteName(router, httpRequest)
	urlPath := httpRequest.URL.Path
	userAgent := httpRequest.Header.Get("User-Agent")

	parentSpan := trace.SpanFromContext(ctx)
	if parentSpan.SpanContext().IsValid() {
		parentSpan.SetAttributes(
			semconv.HTTPRequestMethodKey.String(method),
			semconv.HTTPRouteKey.String(routeName),
			attribute.String("url.path", urlPath),
			semconv.UserAgentOriginal(userAgent),
		)
	}
	// create and start child HTTP span and set span name and attributes
	childSpanName := getOperationName(routeName, httpRequest)

	startSpanOpts := []trace.SpanStartOption{
		trace.WithSpanKind(trace.SpanKindServer),
		trace.WithAttributes(
			semconv.HTTPRequestMethodKey.String(method),
			semconv.HTTPRouteKey.String(routeName),
			semconv.UserAgentOriginal(userAgent),
			attribute.String("url.path", urlPath),
		),
	}

	var childSpan trace.Span
	ctx, childSpan = tracer.Start(ctx, childSpanName, startSpanOpts...)
	defer childSpan.End()

	return handler(ctx, req)
}

func httpOperationName(r *http.Request) string {
	routeName := ExtractRouteName(r.Context())
	return getOperationName(routeName, r)
}

func getOperationName(routeName string, r *http.Request) string {
	if routeName == "" {
		return "HTTP " + r.Method
	}
	return fmt.Sprintf("HTTP %s - %s", r.Method, routeName)
}
