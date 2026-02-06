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

// Package debug prints a given ADT node.
//
// Note that the result is not valid CUE, but instead prints the internals
// of an ADT node in human-readable form. It uses a simple indentation algorithm
// for improved readability and diffing.
package debug

import (
	"fmt"

	"cuelang.org/go/cue/literal"
	"cuelang.org/go/internal/core/adt"
)

type compactPrinter struct {
	printer
}

func (w *compactPrinter) node(n adt.Node) {
	switch x := n.(type) {
	case *adt.Vertex:
		if x.BaseValue == nil || (w.cfg.Raw && !x.IsData()) {
			for i, c := range x.Conjuncts {
				if i > 0 {
					w.string(" & ")
				}
				w.node(c.Elem())
			}
			return
		}

		switch v := x.BaseValue.(type) {
		case *adt.StructMarker:
			w.string("{")
			for i, a := range x.Arcs {
				if i > 0 {
					w.string(",")
				}
				if a.Label.IsLet() {
					w.string("let ")
					w.label(a.Label)
					if a.MultiLet {
						w.string("m")
					}
					w.string("=")
					if c := a.Conjuncts[0]; a.MultiLet {
						w.node(c.Expr())
						continue
					}
					w.node(a)
				} else {
					w.label(a.Label)
					w.string(":")
					w.node(a)
				}
			}
			w.string("}")

		case *adt.ListMarker:
			w.string("[")
			for i, a := range x.Arcs {
				if i > 0 {
					w.string(",")
				}
				w.node(a)
			}
			w.string("]")

		case adt.Value:
			w.node(v)
		}

	case *adt.StructMarker:
		w.string("struct")

	case *adt.ListMarker:
		w.string("list")

	case *adt.StructLit:
		w.string("{")
		for i, d := range x.Decls {
			if i > 0 {
				w.string(",")
			}
			w.node(d)
		}
		w.string("}")

	case *adt.ListLit:
		w.string("[")
		for i, d := range x.Elems {
			if i > 0 {
				w.string(",")
			}
			w.node(d)
		}
		w.string("]")

	case *adt.Field:
		s := w.labelString(x.Label)
		w.string(s)
		w.string(":")
		w.node(x.Value)

	case *adt.OptionalField:
		s := w.labelString(x.Label)
		w.string(s)
		w.string("?:")
		w.node(x.Value)

	case *adt.LetField:
		w.string("let ")
		s := w.labelString(x.Label)
		w.string(s)
		if x.IsMulti {
			w.string("m")
		}
		w.string("=")
		w.node(x.Value)

	case *adt.BulkOptionalField:
		w.string("[")
		w.node(x.Filter)
		w.string("]:")
		w.node(x.Value)

	case *adt.DynamicField:
		w.node(x.Key)
		if x.IsOptional() {
			w.string("?")
		}
		w.string(":")
		w.node(x.Value)

	case *adt.Ellipsis:
		w.string("...")
		if x.Value != nil {
			w.node(x.Value)
		}

	case *adt.Bottom:
		w.string(`_|_`)
		if x.Err != nil {
			w.string("(")
			w.string(x.Err.Error())
			w.string(")")
		}

	case *adt.Null:
		w.string("null")

	case *adt.Bool:
		fmt.Fprint(w, x.B)

	case *adt.Num:
		fmt.Fprint(w, &x.X)

	case *adt.String:
		w.string(literal.String.Quote(x.Str))

	case *adt.Bytes:
		w.string(literal.Bytes.Quote(string(x.B)))

	case *adt.Top:
		w.string("_")

	case *adt.BasicType:
		fmt.Fprint(w, x.K)

	case *adt.BoundExpr:
		fmt.Fprint(w, x.Op)
		w.node(x.Expr)

	case *adt.BoundValue:
		fmt.Fprint(w, x.Op)
		w.node(x.Value)

	case *adt.NodeLink:
		w.string(openTuple)
		for i, f := range x.Node.Path() {
			if i > 0 {
				w.string(".")
			}
			w.label(f)
		}
		w.string(closeTuple)

	case *adt.FieldReference:
		w.label(x.Label)

	case *adt.ValueReference:
		w.label(x.Label)

	case *adt.LabelReference:
		if x.Src == nil {
			w.string("LABEL")
		} else {
			w.string(x.Src.Name)
		}

	case *adt.DynamicReference:
		w.node(x.Label)

	case *adt.ImportReference:
		w.label(x.ImportPath)

	case *adt.LetReference:
		w.ident(x.Label)

	case *adt.SelectorExpr:
		w.node(x.X)
		w.string(".")
		w.label(x.Sel)

	case *adt.IndexExpr:
		w.node(x.X)
		w.string("[")
		w.node(x.Index)
		w.string("]")

	case *adt.SliceExpr:
		w.node(x.X)
		w.string("[")
		if x.Lo != nil {
			w.node(x.Lo)
		}
		w.string(":")
		if x.Hi != nil {
			w.node(x.Hi)
		}
		if x.Stride != nil {
			w.string(":")
			w.node(x.Stride)
		}
		w.string("]")

	case *adt.Interpolation:
		w.interpolation(x)

	case *adt.UnaryExpr:
		fmt.Fprint(w, x.Op)
		w.node(x.X)

	case *adt.BinaryExpr:
		w.string("(")
		w.node(x.X)
		fmt.Fprint(w, " ", x.Op, " ")
		w.node(x.Y)
		w.string(")")

	case *adt.CallExpr:
		w.node(x.Fun)
		w.string("(")
		for i, a := range x.Args {
			if i > 0 {
				w.string(", ")
			}
			w.node(a)
		}
		w.string(")")

	case *adt.Builtin:
		if x.Package != 0 {
			w.label(x.Package)
			w.string(".")
		}
		w.string(x.Name)

	case *adt.BuiltinValidator:
		w.node(x.Builtin)
		w.string("(")
		for i, a := range x.Args {
			if i > 0 {
				w.string(", ")
			}
			w.node(a)
		}
		w.string(")")

	case *adt.DisjunctionExpr:
		w.string("(")
		for i, a := range x.Values {
			if i > 0 {
				w.string("|")
			}
			// Disjunct
			if a.Default {
				w.string("*")
			}
			w.node(a.Val)
		}
		w.string(")")

	case *adt.Conjunction:
		for i, c := range x.Values {
			if i > 0 {
				w.string(" & ")
			}
			w.node(c)
		}

	case *adt.Disjunction:
		for i, c := range x.Values {
			if i > 0 {
				w.string(" | ")
			}
			if i < x.NumDefaults {
				w.string("*")
			}
			w.node(c)
		}

	case *adt.Comprehension:
		for _, c := range x.Clauses {
			w.node(c)
		}
		w.node(adt.ToExpr(x.Value))

	case *adt.ForClause:
		w.string("for ")
		w.ident(x.Key)
		w.string(", ")
		w.ident(x.Value)
		w.string(" in ")
		w.node(x.Src)
		w.string(" ")

	case *adt.IfClause:
		w.string("if ")
		w.node(x.Condition)
		w.string(" ")

	case *adt.LetClause:
		w.string("let ")
		w.ident(x.Label)
		w.string(" = ")
		w.node(x.Expr)
		w.string(" ")

	case *adt.ValueClause:

	default:
		panic(fmt.Sprintf("unknown type %T", x))
	}
}
