// Copyright 2019 The Go Cloud Development Kit Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Package gcerr provides an error type for Go CDK APIs.
package gcerr

import (
	"context"
	"errors"
	"fmt"
	"io"
	"reflect"

	"gocloud.dev/internal/retry"
	"golang.org/x/xerrors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// An ErrorCode describes the error's category.
type ErrorCode int

const (
	// OK is returned by the Code function on a nil error. It is not a valid
	// code for an error.
	OK ErrorCode = 0

	// Unknown means that the error could not be categorized.
	Unknown ErrorCode = 1

	// NotFound means that the resource was not found.
	NotFound ErrorCode = 2

	// AlreadyExists means that the resource exists, but it should not.
	AlreadyExists ErrorCode = 3

	// InvalidArguments means that a value given to a Go CDK API is incorrect.
	InvalidArgument ErrorCode = 4

	// Internal means that something unexpected happened. Internal errors always indicate
	// bugs in the Go CDK (or possibly the underlying service).
	Internal ErrorCode = 5

	// Unimplemented means that the feature is not implemented.
	Unimplemented ErrorCode = 6

	// FailedPrecondition means that the system was in the wrong state.
	FailedPrecondition ErrorCode = 7

	// PermissionDenied means that the caller does not have permission to execute the specified operation.
	PermissionDenied ErrorCode = 8

	// ResourceExhausted means that some resource has been exhausted, typically because a service resource limit
	// has been reached.
	ResourceExhausted ErrorCode = 9

	// Canceled means that the operation was canceled.
	Canceled ErrorCode = 10

	// DeadlineExceeded means that The operation timed out.
	DeadlineExceeded ErrorCode = 11
)

// When adding a new error code, try to use the names defined in google.golang.org/grpc/codes.

// Do not change the numbers assigned to codes: past values may be stored in metric databases.

// Call "go generate" whenever you change the above list of error codes.
// To get stringer:
//   go get golang.org/x/tools/cmd/stringer
//   Make sure $GOPATH/bin or $GOBIN in on your path.

//go:generate stringer -type=ErrorCode

// An Error describes a Go CDK error.
type Error struct {
	// Code is the error code.
	Code  ErrorCode
	msg   string
	frame xerrors.Frame
	err   error
}

// Error returns the error as a string.
func (e *Error) Error() string {
	return fmt.Sprint(e)
}

// Format formats the error.
func (e *Error) Format(s fmt.State, c rune) {
	xerrors.FormatError(e, s, c)
}

// FormatError formats the errots.
func (e *Error) FormatError(p xerrors.Printer) (next error) {
	if e.msg == "" {
		p.Printf("code=%v", e.Code)
	} else {
		p.Printf("%s (code=%v)", e.msg, e.Code)
	}
	e.frame.Format(p)
	return e.err
}

// Unwrap returns the error underlying the receiver, which may be nil.
func (e *Error) Unwrap() error {
	return e.err
}

// New returns a new error with the given code, underlying error and message. Pass 1
// for the call depth if New is called from the function raising the error; pass 2 if
// it is called from a helper function that was invoked by the original function; and
// so on.
func New(c ErrorCode, err error, callDepth int, msg string) *Error {
	return &Error{
		Code:  c,
		msg:   msg,
		frame: xerrors.Caller(callDepth),
		err:   err,
	}
}

// Newf uses format and args to format a message, then calls New.
func Newf(c ErrorCode, err error, format string, args ...any) *Error {
	return New(c, err, 2, fmt.Sprintf(format, args...))
}

// DoNotWrap reports whether an error should not be wrapped in the Error
// type from this package.
// It returns true if err is a retry error, a context error, io.EOF, or if it wraps
// one of those.
func DoNotWrap(err error) bool {
	if errors.Is(err, io.EOF) {
		return true
	}
	if errors.Is(err, context.Canceled) {
		return true
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return true
	}
	var r *retry.ContextError
	return errors.As(err, &r)
}

// GRPCCode extracts the gRPC status code and converts it into an ErrorCode.
// It returns Unknown if the error isn't from gRPC.
func GRPCCode(err error) ErrorCode {
	switch status.Code(err) {
	case codes.NotFound:
		return NotFound
	case codes.AlreadyExists:
		return AlreadyExists
	case codes.InvalidArgument:
		return InvalidArgument
	case codes.Internal:
		return Internal
	case codes.Unimplemented:
		return Unimplemented
	case codes.FailedPrecondition:
		return FailedPrecondition
	case codes.PermissionDenied:
		return PermissionDenied
	case codes.ResourceExhausted:
		return ResourceExhausted
	case codes.Canceled:
		return Canceled
	case codes.DeadlineExceeded:
		return DeadlineExceeded
	default:
		return Unknown
	}
}

// ErrorAs is a helper for the ErrorAs method of an API's portable type.
// It performs some initial nil checks, and does a single level of unwrapping
// when err is a *gcerr.Error. Then it calls its errorAs argument, which should
// be a driver implementation of ErrorAs.
func ErrorAs(err error, target any, errorAs func(error, any) bool) bool {
	if err == nil {
		return false
	}
	if target == nil {
		panic("ErrorAs target cannot be nil")
	}
	val := reflect.ValueOf(target)
	if val.Type().Kind() != reflect.Ptr || val.IsNil() {
		panic("ErrorAs target must be a non-nil pointer")
	}
	if e, ok := err.(*Error); ok {
		err = e.Unwrap()
	}
	return errorAs(err, target)
}
