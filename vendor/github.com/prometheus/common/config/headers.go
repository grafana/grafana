// Copyright 2024 The Prometheus Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// This package no longer handles safe yaml parsing. In order to
// ensure correct yaml unmarshalling, use "yaml.UnmarshalStrict()".

package config

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
)

// ReservedHeaders that change the connection, are set by Prometheus, or can
// be changed otherwise.
var ReservedHeaders = map[string]struct{}{
	"Authorization":                       {},
	"Host":                                {},
	"Content-Encoding":                    {},
	"Content-Length":                      {},
	"Content-Type":                        {},
	"User-Agent":                          {},
	"Connection":                          {},
	"Keep-Alive":                          {},
	"Proxy-Authenticate":                  {},
	"Proxy-Authorization":                 {},
	"Www-Authenticate":                    {},
	"Accept-Encoding":                     {},
	"X-Prometheus-Remote-Write-Version":   {},
	"X-Prometheus-Remote-Read-Version":    {},
	"X-Prometheus-Scrape-Timeout-Seconds": {},

	// Added by SigV4.
	"X-Amz-Date":           {},
	"X-Amz-Security-Token": {},
	"X-Amz-Content-Sha256": {},
}

// Headers represents the configuration for HTTP headers.
type Headers struct {
	Headers map[string]Header `yaml:",inline"`
}

func (h Headers) MarshalJSON() ([]byte, error) {
	// Inline the Headers map when serializing JSON because json encoder doesn't support "inline" directive.
	return json.Marshal(h.Headers)
}

// SetDirectory make headers file relative to the configuration file.
func (h *Headers) SetDirectory(dir string) {
	if h == nil {
		return
	}
	for _, h := range h.Headers {
		h.SetDirectory(dir)
	}
}

// Validate validates the Headers config.
func (h *Headers) Validate() error {
	for n := range h.Headers {
		if _, ok := ReservedHeaders[http.CanonicalHeaderKey(n)]; ok {
			return fmt.Errorf("setting header %q is not allowed", http.CanonicalHeaderKey(n))
		}
	}
	return nil
}

// Header represents the configuration for a single HTTP header.
type Header struct {
	Values  []string `yaml:"values,omitempty" json:"values,omitempty"`
	Secrets []Secret `yaml:"secrets,omitempty" json:"secrets,omitempty"`
	Files   []string `yaml:"files,omitempty" json:"files,omitempty"`
}

// SetDirectory makes headers file relative to the configuration file.
func (h *Header) SetDirectory(dir string) {
	for i := range h.Files {
		h.Files[i] = JoinDir(dir, h.Files[i])
	}
}

// NewHeadersRoundTripper returns a RoundTripper that sets HTTP headers on
// requests as configured.
func NewHeadersRoundTripper(config *Headers, next http.RoundTripper) http.RoundTripper {
	if len(config.Headers) == 0 {
		return next
	}
	return &headersRoundTripper{
		config: config,
		next:   next,
	}
}

type headersRoundTripper struct {
	next   http.RoundTripper
	config *Headers
}

// RoundTrip implements http.RoundTripper.
func (rt *headersRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	req = cloneRequest(req)
	for n, h := range rt.config.Headers {
		for _, v := range h.Values {
			req.Header.Add(n, v)
		}
		for _, v := range h.Secrets {
			req.Header.Add(n, string(v))
		}
		for _, v := range h.Files {
			b, err := os.ReadFile(v)
			if err != nil {
				return nil, fmt.Errorf("unable to read headers file %s: %w", v, err)
			}
			req.Header.Add(n, strings.TrimSpace(string(b)))
		}
	}
	return rt.next.RoundTrip(req)
}

// CloseIdleConnections implements closeIdler.
func (rt *headersRoundTripper) CloseIdleConnections() {
	if ci, ok := rt.next.(closeIdler); ok {
		ci.CloseIdleConnections()
	}
}
