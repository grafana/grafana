package operator

import (
	"errors"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana-app-sdk/resource"
)

// CannotCastError is an error that is returned by a Typed object if it cannot cast the resource.Object provided
// into the type the Typed object was created for.
type CannotCastError struct {
	Namespace string
	Name      string
	Group     string
	Kind      string
	error     error
}

// Error returns the error message
func (c *CannotCastError) Error() string {
	return c.error.Error()
}

// NewCannotCastError returns a new CannotCastError with data filled out from the provided resource.StaticMetadata
func NewCannotCastError(meta resource.StaticMetadata) *CannotCastError {
	return &CannotCastError{
		error:     fmt.Errorf("cannot cast %s:%s (%s/%s) into type", meta.Group, meta.Kind, meta.Namespace, meta.Name),
		Namespace: meta.Namespace,
		Name:      meta.Name,
		Group:     meta.Group,
		Kind:      meta.Kind,
	}
}

var _ error = NewCannotCastError(resource.StaticMetadata{})

type FinalizerError interface {
	error
	apierrors.APIStatus
	PatchRequest() resource.PatchRequest
}

// FinalizerOperationError describes an error that occurred attempting to manipulate an object's finalizer list on the API server.
type FinalizerOperationError struct {
	err     error
	request resource.PatchRequest
}

func (f *FinalizerOperationError) Error() string {
	return f.err.Error()
}

func (f *FinalizerOperationError) Unwrap() error {
	return f.err
}

func (f *FinalizerOperationError) Status() metav1.Status {
	var chk apierrors.APIStatus
	if errors.As(f.err, &chk) {
		return chk.Status()
	}
	return metav1.Status{
		Message: f.err.Error(),
	}
}

func (f *FinalizerOperationError) PatchRequest() resource.PatchRequest {
	return f.request
}

func NewFinalizerOperationError(err error, request resource.PatchRequest) *FinalizerOperationError {
	return &FinalizerOperationError{
		err:     err,
		request: request,
	}
}

var _ apierrors.APIStatus = &FinalizerOperationError{}
