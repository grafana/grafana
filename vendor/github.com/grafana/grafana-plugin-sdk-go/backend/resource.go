package backend

import (
	"context"
	"net/http"
	"net/textproto"
)

// EndpointCallResource friendly name for the call resource endpoint/handler.
const EndpointCallResource Endpoint = "callResource"

// CallResourceRequest represents a request for a resource call.
type CallResourceRequest struct {
	// PluginContext the contextual information for the request.
	PluginContext PluginContext

	// Path the forwarded HTTP path for the request.
	Path string

	// Method the forwarded HTTP method for the request.
	Method string

	// URL the forwarded HTTP URL for the request.
	URL string

	// Headers the forwarded HTTP headers for the request, if any.
	//
	// Recommended to use GetHTTPHeaders or GetHTTPHeader
	// since it automatically handles canonicalization of
	// HTTP header keys.
	Headers map[string][]string

	// Body the forwarded HTTP body for the request, if any.
	Body []byte
}

// SetHTTPHeader sets the header entries associated with key to the
// single element value. It replaces any existing values
// associated with key. The key is case-insensitive; it is
// canonicalized by textproto.CanonicalMIMEHeaderKey.
func (req *CallResourceRequest) SetHTTPHeader(key, value string) {
	if req.Headers == nil {
		req.Headers = map[string][]string{}
	}

	req.Headers[key] = []string{value}
}

// DeleteHTTPHeader deletes the values associated with key.
// The key is case-insensitive; it is canonicalized by
// CanonicalHeaderKey.
func (req *CallResourceRequest) DeleteHTTPHeader(key string) {
	if req.Headers == nil {
		return
	}

	for k := range req.Headers {
		if textproto.CanonicalMIMEHeaderKey(k) == textproto.CanonicalMIMEHeaderKey(key) {
			delete(req.Headers, k)
			break
		}
	}
}

// GetHTTPHeader gets the first value associated with the given key. If
// there are no values associated with the key, Get returns "".
// It is case-insensitive; textproto.CanonicalMIMEHeaderKey is
// used to canonicalize the provided key. Get assumes that all
// keys are stored in canonical form.
func (req *CallResourceRequest) GetHTTPHeader(key string) string {
	return req.GetHTTPHeaders().Get(key)
}

// GetHTTPHeaders returns HTTP headers.
func (req *CallResourceRequest) GetHTTPHeaders() http.Header {
	httpHeaders := http.Header{}

	for k, v := range req.Headers {
		for _, strVal := range v {
			httpHeaders.Add(k, strVal)
		}
	}

	return httpHeaders
}

// CallResourceResponse represents a response from a resource call.
type CallResourceResponse struct {
	// Status the HTTP response status.
	Status int

	// Headers the HTTP response headers.
	Headers map[string][]string

	// Body the HTTP response body.
	Body []byte
}

// CallResourceResponseSender is used for sending resource call responses.
type CallResourceResponseSender interface {
	Send(*CallResourceResponse) error
}

// CallResourceResponseSenderFunc is an adapter to allow the use of
// ordinary functions as [CallResourceResponseSender]. If f is a function
// with the appropriate signature, CallResourceResponseSenderFunc(f) is a
// [CallResourceResponseSender] that calls f.
type CallResourceResponseSenderFunc func(resp *CallResourceResponse) error

// Send calls fn(resp).
func (fn CallResourceResponseSenderFunc) Send(resp *CallResourceResponse) error {
	return fn(resp)
}

// CallResourceHandler handles resource calls.
type CallResourceHandler interface {
	CallResource(ctx context.Context, req *CallResourceRequest, sender CallResourceResponseSender) error
}

// CallResourceHandlerFunc is an adapter to allow the use of
// ordinary functions as [CallResourceHandler]. If f is a function
// with the appropriate signature, CallResourceHandlerFunc(f) is a
// [CallResourceHandler] that calls f.
type CallResourceHandlerFunc func(ctx context.Context, req *CallResourceRequest, sender CallResourceResponseSender) error

// CallResource calls fn(ctx, req, sender).
func (fn CallResourceHandlerFunc) CallResource(ctx context.Context, req *CallResourceRequest, sender CallResourceResponseSender) error {
	return fn(ctx, req, sender)
}

var _ ForwardHTTPHeaders = (*CallResourceRequest)(nil)
