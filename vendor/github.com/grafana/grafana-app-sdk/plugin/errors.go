package plugin

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

// Error represents a wrapped low-level error.
// An Error always has a Code in addition to the underlying error, which can be used for responding to HTTP requests.
// An Error can wrap another Error.
type Error struct {
	Code int
	Err  error
}

// FromError attempts to parse `err` into Error and falls back to `NewError` with 500 status code if it fails.
func FromError(err error) Error {
	var res Error
	if errors.As(err, &res) {
		return res
	}

	return WrapError(http.StatusInternalServerError, err)
}

// NewError returns a new error with code and message.
func NewError(code int, message string) Error {
	return Error{
		Code: code,
		Err:  errors.New(message),
	}
}

// WrapError returns a new error with code that wraps an existing error err.
func WrapError(code int, err error) Error {
	return Error{
		Code: code,
		Err:  err,
	}
}

// Error implement the Error interface.
func (e Error) Error() string {
	return e.Err.Error()
}

// CleanMessage returns the cleaned message for the error.
// For errors with code != 500 it will return the underlying error's message.
// Otherwise it will return a fixed "internal server error" message.
func (e Error) CleanMessage() string {
	if e.Code == http.StatusInternalServerError {
		return "internal server error"
	}

	return e.Err.Error()
}

// Unwrap implements the Unwrapper interface.
func (e Error) Unwrap() error {
	return e.Err
}

// InternalError wraps err in a response with InternalServerError response code.
func InternalError(err error) *backend.CallResourceResponse {
	return &backend.CallResourceResponse{
		Status: http.StatusInternalServerError,
		Body:   MarshalError(err),
	}
}

// NotFoundError wraps err in a response with NotFound response code.
func NotFoundError(err error) *backend.CallResourceResponse {
	return &backend.CallResourceResponse{
		Status: http.StatusNotFound,
		Body:   MarshalError(err),
	}
}

// BadRequestError wraps err in a response with BadRequest response code.
func BadRequestError(err error) *backend.CallResourceResponse {
	return &backend.CallResourceResponse{
		Status: http.StatusBadRequest,
		Body:   MarshalError(err),
	}
}

type jErr struct {
	Error string `json:"error"`
}

// MarshalError serializes a go error into a json envelope.
func MarshalError(err error) []byte {
	es := ""
	if err != nil {
		es = err.Error()
	}
	j, e := json.Marshal(jErr{Error: es})
	if e != nil {
		log.DefaultLogger.Error("Error marshaling error:", err.Error())
		return []byte(`{"error":"could not marshal error, please check log"}`)
	}
	return j
}
