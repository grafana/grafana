package file

import (
	"fmt"
	"strings"

	"github.com/mithrandie/go-file/v2"
)

func ParseError(err error) error {
	switch err.(type) {
	case *file.IOError:
		return NewIOError(err.Error())
	case *file.LockError:
		return NewLockError(err.Error())
	case *file.TimeoutError:
		return &TimeoutError{
			message: err.Error(),
		}
	case *file.ContextCanceled:
		return NewContextCanceled()
	case *file.ContextDone:
		return NewContextDone(err.Error())
	default:
		return err
	}
}

type IOError struct {
	message string
}

func NewIOError(message string) error {
	return &IOError{
		message: message,
	}
}

func (e IOError) Error() string {
	return e.message
}

type NotExistError struct {
	message string
}

func NewNotExistError(message string) error {
	return &NotExistError{
		message: message,
	}
}

func (e NotExistError) Error() string {
	return e.message
}

type AlreadyExistError struct {
	message string
}

func NewAlreadyExistError(message string) error {
	return &AlreadyExistError{
		message: message,
	}
}

func (e AlreadyExistError) Error() string {
	return e.message
}

type LockError struct {
	message string
}

func NewLockError(message string) error {
	return &LockError{
		message: message,
	}
}

func (e LockError) Error() string {
	return e.message
}

type TimeoutError struct {
	message string
}

func NewTimeoutError(path string) error {
	return &TimeoutError{
		message: fmt.Sprintf("file %s: lock waiting time exceeded", path),
	}
}

func (e TimeoutError) Error() string {
	return e.message
}

type ContextCanceled struct {
	message string
}

func NewContextCanceled() error {
	return &ContextCanceled{
		message: "execution canceled",
	}
}

func (e ContextCanceled) Error() string {
	return e.message
}

type ContextDone struct {
	message string
}

func NewContextDone(message string) error {
	return &ContextDone{
		message: message,
	}
}

func (e ContextDone) Error() string {
	return e.message
}

type ForcedUnlockError struct {
	Errors []error
}

func NewForcedUnlockError(errs []error) error {
	if errs == nil {
		return nil
	}

	return &ForcedUnlockError{
		Errors: errs,
	}
}

func (e ForcedUnlockError) Error() string {
	list := make([]string, 0, len(e.Errors))
	for _, err := range e.Errors {
		list = append(list, err.Error())
	}
	return strings.Join(list, "\n  ")
}

type CompositeError struct {
	message string
}

func NewCompositeError(err1 error, err2 error) error {
	if err1 == nil {
		return err2
	}
	if err2 == nil {
		return err1
	}

	return &CompositeError{
		message: err1.Error() + "\n  " + err2.Error(),
	}
}

func (e CompositeError) Error() string {
	return e.message
}
