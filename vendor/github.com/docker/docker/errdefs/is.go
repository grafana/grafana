package errdefs

import (
	"context"
	"errors"
)

type causer interface {
	Cause() error
}

type wrapErr interface {
	Unwrap() error
}

func getImplementer(err error) error {
	switch e := err.(type) {
	case
		ErrNotFound,
		ErrInvalidParameter,
		ErrConflict,
		ErrUnauthorized,
		ErrUnavailable,
		ErrForbidden,
		ErrSystem,
		ErrNotModified,
		ErrNotImplemented,
		ErrCancelled,
		ErrDeadline,
		ErrDataLoss,
		ErrUnknown:
		return err
	case causer:
		return getImplementer(e.Cause())
	case wrapErr:
		return getImplementer(e.Unwrap())
	default:
		return err
	}
}

// IsNotFound returns if the passed in error is an [ErrNotFound],
func IsNotFound(err error) bool {
	_, ok := getImplementer(err).(ErrNotFound)
	return ok
}

// IsInvalidParameter returns if the passed in error is an [ErrInvalidParameter].
func IsInvalidParameter(err error) bool {
	_, ok := getImplementer(err).(ErrInvalidParameter)
	return ok
}

// IsConflict returns if the passed in error is an [ErrConflict].
func IsConflict(err error) bool {
	_, ok := getImplementer(err).(ErrConflict)
	return ok
}

// IsUnauthorized returns if the passed in error is an [ErrUnauthorized].
func IsUnauthorized(err error) bool {
	_, ok := getImplementer(err).(ErrUnauthorized)
	return ok
}

// IsUnavailable returns if the passed in error is an [ErrUnavailable].
func IsUnavailable(err error) bool {
	_, ok := getImplementer(err).(ErrUnavailable)
	return ok
}

// IsForbidden returns if the passed in error is an [ErrForbidden].
func IsForbidden(err error) bool {
	_, ok := getImplementer(err).(ErrForbidden)
	return ok
}

// IsSystem returns if the passed in error is an [ErrSystem].
func IsSystem(err error) bool {
	_, ok := getImplementer(err).(ErrSystem)
	return ok
}

// IsNotModified returns if the passed in error is an [ErrNotModified].
func IsNotModified(err error) bool {
	_, ok := getImplementer(err).(ErrNotModified)
	return ok
}

// IsNotImplemented returns if the passed in error is an [ErrNotImplemented].
func IsNotImplemented(err error) bool {
	_, ok := getImplementer(err).(ErrNotImplemented)
	return ok
}

// IsUnknown returns if the passed in error is an [ErrUnknown].
func IsUnknown(err error) bool {
	_, ok := getImplementer(err).(ErrUnknown)
	return ok
}

// IsCancelled returns if the passed in error is an [ErrCancelled].
func IsCancelled(err error) bool {
	_, ok := getImplementer(err).(ErrCancelled)
	return ok
}

// IsDeadline returns if the passed in error is an [ErrDeadline].
func IsDeadline(err error) bool {
	_, ok := getImplementer(err).(ErrDeadline)
	return ok
}

// IsDataLoss returns if the passed in error is an [ErrDataLoss].
func IsDataLoss(err error) bool {
	_, ok := getImplementer(err).(ErrDataLoss)
	return ok
}

// IsContext returns if the passed in error is due to context cancellation or deadline exceeded.
func IsContext(err error) bool {
	return errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded)
}
