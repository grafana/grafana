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

package jsonpb

import (
	"strconv"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/literal"
	"cuelang.org/go/cue/token"
	"cuelang.org/go/encoding/protobuf/pbinternal"
)

// TODO: Options:
// - Convert integer strings.
// - URL encoder
// - URL decoder

// An Encoder rewrites CUE values according to the Protobuf to JSON mappings,
// based on a given CUE schema.
//
// It bases the mapping on the underlying CUE type, without consulting Protobuf
// attributes.
//
// Mappings per CUE type:
//
//	for any CUE type:
//	int:       if the expression value is an integer and the schema value is
//	           an int64, it is converted to a string.
//	{}:        JSON objects representing any values will be left as is.
//	           If the CUE type corresponding to the URL can be determined within
//	           the module context it will be unified.
//	_:         Adds a `@type` URL (TODO).
type Encoder struct {
	schema cue.Value
}

// NewEncoder creates an Encoder for the given schema.
func NewEncoder(schema cue.Value, options ...Option) *Encoder {
	return &Encoder{schema: schema}
}

// RewriteFile modifies file, modifying it to conform to the Protocol buffer
// to JSON mapping it in terms of the given schema.
//
// RewriteFile is idempotent, calling it multiples times on an expression gives
// the same result.
func (e *Encoder) RewriteFile(file *ast.File) error {
	var enc encoder
	enc.rewriteDecls(e.schema, file.Decls)
	return enc.errs
}

// RewriteExpr modifies file, modifying it to conform to the Protocol buffer
// to JSON mapping it in terms of the given schema.
//
// RewriteExpr is idempotent, calling it multiples times on an expression gives
// the same result.
func (e *Encoder) RewriteExpr(expr ast.Expr) (ast.Expr, error) {
	var enc encoder
	x := enc.rewrite(e.schema, expr)
	return x, enc.errs
}

type encoder struct {
	errs errors.Error
}

func (e *encoder) addErr(err errors.Error) {
	e.errs = errors.Append(e.errs, err)
}

func (e *encoder) addErrf(p token.Pos, schema cue.Value, format string, args ...interface{}) {
	format = "%s: " + format
	args = append([]interface{}{schema.Path()}, args...)
	e.addErr(errors.Newf(p, format, args...))
}

func (e *encoder) rewriteDecls(schema cue.Value, decls []ast.Decl) {
	for _, f := range decls {
		field, ok := f.(*ast.Field)
		if !ok {
			continue
		}
		sel := cue.Label(field.Label)
		if !sel.IsString() {
			continue
		}

		v := schema.LookupPath(cue.MakePath(sel.Optional()))
		if !v.Exists() {
			continue
		}

		field.Value = e.rewrite(v, field.Value)
	}
}

func (e *encoder) rewrite(schema cue.Value, expr ast.Expr) (x ast.Expr) {
	switch x := expr.(type) {
	case *ast.ListLit:
		for i, elem := range x.Elts {
			v := schema.LookupPath(cue.MakePath(cue.Index(i).Optional()))
			if !v.Exists() {
				break
			}
			x.Elts[i] = e.rewrite(v, elem)
		}
		return expr

	case *ast.StructLit:
		e.rewriteDecls(schema, x.Elts)
		return expr

	case *ast.BasicLit:
		if x.Kind != token.INT {
			break
		}

		info, err := pbinternal.FromValue("", schema)
		if err != nil {
			break
		}

		switch info.Type {
		case "int64", "fixed64", "sfixed64", "uint64":
			b, ok := expr.(*ast.BasicLit)
			if schema.IncompleteKind() == cue.IntKind && ok && b.Kind == token.INT {
				b.Kind = token.STRING
				b.Value = literal.String.Quote(b.Value)
			}

		case "int32", "fixed32", "sfixed32", "uint32", "float", "double":
		case "varint":

		default:
			if !info.IsEnum {
				break
			}

			i, err := strconv.ParseInt(x.Value, 10, 32)
			if err != nil {
				break
			}

			if s := pbinternal.MatchByInt(schema, i); s != "" {
				x.Kind = token.STRING
				x.Value = literal.String.Quote(s)
			}
		}
	}

	return expr
}
