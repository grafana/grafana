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
	"net/http"
)

// A Handler is the server-side implementation of a single RPC defined by a
// service schema.
//
// By default, Handlers support the Connect, gRPC, and gRPC-Web protocols with
// the binary Protobuf and JSON codecs. They support gzip compression using the
// standard library's [compress/gzip].
type Handler struct {
	spec             Spec
	implementation   StreamingHandlerFunc
	protocolHandlers map[string][]protocolHandler // Method to protocol handlers
	allowMethod      string                       // Allow header
	acceptPost       string                       // Accept-Post header
}

// NewUnaryHandler constructs a [Handler] for a request-response procedure.
func NewUnaryHandler[Req, Res any](
	procedure string,
	unary func(context.Context, *Request[Req]) (*Response[Res], error),
	options ...HandlerOption,
) *Handler {
	// Wrap the strongly-typed implementation so we can apply interceptors.
	untyped := UnaryFunc(func(ctx context.Context, request AnyRequest) (AnyResponse, error) {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		typed, ok := request.(*Request[Req])
		if !ok {
			return nil, errorf(CodeInternal, "unexpected handler request type %T", request)
		}
		res, err := unary(ctx, typed)
		if res == nil && err == nil {
			// This is going to panic during serialization. Debugging is much easier
			// if we panic here instead, so we can include the procedure name.
			panic(procedure + " returned nil *connect.Response and nil error") //nolint: forbidigo
		}
		return res, err
	})
	config := newHandlerConfig(procedure, StreamTypeUnary, options)
	if interceptor := config.Interceptor; interceptor != nil {
		untyped = interceptor.WrapUnary(untyped)
	}
	// Given a stream, how should we call the unary function?
	implementation := func(ctx context.Context, conn StreamingHandlerConn) error {
		request, err := receiveUnaryRequest[Req](conn, config.Initializer)
		if err != nil {
			return err
		}
		response, err := untyped(ctx, request)
		if err != nil {
			return err
		}
		mergeNonProtocolHeaders(conn.ResponseHeader(), response.Header())
		mergeNonProtocolHeaders(conn.ResponseTrailer(), response.Trailer())
		return conn.Send(response.Any())
	}

	protocolHandlers := config.newProtocolHandlers()
	return &Handler{
		spec:             config.newSpec(),
		implementation:   implementation,
		protocolHandlers: mappedMethodHandlers(protocolHandlers),
		allowMethod:      sortedAllowMethodValue(protocolHandlers),
		acceptPost:       sortedAcceptPostValue(protocolHandlers),
	}
}

// NewClientStreamHandler constructs a [Handler] for a client streaming procedure.
func NewClientStreamHandler[Req, Res any](
	procedure string,
	implementation func(context.Context, *ClientStream[Req]) (*Response[Res], error),
	options ...HandlerOption,
) *Handler {
	config := newHandlerConfig(procedure, StreamTypeClient, options)
	return newStreamHandler(
		config,
		func(ctx context.Context, conn StreamingHandlerConn) error {
			stream := &ClientStream[Req]{
				conn:        conn,
				initializer: config.Initializer,
			}
			res, err := implementation(ctx, stream)
			if err != nil {
				return err
			}
			if res == nil {
				// This is going to panic during serialization. Debugging is much easier
				// if we panic here instead, so we can include the procedure name.
				panic(procedure + " returned nil *connect.Response and nil error") //nolint: forbidigo
			}
			mergeHeaders(conn.ResponseHeader(), res.header)
			mergeHeaders(conn.ResponseTrailer(), res.trailer)
			return conn.Send(res.Msg)
		},
	)
}

// NewServerStreamHandler constructs a [Handler] for a server streaming procedure.
func NewServerStreamHandler[Req, Res any](
	procedure string,
	implementation func(context.Context, *Request[Req], *ServerStream[Res]) error,
	options ...HandlerOption,
) *Handler {
	config := newHandlerConfig(procedure, StreamTypeServer, options)
	return newStreamHandler(
		config,
		func(ctx context.Context, conn StreamingHandlerConn) error {
			req, err := receiveUnaryRequest[Req](conn, config.Initializer)
			if err != nil {
				return err
			}
			return implementation(ctx, req, &ServerStream[Res]{conn: conn})
		},
	)
}

// NewBidiStreamHandler constructs a [Handler] for a bidirectional streaming procedure.
func NewBidiStreamHandler[Req, Res any](
	procedure string,
	implementation func(context.Context, *BidiStream[Req, Res]) error,
	options ...HandlerOption,
) *Handler {
	config := newHandlerConfig(procedure, StreamTypeBidi, options)
	return newStreamHandler(
		config,
		func(ctx context.Context, conn StreamingHandlerConn) error {
			return implementation(
				ctx,
				&BidiStream[Req, Res]{
					conn:        conn,
					initializer: config.Initializer,
				},
			)
		},
	)
}

// ServeHTTP implements [http.Handler].
func (h *Handler) ServeHTTP(responseWriter http.ResponseWriter, request *http.Request) {
	// We don't need to defer functions to close the request body or read to
	// EOF: the stream we construct later on already does that, and we only
	// return early when dealing with misbehaving clients. In those cases, it's
	// okay if we can't re-use the connection.
	isBidi := (h.spec.StreamType & StreamTypeBidi) == StreamTypeBidi
	if isBidi && request.ProtoMajor < 2 {
		// Clients coded to expect full-duplex connections may hang if they've
		// mistakenly negotiated HTTP/1.1. To unblock them, we must close the
		// underlying TCP connection.
		responseWriter.Header().Set("Connection", "close")
		responseWriter.WriteHeader(http.StatusHTTPVersionNotSupported)
		return
	}

	protocolHandlers := h.protocolHandlers[request.Method]
	if len(protocolHandlers) == 0 {
		responseWriter.Header().Set("Allow", h.allowMethod)
		responseWriter.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	contentType := canonicalizeContentType(getHeaderCanonical(request.Header, headerContentType))

	// Find our implementation of the RPC protocol in use.
	var protocolHandler protocolHandler
	for _, handler := range protocolHandlers {
		if handler.CanHandlePayload(request, contentType) {
			protocolHandler = handler
			break
		}
	}
	if protocolHandler == nil {
		responseWriter.Header().Set("Accept-Post", h.acceptPost)
		responseWriter.WriteHeader(http.StatusUnsupportedMediaType)
		return
	}

	if request.Method == http.MethodGet {
		// A body must not be present.
		hasBody := request.ContentLength > 0
		if request.ContentLength < 0 {
			// No content-length header.
			// Test if body is empty by trying to read a single byte.
			var b [1]byte
			n, _ := request.Body.Read(b[:])
			hasBody = n > 0
		}
		if hasBody {
			responseWriter.WriteHeader(http.StatusUnsupportedMediaType)
			return
		}
		_ = request.Body.Close()
	}

	// Establish a stream and serve the RPC.
	setHeaderCanonical(request.Header, headerContentType, contentType)
	setHeaderCanonical(request.Header, headerHost, request.Host)
	ctx, cancel, timeoutErr := protocolHandler.SetTimeout(request) //nolint: contextcheck
	if timeoutErr != nil {
		ctx = request.Context()
	}
	if cancel != nil {
		defer cancel()
	}
	connCloser, ok := protocolHandler.NewConn(
		responseWriter,
		request.WithContext(ctx),
	)
	if !ok {
		// Failed to create stream, usually because client used an unknown
		// compression algorithm. Nothing further to do.
		return
	}
	if timeoutErr != nil {
		_ = connCloser.Close(timeoutErr)
		return
	}
	_ = connCloser.Close(h.implementation(ctx, connCloser))
}

type handlerConfig struct {
	CompressionPools             map[string]*compressionPool
	CompressionNames             []string
	Codecs                       map[string]Codec
	CompressMinBytes             int
	Interceptor                  Interceptor
	Procedure                    string
	Schema                       any
	Initializer                  maybeInitializer
	RequireConnectProtocolHeader bool
	IdempotencyLevel             IdempotencyLevel
	BufferPool                   *bufferPool
	ReadMaxBytes                 int
	SendMaxBytes                 int
	StreamType                   StreamType
}

func newHandlerConfig(procedure string, streamType StreamType, options []HandlerOption) *handlerConfig {
	protoPath := extractProtoPath(procedure)
	config := handlerConfig{
		Procedure:        protoPath,
		CompressionPools: make(map[string]*compressionPool),
		Codecs:           make(map[string]Codec),
		BufferPool:       newBufferPool(),
		StreamType:       streamType,
	}
	withProtoBinaryCodec().applyToHandler(&config)
	withProtoJSONCodecs().applyToHandler(&config)
	withGzip().applyToHandler(&config)
	for _, opt := range options {
		opt.applyToHandler(&config)
	}
	return &config
}

func (c *handlerConfig) newSpec() Spec {
	return Spec{
		Procedure:        c.Procedure,
		Schema:           c.Schema,
		StreamType:       c.StreamType,
		IdempotencyLevel: c.IdempotencyLevel,
	}
}

func (c *handlerConfig) newProtocolHandlers() []protocolHandler {
	protocols := []protocol{
		&protocolConnect{},
		&protocolGRPC{web: false},
		&protocolGRPC{web: true},
	}
	handlers := make([]protocolHandler, 0, len(protocols))
	codecs := newReadOnlyCodecs(c.Codecs)
	compressors := newReadOnlyCompressionPools(
		c.CompressionPools,
		c.CompressionNames,
	)
	for _, protocol := range protocols {
		handlers = append(handlers, protocol.NewHandler(&protocolHandlerParams{
			Spec:                         c.newSpec(),
			Codecs:                       codecs,
			CompressionPools:             compressors,
			CompressMinBytes:             c.CompressMinBytes,
			BufferPool:                   c.BufferPool,
			ReadMaxBytes:                 c.ReadMaxBytes,
			SendMaxBytes:                 c.SendMaxBytes,
			RequireConnectProtocolHeader: c.RequireConnectProtocolHeader,
			IdempotencyLevel:             c.IdempotencyLevel,
		}))
	}
	return handlers
}

func newStreamHandler(
	config *handlerConfig,
	implementation StreamingHandlerFunc,
) *Handler {
	if ic := config.Interceptor; ic != nil {
		implementation = ic.WrapStreamingHandler(implementation)
	}
	protocolHandlers := config.newProtocolHandlers()
	return &Handler{
		spec:             config.newSpec(),
		implementation:   implementation,
		protocolHandlers: mappedMethodHandlers(protocolHandlers),
		allowMethod:      sortedAllowMethodValue(protocolHandlers),
		acceptPost:       sortedAcceptPostValue(protocolHandlers),
	}
}
