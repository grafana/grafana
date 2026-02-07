// SPDX-FileCopyrightText: Copyright 2015-2025 go-swagger maintainers
// SPDX-License-Identifier: Apache-2.0

package errors

import (
	"encoding/json"
	"fmt"
	"net/http"
	"reflect"
	"strings"
)

// DefaultHTTPCode is used when the error Code cannot be used as an HTTP code.
var DefaultHTTPCode = http.StatusUnprocessableEntity

// Error represents a error interface all swagger framework errors implement
type Error interface {
	error
	Code() int32
}

type apiError struct {
	code    int32
	message string
}

func (a *apiError) Error() string {
	return a.message
}

func (a *apiError) Code() int32 {
	return a.code
}

// MarshalJSON implements the JSON encoding interface
func (a apiError) MarshalJSON() ([]byte, error) {
	return json.Marshal(map[string]any{
		"code":    a.code,
		"message": a.message,
	})
}

// New creates a new API error with a code and a message
func New(code int32, message string, args ...any) Error {
	if len(args) > 0 {
		return &apiError{
			code:    code,
			message: fmt.Sprintf(message, args...),
		}
	}
	return &apiError{
		code:    code,
		message: message,
	}
}

// NotFound creates a new not found error
func NotFound(message string, args ...any) Error {
	if message == "" {
		message = "Not found"
	}
	return New(http.StatusNotFound, message, args...)
}

// NotImplemented creates a new not implemented error
func NotImplemented(message string) Error {
	return New(http.StatusNotImplemented, "%s", message)
}

// MethodNotAllowedError represents an error for when the path matches but the method doesn't
type MethodNotAllowedError struct {
	code    int32
	Allowed []string
	message string
}

func (m *MethodNotAllowedError) Error() string {
	return m.message
}

// Code the error code
func (m *MethodNotAllowedError) Code() int32 {
	return m.code
}

// MarshalJSON implements the JSON encoding interface
func (m MethodNotAllowedError) MarshalJSON() ([]byte, error) {
	return json.Marshal(map[string]any{
		"code":    m.code,
		"message": m.message,
		"allowed": m.Allowed,
	})
}

func errorAsJSON(err Error) []byte {
	//nolint:errchkjson
	b, _ := json.Marshal(struct {
		Code    int32  `json:"code"`
		Message string `json:"message"`
	}{err.Code(), err.Error()})
	return b
}

func flattenComposite(errs *CompositeError) *CompositeError {
	var res []error
	for _, er := range errs.Errors {
		switch e := er.(type) {
		case *CompositeError:
			if e != nil && len(e.Errors) > 0 {
				flat := flattenComposite(e)
				if len(flat.Errors) > 0 {
					res = append(res, flat.Errors...)
				}
			}
		default:
			if e != nil {
				res = append(res, e)
			}
		}
	}
	return CompositeValidationError(res...)
}

// MethodNotAllowed creates a new method not allowed error
func MethodNotAllowed(requested string, allow []string) Error {
	msg := fmt.Sprintf("method %s is not allowed, but [%s] are", requested, strings.Join(allow, ","))
	return &MethodNotAllowedError{
		code:    http.StatusMethodNotAllowed,
		Allowed: allow,
		message: msg,
	}
}

// ServeError implements the http error handler interface
func ServeError(rw http.ResponseWriter, r *http.Request, err error) {
	rw.Header().Set("Content-Type", "application/json")
	switch e := err.(type) {
	case *CompositeError:
		er := flattenComposite(e)
		// strips composite errors to first element only
		if len(er.Errors) > 0 {
			ServeError(rw, r, er.Errors[0])
		} else {
			// guard against empty CompositeError (invalid construct)
			ServeError(rw, r, nil)
		}
	case *MethodNotAllowedError:
		rw.Header().Add("Allow", strings.Join(e.Allowed, ","))
		rw.WriteHeader(asHTTPCode(int(e.Code())))
		if r == nil || r.Method != http.MethodHead {
			_, _ = rw.Write(errorAsJSON(e))
		}
	case Error:
		value := reflect.ValueOf(e)
		if value.Kind() == reflect.Ptr && value.IsNil() {
			rw.WriteHeader(http.StatusInternalServerError)
			_, _ = rw.Write(errorAsJSON(New(http.StatusInternalServerError, "Unknown error")))
			return
		}
		rw.WriteHeader(asHTTPCode(int(e.Code())))
		if r == nil || r.Method != http.MethodHead {
			_, _ = rw.Write(errorAsJSON(e))
		}
	case nil:
		rw.WriteHeader(http.StatusInternalServerError)
		_, _ = rw.Write(errorAsJSON(New(http.StatusInternalServerError, "Unknown error")))
	default:
		rw.WriteHeader(http.StatusInternalServerError)
		if r == nil || r.Method != http.MethodHead {
			_, _ = rw.Write(errorAsJSON(New(http.StatusInternalServerError, "%v", err)))
		}
	}
}

func asHTTPCode(input int) int {
	if input >= maximumValidHTTPCode {
		return DefaultHTTPCode
	}
	return input
}
