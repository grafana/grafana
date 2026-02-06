package errors

import (
	"fmt"
	"io"
)

// Kind represents the kind of an error, from a Kind you can generate as many
// Error instances as you want of this Kind
type Kind struct {
	Message string
}

// NewKind returns a Kind with the given msg
func NewKind(msg string) *Kind {
	return &Kind{Message: msg}
}

// New returns a new Error, values can be passed to it if the Kind was created
// using printf format
func (k *Kind) New(values ...interface{}) *Error {
	return &Error{
		kind:    k,
		message: fmt.Sprintf(k.Message, values...),
		stack:   NewStackTrace(1),
	}
}

// Wrap creates a new Error of this Kind with the cause error, values can be
// passed to it if the Kind was created using printf format.
func (k *Kind) Wrap(cause error, values ...interface{}) *Error {
	return &Error{
		kind:    k,
		cause:   cause,
		message: fmt.Sprintf(k.Message, values...) + ": %s",
		stack:   NewStackTrace(1),
	}
}

// Is checks if the given error or any of its children are of this Kind
func (k *Kind) Is(err error) bool {
	if err == nil {
		return false
	}

	e, ok := err.(*Error)
	if !ok {
		return false
	}

	if k == e.kind {
		return true
	}

	if e.cause == nil {
		return false
	}

	return k.Is(e.cause)
}

// Error represents an error of some Kind, implements the error interface
type Error struct {
	kind    *Kind
	cause   error
	message string
	stack   StackTrace
}

// Cause returns the underlying cause of the error
func (err *Error) Cause() error {
	return err.cause
}

func (err *Error) Error() string {
	if err.cause == nil {
		return err.message
	}

	return fmt.Sprintf(err.message, err.cause.Error())
}

// StackTrace returns an stack trace of the error
func (err *Error) StackTrace() StackTrace {
	return err.stack
}

// Format implements fmt.Formatter and can be formatted by the fmt package. The
// following verbs are supported
//
//     %s    print the error. If the error has a Cause it will be
//           printed recursively
//     %v    see %s
//     %+v   extended format. Each Frame of the error's StackTrace will
//           be printed in detail.
func (err *Error) Format(s fmt.State, verb rune) {
	switch verb {
	case 'v':
		if s.Flag('+') {
			io.WriteString(s, err.Error()+"\n")
			err.stack.Format(s, verb)
			return
		}

		fallthrough
	case 's':
		io.WriteString(s, err.Error())
	case 'q':
		fmt.Fprintf(s, "%q", err.Error())
	}
}
