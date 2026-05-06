package operator

import (
	"fmt"

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
