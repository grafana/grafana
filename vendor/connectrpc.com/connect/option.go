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
	"compress/gzip"
	"context"
	"io"
	"net/http"
)

// A ClientOption configures a [Client].
//
// In addition to any options grouped in the documentation below, remember that
// any [Option] is also a valid ClientOption.
type ClientOption interface {
	applyToClient(*clientConfig)
}

// WithAcceptCompression makes a compression algorithm available to a client.
// Clients ask servers to compress responses using any of the registered
// algorithms. The first registered algorithm is treated as the least
// preferred, and the last registered algorithm is the most preferred.
//
// It's safe to use this option liberally: servers will ignore any
// compression algorithms they don't support. To compress requests, pair this
// option with [WithSendCompression]. To remove support for a
// previously-registered compression algorithm, use WithAcceptCompression with
// nil decompressor and compressor constructors.
//
// Clients accept gzipped responses by default, using a compressor backed by the
// standard library's [gzip] package with the default compression level. Use
// [WithSendGzip] to compress requests with gzip.
//
// Calling WithAcceptCompression with an empty name is a no-op.
func WithAcceptCompression(
	name string,
	newDecompressor func() Decompressor,
	newCompressor func() Compressor,
) ClientOption {
	return &compressionOption{
		Name:            name,
		CompressionPool: newCompressionPool(newDecompressor, newCompressor),
	}
}

// WithClientOptions composes multiple ClientOptions into one.
func WithClientOptions(options ...ClientOption) ClientOption {
	return &clientOptionsOption{options}
}

// WithGRPC configures clients to use the HTTP/2 gRPC protocol.
func WithGRPC() ClientOption {
	return &grpcOption{web: false}
}

// WithGRPCWeb configures clients to use the gRPC-Web protocol.
func WithGRPCWeb() ClientOption {
	return &grpcOption{web: true}
}

// WithProtoJSON configures a client to send JSON-encoded data instead of
// binary Protobuf. It uses the standard Protobuf JSON mapping as implemented
// by [google.golang.org/protobuf/encoding/protojson]: fields are named using
// lowerCamelCase, zero values are omitted, missing required fields are errors,
// enums are emitted as strings, etc.
func WithProtoJSON() ClientOption {
	return WithCodec(&protoJSONCodec{codecNameJSON})
}

// WithSendCompression configures the client to use the specified algorithm to
// compress request messages. If the algorithm has not been registered using
// [WithAcceptCompression], the client will return errors at runtime.
//
// Because some servers don't support compression, clients default to sending
// uncompressed requests.
func WithSendCompression(name string) ClientOption {
	return &sendCompressionOption{Name: name}
}

// WithSendGzip configures the client to gzip requests. Since clients have
// access to a gzip compressor by default, WithSendGzip doesn't require
// [WithSendCompression].
//
// Some servers don't support gzip, so clients default to sending uncompressed
// requests.
func WithSendGzip() ClientOption {
	return WithSendCompression(compressionGzip)
}

// A HandlerOption configures a [Handler].
//
// In addition to any options grouped in the documentation below, remember that
// any [Option] is also a HandlerOption.
type HandlerOption interface {
	applyToHandler(*handlerConfig)
}

// WithCompression configures handlers to support a compression algorithm.
// Clients may send messages compressed with that algorithm and/or request
// compressed responses. The [Compressor] and [Decompressor] produced by the
// supplied constructors must use the same algorithm. Internally, Connect pools
// compressors and decompressors.
//
// By default, handlers support gzip using the standard library's
// [compress/gzip] package at the default compression level. To remove support for
// a previously-registered compression algorithm, use WithCompression with nil
// decompressor and compressor constructors.
//
// Calling WithCompression with an empty name is a no-op.
func WithCompression(
	name string,
	newDecompressor func() Decompressor,
	newCompressor func() Compressor,
) HandlerOption {
	return &compressionOption{
		Name:            name,
		CompressionPool: newCompressionPool(newDecompressor, newCompressor),
	}
}

// WithHandlerOptions composes multiple HandlerOptions into one.
func WithHandlerOptions(options ...HandlerOption) HandlerOption {
	return &handlerOptionsOption{options}
}

// WithRecover adds an interceptor that recovers from panics. The supplied
// function receives the context, [Spec], request headers, and the recovered
// value (which may be nil). It must return an error to send back to the
// client. It may also log the panic, emit metrics, or execute other
// error-handling logic. Handler functions must be safe to call concurrently.
//
// To preserve compatibility with [net/http]'s semantics, this interceptor
// doesn't handle panics with [http.ErrAbortHandler].
//
// By default, handlers don't recover from panics. Because the standard
// library's [http.Server] recovers from panics by default, this option isn't
// usually necessary to prevent crashes. Instead, it helps servers collect
// RPC-specific data during panics and send a more detailed error to
// clients.
func WithRecover(handle func(context.Context, Spec, http.Header, any) error) HandlerOption {
	return WithInterceptors(&recoverHandlerInterceptor{handle: handle})
}

// WithRequireConnectProtocolHeader configures the Handler to require requests
// using the Connect RPC protocol to include the Connect-Protocol-Version
// header. This ensures that HTTP proxies and net/http middleware can easily
// identify valid Connect requests, even if they use a common Content-Type like
// application/json. However, it makes ad-hoc requests with tools like cURL
// more laborious. Streaming requests are not affected by this option.
//
// This option has no effect if the client uses the gRPC or gRPC-Web protocols.
func WithRequireConnectProtocolHeader() HandlerOption {
	return &requireConnectProtocolHeaderOption{}
}

// WithConditionalHandlerOptions allows procedures in the same service to have
// different configurations: for example, one procedure may need a much larger
// WithReadMaxBytes setting than the others.
//
// WithConditionalHandlerOptions takes a function which may inspect each
// procedure's Spec before deciding which options to apply. Returning a nil
// slice is safe.
func WithConditionalHandlerOptions(conditional func(spec Spec) []HandlerOption) HandlerOption {
	return &conditionalHandlerOptions{conditional: conditional}
}

// Option implements both [ClientOption] and [HandlerOption], so it can be
// applied both client-side and server-side.
type Option interface {
	ClientOption
	HandlerOption
}

// WithSchema provides a parsed representation of the schema for an RPC to a
// client or handler. The supplied schema is exposed as [Spec.Schema]. This
// option is typically added by generated code.
//
// For services using protobuf schemas, the supplied schema should be a
// [protoreflect.MethodDescriptor].
func WithSchema(schema any) Option {
	return &schemaOption{Schema: schema}
}

// WithRequestInitializer provides a function that initializes a new message.
// It may be used to dynamically construct request messages. It is called on
// server receives to construct the message to be unmarshaled into. The message
// will be a non nil pointer to the type created by the handler. Use the Schema
// field of the [Spec] to determine the type of the message.
func WithRequestInitializer(initializer func(spec Spec, message any) error) HandlerOption {
	return &initializerOption{Initializer: initializer}
}

// WithResponseInitializer provides a function that initializes a new message.
// It may be used to dynamically construct response messages. It is called on
// client receives to construct the message to be unmarshaled into. The message
// will be a non nil pointer to the type created by the client. Use the Schema
// field of the [Spec] to determine the type of the message.
func WithResponseInitializer(initializer func(spec Spec, message any) error) ClientOption {
	return &initializerOption{Initializer: initializer}
}

// WithCodec registers a serialization method with a client or handler.
// Handlers may have multiple codecs registered, and use whichever the client
// chooses. Clients may only have a single codec.
//
// By default, handlers and clients support binary Protocol Buffer data using
// [google.golang.org/protobuf/proto]. Handlers also support JSON by default,
// using the standard Protobuf JSON mapping. Users with more specialized needs
// may override the default codecs by registering a new codec under the "proto"
// or "json" names. When supplying a custom "proto" codec, keep in mind that
// some unexported, protocol-specific messages are serialized using Protobuf -
// take care to fall back to the standard Protobuf implementation if
// necessary.
//
// Registering a codec with an empty name is a no-op.
func WithCodec(codec Codec) Option {
	return &codecOption{Codec: codec}
}

// WithCompressMinBytes sets a minimum size threshold for compression:
// regardless of compressor configuration, messages smaller than the configured
// minimum are sent uncompressed.
//
// The default minimum is zero. Setting a minimum compression threshold may
// improve overall performance, because the CPU cost of compressing very small
// messages usually isn't worth the small reduction in network I/O.
func WithCompressMinBytes(minBytes int) Option {
	return &compressMinBytesOption{Min: minBytes}
}

// WithReadMaxBytes limits the performance impact of pathologically large
// messages sent by the other party. For handlers, WithReadMaxBytes limits the size
// of a message that the client can send. For clients, WithReadMaxBytes limits the
// size of a message that the server can respond with. Limits apply to each Protobuf
// message, not to the stream as a whole.
//
// Setting WithReadMaxBytes to zero allows any message size. Both clients and
// handlers default to allowing any request size.
//
// Handlers may also use [http.MaxBytesHandler] to limit the total size of the
// HTTP request stream (rather than the per-message size). Connect handles
// [http.MaxBytesError] specially, so clients still receive errors with the
// appropriate error code and informative messages.
func WithReadMaxBytes(maxBytes int) Option {
	return &readMaxBytesOption{Max: maxBytes}
}

// WithSendMaxBytes prevents sending messages too large for the client/handler
// to handle without significant performance overhead. For handlers, WithSendMaxBytes
// limits the size of a message that the handler can respond with. For clients,
// WithSendMaxBytes limits the size of a message that the client can send. Limits
// apply to each message, not to the stream as a whole.
//
// Setting WithSendMaxBytes to zero allows any message size. Both clients and
// handlers default to allowing any message size.
func WithSendMaxBytes(maxBytes int) Option {
	return &sendMaxBytesOption{Max: maxBytes}
}

// WithIdempotency declares the idempotency of the procedure. This can determine
// whether a procedure call can safely be retried, and may affect which request
// modalities are allowed for a given procedure call.
//
// In most cases, you should not need to manually set this. It is normally set
// by the code generator for your schema. For protobuf schemas, it can be set like this:
//
//	rpc Ping(PingRequest) returns (PingResponse) {
//	  option idempotency_level = NO_SIDE_EFFECTS;
//	}
func WithIdempotency(idempotencyLevel IdempotencyLevel) Option {
	return &idempotencyOption{idempotencyLevel: idempotencyLevel}
}

// WithHTTPGet allows Connect-protocol clients to use HTTP GET requests for
// side-effect free unary RPC calls. Typically, the service schema indicates
// which procedures are idempotent (see [WithIdempotency] for an example
// protobuf schema). The gRPC and gRPC-Web protocols are POST-only, so this
// option has no effect when combined with [WithGRPC] or [WithGRPCWeb].
//
// Using HTTP GET requests makes it easier to take advantage of CDNs, caching
// reverse proxies, and browsers' built-in caching. Note, however, that servers
// don't automatically set any cache headers; you can set cache headers using
// interceptors or by adding headers in individual procedure implementations.
//
// By default, all requests are made as HTTP POSTs.
func WithHTTPGet() ClientOption {
	return &enableGet{}
}

// WithInterceptors configures a client or handler's interceptor stack. Repeated
// WithInterceptors options are applied in order, so
//
//	WithInterceptors(A) + WithInterceptors(B, C) == WithInterceptors(A, B, C)
//
// Unary interceptors compose like an onion. The first interceptor provided is
// the outermost layer of the onion: it acts first on the context and request,
// and last on the response and error.
//
// Stream interceptors also behave like an onion: the first interceptor
// provided is the outermost wrapper for the [StreamingClientConn] or
// [StreamingHandlerConn]. It's the first to see sent messages and the last to
// see received messages.
//
// Applied to client and handler, WithInterceptors(A, B, ..., Y, Z) produces:
//
//	 client.Send()       client.Receive()
//	       |                   ^
//	       v                   |
//	    A ---                 --- A
//	    B ---                 --- B
//	    : ...                 ... :
//	    Y ---                 --- Y
//	    Z ---                 --- Z
//	       |                   ^
//	       v                   |
//	  = = = = = = = = = = = = = = = =
//	               network
//	  = = = = = = = = = = = = = = = =
//	       |                   ^
//	       v                   |
//	    A ---                 --- A
//	    B ---                 --- B
//	    : ...                 ... :
//	    Y ---                 --- Y
//	    Z ---                 --- Z
//	       |                   ^
//	       v                   |
//	handler.Receive()   handler.Send()
//	       |                   ^
//	       |                   |
//	       '-> handler logic >-'
//
// Note that in clients, Send handles the request message(s) and Receive
// handles the response message(s). For handlers, it's the reverse. Depending
// on your interceptor's logic, you may need to wrap one method in clients and
// the other in handlers.
func WithInterceptors(interceptors ...Interceptor) Option {
	return &interceptorsOption{interceptors}
}

// WithOptions composes multiple Options into one.
func WithOptions(options ...Option) Option {
	return &optionsOption{options}
}

type schemaOption struct {
	Schema any
}

func (o *schemaOption) applyToClient(config *clientConfig) {
	config.Schema = o.Schema
}

func (o *schemaOption) applyToHandler(config *handlerConfig) {
	config.Schema = o.Schema
}

type initializerOption struct {
	Initializer func(spec Spec, message any) error
}

func (o *initializerOption) applyToHandler(config *handlerConfig) {
	config.Initializer = maybeInitializer{initializer: o.Initializer}
}

func (o *initializerOption) applyToClient(config *clientConfig) {
	config.Initializer = maybeInitializer{initializer: o.Initializer}
}

type maybeInitializer struct {
	initializer func(spec Spec, message any) error
}

func (o maybeInitializer) maybe(spec Spec, message any) error {
	if o.initializer != nil {
		return o.initializer(spec, message)
	}
	return nil
}

type clientOptionsOption struct {
	options []ClientOption
}

func (o *clientOptionsOption) applyToClient(config *clientConfig) {
	for _, option := range o.options {
		option.applyToClient(config)
	}
}

type codecOption struct {
	Codec Codec
}

func (o *codecOption) applyToClient(config *clientConfig) {
	if o.Codec == nil || o.Codec.Name() == "" {
		return
	}
	config.Codec = o.Codec
}

func (o *codecOption) applyToHandler(config *handlerConfig) {
	if o.Codec == nil || o.Codec.Name() == "" {
		return
	}
	config.Codecs[o.Codec.Name()] = o.Codec
}

type compressionOption struct {
	Name            string
	CompressionPool *compressionPool
}

func (o *compressionOption) applyToClient(config *clientConfig) {
	o.apply(&config.CompressionNames, config.CompressionPools)
}

func (o *compressionOption) applyToHandler(config *handlerConfig) {
	o.apply(&config.CompressionNames, config.CompressionPools)
}

func (o *compressionOption) apply(configuredNames *[]string, configuredPools map[string]*compressionPool) {
	if o.Name == "" {
		return
	}
	if o.CompressionPool == nil {
		delete(configuredPools, o.Name)
		var names []string
		for _, name := range *configuredNames {
			if name == o.Name {
				continue
			}
			names = append(names, name)
		}
		*configuredNames = names
		return
	}
	configuredPools[o.Name] = o.CompressionPool
	*configuredNames = append(*configuredNames, o.Name)
}

type compressMinBytesOption struct {
	Min int
}

func (o *compressMinBytesOption) applyToClient(config *clientConfig) {
	config.CompressMinBytes = o.Min
}

func (o *compressMinBytesOption) applyToHandler(config *handlerConfig) {
	config.CompressMinBytes = o.Min
}

type readMaxBytesOption struct {
	Max int
}

func (o *readMaxBytesOption) applyToClient(config *clientConfig) {
	config.ReadMaxBytes = o.Max
}

func (o *readMaxBytesOption) applyToHandler(config *handlerConfig) {
	config.ReadMaxBytes = o.Max
}

type sendMaxBytesOption struct {
	Max int
}

func (o *sendMaxBytesOption) applyToClient(config *clientConfig) {
	config.SendMaxBytes = o.Max
}

func (o *sendMaxBytesOption) applyToHandler(config *handlerConfig) {
	config.SendMaxBytes = o.Max
}

type handlerOptionsOption struct {
	options []HandlerOption
}

func (o *handlerOptionsOption) applyToHandler(config *handlerConfig) {
	for _, option := range o.options {
		option.applyToHandler(config)
	}
}

type requireConnectProtocolHeaderOption struct{}

func (o *requireConnectProtocolHeaderOption) applyToHandler(config *handlerConfig) {
	config.RequireConnectProtocolHeader = true
}

type idempotencyOption struct {
	idempotencyLevel IdempotencyLevel
}

func (o *idempotencyOption) applyToClient(config *clientConfig) {
	config.IdempotencyLevel = o.idempotencyLevel
}

func (o *idempotencyOption) applyToHandler(config *handlerConfig) {
	config.IdempotencyLevel = o.idempotencyLevel
}

type grpcOption struct {
	web bool
}

func (o *grpcOption) applyToClient(config *clientConfig) {
	config.Protocol = &protocolGRPC{web: o.web}
}

type enableGet struct{}

func (o *enableGet) applyToClient(config *clientConfig) {
	config.EnableGet = true
}

// WithHTTPGetMaxURLSize sets the maximum allowable URL length for GET requests
// made using the Connect protocol. It has no effect on gRPC or gRPC-Web
// clients, since those protocols are POST-only.
//
// Limiting the URL size is useful as most user agents, proxies, and servers
// have limits on the allowable length of a URL. For example, Apache and Nginx
// limit the size of a request line to around 8 KiB, meaning that maximum
// length of a URL is a bit smaller than this. If you run into URL size
// limitations imposed by your network infrastructure and don't know the
// maximum allowable size, or if you'd prefer to be cautious from the start, a
// 4096 byte (4 KiB) limit works with most common proxies and CDNs.
//
// If fallback is set to true and the URL would be longer than the configured
// maximum value, the request will be sent as an HTTP POST instead. If fallback
// is set to false, the request will fail with [CodeResourceExhausted].
//
// By default, Connect-protocol clients with GET requests enabled may send a
// URL of any size.
func WithHTTPGetMaxURLSize(bytes int, fallback bool) ClientOption {
	return &getURLMaxBytes{Max: bytes, Fallback: fallback}
}

type getURLMaxBytes struct {
	Max      int
	Fallback bool
}

func (o *getURLMaxBytes) applyToClient(config *clientConfig) {
	config.GetURLMaxBytes = o.Max
	config.GetUseFallback = o.Fallback
}

type interceptorsOption struct {
	Interceptors []Interceptor
}

func (o *interceptorsOption) applyToClient(config *clientConfig) {
	config.Interceptor = o.chainWith(config.Interceptor)
}

func (o *interceptorsOption) applyToHandler(config *handlerConfig) {
	config.Interceptor = o.chainWith(config.Interceptor)
}

func (o *interceptorsOption) chainWith(current Interceptor) Interceptor {
	if len(o.Interceptors) == 0 {
		return current
	}
	if current == nil && len(o.Interceptors) == 1 {
		return o.Interceptors[0]
	}
	if current == nil && len(o.Interceptors) > 1 {
		return newChain(o.Interceptors)
	}
	return newChain(append([]Interceptor{current}, o.Interceptors...))
}

type optionsOption struct {
	options []Option
}

func (o *optionsOption) applyToClient(config *clientConfig) {
	for _, option := range o.options {
		option.applyToClient(config)
	}
}

func (o *optionsOption) applyToHandler(config *handlerConfig) {
	for _, option := range o.options {
		option.applyToHandler(config)
	}
}

type sendCompressionOption struct {
	Name string
}

func (o *sendCompressionOption) applyToClient(config *clientConfig) {
	config.RequestCompressionName = o.Name
}

func withGzip() Option {
	return &compressionOption{
		Name: compressionGzip,
		CompressionPool: newCompressionPool(
			func() Decompressor { return &gzip.Reader{} },
			func() Compressor { return gzip.NewWriter(io.Discard) },
		),
	}
}

func withProtoBinaryCodec() Option {
	return WithCodec(&protoBinaryCodec{})
}

func withProtoJSONCodecs() HandlerOption {
	return WithHandlerOptions(
		WithCodec(&protoJSONCodec{codecNameJSON}),
		WithCodec(&protoJSONCodec{codecNameJSONCharsetUTF8}),
	)
}

type conditionalHandlerOptions struct {
	conditional func(spec Spec) []HandlerOption
}

func (o *conditionalHandlerOptions) applyToHandler(config *handlerConfig) {
	spec := config.newSpec()
	if spec.Procedure == "" {
		return // ignore empty specs
	}
	for _, option := range o.conditional(spec) {
		option.applyToHandler(config)
	}
}
