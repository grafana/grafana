// SPDX-FileCopyrightText: Copyright 2015-2025 go-swagger maintainers
// SPDX-License-Identifier: Apache-2.0

package errors

import (
	"encoding/json"
	"fmt"
	"net/http"
)

// Validation represents a failure of a precondition
type Validation struct { //nolint: errname
	code    int32
	Name    string
	In      string
	Value   any
	message string
	Values  []any
}

func (e *Validation) Error() string {
	return e.message
}

// Code the error code
func (e *Validation) Code() int32 {
	return e.code
}

// MarshalJSON implements the JSON encoding interface
func (e Validation) MarshalJSON() ([]byte, error) {
	return json.Marshal(map[string]any{
		"code":    e.code,
		"message": e.message,
		"in":      e.In,
		"name":    e.Name,
		"value":   e.Value,
		"values":  e.Values,
	})
}

// ValidateName sets the name for a validation or updates it for a nested property
func (e *Validation) ValidateName(name string) *Validation {
	if name != "" {
		if e.Name == "" {
			e.Name = name
			e.message = name + e.message
		} else {
			e.Name = name + "." + e.Name
			e.message = name + "." + e.message
		}
	}
	return e
}

const (
	contentTypeFail    = `unsupported media type %q, only %v are allowed`
	responseFormatFail = `unsupported media type requested, only %v are available`
)

// InvalidContentType error for an invalid content type
func InvalidContentType(value string, allowed []string) *Validation {
	values := make([]any, 0, len(allowed))
	for _, v := range allowed {
		values = append(values, v)
	}
	return &Validation{
		code:    http.StatusUnsupportedMediaType,
		Name:    "Content-Type",
		In:      "header",
		Value:   value,
		Values:  values,
		message: fmt.Sprintf(contentTypeFail, value, allowed),
	}
}

// InvalidResponseFormat error for an unacceptable response format request
func InvalidResponseFormat(value string, allowed []string) *Validation {
	values := make([]any, 0, len(allowed))
	for _, v := range allowed {
		values = append(values, v)
	}
	return &Validation{
		code:    http.StatusNotAcceptable,
		Name:    "Accept",
		In:      "header",
		Value:   value,
		Values:  values,
		message: fmt.Sprintf(responseFormatFail, allowed),
	}
}
