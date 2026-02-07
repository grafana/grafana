package multierror

import (
	"strings"
)

// Join is a drop-in replacement for errors.Join with better formatting.
func Join(errs ...error) error {
	n := 0
	for _, err := range errs {
		if err != nil {
			n++
		}
	}
	if n == 0 {
		return nil
	}
	e := &joinError{
		errs: make([]error, 0, n),
	}
	for _, err := range errs {
		if err != nil {
			e.errs = append(e.errs, err)
		}
	}
	return e
}

type joinError struct {
	errs []error
}

func (e *joinError) Error() string {
	if len(e.errs) == 1 {
		return strings.TrimSpace(e.errs[0].Error())
	}
	stringErrs := make([]string, 0, len(e.errs))
	for _, subErr := range e.errs {
		stringErrs = append(stringErrs, strings.Replace(subErr.Error(), "\n", "\n\t", -1))
	}
	return "* " + strings.Join(stringErrs, "\n* ")
}

func (e *joinError) Unwrap() []error {
	return e.errs
}
