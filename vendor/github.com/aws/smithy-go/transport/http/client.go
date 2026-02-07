package http

import (
	"context"
	"fmt"
	"net/http"

	smithy "github.com/aws/smithy-go"
	"github.com/aws/smithy-go/metrics"
	"github.com/aws/smithy-go/middleware"
	"github.com/aws/smithy-go/tracing"
)

// ClientDo provides the interface for custom HTTP client implementations.
type ClientDo interface {
	Do(*http.Request) (*http.Response, error)
}

// ClientDoFunc provides a helper to wrap a function as an HTTP client for
// round tripping requests.
type ClientDoFunc func(*http.Request) (*http.Response, error)

// Do will invoke the underlying func, returning the result.
func (fn ClientDoFunc) Do(r *http.Request) (*http.Response, error) {
	return fn(r)
}

// ClientHandler wraps a client that implements the HTTP Do method. Standard
// implementation is http.Client.
type ClientHandler struct {
	client ClientDo

	Meter metrics.Meter // For HTTP client metrics.
}

// NewClientHandler returns an initialized middleware handler for the client.
//
// Deprecated: Use [NewClientHandlerWithOptions].
func NewClientHandler(client ClientDo) ClientHandler {
	return NewClientHandlerWithOptions(client)
}

// NewClientHandlerWithOptions returns an initialized middleware handler for the client
// with applied options.
func NewClientHandlerWithOptions(client ClientDo, opts ...func(*ClientHandler)) ClientHandler {
	h := ClientHandler{
		client: client,
	}
	for _, opt := range opts {
		opt(&h)
	}
	if h.Meter == nil {
		h.Meter = metrics.NopMeterProvider{}.Meter("")
	}
	return h
}

// Handle implements the middleware Handler interface, that will invoke the
// underlying HTTP client. Requires the input to be a Smithy *Request. Returns
// a smithy *Response, or error if the request failed.
func (c ClientHandler) Handle(ctx context.Context, input interface{}) (
	out interface{}, metadata middleware.Metadata, err error,
) {
	ctx, span := tracing.StartSpan(ctx, "DoHTTPRequest")
	defer span.End()

	ctx, client, err := withMetrics(ctx, c.client, c.Meter)
	if err != nil {
		return nil, metadata, fmt.Errorf("instrument with HTTP metrics: %w", err)
	}

	req, ok := input.(*Request)
	if !ok {
		return nil, metadata, fmt.Errorf("expect Smithy http.Request value as input, got unsupported type %T", input)
	}

	builtRequest := req.Build(ctx)
	if err := ValidateEndpointHost(builtRequest.Host); err != nil {
		return nil, metadata, err
	}

	span.SetProperty("http.method", req.Method)
	span.SetProperty("http.request_content_length", -1) // at least indicate unknown
	length, ok, err := req.StreamLength()
	if err != nil {
		return nil, metadata, err
	}
	if ok {
		span.SetProperty("http.request_content_length", length)
	}

	resp, err := client.Do(builtRequest)
	if resp == nil {
		// Ensure a http response value is always present to prevent unexpected
		// panics.
		resp = &http.Response{
			Header: http.Header{},
			Body:   http.NoBody,
		}
	}
	if err != nil {
		err = &RequestSendError{Err: err}

		// Override the error with a context canceled error, if that was canceled.
		select {
		case <-ctx.Done():
			err = &smithy.CanceledError{Err: ctx.Err()}
		default:
		}
	}

	// HTTP RoundTripper *should* close the request body. But this may not happen in a timely manner.
	// So instead Smithy *Request Build wraps the body to be sent in a safe closer that will clear the
	// stream reference so that it can be safely reused.
	if builtRequest.Body != nil {
		_ = builtRequest.Body.Close()
	}

	span.SetProperty("net.protocol.version", fmt.Sprintf("%d.%d", resp.ProtoMajor, resp.ProtoMinor))
	span.SetProperty("http.status_code", resp.StatusCode)
	span.SetProperty("http.response_content_length", resp.ContentLength)

	return &Response{Response: resp}, metadata, err
}

// RequestSendError provides a generic request transport error. This error
// should wrap errors making HTTP client requests.
//
// The ClientHandler will wrap the HTTP client's error if the client request
// fails, and did not fail because of context canceled.
type RequestSendError struct {
	Err error
}

// ConnectionError returns that the error is related to not being able to send
// the request, or receive a response from the service.
func (e *RequestSendError) ConnectionError() bool {
	return true
}

// Unwrap returns the underlying error, if there was one.
func (e *RequestSendError) Unwrap() error {
	return e.Err
}

func (e *RequestSendError) Error() string {
	return fmt.Sprintf("request send failed, %v", e.Err)
}

// NopClient provides a client that ignores the request, and returns an empty
// successful HTTP response value.
type NopClient struct{}

// Do ignores the request and returns a 200 status empty response.
func (NopClient) Do(r *http.Request) (*http.Response, error) {
	return &http.Response{
		StatusCode: 200,
		Header:     http.Header{},
		Body:       http.NoBody,
	}, nil
}
