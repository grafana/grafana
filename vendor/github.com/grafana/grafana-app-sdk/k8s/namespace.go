package k8s

import (
	"errors"

	"github.com/hashicorp/go-multierror"
	"k8s.io/apimachinery/pkg/api/validation"
)

// ValidateNamespace validates that `namespace` is a valid Kubernetes namespace name.
func ValidateNamespace(namespace string) error {
	merr := &multierror.Error{}

	if errs := validation.ValidateNamespaceName(namespace, false); len(errs) != 0 {
		for _, err := range errs {
			merr = multierror.Append(merr, errors.New(err))
		}
	}

	return merr.ErrorOrNil()
}
