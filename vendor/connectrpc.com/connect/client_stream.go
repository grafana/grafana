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

package connect

import (
	"errors"
	"io"
	"net/http"
)

// ClientStreamForClient is the client's view of a client streaming RPC.
//
// It's returned from [Client].CallClientStream, but doesn't currently have an
// exported constructor function.
type ClientStreamForClient[Req, Res any] struct {
	conn        StreamingClientConn
	initializer maybeInitializer
	// Error from client construction. If non-nil, return for all calls.
	err error
}

// Spec returns the specification for the RPC.
func (c *ClientStreamForClient[_, _]) Spec() Spec {
	return c.conn.Spec()
}

// Peer describes the server for the RPC.
func (c *ClientStreamForClient[_, _]) Peer() Peer {
	return c.conn.Peer()
}

// RequestHeader returns the request headers. Headers are sent to the server with the
// first call to Send.
//
// Headers beginning with "Connect-" and "Grpc-" are reserved for use by the
// Connect and gRPC protocols. Applications shouldn't write them.
func (c *ClientStreamForClient[Req, Res]) RequestHeader() http.Header {
	if c.err != nil {
		return http.Header{}
	}
	return c.conn.RequestHeader()
}

// Send a message to the server. The first call to Send also sends the request
// headers.
//
// If the server returns an error, Send returns an error that wraps [io.EOF].
// Clients should check for case using the standard library's [errors.Is] and
// unmarshal the error using CloseAndReceive.
func (c *ClientStreamForClient[Req, Res]) Send(request *Req) error {
	if c.err != nil {
		return c.err
	}
	if request == nil {
		return c.conn.Send(nil)
	}
	return c.conn.Send(request)
}

// CloseAndReceive closes the send side of the stream and waits for the
// response.
func (c *ClientStreamForClient[Req, Res]) CloseAndReceive() (*Response[Res], error) {
	if c.err != nil {
		return nil, c.err
	}
	if err := c.conn.CloseRequest(); err != nil {
		_ = c.conn.CloseResponse()
		return nil, err
	}
	response, err := receiveUnaryResponse[Res](c.conn, c.initializer)
	if err != nil {
		_ = c.conn.CloseResponse()
		return nil, err
	}
	return response, c.conn.CloseResponse()
}

// Conn exposes the underlying StreamingClientConn. This may be useful if
// you'd prefer to wrap the connection in a different high-level API.
func (c *ClientStreamForClient[Req, Res]) Conn() (StreamingClientConn, error) {
	return c.conn, c.err
}

// ServerStreamForClient is the client's view of a server streaming RPC.
//
// It's returned from [Client].CallServerStream, but doesn't currently have an
// exported constructor function.
type ServerStreamForClient[Res any] struct {
	conn        StreamingClientConn
	initializer maybeInitializer
	msg         *Res
	// Error from client construction. If non-nil, return for all calls.
	constructErr error
	// Error from conn.Receive().
	receiveErr error
}

// Receive advances the stream to the next message, which will then be
// available through the Msg method. It returns false when the stream stops,
// either by reaching the end or by encountering an unexpected error. After
// Receive returns false, the Err method will return any unexpected error
// encountered.
func (s *ServerStreamForClient[Res]) Receive() bool {
	if s.constructErr != nil || s.receiveErr != nil {
		return false
	}
	s.msg = new(Res)
	if err := s.initializer.maybe(s.conn.Spec(), s.msg); err != nil {
		s.receiveErr = err
		return false
	}
	s.receiveErr = s.conn.Receive(s.msg)
	return s.receiveErr == nil
}

// Msg returns the most recent message unmarshaled by a call to Receive.
func (s *ServerStreamForClient[Res]) Msg() *Res {
	if s.msg == nil {
		s.msg = new(Res)
	}
	return s.msg
}

// Err returns the first non-EOF error that was encountered by Receive.
func (s *ServerStreamForClient[Res]) Err() error {
	if s.constructErr != nil {
		return s.constructErr
	}
	if s.receiveErr != nil && !errors.Is(s.receiveErr, io.EOF) {
		return s.receiveErr
	}
	return nil
}

// ResponseHeader returns the headers received from the server. It blocks until
// the first call to Receive returns.
func (s *ServerStreamForClient[Res]) ResponseHeader() http.Header {
	if s.constructErr != nil {
		return http.Header{}
	}
	return s.conn.ResponseHeader()
}

// ResponseTrailer returns the trailers received from the server. Trailers
// aren't fully populated until Receive() returns an error wrapping io.EOF.
func (s *ServerStreamForClient[Res]) ResponseTrailer() http.Header {
	if s.constructErr != nil {
		return http.Header{}
	}
	return s.conn.ResponseTrailer()
}

// Close the receive side of the stream.
//
// Close is non-blocking. To gracefully close the stream and allow for
// connection resuse ensure all messages have been received before calling
// Close. All messages are received when Receive returns false.
func (s *ServerStreamForClient[Res]) Close() error {
	if s.constructErr != nil {
		return s.constructErr
	}
	return s.conn.CloseResponse()
}

// Conn exposes the underlying StreamingClientConn. This may be useful if
// you'd prefer to wrap the connection in a different high-level API.
func (s *ServerStreamForClient[Res]) Conn() (StreamingClientConn, error) {
	return s.conn, s.constructErr
}

// BidiStreamForClient is the client's view of a bidirectional streaming RPC.
//
// It's returned from [Client].CallBidiStream, but doesn't currently have an
// exported constructor function.
type BidiStreamForClient[Req, Res any] struct {
	conn        StreamingClientConn
	initializer maybeInitializer
	// Error from client construction. If non-nil, return for all calls.
	err error
}

// Spec returns the specification for the RPC.
func (b *BidiStreamForClient[_, _]) Spec() Spec {
	return b.conn.Spec()
}

// Peer describes the server for the RPC.
func (b *BidiStreamForClient[_, _]) Peer() Peer {
	return b.conn.Peer()
}

// RequestHeader returns the request headers. Headers are sent with the first
// call to Send.
//
// Headers beginning with "Connect-" and "Grpc-" are reserved for use by the
// Connect and gRPC protocols. Applications shouldn't write them.
func (b *BidiStreamForClient[Req, Res]) RequestHeader() http.Header {
	if b.err != nil {
		return http.Header{}
	}
	return b.conn.RequestHeader()
}

// Send a message to the server. The first call to Send also sends the request
// headers. To send just the request headers, without a body, call Send with a
// nil pointer.
//
// If the server returns an error, Send returns an error that wraps [io.EOF].
// Clients should check for EOF using the standard library's [errors.Is] and
// call Receive to retrieve the error.
func (b *BidiStreamForClient[Req, Res]) Send(msg *Req) error {
	if b.err != nil {
		return b.err
	}
	if msg == nil {
		return b.conn.Send(nil)
	}
	return b.conn.Send(msg)
}

// CloseRequest closes the send side of the stream.
func (b *BidiStreamForClient[Req, Res]) CloseRequest() error {
	if b.err != nil {
		return b.err
	}
	return b.conn.CloseRequest()
}

// Receive a message. When the server is done sending messages and no other
// errors have occurred, Receive will return an error that wraps [io.EOF].
func (b *BidiStreamForClient[Req, Res]) Receive() (*Res, error) {
	if b.err != nil {
		return nil, b.err
	}
	var msg Res
	if err := b.initializer.maybe(b.conn.Spec(), &msg); err != nil {
		return nil, err
	}
	if err := b.conn.Receive(&msg); err != nil {
		return nil, err
	}
	return &msg, nil
}

// CloseResponse closes the receive side of the stream.
//
// CloseResponse is non-blocking. To gracefully close the stream and allow for
// connection resuse ensure all messages have been received before calling
// CloseResponse. All messages are received when Receive returns an error
// wrapping [io.EOF].
func (b *BidiStreamForClient[Req, Res]) CloseResponse() error {
	if b.err != nil {
		return b.err
	}
	return b.conn.CloseResponse()
}

// ResponseHeader returns the headers received from the server. It blocks until
// the first call to Receive returns.
func (b *BidiStreamForClient[Req, Res]) ResponseHeader() http.Header {
	if b.err != nil {
		return http.Header{}
	}
	return b.conn.ResponseHeader()
}

// ResponseTrailer returns the trailers received from the server. Trailers
// aren't fully populated until Receive() returns an error wrapping [io.EOF].
func (b *BidiStreamForClient[Req, Res]) ResponseTrailer() http.Header {
	if b.err != nil {
		return http.Header{}
	}
	return b.conn.ResponseTrailer()
}

// Conn exposes the underlying StreamingClientConn. This may be useful if
// you'd prefer to wrap the connection in a different high-level API.
func (b *BidiStreamForClient[Req, Res]) Conn() (StreamingClientConn, error) {
	return b.conn, b.err
}
