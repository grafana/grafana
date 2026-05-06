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
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

// protocolType is one of the supported RPC protocols.
type protocolType uint8

const (
	unknownProtocol protocolType = iota
	connectUnaryProtocol
	connectStreamProtocol
	grpcProtocol
	grpcWebProtocol
)

// An ErrorWriter writes errors to an [http.ResponseWriter] in the format
// expected by an RPC client. This is especially useful in server-side net/http
// middleware, where you may wish to handle requests from RPC and non-RPC
// clients with the same code.
//
// ErrorWriters are safe to use concurrently.
type ErrorWriter struct {
	bufferPool                   *bufferPool
	protobuf                     Codec
	requireConnectProtocolHeader bool
}

// NewErrorWriter constructs an ErrorWriter. Handler options may be passed to
// configure the error writer behaviour to match the handlers.
// [WithRequiredConnectProtocolHeader] will assert that Connect protocol
// requests include the version header allowing the error writer to correctly
// classify the request.
// Options supplied via [WithConditionalHandlerOptions] are ignored.
func NewErrorWriter(opts ...HandlerOption) *ErrorWriter {
	config := newHandlerConfig("", StreamTypeUnary, opts)
	codecs := newReadOnlyCodecs(config.Codecs)
	return &ErrorWriter{
		bufferPool:                   config.BufferPool,
		protobuf:                     codecs.Protobuf(),
		requireConnectProtocolHeader: config.RequireConnectProtocolHeader,
	}
}

func (w *ErrorWriter) classifyRequest(request *http.Request) protocolType {
	ctype := canonicalizeContentType(getHeaderCanonical(request.Header, headerContentType))
	isPost := request.Method == http.MethodPost
	isGet := request.Method == http.MethodGet
	switch {
	case isPost && (ctype == grpcContentTypeDefault || strings.HasPrefix(ctype, grpcContentTypePrefix)):
		return grpcProtocol
	case isPost && (ctype == grpcWebContentTypeDefault || strings.HasPrefix(ctype, grpcWebContentTypePrefix)):
		return grpcWebProtocol
	case isPost && strings.HasPrefix(ctype, connectStreamingContentTypePrefix):
		// Streaming ignores the requireConnectProtocolHeader option as the
		// Content-Type is enough to determine the protocol.
		if err := connectCheckProtocolVersion(request, false /* required */); err != nil {
			return unknownProtocol
		}
		return connectStreamProtocol
	case isPost && strings.HasPrefix(ctype, connectUnaryContentTypePrefix):
		if err := connectCheckProtocolVersion(request, w.requireConnectProtocolHeader); err != nil {
			return unknownProtocol
		}
		return connectUnaryProtocol
	case isGet:
		if err := connectCheckProtocolVersion(request, w.requireConnectProtocolHeader); err != nil {
			return unknownProtocol
		}
		return connectUnaryProtocol
	default:
		return unknownProtocol
	}
}

// IsSupported checks whether a request is using one of the ErrorWriter's
// supported RPC protocols.
func (w *ErrorWriter) IsSupported(request *http.Request) bool {
	return w.classifyRequest(request) != unknownProtocol
}

// Write an error, using the format appropriate for the RPC protocol in use.
// Callers should first use IsSupported to verify that the request is using one
// of the ErrorWriter's supported RPC protocols. If the protocol is unknown,
// Write will send the error as unprefixed, Connect-formatted JSON.
//
// Write does not read or close the request body.
func (w *ErrorWriter) Write(response http.ResponseWriter, request *http.Request, err error) error {
	ctype := canonicalizeContentType(getHeaderCanonical(request.Header, headerContentType))
	switch protocolType := w.classifyRequest(request); protocolType {
	case connectStreamProtocol:
		setHeaderCanonical(response.Header(), headerContentType, ctype)
		return w.writeConnectStreaming(response, err)
	case grpcProtocol:
		setHeaderCanonical(response.Header(), headerContentType, ctype)
		return w.writeGRPC(response, err)
	case grpcWebProtocol:
		setHeaderCanonical(response.Header(), headerContentType, ctype)
		return w.writeGRPCWeb(response, err)
	case unknownProtocol, connectUnaryProtocol:
		fallthrough
	default:
		// Unary errors are always JSON. Unknown protocols are treated as unary
		// because they are likely to be Connect clients and will still be able to
		// parse the error as it's in a human-readable format.
		setHeaderCanonical(response.Header(), headerContentType, connectUnaryContentTypeJSON)
		return w.writeConnectUnary(response, err)
	}
}

func (w *ErrorWriter) writeConnectUnary(response http.ResponseWriter, err error) error {
	if connectErr, ok := asError(err); ok && !connectErr.wireErr {
		mergeNonProtocolHeaders(response.Header(), connectErr.meta)
	}
	response.WriteHeader(connectCodeToHTTP(CodeOf(err)))
	data, marshalErr := json.Marshal(newConnectWireError(err))
	if marshalErr != nil {
		return fmt.Errorf("marshal error: %w", marshalErr)
	}
	_, writeErr := response.Write(data)
	return writeErr
}

func (w *ErrorWriter) writeConnectStreaming(response http.ResponseWriter, err error) error {
	response.WriteHeader(http.StatusOK)
	marshaler := &connectStreamingMarshaler{
		envelopeWriter: envelopeWriter{
			sender:     writeSender{writer: response},
			bufferPool: w.bufferPool,
		},
	}
	// MarshalEndStream returns *Error: check return value to avoid typed nils.
	if marshalErr := marshaler.MarshalEndStream(err, make(http.Header)); marshalErr != nil {
		return marshalErr
	}
	return nil
}

func (w *ErrorWriter) writeGRPC(response http.ResponseWriter, err error) error {
	trailers := make(http.Header, 2) // need space for at least code & message
	grpcErrorToTrailer(trailers, w.protobuf, err)
	// To make net/http reliably send trailers without a body, we must set the
	// Trailers header rather than using http.TrailerPrefix. See
	// https://github.com/golang/go/issues/54723.
	keys := make([]string, 0, len(trailers))
	for k := range trailers {
		keys = append(keys, k)
	}
	setHeaderCanonical(response.Header(), headerTrailer, strings.Join(keys, ","))
	response.WriteHeader(http.StatusOK)
	mergeHeaders(response.Header(), trailers)
	return nil
}

func (w *ErrorWriter) writeGRPCWeb(response http.ResponseWriter, err error) error {
	// This is a trailers-only response. To match the behavior of Envoy and
	// protocol_grpc.go, put the trailers in the HTTP headers.
	grpcErrorToTrailer(response.Header(), w.protobuf, err)
	response.WriteHeader(http.StatusOK)
	return nil
}
