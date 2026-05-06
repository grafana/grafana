// Copyright 2016 The Prometheus Authors
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
	"net/http"
	"path/filepath"
)

const secretToken = "<secret>"

// Secret special type for storing secrets.
type Secret string

// MarshalSecretValue if set to true will expose Secret type
// through the marshal interfaces. Useful for outside projects
// that load and marshal the Prometheus config.
var MarshalSecretValue = false

// MarshalYAML implements the yaml.Marshaler interface for Secrets.
func (s Secret) MarshalYAML() (interface{}, error) {
	if MarshalSecretValue {
		return string(s), nil
	}
	if s != "" {
		return secretToken, nil
	}
	return nil, nil
}

// UnmarshalYAML implements the yaml.Unmarshaler interface for Secrets.
func (s *Secret) UnmarshalYAML(unmarshal func(interface{}) error) error {
	type plain Secret
	return unmarshal((*plain)(s))
}

// MarshalJSON implements the json.Marshaler interface for Secret.
func (s Secret) MarshalJSON() ([]byte, error) {
	if MarshalSecretValue {
		return json.Marshal(string(s))
	}
	if len(s) == 0 {
		return json.Marshal("")
	}
	return json.Marshal(secretToken)
}

type ProxyHeader map[string][]Secret

func (h *ProxyHeader) HTTPHeader() http.Header {
	if h == nil || *h == nil {
		return nil
	}

	header := make(http.Header)

	for name, values := range *h {
		var s []string
		if values != nil {
			s = make([]string, 0, len(values))
			for _, value := range values {
				s = append(s, string(value))
			}
		}
		header[name] = s
	}

	return header
}

// DirectorySetter is a config type that contains file paths that may
// be relative to the file containing the config.
type DirectorySetter interface {
	// SetDirectory joins any relative file paths with dir.
	// Any paths that are empty or absolute remain unchanged.
	SetDirectory(dir string)
}

// JoinDir joins dir and path if path is relative.
// If path is empty or absolute, it is returned unchanged.
func JoinDir(dir, path string) string {
	if path == "" || filepath.IsAbs(path) {
		return path
	}
	return filepath.Join(dir, path)
}
