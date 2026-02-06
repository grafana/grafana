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

// Package convert allows converting to and from Go values and Types.
package convert

import (
	"encoding"
	"encoding/json"
	"fmt"
	"math/big"
	"reflect"
	"sort"
	"strconv"
	"strings"

	"github.com/cockroachdb/apd/v2"
	"golang.org/x/text/encoding/unicode"

	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/ast/astutil"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/parser"
	"cuelang.org/go/cue/token"
	"cuelang.org/go/internal/core/adt"
	"cuelang.org/go/internal/core/compile"
	"cuelang.org/go/internal/types"
)

// This file contains functionality for converting Go to CUE.
//
// The code in this file is a prototype implementation and is far from
// optimized.

func GoValueToValue(ctx *adt.OpContext, x interface{}, nilIsTop bool) adt.Value {
	v := GoValueToExpr(ctx, nilIsTop, x)
	// TODO: return Value
	return toValue(v)
}

func GoTypeToExpr(ctx *adt.OpContext, x interface{}) (adt.Expr, errors.Error) {
	v := convertGoType(ctx, reflect.TypeOf(x))
	if err := ctx.Err(); err != nil {
		return v, err.Err
	}
	return v, nil
}

func toValue(e adt.Expr) adt.Value {
	if v, ok := e.(adt.Value); ok {
		return v
	}
	obj := &adt.Vertex{}
	obj.AddConjunct(adt.MakeRootConjunct(nil, e))
	return obj
}

func compileExpr(ctx *adt.OpContext, expr ast.Expr) adt.Value {
	c, err := compile.Expr(nil, ctx, pkgID(), expr)
	if err != nil {
		return &adt.Bottom{Err: errors.Promote(err, "compile")}
	}
	return adt.Resolve(ctx, c)
}

// parseTag parses a CUE expression from a cue tag.
func parseTag(ctx *adt.OpContext, obj *ast.StructLit, field, tag string) ast.Expr {
	if p := strings.Index(tag, ","); p >= 0 {
		tag = tag[:p]
	}
	if tag == "" {
		return topSentinel
	}
	expr, err := parser.ParseExpr("<field:>", tag)
	if err != nil {
		err := errors.Promote(err, "parser")
		ctx.AddErr(errors.Wrapf(err, ctx.Pos(),
			"invalid tag %q for field %q", tag, field))
		return &ast.BadExpr{}
	}
	return expr
}

// TODO: should we allow mapping names in cue tags? This only seems like a good
// idea if we ever want to allow mapping CUE to a different name than JSON.
var tagsWithNames = []string{"json", "yaml", "protobuf"}

func getName(f *reflect.StructField) string {
	name := f.Name
	if f.Anonymous {
		name = ""
	}
	for _, s := range tagsWithNames {
		if tag, ok := f.Tag.Lookup(s); ok {
			if p := strings.Index(tag, ","); p >= 0 {
				tag = tag[:p]
			}
			if tag != "" {
				name = tag
				break
			}
		}
	}
	return name
}

// isOptional indicates whether a field should be marked as optional.
func isOptional(f *reflect.StructField) bool {
	isOptional := false
	switch f.Type.Kind() {
	case reflect.Ptr, reflect.Map, reflect.Chan, reflect.Interface, reflect.Slice:
		// Note: it may be confusing to distinguish between an empty slice and
		// a nil slice. However, it is also surprising to not be able to specify
		// a default value for a slice. So for now we will allow it.
		isOptional = true
	}
	if tag, ok := f.Tag.Lookup("cue"); ok {
		// TODO: only if first field is not empty.
		isOptional = false
		for _, f := range strings.Split(tag, ",")[1:] {
			switch f {
			case "opt":
				isOptional = true
			case "req":
				return false
			}
		}
	} else if tag, ok = f.Tag.Lookup("json"); ok {
		isOptional = false
		for _, f := range strings.Split(tag, ",")[1:] {
			if f == "omitempty" {
				return true
			}
		}
	}
	return isOptional
}

// isOmitEmpty means that the zero value is interpreted as undefined.
func isOmitEmpty(f *reflect.StructField) bool {
	isOmitEmpty := false
	switch f.Type.Kind() {
	case reflect.Ptr, reflect.Map, reflect.Chan, reflect.Interface, reflect.Slice:
		// Note: it may be confusing to distinguish between an empty slice and
		// a nil slice. However, it is also surprising to not be able to specify
		// a default value for a slice. So for now we will allow it.
		isOmitEmpty = true

	default:
		// TODO: we can also infer omit empty if a type cannot be nil if there
		// is a constraint that unconditionally disallows the zero value.
	}
	tag, ok := f.Tag.Lookup("json")
	if ok {
		isOmitEmpty = false
		for _, f := range strings.Split(tag, ",")[1:] {
			if f == "omitempty" {
				return true
			}
		}
	}
	return isOmitEmpty
}

// parseJSON parses JSON into a CUE value. b must be valid JSON.
func parseJSON(ctx *adt.OpContext, b []byte) adt.Value {
	expr, err := parser.ParseExpr("json", b)
	if err != nil {
		panic(err) // cannot happen
	}
	return compileExpr(ctx, expr)
}

func isZero(v reflect.Value) bool {
	x := v.Interface()
	if x == nil {
		return true
	}
	switch k := v.Kind(); k {
	case reflect.Struct, reflect.Array:
		// we never allow optional values for these types.
		return false

	case reflect.Chan, reflect.Func, reflect.Interface, reflect.Map,
		reflect.Slice:
		// Note that for maps we preserve the distinction between a nil map and
		// an empty map.
		return v.IsNil()

	case reflect.String:
		return v.Len() == 0

	default:
		return x == reflect.Zero(v.Type()).Interface()
	}
}

func GoValueToExpr(ctx *adt.OpContext, nilIsTop bool, x interface{}) adt.Expr {
	e := convertRec(ctx, nilIsTop, x)
	if e == nil {
		return ctx.AddErrf("unsupported Go type (%T)", x)
	}
	return e
}

func isNil(x reflect.Value) bool {
	switch x.Kind() {
	// Only check for supported types; ignore func and chan.
	case reflect.Ptr, reflect.Map, reflect.Slice, reflect.Interface:
		return x.IsNil()
	}
	return false
}

func convertRec(ctx *adt.OpContext, nilIsTop bool, x interface{}) adt.Value {
	if t := (&types.Value{}); types.CastValue(t, x) {
		// TODO: panic if nto the same runtime.
		return t.V
	}
	src := ctx.Source()
	switch v := x.(type) {
	case nil:
		if nilIsTop {
			ident, _ := ctx.Source().(*ast.Ident)
			return &adt.Top{Src: ident}
		}
		return &adt.Null{Src: ctx.Source()}

	case *ast.File:
		x, err := compile.Files(nil, ctx, pkgID(), v)
		if err != nil {
			return &adt.Bottom{Err: errors.Promote(err, "compile")}
		}
		if len(x.Conjuncts) != 1 {
			panic("unexpected length")
		}
		return x

	case ast.Expr:
		return compileExpr(ctx, v)

	case *big.Int:
		return &adt.Num{Src: src, K: adt.IntKind, X: *apd.NewWithBigInt(v, 0)}

	case *big.Rat:
		// should we represent this as a binary operation?
		n := &adt.Num{Src: src, K: adt.IntKind}
		_, err := apd.BaseContext.Quo(&n.X, apd.NewWithBigInt(v.Num(), 0), apd.NewWithBigInt(v.Denom(), 0))
		if err != nil {
			return ctx.AddErrf("could not convert *big.Rat: %v", err)
		}
		if !v.IsInt() {
			n.K = adt.FloatKind
		}
		return n

	case *big.Float:
		n := &adt.Num{Src: src, K: adt.FloatKind}
		_, _, err := n.X.SetString(v.String())
		if err != nil {
			return ctx.AddErr(errors.Promote(err, "invalid float"))
		}
		return n

	case *apd.Decimal:
		// TODO: should we allow an "int" bit to be set here? It is a bit
		// tricky, as we would also need to pass down the result of rounding.
		// So more likely an API must return explicitly whether a value is
		// a float or an int after all.
		// The code to autodetect whether something is an integer can be done
		// with this:
		kind := adt.FloatKind
		var d apd.Decimal
		res, _ := apd.BaseContext.RoundToIntegralExact(&d, v)
		if !res.Inexact() {
			kind = adt.IntKind
		}
		n := &adt.Num{Src: ctx.Source(), K: kind}
		n.X = *v
		return n

	case json.Marshaler:
		b, err := v.MarshalJSON()
		if err != nil {
			return ctx.AddErr(errors.Promote(err, "json.Marshaler"))
		}

		return parseJSON(ctx, b)

	case encoding.TextMarshaler:
		b, err := v.MarshalText()
		if err != nil {
			return ctx.AddErr(errors.Promote(err, "encoding.TextMarshaler"))
		}
		b, err = json.Marshal(string(b))
		if err != nil {
			return ctx.AddErr(errors.Promote(err, "json"))
		}
		return parseJSON(ctx, b)

	case error:
		var errs errors.Error
		switch x := v.(type) {
		case errors.Error:
			errs = x
		default:
			errs = ctx.Newf("%s", x.Error())
		}
		return &adt.Bottom{Err: errs}
	case bool:
		return &adt.Bool{Src: ctx.Source(), B: v}
	case string:
		s, _ := unicode.UTF8.NewEncoder().String(v)
		return &adt.String{Src: ctx.Source(), Str: s}
	case []byte:
		return &adt.Bytes{Src: ctx.Source(), B: v}
	case int:
		return toInt(ctx, int64(v))
	case int8:
		return toInt(ctx, int64(v))
	case int16:
		return toInt(ctx, int64(v))
	case int32:
		return toInt(ctx, int64(v))
	case int64:
		return toInt(ctx, int64(v))
	case uint:
		return toUint(ctx, uint64(v))
	case uint8:
		return toUint(ctx, uint64(v))
	case uint16:
		return toUint(ctx, uint64(v))
	case uint32:
		return toUint(ctx, uint64(v))
	case uint64:
		return toUint(ctx, uint64(v))
	case uintptr:
		return toUint(ctx, uint64(v))
	case float64:
		n := &adt.Num{Src: src, K: adt.FloatKind}
		_, _, err := n.X.SetString(fmt.Sprint(v))
		if err != nil {
			return ctx.AddErr(errors.Promote(err, "invalid float"))
		}
		return n
	case float32:
		n := &adt.Num{Src: src, K: adt.FloatKind}
		_, _, err := n.X.SetString(fmt.Sprint(v))
		if err != nil {
			return ctx.AddErr(errors.Promote(err, "invalid float"))
		}
		return n

	case reflect.Value:
		if v.CanInterface() {
			return convertRec(ctx, nilIsTop, v.Interface())
		}

	default:
		value := reflect.ValueOf(v)
		switch value.Kind() {
		case reflect.Bool:
			return &adt.Bool{Src: ctx.Source(), B: value.Bool()}

		case reflect.String:
			str := value.String()
			str, _ = unicode.UTF8.NewEncoder().String(str)
			// TODO: here and above: allow to fail on invalid strings.
			// if !utf8.ValidString(str) {
			// 	return ctx.AddErrf("cannot convert result to string: invalid UTF-8")
			// }
			return &adt.String{Src: ctx.Source(), Str: str}

		case reflect.Int, reflect.Int8, reflect.Int16,
			reflect.Int32, reflect.Int64:
			return toInt(ctx, value.Int())

		case reflect.Uint, reflect.Uint8, reflect.Uint16,
			reflect.Uint32, reflect.Uint64, reflect.Uintptr:
			return toUint(ctx, value.Uint())

		case reflect.Float32, reflect.Float64:
			return convertRec(ctx, nilIsTop, value.Float())

		case reflect.Ptr:
			if value.IsNil() {
				if nilIsTop {
					ident, _ := ctx.Source().(*ast.Ident)
					return &adt.Top{Src: ident}
				}
				return &adt.Null{Src: ctx.Source()}
			}
			return convertRec(ctx, nilIsTop, value.Elem().Interface())

		case reflect.Struct:
			obj := &adt.StructLit{Src: src}
			v := &adt.Vertex{}
			env := ctx.Env(0)
			if env == nil {
				env = &adt.Environment{}
			}
			// There is no closedness or cycle info for Go structs, so we
			// pass an empty CloseInfo.
			v.AddStruct(obj, env, adt.CloseInfo{})
			v.SetValue(ctx, adt.Finalized, &adt.StructMarker{})

			t := value.Type()
			for i := 0; i < value.NumField(); i++ {
				sf := t.Field(i)
				if sf.PkgPath != "" {
					continue
				}
				val := value.Field(i)
				if !nilIsTop && isNil(val) {
					continue
				}
				if tag, _ := sf.Tag.Lookup("json"); tag == "-" {
					continue
				}
				if isOmitEmpty(&sf) && isZero(val) {
					continue
				}
				sub := convertRec(ctx, nilIsTop, val.Interface())
				if sub == nil {
					// mimic behavior of encoding/json: skip fields of unsupported types
					continue
				}
				if _, ok := sub.(*adt.Bottom); ok {
					return sub
				}

				// leave errors like we do during normal evaluation or do we
				// want to return the error?
				name := getName(&sf)
				if name == "-" {
					continue
				}
				if sf.Anonymous && name == "" {
					arc, ok := sub.(*adt.Vertex)
					if ok {
						v.Arcs = append(v.Arcs, arc.Arcs...)
					}
					continue
				}

				f := ctx.StringLabel(name)
				obj.Decls = append(obj.Decls, &adt.Field{Label: f, Value: sub})
				arc, ok := sub.(*adt.Vertex)
				if ok {
					a := *arc
					arc = &a
					arc.Label = f
				} else {
					arc = &adt.Vertex{Label: f, BaseValue: sub}
					arc.UpdateStatus(adt.Finalized)
					arc.AddConjunct(adt.MakeRootConjunct(nil, sub))
				}
				v.Arcs = append(v.Arcs, arc)
			}

			return v

		case reflect.Map:
			v := &adt.Vertex{BaseValue: &adt.StructMarker{}}
			v.SetValue(ctx, adt.Finalized, &adt.StructMarker{})

			t := value.Type()
			switch key := t.Key(); key.Kind() {
			default:
				if !key.Implements(textMarshaler) {
					return ctx.AddErrf("unsupported Go type for map key (%v)", key)
				}
				fallthrough
			case reflect.String,
				reflect.Int, reflect.Int8, reflect.Int16,
				reflect.Int32, reflect.Int64,
				reflect.Uint, reflect.Uint8, reflect.Uint16,
				reflect.Uint32, reflect.Uint64, reflect.Uintptr:

				keys := value.MapKeys()
				sort.Slice(keys, func(i, j int) bool {
					return fmt.Sprint(keys[i]) < fmt.Sprint(keys[j])
				})
				for _, k := range keys {
					val := value.MapIndex(k)
					// if isNil(val) {
					// 	continue
					// }

					sub := convertRec(ctx, nilIsTop, val.Interface())
					// mimic behavior of encoding/json: report error of
					// unsupported type.
					if sub == nil {
						return ctx.AddErrf("unsupported Go type (%T)", val.Interface())
					}
					if isBottom(sub) {
						return sub
					}

					s := fmt.Sprint(k)
					f := ctx.StringLabel(s)
					arc, ok := sub.(*adt.Vertex)
					if ok {
						a := *arc
						arc = &a
						arc.Label = f
					} else {
						arc = &adt.Vertex{Label: f, BaseValue: sub}
						arc.UpdateStatus(adt.Finalized)
						arc.AddConjunct(adt.MakeRootConjunct(nil, sub))
					}
					v.Arcs = append(v.Arcs, arc)
				}
			}

			return v

		case reflect.Slice, reflect.Array:
			var values []adt.Value

			for i := 0; i < value.Len(); i++ {
				val := value.Index(i)
				x := convertRec(ctx, nilIsTop, val.Interface())
				if x == nil {
					return ctx.AddErrf("unsupported Go type (%T)",
						val.Interface())
				}
				if isBottom(x) {
					return x
				}
				values = append(values, x)
			}

			return ctx.NewList(values...)
		}
	}
	return nil
}

func toInt(ctx *adt.OpContext, x int64) adt.Value {
	n := &adt.Num{Src: ctx.Source(), K: adt.IntKind}
	n.X = *apd.New(x, 0)
	return n
}

func toUint(ctx *adt.OpContext, x uint64) adt.Value {
	n := &adt.Num{Src: ctx.Source(), K: adt.IntKind}
	n.X.Coeff.SetUint64(x)
	return n
}

func convertGoType(ctx *adt.OpContext, t reflect.Type) adt.Expr {
	// TODO: this can be much more efficient.
	// TODO: synchronize
	return goTypeToValue(ctx, true, t)
}

var (
	jsonMarshaler = reflect.TypeOf(new(json.Marshaler)).Elem()
	textMarshaler = reflect.TypeOf(new(encoding.TextMarshaler)).Elem()
	topSentinel   = ast.NewIdent("_")
)

// goTypeToValue converts a Go Type to a value.
//
// TODO: if this value will always be unified with a concrete type in Go, then
// many of the fields may be omitted.
func goTypeToValue(ctx *adt.OpContext, allowNullDefault bool, t reflect.Type) adt.Expr {
	if _, t, ok := ctx.LoadType(t); ok {
		return t
	}

	_, v := goTypeToValueRec(ctx, allowNullDefault, t)
	if v == nil {
		return ctx.AddErrf("unsupported Go type (%v)", t)
	}
	return v
}

func goTypeToValueRec(ctx *adt.OpContext, allowNullDefault bool, t reflect.Type) (e ast.Expr, expr adt.Expr) {
	if src, t, ok := ctx.LoadType(t); ok {
		return src, t
	}

	switch reflect.Zero(t).Interface().(type) {
	case *big.Int, big.Int:
		e = ast.NewIdent("int")
		goto store

	case *big.Float, big.Float, *big.Rat, big.Rat:
		e = ast.NewIdent("number")
		goto store

	case *apd.Decimal, apd.Decimal:
		e = ast.NewIdent("number")
		goto store
	}

	// Even if this is for types that we know cast to a certain type, it can't
	// hurt to return top, as in these cases the concrete values will be
	// strict instances and there cannot be any tags that further constrain
	// the values.
	if t.Implements(jsonMarshaler) || t.Implements(textMarshaler) {
		return topSentinel, nil
	}

	switch k := t.Kind(); k {
	case reflect.Ptr:
		elem := t.Elem()
		for elem.Kind() == reflect.Ptr {
			elem = elem.Elem()
		}
		e, _ = goTypeToValueRec(ctx, false, elem)
		if allowNullDefault {
			e = wrapOrNull(e)
		}

	case reflect.Interface:
		switch t.Name() {
		case "error":
			// This is really null | _|_. There is no error if the error is null.
			e = ast.NewNull()
		default:
			e = topSentinel // `_`
		}

	case reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64,
		reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		e = compile.LookupRange(t.Kind().String()).Source().(ast.Expr)

	case reflect.Uint, reflect.Uintptr:
		e = compile.LookupRange("uint64").Source().(ast.Expr)

	case reflect.Int:
		e = compile.LookupRange("int64").Source().(ast.Expr)

	case reflect.String:
		e = ast.NewIdent("__string")

	case reflect.Bool:
		e = ast.NewIdent("__bool")

	case reflect.Float32, reflect.Float64:
		e = ast.NewIdent("__number")

	case reflect.Struct:
		obj := &ast.StructLit{}

		// TODO: dirty trick: set this to a temporary Vertex and then update the
		// arcs and conjuncts of this vertex below. This will allow circular
		// references. Maybe have a special kind of "hardlink" reference.
		ctx.StoreType(t, obj, nil)

		for i := 0; i < t.NumField(); i++ {
			f := t.Field(i)
			if f.PkgPath != "" {
				continue
			}
			_, ok := f.Tag.Lookup("cue")
			elem, _ := goTypeToValueRec(ctx, !ok, f.Type)
			if isBad(elem) {
				continue // Ignore fields for unsupported types
			}

			// leave errors like we do during normal evaluation or do we
			// want to return the error?
			name := getName(&f)
			if name == "-" {
				continue
			}

			if tag, ok := f.Tag.Lookup("cue"); ok {
				v := parseTag(ctx, obj, name, tag)
				if isBad(v) {
					return v, nil
				}
				elem = ast.NewBinExpr(token.AND, elem, v)
			}
			// TODO: if an identifier starts with __ (or otherwise is not a
			// valid CUE name), make it a string and create a map to a new
			// name for references.

			// The GO JSON decoder always allows a value to be undefined.
			d := &ast.Field{Label: ast.NewIdent(name), Value: elem}
			if isOptional(&f) {
				d.Optional = token.Blank.Pos()
			}
			obj.Elts = append(obj.Elts, d)
		}

		// TODO: should we validate references here? Can be done using
		// astutil.ToFile and astutil.Resolve.

		e = obj

	case reflect.Array, reflect.Slice:
		if t.Elem().Kind() == reflect.Uint8 {
			e = ast.NewIdent("__bytes")
		} else {
			elem, _ := goTypeToValueRec(ctx, allowNullDefault, t.Elem())
			if elem == nil {
				b := ctx.AddErrf("unsupported Go type (%v)", t.Elem())
				return &ast.BadExpr{}, b
			}

			if t.Kind() == reflect.Array {
				e = ast.NewBinExpr(token.MUL,
					ast.NewLit(token.INT, strconv.Itoa(t.Len())),
					ast.NewList(elem))
			} else {
				e = ast.NewList(&ast.Ellipsis{Type: elem})
			}
		}
		if k == reflect.Slice {
			e = wrapOrNull(e)
		}

	case reflect.Map:
		switch key := t.Key(); key.Kind() {
		case reflect.String, reflect.Int, reflect.Int8, reflect.Int16,
			reflect.Int32, reflect.Int64, reflect.Uint, reflect.Uint8,
			reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Uintptr:
		default:
			b := ctx.AddErrf("unsupported Go type for map key (%v)", key)
			return &ast.BadExpr{}, b
		}

		v, x := goTypeToValueRec(ctx, allowNullDefault, t.Elem())
		if v == nil {
			b := ctx.AddErrf("unsupported Go type (%v)", t.Elem())
			return &ast.BadExpr{}, b
		}
		if isBad(v) {
			return v, x
		}

		e = ast.NewStruct(&ast.Field{
			Label: ast.NewList(ast.NewIdent("__string")),
			Value: v,
		})

		e = wrapOrNull(e)
	}

store:
	// TODO: store error if not nil?
	if e != nil {
		f := &ast.File{Decls: []ast.Decl{&ast.EmbedDecl{Expr: e}}}
		astutil.Resolve(f, func(_ token.Pos, msg string, args ...interface{}) {
			ctx.AddErrf(msg, args...)
		})
		var x adt.Expr
		c, err := compile.Expr(nil, ctx, pkgID(), e)
		if err != nil {
			b := &adt.Bottom{Err: err}
			ctx.AddBottom(b)
			x = b
		} else {
			x = c.Expr()
		}
		ctx.StoreType(t, e, x)
		return e, x
	}
	return e, nil
}

func isBottom(x adt.Node) bool {
	if x == nil {
		return true
	}
	b, _ := x.(*adt.Bottom)
	return b != nil
}

func isBad(x ast.Expr) bool {
	if x == nil {
		return true
	}
	if bad, _ := x.(*ast.BadExpr); bad != nil {
		return true
	}
	return false
}

func wrapOrNull(e ast.Expr) ast.Expr {
	switch x := e.(type) {
	case *ast.BasicLit:
		if x.Kind == token.NULL {
			return x
		}
	case *ast.BadExpr:
		return e
	}
	return makeNullable(e, true)
}

func makeNullable(e ast.Expr, nullIsDefault bool) ast.Expr {
	var null ast.Expr = ast.NewNull()
	if nullIsDefault {
		null = &ast.UnaryExpr{Op: token.MUL, X: null}
	}
	return ast.NewBinExpr(token.OR, null, e)
}

// pkgID returns a package path that can never resolve to an existing package.
func pkgID() string {
	return "_"
}
