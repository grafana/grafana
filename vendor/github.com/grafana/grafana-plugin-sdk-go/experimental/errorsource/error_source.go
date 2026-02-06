package errorsource

import (
	"errors"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

type Error = backend.ErrorWithSource

// New creates a new error with the source
//
// Deprecated: use backend.NewErrorWithSource instead
func New(err error, source backend.ErrorSource, _ backend.Status) Error {
	// We are not using status here, but we are keeping it for compatibility
	return backend.NewErrorWithSource(err, source)
}

// PluginError will apply the source as plugin
//
// Deprecated: use backend.PluginError instead
func PluginError(err error, _ bool) error {
	if err != nil {
		return backend.PluginError(err)
	}
	return nil
}

// DownstreamError will apply the source as downstream
//
// Deprecated: use backend.DownstreamError instead
func DownstreamError(err error, _ bool) error {
	if err != nil {
		return backend.DownstreamError(err)
	}
	return nil
}

// SourceError returns an error with the source
// If source is already defined, it will return it, or you can override
//
// Deprecated: Use backend.DownstreamError or backend.PluginError instead
func SourceError(source backend.ErrorSource, err error, override bool) Error {
	var sourceError Error
	if errors.As(err, &sourceError) && !override {
		return sourceError // already has a source
	}
	return New(err, source, 0)
}

// Response returns an error DataResponse given status, source of the error and message.
//
// Deprecated: Use backend.ErrorResponseWithErrorSource instead
func Response(err error) backend.DataResponse {
	return backend.ErrorResponseWithErrorSource(err)
}

// FromStatus returns error source from status
//
// Deprecated: Use backend.ErrorSourceFromHTTPStatus instead
func FromStatus(status backend.Status) backend.ErrorSource {
	return backend.ErrorSourceFromHTTPStatus(int(status))
}

// AddPluginErrorToResponse adds the error as plugin error source to the response
// if the error already has a source, the existing source will be used
//
// Deprecated: Use backend.ErrorResponse instead
func AddPluginErrorToResponse(refID string, response *backend.QueryDataResponse, err error) *backend.QueryDataResponse {
	return AddErrorToResponse(refID, response, PluginError(err, false))
}

// AddDownstreamErrorToResponse adds the error as downstream source to the response
// if the error already has a source, the existing source will be used
//
// Deprecated: Use backend.ErrorResponse instead and set the response directly
func AddDownstreamErrorToResponse(refID string, response *backend.QueryDataResponse, err error) *backend.QueryDataResponse {
	return AddErrorToResponse(refID, response, DownstreamError(err, false))
}

// AddErrorToResponse adds the error to the response
//
// Deprecated: Use backend.ErrorResponse instead and set the response directly
func AddErrorToResponse(refID string, response *backend.QueryDataResponse, err error) *backend.QueryDataResponse {
	response.Responses[refID] = backend.ErrorResponseWithErrorSource(err)
	return response
}
