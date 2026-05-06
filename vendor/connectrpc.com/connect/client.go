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
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
)

// Client is a reusable, concurrency-safe client for a single procedure.
// Depending on the procedure's type, use the CallUnary, CallClientStream,
// CallServerStream, or CallBidiStream method.
//
// By default, clients use the Connect protocol with the binary Protobuf Codec,
// ask for gzipped responses, and send uncompressed requests. To use the gRPC
// or gRPC-Web protocols, use the [WithGRPC] or [WithGRPCWeb] options.
type Client[Req, Res any] struct {
	config         *clientConfig
	callUnary      func(context.Context, *Request[Req]) (*Response[Res], error)
	protocolClient protocolClient
	err            error
}

// NewClient constructs a new Client.
func NewClient[Req, Res any](httpClient HTTPClient, url string, options ...ClientOption) *Client[Req, Res] {
	client := &Client[Req, Res]{}
	config, err := newClientConfig(url, options)
	if err != nil {
		client.err = err
		return client
	}
	client.config = config
	protocolClient, protocolErr := client.config.Protocol.NewClient(
		&protocolClientParams{
			CompressionName: config.RequestCompressionName,
			CompressionPools: newReadOnlyCompressionPools(
				config.CompressionPools,
				config.CompressionNames,
			),
			Codec:            config.Codec,
			Protobuf:         config.protobuf(),
			CompressMinBytes: config.CompressMinBytes,
			HTTPClient:       httpClient,
			URL:              config.URL,
			BufferPool:       config.BufferPool,
			ReadMaxBytes:     config.ReadMaxBytes,
			SendMaxBytes:     config.SendMaxBytes,
			EnableGet:        config.EnableGet,
			GetURLMaxBytes:   config.GetURLMaxBytes,
			GetUseFallback:   config.GetUseFallback,
		},
	)
	if protocolErr != nil {
		client.err = protocolErr
		return client
	}
	client.protocolClient = protocolClient
	// Rather than applying unary interceptors along the hot path, we can do it
	// once at client creation.
	unarySpec := config.newSpec(StreamTypeUnary)
	unaryFunc := UnaryFunc(func(ctx context.Context, request AnyRequest) (AnyResponse, error) {
		conn := client.protocolClient.NewConn(ctx, unarySpec, request.Header())
		conn.onRequestSend(func(r *http.Request) {
			request.setRequestMethod(r.Method)
		})
		// Send always returns an io.EOF unless the error is from the client-side.
		// We want the user to continue to call Receive in those cases to get the
		// full error from the server-side.
		if err := conn.Send(request.Any()); err != nil && !errors.Is(err, io.EOF) {
			_ = conn.CloseRequest()
			_ = conn.CloseResponse()
			return nil, err
		}
		if err := conn.CloseRequest(); err != nil {
			_ = conn.CloseResponse()
			return nil, err
		}
		response, err := receiveUnaryResponse[Res](conn, config.Initializer)
		if err != nil {
			_ = conn.CloseResponse()
			return nil, err
		}
		return response, conn.CloseResponse()
	})
	if interceptor := config.Interceptor; interceptor != nil {
		unaryFunc = interceptor.WrapUnary(unaryFunc)
	}
	client.callUnary = func(ctx context.Context, request *Request[Req]) (*Response[Res], error) {
		// To make the specification, peer, and RPC headers visible to the full
		// interceptor chain (as though they were supplied by the caller), we'll
		// add them here.
		request.spec = unarySpec
		request.peer = client.protocolClient.Peer()
		protocolClient.WriteRequestHeader(StreamTypeUnary, request.Header())
		response, err := unaryFunc(ctx, request)
		if err != nil {
			return nil, err
		}
		typed, ok := response.(*Response[Res])
		if !ok {
			return nil, errorf(CodeInternal, "unexpected client response type %T", response)
		}
		return typed, nil
	}
	return client
}

// CallUnary calls a request-response procedure.
func (c *Client[Req, Res]) CallUnary(ctx context.Context, request *Request[Req]) (*Response[Res], error) {
	if c.err != nil {
		return nil, c.err
	}
	return c.callUnary(ctx, request)
}

// CallClientStream calls a client streaming procedure.
func (c *Client[Req, Res]) CallClientStream(ctx context.Context) *ClientStreamForClient[Req, Res] {
	if c.err != nil {
		return &ClientStreamForClient[Req, Res]{err: c.err}
	}
	return &ClientStreamForClient[Req, Res]{
		conn:        c.newConn(ctx, StreamTypeClient, nil),
		initializer: c.config.Initializer,
	}
}

// CallServerStream calls a server streaming procedure.
func (c *Client[Req, Res]) CallServerStream(ctx context.Context, request *Request[Req]) (*ServerStreamForClient[Res], error) {
	if c.err != nil {
		return nil, c.err
	}
	conn := c.newConn(ctx, StreamTypeServer, func(r *http.Request) {
		request.method = r.Method
	})
	request.spec = conn.Spec()
	request.peer = conn.Peer()
	mergeHeaders(conn.RequestHeader(), request.header)
	// Send always returns an io.EOF unless the error is from the client-side.
	// We want the user to continue to call Receive in those cases to get the
	// full error from the server-side.
	if err := conn.Send(request.Msg); err != nil && !errors.Is(err, io.EOF) {
		_ = conn.CloseRequest()
		_ = conn.CloseResponse()
		return nil, err
	}
	if err := conn.CloseRequest(); err != nil {
		return nil, err
	}
	return &ServerStreamForClient[Res]{
		conn:        conn,
		initializer: c.config.Initializer,
	}, nil
}

// CallBidiStream calls a bidirectional streaming procedure.
func (c *Client[Req, Res]) CallBidiStream(ctx context.Context) *BidiStreamForClient[Req, Res] {
	if c.err != nil {
		return &BidiStreamForClient[Req, Res]{err: c.err}
	}
	return &BidiStreamForClient[Req, Res]{
		conn:        c.newConn(ctx, StreamTypeBidi, nil),
		initializer: c.config.Initializer,
	}
}

func (c *Client[Req, Res]) newConn(ctx context.Context, streamType StreamType, onRequestSend func(r *http.Request)) StreamingClientConn {
	newConn := func(ctx context.Context, spec Spec) StreamingClientConn {
		header := make(http.Header, 8) // arbitrary power of two, prevent immediate resizing
		c.protocolClient.WriteRequestHeader(streamType, header)
		conn := c.protocolClient.NewConn(ctx, spec, header)
		conn.onRequestSend(onRequestSend)
		return conn
	}
	if interceptor := c.config.Interceptor; interceptor != nil {
		newConn = interceptor.WrapStreamingClient(newConn)
	}
	return newConn(ctx, c.config.newSpec(streamType))
}

type clientConfig struct {
	URL                    *url.URL
	Protocol               protocol
	Procedure              string
	Schema                 any
	Initializer            maybeInitializer
	CompressMinBytes       int
	Interceptor            Interceptor
	CompressionPools       map[string]*compressionPool
	CompressionNames       []string
	Codec                  Codec
	RequestCompressionName string
	BufferPool             *bufferPool
	ReadMaxBytes           int
	SendMaxBytes           int
	EnableGet              bool
	GetURLMaxBytes         int
	GetUseFallback         bool
	IdempotencyLevel       IdempotencyLevel
}

func newClientConfig(rawURL string, options []ClientOption) (*clientConfig, *Error) {
	url, err := parseRequestURL(rawURL)
	if err != nil {
		return nil, err
	}
	protoPath := extractProtoPath(url.Path)
	config := clientConfig{
		URL:              url,
		Protocol:         &protocolConnect{},
		Procedure:        protoPath,
		CompressionPools: make(map[string]*compressionPool),
		BufferPool:       newBufferPool(),
	}
	withProtoBinaryCodec().applyToClient(&config)
	withGzip().applyToClient(&config)
	for _, opt := range options {
		opt.applyToClient(&config)
	}
	if err := config.validate(); err != nil {
		return nil, err
	}
	return &config, nil
}

func (c *clientConfig) validate() *Error {
	if c.Codec == nil || c.Codec.Name() == "" {
		return errorf(CodeUnknown, "no codec configured")
	}
	if c.RequestCompressionName != "" && c.RequestCompressionName != compressionIdentity {
		if _, ok := c.CompressionPools[c.RequestCompressionName]; !ok {
			return errorf(CodeUnknown, "unknown compression %q", c.RequestCompressionName)
		}
	}
	return nil
}

func (c *clientConfig) protobuf() Codec {
	if c.Codec.Name() == codecNameProto {
		return c.Codec
	}
	return &protoBinaryCodec{}
}

func (c *clientConfig) newSpec(t StreamType) Spec {
	return Spec{
		StreamType:       t,
		Procedure:        c.Procedure,
		Schema:           c.Schema,
		IsClient:         true,
		IdempotencyLevel: c.IdempotencyLevel,
	}
}

func parseRequestURL(rawURL string) (*url.URL, *Error) {
	url, err := url.ParseRequestURI(rawURL)
	if err == nil {
		return url, nil
	}
	if !strings.Contains(rawURL, "://") {
		// URL doesn't have a scheme, so the user is likely accustomed to
		// grpc-go's APIs.
		err = fmt.Errorf(
			"URL %q missing scheme: use http:// or https:// (unlike grpc-go)",
			rawURL,
		)
	}
	return nil, NewError(CodeUnavailable, err)
}
