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

// ClientStream is the handler's view of a client streaming RPC.
//
// It's constructed as part of [Handler] invocation, but doesn't currently have
// an exported constructor.
type ClientStream[Req any] struct {
	conn        StreamingHandlerConn
	initializer maybeInitializer
	msg         *Req
	err         error
}

// Spec returns the specification for the RPC.
func (c *ClientStream[_]) Spec() Spec {
	return c.conn.Spec()
}

// Peer describes the client for this RPC.
func (c *ClientStream[_]) Peer() Peer {
	return c.conn.Peer()
}

// RequestHeader returns the headers received from the client.
func (c *ClientStream[Req]) RequestHeader() http.Header {
	return c.conn.RequestHeader()
}

// Receive advances the stream to the next message, which will then be
// available through the Msg method. It returns false when the stream stops,
// either by reaching the end or by encountering an unexpected error. After
// Receive returns false, the Err method will return any unexpected error
// encountered.
func (c *ClientStream[Req]) Receive() bool {
	if c.err != nil {
		return false
	}
	c.msg = new(Req)
	if err := c.initializer.maybe(c.Spec(), c.msg); err != nil {
		c.err = err
		return false
	}
	c.err = c.conn.Receive(c.msg)
	return c.err == nil
}

// Msg returns the most recent message unmarshaled by a call to Receive.
func (c *ClientStream[Req]) Msg() *Req {
	if c.msg == nil {
		c.msg = new(Req)
	}
	return c.msg
}

// Err returns the first non-EOF error that was encountered by Receive.
func (c *ClientStream[Req]) Err() error {
	if c.err == nil || errors.Is(c.err, io.EOF) {
		return nil
	}
	return c.err
}

// Conn exposes the underlying StreamingHandlerConn. This may be useful if
// you'd prefer to wrap the connection in a different high-level API.
func (c *ClientStream[Req]) Conn() StreamingHandlerConn {
	return c.conn
}

// ServerStream is the handler's view of a server streaming RPC.
//
// It's constructed as part of [Handler] invocation, but doesn't currently have
// an exported constructor.
type ServerStream[Res any] struct {
	conn StreamingHandlerConn
}

// ResponseHeader returns the response headers. Headers are sent with the first
// call to Send.
//
// Headers beginning with "Connect-" and "Grpc-" are reserved for use by the
// Connect and gRPC protocols. Applications shouldn't write them.
func (s *ServerStream[Res]) ResponseHeader() http.Header {
	return s.conn.ResponseHeader()
}

// ResponseTrailer returns the response trailers. Handlers may write to the
// response trailers at any time before returning.
//
// Trailers beginning with "Connect-" and "Grpc-" are reserved for use by the
// Connect and gRPC protocols. Applications shouldn't write them.
func (s *ServerStream[Res]) ResponseTrailer() http.Header {
	return s.conn.ResponseTrailer()
}

// Send a message to the client. The first call to Send also sends the response
// headers.
func (s *ServerStream[Res]) Send(msg *Res) error {
	if msg == nil {
		return s.conn.Send(nil)
	}
	return s.conn.Send(msg)
}

// Conn exposes the underlying StreamingHandlerConn. This may be useful if
// you'd prefer to wrap the connection in a different high-level API.
func (s *ServerStream[Res]) Conn() StreamingHandlerConn {
	return s.conn
}

// BidiStream is the handler's view of a bidirectional streaming RPC.
//
// It's constructed as part of [Handler] invocation, but doesn't currently have
// an exported constructor.
type BidiStream[Req, Res any] struct {
	conn        StreamingHandlerConn
	initializer maybeInitializer
}

// Spec returns the specification for the RPC.
func (b *BidiStream[_, _]) Spec() Spec {
	return b.conn.Spec()
}

// Peer describes the client for this RPC.
func (b *BidiStream[_, _]) Peer() Peer {
	return b.conn.Peer()
}

// RequestHeader returns the headers received from the client.
func (b *BidiStream[Req, Res]) RequestHeader() http.Header {
	return b.conn.RequestHeader()
}

// Receive a message. When the client is done sending messages, Receive will
// return an error that wraps [io.EOF].
func (b *BidiStream[Req, Res]) Receive() (*Req, error) {
	var req Req
	if err := b.initializer.maybe(b.Spec(), &req); err != nil {
		return nil, err
	}
	if err := b.conn.Receive(&req); err != nil {
		return nil, err
	}
	return &req, nil
}

// ResponseHeader returns the response headers. Headers are sent with the first
// call to Send.
//
// Headers beginning with "Connect-" and "Grpc-" are reserved for use by the
// Connect and gRPC protocols. Applications shouldn't write them.
func (b *BidiStream[Req, Res]) ResponseHeader() http.Header {
	return b.conn.ResponseHeader()
}

// ResponseTrailer returns the response trailers. Handlers may write to the
// response trailers at any time before returning.
//
// Trailers beginning with "Connect-" and "Grpc-" are reserved for use by the
// Connect and gRPC protocols. Applications shouldn't write them.
func (b *BidiStream[Req, Res]) ResponseTrailer() http.Header {
	return b.conn.ResponseTrailer()
}

// Send a message to the client. The first call to Send also sends the response
// headers.
func (b *BidiStream[Req, Res]) Send(msg *Res) error {
	if msg == nil {
		return b.conn.Send(nil)
	}
	return b.conn.Send(msg)
}

// Conn exposes the underlying StreamingHandlerConn. This may be useful if
// you'd prefer to wrap the connection in a different high-level API.
func (b *BidiStream[Req, Res]) Conn() StreamingHandlerConn {
	return b.conn
}
