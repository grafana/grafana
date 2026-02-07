package k8s

import (
	"encoding/json"
	"errors"
	"net/http"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// Kubernetes status object version & kind.
const (
	StatusAPIVersion = "v1"
	StatusKind       = "Status"
)

// Interface assertions.
// We need to make sure that ServerResponseError implements error and apierrors.APIStatus.
var (
	_ error               = (*ServerResponseError)(nil)
	_ apierrors.APIStatus = (*ServerResponseError)(nil)
)

// ServerResponseError represents an HTTP error from the kubernetes control plane.
// It contains the underlying error returned by the kubernetes go client,
// and the status code returned from the API.
// It implements the apierrors.APIStatus interface for compatibility with the client-go code.
type ServerResponseError struct {
	err        error
	statusCode int32
	statusMsg  string
}

// NewServerResponseError creates a new instance of ServerResponseError
func NewServerResponseError(err error, statusCode int32) *ServerResponseError {
	return &ServerResponseError{
		err:        err,
		statusCode: statusCode,
		statusMsg:  err.Error(),
	}
}

// Error returns the Error() of the underlying kubernetes client error
func (s *ServerResponseError) Error() string {
	return s.statusMsg
}

// Status returns the status of the ServerResponseError.
func (s *ServerResponseError) Status() metav1.Status {
	return metav1.Status{
		TypeMeta: metav1.TypeMeta{
			APIVersion: StatusAPIVersion,
			Kind:       StatusKind,
		},
		Status:  metav1.StatusFailure,
		Message: s.statusMsg,
		Reason:  metav1.StatusReasonUnknown,
		Code:    s.statusCode,
	}
}

// Unwrap returns the underlying kubernetes go client error
func (s *ServerResponseError) Unwrap() error {
	return s.err
}

// ParseKubernetesError parses the error response from the Kubernetes API server.
// It will try to parse the body or the error into a standard Kubernetes API error type,
// and will fall back to returning a ServerResponseError otherwise.
func ParseKubernetesError(responseBytes []byte, statusCode int, err error) error {
	if len(responseBytes) > 0 {
		var parsed metav1.Status
		// If we can parse the response body, use the error contained there instead, because it's clearer
		if e := json.Unmarshal(responseBytes, &parsed);
		// Make sure the response is a valid Kubernetes status object
		e == nil &&
			parsed.APIVersion == StatusAPIVersion &&
			parsed.Kind == StatusKind {
			return &apierrors.StatusError{
				ErrStatus: parsed,
			}
		}
	}

	if err != nil {
		var statusErr *apierrors.StatusError
		if errors.As(err, &statusErr) {
			return statusErr
		}
	}

	if statusCode == 0 {
		// Usually k8s returns 0 when the server timed out the request
		// before the proper error (including proper status code) could be returned.
		// In this case, we should return a generic 503 error (since the semantics are the same).
		return NewServerResponseError(err, http.StatusServiceUnavailable)
	}

	if statusCode >= 300 {
		return NewServerResponseError(err, int32(statusCode)) // nolint: gosec
	}

	return err
}

// StatusFromError returns the API status error if it is a Kubernetes API error,
// or falls back to a generic error with the status code 500.
func StatusFromError(err error) (apierrors.APIStatus, bool) {
	if err == nil {
		return nil, false
	}

	if status, ok := err.(apierrors.APIStatus); ok || errors.As(err, &status) {
		return status, true
	}

	return NewServerResponseError(err, http.StatusInternalServerError), false
}
