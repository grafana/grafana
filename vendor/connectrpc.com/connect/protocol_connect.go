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
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"runtime"
	"strconv"
	"strings"
	"time"

	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/anypb"
)

const (
	connectUnaryHeaderCompression           = "Content-Encoding"
	connectUnaryHeaderAcceptCompression     = "Accept-Encoding"
	connectUnaryTrailerPrefix               = "Trailer-"
	connectStreamingHeaderCompression       = "Connect-Content-Encoding"
	connectStreamingHeaderAcceptCompression = "Connect-Accept-Encoding"
	connectHeaderTimeout                    = "Connect-Timeout-Ms"
	connectHeaderProtocolVersion            = "Connect-Protocol-Version"
	connectProtocolVersion                  = "1"
	headerVary                              = "Vary"

	connectFlagEnvelopeEndStream = 0b00000010

	connectUnaryContentTypePrefix     = "application/"
	connectUnaryContentTypeJSON       = connectUnaryContentTypePrefix + codecNameJSON
	connectStreamingContentTypePrefix = "application/connect+"

	connectUnaryEncodingQueryParameter    = "encoding"
	connectUnaryMessageQueryParameter     = "message"
	connectUnaryBase64QueryParameter      = "base64"
	connectUnaryCompressionQueryParameter = "compression"
	connectUnaryConnectQueryParameter     = "connect"
	connectUnaryConnectQueryValue         = "v" + connectProtocolVersion
)

// defaultConnectUserAgent returns a User-Agent string similar to those used in gRPC.
//
//nolint:gochecknoglobals
var defaultConnectUserAgent = fmt.Sprintf("connect-go/%s (%s)", Version, runtime.Version())

type protocolConnect struct{}

// NewHandler implements protocol, so it must return an interface.
func (*protocolConnect) NewHandler(params *protocolHandlerParams) protocolHandler {
	methods := make(map[string]struct{})
	methods[http.MethodPost] = struct{}{}

	if params.Spec.StreamType == StreamTypeUnary && params.IdempotencyLevel == IdempotencyNoSideEffects {
		methods[http.MethodGet] = struct{}{}
	}

	contentTypes := make(map[string]struct{})
	for _, name := range params.Codecs.Names() {
		if params.Spec.StreamType == StreamTypeUnary {
			contentTypes[canonicalizeContentType(connectUnaryContentTypePrefix+name)] = struct{}{}
			continue
		}
		contentTypes[canonicalizeContentType(connectStreamingContentTypePrefix+name)] = struct{}{}
	}

	return &connectHandler{
		protocolHandlerParams: *params,
		methods:               methods,
		accept:                contentTypes,
	}
}

// NewClient implements protocol, so it must return an interface.
func (*protocolConnect) NewClient(params *protocolClientParams) (protocolClient, error) {
	return &connectClient{
		protocolClientParams: *params,
		peer:                 newPeerForURL(params.URL, ProtocolConnect),
	}, nil
}

type connectHandler struct {
	protocolHandlerParams

	methods map[string]struct{}
	accept  map[string]struct{}
}

func (h *connectHandler) Methods() map[string]struct{} {
	return h.methods
}

func (h *connectHandler) ContentTypes() map[string]struct{} {
	return h.accept
}

func (*connectHandler) SetTimeout(request *http.Request) (context.Context, context.CancelFunc, error) {
	timeout := getHeaderCanonical(request.Header, connectHeaderTimeout)
	if timeout == "" {
		return request.Context(), nil, nil
	}
	if len(timeout) > 10 {
		return nil, nil, errorf(CodeInvalidArgument, "parse timeout: %q has >10 digits", timeout)
	}
	millis, err := strconv.ParseInt(timeout, 10 /* base */, 64 /* bitsize */)
	if err != nil {
		return nil, nil, errorf(CodeInvalidArgument, "parse timeout: %w", err)
	}
	ctx, cancel := context.WithTimeout(
		request.Context(),
		time.Duration(millis)*time.Millisecond,
	)
	return ctx, cancel, nil
}

func (h *connectHandler) CanHandlePayload(request *http.Request, contentType string) bool {
	if request.Method == http.MethodGet {
		query := request.URL.Query()
		codecName := query.Get(connectUnaryEncodingQueryParameter)
		contentType = connectContentTypeForCodecName(
			h.Spec.StreamType,
			codecName,
		)
	}
	_, ok := h.accept[contentType]
	return ok
}

func (h *connectHandler) NewConn(
	responseWriter http.ResponseWriter,
	request *http.Request,
) (handlerConnCloser, bool) {
	ctx := request.Context()
	query := request.URL.Query()
	// We need to parse metadata before entering the interceptor stack; we'll
	// send the error to the client later on.
	var contentEncoding, acceptEncoding string
	if h.Spec.StreamType == StreamTypeUnary {
		if request.Method == http.MethodGet {
			contentEncoding = query.Get(connectUnaryCompressionQueryParameter)
		} else {
			contentEncoding = getHeaderCanonical(request.Header, connectUnaryHeaderCompression)
		}
		acceptEncoding = getHeaderCanonical(request.Header, connectUnaryHeaderAcceptCompression)
	} else {
		contentEncoding = getHeaderCanonical(request.Header, connectStreamingHeaderCompression)
		acceptEncoding = getHeaderCanonical(request.Header, connectStreamingHeaderAcceptCompression)
	}
	requestCompression, responseCompression, failed := negotiateCompression(
		h.CompressionPools,
		contentEncoding,
		acceptEncoding,
	)
	if failed == nil {
		failed = checkServerStreamsCanFlush(h.Spec, responseWriter)
	}
	if failed == nil {
		required := h.RequireConnectProtocolHeader && (h.Spec.StreamType == StreamTypeUnary)
		failed = connectCheckProtocolVersion(request, required)
	}

	var requestBody io.ReadCloser
	var contentType, codecName string
	if request.Method == http.MethodGet {
		if failed == nil && !query.Has(connectUnaryEncodingQueryParameter) {
			failed = errorf(CodeInvalidArgument, "missing %s parameter", connectUnaryEncodingQueryParameter)
		} else if failed == nil && !query.Has(connectUnaryMessageQueryParameter) {
			failed = errorf(CodeInvalidArgument, "missing %s parameter", connectUnaryMessageQueryParameter)
		}
		msg := query.Get(connectUnaryMessageQueryParameter)
		msgReader := queryValueReader(msg, query.Get(connectUnaryBase64QueryParameter) == "1")
		requestBody = io.NopCloser(msgReader)
		codecName = query.Get(connectUnaryEncodingQueryParameter)
		contentType = connectContentTypeForCodecName(
			h.Spec.StreamType,
			codecName,
		)
	} else {
		requestBody = request.Body
		contentType = getHeaderCanonical(request.Header, headerContentType)
		codecName = connectCodecForContentType(
			h.Spec.StreamType,
			contentType,
		)
	}

	codec := h.Codecs.Get(codecName)
	// The codec can be nil in the GET request case; that's okay: when failed
	// is non-nil, codec is never used.
	if failed == nil && codec == nil {
		failed = errorf(CodeInvalidArgument, "invalid message encoding: %q", codecName)
	}

	// Write any remaining headers here:
	// (1) any writes to the stream will implicitly send the headers, so we
	// should get all of gRPC's required response headers ready.
	// (2) interceptors should be able to see these headers.
	//
	// Since we know that these header keys are already in canonical form, we can
	// skip the normalization in Header.Set.
	header := responseWriter.Header()
	header[headerContentType] = []string{contentType}
	acceptCompressionHeader := connectUnaryHeaderAcceptCompression
	if h.Spec.StreamType != StreamTypeUnary {
		acceptCompressionHeader = connectStreamingHeaderAcceptCompression
		// We only write the request encoding header here for streaming calls,
		// since the streaming envelope lets us choose whether to compress each
		// message individually. For unary, we won't know whether we're compressing
		// the request until we see how large the payload is.
		if responseCompression != compressionIdentity {
			header[connectStreamingHeaderCompression] = []string{responseCompression}
		}
	}
	header[acceptCompressionHeader] = []string{h.CompressionPools.CommaSeparatedNames()}

	var conn handlerConnCloser
	peer := Peer{
		Addr:     request.RemoteAddr,
		Protocol: ProtocolConnect,
		Query:    query,
	}
	if h.Spec.StreamType == StreamTypeUnary {
		conn = &connectUnaryHandlerConn{
			spec:           h.Spec,
			peer:           peer,
			request:        request,
			responseWriter: responseWriter,
			marshaler: connectUnaryMarshaler{
				ctx:              ctx,
				sender:           writeSender{writer: responseWriter},
				codec:            codec,
				compressMinBytes: h.CompressMinBytes,
				compressionName:  responseCompression,
				compressionPool:  h.CompressionPools.Get(responseCompression),
				bufferPool:       h.BufferPool,
				header:           responseWriter.Header(),
				sendMaxBytes:     h.SendMaxBytes,
			},
			unmarshaler: connectUnaryUnmarshaler{
				ctx:             ctx,
				reader:          requestBody,
				codec:           codec,
				compressionPool: h.CompressionPools.Get(requestCompression),
				bufferPool:      h.BufferPool,
				readMaxBytes:    h.ReadMaxBytes,
			},
			responseTrailer: make(http.Header),
		}
	} else {
		conn = &connectStreamingHandlerConn{
			spec:           h.Spec,
			peer:           peer,
			request:        request,
			responseWriter: responseWriter,
			marshaler: connectStreamingMarshaler{
				envelopeWriter: envelopeWriter{
					ctx:              ctx,
					sender:           writeSender{responseWriter},
					codec:            codec,
					compressMinBytes: h.CompressMinBytes,
					compressionPool:  h.CompressionPools.Get(responseCompression),
					bufferPool:       h.BufferPool,
					sendMaxBytes:     h.SendMaxBytes,
				},
			},
			unmarshaler: connectStreamingUnmarshaler{
				envelopeReader: envelopeReader{
					ctx:             ctx,
					reader:          requestBody,
					codec:           codec,
					compressionPool: h.CompressionPools.Get(requestCompression),
					bufferPool:      h.BufferPool,
					readMaxBytes:    h.ReadMaxBytes,
				},
			},
			responseTrailer: make(http.Header),
		}
	}
	conn = wrapHandlerConnWithCodedErrors(conn)

	if failed != nil {
		// Negotiation failed, so we can't establish a stream.
		_ = conn.Close(failed)
		return nil, false
	}
	return conn, true
}

type connectClient struct {
	protocolClientParams

	peer Peer
}

func (c *connectClient) Peer() Peer {
	return c.peer
}

func (c *connectClient) WriteRequestHeader(streamType StreamType, header http.Header) {
	// We know these header keys are in canonical form, so we can bypass all the
	// checks in Header.Set.
	if getHeaderCanonical(header, headerUserAgent) == "" {
		header[headerUserAgent] = []string{defaultConnectUserAgent}
	}
	header[connectHeaderProtocolVersion] = []string{connectProtocolVersion}
	header[headerContentType] = []string{
		connectContentTypeForCodecName(streamType, c.Codec.Name()),
	}
	acceptCompressionHeader := connectUnaryHeaderAcceptCompression
	if streamType != StreamTypeUnary {
		// If we don't set Accept-Encoding, by default http.Client will ask the
		// server to compress the whole stream. Since we're already compressing
		// each message, this is a waste.
		header[connectUnaryHeaderAcceptCompression] = []string{compressionIdentity}
		acceptCompressionHeader = connectStreamingHeaderAcceptCompression
		// We only write the request encoding header here for streaming calls,
		// since the streaming envelope lets us choose whether to compress each
		// message individually. For unary, we won't know whether we're compressing
		// the request until we see how large the payload is.
		if c.CompressionName != "" && c.CompressionName != compressionIdentity {
			header[connectStreamingHeaderCompression] = []string{c.CompressionName}
		}
	}
	if acceptCompression := c.CompressionPools.CommaSeparatedNames(); acceptCompression != "" {
		header[acceptCompressionHeader] = []string{acceptCompression}
	}
}

func (c *connectClient) NewConn(
	ctx context.Context,
	spec Spec,
	header http.Header,
) streamingClientConn {
	if deadline, ok := ctx.Deadline(); ok {
		millis := int64(time.Until(deadline) / time.Millisecond)
		if millis > 0 {
			encoded := strconv.FormatInt(millis, 10 /* base */)
			if len(encoded) <= 10 {
				header[connectHeaderTimeout] = []string{encoded}
			} // else effectively unbounded
		}
	}
	duplexCall := newDuplexHTTPCall(ctx, c.HTTPClient, c.URL, spec, header)
	var conn streamingClientConn
	if spec.StreamType == StreamTypeUnary {
		unaryConn := &connectUnaryClientConn{
			spec:             spec,
			peer:             c.Peer(),
			duplexCall:       duplexCall,
			compressionPools: c.CompressionPools,
			bufferPool:       c.BufferPool,
			marshaler: connectUnaryRequestMarshaler{
				connectUnaryMarshaler: connectUnaryMarshaler{
					ctx:              ctx,
					sender:           duplexCall,
					codec:            c.Codec,
					compressMinBytes: c.CompressMinBytes,
					compressionName:  c.CompressionName,
					compressionPool:  c.CompressionPools.Get(c.CompressionName),
					bufferPool:       c.BufferPool,
					header:           duplexCall.Header(),
					sendMaxBytes:     c.SendMaxBytes,
				},
			},
			unmarshaler: connectUnaryUnmarshaler{
				ctx:          ctx,
				reader:       duplexCall,
				codec:        c.Codec,
				bufferPool:   c.BufferPool,
				readMaxBytes: c.ReadMaxBytes,
			},
			responseHeader:  make(http.Header),
			responseTrailer: make(http.Header),
		}
		if spec.IdempotencyLevel == IdempotencyNoSideEffects {
			unaryConn.marshaler.enableGet = c.EnableGet
			unaryConn.marshaler.getURLMaxBytes = c.GetURLMaxBytes
			unaryConn.marshaler.getUseFallback = c.GetUseFallback
			unaryConn.marshaler.duplexCall = duplexCall
			if stableCodec, ok := c.Codec.(stableCodec); ok {
				unaryConn.marshaler.stableCodec = stableCodec
			}
		}
		conn = unaryConn
		duplexCall.SetValidateResponse(unaryConn.validateResponse)
	} else {
		streamingConn := &connectStreamingClientConn{
			spec:             spec,
			peer:             c.Peer(),
			duplexCall:       duplexCall,
			compressionPools: c.CompressionPools,
			bufferPool:       c.BufferPool,
			codec:            c.Codec,
			marshaler: connectStreamingMarshaler{
				envelopeWriter: envelopeWriter{
					ctx:              ctx,
					sender:           duplexCall,
					codec:            c.Codec,
					compressMinBytes: c.CompressMinBytes,
					compressionPool:  c.CompressionPools.Get(c.CompressionName),
					bufferPool:       c.BufferPool,
					sendMaxBytes:     c.SendMaxBytes,
				},
			},
			unmarshaler: connectStreamingUnmarshaler{
				envelopeReader: envelopeReader{
					ctx:          ctx,
					reader:       duplexCall,
					codec:        c.Codec,
					bufferPool:   c.BufferPool,
					readMaxBytes: c.ReadMaxBytes,
				},
			},
			responseHeader:  make(http.Header),
			responseTrailer: make(http.Header),
		}
		conn = streamingConn
		duplexCall.SetValidateResponse(streamingConn.validateResponse)
	}
	return wrapClientConnWithCodedErrors(conn)
}

type connectUnaryClientConn struct {
	spec             Spec
	peer             Peer
	duplexCall       *duplexHTTPCall
	compressionPools readOnlyCompressionPools
	bufferPool       *bufferPool
	marshaler        connectUnaryRequestMarshaler
	unmarshaler      connectUnaryUnmarshaler
	responseHeader   http.Header
	responseTrailer  http.Header
}

func (cc *connectUnaryClientConn) Spec() Spec {
	return cc.spec
}

func (cc *connectUnaryClientConn) Peer() Peer {
	return cc.peer
}

func (cc *connectUnaryClientConn) Send(msg any) error {
	if err := cc.marshaler.Marshal(msg); err != nil {
		return err
	}
	return nil // must be a literal nil: nil *Error is a non-nil error
}

func (cc *connectUnaryClientConn) RequestHeader() http.Header {
	return cc.duplexCall.Header()
}

func (cc *connectUnaryClientConn) CloseRequest() error {
	return cc.duplexCall.CloseWrite()
}

func (cc *connectUnaryClientConn) Receive(msg any) error {
	if err := cc.duplexCall.BlockUntilResponseReady(); err != nil {
		return err
	}
	if err := cc.unmarshaler.Unmarshal(msg); err != nil {
		return err
	}
	return nil // must be a literal nil: nil *Error is a non-nil error
}

func (cc *connectUnaryClientConn) ResponseHeader() http.Header {
	_ = cc.duplexCall.BlockUntilResponseReady()
	return cc.responseHeader
}

func (cc *connectUnaryClientConn) ResponseTrailer() http.Header {
	_ = cc.duplexCall.BlockUntilResponseReady()
	return cc.responseTrailer
}

func (cc *connectUnaryClientConn) CloseResponse() error {
	return cc.duplexCall.CloseRead()
}

func (cc *connectUnaryClientConn) onRequestSend(fn func(*http.Request)) {
	cc.duplexCall.onRequestSend = fn
}

func (cc *connectUnaryClientConn) validateResponse(response *http.Response) *Error {
	for k, v := range response.Header {
		if !strings.HasPrefix(k, connectUnaryTrailerPrefix) {
			cc.responseHeader[k] = v
			continue
		}
		cc.responseTrailer[k[len(connectUnaryTrailerPrefix):]] = v
	}
	if err := connectValidateUnaryResponseContentType(
		cc.marshaler.codec.Name(),
		cc.duplexCall.Method(),
		response.StatusCode,
		response.Status,
		getHeaderCanonical(response.Header, headerContentType),
	); err != nil {
		if IsNotModifiedError(err) {
			// Allow access to response headers for this kind of error.
			// RFC 9110 doesn't allow trailers on 304s, so we only need to include headers.
			err.meta = cc.responseHeader.Clone()
		}
		return err
	}
	compression := getHeaderCanonical(response.Header, connectUnaryHeaderCompression)
	if compression != "" &&
		compression != compressionIdentity &&
		!cc.compressionPools.Contains(compression) {
		return errorf(
			CodeInternal,
			"unknown encoding %q: accepted encodings are %v",
			compression,
			cc.compressionPools.CommaSeparatedNames(),
		)
	}
	cc.unmarshaler.compressionPool = cc.compressionPools.Get(compression)
	if response.StatusCode != http.StatusOK {
		unmarshaler := connectUnaryUnmarshaler{
			ctx:             cc.unmarshaler.ctx,
			reader:          response.Body,
			compressionPool: cc.unmarshaler.compressionPool,
			bufferPool:      cc.bufferPool,
		}
		var wireErr connectWireError
		if err := unmarshaler.UnmarshalFunc(&wireErr, json.Unmarshal); err != nil {
			return NewError(
				httpToCode(response.StatusCode),
				errors.New(response.Status),
			)
		}
		if wireErr.Code == 0 {
			// code not set? default to one implied by HTTP status
			wireErr.Code = httpToCode(response.StatusCode)
		}
		serverErr := wireErr.asError()
		if serverErr == nil {
			return nil
		}
		serverErr.meta = cc.responseHeader.Clone()
		mergeHeaders(serverErr.meta, cc.responseTrailer)
		return serverErr
	}
	return nil
}

type connectStreamingClientConn struct {
	spec             Spec
	peer             Peer
	duplexCall       *duplexHTTPCall
	compressionPools readOnlyCompressionPools
	bufferPool       *bufferPool
	codec            Codec
	marshaler        connectStreamingMarshaler
	unmarshaler      connectStreamingUnmarshaler
	responseHeader   http.Header
	responseTrailer  http.Header
}

func (cc *connectStreamingClientConn) Spec() Spec {
	return cc.spec
}

func (cc *connectStreamingClientConn) Peer() Peer {
	return cc.peer
}

func (cc *connectStreamingClientConn) Send(msg any) error {
	if err := cc.marshaler.Marshal(msg); err != nil {
		return err
	}
	return nil // must be a literal nil: nil *Error is a non-nil error
}

func (cc *connectStreamingClientConn) RequestHeader() http.Header {
	return cc.duplexCall.Header()
}

func (cc *connectStreamingClientConn) CloseRequest() error {
	return cc.duplexCall.CloseWrite()
}

func (cc *connectStreamingClientConn) Receive(msg any) error {
	if err := cc.duplexCall.BlockUntilResponseReady(); err != nil {
		return err
	}
	err := cc.unmarshaler.Unmarshal(msg)
	if err == nil {
		return nil
	}
	// See if the server sent an explicit error in the end-of-stream message.
	mergeHeaders(cc.responseTrailer, cc.unmarshaler.Trailer())
	if serverErr := cc.unmarshaler.EndStreamError(); serverErr != nil {
		// This is expected from a protocol perspective, but receiving an
		// end-of-stream message means that we're _not_ getting a regular message.
		// For users to realize that the stream has ended, Receive must return an
		// error.
		serverErr.meta = cc.responseHeader.Clone()
		mergeHeaders(serverErr.meta, cc.responseTrailer)
		_ = cc.duplexCall.CloseWrite()
		return serverErr
	}
	// If the error is EOF but not from a last message, we want to return
	// io.ErrUnexpectedEOF instead.
	if errors.Is(err, io.EOF) && !errors.Is(err, errSpecialEnvelope) {
		err = errorf(CodeInternal, "protocol error: %w", io.ErrUnexpectedEOF)
	}
	// There's no error in the trailers, so this was probably an error
	// converting the bytes to a message, an error reading from the network, or
	// just an EOF. We're going to return it to the user, but we also want to
	// close the writer so Send errors out.
	_ = cc.duplexCall.CloseWrite()
	return err
}

func (cc *connectStreamingClientConn) ResponseHeader() http.Header {
	_ = cc.duplexCall.BlockUntilResponseReady()
	return cc.responseHeader
}

func (cc *connectStreamingClientConn) ResponseTrailer() http.Header {
	_ = cc.duplexCall.BlockUntilResponseReady()
	return cc.responseTrailer
}

func (cc *connectStreamingClientConn) CloseResponse() error {
	return cc.duplexCall.CloseRead()
}

func (cc *connectStreamingClientConn) onRequestSend(fn func(*http.Request)) {
	cc.duplexCall.onRequestSend = fn
}

func (cc *connectStreamingClientConn) validateResponse(response *http.Response) *Error {
	if response.StatusCode != http.StatusOK {
		return errorf(httpToCode(response.StatusCode), "HTTP status %v", response.Status)
	}
	if err := connectValidateStreamResponseContentType(
		cc.codec.Name(),
		cc.spec.StreamType,
		getHeaderCanonical(response.Header, headerContentType),
	); err != nil {
		return err
	}
	compression := getHeaderCanonical(response.Header, connectStreamingHeaderCompression)
	if compression != "" &&
		compression != compressionIdentity &&
		!cc.compressionPools.Contains(compression) {
		return errorf(
			CodeInternal,
			"unknown encoding %q: accepted encodings are %v",
			compression,
			cc.compressionPools.CommaSeparatedNames(),
		)
	}
	cc.unmarshaler.compressionPool = cc.compressionPools.Get(compression)
	mergeHeaders(cc.responseHeader, response.Header)
	return nil
}

type connectUnaryHandlerConn struct {
	spec            Spec
	peer            Peer
	request         *http.Request
	responseWriter  http.ResponseWriter
	marshaler       connectUnaryMarshaler
	unmarshaler     connectUnaryUnmarshaler
	responseTrailer http.Header
}

func (hc *connectUnaryHandlerConn) Spec() Spec {
	return hc.spec
}

func (hc *connectUnaryHandlerConn) Peer() Peer {
	return hc.peer
}

func (hc *connectUnaryHandlerConn) Receive(msg any) error {
	if err := hc.unmarshaler.Unmarshal(msg); err != nil {
		return err
	}
	return nil // must be a literal nil: nil *Error is a non-nil error
}

func (hc *connectUnaryHandlerConn) RequestHeader() http.Header {
	return hc.request.Header
}

func (hc *connectUnaryHandlerConn) Send(msg any) error {
	hc.mergeResponseHeader(nil /* error */)
	if err := hc.marshaler.Marshal(msg); err != nil {
		return err
	}
	return nil // must be a literal nil: nil *Error is a non-nil error
}

func (hc *connectUnaryHandlerConn) ResponseHeader() http.Header {
	return hc.responseWriter.Header()
}

func (hc *connectUnaryHandlerConn) ResponseTrailer() http.Header {
	return hc.responseTrailer
}

func (hc *connectUnaryHandlerConn) Close(err error) error {
	if !hc.marshaler.wroteHeader {
		hc.mergeResponseHeader(err)
		// If the handler received a GET request and the resource hasn't changed,
		// return a 304.
		if len(hc.peer.Query) > 0 && IsNotModifiedError(err) {
			hc.responseWriter.WriteHeader(http.StatusNotModified)
			return hc.request.Body.Close()
		}
	}
	if err == nil || hc.marshaler.wroteHeader {
		return hc.request.Body.Close()
	}
	// In unary Connect, errors always use application/json.
	setHeaderCanonical(hc.responseWriter.Header(), headerContentType, connectUnaryContentTypeJSON)
	hc.responseWriter.WriteHeader(connectCodeToHTTP(CodeOf(err)))
	data, marshalErr := json.Marshal(newConnectWireError(err))
	if marshalErr != nil {
		_ = hc.request.Body.Close()
		return errorf(CodeInternal, "marshal error: %w", err)
	}
	if _, writeErr := hc.responseWriter.Write(data); writeErr != nil {
		_ = hc.request.Body.Close()
		return writeErr
	}
	return hc.request.Body.Close()
}

func (hc *connectUnaryHandlerConn) getHTTPMethod() string {
	return hc.request.Method
}

func (hc *connectUnaryHandlerConn) mergeResponseHeader(err error) {
	header := hc.responseWriter.Header()
	if hc.request.Method == http.MethodGet {
		// The response content varies depending on the compression that the client
		// requested (if any). GETs are potentially cacheable, so we should ensure
		// that the Vary header includes at least Accept-Encoding (and not overwrite any values already set).
		header[headerVary] = append(header[headerVary], connectUnaryHeaderAcceptCompression)
	}
	if err != nil {
		if connectErr, ok := asError(err); ok && !connectErr.wireErr {
			mergeNonProtocolHeaders(header, connectErr.meta)
		}
	}
	for k, v := range hc.responseTrailer {
		header[connectUnaryTrailerPrefix+k] = v
	}
}

type connectStreamingHandlerConn struct {
	spec            Spec
	peer            Peer
	request         *http.Request
	responseWriter  http.ResponseWriter
	marshaler       connectStreamingMarshaler
	unmarshaler     connectStreamingUnmarshaler
	responseTrailer http.Header
}

func (hc *connectStreamingHandlerConn) Spec() Spec {
	return hc.spec
}

func (hc *connectStreamingHandlerConn) Peer() Peer {
	return hc.peer
}

func (hc *connectStreamingHandlerConn) Receive(msg any) error {
	if err := hc.unmarshaler.Unmarshal(msg); err != nil {
		// Clients may not send end-of-stream metadata, so we don't need to handle
		// errSpecialEnvelope.
		return err
	}
	return nil // must be a literal nil: nil *Error is a non-nil error
}

func (hc *connectStreamingHandlerConn) RequestHeader() http.Header {
	return hc.request.Header
}

func (hc *connectStreamingHandlerConn) Send(msg any) error {
	defer flushResponseWriter(hc.responseWriter)
	if err := hc.marshaler.Marshal(msg); err != nil {
		return err
	}
	return nil // must be a literal nil: nil *Error is a non-nil error
}

func (hc *connectStreamingHandlerConn) ResponseHeader() http.Header {
	return hc.responseWriter.Header()
}

func (hc *connectStreamingHandlerConn) ResponseTrailer() http.Header {
	return hc.responseTrailer
}

func (hc *connectStreamingHandlerConn) Close(err error) error {
	defer flushResponseWriter(hc.responseWriter)
	if err := hc.marshaler.MarshalEndStream(err, hc.responseTrailer); err != nil {
		_ = hc.request.Body.Close()
		return err
	}
	// We don't want to copy unread portions of the body to /dev/null here: if
	// the client hasn't closed the request body, we'll block until the server
	// timeout kicks in. This could happen because the client is malicious, but
	// a well-intentioned client may just not expect the server to be returning
	// an error for a streaming RPC. Better to accept that we can't always reuse
	// TCP connections.
	if err := hc.request.Body.Close(); err != nil {
		if connectErr, ok := asError(err); ok {
			return connectErr
		}
		return NewError(CodeUnknown, err)
	}
	return nil // must be a literal nil: nil *Error is a non-nil error
}

type connectStreamingMarshaler struct {
	envelopeWriter
}

func (m *connectStreamingMarshaler) MarshalEndStream(err error, trailer http.Header) *Error {
	end := &connectEndStreamMessage{Trailer: trailer}
	if err != nil {
		end.Error = newConnectWireError(err)
		if connectErr, ok := asError(err); ok && !connectErr.wireErr {
			mergeNonProtocolHeaders(end.Trailer, connectErr.meta)
		}
	}
	data, marshalErr := json.Marshal(end)
	if marshalErr != nil {
		return errorf(CodeInternal, "marshal end stream: %w", marshalErr)
	}
	raw := bytes.NewBuffer(data)
	defer m.envelopeWriter.bufferPool.Put(raw)
	return m.Write(&envelope{
		Data:  raw,
		Flags: connectFlagEnvelopeEndStream,
	})
}

type connectStreamingUnmarshaler struct {
	envelopeReader

	endStreamErr *Error
	trailer      http.Header
}

func (u *connectStreamingUnmarshaler) Unmarshal(message any) *Error {
	err := u.envelopeReader.Unmarshal(message)
	if err == nil {
		return nil
	}
	if !errors.Is(err, errSpecialEnvelope) {
		return err
	}
	env := u.last
	data := env.Data
	u.last.Data = nil // don't keep a reference to it
	defer u.bufferPool.Put(data)
	if !env.IsSet(connectFlagEnvelopeEndStream) {
		return errorf(CodeInternal, "protocol error: invalid envelope flags %d", env.Flags)
	}
	var end connectEndStreamMessage
	if err := json.Unmarshal(data.Bytes(), &end); err != nil {
		return errorf(CodeInternal, "unmarshal end stream message: %w", err)
	}
	for name, value := range end.Trailer {
		canonical := http.CanonicalHeaderKey(name)
		if name != canonical {
			delHeaderCanonical(end.Trailer, name)
			end.Trailer[canonical] = append(end.Trailer[canonical], value...)
		}
	}
	u.trailer = end.Trailer
	u.endStreamErr = end.Error.asError()
	return errSpecialEnvelope
}

func (u *connectStreamingUnmarshaler) Trailer() http.Header {
	return u.trailer
}

func (u *connectStreamingUnmarshaler) EndStreamError() *Error {
	return u.endStreamErr
}

type connectUnaryMarshaler struct {
	ctx              context.Context //nolint:containedctx
	sender           messageSender
	codec            Codec
	compressMinBytes int
	compressionName  string
	compressionPool  *compressionPool
	bufferPool       *bufferPool
	header           http.Header
	sendMaxBytes     int
	wroteHeader      bool
}

func (m *connectUnaryMarshaler) Marshal(message any) *Error {
	if message == nil {
		return m.write(nil)
	}
	var data []byte
	var err error
	if appender, ok := m.codec.(marshalAppender); ok {
		data, err = appender.MarshalAppend(m.bufferPool.Get().Bytes(), message)
	} else {
		// Can't avoid allocating the slice, but we'll reuse it.
		data, err = m.codec.Marshal(message)
	}
	if err != nil {
		return errorf(CodeInternal, "marshal message: %w", err)
	}
	uncompressed := bytes.NewBuffer(data)
	defer m.bufferPool.Put(uncompressed)
	if len(data) < m.compressMinBytes || m.compressionPool == nil {
		if m.sendMaxBytes > 0 && len(data) > m.sendMaxBytes {
			return NewError(CodeResourceExhausted, fmt.Errorf("message size %d exceeds sendMaxBytes %d", len(data), m.sendMaxBytes))
		}
		return m.write(data)
	}
	compressed := m.bufferPool.Get()
	defer m.bufferPool.Put(compressed)
	if err := m.compressionPool.Compress(compressed, uncompressed); err != nil {
		return err
	}
	if m.sendMaxBytes > 0 && compressed.Len() > m.sendMaxBytes {
		return NewError(CodeResourceExhausted, fmt.Errorf("compressed message size %d exceeds sendMaxBytes %d", compressed.Len(), m.sendMaxBytes))
	}
	setHeaderCanonical(m.header, connectUnaryHeaderCompression, m.compressionName)
	return m.write(compressed.Bytes())
}

func (m *connectUnaryMarshaler) write(data []byte) *Error {
	m.wroteHeader = true
	payload := bytes.NewReader(data)
	if _, err := m.sender.Send(payload); err != nil {
		err = wrapIfContextError(err)
		if connectErr, ok := asError(err); ok {
			return connectErr
		}
		return errorf(CodeUnknown, "write message: %w", err)
	}
	return nil
}

type connectUnaryRequestMarshaler struct {
	connectUnaryMarshaler

	enableGet      bool
	getURLMaxBytes int
	getUseFallback bool
	stableCodec    stableCodec
	duplexCall     *duplexHTTPCall
}

func (m *connectUnaryRequestMarshaler) Marshal(message any) *Error {
	if m.enableGet {
		if m.stableCodec == nil && !m.getUseFallback {
			return errorf(CodeInternal, "codec %s doesn't support stable marshal; can't use get", m.codec.Name())
		}
		if m.stableCodec != nil {
			return m.marshalWithGet(message)
		}
	}
	return m.connectUnaryMarshaler.Marshal(message)
}

func (m *connectUnaryRequestMarshaler) marshalWithGet(message any) *Error {
	// TODO(jchadwick-buf): This function is mostly a superset of
	// connectUnaryMarshaler.Marshal. This should be reconciled at some point.
	var data []byte
	var err error
	if message != nil {
		data, err = m.stableCodec.MarshalStable(message)
		if err != nil {
			return errorf(CodeInternal, "marshal message stable: %w", err)
		}
	}
	isTooBig := m.sendMaxBytes > 0 && len(data) > m.sendMaxBytes
	if isTooBig && m.compressionPool == nil {
		return NewError(CodeResourceExhausted, fmt.Errorf(
			"message size %d exceeds sendMaxBytes %d: enabling request compression may help",
			len(data),
			m.sendMaxBytes,
		))
	}
	if !isTooBig {
		url := m.buildGetURL(data, false /* compressed */)
		if m.getURLMaxBytes <= 0 || len(url.String()) < m.getURLMaxBytes {
			m.writeWithGet(url)
			return nil
		}
		if m.compressionPool == nil {
			if m.getUseFallback {
				return m.write(data)
			}
			return NewError(CodeResourceExhausted, fmt.Errorf(
				"url size %d exceeds getURLMaxBytes %d: enabling request compression may help",
				len(url.String()),
				m.getURLMaxBytes,
			))
		}
	}
	// Compress message to try to make it fit in the URL.
	uncompressed := bytes.NewBuffer(data)
	defer m.bufferPool.Put(uncompressed)
	compressed := m.bufferPool.Get()
	defer m.bufferPool.Put(compressed)
	if err := m.compressionPool.Compress(compressed, uncompressed); err != nil {
		return err
	}
	if m.sendMaxBytes > 0 && compressed.Len() > m.sendMaxBytes {
		return NewError(CodeResourceExhausted, fmt.Errorf("compressed message size %d exceeds sendMaxBytes %d", compressed.Len(), m.sendMaxBytes))
	}
	url := m.buildGetURL(compressed.Bytes(), true /* compressed */)
	if m.getURLMaxBytes <= 0 || len(url.String()) < m.getURLMaxBytes {
		m.writeWithGet(url)
		return nil
	}
	if m.getUseFallback {
		setHeaderCanonical(m.header, connectUnaryHeaderCompression, m.compressionName)
		return m.write(compressed.Bytes())
	}
	return NewError(CodeResourceExhausted, fmt.Errorf("compressed url size %d exceeds getURLMaxBytes %d", len(url.String()), m.getURLMaxBytes))
}

func (m *connectUnaryRequestMarshaler) buildGetURL(data []byte, compressed bool) *url.URL {
	url := *m.duplexCall.URL()
	query := url.Query()
	query.Set(connectUnaryConnectQueryParameter, connectUnaryConnectQueryValue)
	query.Set(connectUnaryEncodingQueryParameter, m.codec.Name())
	if m.stableCodec.IsBinary() || compressed {
		query.Set(connectUnaryMessageQueryParameter, encodeBinaryQueryValue(data))
		query.Set(connectUnaryBase64QueryParameter, "1")
	} else {
		query.Set(connectUnaryMessageQueryParameter, string(data))
	}
	if compressed {
		query.Set(connectUnaryCompressionQueryParameter, m.compressionName)
	}
	url.RawQuery = query.Encode()
	return &url
}

func (m *connectUnaryRequestMarshaler) writeWithGet(url *url.URL) {
	delHeaderCanonical(m.header, connectHeaderProtocolVersion)
	delHeaderCanonical(m.header, headerContentType)
	delHeaderCanonical(m.header, headerContentEncoding)
	delHeaderCanonical(m.header, headerContentLength)
	m.duplexCall.SetMethod(http.MethodGet)
	*m.duplexCall.URL() = *url
}

type connectUnaryUnmarshaler struct {
	ctx             context.Context //nolint:containedctx
	reader          io.Reader
	codec           Codec
	compressionPool *compressionPool
	bufferPool      *bufferPool
	alreadyRead     bool
	readMaxBytes    int
}

func (u *connectUnaryUnmarshaler) Unmarshal(message any) *Error {
	return u.UnmarshalFunc(message, u.codec.Unmarshal)
}

func (u *connectUnaryUnmarshaler) UnmarshalFunc(message any, unmarshal func([]byte, any) error) *Error {
	if u.alreadyRead {
		return NewError(CodeInternal, io.EOF)
	}
	u.alreadyRead = true
	data := u.bufferPool.Get()
	defer u.bufferPool.Put(data)
	reader := u.reader
	if u.readMaxBytes > 0 && int64(u.readMaxBytes) < math.MaxInt64 {
		reader = io.LimitReader(u.reader, int64(u.readMaxBytes)+1)
	}
	// ReadFor ignores io.EOF, so any error here is real.
	bytesRead, err := data.ReadFrom(reader)
	if err != nil {
		err = wrapIfMaxBytesError(err, "read first %d bytes of message", bytesRead)
		err = wrapIfContextDone(u.ctx, err)
		if connectErr, ok := asError(err); ok {
			return connectErr
		}
		return errorf(CodeUnknown, "read message: %w", err)
	}
	if u.readMaxBytes > 0 && bytesRead > int64(u.readMaxBytes) {
		// Attempt to read to end in order to allow connection re-use
		discardedBytes, err := io.Copy(io.Discard, u.reader)
		if err != nil {
			return errorf(CodeResourceExhausted, "message is larger than configured max %d - unable to determine message size: %w", u.readMaxBytes, err)
		}
		return errorf(CodeResourceExhausted, "message size %d is larger than configured max %d", bytesRead+discardedBytes, u.readMaxBytes)
	}
	if data.Len() > 0 && u.compressionPool != nil {
		decompressed := u.bufferPool.Get()
		defer u.bufferPool.Put(decompressed)
		if err := u.compressionPool.Decompress(decompressed, data, int64(u.readMaxBytes)); err != nil {
			return err
		}
		data = decompressed
	}
	if err := unmarshal(data.Bytes(), message); err != nil {
		return errorf(CodeInvalidArgument, "unmarshal message: %w", err)
	}
	return nil
}

type connectWireDetail ErrorDetail

func (d *connectWireDetail) MarshalJSON() ([]byte, error) {
	if d.wireJSON != "" {
		// If we unmarshaled this detail from JSON, return the original data. This
		// lets proxies w/o protobuf descriptors preserve human-readable details.
		return []byte(d.wireJSON), nil
	}
	wire := struct {
		Type  string          `json:"type"`
		Value string          `json:"value"`
		Debug json.RawMessage `json:"debug,omitempty"`
	}{
		Type:  typeNameForURL(d.pbAny.GetTypeUrl()),
		Value: base64.RawStdEncoding.EncodeToString(d.pbAny.GetValue()),
	}
	// Try to produce debug info, but expect failure when we don't have
	// descriptors.
	msg, err := d.getInner()
	if err == nil {
		var codec protoJSONCodec
		debug, err := codec.Marshal(msg)
		if err == nil {
			wire.Debug = debug
		}
	}
	return json.Marshal(wire)
}

func (d *connectWireDetail) UnmarshalJSON(data []byte) error {
	var wire struct {
		Type  string `json:"type"`
		Value string `json:"value"`
	}
	if err := json.Unmarshal(data, &wire); err != nil {
		return err
	}
	if !strings.Contains(wire.Type, "/") {
		wire.Type = defaultAnyResolverPrefix + wire.Type
	}
	decoded, err := DecodeBinaryHeader(wire.Value)
	if err != nil {
		return fmt.Errorf("decode base64: %w", err)
	}
	*d = connectWireDetail{
		pbAny: &anypb.Any{
			TypeUrl: wire.Type,
			Value:   decoded,
		},
		wireJSON: string(data),
	}
	return nil
}

func (d *connectWireDetail) getInner() (proto.Message, error) {
	if d.pbInner != nil {
		return d.pbInner, nil
	}
	return d.pbAny.UnmarshalNew()
}

type connectWireError struct {
	Code    Code                 `json:"code"`
	Message string               `json:"message,omitempty"`
	Details []*connectWireDetail `json:"details,omitempty"`
}

func newConnectWireError(err error) *connectWireError {
	wire := &connectWireError{
		Code:    CodeUnknown,
		Message: err.Error(),
	}
	if connectErr, ok := asError(err); ok {
		wire.Code = connectErr.Code()
		wire.Message = connectErr.Message()
		if len(connectErr.details) > 0 {
			wire.Details = make([]*connectWireDetail, len(connectErr.details))
			for i, detail := range connectErr.details {
				wire.Details[i] = (*connectWireDetail)(detail)
			}
		}
	}
	return wire
}

func (e *connectWireError) asError() *Error {
	if e == nil {
		return nil
	}
	if e.Code < minCode || e.Code > maxCode {
		e.Code = CodeUnknown
	}
	err := NewWireError(e.Code, errors.New(e.Message))
	if len(e.Details) > 0 {
		err.details = make([]*ErrorDetail, len(e.Details))
		for i, detail := range e.Details {
			err.details[i] = (*ErrorDetail)(detail)
		}
	}
	return err
}

func (e *connectWireError) UnmarshalJSON(data []byte) error {
	// We want to be lenient if the JSON has an unrecognized or invalid code.
	// So if that occurs, we leave the code unset but can still de-serialize
	// the other fields from the input JSON.
	var wireError struct {
		Code    string               `json:"code"`
		Message string               `json:"message"`
		Details []*connectWireDetail `json:"details"`
	}
	err := json.Unmarshal(data, &wireError)
	if err != nil {
		return err
	}
	e.Message = wireError.Message
	e.Details = wireError.Details
	// This will leave e.Code unset if we can't unmarshal the given string.
	_ = e.Code.UnmarshalText([]byte(wireError.Code))
	return nil
}

type connectEndStreamMessage struct {
	Error   *connectWireError `json:"error,omitempty"`
	Trailer http.Header       `json:"metadata,omitempty"`
}

func connectCodeToHTTP(code Code) int {
	// Return literals rather than named constants from the HTTP package to make
	// it easier to compare this function to the Connect specification.
	switch code {
	case CodeCanceled:
		return 499
	case CodeUnknown:
		return 500
	case CodeInvalidArgument:
		return 400
	case CodeDeadlineExceeded:
		return 504
	case CodeNotFound:
		return 404
	case CodeAlreadyExists:
		return 409
	case CodePermissionDenied:
		return 403
	case CodeResourceExhausted:
		return 429
	case CodeFailedPrecondition:
		return 400
	case CodeAborted:
		return 409
	case CodeOutOfRange:
		return 400
	case CodeUnimplemented:
		return 501
	case CodeInternal:
		return 500
	case CodeUnavailable:
		return 503
	case CodeDataLoss:
		return 500
	case CodeUnauthenticated:
		return 401
	default:
		return 500 // same as CodeUnknown
	}
}

func connectCodecForContentType(streamType StreamType, contentType string) string {
	if streamType == StreamTypeUnary {
		return strings.TrimPrefix(contentType, connectUnaryContentTypePrefix)
	}
	return strings.TrimPrefix(contentType, connectStreamingContentTypePrefix)
}

func connectContentTypeForCodecName(streamType StreamType, name string) string {
	if streamType == StreamTypeUnary {
		return connectUnaryContentTypePrefix + name
	}
	return connectStreamingContentTypePrefix + name
}

// encodeBinaryQueryValue URL-safe base64-encodes data, without padding.
func encodeBinaryQueryValue(data []byte) string {
	return base64.RawURLEncoding.EncodeToString(data)
}

// binaryQueryValueReader creates a reader that can read either padded or
// unpadded URL-safe base64 from a string.
func binaryQueryValueReader(data string) io.Reader {
	stringReader := strings.NewReader(data)
	if len(data)%4 != 0 {
		// Data definitely isn't padded.
		return base64.NewDecoder(base64.RawURLEncoding, stringReader)
	}
	// Data is padded, or no padding was necessary.
	return base64.NewDecoder(base64.URLEncoding, stringReader)
}

// queryValueReader creates a reader for a string that may be URL-safe base64
// encoded.
func queryValueReader(data string, base64Encoded bool) io.Reader {
	if base64Encoded {
		return binaryQueryValueReader(data)
	}
	return strings.NewReader(data)
}

func connectValidateUnaryResponseContentType(
	requestCodecName string,
	httpMethod string,
	statusCode int,
	statusMsg string,
	responseContentType string,
) *Error {
	if statusCode != http.StatusOK {
		if statusCode == http.StatusNotModified && httpMethod == http.MethodGet {
			return NewWireError(CodeUnknown, errNotModifiedClient)
		}
		// Error responses must be JSON-encoded.
		if responseContentType == connectUnaryContentTypePrefix+codecNameJSON ||
			responseContentType == connectUnaryContentTypePrefix+codecNameJSONCharsetUTF8 {
			return nil
		}
		return NewError(
			httpToCode(statusCode),
			errors.New(statusMsg),
		)
	}
	// Normal responses must have valid content-type that indicates same codec as the request.
	if !strings.HasPrefix(responseContentType, connectUnaryContentTypePrefix) {
		// Doesn't even look like a Connect response? Use code "unknown".
		return errorf(
			CodeUnknown,
			"invalid content-type: %q; expecting %q",
			responseContentType,
			connectUnaryContentTypePrefix+requestCodecName,
		)
	}
	responseCodecName := connectCodecForContentType(
		StreamTypeUnary,
		responseContentType,
	)
	if responseCodecName == requestCodecName {
		return nil
	}
	// HACK: We likely want a better way to handle the optional "charset" parameter
	//       for application/json, instead of hard-coding. But this suffices for now.
	if (responseCodecName == codecNameJSON && requestCodecName == codecNameJSONCharsetUTF8) ||
		(responseCodecName == codecNameJSONCharsetUTF8 && requestCodecName == codecNameJSON) {
		// Both are JSON
		return nil
	}
	return errorf(
		CodeInternal,
		"invalid content-type: %q; expecting %q",
		responseContentType,
		connectUnaryContentTypePrefix+requestCodecName,
	)
}

func connectValidateStreamResponseContentType(requestCodecName string, streamType StreamType, responseContentType string) *Error {
	// Responses must have valid content-type that indicates same codec as the request.
	if !strings.HasPrefix(responseContentType, connectStreamingContentTypePrefix) {
		// Doesn't even look like a Connect response? Use code "unknown".
		return errorf(
			CodeUnknown,
			"invalid content-type: %q; expecting %q",
			responseContentType,
			connectStreamingContentTypePrefix+requestCodecName,
		)
	}
	responseCodecName := connectCodecForContentType(
		streamType,
		responseContentType,
	)
	if responseCodecName != requestCodecName {
		return errorf(
			CodeInternal,
			"invalid content-type: %q; expecting %q",
			responseContentType,
			connectStreamingContentTypePrefix+requestCodecName,
		)
	}
	return nil
}

func connectCheckProtocolVersion(request *http.Request, required bool) *Error {
	switch request.Method {
	case http.MethodGet:
		version := request.URL.Query().Get(connectUnaryConnectQueryParameter)
		if version == "" && required {
			return errorf(CodeInvalidArgument, "missing required query parameter: set %s to %q", connectUnaryConnectQueryParameter, connectUnaryConnectQueryValue)
		} else if version != "" && version != connectUnaryConnectQueryValue {
			return errorf(CodeInvalidArgument, "%s must be %q: got %q", connectUnaryConnectQueryParameter, connectUnaryConnectQueryValue, version)
		}
	case http.MethodPost:
		version := getHeaderCanonical(request.Header, connectHeaderProtocolVersion)
		if version == "" && required {
			return errorf(CodeInvalidArgument, "missing required header: set %s to %q", connectHeaderProtocolVersion, connectProtocolVersion)
		} else if version != "" && version != connectProtocolVersion {
			return errorf(CodeInvalidArgument, "%s must be %q: got %q", connectHeaderProtocolVersion, connectProtocolVersion, version)
		}
	default:
		return errorf(CodeInvalidArgument, "unsupported method: %q", request.Method)
	}
	return nil
}
