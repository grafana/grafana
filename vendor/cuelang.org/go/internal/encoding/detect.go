// Copyright 2020 CUE Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package encoding

import (
	"net/url"
	"path"
	"strings"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/build"
)

// Detect detects the interpretation.
func Detect(v cue.Value) (i build.Interpretation) {
	switch {
	case isOpenAPI(v):
		return build.OpenAPI
	case isJSONSchema(v):
		return build.JSONSchema
	}
	return i
}

func isOpenAPI(v cue.Value) bool {
	s, _ := v.Lookup("openapi").String()
	if !strings.HasPrefix(s, "3.") {
		return false
	}
	if _, err := v.Lookup("info", "title").String(); err != nil {
		return false
	}
	if _, err := v.Lookup("info", "version").String(); err != nil {
		return false
	}
	return true
}

func isJSONSchema(v cue.Value) bool {
	s, err := v.Lookup("$schema").String()
	if err != nil {
		return false
	}
	u, err := url.Parse(s)
	if err != nil {
		return false
	}
	if u.Hostname() != "json-schema.org" {
		return false
	}
	if _, base := path.Split(u.EscapedPath()); base != "schema" {
		return false
	}
	return true
}
