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

package jsonschema

import (
	"fmt"
	"math/big"
	"path"
	"regexp"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/token"
	"cuelang.org/go/internal"
)

// TODO: skip invalid regexps containing ?! and foes.
// alternatively, fall back to  https://github.com/dlclark/regexp2

type constraint struct {
	key string

	// phase indicates on which pass c constraint should be added. This ensures
	// that constraints are applied in the correct order. For instance, the
	// "required" constraint validates that a listed field is contained in
	// "properties". For this to work, "properties" must be processed before
	// "required" and thus must have a lower phase number than the latter.
	phase int

	// Indicates the draft number in which this constraint is defined.
	draft int
	fn    constraintFunc
}

// A constraintFunc converts a given JSON Schema constraint (specified in n)
// to a CUE constraint recorded in state.
type constraintFunc func(n cue.Value, s *state)

func p0(name string, f constraintFunc) *constraint {
	return &constraint{key: name, fn: f}
}

func p1d(name string, draft int, f constraintFunc) *constraint {
	return &constraint{key: name, phase: 1, draft: draft, fn: f}
}

func p1(name string, f constraintFunc) *constraint {
	return &constraint{key: name, phase: 1, fn: f}
}

func p2(name string, f constraintFunc) *constraint {
	return &constraint{key: name, phase: 2, fn: f}
}

func p3(name string, f constraintFunc) *constraint {
	return &constraint{key: name, phase: 3, fn: f}
}

// TODO:
// writeOnly, readOnly

var constraintMap = map[string]*constraint{}

func init() {
	for _, c := range constraints {
		constraintMap[c.key] = c
	}
}

func addDefinitions(n cue.Value, s *state) {
	if n.Kind() != cue.StructKind {
		s.errf(n, `"definitions" expected an object, found %s`, n.Kind())
	}

	old := s.isSchema
	s.isSchema = true
	defer func() { s.isSchema = old }()

	s.processMap(n, func(key string, n cue.Value) {
		name := key

		var f *ast.Field

		ident := "#" + name
		if ast.IsValidIdent(ident) {
			f = &ast.Field{Value: s.schema(n, label{ident, true})}
			f.Label = ast.NewIdent(ident)
		} else {
			f = &ast.Field{Value: s.schema(n, label{"#", true}, label{name: name})}
			f.Label = ast.NewString(name)
			ident = "#"
			f = &ast.Field{
				Label: ast.NewIdent("#"),
				Value: ast.NewStruct(f),
			}
		}

		ast.SetRelPos(f, token.NewSection)
		s.definitions = append(s.definitions, f)
		s.setField(label{name: ident, isDef: true}, f)
	})
}

var constraints = []*constraint{
	// Meta data.

	p0("$schema", func(n cue.Value, s *state) {
		// Identifies this as a JSON schema and specifies its version.
		// TODO: extract version.
		s.jsonschema, _ = s.strValue(n)
	}),

	p0("$id", func(n cue.Value, s *state) {
		// URL: https://domain.com/schemas/foo.json
		// anchors: #identifier
		//
		// TODO: mark identifiers.

		// Resolution must be relative to parent $id
		// https://tools.ietf.org/html/draft-handrews-json-schema-02#section-8.2.2
		u := s.resolveURI(n)
		if u == nil {
			return
		}

		if u.Fragment != "" {
			if s.cfg.Strict {
				s.errf(n, "$id URI may not contain a fragment")
			}
			return
		}
		s.id = u

		obj := s.object(n)

		// TODO: handle the case where this is always defined and we don't want
		// to include the default value.
		obj.Elts = append(obj.Elts, &ast.Attribute{
			Text: fmt.Sprintf("@jsonschema(id=%q)", u)})
	}),

	// Generic constraint

	p1("type", func(n cue.Value, s *state) {
		var types cue.Kind
		set := func(n cue.Value) {
			str, ok := s.strValue(n)
			if !ok {
				s.errf(n, "type value should be a string")
			}
			switch str {
			case "null":
				types |= cue.NullKind
				s.setTypeUsed(n, nullType)
				// TODO: handle OpenAPI restrictions.
			case "boolean":
				types |= cue.BoolKind
				s.setTypeUsed(n, boolType)
			case "string":
				types |= cue.StringKind
				s.setTypeUsed(n, stringType)
			case "number":
				types |= cue.NumberKind
				s.setTypeUsed(n, numType)
			case "integer":
				types |= cue.IntKind
				s.setTypeUsed(n, numType)
				s.add(n, numType, ast.NewIdent("int"))
			case "array":
				types |= cue.ListKind
				s.setTypeUsed(n, arrayType)
			case "object":
				types |= cue.StructKind
				s.setTypeUsed(n, objectType)

			default:
				s.errf(n, "unknown type %q", n)
			}
		}

		switch n.Kind() {
		case cue.StringKind:
			set(n)
		case cue.ListKind:
			for i, _ := n.List(); i.Next(); {
				set(i.Value())
			}
		default:
			s.errf(n, `value of "type" must be a string or list of strings`)
		}

		s.allowedTypes &= types
	}),

	p1("enum", func(n cue.Value, s *state) {
		var a []ast.Expr
		for _, x := range s.listItems("enum", n, true) {
			a = append(a, s.value(x))
		}
		s.all.add(n, ast.NewBinExpr(token.OR, a...))
	}),

	// TODO: only allow for OpenAPI.
	p1("nullable", func(n cue.Value, s *state) {
		null := ast.NewNull()
		setPos(null, n)
		s.nullable = null
	}),

	p1d("const", 6, func(n cue.Value, s *state) {
		s.all.add(n, s.value(n))
	}),

	p1("default", func(n cue.Value, s *state) {
		sc := *s
		s.default_ = sc.value(n)
		// TODO: must validate that the default is subsumed by the normal value,
		// as CUE will otherwise broaden the accepted values with the default.
		s.examples = append(s.examples, s.default_)
	}),

	p1("deprecated", func(n cue.Value, s *state) {
		if s.boolValue(n) {
			s.deprecated = true
		}
	}),

	p1("examples", func(n cue.Value, s *state) {
		if n.Kind() != cue.ListKind {
			s.errf(n, `value of "examples" must be an array, found %v`, n.Kind)
		}
		// TODO: implement examples properly.
		// for _, n := range s.listItems("examples", n, true) {
		// 	if ex := s.value(n); !isAny(ex) {
		// 		s.examples = append(s.examples, ex)
		// 	}
		// }
	}),

	p1("description", func(n cue.Value, s *state) {
		s.description, _ = s.strValue(n)
	}),

	p1("title", func(n cue.Value, s *state) {
		s.title, _ = s.strValue(n)
	}),

	p1d("$comment", 7, func(n cue.Value, s *state) {
	}),

	p1("$defs", addDefinitions),
	p1("definitions", addDefinitions),
	p1("$ref", func(n cue.Value, s *state) {
		s.usedTypes = allTypes

		u := s.resolveURI(n)

		if u.Fragment != "" && !path.IsAbs(u.Fragment) {
			s.addErr(errors.Newf(n.Pos(), "anchors (%s) not supported", u.Fragment))
			// TODO: support anchors
			return
		}

		expr := s.makeCUERef(n, u)

		if expr == nil {
			expr = &ast.BadExpr{From: n.Pos()}
		}

		s.all.add(n, expr)
	}),

	// Combinators

	// TODO: work this out in more detail: oneOf and anyOf below have the same
	// implementation in CUE. The distinction is that for anyOf a result is
	// allowed to be ambiguous at the end, whereas for oneOf a disjunction must
	// be fully resolved. There is currently no easy way to set this distinction
	// in CUE.
	//
	// One could correctly write oneOf like this once 'not' is implemented:
	//
	//   oneOf(a, b, c) :-
	//      anyOf(
	//         allOf(a, not(b), not(c)),
	//         allOf(not(a), b, not(c)),
	//         allOf(not(a), not(b), c),
	//   ))
	//
	// This is not necessary if the values are mutually exclusive/ have a
	// discriminator.

	p2("allOf", func(n cue.Value, s *state) {
		var a []ast.Expr
		for _, v := range s.listItems("allOf", n, false) {
			x, sub := s.schemaState(v, s.allowedTypes, nil, true)
			s.allowedTypes &= sub.allowedTypes
			s.usedTypes |= sub.usedTypes
			if sub.hasConstraints() {
				a = append(a, x)
			}
		}
		if len(a) > 0 {
			s.all.add(n, ast.NewBinExpr(token.AND, a...))
		}
	}),

	p2("anyOf", func(n cue.Value, s *state) {
		var types cue.Kind
		var a []ast.Expr
		for _, v := range s.listItems("anyOf", n, false) {
			x, sub := s.schemaState(v, s.allowedTypes, nil, true)
			types |= sub.allowedTypes
			a = append(a, x)
		}
		s.allowedTypes &= types
		if len(a) > 0 {
			s.all.add(n, ast.NewBinExpr(token.OR, a...))
		}
	}),

	p2("oneOf", func(n cue.Value, s *state) {
		var types cue.Kind
		var a []ast.Expr
		hasSome := false
		for _, v := range s.listItems("oneOf", n, false) {
			x, sub := s.schemaState(v, s.allowedTypes, nil, true)
			types |= sub.allowedTypes

			// TODO: make more finegrained by making it two pass.
			if sub.hasConstraints() {
				hasSome = true
			}

			if !isAny(x) {
				a = append(a, x)
			}
		}
		s.allowedTypes &= types
		if len(a) > 0 && hasSome {
			s.usedTypes = allTypes
			s.all.add(n, ast.NewBinExpr(token.OR, a...))
		}

		// TODO: oneOf({a:x}, {b:y}, ..., not(anyOf({a:x}, {b:y}, ...))),
		// can be translated to {} | {a:x}, {b:y}, ...
	}),

	// String constraints

	p1("pattern", func(n cue.Value, s *state) {
		str, _ := n.String()
		if _, err := regexp.Compile(str); err != nil {
			if s.cfg.Strict {
				s.errf(n, "unsupported regexp: %v", err)
			}
			return
		}
		s.usedTypes |= cue.StringKind
		s.add(n, stringType, &ast.UnaryExpr{Op: token.MAT, X: s.string(n)})
	}),

	p1("minLength", func(n cue.Value, s *state) {
		s.usedTypes |= cue.StringKind
		min := s.number(n)
		strings := s.addImport(n, "strings")
		s.add(n, stringType, ast.NewCall(ast.NewSel(strings, "MinRunes"), min))
	}),

	p1("maxLength", func(n cue.Value, s *state) {
		s.usedTypes |= cue.StringKind
		max := s.number(n)
		strings := s.addImport(n, "strings")
		s.add(n, stringType, ast.NewCall(ast.NewSel(strings, "MaxRunes"), max))
	}),

	p1d("contentMediaType", 7, func(n cue.Value, s *state) {
		// TODO: only mark as used if it generates something.
		// s.usedTypes |= cue.StringKind
	}),

	p1d("contentEncoding", 7, func(n cue.Value, s *state) {
		// TODO: only mark as used if it generates something.
		// s.usedTypes |= cue.StringKind
		// 7bit, 8bit, binary, quoted-printable and base64.
		// RFC 2054, part 6.1.
		// https://tools.ietf.org/html/rfc2045
		// TODO: at least handle bytes.
	}),

	// Number constraints

	p2("minimum", func(n cue.Value, s *state) {
		s.usedTypes |= cue.NumberKind
		op := token.GEQ
		if s.exclusiveMin {
			op = token.GTR
		}
		s.add(n, numType, &ast.UnaryExpr{Op: op, X: s.number(n)})
	}),

	p1("exclusiveMinimum", func(n cue.Value, s *state) {
		if n.Kind() == cue.BoolKind {
			s.exclusiveMin = true
			return
		}
		s.usedTypes |= cue.NumberKind
		s.add(n, numType, &ast.UnaryExpr{Op: token.GTR, X: s.number(n)})
	}),

	p2("maximum", func(n cue.Value, s *state) {
		s.usedTypes |= cue.NumberKind
		op := token.LEQ
		if s.exclusiveMax {
			op = token.LSS
		}
		s.add(n, numType, &ast.UnaryExpr{Op: op, X: s.number(n)})
	}),

	p1("exclusiveMaximum", func(n cue.Value, s *state) {
		if n.Kind() == cue.BoolKind {
			s.exclusiveMax = true
			return
		}
		s.usedTypes |= cue.NumberKind
		s.add(n, numType, &ast.UnaryExpr{Op: token.LSS, X: s.number(n)})
	}),

	p1("multipleOf", func(n cue.Value, s *state) {
		s.usedTypes |= cue.NumberKind
		multiple := s.number(n)
		var x big.Int
		_, _ = n.MantExp(&x)
		if x.Cmp(big.NewInt(0)) != 1 {
			s.errf(n, `"multipleOf" value must be < 0; found %s`, n)
		}
		math := s.addImport(n, "math")
		s.add(n, numType, ast.NewCall(ast.NewSel(math, "MultipleOf"), multiple))
	}),

	// Object constraints

	p1("properties", func(n cue.Value, s *state) {
		s.usedTypes |= cue.StructKind
		obj := s.object(n)

		if n.Kind() != cue.StructKind {
			s.errf(n, `"properties" expected an object, found %v`, n.Kind())
		}

		s.processMap(n, func(key string, n cue.Value) {
			// property?: value
			name := ast.NewString(key)
			expr, state := s.schemaState(n, allTypes, []label{{name: key}}, false)
			f := &ast.Field{Label: name, Value: expr}
			state.doc(f)
			f.Optional = token.Blank.Pos()
			if len(obj.Elts) > 0 && len(f.Comments()) > 0 {
				// TODO: change formatter such that either a a NewSection on the
				// field or doc comment will cause a new section.
				ast.SetRelPos(f.Comments()[0], token.NewSection)
			}
			if state.deprecated {
				switch expr.(type) {
				case *ast.StructLit:
					obj.Elts = append(obj.Elts, addTag(name, "deprecated", ""))
				default:
					f.Attrs = append(f.Attrs, internal.NewAttr("deprecated", ""))
				}
			}
			obj.Elts = append(obj.Elts, f)
			s.setField(label{name: key}, f)
		})
	}),

	p2("required", func(n cue.Value, s *state) {
		if n.Kind() != cue.ListKind {
			s.errf(n, `value of "required" must be list of strings, found %v`, n.Kind)
			return
		}

		s.usedTypes |= cue.StructKind

		// TODO: detect that properties is defined somewhere.
		// s.errf(n, `"required" without a "properties" field`)
		obj := s.object(n)

		// Create field map
		fields := map[string]*ast.Field{}
		for _, d := range obj.Elts {
			f, ok := d.(*ast.Field)
			if !ok {
				continue // Could be embedding? See cirrus.json
			}
			str, _, err := ast.LabelName(f.Label)
			if err == nil {
				fields[str] = f
			}
		}

		for _, n := range s.listItems("required", n, true) {
			str, ok := s.strValue(n)
			f := fields[str]
			if f == nil && ok {
				f := &ast.Field{
					Label: ast.NewString(str),
					Value: ast.NewIdent("_"),
				}
				fields[str] = f
				obj.Elts = append(obj.Elts, f)
				continue
			}
			if f.Optional == token.NoPos {
				s.errf(n, "duplicate required field %q", str)
			}
			f.Optional = token.NoPos
		}
	}),

	p1d("propertyNames", 6, func(n cue.Value, s *state) {
		// [=~pattern]: _
		if names, _ := s.schemaState(n, cue.StringKind, nil, false); !isAny(names) {
			s.usedTypes |= cue.StructKind
			x := ast.NewStruct(ast.NewList(names), ast.NewIdent("_"))
			s.add(n, objectType, x)
		}
	}),

	// TODO: reenable when we have proper non-monotonic contraint validation.
	// p1("minProperties", func(n cue.Value, s *state) {
	// 	s.usedTypes |= cue.StructKind

	// 	pkg := s.addImport(n, "struct")
	// 	s.addConjunct(n, ast.NewCall(ast.NewSel(pkg, "MinFields"), s.uint(n)))
	// }),

	p1("maxProperties", func(n cue.Value, s *state) {
		s.usedTypes |= cue.StructKind

		pkg := s.addImport(n, "struct")
		x := ast.NewCall(ast.NewSel(pkg, "MaxFields"), s.uint(n))
		s.add(n, objectType, x)
	}),

	p1("dependencies", func(n cue.Value, s *state) {
		s.usedTypes |= cue.StructKind

		// Schema and property dependencies.
		// TODO: the easiest implementation is with comprehensions.
		// The nicer implementation is with disjunctions. This has to be done
		// at the very end, replacing properties.
		/*
			*{ property?: _|_ } | {
				property: _
				schema
			}
		*/
	}),

	p2("patternProperties", func(n cue.Value, s *state) {
		s.usedTypes |= cue.StructKind
		if n.Kind() != cue.StructKind {
			s.errf(n, `value of "patternProperties" must be an an object, found %v`, n.Kind)
		}
		obj := s.object(n)
		existing := excludeFields(s.obj.Elts)
		s.processMap(n, func(key string, n cue.Value) {
			// [!~(properties) & pattern]: schema
			s.patterns = append(s.patterns,
				&ast.UnaryExpr{Op: token.NMAT, X: ast.NewString(key)})
			f := internal.EmbedStruct(ast.NewStruct(&ast.Field{
				Label: ast.NewList(ast.NewBinExpr(token.AND,
					&ast.UnaryExpr{Op: token.MAT, X: ast.NewString(key)},
					existing)),
				Value: s.schema(n),
			}))
			ast.SetRelPos(f, token.NewSection)
			obj.Elts = append(obj.Elts, f)
		})
	}),

	p3("additionalProperties", func(n cue.Value, s *state) {
		switch n.Kind() {
		case cue.BoolKind:
			s.closeStruct = !s.boolValue(n)

		case cue.StructKind:
			s.usedTypes |= cue.StructKind
			s.closeStruct = true
			obj := s.object(n)
			if len(obj.Elts) == 0 {
				obj.Elts = append(obj.Elts, &ast.Field{
					Label: ast.NewList(ast.NewIdent("string")),
					Value: s.schema(n),
				})
				return
			}
			// [!~(properties|patternProperties)]: schema
			existing := append(s.patterns, excludeFields(obj.Elts))
			f := internal.EmbedStruct(ast.NewStruct(&ast.Field{
				Label: ast.NewList(ast.NewBinExpr(token.AND, existing...)),
				Value: s.schema(n),
			}))
			obj.Elts = append(obj.Elts, f)

		default:
			s.errf(n, `value of "additionalProperties" must be an object or boolean`)
		}
	}),

	// Array constraints.

	p1("items", func(n cue.Value, s *state) {
		s.usedTypes |= cue.ListKind
		switch n.Kind() {
		case cue.StructKind:
			elem := s.schema(n)
			ast.SetRelPos(elem, token.NoRelPos)
			s.add(n, arrayType, ast.NewList(&ast.Ellipsis{Type: elem}))

		case cue.ListKind:
			var a []ast.Expr
			for _, n := range s.listItems("items", n, true) {
				v := s.schema(n) // TODO: label with number literal.
				ast.SetRelPos(v, token.NoRelPos)
				a = append(a, v)
			}
			s.list = ast.NewList(a...)
			s.add(n, arrayType, s.list)

		default:
			s.errf(n, `value of "items" must be an object or array`)
		}
	}),

	p1("additionalItems", func(n cue.Value, s *state) {
		switch n.Kind() {
		case cue.BoolKind:
			// TODO: support

		case cue.StructKind:
			if s.list != nil {
				s.usedTypes |= cue.ListKind
				elem := s.schema(n)
				s.list.Elts = append(s.list.Elts, &ast.Ellipsis{Type: elem})
			}

		default:
			s.errf(n, `value of "additionalItems" must be an object or boolean`)
		}
	}),

	p1("contains", func(n cue.Value, s *state) {
		s.usedTypes |= cue.ListKind
		list := s.addImport(n, "list")
		// TODO: Passing non-concrete values is not yet supported in CUE.
		if x := s.schema(n); !isAny(x) {
			x := ast.NewCall(ast.NewSel(list, "Contains"), clearPos(x))
			s.add(n, arrayType, x)
		}
	}),

	// TODO: min/maxContains

	p1("minItems", func(n cue.Value, s *state) {
		s.usedTypes |= cue.ListKind
		a := []ast.Expr{}
		p, err := n.Uint64()
		if err != nil {
			s.errf(n, "invalid uint")
		}
		for ; p > 0; p-- {
			a = append(a, ast.NewIdent("_"))
		}
		s.add(n, arrayType, ast.NewList(append(a, &ast.Ellipsis{})...))

		// TODO: use this once constraint resolution is properly implemented.
		// list := s.addImport(n, "list")
		// s.addConjunct(n, ast.NewCall(ast.NewSel(list, "MinItems"), clearPos(s.uint(n))))
	}),

	p1("maxItems", func(n cue.Value, s *state) {
		s.usedTypes |= cue.ListKind
		list := s.addImport(n, "list")
		x := ast.NewCall(ast.NewSel(list, "MaxItems"), clearPos(s.uint(n)))
		s.add(n, arrayType, x)

	}),

	p1("uniqueItems", func(n cue.Value, s *state) {
		s.usedTypes |= cue.ListKind
		if s.boolValue(n) {
			list := s.addImport(n, "list")
			s.add(n, arrayType, ast.NewCall(ast.NewSel(list, "UniqueItems")))
		}
	}),
}

func clearPos(e ast.Expr) ast.Expr {
	ast.SetRelPos(e, token.NoRelPos)
	return e
}
