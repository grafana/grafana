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

package json

import (
	"bytes"
	"encoding/json"
	"math/big"
	"strings"

	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/literal"
	"cuelang.org/go/cue/token"
	"cuelang.org/go/internal"
	"cuelang.org/go/internal/astinternal"
)

// Encode converts a CUE AST to JSON.
//
// The given file must only contain values that can be directly supported by
// JSON:
//
//	Type          Restrictions
//	BasicLit
//	File          no imports, aliases, or definitions
//	StructLit     no embeddings, aliases, or definitions
//	List
//	Field         must be regular; label must be a BasicLit or Ident
//
// Comments and attributes are ignored.
func Encode(n ast.Node) (b []byte, err error) {
	e := encoder{}
	err = e.encode(n)
	if err != nil {
		return nil, err
	}
	return e.w.Bytes(), nil
}

type encoder struct {
	w              bytes.Buffer
	tab            []byte
	indentsAtLevel []int
	indenting      bool
	unIndenting    int
}

func (e *encoder) writeIndent(b byte) {
	if e.indenting {
		e.indentsAtLevel[len(e.indentsAtLevel)-1]++
	} else {
		e.indentsAtLevel = append(e.indentsAtLevel, 0)
	}
	e.indenting = true
	_ = e.w.WriteByte(b)
}

func (e *encoder) writeUnindent(b byte, pos, def token.Pos) {
	if e.unIndenting > 0 {
		e.unIndenting--
	} else {
		e.unIndenting = e.indentsAtLevel[len(e.indentsAtLevel)-1]
		e.indentsAtLevel = e.indentsAtLevel[:len(e.indentsAtLevel)-1]
	}
	e.indenting = false
	e.ws(pos, def.RelPos())
	_ = e.w.WriteByte(b)
}

func (e *encoder) writeString(s string) {
	_, _ = e.w.WriteString(s)
	e.indenting = false
}

func (e *encoder) writeByte(b byte) {
	_ = e.w.WriteByte(b)
}

func (e *encoder) write(b []byte) {
	_, _ = e.w.Write(b)
	e.indenting = false
}

func (e *encoder) indent() {
	for range e.indentsAtLevel {
		e.write(e.tab)
	}
}

func (e *encoder) ws(pos token.Pos, default_ token.RelPos) {
	rel := pos.RelPos()
	if pos == token.NoPos {
		rel = default_
	}
	switch rel {
	case token.NoSpace:
	case token.Blank:
		e.writeByte(' ')
	case token.Newline:
		e.writeByte('\n')
		e.indent()
	case token.NewSection:
		e.writeString("\n\n")
		e.indent()
	}
}
func (e *encoder) encode(n ast.Node) error {
	if e.tab == nil {
		e.tab = []byte("    ")
	}
	const defPos = token.NoSpace
	switch x := n.(type) {
	case *ast.BasicLit:
		e.ws(x.Pos(), defPos)
		return e.encodeScalar(x, true)

	case *ast.ListLit:
		e.ws(foldNewline(x.Pos()), token.NoRelPos)
		if len(x.Elts) == 0 {
			e.writeString("[]")
			return nil
		}
		e.writeIndent('[')
		for i, x := range x.Elts {
			if i > 0 {
				e.writeString(",")
			}
			if err := e.encode(x); err != nil {
				return err
			}
		}
		e.writeUnindent(']', x.Rbrack, compactNewline(x.Elts[0].Pos()))
		return nil

	case *ast.StructLit:
		e.ws(foldNewline(n.Pos()), token.NoRelPos)
		return e.encodeDecls(x.Elts, x.Rbrace)

	case *ast.File:
		return e.encodeDecls(x.Decls, token.NoPos)

	case *ast.UnaryExpr:
		e.ws(foldNewline(x.Pos()), defPos)
		l, ok := x.X.(*ast.BasicLit)
		if ok && x.Op == token.SUB && (l.Kind == token.INT || l.Kind == token.FLOAT) {
			e.writeByte('-')
			return e.encodeScalar(l, false)
		}
	}
	return errors.Newf(n.Pos(), "json: unsupported node %s (%T)", astinternal.DebugStr(n), n)
}

func (e *encoder) encodeScalar(l *ast.BasicLit, allowMinus bool) error {
	switch l.Kind {
	case token.INT:
		var x big.Int
		return e.setNum(l, allowMinus, &x)

	case token.FLOAT:
		var x big.Float
		return e.setNum(l, allowMinus, &x)

	case token.TRUE:
		e.writeString("true")

	case token.FALSE:
		e.writeString("false")

	case token.NULL:
		e.writeString("null")

	case token.STRING:
		str, err := literal.Unquote(l.Value)
		if err != nil {
			return err
		}
		b, err := json.Marshal(str)
		if err != nil {
			return err
		}
		e.write(b)

	default:
		return errors.Newf(l.Pos(), "unknown literal type %v", l.Kind)
	}
	return nil
}

func (e *encoder) setNum(l *ast.BasicLit, allowMinus bool, x interface{}) error {
	if !allowMinus && strings.HasPrefix(l.Value, "-") {
		return errors.Newf(l.Pos(), "double minus not allowed")
	}
	var ni literal.NumInfo
	if err := literal.ParseNum(l.Value, &ni); err != nil {
		return err
	}
	e.writeString(ni.String())
	return nil
}

// encodeDecls converts a sequence of declarations to a value. If it encounters
// an embedded value, it will return this expression. This is more relaxed for
// structs than is currently allowed for CUE, but the expectation is that this
// will be allowed at some point. The input would still be illegal CUE.
func (e *encoder) encodeDecls(decls []ast.Decl, endPos token.Pos) error {
	var embed ast.Expr
	var fields []*ast.Field

	for _, d := range decls {
		switch x := d.(type) {
		default:
			return errors.Newf(x.Pos(), "json: unsupported node %s (%T)", astinternal.DebugStr(x), x)

		case *ast.Package:
			if embed != nil || fields != nil {
				return errors.Newf(x.Pos(), "invalid package clause")
			}
			continue

		case *ast.Field:
			if !internal.IsRegularField(x) {
				return errors.Newf(x.TokenPos, "json: definition or hidden field not allowed")
			}
			if x.Optional != token.NoPos {
				return errors.Newf(x.Optional, "json: optional fields not allowed")
			}
			fields = append(fields, x)

		case *ast.EmbedDecl:
			if embed != nil {
				return errors.Newf(x.Pos(), "json: multiple embedded values")
			}
			embed = x.Expr

		case *ast.CommentGroup:
		}
	}

	if embed != nil {
		if fields != nil {
			return errors.Newf(embed.Pos(), "json: embedding mixed with fields")
		}
		return e.encode(embed)
	}

	if len(fields) == 0 {
		e.writeString("{}")
		return nil
	}

	e.writeIndent('{')
	pos := compactNewline(fields[0].Pos())
	if endPos == token.NoPos && pos.RelPos() == token.Blank {
		pos = token.NoPos
	}
	firstPos := pos
	const defPos = token.NoRelPos
	for i, x := range fields {
		if i > 0 {
			e.writeByte(',')
			pos = x.Pos()
		}
		name, _, err := ast.LabelName(x.Label)
		if err != nil {
			return errors.Newf(x.Label.Pos(), "json: only literal labels allowed")
		}
		b, err := json.Marshal(name)
		if err != nil {
			return err
		}
		e.ws(pos, defPos)
		e.write(b)
		e.writeByte(':')

		if err := e.encode(x.Value); err != nil {
			return err
		}
	}
	e.writeUnindent('}', endPos, firstPos)
	return nil
}

func compactNewline(pos token.Pos) token.Pos {
	if pos.RelPos() == token.NewSection {
		pos = token.Newline.Pos()
	}
	return pos
}

func foldNewline(pos token.Pos) token.Pos {
	if pos.RelPos() >= token.Newline {
		pos = token.Blank.Pos()
	}
	return pos
}
