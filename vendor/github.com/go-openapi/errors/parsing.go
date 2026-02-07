// SPDX-FileCopyrightText: Copyright 2015-2025 go-swagger maintainers
// SPDX-License-Identifier: Apache-2.0

package errors

import (
	"encoding/json"
	"fmt"
	"net/http"
)

// ParseError represents a parsing error
type ParseError struct {
	code    int32
	Name    string
	In      string
	Value   string
	Reason  error
	message string
}

// NewParseError creates a new parse error
func NewParseError(name, in, value string, reason error) *ParseError {
	var msg string
	if in == "" {
		msg = fmt.Sprintf(parseErrorTemplContentNoIn, name, value, reason)
	} else {
		msg = fmt.Sprintf(parseErrorTemplContent, name, in, value, reason)
	}
	return &ParseError{
		code:    http.StatusBadRequest,
		Name:    name,
		In:      in,
		Value:   value,
		Reason:  reason,
		message: msg,
	}
}

func (e *ParseError) Error() string {
	return e.message
}

// Code returns the http status code for this error
func (e *ParseError) Code() int32 {
	return e.code
}

// MarshalJSON implements the JSON encoding interface
func (e ParseError) MarshalJSON() ([]byte, error) {
	var reason string
	if e.Reason != nil {
		reason = e.Reason.Error()
	}
	return json.Marshal(map[string]any{
		"code":    e.code,
		"message": e.message,
		"in":      e.In,
		"name":    e.Name,
		"value":   e.Value,
		"reason":  reason,
	})
}

const (
	parseErrorTemplContent     = `parsing %s %s from %q failed, because %s`
	parseErrorTemplContentNoIn = `parsing %s from %q failed, because %s`
)
