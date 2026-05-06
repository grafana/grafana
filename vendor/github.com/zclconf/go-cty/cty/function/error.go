package function

import (
	"fmt"
	"runtime/debug"
)

// ArgError represents an error with one of the arguments in a call. The
// attribute Index represents the zero-based index of the argument in question.
//
// Its error *may* be a cty.PathError, in which case the error actually
// pertains to a nested value within the data structure passed as the argument.
type ArgError struct {
	error
	Index int
}

func NewArgErrorf(i int, f string, args ...interface{}) error {
	return ArgError{
		error: fmt.Errorf(f, args...),
		Index: i,
	}
}

func NewArgError(i int, err error) error {
	return ArgError{
		error: err,
		Index: i,
	}
}

// PanicError indicates that a panic occurred while executing either a
// function's type or implementation function. This is captured and wrapped
// into a normal error so that callers (expected to be language runtimes)
// are freed from having to deal with panics in buggy functions.
type PanicError struct {
	Value interface{}
	Stack []byte
}

func errorForPanic(val interface{}) error {
	return PanicError{
		Value: val,
		Stack: debug.Stack(),
	}
}

func (e PanicError) Error() string {
	return fmt.Sprintf("panic in function implementation: %s\n%s", e.Value, e.Stack)
}
