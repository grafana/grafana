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

import (
	"bytes"

	"cuelang.org/go/cue/errors"
	"cuelang.org/go/internal/core/adt"
)

func (s *subsumer) values(a, b adt.Value) (result bool) {
	defer func() {
		if !result && s.gt == nil && s.lt == nil {
			s.gt = a
			s.lt = b
		}
	}()

	if a == b {
		return true
	}

	if s.Defaults {
		b = adt.Default(b)
	}

	switch b := b.(type) {
	case *adt.Bottom:
		// If the value is incomplete, the error is not final. So either check
		// structural equivalence or return an error.
		return !b.IsIncomplete()

	case *adt.Vertex:
		if a, ok := a.(*adt.Vertex); ok {
			return s.vertices(a, b)
		}
		if v, ok := b.BaseValue.(adt.Value); ok {
			// Safe to ignore arcs of w.
			return s.values(a, v)
		}
		// Check based on first value.

	case *adt.Conjunction:
		if _, ok := a.(*adt.Conjunction); ok {
			break
		}
		for _, y := range b.Values {
			if s.values(a, y) {
				return true
			}
		}
		return false

	case *adt.Disjunction:
		if _, ok := a.(*adt.Disjunction); ok {
			break
		}

		for _, y := range b.Values {
			if !s.values(a, y) {
				return false
			}
		}
		return true

	case *adt.NodeLink:
		// Do not descend into NodeLinks to avoid processing cycles.
		// TODO: this would work better if all equal nodes shared the same
		// node link.
		return deref(a) == deref(b)
	}

	switch x := a.(type) {
	case *adt.Top:
		return true

	case *adt.Bottom:
		// isBottom(b) was already tested above.
		return false

	case *adt.BasicType:
		k := b.Kind()
		return x.K&k == k

	case *adt.BoundValue:
		return s.bound(x, b)

	case *adt.Builtin:
		return x == b

	case *adt.BuiltinValidator:
		if y := s.ctx.Validate(x, b); y != nil {
			s.errs = errors.Append(s.errs, y.Err)
			return false
		}
		return true

	case *adt.Null:
		return b.Kind() == adt.NullKind

	case *adt.Bool:
		y, ok := b.(*adt.Bool)
		return ok && x.B == y.B

	case *adt.Num:
		y, ok := b.(*adt.Num)
		return ok && x.K&y.K == y.K && test(s.ctx, x, adt.EqualOp, x, y)

	case *adt.String:
		y, ok := b.(*adt.String)
		return ok && x.Str == y.Str

	case *adt.Bytes:
		y, ok := b.(*adt.Bytes)
		return ok && bytes.Equal(x.B, y.B)

	case *adt.Vertex:
		y, ok := b.(*adt.Vertex)
		if ok {
			return s.vertices(x, y)
		}

		// TODO: Under what conditions can we cast to the value?
		if v, _ := x.BaseValue.(adt.Value); v != nil {
			return s.values(v, b)
		}
		return false

	case *adt.Conjunction:
		if y, ok := b.(*adt.Conjunction); ok {
			// A Conjunction subsumes another Conjunction if for all values a in
			// x there is a value b in y such that a subsumes b.
			//
			// This assumes overlapping ranges in disjunctions are merged.If
			// this is not the case, subsumes will return a false negative,
			// which is allowed.
		outerC:
			for _, a := range x.Values {
				for _, b := range y.Values {
					if s.values(a, b) {
						continue outerC
					}
				}
				// TODO: should this be marked as inexact?
				return false
			}
			return true
		}
		subsumed := true
		for _, a := range x.Values {
			subsumed = subsumed && s.values(a, b)
		}
		return subsumed

	case *adt.Disjunction:

		if s.LeftDefault {
			a = adt.Default(a)
			var ok bool
			x, ok = a.(*adt.Disjunction)
			if !ok {
				return s.values(a, b)
			}
		}

		// A Disjunction subsumes another Disjunction if all values of y are
		// subsumed by any of the values of x, and default values in y are
		// subsumed by the default values of x.
		//
		// This assumes that overlapping ranges in x are merged. If this is not
		// the case, subsumes will return a false negative, which is allowed.
		if y, ok := b.(*adt.Disjunction); ok {
			// at least one value in x should subsume each value in d.
		outerD:
			for i, b := range y.Values {
				bDefault := i < y.NumDefaults
				// v is subsumed if any value in x subsumes v.
				for j, a := range x.Values {
					aDefault := j < x.NumDefaults
					if (aDefault || !bDefault) && s.values(a, b) {
						continue outerD
					}
				}
				return false
			}
			return true
		}
		// b is subsumed if any value in x subsumes b.
		for _, a := range x.Values {
			if s.values(a, b) {
				return true
			}
		}
		// TODO: should this be marked as inexact?
		return false

	case *adt.NodeLink:
		return deref(x) == deref(b)
	}
	return false
}

func deref(v adt.Expr) *adt.Vertex {
	switch x := v.(type) {
	case *adt.Vertex:
		return x
	case *adt.NodeLink:
		return x.Node
	}
	return nil
}

func (s *subsumer) bound(x *adt.BoundValue, v adt.Value) bool {
	ctx := s.ctx
	if isBottom(v) {
		return true
	}

	switch y := v.(type) {
	case *adt.BoundValue:
		if !adt.IsConcrete(y.Value) {
			return false
		}

		kx := x.Kind()
		ky := y.Kind()
		if (kx&ky)&^kx != 0 {
			return false
		}
		// x subsumes y if
		// x: >= a, y: >= b ==> a <= b
		// x: >= a, y: >  b ==> a <= b
		// x: >  a, y: >  b ==> a <= b
		// x: >  a, y: >= b ==> a < b
		//
		// x: <= a, y: <= b ==> a >= b
		//
		// x: != a, y: != b ==> a != b
		//
		// false if types or op direction doesn't match

		xv := x.Value
		yv := y.Value
		switch x.Op {
		case adt.GreaterThanOp:
			if y.Op == adt.GreaterEqualOp {
				return test(ctx, x, adt.LessThanOp, xv, yv)
			}
			fallthrough
		case adt.GreaterEqualOp:
			if y.Op == adt.GreaterThanOp || y.Op == adt.GreaterEqualOp {
				return test(ctx, x, adt.LessEqualOp, xv, yv)
			}
		case adt.LessThanOp:
			if y.Op == adt.LessEqualOp {
				return test(ctx, x, adt.GreaterThanOp, xv, yv)
			}
			fallthrough
		case adt.LessEqualOp:
			if y.Op == adt.LessThanOp || y.Op == adt.LessEqualOp {
				return test(ctx, x, adt.GreaterEqualOp, xv, yv)
			}
		case adt.NotEqualOp:
			switch y.Op {
			case adt.NotEqualOp:
				return test(ctx, x, adt.EqualOp, xv, yv)
			case adt.GreaterEqualOp:
				return test(ctx, x, adt.LessThanOp, xv, yv)
			case adt.GreaterThanOp:
				return test(ctx, x, adt.LessEqualOp, xv, yv)
			case adt.LessThanOp:
				return test(ctx, x, adt.GreaterEqualOp, xv, yv)
			case adt.LessEqualOp:
				return test(ctx, x, adt.GreaterThanOp, xv, yv)
			}

		case adt.MatchOp, adt.NotMatchOp:
			// these are just approximations
			if y.Op == x.Op {
				return test(ctx, x, adt.EqualOp, xv, yv)
			}

		default:
			// adt.NotEqualOp already handled above.
			panic("cue: undefined bound mode")
		}

	case *adt.Num, *adt.String, *adt.Bool:
		return test(ctx, x, x.Op, y, x.Value)
	}
	return false
}

func test(ctx *adt.OpContext, src adt.Node, op adt.Op, gt, lt adt.Value) bool {
	x := adt.BinOp(ctx, op, gt, lt)
	b, ok := x.(*adt.Bool)
	return ok && b.B
}
