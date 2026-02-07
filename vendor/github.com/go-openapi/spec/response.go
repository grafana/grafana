// SPDX-FileCopyrightText: Copyright 2015-2025 go-swagger maintainers
// SPDX-License-Identifier: Apache-2.0

package spec

import (
	"encoding/json"

	"github.com/go-openapi/jsonpointer"
	"github.com/go-openapi/swag/jsonutils"
)

// ResponseProps properties specific to a response
type ResponseProps struct {
	Description string            `json:"description"`
	Schema      *Schema           `json:"schema,omitempty"`
	Headers     map[string]Header `json:"headers,omitempty"`
	Examples    map[string]any    `json:"examples,omitempty"`
}

// Response describes a single response from an API Operation.
//
// For more information: http://goo.gl/8us55a#responseObject
type Response struct {
	Refable
	ResponseProps
	VendorExtensible
}

// NewResponse creates a new response instance
func NewResponse() *Response {
	return new(Response)
}

// ResponseRef creates a response as a json reference
func ResponseRef(url string) *Response {
	resp := NewResponse()
	resp.Ref = MustCreateRef(url)
	return resp
}

// JSONLookup look up a value by the json property name
func (r Response) JSONLookup(token string) (any, error) {
	if ex, ok := r.Extensions[token]; ok {
		return &ex, nil
	}
	if token == "$ref" {
		return &r.Ref, nil
	}
	ptr, _, err := jsonpointer.GetForToken(r.ResponseProps, token)
	return ptr, err
}

// UnmarshalJSON hydrates this items instance with the data from JSON
func (r *Response) UnmarshalJSON(data []byte) error {
	if err := json.Unmarshal(data, &r.ResponseProps); err != nil {
		return err
	}
	if err := json.Unmarshal(data, &r.Refable); err != nil {
		return err
	}
	return json.Unmarshal(data, &r.VendorExtensible)
}

// MarshalJSON converts this items object to JSON
func (r Response) MarshalJSON() ([]byte, error) {
	var (
		b1  []byte
		err error
	)

	if r.Ref.String() == "" {
		// when there is no $ref, empty description is rendered as an empty string
		b1, err = json.Marshal(r.ResponseProps)
	} else {
		// when there is $ref inside the schema, description should be omitempty-ied
		b1, err = json.Marshal(struct {
			Description string            `json:"description,omitempty"`
			Schema      *Schema           `json:"schema,omitempty"`
			Headers     map[string]Header `json:"headers,omitempty"`
			Examples    map[string]any    `json:"examples,omitempty"`
		}{
			Description: r.Description,
			Schema:      r.Schema,
			Examples:    r.Examples,
		})
	}
	if err != nil {
		return nil, err
	}

	b2, err := json.Marshal(r.Refable)
	if err != nil {
		return nil, err
	}
	b3, err := json.Marshal(r.VendorExtensible)
	if err != nil {
		return nil, err
	}
	return jsonutils.ConcatJSON(b1, b2, b3), nil
}

// WithDescription sets the description on this response, allows for chaining
func (r *Response) WithDescription(description string) *Response {
	r.Description = description
	return r
}

// WithSchema sets the schema on this response, allows for chaining.
// Passing a nil argument removes the schema from this response
func (r *Response) WithSchema(schema *Schema) *Response {
	r.Schema = schema
	return r
}

// AddHeader adds a header to this response
func (r *Response) AddHeader(name string, header *Header) *Response {
	if header == nil {
		return r.RemoveHeader(name)
	}
	if r.Headers == nil {
		r.Headers = make(map[string]Header)
	}
	r.Headers[name] = *header
	return r
}

// RemoveHeader removes a header from this response
func (r *Response) RemoveHeader(name string) *Response {
	delete(r.Headers, name)
	return r
}

// AddExample adds an example to this response
func (r *Response) AddExample(mediaType string, example any) *Response {
	if r.Examples == nil {
		r.Examples = make(map[string]any)
	}
	r.Examples[mediaType] = example
	return r
}
