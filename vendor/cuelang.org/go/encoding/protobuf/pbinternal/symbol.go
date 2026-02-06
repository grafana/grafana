// Copyright 2021 CUE Authors
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

package pbinternal

import (
	"strconv"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/token"
)

// MatchBySymbol finds an integer value for a given symbol name, representing
// an enum value, and sets it in x.
func MatchBySymbol(v cue.Value, name string, x *ast.BasicLit) bool {
	if op, a := v.Expr(); op == cue.AndOp {
		for _, v := range a {
			if MatchBySymbol(v, name, x) {
				return true
			}
		}
	}
	return matchBySymbol(cue.Dereference(v), name, x)
}

func matchBySymbol(v cue.Value, name string, x *ast.BasicLit) bool {
	switch op, a := v.Expr(); op {
	case cue.OrOp, cue.AndOp:
		for _, v := range a {
			if matchBySymbol(v, name, x) {
				return true
			}
		}

	default:
		_, path := v.ReferencePath()

		a := path.Selectors()
		if len(a) == 0 {
			break
		}
		if s := a[len(a)-1]; !s.IsDefinition() || s.String()[1:] != name {
			break
		}

		if i, err := v.Int64(); err == nil {
			x.Kind = token.INT
			x.Value = strconv.Itoa(int(i))
			return true
		}
	}

	return false
}

// MatchByInt finds a symbol for a given enum value and sets it in x.
func MatchByInt(v cue.Value, val int64) string {
	if op, a := v.Expr(); op == cue.AndOp {
		for _, v := range a {
			if s := MatchByInt(v, val); s != "" {
				return s
			}
		}
	}
	v = cue.Dereference(v)
	return matchByInt(v, val)
}

func matchByInt(v cue.Value, val int64) string {
	switch op, a := v.Expr(); op {
	case cue.OrOp, cue.AndOp:
		for _, v := range a {
			if s := matchByInt(v, val); s != "" {
				return s
			}
		}

	default:
		if i, err := v.Int64(); err != nil || i != val {
			break
		}

		_, path := v.ReferencePath()
		a := path.Selectors()
		if len(a) == 0 {
			break
		}

		sel := a[len(a)-1]
		if !sel.IsDefinition() {
			break
		}

		return sel.String()[1:]
	}

	return ""
}
