// Copyright 2018 The CUE Authors
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

package template

import (
	"bytes"
	"text/template"

	"cuelang.org/go/cue"
)

// Execute executes a Go-style template.
func Execute(templ string, data cue.Value) (string, error) {
	t, err := template.New("").Parse(templ)
	if err != nil {
		return "", err
	}
	var x interface{}
	if err := data.Decode(&x); err != nil {
		return "", err
	}
	buf := &bytes.Buffer{}
	if err := t.Execute(buf, x); err != nil {
		return "", err
	}
	return buf.String(), nil
}
