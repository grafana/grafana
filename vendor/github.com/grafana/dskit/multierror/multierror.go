// Provenance-includes-location: https://github.com/thanos-io/thanos/blob/2027fb30/pkg/errutil/multierror.go
// Provenance-includes-copyright: The Thanos Authors.

package multierror

import (
	"bytes"
	"fmt"
)

// MultiError implements the error interface, and contains the errors used to construct it.
type MultiError []error

// Add adds the error to the error list if it is not nil.
func (es *MultiError) Add(err error) {
	if err == nil {
		return
	}
	if merr, ok := err.(nonNilMultiError); ok {
		*es = append(*es, merr...)
	} else {
		*es = append(*es, err)
	}
}

// Err returns the error list as an error or nil if it is empty.
func (es MultiError) Err() error {
	if len(es) == 0 {
		return nil
	}
	return nonNilMultiError(es)
}

// New returns a new MultiError containing supplied errors.
func New(errs ...error) MultiError {
	merr := MultiError{}
	for _, err := range errs {
		merr.Add(err)
	}

	return merr
}

type nonNilMultiError MultiError

// Error returns a concatenated string of the contained errors.
func (es nonNilMultiError) Error() string {
	var buf bytes.Buffer

	if len(es) > 1 {
		fmt.Fprintf(&buf, "%d errors: ", len(es))
	}

	for i, err := range es {
		if i != 0 {
			buf.WriteString("; ")
		}
		buf.WriteString(err.Error())
	}

	return buf.String()
}

func (es nonNilMultiError) Unwrap() []error {
	return es
}
