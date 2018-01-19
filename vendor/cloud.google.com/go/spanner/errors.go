/*
Copyright 2017 Google Inc. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package spanner

import (
	"fmt"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
)

// Error is the structured error returned by Cloud Spanner client.
type Error struct {
	// Code is the canonical error code for describing the nature of a
	// particular error.
	Code codes.Code
	// Desc explains more details of the error.
	Desc string
	// trailers are the trailers returned in the response, if any.
	trailers metadata.MD
}

// Error implements error.Error.
func (e *Error) Error() string {
	if e == nil {
		return fmt.Sprintf("spanner: OK")
	}
	return fmt.Sprintf("spanner: code = %q, desc = %q", e.Code, e.Desc)
}

// decorate decorates an existing spanner.Error with more information.
func (e *Error) decorate(info string) {
	e.Desc = fmt.Sprintf("%v, %v", info, e.Desc)
}

// spannerErrorf generates a *spanner.Error with the given error code and
// description.
func spannerErrorf(ec codes.Code, format string, args ...interface{}) error {
	return &Error{
		Code: ec,
		Desc: fmt.Sprintf(format, args...),
	}
}

// toSpannerError converts general Go error to *spanner.Error.
func toSpannerError(err error) error {
	return toSpannerErrorWithMetadata(err, nil)
}

// toSpannerErrorWithMetadata converts general Go error and grpc trailers to *spanner.Error.
// Note: modifies original error if trailers aren't nil
func toSpannerErrorWithMetadata(err error, trailers metadata.MD) error {
	if err == nil {
		return nil
	}
	if se, ok := err.(*Error); ok {
		if trailers != nil {
			se.trailers = metadata.Join(se.trailers, trailers)
		}
		return se
	}
	if grpc.Code(err) == codes.Unknown {
		return &Error{codes.Unknown, err.Error(), trailers}
	}
	return &Error{grpc.Code(err), grpc.ErrorDesc(err), trailers}
}

// ErrCode extracts the canonical error code from a Go error.
func ErrCode(err error) codes.Code {
	se, ok := toSpannerError(err).(*Error)
	if !ok {
		return codes.Unknown
	}
	return se.Code
}

// ErrDesc extracts the Cloud Spanner error description from a Go error.
func ErrDesc(err error) string {
	se, ok := toSpannerError(err).(*Error)
	if !ok {
		return err.Error()
	}
	return se.Desc
}

// errTrailers extracts the grpc trailers if present from a Go error.
func errTrailers(err error) metadata.MD {
	se, ok := err.(*Error)
	if !ok {
		return nil
	}
	return se.trailers
}
