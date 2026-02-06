// SPDX-FileCopyrightText: Copyright 2015-2025 go-swagger maintainers
// SPDX-License-Identifier: Apache-2.0

package spec

import (
	"encoding/json"

	"github.com/go-openapi/jsonpointer"
	"github.com/go-openapi/swag/jsonutils"
)

// TagProps describe a tag entry in the top level tags section of a swagger spec
type TagProps struct {
	Description  string                 `json:"description,omitempty"`
	Name         string                 `json:"name,omitempty"`
	ExternalDocs *ExternalDocumentation `json:"externalDocs,omitempty"`
}

// Tag allows adding meta data to a single tag that is used by the
// [Operation Object](http://goo.gl/8us55a#operationObject).
// It is not mandatory to have a Tag Object per tag used there.
//
// For more information: http://goo.gl/8us55a#tagObject
type Tag struct {
	VendorExtensible
	TagProps
}

// NewTag creates a new tag
func NewTag(name, description string, externalDocs *ExternalDocumentation) Tag {
	return Tag{TagProps: TagProps{Description: description, Name: name, ExternalDocs: externalDocs}}
}

// JSONLookup implements an interface to customize json pointer lookup
func (t Tag) JSONLookup(token string) (any, error) {
	if ex, ok := t.Extensions[token]; ok {
		return &ex, nil
	}

	r, _, err := jsonpointer.GetForToken(t.TagProps, token)
	return r, err
}

// MarshalJSON marshal this to JSON
func (t Tag) MarshalJSON() ([]byte, error) {
	b1, err := json.Marshal(t.TagProps)
	if err != nil {
		return nil, err
	}
	b2, err := json.Marshal(t.VendorExtensible)
	if err != nil {
		return nil, err
	}
	return jsonutils.ConcatJSON(b1, b2), nil
}

// UnmarshalJSON marshal this from JSON
func (t *Tag) UnmarshalJSON(data []byte) error {
	if err := json.Unmarshal(data, &t.TagProps); err != nil {
		return err
	}
	return json.Unmarshal(data, &t.VendorExtensible)
}
