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

package adt

import (
	"github.com/cockroachdb/apd/v2"
)

// SimplifyBounds collapses bounds if possible. The bound values must be
// concrete. It returns nil if the bound values cannot be collapsed.
//
// k represents additional type constraints, such as `int`.
func SimplifyBounds(ctx *OpContext, k Kind, x, y *BoundValue) Value {
	xv := x.Value
	yv := y.Value

	cmp, xCat := opInfo(x.Op)
	_, yCat := opInfo(y.Op)

	// k := x.Kind() & y.Kind()

	switch {
	case xCat == yCat:
		switch x.Op {
		// NOTE: EqualOp should not happen, but include it defensively.
		// Maybe an API would use it, for instance.
		case EqualOp, NotEqualOp, MatchOp, NotMatchOp:
			if test(ctx, EqualOp, xv, yv) {
				return x
			}
			return nil // keep both bounds
		}

		// xCat == yCat && x.Op != NotEqualOp
		// > a & >= b
		//    > a   if a >= b
		//    >= b  if a <  b
		// > a & > b
		//    > a   if a >= b
		//    > b   if a <  b
		// >= a & > b
		//    >= a   if a > b
		//    > b    if a <= b
		// >= a & >= b
		//    >= a   if a > b
		//    >= b   if a <= b
		// inverse is true as well.

		// Tighten bound.
		if test(ctx, cmp, xv, yv) {
			return x
		}
		return y

	case xCat == -yCat:
		if xCat == -1 {
			x, y = y, x
		}
		a, aOK := xv.(*Num)
		b, bOK := yv.(*Num)

		if !aOK || !bOK {
			break
		}

		var d, lo, hi apd.Decimal
		lo.Set(&a.X)
		hi.Set(&b.X)
		if k&FloatKind == 0 {
			// Readjust bounds for integers.
			if x.Op == GreaterEqualOp {
				// >=3.4  ==>  >=4
				_, _ = apdCtx.Ceil(&lo, &a.X)
			} else {
				// >3.4  ==>  >3
				_, _ = apdCtx.Floor(&lo, &a.X)
			}
			if y.Op == LessEqualOp {
				// <=2.3  ==>  <= 2
				_, _ = apdCtx.Floor(&hi, &b.X)
			} else {
				// <2.3   ==>  < 3
				_, _ = apdCtx.Ceil(&hi, &b.X)
			}
		}

		cond, err := apd.BaseContext.Sub(&d, &hi, &lo)
		if cond.Inexact() || err != nil {
			break
		}

		// attempt simplification
		// numbers
		// >=a & <=b
		//     a   if a == b
		//     _|_ if a < b
		// >=a & <b
		//     _|_ if b <= a
		// >a  & <=b
		//     _|_ if b <= a
		// >a  & <b
		//     _|_ if b <= a

		// integers
		// >=a & <=b
		//     a   if b-a == 0
		//     _|_ if a < b
		// >=a & <b
		//     a   if b-a == 1
		//     _|_ if b <= a
		// >a  & <=b
		//     b   if b-a == 1
		//     _|_ if b <= a
		// >a  & <b
		//     a+1 if b-a == 2
		//     _|_ if b <= a

		switch diff, err := d.Int64(); {
		case diff == 1:
			if k&FloatKind == 0 {
				if x.Op == GreaterEqualOp && y.Op == LessThanOp {
					return ctx.newNum(&lo, k&NumKind, x, y)
				}
				if x.Op == GreaterThanOp && y.Op == LessEqualOp {
					return ctx.newNum(&hi, k&NumKind, x, y)
				}
			}

		case diff == 2:
			if k&FloatKind == 0 && x.Op == GreaterThanOp && y.Op == LessThanOp {
				_, _ = apd.BaseContext.Add(&d, d.SetInt64(1), &lo)
				return ctx.newNum(&d, k&NumKind, x, y)

			}

		case diff == 0 && err == nil:
			if x.Op == GreaterEqualOp && y.Op == LessEqualOp {
				return ctx.newNum(&lo, k&NumKind, x, y)
			}
			fallthrough

		case d.Negative:
			return ctx.NewErrf("incompatible bounds %v and %v", x, y)
		}

	case x.Op == NotEqualOp:
		if !test(ctx, y.Op, xv, yv) {
			return y
		}

	case y.Op == NotEqualOp:
		if !test(ctx, x.Op, yv, xv) {
			return x
		}
	}
	return nil
}

func opInfo(op Op) (cmp Op, norm int) {
	switch op {
	case GreaterThanOp:
		return GreaterEqualOp, 1
	case GreaterEqualOp:
		return GreaterThanOp, 1
	case LessThanOp:
		return LessEqualOp, -1
	case LessEqualOp:
		return LessThanOp, -1
	case NotEqualOp:
		return NotEqualOp, 0
	case MatchOp:
		return MatchOp, 2
	case NotMatchOp:
		return NotMatchOp, 3
	}
	panic("cue: unreachable")
}

func test(ctx *OpContext, op Op, a, b Value) bool {
	if b, ok := BinOp(ctx, op, a, b).(*Bool); ok {
		return b.B
	}
	return false
}

// SimplifyValidator simplifies non-bound validators.
//
// Currently this only checks for pure equality. In the future this can be used
// to simplify certain builtin validators analogously to how we simplify bounds
// now.
func SimplifyValidator(ctx *OpContext, v, w Validator) Validator {
	switch x := v.(type) {
	case *BuiltinValidator:
		switch y := w.(type) {
		case *BuiltinValidator:
			if x == y {
				return x
			}
			if x.Builtin != y.Builtin || len(x.Args) != len(y.Args) {
				return nil
			}
			for i, a := range x.Args {
				if !Equal(ctx, a, y.Args[i], CheckStructural) {
					return nil
				}
			}
			return x
		}
	}
	return nil
}
