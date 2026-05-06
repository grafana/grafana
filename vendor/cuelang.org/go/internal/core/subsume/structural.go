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

package subsume

// TODO: structural subsumption has not yet been implemented.

import "cuelang.org/go/internal/core/adt"

func (s *subsumer) subsumes(gt, lt adt.Conjunct) bool {
	if gt == lt {
		return true
	}

	// First try evaluating at the value level.
	x, _ := gt.Expr().(adt.Value)
	y, _ := lt.Expr().(adt.Value)
	if x == nil {
		// Fall back to structural.
		return s.structural(gt, lt)
	}
	if y == nil {
		return false
	}

	return s.values(x, y)
}

func (s *subsumer) conjunct(gt, lt adt.Conjunct) bool {
	return false
}

func (s *subsumer) c(env *adt.Environment, x adt.Expr) adt.Conjunct {
	return adt.MakeRootConjunct(env, x)
}

func isBottomConjunct(c adt.Conjunct) bool {
	b, _ := c.Expr().(*adt.Bottom)
	return b != nil
}

func (s *subsumer) node(env *adt.Environment, up int32) *adt.Vertex {
	for ; up != 0; up-- {
		env = env.Up
	}
	return env.Vertex
}

func (s *subsumer) structural(a, b adt.Conjunct) bool {
	if isBottomConjunct(b) {
		return true
	}

	switch x := a.Expr().(type) {
	case *adt.DisjunctionExpr:

	case *adt.StructLit:
	case *adt.ListLit:

	case *adt.FieldReference:
		if y, ok := b.Elem().(*adt.FieldReference); ok && x.Label == y.Label {
			if s.node(a.Env, x.UpCount) == s.node(b.Env, y.UpCount) {
				return true
			}
		}

	case *adt.LabelReference:
		if y, ok := b.Elem().(*adt.LabelReference); ok {
			if s.node(a.Env, x.UpCount) == s.node(b.Env, y.UpCount) {
				return true
			}
		}

	case *adt.DynamicReference:
		if y, ok := b.Elem().(*adt.FieldReference); ok {
			if s.node(a.Env, x.UpCount) == s.node(b.Env, y.UpCount) {
				return true
			}
		}

	case *adt.ImportReference:
		if y, ok := b.Elem().(*adt.ImportReference); ok &&
			x.ImportPath == y.ImportPath {
			return true
		}

	case *adt.LetReference:
		if y, ok := b.Elem().(*adt.LetReference); ok && x.Label == y.Label {
			if s.node(a.Env, x.UpCount) == s.node(b.Env, y.UpCount) {
				return true
			}
		}

	case *adt.SelectorExpr:
		if y, ok := a.Elem().(*adt.SelectorExpr); ok &&
			x.Sel == y.Sel &&
			s.conjunct(s.c(a.Env, x.X), s.c(b.Env, y.X)) {
			return true
		}

	case *adt.IndexExpr:
		if y, ok := b.Elem().(*adt.IndexExpr); ok &&
			s.conjunct(s.c(a.Env, x.X), s.c(b.Env, y.X)) &&
			s.conjunct(s.c(a.Env, x.Index), s.c(b.Env, y.Index)) {
			return true
		}

	case *adt.SliceExpr:
		if r, ok := b.Elem().(*adt.SliceExpr); ok &&
			s.conjunct(s.c(a.Env, x.X), s.c(b.Env, r.X)) &&
			s.conjunct(s.c(a.Env, x.Lo), s.c(b.Env, r.Lo)) &&
			s.conjunct(s.c(a.Env, x.Hi), s.c(b.Env, r.Hi)) {
			return true
		}

	case *adt.Interpolation:
		switch y := b.Elem().(type) {
		case *adt.String:
			// Be conservative if not ground.
			s.inexact = true

		case *adt.Interpolation:
			// structural equivalence
			if len(x.Parts) != len(y.Parts) {
				return false
			}
			for i, p := range x.Parts {
				if !s.conjunct(s.c(a.Env, p), s.c(b.Env, y.Parts[i])) {
					return false
				}
			}
			return true
		}

	case *adt.BoundExpr:
		if y, ok := b.Elem().(*adt.BoundExpr); ok && x.Op == y.Op {
			return s.conjunct(s.c(a.Env, x.Expr), s.c(b.Env, y.Expr))
		}

	case *adt.UnaryExpr:
		if y, ok := b.Elem().(*adt.UnaryExpr); ok && x.Op == y.Op {
			return s.conjunct(s.c(a.Env, x.X), s.c(b.Env, y.X))
		}

	case *adt.BinaryExpr:
		if y, ok := b.Elem().(*adt.BinaryExpr); ok && x.Op == y.Op {
			return s.conjunct(s.c(a.Env, x.X), s.c(b.Env, y.X)) &&
				s.conjunct(s.c(a.Env, x.Y), s.c(b.Env, y.Y))
		}

	case *adt.CallExpr:
		if y, ok := b.Elem().(*adt.CallExpr); ok {
			if len(x.Args) != len(y.Args) {
				return false
			}
			for i, arg := range x.Args {
				if !s.conjunct(s.c(a.Env, arg), s.c(b.Env, y.Args[i])) {
					return false
				}
			}
			return s.conjunct(s.c(a.Env, x.Fun), s.c(b.Env, y.Fun))
		}
	}
	return false
}

func (s *subsumer) structLit(
	ea *adt.Environment, sa *adt.StructLit,
	eb *adt.Environment, sb *adt.StructLit) bool {

	// Create index of instance fields.
	ca := newCollatedDecls()
	ca.collate(ea, sa)

	if ca.yielders != nil || ca.dynamic != nil {
		// TODO: we could do structural comparison of comprehensions
		// in many cases. For instance, an if clause would subsume
		// structurally if it subsumes any of the if clauses in sb.
		s.inexact = true
		return false
	}

	cb := newCollatedDecls()
	cb.collate(eb, sb)

	if ca.hasOptional && !s.IgnoreOptional {
		// TODO: same argument here as for comprehensions. This could
		// be made to work.
		if ca.pattern != nil || ca.dynamic != nil {
			s.inexact = true
			return false
		}

		// for f, b := range cb.fields {
		// 	if !b.required || f.IsDef() {
		// 		continue
		// 	}
		// 	name := ctx.LabelStr(b.Label)
		// 	arg := &stringLit{x.baseValue, name, nil}
		// 	u, _ := x.optionals.constraint(ctx, arg)
		// 	if u != nil && !s.subsumes(u, b.v) {
		// 		return false
		// 	}
		// }

	}

	return false

}

// collatedDecls is used to compute the structural subsumption of two
// struct literals.
type collatedDecls struct {
	fields      map[adt.Feature]field
	yielders    []adt.Yielder
	pattern     []*adt.BulkOptionalField
	dynamic     []*adt.DynamicField
	values      []adt.Expr
	additional  []*adt.Ellipsis
	isOpen      bool
	hasOptional bool
}

func newCollatedDecls() *collatedDecls {
	return &collatedDecls{fields: map[adt.Feature]field{}}
}

type field struct {
	required  bool
	conjuncts []adt.Conjunct
}

func (c *collatedDecls) collate(env *adt.Environment, s *adt.StructLit) {
	for _, d := range s.Decls {
		switch x := d.(type) {
		case *adt.Field:
			e := c.fields[x.Label]
			e.required = true
			e.conjuncts = append(e.conjuncts, adt.MakeRootConjunct(env, x))
			c.fields[x.Label] = e

		case *adt.OptionalField:
			e := c.fields[x.Label]
			e.conjuncts = append(e.conjuncts, adt.MakeRootConjunct(env, x))
			c.fields[x.Label] = e
			c.hasOptional = true

		case *adt.BulkOptionalField:
			c.pattern = append(c.pattern, x)
			c.hasOptional = true

		case *adt.DynamicField:
			c.dynamic = append(c.dynamic, x)
			c.hasOptional = true

		case *adt.Ellipsis:
			c.isOpen = true
			c.additional = append(c.additional, x)

		case *adt.Comprehension:
			c.yielders = append(c.yielders, x.Clauses...)

		case *adt.LetClause:
			c.yielders = append(c.yielders, x)
		}
	}
}
