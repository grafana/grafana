package openapi3

import (
	"bytes"
	"errors"
)

// MultiError is a collection of errors, intended for when
// multiple issues need to be reported upstream
type MultiError []error

func (me MultiError) Error() string {
	return spliceErr(" | ", me)
}

func spliceErr(sep string, errs []error) string {
	buff := &bytes.Buffer{}
	for i, e := range errs {
		buff.WriteString(e.Error())
		if i != len(errs)-1 {
			buff.WriteString(sep)
		}
	}
	return buff.String()
}

// Is allows you to determine if a generic error is in fact a MultiError using `errors.Is()`
// It will also return true if any of the contained errors match target
func (me MultiError) Is(target error) bool {
	if _, ok := target.(MultiError); ok {
		return true
	}
	for _, e := range me {
		if errors.Is(e, target) {
			return true
		}
	}
	return false
}

// As allows you to use `errors.As()` to set target to the first error within the multi error that matches the target type
func (me MultiError) As(target any) bool {
	for _, e := range me {
		if errors.As(e, target) {
			return true
		}
	}
	return false
}

type multiErrorForOneOf MultiError

func (meo multiErrorForOneOf) Error() string {
	return spliceErr(" Or ", meo)
}

func (meo multiErrorForOneOf) Unwrap() error {
	return MultiError(meo)
}

type multiErrorForAllOf MultiError

func (mea multiErrorForAllOf) Error() string {
	return spliceErr(" And ", mea)
}

func (mea multiErrorForAllOf) Unwrap() error {
	return MultiError(mea)
}
