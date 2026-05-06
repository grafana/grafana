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
	"encoding/base64"
	"strings"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/ast/astutil"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/literal"
	"cuelang.org/go/cue/token"
	"cuelang.org/go/encoding/protobuf/pbinternal"
	"github.com/cockroachdb/apd/v2"
)

// Option is an option.
//
// There are currently no options.
type Option func()

// A Decoder interprets CUE expressions as JSON protobuf encodings
// based on an underlying schema.
//
// It bases the mapping on the underlying CUE type, without consulting Protobuf
// attributes.
//
// Mappings per CUE type:
//
//	for any CUE type:
//	           null is omitted if null is not specifically allowed.
//	bytes:     if the expression is a string, it is reinterpreted using a
//	           base64 encoding. Either standard or URL-safe base64 encoding
//	           with/without paddings are accepted.
//	int:       string values are interpreted as integers
//	float:     string values are interpreted as numbers, and the values "NaN",
//	           "Infinity", and "-Infinity" are allowed and converted to
//	           to corresponding error values.
//	enums:     if a field is of type int and does not have a standard integer
//	           type for its @protobuf attribute, this is assumed to represent
//	           a protobuf enum value. Enum names are converted to integers
//	           by interpreting the definitions of the disjunction constants
//	           as the symbol names.
//	           If CUE uses the string representation for enums, then an
//	           #enumValue integer associated with the string value is used
//	           for the conversion.
//	{}:        JSON objects representing any values will be left as is.
//	           If the CUE type corresponding to the URL can be determined within
//	           the module context it will be unified.
//	time.Time / time.Duration:
//	           left as is
//	_:         left as is.
type Decoder struct {
	schema cue.Value
}

// NewDecoder creates a Decoder for the given schema.
func NewDecoder(schema cue.Value, options ...Option) *Decoder {
	return &Decoder{schema: schema}
}

// RewriteFile modifies file, interpreting it in terms of the given schema
// according to the protocol buffer to JSON mapping defined in the protocol
// buffer spec.
//
// RewriteFile is idempotent, calling it multiples times on an expression gives
// the same result.
func (d *Decoder) RewriteFile(file *ast.File) error {
	var r rewriter
	r.rewriteDecls(d.schema, file.Decls)
	return r.errs
}

// RewriteExpr modifies expr, interpreting it in terms of the given schema
// according to the protocol buffer to JSON mapping defined in the
// protocol buffer spec.
//
// RewriteExpr is idempotent, calling it multiples times on an expression gives
// the same result.
func (d *Decoder) RewriteExpr(expr ast.Expr) (ast.Expr, error) {
	var r rewriter
	x := r.rewrite(d.schema, expr)
	return x, r.errs
}

type rewriter struct {
	errs errors.Error
}

func (r *rewriter) addErr(err errors.Error) {
	r.errs = errors.Append(r.errs, err)
}

func (r *rewriter) addErrf(p token.Pos, schema cue.Value, format string, args ...interface{}) {
	format = "%s: " + format
	args = append([]interface{}{schema.Path()}, args...)
	r.addErr(errors.Newf(p, format, args...))
}

func (r *rewriter) rewriteDecls(schema cue.Value, decls []ast.Decl) {
	for _, f := range decls {
		field, ok := f.(*ast.Field)
		if !ok {
			continue
		}
		sel := cue.Label(field.Label)
		if !sel.IsString() {
			continue
		}

		v := schema.LookupPath(cue.MakePath(sel))
		if !v.Exists() {
			f := schema.Template()
			if f == nil {
				continue
			}
			v = f(sel.String())
		}
		if !v.Exists() {
			continue
		}

		field.Value = r.rewrite(v, field.Value)
	}
}

var enumValuePath = cue.ParsePath("#enumValue").Optional()

func (r *rewriter) rewrite(schema cue.Value, expr ast.Expr) (x ast.Expr) {
	defer func() {
		if expr != x && x != nil {
			astutil.CopyMeta(x, expr)
		}
	}()

	switch x := expr.(type) {
	case *ast.BasicLit:
		if x.Kind != token.NULL {
			break
		}
		if schema.IncompleteKind()&cue.NullKind != 0 {
			break
		}
		switch v, _ := schema.Default(); {
		case v.IsConcrete():
			if x, _ := v.Syntax(cue.Final()).(ast.Expr); x != nil {
				return x
			}
		default: // default value for type
			if x := zeroValue(schema, x); x != nil {
				return x
			}
		}

	case *ast.StructLit:
		r.rewriteDecls(schema, x.Elts)
		return x

	case *ast.ListLit:
		elem, _ := schema.Elem()
		iter, _ := schema.List()
		for i, e := range x.Elts {
			v := elem
			if iter.Next() {
				v = iter.Value()
			}
			if !v.Exists() {
				break
			}
			x.Elts[i] = r.rewrite(v, e)
		}

		return x
	}

	switch schema.IncompleteKind() {
	case cue.IntKind, cue.FloatKind, cue.NumberKind:
		x, q, str := stringValue(expr)
		if x == nil || !q.IsDouble() {
			break
		}

		var info literal.NumInfo
		if err := literal.ParseNum(str, &info); err == nil {
			x.Value = str
			x.Kind = token.FLOAT
			if info.IsInt() {
				x.Kind = token.INT
			}
			break
		}

		pbinternal.MatchBySymbol(schema, str, x)

	case cue.BytesKind:
		x, q, str := stringValue(expr)
		if x == nil && q.IsDouble() {
			break
		}

		var b []byte
		var err error
		for _, enc := range base64Encodings {
			if b, err = enc.DecodeString(str); err == nil {
				break
			}
		}
		if err != nil {
			r.addErrf(expr.Pos(), schema, "failed to decode base64: %v", err)
			return expr
		}

		quoter := literal.Bytes
		if q.IsMulti() {
			ws := q.Whitespace()
			tabs := (strings.Count(ws, " ")+3)/4 + strings.Count(ws, "\t")
			quoter = quoter.WithTabIndent(tabs)
		}
		x.Value = quoter.Quote(string(b))
		return x

	case cue.StringKind:
		if s, ok := expr.(*ast.BasicLit); ok && s.Kind == token.INT {
			var info literal.NumInfo
			if err := literal.ParseNum(s.Value, &info); err != nil || !info.IsInt() {
				break
			}
			var d apd.Decimal
			if err := info.Decimal(&d); err != nil {
				break
			}
			enum, err := d.Int64()
			if err != nil {
				r.addErrf(expr.Pos(), schema, "invalid enum index: %v", err)
				return expr
			}
			op, values := schema.Expr()
			if op != cue.OrOp {
				values = []cue.Value{schema} // allow single values.
			}
			for _, v := range values {
				i, err := v.LookupPath(enumValuePath).Int64()
				if err == nil && i == enum {
					str, err := v.String()
					if err != nil {
						r.addErr(errors.Wrapf(err, v.Pos(), "invalid string enum"))
						return expr
					}
					s.Kind = token.STRING
					s.Value = literal.String.Quote(str)

					return s
				}
			}
			r.addErrf(expr.Pos(), schema,
				"could not locate integer enum value %d", enum)
		}

	case cue.StructKind, cue.TopKind:
		// TODO: Detect and mix in type.
	}
	return expr
}

func zeroValue(v cue.Value, x *ast.BasicLit) ast.Expr {
	switch v.IncompleteKind() {
	case cue.StringKind:
		x.Kind = token.STRING
		x.Value = `""`

	case cue.BytesKind:
		x.Kind = token.STRING
		x.Value = `''`

	case cue.BoolKind:
		x.Kind = token.FALSE
		x.Value = "false"

	case cue.NumberKind, cue.IntKind, cue.FloatKind:
		x.Kind = token.INT
		x.Value = "0"

	case cue.StructKind:
		return ast.NewStruct()

	case cue.ListKind:
		return &ast.ListLit{}

	default:
		return nil
	}
	return x
}

func stringValue(x ast.Expr) (b *ast.BasicLit, q literal.QuoteInfo, str string) {
	b, ok := x.(*ast.BasicLit)
	if !ok || b.Kind != token.STRING {
		return nil, q, ""
	}
	q, p, _, err := literal.ParseQuotes(b.Value, b.Value)
	if err != nil {
		return nil, q, ""
	}

	str, err = q.Unquote(b.Value[p:])
	if err != nil {
		return nil, q, ""
	}

	return b, q, str
}

// These are all the allowed base64 encodings.
var base64Encodings = []base64.Encoding{
	*base64.StdEncoding,
	*base64.URLEncoding,
	*base64.RawStdEncoding,
	*base64.RawURLEncoding,
}
