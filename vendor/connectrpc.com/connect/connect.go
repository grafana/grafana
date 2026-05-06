// Copyright 2021-2024 The Connect Authors
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

// Package connect is a slim RPC framework built on Protocol Buffers and
// [net/http]. In addition to supporting its own protocol, Connect handlers and
// clients are wire-compatible with gRPC and gRPC-Web, including streaming.
//
// This documentation is intended to explain each type and function in
// isolation. Walkthroughs, FAQs, and other narrative docs are available on the
// [Connect website], and there's a working [demonstration service] on Github.
//
// [Connect website]: https://connectrpc.com
// [demonstration service]: https://github.com/connectrpc/examples-go
package connect

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
)

// Version is the semantic version of the connect module.
const Version = "1.18.1"

// These constants are used in compile-time handshakes with connect's generated
// code.
const (
	IsAtLeastVersion0_0_1  = true
	IsAtLeastVersion0_1_0  = true
	IsAtLeastVersion1_7_0  = true
	IsAtLeastVersion1_13_0 = true
)

// StreamType describes whether the client, server, neither, or both is
// streaming.
type StreamType uint8

const (
	StreamTypeUnary  StreamType = 0b00
	StreamTypeClient StreamType = 0b01
	StreamTypeServer StreamType = 0b10
	StreamTypeBidi              = StreamTypeClient | StreamTypeServer
)

func (s StreamType) String() string {
	switch s {
	case StreamTypeUnary:
		return "unary"
	case StreamTypeClient:
		return "client"
	case StreamTypeServer:
		return "server"
	case StreamTypeBidi:
		return "bidi"
	}
	return fmt.Sprintf("stream_%d", s)
}

// StreamingHandlerConn is the server's view of a bidirectional message
// exchange. Interceptors for streaming RPCs may wrap StreamingHandlerConns.
//
// Like the standard library's [http.ResponseWriter], StreamingHandlerConns write
// response headers to the network with the first call to Send. Any subsequent
// mutations are effectively no-ops. Handlers may mutate response trailers at
// any time before returning. When the client has finished sending data,
// Receive returns an error wrapping [io.EOF]. Handlers should check for this
// using the standard library's [errors.Is].
//
// Headers and trailers beginning with "Connect-" and "Grpc-" are reserved for
// use by the gRPC and Connect protocols: applications may read them but
// shouldn't write them.
//
// StreamingHandlerConn implementations provided by this module guarantee that
// all returned errors can be cast to [*Error] using the standard library's
// [errors.As].
//
// StreamingHandlerConn implementations do not need to be safe for concurrent use.
type StreamingHandlerConn interface {
	Spec() Spec
	Peer() Peer

	Receive(any) error
	RequestHeader() http.Header

	Send(any) error
	ResponseHeader() http.Header
	ResponseTrailer() http.Header
}

// StreamingClientConn is the client's view of a bidirectional message exchange.
// Interceptors for streaming RPCs may wrap StreamingClientConns.
//
// StreamingClientConns write request headers to the network with the first
// call to Send. Any subsequent mutations are effectively no-ops. When the
// server is done sending data, the StreamingClientConn's Receive method
// returns an error wrapping [io.EOF]. Clients should check for this using the
// standard library's [errors.Is]. If the server encounters an error during
// processing, subsequent calls to the StreamingClientConn's Send method will
// return an error wrapping [io.EOF]; clients may then call Receive to unmarshal
// the error.
//
// Headers and trailers beginning with "Connect-" and "Grpc-" are reserved for
// use by the gRPC and Connect protocols: applications may read them but
// shouldn't write them.
//
// StreamingClientConn implementations provided by this module guarantee that
// all returned errors can be cast to [*Error] using the standard library's
// [errors.As].
//
// In order to support bidirectional streaming RPCs, all StreamingClientConn
// implementations must support limited concurrent use. See the comments on
// each group of methods for details.
type StreamingClientConn interface {
	// Spec and Peer must be safe to call concurrently with all other methods.
	Spec() Spec
	Peer() Peer

	// Send, RequestHeader, and CloseRequest may race with each other, but must
	// be safe to call concurrently with all other methods.
	Send(any) error
	RequestHeader() http.Header
	CloseRequest() error

	// Receive, ResponseHeader, ResponseTrailer, and CloseResponse may race with
	// each other, but must be safe to call concurrently with all other methods.
	Receive(any) error
	ResponseHeader() http.Header
	ResponseTrailer() http.Header
	CloseResponse() error
}

// Request is a wrapper around a generated request message. It provides
// access to metadata like headers and the RPC specification, as well as
// strongly-typed access to the message itself.
type Request[T any] struct {
	Msg *T

	spec   Spec
	peer   Peer
	header http.Header
	method string
}

// NewRequest wraps a generated request message.
func NewRequest[T any](message *T) *Request[T] {
	return &Request[T]{
		Msg: message,
		// Initialized lazily so we don't allocate unnecessarily.
		header: nil,
	}
}

// Any returns the concrete request message as an empty interface, so that
// *Request implements the [AnyRequest] interface.
func (r *Request[_]) Any() any {
	return r.Msg
}

// Spec returns a description of this RPC.
func (r *Request[_]) Spec() Spec {
	return r.spec
}

// Peer describes the other party for this RPC.
func (r *Request[_]) Peer() Peer {
	return r.peer
}

// Header returns the HTTP headers for this request. Headers beginning with
// "Connect-" and "Grpc-" are reserved for use by the Connect and gRPC
// protocols: applications may read them but shouldn't write them.
func (r *Request[_]) Header() http.Header {
	if r.header == nil {
		r.header = make(http.Header)
	}
	return r.header
}

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
func (r *Request[_]) HTTPMethod() string {
	return r.method
}

// internalOnly implements AnyRequest.
func (r *Request[_]) internalOnly() {}

// setRequestMethod sets the request method to the given value.
func (r *Request[_]) setRequestMethod(method string) {
	r.method = method
}

// AnyRequest is the common method set of every [Request], regardless of type
// parameter. It's used in unary interceptors.
//
// Headers and trailers beginning with "Connect-" and "Grpc-" are reserved for
// use by the gRPC and Connect protocols: applications may read them but
// shouldn't write them.
//
// To preserve our ability to add methods to this interface without breaking
// backward compatibility, only types defined in this package can implement
// AnyRequest.
type AnyRequest interface {
	Any() any
	Spec() Spec
	Peer() Peer
	Header() http.Header
	HTTPMethod() string

	internalOnly()
	setRequestMethod(string)
}

// Response is a wrapper around a generated response message. It provides
// access to metadata like headers and trailers, as well as strongly-typed
// access to the message itself.
type Response[T any] struct {
	Msg *T

	header  http.Header
	trailer http.Header
}

// NewResponse wraps a generated response message.
func NewResponse[T any](message *T) *Response[T] {
	return &Response[T]{
		Msg: message,
		// Initialized lazily so we don't allocate unnecessarily.
		header:  nil,
		trailer: nil,
	}
}

// Any returns the concrete response message as an empty interface, so that
// *Response implements the [AnyResponse] interface.
func (r *Response[_]) Any() any {
	return r.Msg
}

// Header returns the HTTP headers for this response. Headers beginning with
// "Connect-" and "Grpc-" are reserved for use by the Connect and gRPC
// protocols: applications may read them but shouldn't write them.
func (r *Response[_]) Header() http.Header {
	if r.header == nil {
		r.header = make(http.Header)
	}
	return r.header
}

// Trailer returns the trailers for this response. Depending on the underlying
// RPC protocol, trailers may be sent as HTTP trailers or a protocol-specific
// block of in-body metadata.
//
// Trailers beginning with "Connect-" and "Grpc-" are reserved for use by the
// Connect and gRPC protocols: applications may read them but shouldn't write
// them.
func (r *Response[_]) Trailer() http.Header {
	if r.trailer == nil {
		r.trailer = make(http.Header)
	}
	return r.trailer
}

// internalOnly implements AnyResponse.
func (r *Response[_]) internalOnly() {}

// AnyResponse is the common method set of every [Response], regardless of type
// parameter. It's used in unary interceptors.
//
// Headers and trailers beginning with "Connect-" and "Grpc-" are reserved for
// use by the gRPC and Connect protocols: applications may read them but
// shouldn't write them.
//
// To preserve our ability to add methods to this interface without breaking
// backward compatibility, only types defined in this package can implement
// AnyResponse.
type AnyResponse interface {
	Any() any
	Header() http.Header
	Trailer() http.Header

	internalOnly()
}

// HTTPClient is the interface connect expects HTTP clients to implement. The
// standard library's *http.Client implements HTTPClient.
type HTTPClient interface {
	Do(*http.Request) (*http.Response, error)
}

// Spec is a description of a client call or a handler invocation.
//
// If you're using Protobuf, protoc-gen-connect-go generates a constant for the
// fully-qualified Procedure corresponding to each RPC in your schema.
type Spec struct {
	StreamType       StreamType
	Schema           any    // for protobuf RPCs, a protoreflect.MethodDescriptor
	Procedure        string // for example, "/acme.foo.v1.FooService/Bar"
	IsClient         bool   // otherwise we're in a handler
	IdempotencyLevel IdempotencyLevel
}

// Peer describes the other party to an RPC.
//
// When accessed client-side, Addr contains the host or host:port from the
// server's URL. When accessed server-side, Addr contains the client's address
// in IP:port format.
//
// On both the client and the server, Protocol is the RPC protocol in use.
// Currently, it's either [ProtocolConnect], [ProtocolGRPC], or
// [ProtocolGRPCWeb], but additional protocols may be added in the future.
//
// Query contains the query parameters for the request. For the server, this
// will reflect the actual query parameters sent. For the client, it is unset.
type Peer struct {
	Addr     string
	Protocol string
	Query    url.Values // server-only
}

func newPeerFromURL(url *url.URL, protocol string) Peer {
	return Peer{
		Addr:     url.Host,
		Protocol: protocol,
	}
}

// handlerConnCloser extends StreamingHandlerConn with a method for handlers to
// terminate the message exchange (and optionally send an error to the client).
type handlerConnCloser interface {
	StreamingHandlerConn

	Close(error) error
}

// receiveConn represents the shared methods of both StreamingClientConn and StreamingHandlerConn
// that the below helper functions use for implementing the rules around a "unary" stream, that
// is expected to have exactly one message (or zero messages followed by a non-EOF error).
type receiveConn interface {
	Spec() Spec
	Receive(any) error
}

// hasHTTPMethod is implemented by streaming connections that support HTTP methods other than
// POST.
type hasHTTPMethod interface {
	getHTTPMethod() string
}

// receiveUnaryResponse unmarshals a message from a StreamingClientConn, then
// envelopes the message and attaches headers and trailers. It attempts to
// consume the response stream and isn't appropriate when receiving multiple
// messages.
func receiveUnaryResponse[T any](conn StreamingClientConn, initializer maybeInitializer) (*Response[T], error) {
	msg, err := receiveUnaryMessage[T](conn, initializer, "response")
	if err != nil {
		return nil, err
	}
	return &Response[T]{
		Msg:     msg,
		header:  conn.ResponseHeader(),
		trailer: conn.ResponseTrailer(),
	}, nil
}

// receiveUnaryRequest unmarshals a message from a StreamingClientConn, then
// envelopes the message and attaches headers and other request properties. It
// attempts to consume the request stream and isn't appropriate when receiving
// multiple messages.
func receiveUnaryRequest[T any](conn StreamingHandlerConn, initializer maybeInitializer) (*Request[T], error) {
	msg, err := receiveUnaryMessage[T](conn, initializer, "request")
	if err != nil {
		return nil, err
	}
	method := http.MethodPost
	if hasRequestMethod, ok := conn.(hasHTTPMethod); ok {
		method = hasRequestMethod.getHTTPMethod()
	}
	return &Request[T]{
		Msg:    msg,
		spec:   conn.Spec(),
		peer:   conn.Peer(),
		header: conn.RequestHeader(),
		method: method,
	}, nil
}

func receiveUnaryMessage[T any](conn receiveConn, initializer maybeInitializer, what string) (*T, error) {
	var msg T
	if err := initializer.maybe(conn.Spec(), &msg); err != nil {
		return nil, err
	}
	// Possibly counter-intuitive, but the gRPC specs about error codes state that both clients
	// and servers should return "unimplemented" when they encounter a cardinality violation: where
	// the number of messages in the stream is wrong. Search for "cardinality violation" in the
	// following docs:
	//    https://grpc.github.io/grpc/core/md_doc_statuscodes.html
	if err := conn.Receive(&msg); err != nil {
		if errors.Is(err, io.EOF) {
			err = NewError(CodeUnimplemented, fmt.Errorf("unary %s has zero messages", what))
		}
		return nil, err
	}
	// In a well-formed stream, the one message must be the only content in the body.
	// To verify that it is well-formed, try to read another message from the stream.
	// TODO: optimize this second receive: ideally do it w/out allocation, w/out
	//       fully reading next message (if one is present), and w/out trying to
	//       actually unmarshal the bytes)
	var msg2 T
	if err := initializer.maybe(conn.Spec(), &msg2); err != nil {
		return nil, err
	}
	if err := conn.Receive(&msg2); !errors.Is(err, io.EOF) {
		if err == nil {
			err = NewError(CodeUnimplemented, fmt.Errorf("unary %s has multiple messages", what))
		}
		return nil, err
	}
	return &msg, nil
}
