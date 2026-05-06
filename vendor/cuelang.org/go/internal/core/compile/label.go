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
	"github.com/cockroachdb/apd/v2"
	"golang.org/x/text/unicode/norm"

	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/literal"
	"cuelang.org/go/cue/token"
	"cuelang.org/go/internal/core/adt"
)

// LabelFromNode converts an ADT node to a feature.
func (c *compiler) label(n ast.Node) adt.Feature {
	index := c.index
	switch x := n.(type) {
	case *ast.Ident:
		if x.Name == "_" {
			return adt.InvalidLabel
		}
		return adt.MakeIdentLabel(c.index, x.Name, c.pkgPath)

	case *ast.BasicLit:
		switch x.Kind {
		case token.STRING:
			const msg = "invalid string label: %v"
			s, err := literal.Unquote(x.Value)
			if err != nil {
				c.errf(n, msg, err)
				return adt.InvalidLabel
			}

			i := int64(index.StringToIndex(norm.NFC.String(s)))
			f, err := adt.MakeLabel(n, i, adt.StringLabel)
			if err != nil {
				c.errf(n, msg, err)
			}
			return f

		case token.INT:
			const msg = "invalid int label: %v"
			if err := literal.ParseNum(x.Value, &c.num); err != nil {
				c.errf(n, msg, err)
				return adt.InvalidLabel
			}

			var d apd.Decimal
			if err := c.num.Decimal(&d); err != nil {
				c.errf(n, msg, err)
				return adt.InvalidLabel
			}

			i, err := d.Int64()
			if err != nil {
				c.errf(n, msg, err)
				return adt.InvalidLabel
			}

			f, err := adt.MakeLabel(n, i, adt.IntLabel)
			if err != nil {
				c.errf(n, msg, err)
				return adt.InvalidLabel
			}
			return f

		case token.FLOAT:
			_ = c.errf(n, "float %s cannot be used as label", x.Value)
			return adt.InvalidLabel

		default: // keywords (null, true, false, for, in, if, let)
			i := index.StringToIndex(x.Kind.String())
			f, err := adt.MakeLabel(n, i, adt.StringLabel)
			if err != nil {
				c.errf(n, "invalid string label: %v", err)
			}
			return f
		}

	default:
		c.errf(n, "unsupported label node type %T", n)
		return adt.InvalidLabel
	}
}

// A labeler converts an AST node to a string representation.
type labeler interface {
	labelString() string
}

type fieldLabel ast.Field

func (l *fieldLabel) labelString() string {
	lab := l.Label

	if a, ok := lab.(*ast.Alias); ok {
		if x, _ := a.Expr.(ast.Label); x != nil {
			lab = x
		}
	}

	switch x := lab.(type) {
	case *ast.Ident:
		return x.Name

	case *ast.BasicLit:
		if x.Kind == token.STRING {
			s, err := literal.Unquote(x.Value)
			if err == nil && ast.IsValidIdent(s) {
				return s
			}
		}
		return x.Value

	case *ast.ListLit:
		return "[]" // TODO: more detail

	case *ast.Interpolation:
		return "?"
		// case *ast.ParenExpr:
	}
	return "<unknown>"
}

type forScope ast.ForClause

func (l *forScope) labelString() string {
	// TODO: include more info in square brackets.
	return "for[]"
}

type letScope ast.LetClause

func (l *letScope) labelString() string {
	// TODO: include more info in square brackets.
	return "let[]"
}
