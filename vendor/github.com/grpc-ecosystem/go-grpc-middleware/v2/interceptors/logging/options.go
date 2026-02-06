// Copyright (c) The go-grpc-middleware Authors.
// Licensed under the Apache License 2.0.

package logging

import (
	"context"
	"fmt"
	"time"

	"github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// LoggableEvent defines the events a log line can be added on.
type LoggableEvent uint

const (
	// StartCall is a loggable event representing start of the gRPC call.
	StartCall LoggableEvent = iota
	// FinishCall is a loggable event representing finish of the gRPC call.
	FinishCall
	// PayloadReceived is a loggable event representing received request (server) or response (client).
	// Log line for this event also includes (potentially big) proto.Message of that payload in
	// "grpc.request.content" (server) or "grpc.response.content" (client) field.
	// NOTE: This can get quite verbose, especially for streaming calls, use with caution (e.g. debug only purposes).
	PayloadReceived
	// PayloadSent is a loggable event representing sent response (server) or request (client).
	// Log line for this event also includes (potentially big) proto.Message of that payload in
	// "grpc.response.content" (server) or "grpc.request.content" (client) field.
	// NOTE: This can get quite verbose, especially for streaming calls, use with caution (e.g. debug only purposes).
	PayloadSent
)

func has(events []LoggableEvent, event LoggableEvent) bool {
	for _, e := range events {
		if e == event {
			return true
		}
	}
	return false
}

var defaultOptions = &options{
	loggableEvents:    []LoggableEvent{StartCall, FinishCall},
	codeFunc:          DefaultErrorToCode,
	durationFieldFunc: DefaultDurationToFields,
	// levelFunc depends if it's client or server.
	levelFunc:            nil,
	timestampFormat:      time.RFC3339,
	disableGrpcLogFields: nil,
}

type options struct {
	levelFunc               CodeToLevel
	loggableEvents          []LoggableEvent
	errorToFieldsFunc       ErrorToFields
	codeFunc                ErrorToCode
	durationFieldFunc       DurationToFields
	timestampFormat         string
	fieldsFromCtxCallMetaFn fieldsFromCtxCallMetaFn
	disableGrpcLogFields    []string
}

type Option func(*options)

func evaluateServerOpt(opts []Option) *options {
	optCopy := &options{}
	*optCopy = *defaultOptions
	optCopy.levelFunc = DefaultServerCodeToLevel
	for _, o := range opts {
		o(optCopy)
	}
	return optCopy
}

func evaluateClientOpt(opts []Option) *options {
	optCopy := &options{}
	*optCopy = *defaultOptions
	optCopy.levelFunc = DefaultClientCodeToLevel
	for _, o := range opts {
		o(optCopy)
	}
	return optCopy
}

// DurationToFields function defines how to produce duration fields for logging.
type DurationToFields func(duration time.Duration) Fields

// ErrorToFields function extract fields from error.
type ErrorToFields func(err error) Fields

// ErrorToCode function determines the error code of an error.
// This makes using custom errors with grpc middleware easier.
type ErrorToCode func(err error) codes.Code

func DefaultErrorToCode(err error) codes.Code {
	return status.Code(err)
}

// CodeToLevel function defines the mapping between gRPC return codes and interceptor log level.
type CodeToLevel func(code codes.Code) Level

// DefaultServerCodeToLevel is the helper mapper that maps gRPC return codes to log levels for server side.
func DefaultServerCodeToLevel(code codes.Code) Level {
	switch code {
	case codes.OK, codes.NotFound, codes.Canceled, codes.AlreadyExists, codes.InvalidArgument, codes.Unauthenticated:
		return LevelInfo

	case codes.DeadlineExceeded, codes.PermissionDenied, codes.ResourceExhausted, codes.FailedPrecondition, codes.Aborted,
		codes.OutOfRange, codes.Unavailable:
		return LevelWarn

	case codes.Unknown, codes.Unimplemented, codes.Internal, codes.DataLoss:
		return LevelError

	default:
		return LevelError
	}
}

// DefaultClientCodeToLevel is the helper mapper that maps gRPC return codes to log levels for client side.
func DefaultClientCodeToLevel(code codes.Code) Level {
	switch code {
	case codes.OK, codes.Canceled, codes.InvalidArgument, codes.NotFound, codes.AlreadyExists, codes.ResourceExhausted,
		codes.FailedPrecondition, codes.Aborted, codes.OutOfRange:
		return LevelDebug
	case codes.Unknown, codes.DeadlineExceeded, codes.PermissionDenied, codes.Unauthenticated:
		return LevelInfo
	case codes.Unimplemented, codes.Internal, codes.Unavailable, codes.DataLoss:
		return LevelWarn
	default:
		return LevelInfo
	}
}

type (
	fieldsFromCtxFn         func(ctx context.Context) Fields
	fieldsFromCtxCallMetaFn func(ctx context.Context, c interceptors.CallMeta) Fields
)

// WithFieldsFromContext allows overriding existing or adding extra fields to all log messages per given context.
// If called multiple times, it overwrites the existing FieldsFromContext/WithFieldsFromContextAndCallMeta function.
// If you need to use multiple FieldsFromContext functions then you should combine them in a wrapper fieldsFromCtxFn.
// Only one of WithFieldsFromContextAndCallMeta or WithFieldsFromContext should
// be used, using both will result in the last one overwriting the previous.
func WithFieldsFromContext(f fieldsFromCtxFn) Option {
	return func(o *options) {
		o.fieldsFromCtxCallMetaFn = func(ctx context.Context, _ interceptors.CallMeta) Fields {
			return f(ctx)
		}
	}
}

// WithFieldsFromContextAndCallMeta allows overriding existing or adding extra fields to all log messages per given context and interceptor.CallMeta
// If called multiple times, it overwrites the existing FieldsFromContext/WithFieldsFromContextAndCallMeta function.
// If you need to use multiple WithFieldsFromContextAndCallMeta functions then you should combine them in a wrapper fieldsFromCtxCallMetaFn.
// Only one of WithFieldsFromContextAndCallMeta or WithFieldsFromContext should
// be used, using both will result in the last one overwriting the previous.
func WithFieldsFromContextAndCallMeta(f fieldsFromCtxCallMetaFn) Option {
	return func(o *options) {
		o.fieldsFromCtxCallMetaFn = f
	}
}

// WithLogOnEvents customizes on what events the gRPC interceptor should log on.
func WithLogOnEvents(events ...LoggableEvent) Option {
	return func(o *options) {
		o.loggableEvents = events
	}
}

// WithErrorFields allows to extract logging fields from an error.
func WithErrorFields(f ErrorToFields) Option {
	return func(o *options) {
		o.errorToFieldsFunc = f
	}
}

// WithLevels customizes the function for mapping gRPC return codes and interceptor log level statements.
func WithLevels(f CodeToLevel) Option {
	return func(o *options) {
		o.levelFunc = f
	}
}

// WithCodes customizes the function for mapping errors to error codes.
func WithCodes(f ErrorToCode) Option {
	return func(o *options) {
		o.codeFunc = f
	}
}

// WithDurationField customizes the function for mapping request durations to log fields.
func WithDurationField(f DurationToFields) Option {
	return func(o *options) {
		o.durationFieldFunc = f
	}
}

// DefaultDurationToFields is the default implementation of converting request duration to a field.
var DefaultDurationToFields = DurationToTimeMillisFields

// DurationToTimeMillisFields converts the duration to milliseconds and uses the key `grpc.time_ms`.
func DurationToTimeMillisFields(duration time.Duration) Fields {
	return Fields{"grpc.time_ms", fmt.Sprintf("%v", durationToMilliseconds(duration))}
}

// DurationToDurationField uses a Duration field to log the request duration
// and leaves it up to Log's encoder settings to determine how that is output.
func DurationToDurationField(duration time.Duration) Fields {
	return Fields{"grpc.duration", duration.String()}
}

func durationToMilliseconds(duration time.Duration) float32 {
	return float32(duration.Nanoseconds()/1000) / 1000
}

// WithTimestampFormat customizes the timestamps emitted in the log fields.
func WithTimestampFormat(format string) Option {
	return func(o *options) {
		o.timestampFormat = format
	}
}

// WithDisableLoggingFields disables logging of gRPC fields provided.
// The following are the default logging fields:
//   - SystemTag[0]
//   - ComponentFieldKey
//   - ServiceFieldKey
//   - MethodFieldKey
//   - MethodTypeFieldKey
//
// Usage example - WithDisableLoggingFields(logging.MethodFieldKey, logging.MethodTypeFieldKey)
func WithDisableLoggingFields(disableGrpcLogFields ...string) Option {
	return func(o *options) {
		o.disableGrpcLogFields = disableGrpcLogFields
	}
}
