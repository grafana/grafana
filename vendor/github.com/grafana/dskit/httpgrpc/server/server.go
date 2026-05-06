// Provenance-includes-location: https://github.com/weaveworks/common/blob/main/httpgrpc/server/server.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: Weaveworks Ltd.

package server

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"

	"github.com/go-kit/log/level"
	otgrpc "github.com/opentracing-contrib/go-grpc"
	"github.com/opentracing/opentracing-go"
	"github.com/sercand/kuberesolver/v6"
	"go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"
	"go.opentelemetry.io/contrib/instrumentation/net/http/httptrace/otelhttptrace"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	"github.com/grafana/dskit/httpgrpc"
	"github.com/grafana/dskit/log"
	"github.com/grafana/dskit/middleware"
)

var (
	// DoNotLogErrorHeaderKey is a header name used for marking non-loggable errors. More precisely, if an HTTP response
	// has a status code 5xx, and contains a header with key DoNotLogErrorHeaderKey and any values, the generated error
	// will be marked as non-loggable.
	DoNotLogErrorHeaderKey = http.CanonicalHeaderKey("X-DoNotLogError")

	// ErrorMessageHeaderKey is a header name for header that contains error message that should be used when Server.Handle
	// (httpgrpc.HTTP/Handle implementation) decides to return the response as an error, using status.ErrorProto.
	// Normally Server.Handle would use entire response body as a error message, but Message field of rcp.Status object
	// is a string, and if body contains non-utf8 bytes, marshalling of this object will fail.
	ErrorMessageHeaderKey = http.CanonicalHeaderKey("X-ErrorMessage")
)

type contextType int

const handledByHttpgrpcServer contextType = 0

type Option func(*Server)

func WithReturn4XXErrors(s *Server) {
	s.return4XXErrors = true
}

func applyServerOptions(s *Server, opts ...Option) *Server {
	for _, opt := range opts {
		opt(s)
	}
	return s
}

// Server implements HTTPServer.  HTTPServer is a generated interface that gRPC
// servers must implement.
type Server struct {
	handler         http.Handler
	return4XXErrors bool
}

// NewServer makes a new Server.
func NewServer(handler http.Handler, opts ...Option) *Server {
	return applyServerOptions(&Server{handler: handler}, opts...)
}

// Handle implements HTTPServer.
func (s Server) Handle(ctx context.Context, r *httpgrpc.HTTPRequest) (*httpgrpc.HTTPResponse, error) {
	ctx = context.WithValue(ctx, handledByHttpgrpcServer, true)

	req, err := httpgrpc.ToHTTPRequest(ctx, r)
	if err != nil {
		return nil, err
	}

	recorder := httptest.NewRecorder()
	s.handler.ServeHTTP(recorder, req)
	header := recorder.Header()

	doNotLogError := false
	if _, ok := header[DoNotLogErrorHeaderKey]; ok {
		doNotLogError = true
		header.Del(DoNotLogErrorHeaderKey) // remove before converting to httpgrpc resp
	}

	errorMessageFromHeader := ""
	if msg, ok := header[ErrorMessageHeaderKey]; ok {
		errorMessageFromHeader = msg[0]
		header.Del(ErrorMessageHeaderKey) // remove before converting to httpgrpc resp
	}

	resp := &httpgrpc.HTTPResponse{
		Code:    int32(recorder.Code),
		Headers: httpgrpc.FromHeader(header),
		Body:    recorder.Body.Bytes(),
	}
	if s.shouldReturnError(resp) {
		var err error
		if errorMessageFromHeader != "" {
			err = httpgrpc.ErrorFromHTTPResponseWithMessage(resp, errorMessageFromHeader)
		} else {
			err = httpgrpc.ErrorFromHTTPResponse(resp)
		}
		if doNotLogError {
			err = middleware.DoNotLogError{Err: err}
		}
		return nil, err
	}
	return resp, nil
}

func (s Server) shouldReturnError(resp *httpgrpc.HTTPResponse) bool {
	mask := resp.GetCode() / 100
	return mask == 5 || (s.return4XXErrors && mask == 4)
}

// Client is a http.Handler that forwards the request over gRPC.
type Client struct {
	client httpgrpc.HTTPClient
	conn   *grpc.ClientConn
}

// ParseURL deals with direct:// style URLs, as well as kubernetes:// urls.
// For backwards compatibility it treats URLs without schemes as kubernetes://.
func ParseURL(unparsed string) (string, error) {
	// if it has :///, this is the kuberesolver v2 URL. Return it as it is.
	if strings.Contains(unparsed, ":///") {
		return unparsed, nil
	}

	parsed, err := url.Parse(unparsed)
	if err != nil {
		return "", err
	}

	scheme, host := parsed.Scheme, parsed.Host
	if !strings.Contains(unparsed, "://") {
		scheme, host = "kubernetes", unparsed
	}

	switch scheme {
	case "direct":
		return host, err

	case "kubernetes":
		host, port, err := net.SplitHostPort(host)
		if err != nil {
			return "", err
		}
		parts := strings.SplitN(host, ".", 3)
		service, domain := parts[0], ""
		if len(parts) > 1 {
			namespace := parts[1]
			domain = "." + namespace
		}
		if len(parts) > 2 {
			domain = domain + "." + parts[2]
		}
		address := fmt.Sprintf("kubernetes:///%s", net.JoinHostPort(service+domain, port))
		return address, nil

	default:
		return "", fmt.Errorf("unrecognised scheme: %s", parsed.Scheme)
	}
}

// NewClient makes a new Client, given a kubernetes service address.
func NewClient(address string) (*Client, error) {
	kuberesolver.RegisterInCluster()

	address, err := ParseURL(address)
	if err != nil {
		return nil, err
	}
	const grpcServiceConfig = `{"loadBalancingPolicy":"round_robin"}`

	var unaryInterceptors []grpc.UnaryClientInterceptor
	if opentracing.IsGlobalTracerRegistered() {
		unaryInterceptors = append(unaryInterceptors, otgrpc.OpenTracingClientInterceptor(opentracing.GlobalTracer()))
	}
	unaryInterceptors = append(unaryInterceptors, middleware.ClientUserHeaderInterceptor)

	dialOptions := []grpc.DialOption{
		grpc.WithDefaultServiceConfig(grpcServiceConfig),
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithChainUnaryInterceptor(unaryInterceptors...),
	}
	if !opentracing.IsGlobalTracerRegistered() { // Note: I'm not sure whether this condition is required, feel free to question it.
		dialOptions = append(dialOptions, grpc.WithStatsHandler(otelgrpc.NewClientHandler()))
	}

	conn, err := grpc.NewClient(address, dialOptions...)
	if err != nil {
		return nil, err
	}

	return &Client{
		client: httpgrpc.NewHTTPClient(conn),
		conn:   conn,
	}, nil
}

// ServeHTTP implements http.Handler
func (c *Client) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Are we using OpenTracing?
	if tracer := opentracing.GlobalTracer(); opentracing.IsGlobalTracerRegistered() && tracer != nil {
		if span := opentracing.SpanFromContext(r.Context()); span != nil {
			if err := tracer.Inject(span.Context(), opentracing.HTTPHeaders, opentracing.HTTPHeadersCarrier(r.Header)); err != nil {
				level.Warn(log.Global()).Log("msg", "failed to inject tracing headers into request", "err", err)
			}
		}
	}
	// Are we using OpenTelemetry?
	if span := trace.SpanFromContext(r.Context()); span.SpanContext().IsValid() {
		otelhttptrace.Inject(r.Context(), r)
	}

	req, err := httpgrpc.FromHTTPRequest(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	resp, err := c.client.Handle(r.Context(), req)
	if err != nil {
		// Some errors will actually contain a valid resp, just need to unpack it
		var ok bool
		resp, ok = httpgrpc.HTTPResponseFromError(err)

		if !ok {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	}

	if err := httpgrpc.WriteResponse(w, resp); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
}

// IsHandledByHttpgrpcServer returns true if context is associated with HTTP request that was initiated by
// Server.Handle, which is an implementation of httpgrpc.HTTP/Handle gRPC method.
func IsHandledByHttpgrpcServer(ctx context.Context) bool {
	val := ctx.Value(handledByHttpgrpcServer)
	if v, ok := val.(bool); ok {
		return v
	}
	return false
}
