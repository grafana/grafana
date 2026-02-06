package backend

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/experimental/status"
)

// ErrorSource type defines the source of the error
type ErrorSource = status.Source
type ErrorWithSource = status.ErrorWithSource

const (
	// ErrorSourcePlugin error originates from plugin.
	ErrorSourcePlugin = status.SourcePlugin

	// ErrorSourceDownstream error originates from downstream service.
	ErrorSourceDownstream = status.SourceDownstream

	// DefaultErrorSource is the default [ErrorSource] that should be used when it is not explicitly set.
	DefaultErrorSource = status.SourcePlugin
)

func NewErrorWithSource(err error, source ErrorSource) ErrorWithSource {
	return status.NewErrorWithSource(err, source)
}

// ErrorSourceFromHTTPStatus returns an [ErrorSource] based on provided HTTP status code.
func ErrorSourceFromHTTPStatus(statusCode int) ErrorSource {
	return status.SourceFromHTTPStatus(statusCode)
}

func IsPluginError(err error) bool {
	return status.IsPluginError(err)
}

// IsDownstreamError return true if provided error is an error with downstream source or
// a timeout error or a cancelled error.
func IsDownstreamError(err error) bool {
	return status.IsDownstreamError(err)
}

// IsDownstreamError return true if provided error is an error with downstream source or
// a HTTP timeout error or a cancelled error or a connection reset/refused error or dns not found error.
func IsDownstreamHTTPError(err error) bool {
	return status.IsDownstreamHTTPError(err)
}

// DownstreamError creates a new error with status [ErrorSourceDownstream].
func DownstreamError(err error) error {
	return status.DownstreamError(err)
}

// PluginError creates a new error with status [ErrorSourcePlugin].
func PluginError(err error) error {
	return status.PluginError(err)
}

// DownstreamErrorf creates a new error with status [ErrorSourceDownstream] and formats
// according to a format specifier and returns the string as a value that satisfies error.
func DownstreamErrorf(format string, a ...any) error {
	return DownstreamError(fmt.Errorf(format, a...))
}

// PluginErrorf creates a new error with status [ErrorSourcePlugin] and formats
// according to a format specifier and returns the string as a value that satisfies error.
func PluginErrorf(format string, a ...any) error {
	return PluginError(fmt.Errorf(format, a...))
}

// ErrorSourceFromContext returns the error source stored in the context.
// If no error source is stored in the context, [DefaultErrorSource] is returned.
func ErrorSourceFromContext(ctx context.Context) ErrorSource {
	return status.SourceFromContext(ctx)
}

// initErrorSource initialize the error source for the context.
func initErrorSource(ctx context.Context) context.Context {
	return status.InitSource(ctx)
}

// WithErrorSource mutates the provided context by setting the error source to
// s. If the provided context does not have a error source, the context
// will not be mutated and an error returned. This means that [initErrorSource]
// has to be called before this function.
func WithErrorSource(ctx context.Context, s ErrorSource) error {
	return status.WithSource(ctx, s)
}

// WithDownstreamErrorSource mutates the provided context by setting the error source to
// [ErrorSourceDownstream]. If the provided context does not have a error source, the context
// will not be mutated and an error returned. This means that [initErrorSource] has to be
// called before this function.
func WithDownstreamErrorSource(ctx context.Context) error {
	return status.WithDownstreamSource(ctx)
}

// Response returns an error DataResponse with error and source of the error if present.
// If the error does not have a source, it keeps the ErrorSource empty.
func ErrorResponseWithErrorSource(err error) DataResponse {
	var e ErrorWithSource
	if errors.As(err, &e) {
		return DataResponse{
			Error:       err,
			ErrorSource: e.ErrorSource(),
		}
	}
	return DataResponse{
		Error: err,
	}
}
