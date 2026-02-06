// Copyright 2019 The mqtt-go authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package mqtt

import (
	"context"
	"fmt"
	"io"
	"path/filepath"
	"reflect"
	"runtime"
)

// ErrorWithRetry is a error with packets which should be retransmitted.
type ErrorWithRetry interface {
	error
	Retry(context.Context, *BaseClient) error
}

type retryFn func(context.Context, *BaseClient) error

type errorWithRetry struct {
	errorInterface

	retryFn retryFn
}

func (e *errorWithRetry) Retry(ctx context.Context, cli *BaseClient) error {
	return e.retryFn(ctx, cli)
}

// RequestTimeoutError is a context deadline exceeded error caused by RetryClient.ResponseTimeout.
type RequestTimeoutError struct {
	error
}

// Error implements error.
func (e *RequestTimeoutError) Error() string {
	return fmt.Sprintf("request timeout exceeded: %v", e.error.Error())
}

type errorInterface interface {
	Error() string
	Unwrap() error
	Is(target error) bool
}

// Error records a failed parsing.
type Error struct {
	Err     error
	Failure string
	File    string
	Line    int
}

func (e *Error) Error() string {
	return fmt.Sprintf("%s [%s:%d]: %s", e.Failure, filepath.Base(e.File), e.Line, e.Err.Error())
}

// Unwrap returns the reason of the failure.
// This is for Go1.13 error unwrapping.
func (e *Error) Unwrap() error {
	return e.Err
}

// Is reports whether chained error contains target.
// This is for Go1.13 error unwrapping.
func (e *Error) Is(target error) bool {
	err := e.Err

	switch target {
	case e:
		return true
	case nil:
		return err == nil
	}
	for {
		switch err {
		case nil:
			return false
		case target:
			return true
		}
		x, ok := err.(interface{ Unwrap() error })
		if !ok {
			// Some stdlibs haven't have error unwrapper yet.
			// Check err.Err field if exposed.
			if reflect.TypeOf(err).Kind() == reflect.Ptr {
				e := reflect.ValueOf(err).Elem().FieldByName("Err")
				if e.IsValid() {
					e2, ok := e.Interface().(error)
					if !ok {
						return false
					}
					err = e2
					continue
				}
			}
			return false
		}
		err = x.Unwrap()
	}
}

func wrapErrorImpl(err error, failure string) error {
	switch err {
	case io.EOF:
		return io.EOF
	case nil:
		return nil
	}
	_, file, line, ok := runtime.Caller(2)
	if !ok {
		file = "unknown"
		line = -1
	}
	return &Error{
		Failure: failure,
		Err:     err,
		File:    file,
		Line:    line,
	}
}

func wrapError(err error, failure string) error {
	return wrapErrorImpl(err, failure)
}

func wrapErrorf(err error, failureFmt string, v ...interface{}) error {
	return wrapErrorImpl(err, fmt.Sprintf(failureFmt, v...))
}

func wrapErrorWithRetry(err error, retry retryFn, failure string) error {
	err2 := wrapErrorImpl(err, failure)
	if err, ok := err2.(*Error); ok {
		return &errorWithRetry{errorInterface: err, retryFn: retry}
	}
	return err2
}
