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
	"net/http"
	"net/url"
	"os"
	"strings"

	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/anypb"
)

const (
	commonErrorsURL          = "https://connectrpc.com/docs/go/common-errors"
	defaultAnyResolverPrefix = "type.googleapis.com/"
)

var (
	// errNotModified signals Connect-protocol responses to GET requests to use the
	// 304 Not Modified HTTP error code.
	errNotModified = errors.New("not modified")
	// errNotModifiedClient wraps ErrNotModified for use client-side.
	errNotModifiedClient = fmt.Errorf("HTTP 304: %w", errNotModified)
)

// An ErrorDetail is a self-describing Protobuf message attached to an [*Error].
// Error details are sent over the network to clients, which can then work with
// strongly-typed data rather than trying to parse a complex error message. For
// example, you might use details to send a localized error message or retry
// parameters to the client.
//
// The [google.golang.org/genproto/googleapis/rpc/errdetails] package contains a
// variety of Protobuf messages commonly used as error details.
type ErrorDetail struct {
	pbAny    *anypb.Any
	pbInner  proto.Message // if nil, must be extracted from pbAny
	wireJSON string        // preserve human-readable JSON
}

// NewErrorDetail constructs a new error detail. If msg is an *[anypb.Any] then
// it is used as is. Otherwise, it is first marshalled into an *[anypb.Any]
// value. This returns an error if msg cannot be marshalled.
func NewErrorDetail(msg proto.Message) (*ErrorDetail, error) {
	// If it's already an Any, don't wrap it inside another.
	if pb, ok := msg.(*anypb.Any); ok {
		return &ErrorDetail{pbAny: pb}, nil
	}
	pb, err := anypb.New(msg)
	if err != nil {
		return nil, err
	}
	return &ErrorDetail{pbAny: pb, pbInner: msg}, nil
}

// Type is the fully-qualified name of the detail's Protobuf message (for
// example, acme.foo.v1.FooDetail).
func (d *ErrorDetail) Type() string {
	// proto.Any tries to make messages self-describing by using type URLs rather
	// than plain type names, but there aren't any descriptor registries
	// deployed. With the current state of the `Any` code, it's not possible to
	// build a useful type registry either. To hide this from users, we should
	// trim the URL prefix is added to the type name.
	//
	// If we ever want to support remote registries, we can add an explicit
	// `TypeURL` method.
	return typeNameFromURL(d.pbAny.GetTypeUrl())
}

// Bytes returns a copy of the Protobuf-serialized detail.
func (d *ErrorDetail) Bytes() []byte {
	out := make([]byte, len(d.pbAny.GetValue()))
	copy(out, d.pbAny.GetValue())
	return out
}

// Value uses the Protobuf runtime's package-global registry to unmarshal the
// Detail into a strongly-typed message. Typically, clients use Go type
// assertions to cast from the proto.Message interface to concrete types.
func (d *ErrorDetail) Value() (proto.Message, error) {
	if d.pbInner != nil {
		// We clone it so that if the caller mutates the returned value,
		// they don't inadvertently corrupt this error detail value.
		return proto.Clone(d.pbInner), nil
	}
	return d.pbAny.UnmarshalNew()
}

// An Error captures four key pieces of information: a [Code], an underlying Go
// error, a map of metadata, and an optional collection of arbitrary Protobuf
// messages called "details" (more on those below). Servers send the code, the
// underlying error's Error() output, the metadata, and details over the wire
// to clients. Remember that the underlying error's message will be sent to
// clients - take care not to leak sensitive information from public APIs!
//
// Service implementations and interceptors should return errors that can be
// cast to an [*Error] (using the standard library's [errors.As]). If the returned
// error can't be cast to an [*Error], connect will use [CodeUnknown] and the
// returned error's message.
//
// Error details are an optional mechanism for servers, interceptors, and
// proxies to attach arbitrary Protobuf messages to the error code and message.
// They're a clearer and more performant alternative to HTTP header
// microformats. See [the documentation on errors] for more details.
//
// [the documentation on errors]: https://connectrpc.com/docs/go/errors
type Error struct {
	code    Code
	err     error
	details []*ErrorDetail
	meta    http.Header
	wireErr bool
}

// NewError annotates any Go error with a status code.
func NewError(c Code, underlying error) *Error {
	return &Error{code: c, err: underlying}
}

// NewWireError is similar to [NewError], but the resulting *Error returns true
// when tested with [IsWireError].
//
// This is useful for clients trying to propagate partial failures from
// streaming RPCs. Often, these RPCs include error information in their
// response messages (for example, [gRPC server reflection] and
// OpenTelemetry's [OTLP]). Clients propagating these errors up the stack
// should use NewWireError to clarify that the error code, message, and details
// (if any) were explicitly sent by the server rather than inferred from a
// lower-level networking error or timeout.
//
// [gRPC server reflection]: https://github.com/grpc/grpc/blob/v1.49.2/src/proto/grpc/reflection/v1alpha/reflection.proto#L132-L136
// [OTLP]: https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/protocol/otlp.md#partial-success
func NewWireError(c Code, underlying error) *Error {
	err := NewError(c, underlying)
	err.wireErr = true
	return err
}

// IsWireError checks whether the error was returned by the server, as opposed
// to being synthesized by the client.
//
// Clients may find this useful when deciding how to propagate errors. For
// example, an RPC-to-HTTP proxy might expose a server-sent CodeUnknown as an
// HTTP 500 but a client-synthesized CodeUnknown as a 503.
//
// Handlers will strip [Error.Meta] headers propagated from wire errors to avoid
// leaking response headers. To propagate headers recreate the error as a
// non-wire error.
func IsWireError(err error) bool {
	se := new(Error)
	if !errors.As(err, &se) {
		return false
	}
	return se.wireErr
}

// NewNotModifiedError indicates that the requested resource hasn't changed. It
// should be used only when handlers wish to respond to conditional HTTP GET
// requests with a 304 Not Modified. In all other circumstances, including all
// RPCs using the gRPC or gRPC-Web protocols, it's equivalent to sending an
// error with [CodeUnknown]. The supplied headers should include Etag,
// Cache-Control, or any other headers required by [RFC 9110 § 15.4.5].
//
// Clients should check for this error using [IsNotModifiedError].
//
// [RFC 9110 § 15.4.5]: https://httpwg.org/specs/rfc9110.html#status.304
func NewNotModifiedError(headers http.Header) *Error {
	err := NewError(CodeUnknown, errNotModified)
	if headers != nil {
		err.meta = headers
	}
	return err
}

func (e *Error) Error() string {
	message := e.Message()
	if message == "" {
		return e.code.String()
	}
	return e.code.String() + ": " + message
}

// Message returns the underlying error message. It may be empty if the
// original error was created with a status code and a nil error.
func (e *Error) Message() string {
	if e.err != nil {
		return e.err.Error()
	}
	return ""
}

// Unwrap allows [errors.Is] and [errors.As] access to the underlying error.
func (e *Error) Unwrap() error {
	return e.err
}

// Code returns the error's status code.
func (e *Error) Code() Code {
	return e.code
}

// Details returns the error's details.
func (e *Error) Details() []*ErrorDetail {
	return e.details
}

// AddDetail appends to the error's details.
func (e *Error) AddDetail(d *ErrorDetail) {
	e.details = append(e.details, d)
}

// Meta allows the error to carry additional information as key-value pairs.
//
// Metadata attached to errors returned by unary handlers is always sent as
// HTTP headers, regardless of the protocol. Metadata attached to errors
// returned by streaming handlers may be sent as HTTP headers, HTTP trailers,
// or a block of in-body metadata, depending on the protocol in use and whether
// or not the handler has already written messages to the stream.
//
// Protocol-specific headers and trailers may be removed to avoid breaking
// protocol semantics. For example, Content-Length and Content-Type headers
// won't be propagated. See the documentation for each protocol for more
// datails.
//
// When clients receive errors, the metadata contains the union of the HTTP
// headers and the protocol-specific trailers (either HTTP trailers or in-body
// metadata).
func (e *Error) Meta() http.Header {
	if e.meta == nil {
		e.meta = make(http.Header)
	}
	return e.meta
}

func (e *Error) detailsAsAny() []*anypb.Any {
	anys := make([]*anypb.Any, 0, len(e.details))
	for _, detail := range e.details {
		anys = append(anys, detail.pbAny)
	}
	return anys
}

// IsNotModifiedError checks whether the supplied error indicates that the
// requested resource hasn't changed. It only returns true if the server used
// [NewNotModifiedError] in response to a Connect-protocol RPC made with an
// HTTP GET.
func IsNotModifiedError(err error) bool {
	return errors.Is(err, errNotModified)
}

// errorf calls fmt.Errorf with the supplied template and arguments, then wraps
// the resulting error.
func errorf(c Code, template string, args ...any) *Error {
	return NewError(c, fmt.Errorf(template, args...))
}

// asError uses errors.As to unwrap any error and look for a connect *Error.
func asError(err error) (*Error, bool) {
	var connectErr *Error
	ok := errors.As(err, &connectErr)
	return connectErr, ok
}

// wrapIfUncoded ensures that all errors are wrapped. It leaves already-wrapped
// errors unchanged, uses wrapIfContextError to apply codes to context.Canceled
// and context.DeadlineExceeded, and falls back to wrapping other errors with
// CodeUnknown.
func wrapIfUncoded(err error) error {
	if err == nil {
		return nil
	}
	maybeCodedErr := wrapIfContextError(err)
	if _, ok := asError(maybeCodedErr); ok {
		return maybeCodedErr
	}
	return NewError(CodeUnknown, maybeCodedErr)
}

// wrapIfContextError applies CodeCanceled or CodeDeadlineExceeded to Go's
// context.Canceled and context.DeadlineExceeded errors, but only if they
// haven't already been wrapped.
func wrapIfContextError(err error) error {
	if err == nil {
		return nil
	}
	if _, ok := asError(err); ok {
		return err
	}
	if errors.Is(err, context.Canceled) {
		return NewError(CodeCanceled, err)
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return NewError(CodeDeadlineExceeded, err)
	}
	// Ick, some dial errors can be returned as os.ErrDeadlineExceeded
	// instead of context.DeadlineExceeded :(
	// https://github.com/golang/go/issues/64449
	if errors.Is(err, os.ErrDeadlineExceeded) {
		return NewError(CodeDeadlineExceeded, err)
	}
	return err
}

// wrapIfContextDone wraps errors with CodeCanceled or CodeDeadlineExceeded
// if the context is done. It leaves already-wrapped errors unchanged.
func wrapIfContextDone(ctx context.Context, err error) error {
	if err == nil {
		return nil
	}
	err = wrapIfContextError(err)
	if _, ok := asError(err); ok {
		return err
	}
	ctxErr := ctx.Err()
	if errors.Is(ctxErr, context.Canceled) {
		return NewError(CodeCanceled, err)
	} else if errors.Is(ctxErr, context.DeadlineExceeded) {
		return NewError(CodeDeadlineExceeded, err)
	}
	return err
}

// wrapIfLikelyH2CNotConfiguredError adds a wrapping error that has a message
// telling the caller that they likely need to use h2c but are using a raw http.Client{}.
//
// This happens when running a gRPC-only server.
// This is fragile and may break over time, and this should be considered a best-effort.
func wrapIfLikelyH2CNotConfiguredError(request *http.Request, err error) error {
	if err == nil {
		return nil
	}
	if _, ok := asError(err); ok {
		return err
	}
	if url := request.URL; url != nil && url.Scheme != "http" {
		// If the scheme is not http, we definitely do not have an h2c error, so just return.
		return err
	}
	// net/http code has been investigated and there is no typing of any of these errors
	// they are all created with fmt.Errorf
	// grpc-go returns the first error 2/3-3/4 of the time, and the second error 1/4-1/3 of the time
	if errString := err.Error(); strings.HasPrefix(errString, `Post "`) &&
		(strings.Contains(errString, `net/http: HTTP/1.x transport connection broken: malformed HTTP response`) ||
			strings.HasSuffix(errString, `write: broken pipe`)) {
		return fmt.Errorf("possible h2c configuration issue when talking to gRPC server, see %s: %w", commonErrorsURL, err)
	}
	return err
}

// wrapIfLikelyWithGRPCNotUsedError adds a wrapping error that has a message
// telling the caller that they likely forgot to use connect.WithGRPC().
//
// This happens when running a gRPC-only server.
// This is fragile and may break over time, and this should be considered a best-effort.
func wrapIfLikelyWithGRPCNotUsedError(err error) error {
	if err == nil {
		return nil
	}
	if _, ok := asError(err); ok {
		return err
	}
	// golang.org/x/net code has been investigated and there is no typing of this error
	// it is created with fmt.Errorf
	// http2/transport.go:573:	return nil, fmt.Errorf("http2: Transport: cannot retry err [%v] after Request.Body was written; define Request.GetBody to avoid this error", err)
	if errString := err.Error(); strings.HasPrefix(errString, `Post "`) &&
		strings.Contains(errString, `http2: Transport: cannot retry err`) &&
		strings.HasSuffix(errString, `after Request.Body was written; define Request.GetBody to avoid this error`) {
		return fmt.Errorf("possible missing connect.WithGPRC() client option when talking to gRPC server, see %s: %w", commonErrorsURL, err)
	}
	return err
}

// HTTP/2 has its own set of error codes, which it sends in RST_STREAM frames.
// When the server sends one of these errors, we should map it back into our
// RPC error codes following
// https://github.com/grpc/grpc/blob/master/doc/PROTOCOL-HTTP2.md#http2-transport-mapping.
//
// This would be vastly simpler if we were using x/net/http2 directly, since
// the StreamError type is exported. When x/net/http2 gets vendored into
// net/http, though, all these types become unexported...so we're left with
// string munging.
func wrapIfRSTError(err error) error {
	const (
		streamErrPrefix = "stream error: "
		fromPeerSuffix  = "; received from peer"
	)
	if err == nil {
		return nil
	}
	if _, ok := asError(err); ok {
		return err
	}
	if urlErr := new(url.Error); errors.As(err, &urlErr) {
		// If we get an RST_STREAM error from http.Client.Do, it's wrapped in a
		// *url.Error.
		err = urlErr.Unwrap()
	}
	msg := err.Error()
	if !strings.HasPrefix(msg, streamErrPrefix) {
		return err
	}
	if !strings.HasSuffix(msg, fromPeerSuffix) {
		return err
	}
	msg = strings.TrimSuffix(msg, fromPeerSuffix)
	i := strings.LastIndex(msg, ";")
	if i < 0 || i >= len(msg)-1 {
		return err
	}
	msg = msg[i+1:]
	msg = strings.TrimSpace(msg)
	switch msg {
	case "NO_ERROR", "PROTOCOL_ERROR", "INTERNAL_ERROR", "FLOW_CONTROL_ERROR",
		"SETTINGS_TIMEOUT", "FRAME_SIZE_ERROR", "COMPRESSION_ERROR", "CONNECT_ERROR":
		return NewError(CodeInternal, err)
	case "REFUSED_STREAM":
		return NewError(CodeUnavailable, err)
	case "CANCEL":
		return NewError(CodeCanceled, err)
	case "ENHANCE_YOUR_CALM":
		return NewError(CodeResourceExhausted, fmt.Errorf("bandwidth exhausted: %w", err))
	case "INADEQUATE_SECURITY":
		return NewError(CodePermissionDenied, fmt.Errorf("transport protocol insecure: %w", err))
	default:
		return err
	}
}

// wrapIfMaxBytesError wraps errors returned reading from a http.MaxBytesHandler
// whose limit has been exceeded.
func wrapIfMaxBytesError(err error, tmpl string, args ...any) error {
	if err == nil {
		return nil
	}
	if _, ok := asError(err); ok {
		return err
	}
	var maxBytesErr *http.MaxBytesError
	if ok := errors.As(err, &maxBytesErr); !ok {
		return err
	}
	prefix := fmt.Sprintf(tmpl, args...)
	return errorf(CodeResourceExhausted, "%s: exceeded %d byte http.MaxBytesReader limit", prefix, maxBytesErr.Limit)
}

func typeNameFromURL(url string) string {
	return url[strings.LastIndexByte(url, '/')+1:]
}
