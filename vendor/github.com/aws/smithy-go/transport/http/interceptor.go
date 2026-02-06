package http

import (
	"context"
)

func icopy[T any](v []T) []T {
	s := make([]T, len(v))
	copy(s, v)
	return s
}

// InterceptorContext is all the information available in different
// interceptors.
//
// Not all information is available in each interceptor, see each interface
// definition for more details.
type InterceptorContext struct {
	Input   any
	Request *Request

	Output   any
	Response *Response
}

// InterceptorRegistry holds a list of operation interceptors.
//
// Interceptors allow callers to insert custom behavior at well-defined points
// within a client's operation lifecycle.
//
// # Interceptor context
//
// All interceptors are invoked with a context object that contains input and
// output containers for the operation. The individual fields that are
// available will depend on what the interceptor is and, in certain
// interceptors, how far the operation was able to progress. See the
// documentation for each interface definition for more information about field
// availability.
//
// Implementations MUST NOT directly mutate the values of the fields in the
// interceptor context. They are free to mutate the existing values _pointed
// to_ by those fields, however.
//
// # Returning errors
//
// All interceptors can return errors. If an interceptor returns an error
// _before_ the client's retry loop, the operation will fail immediately. If
// one returns an error _within_ the retry loop, the error WILL be considered
// according to the client's retry policy.
//
// # Adding interceptors
//
// Idiomatically you will simply use one of the Add() receiver methods to
// register interceptors as desired. However, the list for each interface is
// exported on the registry struct and the caller is free to manipulate it
// directly, for example, to register a number of interceptors all at once, or
// to remove one that was previously registered.
//
// The base SDK client WILL NOT add any interceptors. SDK operations and
// customizations are implemented in terms of middleware.
//
// Modifications to the registry will not persist across operation calls when
// using per-operation functional options. This means you can register
// interceptors on a per-operation basis without affecting other operations.
type InterceptorRegistry struct {
	BeforeExecution       []BeforeExecutionInterceptor
	BeforeSerialization   []BeforeSerializationInterceptor
	AfterSerialization    []AfterSerializationInterceptor
	BeforeRetryLoop       []BeforeRetryLoopInterceptor
	BeforeAttempt         []BeforeAttemptInterceptor
	BeforeSigning         []BeforeSigningInterceptor
	AfterSigning          []AfterSigningInterceptor
	BeforeTransmit        []BeforeTransmitInterceptor
	AfterTransmit         []AfterTransmitInterceptor
	BeforeDeserialization []BeforeDeserializationInterceptor
	AfterDeserialization  []AfterDeserializationInterceptor
	AfterAttempt          []AfterAttemptInterceptor
	AfterExecution        []AfterExecutionInterceptor
}

// Copy returns a deep copy of the registry. This is used by SDK clients on
// each operation call in order to prevent per-op config mutation from
// persisting.
func (i *InterceptorRegistry) Copy() InterceptorRegistry {
	return InterceptorRegistry{
		BeforeExecution:       icopy(i.BeforeExecution),
		BeforeSerialization:   icopy(i.BeforeSerialization),
		AfterSerialization:    icopy(i.AfterSerialization),
		BeforeRetryLoop:       icopy(i.BeforeRetryLoop),
		BeforeAttempt:         icopy(i.BeforeAttempt),
		BeforeSigning:         icopy(i.BeforeSigning),
		AfterSigning:          icopy(i.AfterSigning),
		BeforeTransmit:        icopy(i.BeforeTransmit),
		AfterTransmit:         icopy(i.AfterTransmit),
		BeforeDeserialization: icopy(i.BeforeDeserialization),
		AfterDeserialization:  icopy(i.AfterDeserialization),
		AfterAttempt:          icopy(i.AfterAttempt),
		AfterExecution:        icopy(i.AfterExecution),
	}
}

// AddBeforeExecution registers the provided BeforeExecutionInterceptor.
func (i *InterceptorRegistry) AddBeforeExecution(v BeforeExecutionInterceptor) {
	i.BeforeExecution = append(i.BeforeExecution, v)
}

// AddBeforeSerialization registers the provided BeforeSerializationInterceptor.
func (i *InterceptorRegistry) AddBeforeSerialization(v BeforeSerializationInterceptor) {
	i.BeforeSerialization = append(i.BeforeSerialization, v)
}

// AddAfterSerialization registers the provided AfterSerializationInterceptor.
func (i *InterceptorRegistry) AddAfterSerialization(v AfterSerializationInterceptor) {
	i.AfterSerialization = append(i.AfterSerialization, v)
}

// AddBeforeRetryLoop registers the provided BeforeRetryLoopInterceptor.
func (i *InterceptorRegistry) AddBeforeRetryLoop(v BeforeRetryLoopInterceptor) {
	i.BeforeRetryLoop = append(i.BeforeRetryLoop, v)
}

// AddBeforeAttempt registers the provided BeforeAttemptInterceptor.
func (i *InterceptorRegistry) AddBeforeAttempt(v BeforeAttemptInterceptor) {
	i.BeforeAttempt = append(i.BeforeAttempt, v)
}

// AddBeforeSigning registers the provided BeforeSigningInterceptor.
func (i *InterceptorRegistry) AddBeforeSigning(v BeforeSigningInterceptor) {
	i.BeforeSigning = append(i.BeforeSigning, v)
}

// AddAfterSigning registers the provided AfterSigningInterceptor.
func (i *InterceptorRegistry) AddAfterSigning(v AfterSigningInterceptor) {
	i.AfterSigning = append(i.AfterSigning, v)
}

// AddBeforeTransmit registers the provided BeforeTransmitInterceptor.
func (i *InterceptorRegistry) AddBeforeTransmit(v BeforeTransmitInterceptor) {
	i.BeforeTransmit = append(i.BeforeTransmit, v)
}

// AddAfterTransmit registers the provided AfterTransmitInterceptor.
func (i *InterceptorRegistry) AddAfterTransmit(v AfterTransmitInterceptor) {
	i.AfterTransmit = append(i.AfterTransmit, v)
}

// AddBeforeDeserialization registers the provided BeforeDeserializationInterceptor.
func (i *InterceptorRegistry) AddBeforeDeserialization(v BeforeDeserializationInterceptor) {
	i.BeforeDeserialization = append(i.BeforeDeserialization, v)
}

// AddAfterDeserialization registers the provided AfterDeserializationInterceptor.
func (i *InterceptorRegistry) AddAfterDeserialization(v AfterDeserializationInterceptor) {
	i.AfterDeserialization = append(i.AfterDeserialization, v)
}

// AddAfterAttempt registers the provided AfterAttemptInterceptor.
func (i *InterceptorRegistry) AddAfterAttempt(v AfterAttemptInterceptor) {
	i.AfterAttempt = append(i.AfterAttempt, v)
}

// AddAfterExecution registers the provided AfterExecutionInterceptor.
func (i *InterceptorRegistry) AddAfterExecution(v AfterExecutionInterceptor) {
	i.AfterExecution = append(i.AfterExecution, v)
}

// BeforeExecutionInterceptor runs before anything else in the operation
// lifecycle.
//
// Available InterceptorContext fields:
//   - Input
type BeforeExecutionInterceptor interface {
	BeforeExecution(ctx context.Context, in *InterceptorContext) error
}

// BeforeSerializationInterceptor runs before the operation input is serialized
// into its transport request.
//
// Serialization occurs before the operation's retry loop.
//
// Available InterceptorContext fields:
//   - Input
type BeforeSerializationInterceptor interface {
	BeforeSerialization(ctx context.Context, in *InterceptorContext) error
}

// AfterSerializationInterceptor runs after the operation input is serialized
// into its transport request.
//
// Available InterceptorContext fields:
//   - Input
//   - Request
type AfterSerializationInterceptor interface {
	AfterSerialization(ctx context.Context, in *InterceptorContext) error
}

// BeforeRetryLoopInterceptor runs right before the operation enters the retry loop.
//
// Available InterceptorContext fields:
//   - Input
//   - Request
type BeforeRetryLoopInterceptor interface {
	BeforeRetryLoop(ctx context.Context, in *InterceptorContext) error
}

// BeforeAttemptInterceptor runs right before every attempt in the retry loop.
//
// If this interceptor returns an error, AfterAttempt interceptors WILL NOT be
// invoked.
//
// Available InterceptorContext fields:
//   - Input
//   - Request
type BeforeAttemptInterceptor interface {
	BeforeAttempt(ctx context.Context, in *InterceptorContext) error
}

// BeforeSigningInterceptor runs right before the request is signed.
//
// Signing occurs within the operation's retry loop.
//
// Available InterceptorContext fields:
//   - Input
//   - Request
type BeforeSigningInterceptor interface {
	BeforeSigning(ctx context.Context, in *InterceptorContext) error
}

// AfterSigningInterceptor runs right after the request is signed.
//
// It is unsafe to modify the outgoing HTTP request at or past this hook, since
// doing so may invalidate the signature of the request.
//
// Available InterceptorContext fields:
//   - Input
//   - Request
type AfterSigningInterceptor interface {
	AfterSigning(ctx context.Context, in *InterceptorContext) error
}

// BeforeTransmitInterceptor runs right before the HTTP request is sent.
//
// HTTP transmit occurs within the operation's retry loop.
//
// Available InterceptorContext fields:
//   - Input
//   - Request
type BeforeTransmitInterceptor interface {
	BeforeTransmit(ctx context.Context, in *InterceptorContext) error
}

// AfterTransmitInterceptor runs right after the HTTP response is received.
//
// It will always be invoked when a response is received, regardless of its
// status code. Conversely, it WILL NOT be invoked if the HTTP round-trip was
// not successful, e.g. because of a DNS resolution error
//
// Available InterceptorContext fields:
//   - Input
//   - Request
//   - Response
type AfterTransmitInterceptor interface {
	AfterTransmit(ctx context.Context, in *InterceptorContext) error
}

// BeforeDeserializationInterceptor runs right before the incoming HTTP response
// is deserialized.
//
// This interceptor IS NOT invoked if the HTTP round-trip was not successful.
//
// Deserialization occurs within the operation's retry loop.
//
// Available InterceptorContext fields:
//   - Input
//   - Request
//   - Response
type BeforeDeserializationInterceptor interface {
	BeforeDeserialization(ctx context.Context, in *InterceptorContext) error
}

// AfterDeserializationInterceptor runs right after the incoming HTTP response
// is deserialized. This hook is invoked regardless of whether the deserialized
// result was an error.
//
// This interceptor IS NOT invoked if the HTTP round-trip was not successful.
//
// Available InterceptorContext fields:
//   - Input
//   - Output (IF the operation had a success-level response)
//   - Request
//   - Response
type AfterDeserializationInterceptor interface {
	AfterDeserialization(ctx context.Context, in *InterceptorContext) error
}

// AfterAttemptInterceptor runs right after the incoming HTTP response
// is deserialized. This hook is invoked regardless of whether the deserialized
// result was an error, or if another interceptor within the retry loop
// returned an error.
//
// Available InterceptorContext fields:
//   - Input
//   - Output (IF the operation had a success-level response)
//   - Request (IF the operation did not return an error during serialization)
//   - Response (IF the operation was able to transmit the HTTP request)
type AfterAttemptInterceptor interface {
	AfterAttempt(ctx context.Context, in *InterceptorContext) error
}

// AfterExecutionInterceptor runs after everything else. It runs regardless of
// how far the operation progressed in its lifecycle, and regardless of whether
// the operation succeeded or failed.
//
// Available InterceptorContext fields:
//   - Input
//   - Output (IF the operation had a success-level response)
//   - Request (IF the operation did not return an error during serialization)
//   - Response (IF the operation was able to transmit the HTTP request)
type AfterExecutionInterceptor interface {
	AfterExecution(ctx context.Context, in *InterceptorContext) error
}
