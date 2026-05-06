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

package cue

import (
	"bytes"
	"fmt"
	"math/big"

	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/format"
	"cuelang.org/go/internal/core/export"
)

// TODO:
// * allow '-' to strip outer curly braces?
//     -    simplify output; can be used in combination with other flags
// * advertise:
//     c    like v, but print comments
//     a    like c, but print attributes and package-local hidden fields as well

// Format prints a CUE value.
//
// WARNING: although we are narrowing down the semantics, the verbs and options
// are still subject to change. this API is experimental although it is likely
// getting close to the final design.
//
// It recognizes the following verbs:
//
//	v    print CUE value
//
// The verbs support the following flags:
//
//	#    print as schema and include definitions.
//	     The result is printed as a self-contained file, instead of an the
//	     expression format.
//	+    evaluate: resolve defaults and error on incomplete errors
//
// Indentation can be controlled as follows:
//
//	width      indent the cue block by <width> tab stops (e.g. %2v)
//	precision  convert tabs to <precision> spaces (e.g. %.2v), where
//	           a value of 0 means no indentation or newlines (TODO).
//
// If the value kind corresponds to one of the following Go types, the
// usual Go formatting verbs for that type can be used:
//
//	Int:          b,d,o,O,q,x,X
//	Float:        f,e,E,g,G
//	String/Bytes: s,q,x,X
//
// The %v directive will be used if the type is not supported for that verb.
func (v Value) Format(state fmt.State, verb rune) {
	if v.v == nil {
		fmt.Fprint(state, "<nil>")
		return
	}

	switch verb {
	case 'a':
		formatCUE(state, v, true, true)
	case 'c':
		formatCUE(state, v, true, false)
	case 'v':
		formatCUE(state, v, false, false)

	case 'd', 'o', 'O', 'U':
		var i big.Int
		if _, err := v.Int(&i); err != nil {
			formatCUE(state, v, false, false)
			return
		}
		i.Format(state, verb)

	case 'f', 'e', 'E', 'g', 'G':
		d, err := v.Decimal()
		if err != nil {
			formatCUE(state, v, false, false)
			return
		}
		d.Format(state, verb)

	case 's', 'q':
		// TODO: this drops other formatting directives
		msg := "%s"
		if verb == 'q' {
			msg = "%q"
		}

		if b, err := v.Bytes(); err == nil {
			fmt.Fprintf(state, msg, b)
		} else {
			s := fmt.Sprintf("%+v", v)
			fmt.Fprintf(state, msg, s)
		}

	case 'x', 'X':
		switch v.Kind() {
		case StringKind, BytesKind:
			b, _ := v.Bytes()
			// TODO: this drops other formatting directives
			msg := "%x"
			if verb == 'X' {
				msg = "%X"
			}
			fmt.Fprintf(state, msg, b)

		case IntKind, NumberKind:
			var i big.Int
			_, _ = v.Int(&i)
			i.Format(state, verb)

		case FloatKind:
			dec, _ := v.Decimal()
			dec.Format(state, verb)

		default:
			formatCUE(state, v, false, false)
		}

	default:
		formatCUE(state, v, false, false)
	}
}

func formatCUE(state fmt.State, v Value, showDocs, showAll bool) {

	pkgPath := v.instance().ID()

	p := *export.Simplified

	isDef := false
	switch {
	case state.Flag('#'):
		isDef = true
		p = export.Profile{
			ShowOptional:    true,
			ShowDefinitions: true,
			ShowHidden:      true,
		}

	case state.Flag('+'):
		p = *export.Final
		fallthrough

	default:
		p.ShowHidden = showAll
	}

	p.ShowDocs = showDocs
	p.ShowAttributes = showAll

	var n ast.Node
	if isDef {
		n, _ = p.Def(v.idx, pkgPath, v.v)
	} else {
		n, _ = p.Value(v.idx, pkgPath, v.v)
	}

	formatExpr(state, n)
}

func formatExpr(state fmt.State, n ast.Node) {
	opts := make([]format.Option, 0, 3)
	if state.Flag('-') {
		opts = append(opts, format.Simplify())
	}
	// TODO: handle verbs to allow formatting based on type:
	if width, ok := state.Width(); ok {
		opts = append(opts, format.IndentPrefix(width))
	}
	// TODO: consider this: should tabs or spaces be the default?
	if tabwidth, ok := state.Precision(); ok {
		// TODO: 0 means no newlines.
		opts = append(opts,
			format.UseSpaces(tabwidth),
			format.TabIndent(false))
	}
	// TODO: consider this.
	//  else if state.Flag(' ') {
	// 	opts = append(opts,
	// 		format.UseSpaces(4),
	// 		format.TabIndent(false))
	// }

	b, _ := format.Node(n, opts...)
	b = bytes.Trim(b, "\n\r")
	_, _ = state.Write(b)
}
