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

// Package gcerrors provides support for getting error codes from
// errors returned by Go CDK APIs.
package gcerrors

import (
	"context"
	"errors"

	"gocloud.dev/internal/gcerr"
)

// An ErrorCode describes the error's category. Programs should act upon an error's
// code, not its message.
type ErrorCode = gcerr.ErrorCode

const (
	// OK is returned by the Code function on a nil error. It is not a valid
	// code for an error.
	OK ErrorCode = gcerr.OK

	// Unknown means that the error could not be categorized.
	Unknown ErrorCode = gcerr.Unknown

	// NotFound means that the resource was not found.
	NotFound ErrorCode = gcerr.NotFound

	// AlreadyExists means that the resource exists, but it should not.
	AlreadyExists ErrorCode = gcerr.AlreadyExists

	// InvalidArguments means that a value given to a Go CDK API is incorrect.
	InvalidArgument ErrorCode = gcerr.InvalidArgument

	// Internal means that something unexpected happened. Internal errors always indicate
	// bugs in the Go CDK (or possibly the underlying service).
	Internal ErrorCode = gcerr.Internal

	// Unimplemented means that the feature is not implemented.
	Unimplemented ErrorCode = gcerr.Unimplemented

	// FailedPrecondition means that the system was in the wrong state.
	FailedPrecondition ErrorCode = gcerr.FailedPrecondition

	// PermissionDenied means that the caller does not have permission to execute the specified operation.
	PermissionDenied ErrorCode = gcerr.PermissionDenied

	// ResourceExhausted means that some resource has been exhausted, typically because a service resource limit
	// has been reached.
	ResourceExhausted ErrorCode = gcerr.ResourceExhausted

	// Canceled means that the operation was canceled.
	Canceled ErrorCode = gcerr.Canceled

	// DeadlinedExceeded means that the operation timed out.
	DeadlineExceeded ErrorCode = gcerr.DeadlineExceeded
)

// Code returns the ErrorCode of err if it, or some error it wraps, is an *Error.
// If err is context.Canceled or context.DeadlineExceeded, or wraps one of those errors,
// it returns the Canceled or DeadlineExceeded codes, respectively.
// If err is nil, it returns the special code OK.
// Otherwise, it returns Unknown.
func Code(err error) ErrorCode {
	if err == nil {
		return OK
	}
	var e *gcerr.Error
	if errors.As(err, &e) {
		return e.Code
	}
	if errors.Is(err, context.Canceled) {
		return Canceled
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return DeadlineExceeded
	}
	return Unknown
}
