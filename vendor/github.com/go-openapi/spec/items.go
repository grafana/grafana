// SPDX-FileCopyrightText: Copyright 2015-2025 go-swagger maintainers
// SPDX-License-Identifier: Apache-2.0

package spec

import (
	"encoding/json"
	"strings"

	"github.com/go-openapi/jsonpointer"
	"github.com/go-openapi/swag/jsonutils"
)

const (
	jsonRef = "$ref"
)

// SimpleSchema describe swagger simple schemas for parameters and headers
type SimpleSchema struct {
	Type             string `json:"type,omitempty"`
	Nullable         bool   `json:"nullable,omitempty"`
	Format           string `json:"format,omitempty"`
	Items            *Items `json:"items,omitempty"`
	CollectionFormat string `json:"collectionFormat,omitempty"`
	Default          any    `json:"default,omitempty"`
	Example          any    `json:"example,omitempty"`
}

// TypeName return the type (or format) of a simple schema
func (s *SimpleSchema) TypeName() string {
	if s.Format != "" {
		return s.Format
	}
	return s.Type
}

// ItemsTypeName yields the type of items in a simple schema array
func (s *SimpleSchema) ItemsTypeName() string {
	if s.Items == nil {
		return ""
	}
	return s.Items.TypeName()
}

// Items a limited subset of JSON-Schema's items object.
// It is used by parameter definitions that are not located in "body".
//
// For more information: http://goo.gl/8us55a#items-object
type Items struct {
	Refable
	CommonValidations
	SimpleSchema
	VendorExtensible
}

// NewItems creates a new instance of items
func NewItems() *Items {
	return &Items{}
}

// Typed a fluent builder method for the type of item
func (i *Items) Typed(tpe, format string) *Items {
	i.Type = tpe
	i.Format = format
	return i
}

// AsNullable flags this schema as nullable.
func (i *Items) AsNullable() *Items {
	i.Nullable = true
	return i
}

// CollectionOf a fluent builder method for an array item
func (i *Items) CollectionOf(items *Items, format string) *Items {
	i.Type = jsonArray
	i.Items = items
	i.CollectionFormat = format
	return i
}

// WithDefault sets the default value on this item
func (i *Items) WithDefault(defaultValue any) *Items {
	i.Default = defaultValue
	return i
}

// WithMaxLength sets a max length value
func (i *Items) WithMaxLength(maximum int64) *Items {
	i.MaxLength = &maximum
	return i
}

// WithMinLength sets a min length value
func (i *Items) WithMinLength(minimum int64) *Items {
	i.MinLength = &minimum
	return i
}

// WithPattern sets a pattern value
func (i *Items) WithPattern(pattern string) *Items {
	i.Pattern = pattern
	return i
}

// WithMultipleOf sets a multiple of value
func (i *Items) WithMultipleOf(number float64) *Items {
	i.MultipleOf = &number
	return i
}

// WithMaximum sets a maximum number value
func (i *Items) WithMaximum(maximum float64, exclusive bool) *Items {
	i.Maximum = &maximum
	i.ExclusiveMaximum = exclusive
	return i
}

// WithMinimum sets a minimum number value
func (i *Items) WithMinimum(minimum float64, exclusive bool) *Items {
	i.Minimum = &minimum
	i.ExclusiveMinimum = exclusive
	return i
}

// WithEnum sets a the enum values (replace)
func (i *Items) WithEnum(values ...any) *Items {
	i.Enum = append([]any{}, values...)
	return i
}

// WithMaxItems sets the max items
func (i *Items) WithMaxItems(size int64) *Items {
	i.MaxItems = &size
	return i
}

// WithMinItems sets the min items
func (i *Items) WithMinItems(size int64) *Items {
	i.MinItems = &size
	return i
}

// UniqueValues dictates that this array can only have unique items
func (i *Items) UniqueValues() *Items {
	i.UniqueItems = true
	return i
}

// AllowDuplicates this array can have duplicates
func (i *Items) AllowDuplicates() *Items {
	i.UniqueItems = false
	return i
}

// WithValidations is a fluent method to set Items validations
func (i *Items) WithValidations(val CommonValidations) *Items {
	i.SetValidations(SchemaValidations{CommonValidations: val})
	return i
}

// UnmarshalJSON hydrates this items instance with the data from JSON
func (i *Items) UnmarshalJSON(data []byte) error {
	var validations CommonValidations
	if err := json.Unmarshal(data, &validations); err != nil {
		return err
	}
	var ref Refable
	if err := json.Unmarshal(data, &ref); err != nil {
		return err
	}
	var simpleSchema SimpleSchema
	if err := json.Unmarshal(data, &simpleSchema); err != nil {
		return err
	}
	var vendorExtensible VendorExtensible
	if err := json.Unmarshal(data, &vendorExtensible); err != nil {
		return err
	}
	i.Refable = ref
	i.CommonValidations = validations
	i.SimpleSchema = simpleSchema
	i.VendorExtensible = vendorExtensible
	return nil
}

// MarshalJSON converts this items object to JSON
func (i Items) MarshalJSON() ([]byte, error) {
	b1, err := json.Marshal(i.CommonValidations)
	if err != nil {
		return nil, err
	}
	b2, err := json.Marshal(i.SimpleSchema)
	if err != nil {
		return nil, err
	}
	b3, err := json.Marshal(i.Refable)
	if err != nil {
		return nil, err
	}
	b4, err := json.Marshal(i.VendorExtensible)
	if err != nil {
		return nil, err
	}
	return jsonutils.ConcatJSON(b4, b3, b1, b2), nil
}

// JSONLookup look up a value by the json property name
func (i Items) JSONLookup(token string) (any, error) {
	if token == jsonRef {
		return &i.Ref, nil
	}

	r, _, err := jsonpointer.GetForToken(i.CommonValidations, token)
	if err != nil && !strings.HasPrefix(err.Error(), "object has no field") {
		return nil, err
	}
	if r != nil {
		return r, nil
	}
	r, _, err = jsonpointer.GetForToken(i.SimpleSchema, token)
	return r, err
}
