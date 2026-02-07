// Copyright 2021-2025 The Connect Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package connect

import (
	"context"
	"net/http"
)

// CallInfo represents information relevant to an RPC call.
type CallInfo interface {
	// Spec returns a description of this call.
	Spec() Spec
	// Peer describes the other party for this call.
	Peer() Peer
	// RequestHeader returns the HTTP headers for this request. Headers beginning with
	// "Connect-" and "Grpc-" are reserved for use by the Connect and gRPC
	// protocols: applications may read them but shouldn't write them.
	RequestHeader() http.Header
	// ResponseHeader returns the HTTP headers for this response. Headers beginning with
	// "Connect-" and "Grpc-" are reserved for use by the Connect and gRPC
	// protocols: applications may read them but shouldn't write them.
	// On the client side, this method returns nil before
	// the call is actually made. After the call is made, for streaming operations,
	// this method will block for the server to actually return response headers.
	ResponseHeader() http.Header
	// ResponseTrailer returns the trailers for this response. Depending on the underlying
	// RPC protocol, trailers may be sent as HTTP trailers or a protocol-specific
	// block of in-body metadata.
	//
	// Trailers beginning with "Connect-" and "Grpc-" are reserved for use by the
	// Connect and gRPC protocols: applications may read them but shouldn't write
	// them.
	//
	// On the client side, this method returns nil before the call is actually made.
	// After the call is made, for streaming operations, this method will block
	// for the server to actually return response trailers.
	ResponseTrailer() http.Header
	// HTTPMethod returns the HTTP method for this request. This is nearly always
	// POST, but side-effect-free unary RPCs could be made via a GET.
	//
	// On a newly created request, via NewRequest, this will return the empty
	// string until the actual request is actually sent and the HTTP method
	// determined. This means that client interceptor functions will see the
	// empty string until *after* they delegate to the handler they wrapped. It
	// is even possible for this to return the empty string after such delegation,
	// if the request was never actually sent to the server (and thus no
	// determination ever made about the HTTP method).
	HTTPMethod() string

	internalOnly()
}

// Create a new client (i.e. outgoing) context for use from a client. When the
// returned context is passed to RPCs, the returned call info can be used to set
// request metadata before the RPC is invoked and to inspect response
// metadata after the RPC completes.
//
// The returned context may be re-used across RPCs as long as they are
// not concurrent. Results of all CallInfo methods other than
// RequestHeader() are undefined if the context is used with concurrent RPCs.
func NewClientContext(ctx context.Context) (context.Context, CallInfo) {
	info := &clientCallInfo{}
	return context.WithValue(ctx, clientCallInfoContextKey{}, info), info
}

// CallInfoForHandlerContext returns the CallInfo for the given handler (i.e. incoming) context, if there is one.
func CallInfoForHandlerContext(ctx context.Context) (CallInfo, bool) {
	value, ok := ctx.Value(handlerCallInfoContextKey{}).(CallInfo)
	return value, ok
}

// handlerCallInfo is a CallInfo implementation used for unary handlers.
type handlerCallInfo struct {
	spec            Spec
	peer            Peer
	method          string
	requestHeader   http.Header
	responseHeader  http.Header
	responseTrailer http.Header
}

func (c *handlerCallInfo) Spec() Spec {
	return c.spec
}

func (c *handlerCallInfo) Peer() Peer {
	return c.peer
}

func (c *handlerCallInfo) RequestHeader() http.Header {
	if c.requestHeader == nil {
		c.requestHeader = make(http.Header)
	}
	return c.requestHeader
}

func (c *handlerCallInfo) ResponseHeader() http.Header {
	if c.responseHeader == nil {
		c.responseHeader = make(http.Header)
	}
	return c.responseHeader
}

func (c *handlerCallInfo) ResponseTrailer() http.Header {
	if c.responseTrailer == nil {
		c.responseTrailer = make(http.Header)
	}
	return c.responseTrailer
}

func (c *handlerCallInfo) HTTPMethod() string {
	return c.method
}

// internalOnly implements CallInfo.
func (c *handlerCallInfo) internalOnly() {}

// streamingHandlerCallInfo is a CallInfo implementation used for streaming RPC handlers.
type streamingHandlerCallInfo struct {
	conn StreamingHandlerConn
}

func (c *streamingHandlerCallInfo) Spec() Spec {
	return c.conn.Spec()
}

func (c *streamingHandlerCallInfo) Peer() Peer {
	return c.conn.Peer()
}

func (c *streamingHandlerCallInfo) RequestHeader() http.Header {
	return c.conn.RequestHeader()
}

func (c *streamingHandlerCallInfo) ResponseHeader() http.Header {
	return c.conn.ResponseHeader()
}

func (c *streamingHandlerCallInfo) ResponseTrailer() http.Header {
	return c.conn.ResponseTrailer()
}

func (c *streamingHandlerCallInfo) HTTPMethod() string {
	// All stream calls are POSTs
	return http.MethodPost
}

// internalOnly implements CallInfo.
func (c *streamingHandlerCallInfo) internalOnly() {}

// clientCallInfo is a CallInfo implementation used for clients.
type clientCallInfo struct {
	responseSource
	spec          Spec
	peer          Peer
	method        string
	requestHeader http.Header
}

func (c *clientCallInfo) Spec() Spec {
	return c.spec
}

func (c *clientCallInfo) Peer() Peer {
	return c.peer
}

func (c *clientCallInfo) RequestHeader() http.Header {
	if c.requestHeader == nil {
		c.requestHeader = make(http.Header)
	}
	return c.requestHeader
}

func (c *clientCallInfo) ResponseHeader() http.Header {
	if c.responseSource == nil {
		return nil
	}
	return c.responseSource.ResponseHeader()
}

func (c *clientCallInfo) ResponseTrailer() http.Header {
	if c.responseSource == nil {
		return nil
	}
	return c.responseSource.ResponseTrailer()
}

func (c *clientCallInfo) HTTPMethod() string {
	return c.method
}

// internalOnly implements CallInfo.
func (c *clientCallInfo) internalOnly() {}

// clientCallInfoContextKey is the key used to store client call info in context.
type clientCallInfoContextKey struct{}

// sentinelContextKey is the key used to store a copy of client call info in context
// when a request is made.
// Each step in an interceptor chain compares the actual call info with the
// sentinel call info. If the two values are different, the request will
// return an error in the interceptor.
// This protects against changing the call info in interceptors, which is prohibited
// as it would allow users to modify call info mid-flight independent of the actual
// request or response.
// Users who wish to modify call info data such as headers and trailers should instead
// use Connect [Request] and [Response] wrapper types.
type sentinelContextKey struct{}

// handlerCallInfoContextKey is the key used to store handler call info in context.
type handlerCallInfoContextKey struct{}

// responseSource indicates a type that manages response headers and trailers.
type responseSource interface {
	ResponseHeader() http.Header
	ResponseTrailer() http.Header
}

// clientCallInfoForContext gets the call info from a client/outgoing context.
func clientCallInfoForContext(ctx context.Context) (*clientCallInfo, bool) {
	info, ok := ctx.Value(clientCallInfoContextKey{}).(*clientCallInfo)
	return info, ok
}

// newHandlerContext creates a new handler/incoming context.
func newHandlerContext(ctx context.Context, info CallInfo) context.Context {
	return context.WithValue(ctx, handlerCallInfoContextKey{}, info)
}
