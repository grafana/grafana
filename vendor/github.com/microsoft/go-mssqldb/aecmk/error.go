package aecmk

import "fmt"

// Operation specifies the action that returned an error
type Operation int

const (
	Decryption Operation = iota
	Encryption
	Validation
)

// Error is the type of all errors returned by key encryption providers
type Error struct {
	Operation Operation
	err       error
	msg       string
}

func (e *Error) Error() string {
	return e.msg
}

func (e *Error) Unwrap() error {
	return e.err
}

func NewError(operation Operation, msg string, err error) error {
	return &Error{
		Operation: operation,
		msg:       msg,
		err:       err,
	}
}

func KeyPathNotAllowed(path string, operation Operation) error {
	return NewError(operation, fmt.Sprintf("Key path not allowed:  %s", path), nil)
}
