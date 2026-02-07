package retry

import (
	"errors"

	"github.com/aws/aws-sdk-go-v2/aws"
)

// IsErrorTimeout provides the interface of an implementation to determine if
// a error matches.
type IsErrorTimeout interface {
	IsErrorTimeout(err error) aws.Ternary
}

// IsErrorTimeouts is a collection of checks to determine of the error is
// retryable. Iterates through the checks and returns the state of retryable
// if any check returns something other than unknown.
type IsErrorTimeouts []IsErrorTimeout

// IsErrorTimeout returns if the error is retryable if any of the checks in
// the list return a value other than unknown.
func (ts IsErrorTimeouts) IsErrorTimeout(err error) aws.Ternary {
	for _, t := range ts {
		if v := t.IsErrorTimeout(err); v != aws.UnknownTernary {
			return v
		}
	}
	return aws.UnknownTernary
}

// IsErrorTimeoutFunc wraps a function with the IsErrorTimeout interface.
type IsErrorTimeoutFunc func(error) aws.Ternary

// IsErrorTimeout returns if the error is retryable.
func (fn IsErrorTimeoutFunc) IsErrorTimeout(err error) aws.Ternary {
	return fn(err)
}

// TimeouterError provides the IsErrorTimeout implementation for determining if
// an error is a timeout based on type with the Timeout method.
type TimeouterError struct{}

// IsErrorTimeout returns if the error is a timeout error.
func (t TimeouterError) IsErrorTimeout(err error) aws.Ternary {
	var v interface{ Timeout() bool }

	if !errors.As(err, &v) {
		return aws.UnknownTernary
	}

	return aws.BoolTernary(v.Timeout())
}
