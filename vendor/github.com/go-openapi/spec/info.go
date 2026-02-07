// SPDX-FileCopyrightText: Copyright 2015-2025 go-swagger maintainers
// SPDX-License-Identifier: Apache-2.0

package spec

import (
	"encoding/json"
	"strconv"
	"strings"

	"github.com/go-openapi/jsonpointer"
	"github.com/go-openapi/swag/jsonutils"
)

// Extensions vendor specific extensions
type Extensions map[string]any

// Add adds a value to these extensions
func (e Extensions) Add(key string, value any) {
	realKey := strings.ToLower(key)
	e[realKey] = value
}

// GetString gets a string value from the extensions
func (e Extensions) GetString(key string) (string, bool) {
	if v, ok := e[strings.ToLower(key)]; ok {
		str, ok := v.(string)
		return str, ok
	}
	return "", false
}

// GetInt gets a int value from the extensions
func (e Extensions) GetInt(key string) (int, bool) {
	realKey := strings.ToLower(key)

	if v, ok := e.GetString(realKey); ok {
		if r, err := strconv.Atoi(v); err == nil {
			return r, true
		}
	}

	if v, ok := e[realKey]; ok {
		if r, rOk := v.(float64); rOk {
			return int(r), true
		}
	}
	return -1, false
}

// GetBool gets a string value from the extensions
func (e Extensions) GetBool(key string) (bool, bool) {
	if v, ok := e[strings.ToLower(key)]; ok {
		str, ok := v.(bool)
		return str, ok
	}
	return false, false
}

// GetStringSlice gets a string value from the extensions
func (e Extensions) GetStringSlice(key string) ([]string, bool) {
	if v, ok := e[strings.ToLower(key)]; ok {
		arr, isSlice := v.([]any)
		if !isSlice {
			return nil, false
		}
		var strs []string
		for _, iface := range arr {
			str, isString := iface.(string)
			if !isString {
				return nil, false
			}
			strs = append(strs, str)
		}
		return strs, ok
	}
	return nil, false
}

// VendorExtensible composition block.
type VendorExtensible struct {
	Extensions Extensions
}

// AddExtension adds an extension to this extensible object
func (v *VendorExtensible) AddExtension(key string, value any) {
	if value == nil {
		return
	}
	if v.Extensions == nil {
		v.Extensions = make(map[string]any)
	}
	v.Extensions.Add(key, value)
}

// MarshalJSON marshals the extensions to json
func (v VendorExtensible) MarshalJSON() ([]byte, error) {
	toser := make(map[string]any)
	for k, v := range v.Extensions {
		lk := strings.ToLower(k)
		if strings.HasPrefix(lk, "x-") {
			toser[k] = v
		}
	}
	return json.Marshal(toser)
}

// UnmarshalJSON for this extensible object
func (v *VendorExtensible) UnmarshalJSON(data []byte) error {
	var d map[string]any
	if err := json.Unmarshal(data, &d); err != nil {
		return err
	}
	for k, vv := range d {
		lk := strings.ToLower(k)
		if strings.HasPrefix(lk, "x-") {
			if v.Extensions == nil {
				v.Extensions = map[string]any{}
			}
			v.Extensions[k] = vv
		}
	}
	return nil
}

// InfoProps the properties for an info definition
type InfoProps struct {
	Description    string       `json:"description,omitempty"`
	Title          string       `json:"title,omitempty"`
	TermsOfService string       `json:"termsOfService,omitempty"`
	Contact        *ContactInfo `json:"contact,omitempty"`
	License        *License     `json:"license,omitempty"`
	Version        string       `json:"version,omitempty"`
}

// Info object provides metadata about the API.
// The metadata can be used by the clients if needed, and can be presented in the Swagger-UI for convenience.
//
// For more information: http://goo.gl/8us55a#infoObject
type Info struct {
	VendorExtensible
	InfoProps
}

// JSONLookup look up a value by the json property name
func (i Info) JSONLookup(token string) (any, error) {
	if ex, ok := i.Extensions[token]; ok {
		return &ex, nil
	}
	r, _, err := jsonpointer.GetForToken(i.InfoProps, token)
	return r, err
}

// MarshalJSON marshal this to JSON
func (i Info) MarshalJSON() ([]byte, error) {
	b1, err := json.Marshal(i.InfoProps)
	if err != nil {
		return nil, err
	}
	b2, err := json.Marshal(i.VendorExtensible)
	if err != nil {
		return nil, err
	}
	return jsonutils.ConcatJSON(b1, b2), nil
}

// UnmarshalJSON marshal this from JSON
func (i *Info) UnmarshalJSON(data []byte) error {
	if err := json.Unmarshal(data, &i.InfoProps); err != nil {
		return err
	}
	return json.Unmarshal(data, &i.VendorExtensible)
}
