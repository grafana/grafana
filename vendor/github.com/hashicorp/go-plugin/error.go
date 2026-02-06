// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package plugin

// This is a type that wraps error types so that they can be messaged
// across RPC channels. Since "error" is an interface, we can't always
// gob-encode the underlying structure. This is a valid error interface
// implementer that we will push across.
type BasicError struct {
	Message string
}

// NewBasicError is used to create a BasicError.
//
// err is allowed to be nil.
func NewBasicError(err error) *BasicError {
	if err == nil {
		return nil
	}

	return &BasicError{err.Error()}
}

func (e *BasicError) Error() string {
	return e.Message
}
