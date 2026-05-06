//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

package errorinfo

// NonRetriable represents a non-transient error.  This works in
// conjunction with the retry policy, indicating that the error condition
// is idempotent, so no retries will be attempted.
// Use errors.As() to access this interface in the error chain.
type NonRetriable interface {
	error
	NonRetriable()
}

// NonRetriableError marks the specified error as non-retriable.
// This function takes an error as input and returns a new error that is marked as non-retriable.
func NonRetriableError(err error) error {
	return &nonRetriableError{err}
}

// nonRetriableError is a struct that embeds the error interface.
// It is used to represent errors that should not be retried.
type nonRetriableError struct {
	error
}

// Error method for nonRetriableError struct.
// It returns the error message of the embedded error.
func (p *nonRetriableError) Error() string {
	return p.error.Error()
}

// NonRetriable is a marker method for nonRetriableError struct.
// Non-functional and indicates that the error is non-retriable.
func (*nonRetriableError) NonRetriable() {
	// marker method
}

// Unwrap method for nonRetriableError struct.
// It returns the original error that was marked as non-retriable.
func (p *nonRetriableError) Unwrap() error {
	return p.error
}
