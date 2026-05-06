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

package compile

import (
	"strings"

	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/token"
)

var _ errors.Error = &compilerError{}

type compilerError struct {
	n    ast.Node
	path []string
	errors.Message
}

func (e *compilerError) Position() token.Pos         { return e.n.Pos() }
func (e *compilerError) InputPositions() []token.Pos { return nil }
func (e *compilerError) Path() []string              { return e.path }
func (e *compilerError) Error() string {
	pos := e.n.Pos()
	// Import cycles deserve special treatment.
	if pos.IsValid() {
		// Omit import stack. The full path to the file where the error
		// is the most important thing.
		return pos.String() + ": " + e.Message.Error()
	}
	if len(e.path) == 0 {
		return e.Message.Error()
	}
	return strings.Join(e.path, ".") + ": " + e.Message.Error()
}
