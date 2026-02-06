// Copyright 2019 CUE Authors
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

package openapi

import (
	"cuelang.org/go/cue"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/token"
)

var _ errors.Error = &openapiError{}

// implements cue/Error
type openapiError struct {
	errors.Message
	path cue.Path
	pos  token.Pos
}

func (e *openapiError) Position() token.Pos {
	return e.pos
}

func (e *openapiError) InputPositions() []token.Pos {
	return nil
}

func (e *openapiError) Path() []string {
	return pathToStrings(e.path)
}

// pathToString is a utility function for creating debugging info.
func pathToStrings(p cue.Path) (a []string) {
	for _, sel := range p.Selectors() {
		a = append(a, sel.String())
	}
	return a
}
