package definitions

import (
	"context"
	"net/http"
	"time"

	"github.com/gogo/protobuf/proto"
	"github.com/opentracing/opentracing-go"

	"github.com/grafana/loki/v3/pkg/storage/chunk/cache/resultscache"
)

// Codec is used to encode/decode query range requests and responses so they can be passed down to middlewares.
type Codec interface {
	Merger
	// DecodeRequest decodes a Request from an http request.
	DecodeRequest(_ context.Context, request *http.Request, forwardHeaders []string) (Request, error)
	// DecodeResponse decodes a Response from an http response.
	// The original request is also passed as a parameter this is useful for implementation that needs the request
	// to merge result or build the result correctly.
	DecodeResponse(context.Context, *http.Response, Request) (Response, error)
	// EncodeRequest encodes a Request into an http request.
	EncodeRequest(context.Context, Request) (*http.Request, error)
	// EncodeResponse encodes a Response into an http response.
	EncodeResponse(context.Context, *http.Request, Response) (*http.Response, error)
}

// Merger is used by middlewares making multiple requests to merge back all responses into a single one.
type Merger interface {
	// MergeResponse merges responses from multiple requests into a single Response
	MergeResponse(...Response) (Response, error)
}

// Request represents a query range request that can be process by middlewares.
type Request interface {
	proto.Message
	// GetStart returns the start timestamp of the request in milliseconds.
	GetStart() time.Time
	// GetEnd returns the end timestamp of the request in milliseconds.
	GetEnd() time.Time
	// GetStep returns the step of the request in milliseconds.
	GetStep() int64
	// GetQuery returns the query of the request.
	GetQuery() string
	// GetCachingOptions returns the caching options.
	GetCachingOptions() CachingOptions
	// WithStartEnd clone the current request with different start and end timestamp.
	WithStartEnd(start time.Time, end time.Time) Request
	// WithQuery clone the current request with a different query.
	WithQuery(string) Request
	// LogToSpan writes information about this request to an OpenTracing span
	LogToSpan(opentracing.Span)
}

type CachingOptions = resultscache.CachingOptions

// Response represents a query range response.
type Response interface {
	proto.Message
	// GetHeaders returns the HTTP headers in the response.
	GetHeaders() []*PrometheusResponseHeader

	// WithHeaders return the response with all headers overridden.
	WithHeaders([]PrometheusResponseHeader) Response

	// SetHeader sets one header key-value pair. If the key already exists its value is overridden.
	SetHeader(string, string)
}
