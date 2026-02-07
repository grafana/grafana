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

// Package openurl provides helpers for URLMux and URLOpeners in portable APIs.
package openurl // import "gocloud.dev/internal/openurl"

import (
	"fmt"
	"net/url"
	"sort"
	"strings"
)

// SchemeMap maps URL schemes to values. The zero value is an empty map, ready for use.
// All schemes are stored and compared case-insensitively.
type SchemeMap struct {
	api string
	m   map[string]any
}

// Register registers scheme for value; subsequent calls to FromString or
// FromURL with scheme will return value.
// api is the portable API name (e.g., "blob"); the same value should always
// be passed. It should be in all lowercase.
// typ is the portable type (e.g., "Bucket").
// Register panics if scheme has already been registered.
func (m *SchemeMap) Register(api, typ, scheme string, value any) {
	if m.m == nil {
		m.m = map[string]any{}
	}
	if api != strings.ToLower(api) {
		panic(fmt.Errorf("api should be lowercase: %q", api))
	}
	if m.api == "" {
		m.api = api
	} else if m.api != api {
		panic(fmt.Errorf("previously registered using api %q (now %q)", m.api, api))
	}
	scheme = strings.ToLower(scheme)
	if _, exists := m.m[scheme]; exists {
		panic(fmt.Errorf("scheme %q already registered for %s.%s", scheme, api, typ))
	}
	m.m[scheme] = value
}

// FromString parses urlstr as an URL and looks up the value for the URL's scheme.
func (m *SchemeMap) FromString(typ, urlstr string) (any, *url.URL, error) {
	u, err := url.Parse(urlstr)
	if err != nil {
		return nil, nil, fmt.Errorf("open %s.%s: %v", m.api, typ, err)
	}
	val, err := m.FromURL(typ, u)
	if err != nil {
		return nil, nil, err
	}
	return val, u, nil
}

// FromURL looks up the value for u's scheme.
func (m *SchemeMap) FromURL(typ string, u *url.URL) (any, error) {
	scheme := strings.ToLower(u.Scheme)
	if scheme == "" {
		return nil, fmt.Errorf("open %s.%s: no scheme in URL %q", m.api, typ, u)
	}
	for _, prefix := range []string{
		fmt.Sprintf("%s+%s+", m.api, strings.ToLower(typ)),
		fmt.Sprintf("%s+", m.api),
	} {
		scheme = strings.TrimPrefix(scheme, prefix)
	}
	v, ok := m.m[scheme]
	if !ok {
		return nil, fmt.Errorf("open %s.%s: no driver registered for %q for URL %q; available schemes: %v", m.api, typ, scheme, u, strings.Join(m.Schemes(), ", "))
	}
	return v, nil
}

// Schemes returns a sorted slice of the registered schemes.
func (m *SchemeMap) Schemes() []string {
	var schemes []string
	for s := range m.m {
		schemes = append(schemes, s)
	}
	sort.Strings(schemes)
	return schemes
}

// ValidScheme returns true iff scheme has been registered.
func (m *SchemeMap) ValidScheme(scheme string) bool {
	_, exists := m.m[strings.ToLower(scheme)]
	return exists
}
