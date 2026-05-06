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

package export

import (
	"fmt"
	"sort"

	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/token"
	"cuelang.org/go/internal/core/adt"
)

// Modes:
//   raw: as is
//   def: merge structs, print reset as is.
//
// Possible simplifications in def mode:
//    - merge contents of multiple _literal_ structs.
//      - this is not possible if some of the elements are bulk optional
//        (or is it?).
//    - still do not ever resolve references.
//    - to do this, fields must be pre-linked to their destinations.
//    - use astutil.Sanitize to resolve shadowing and imports.
//
//
// Categories of printing:
//   - concrete
//   - optionals
//   - references
//   - constraints
//
// Mixed mode is also not supported in the old implementation (at least not
// correctly). It requires references to resolve properly, backtracking to
// a common root and prefixing that to the reference. This is now possible
// with the Environment construct and could be done later.

var empty *adt.Vertex

func init() {
	// TODO: Consider setting a non-nil BaseValue.
	empty = &adt.Vertex{}
	empty.UpdateStatus(adt.Finalized)
}

// innerExpr is like expr, but prohibits inlining in certain cases.
func (e *exporter) innerExpr(env *adt.Environment, v adt.Elem) (result ast.Expr) {
	e.inExpression++
	r := e.expr(env, v)
	e.inExpression--
	return r
}

// expr converts an ADT expression to an AST expression.
// The env is used for resolution and does not need to be given if v is known
// to not contain any references.
func (e *exporter) expr(env *adt.Environment, v adt.Elem) (result ast.Expr) {
	switch x := v.(type) {
	case nil:
		return nil

	case *adt.Vertex:
		if len(x.Conjuncts) == 0 || x.IsData() {
			// Treat as literal value.
			return e.value(x)
		} // Should this be the arcs label?

		a := []conjunct{}
		for _, c := range x.Conjuncts {
			if c, ok := c.Elem().(*adt.Comprehension); ok && !c.DidResolve() {
				continue
			}
			a = append(a, conjunct{c, 0})
		}

		return e.mergeValues(adt.InvalidLabel, x, a, x.Conjuncts...)

	case *adt.StructLit:
		c := adt.MakeRootConjunct(env, x)
		return e.mergeValues(adt.InvalidLabel, nil, []conjunct{{c: c, up: 0}}, c)

	case adt.Value:
		return e.value(x) // Use conjuncts.

	default:
		return e.adt(env, v)
	}
}

// Piece out values:

// For a struct, piece out conjuncts that are already values. Those can be
// unified. All other conjuncts are added verbatim.

func (x *exporter) mergeValues(label adt.Feature, src *adt.Vertex, a []conjunct, orig ...adt.Conjunct) (expr ast.Expr) {

	e := conjuncts{
		exporter: x,
		values:   &adt.Vertex{},
		fields:   map[adt.Feature]field{},
		attrs:    []*ast.Attribute{},
	}

	s, saved := e.pushFrame(src, orig)
	defer e.popFrame(saved)

	// Handle value aliases and lets
	var valueAlias *ast.Alias
	for _, c := range a {
		if f, ok := c.c.Field().Source().(*ast.Field); ok {
			if a, ok := f.Value.(*ast.Alias); ok {
				if valueAlias == nil {
					if e.valueAlias == nil {
						e.valueAlias = map[*ast.Alias]*ast.Alias{}
					}
					name := a.Ident.Name
					name = e.uniqueAlias(name)
					valueAlias = &ast.Alias{Ident: ast.NewIdent(name)}
				}
				e.valueAlias[a] = valueAlias
			}
		}
		x.markLets(c.c.Expr().Source())
	}

	defer filterUnusedLets(s)

	defer func() {
		if valueAlias != nil {
			valueAlias.Expr = expr
			expr = valueAlias
		}
	}()

	hasAlias := len(s.Elts) > 0

	for _, c := range a {
		e.top().upCount = c.up
		x := c.c.Elem()
		e.addExpr(c.c.Env, src, x, false)
	}

	if src != nil {
		for _, a := range src.Arcs {
			if x, ok := e.fields[a.Label]; ok {
				x.arc = a
				e.fields[a.Label] = x
			}
		}
	}

	for _, a := range e.attrs {
		s.Elts = append(s.Elts, a)
	}

	// Unify values only for one level.
	if a := e.values.Conjuncts; len(a) > 0 {
		e.values.Finalize(e.ctx)
		e.embed = append(e.embed, e.value(e.values, a...))
	}

	// Collect and order set of fields.

	fields := []adt.Feature{}
	for f := range e.fields {
		fields = append(fields, f)
	}

	// Sort fields in case features lists are missing to ensure
	// predictability. Also sort in reverse order, so that bugs
	// are more likely exposed.
	sort.Slice(fields, func(i, j int) bool {
		return fields[i] > fields[j]
	})

	if adt.DebugSort == 0 {
		m := sortArcs(extractFeatures(e.structs))
		sort.SliceStable(fields, func(i, j int) bool {
			if m[fields[j]] == 0 {
				return m[fields[i]] != 0
			}
			return m[fields[i]] > m[fields[j]]
		})
	} else {
		adt.DebugSortFields(e.ctx, fields)
	}

	if len(e.fields) == 0 && !e.hasEllipsis {
		switch len(e.embed) + len(e.conjuncts) {
		case 0:
			if len(e.attrs) > 0 {
				break
			}
			if len(e.structs) > 0 || e.isData {
				return e.wrapCloseIfNecessary(s, src)
			}
			return ast.NewIdent("_")
		case 1:
			var x ast.Expr
			if len(e.conjuncts) == 1 {
				x = e.conjuncts[0]
			} else {
				x = e.embed[0]
			}
			if len(e.attrs) == 0 && !hasAlias {
				return x
			}
			if st, ok := x.(*ast.StructLit); ok {
				s.Elts = append(s.Elts, st.Elts...)
				return e.wrapCloseIfNecessary(s, src)
			}
		}
	}

	for _, x := range e.embed {
		s.Elts = append(s.Elts, &ast.EmbedDecl{Expr: x})
	}

	for _, f := range fields {
		if f.IsLet() {
			continue
		}
		field := e.fields[f]
		c := field.conjuncts

		label := e.stringLabel(f)

		if f.IsDef() {
			x.inDefinition++
		}

		a := []adt.Conjunct{}
		for _, cc := range c {
			a = append(a, cc.c)
		}

		d := &ast.Field{Label: label}

		top := e.frame(0)
		if fr, ok := top.fields[f]; ok && fr.alias != "" {
			setFieldAlias(d, fr.alias)
			fr.node = d
			top.fields[f] = fr
		}

		d.Value = e.mergeValues(f, field.arc, c, a...)

		if f.IsDef() {
			x.inDefinition--
		}

		if isOptional(a) {
			d.Optional = token.Blank.Pos()
		}
		if x.cfg.ShowDocs {
			docs := extractDocs(src, a)
			ast.SetComments(d, docs)
		}
		if x.cfg.ShowAttributes {
			for _, c := range a {
				d.Attrs = extractFieldAttrs(d.Attrs, c.Field())
			}
		}
		s.Elts = append(s.Elts, d)
	}
	if e.hasEllipsis {
		s.Elts = append(s.Elts, &ast.Ellipsis{})
	}

	ws := e.wrapCloseIfNecessary(s, src)
	switch {
	case len(e.conjuncts) == 0:
		return ws

	case len(e.structs) > 0, len(s.Elts) > 0:
		e.conjuncts = append(e.conjuncts, ws)
	}

	return ast.NewBinExpr(token.AND, e.conjuncts...)
}

func (e *conjuncts) wrapCloseIfNecessary(s *ast.StructLit, v *adt.Vertex) ast.Expr {
	if !e.hasEllipsis && v != nil {
		if st, ok := v.BaseValue.(*adt.StructMarker); ok && st.NeedClose {
			return ast.NewCall(ast.NewIdent("close"), s)
		}
	}
	return s
}

// Conjuncts if for collecting values of a single vertex.
type conjuncts struct {
	*exporter
	// Values is used to collect non-struct values.
	values      *adt.Vertex
	embed       []ast.Expr
	conjuncts   []ast.Expr
	structs     []*adt.StructInfo
	fields      map[adt.Feature]field
	attrs       []*ast.Attribute
	hasEllipsis bool

	// A value is a struct if it has a non-zero structs slice or if isData is
	// set to true. Data vertices may not have conjuncts associated with them.
	isData bool
}

func (c *conjuncts) addValueConjunct(src *adt.Vertex, env *adt.Environment, x adt.Elem) {
	switch b, ok := x.(adt.BaseValue); {
	case ok && src != nil && isTop(b) && !isTop(src.BaseValue):
		// drop top
	default:
		c.values.AddConjunct(adt.MakeRootConjunct(env, x))
	}
}

func (c *conjuncts) addConjunct(f adt.Feature, env *adt.Environment, n adt.Node) {
	x := c.fields[f]
	v := adt.MakeRootConjunct(env, n)
	x.conjuncts = append(x.conjuncts, conjunct{
		c:  v,
		up: c.top().upCount,
	})
	// x.upCounts = append(x.upCounts, c.top().upCount)
	c.fields[f] = x
}

type field struct {
	docs      []*ast.CommentGroup
	arc       *adt.Vertex
	conjuncts []conjunct
}

type conjunct struct {
	c  adt.Conjunct
	up int32
}

func (e *conjuncts) addExpr(env *adt.Environment, src *adt.Vertex, x adt.Elem, isEmbed bool) {
	switch x := x.(type) {
	case *adt.StructLit:
		e.top().upCount++

		if e.cfg.ShowAttributes {
			e.attrs = extractDeclAttrs(e.attrs, x.Src)
		}

		// Only add if it only has no bulk fields or elipsis.
		if isComplexStruct(x) {
			_, saved := e.pushFrame(src, nil)
			e.embed = append(e.embed, e.adt(env, x))
			e.top().upCount-- // not necessary, but for proper form
			e.popFrame(saved)
			return
		}
		// Used for sorting.
		e.structs = append(e.structs, &adt.StructInfo{StructLit: x, Env: env})

		env = &adt.Environment{Up: env, Vertex: e.node()}

		for _, d := range x.Decls {
			var label adt.Feature
			switch f := d.(type) {
			case *adt.Field:
				label = f.Label
			case *adt.OptionalField:
				// TODO: mark optional here.
				label = f.Label
			case *adt.LetField:
				continue
			case *adt.Ellipsis:
				e.hasEllipsis = true
				continue
			case adt.Expr:
				e.addExpr(env, nil, f, true)
				continue

				// TODO: also handle dynamic fields
			default:
				panic(fmt.Sprintf("Unexpected type %T", d))
			}
			e.addConjunct(label, env, d)
		}
		e.top().upCount--

	case adt.Value: // other values.
		switch v := x.(type) {
		case nil:
		default:
			e.addValueConjunct(src, env, x)

		case *adt.Vertex:
			if b, ok := v.BaseValue.(*adt.Bottom); ok {
				if !b.IsIncomplete() || e.cfg.Final {
					e.addExpr(env, v, b, false)
					return
				}
			}

			switch {
			default:
				for _, c := range v.Conjuncts {
					e.addExpr(c.Env, v, c.Elem(), false)
				}

			case v.IsData():
				e.structs = append(e.structs, v.Structs...)
				e.isData = true

				if y, ok := v.BaseValue.(adt.Value); ok {
					e.addValueConjunct(src, env, y)
				}

				for _, a := range v.Arcs {
					a.Finalize(e.ctx) // TODO: should we do this?

					if !a.IsDefined(e.ctx) {
						continue
					}

					e.addConjunct(a.Label, env, a)
				}
			}
		}

	case *adt.BinaryExpr:
		switch {
		case x.Op == adt.AndOp && !isEmbed:
			e.addExpr(env, src, x.X, false)
			e.addExpr(env, src, x.Y, false)
		case isSelfContained(x):
			e.addValueConjunct(src, env, x)
		default:
			if isEmbed {
				e.embed = append(e.embed, e.expr(env, x))
			} else {
				e.conjuncts = append(e.conjuncts, e.expr(env, x))
			}
		}

	default:
		switch {
		case isSelfContained(x):
			e.addValueConjunct(src, env, x)
		case isEmbed:
			e.embed = append(e.embed, e.expr(env, x))
		default:
			if x := e.expr(env, x); x != dummyTop {
				e.conjuncts = append(e.conjuncts, x)
			}
		}
	}
}

func isTop(x adt.BaseValue) bool {
	switch v := x.(type) {
	case *adt.Top:
		return true
	case *adt.BasicType:
		return v.K == adt.TopKind
	default:
		return false
	}
}

// TODO: find a better way to annotate optionality. Maybe a special conjunct
// or store it in the field information?
func isOptional(a []adt.Conjunct) bool {
	if len(a) == 0 {
		return false
	}
	for _, c := range a {
		if v, ok := c.Elem().(*adt.Vertex); ok && !v.IsData() && len(v.Conjuncts) > 0 {
			return isOptional(v.Conjuncts)
		}
		switch f := c.Source().(type) {
		case nil:
			return false
		case *ast.Field:
			if f.Optional == token.NoPos {
				return false
			}
		}
	}
	return true
}

func isComplexStruct(s *adt.StructLit) bool {
	for _, d := range s.Decls {
		switch x := d.(type) {
		case *adt.Field:
			// TODO: remove this and also handle field annotation in expr().
			// This allows structs to be merged. Ditto below.
			if x.Src != nil {
				if _, ok := x.Src.Label.(*ast.Alias); ok {
					return ok
				}
			}

		case *adt.OptionalField:
			if x.Src != nil {
				if _, ok := x.Src.Label.(*ast.Alias); ok {
					return ok
				}
			}

		case *adt.LetField:

		case adt.Expr:

		case *adt.Ellipsis:
			if x.Value != nil {
				return true
			}

		default:
			return true
		}
	}
	return false
}

func isSelfContained(expr adt.Elem) bool {
	switch x := expr.(type) {
	case *adt.BinaryExpr:
		return isSelfContained(x.X) && isSelfContained(x.Y)
	case *adt.UnaryExpr:
		return isSelfContained(x.X)
	case *adt.BoundExpr:
		return isSelfContained(x.Expr)
	case adt.Value:
		return true
	}
	return false
}
