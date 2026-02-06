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
	"bytes"
	"strings"
)

// BinOp handles all operations except AndOp and OrOp. This includes processing
// unary comparators such as '<4' and '=~"foo"'.
//
// BinOp returns nil if not both left and right are concrete.
func BinOp(c *OpContext, op Op, left, right Value) Value {
	leftKind := left.Kind()
	rightKind := right.Kind()

	const msg = "non-concrete value '%v' to operation '%s'"
	if left.Concreteness() > Concrete {
		return &Bottom{
			Code: IncompleteError,
			Err:  c.Newf(msg, left, op),
		}
	}
	if right.Concreteness() > Concrete {
		return &Bottom{
			Code: IncompleteError,
			Err:  c.Newf(msg, right, op),
		}
	}

	if err := CombineErrors(c.src, left, right); err != nil {
		return err
	}

	switch op {
	case EqualOp:
		switch {
		case leftKind == NullKind && rightKind == NullKind:
			return c.newBool(true)

		case leftKind == NullKind || rightKind == NullKind:
			return c.newBool(false)

		case leftKind == BoolKind:
			return c.newBool(c.BoolValue(left) == c.BoolValue(right))

		case leftKind == StringKind:
			// normalize?
			return cmpTonode(c, op, strings.Compare(c.StringValue(left), c.StringValue(right)))

		case leftKind == BytesKind:
			return cmpTonode(c, op, bytes.Compare(c.bytesValue(left, op), c.bytesValue(right, op)))

		case leftKind&NumKind != 0 && rightKind&NumKind != 0:
			// n := c.newNum()
			return cmpTonode(c, op, c.Num(left, op).X.Cmp(&c.Num(right, op).X))

		case leftKind == ListKind && rightKind == ListKind:
			x := c.Elems(left)
			y := c.Elems(right)
			if len(x) != len(y) {
				return c.newBool(false)
			}
			for i, e := range x {
				a, _ := c.Concrete(nil, e, op)
				b, _ := c.Concrete(nil, y[i], op)
				if !test(c, EqualOp, a, b) {
					return c.newBool(false)
				}
			}
			return c.newBool(true)
		}

	case NotEqualOp:
		switch {
		case leftKind == NullKind && rightKind == NullKind:
			return c.newBool(false)

		case leftKind == NullKind || rightKind == NullKind:
			return c.newBool(true)

		case leftKind == BoolKind:
			return c.newBool(c.boolValue(left, op) != c.boolValue(right, op))

		case leftKind == StringKind:
			// normalize?
			return cmpTonode(c, op, strings.Compare(c.StringValue(left), c.StringValue(right)))

		case leftKind == BytesKind:
			return cmpTonode(c, op, bytes.Compare(c.bytesValue(left, op), c.bytesValue(right, op)))

		case leftKind&NumKind != 0 && rightKind&NumKind != 0:
			// n := c.newNum()
			return cmpTonode(c, op, c.Num(left, op).X.Cmp(&c.Num(right, op).X))

		case leftKind == ListKind && rightKind == ListKind:
			x := c.Elems(left)
			y := c.Elems(right)
			if len(x) != len(y) {
				return c.newBool(false)
			}
			for i, e := range x {
				a, _ := c.Concrete(nil, e, op)
				b, _ := c.Concrete(nil, y[i], op)
				if !test(c, EqualOp, a, b) {
					return c.newBool(true)
				}
			}
			return c.newBool(false)
		}

	case LessThanOp, LessEqualOp, GreaterEqualOp, GreaterThanOp:
		switch {
		case leftKind == StringKind && rightKind == StringKind:
			// normalize?
			return cmpTonode(c, op, strings.Compare(c.stringValue(left, op), c.stringValue(right, op)))

		case leftKind == BytesKind && rightKind == BytesKind:
			return cmpTonode(c, op, bytes.Compare(c.bytesValue(left, op), c.bytesValue(right, op)))

		case leftKind&NumKind != 0 && rightKind&NumKind != 0:
			// n := c.newNum(left, right)
			return cmpTonode(c, op, c.Num(left, op).X.Cmp(&c.Num(right, op).X))
		}

	case BoolAndOp:
		return c.newBool(c.boolValue(left, op) && c.boolValue(right, op))

	case BoolOrOp:
		return c.newBool(c.boolValue(left, op) || c.boolValue(right, op))

	case MatchOp:
		// if y.re == nil {
		// 	// This really should not happen, but leave in for safety.
		// 	b, err := Regexp.MatchString(str, x.str)
		// 	if err != nil {
		// 		return c.Errf(Src, "error parsing Regexp: %v", err)
		// 	}
		// 	return boolTonode(Src, b)
		// }
		return c.newBool(c.regexp(right).MatchString(c.stringValue(left, op)))

	case NotMatchOp:
		return c.newBool(!c.regexp(right).MatchString(c.stringValue(left, op)))

	case AddOp:
		switch {
		case leftKind&NumKind != 0 && rightKind&NumKind != 0:
			return c.Add(c.Num(left, op), c.Num(right, op))

		case leftKind == StringKind && rightKind == StringKind:
			return c.NewString(c.StringValue(left) + c.StringValue(right))

		case leftKind == BytesKind && rightKind == BytesKind:
			ba := c.bytesValue(left, op)
			bb := c.bytesValue(right, op)
			b := make([]byte, len(ba)+len(bb))
			copy(b, ba)
			copy(b[len(ba):], bb)
			return c.newBytes(b)

		case leftKind == ListKind && rightKind == ListKind:
			// TODO: get rid of list addition. Semantically it is somewhat
			// unclear and, as it turns out, it is also hard to get right.
			// Simulate addition with comprehensions now.
			if err := c.Err(); err != nil {
				return err
			}

			x := MakeIdentLabel(c, "x", "")

			// for x in expr { x }
			forClause := func(src Expr) *Comprehension {
				s := &StructLit{Decls: []Decl{
					&FieldReference{UpCount: 1, Label: x},
				}}
				return &Comprehension{
					Clauses: []Yielder{
						&ForClause{
							Value: x,
							Src:   src,
						},
					},
					Value: s,
				}
			}

			list := &ListLit{
				Elems: []Elem{
					forClause(left),
					forClause(right),
				},
			}

			n := &Vertex{}
			n.AddConjunct(MakeConjunct(c.Env(0), list, c.ci))
			c.Unify(n, Conjuncts)

			return n
		}

	case SubtractOp:
		return c.Sub(c.Num(left, op), c.Num(right, op))

	case MultiplyOp:
		switch {
		// float
		case leftKind&NumKind != 0 && rightKind&NumKind != 0:
			return c.Mul(c.Num(left, op), c.Num(right, op))

		case leftKind == StringKind && rightKind == IntKind:
			const as = "string multiplication"
			return c.NewString(strings.Repeat(c.stringValue(left, as), int(c.uint64(right, as))))

		case leftKind == IntKind && rightKind == StringKind:
			const as = "string multiplication"
			return c.NewString(strings.Repeat(c.stringValue(right, as), int(c.uint64(left, as))))

		case leftKind == BytesKind && rightKind == IntKind:
			const as = "bytes multiplication"
			return c.newBytes(bytes.Repeat(c.bytesValue(left, as), int(c.uint64(right, as))))

		case leftKind == IntKind && rightKind == BytesKind:
			const as = "bytes multiplication"
			return c.newBytes(bytes.Repeat(c.bytesValue(right, as), int(c.uint64(left, as))))

		case leftKind == ListKind && rightKind == IntKind:
			left, right = right, left
			fallthrough

		case leftKind == IntKind && rightKind == ListKind:
			// TODO: get rid of list multiplication.

			list := &ListLit{}
			x := MakeIdentLabel(c, "x", "")

			for i := c.uint64(left, "list multiplier"); i > 0; i-- {
				st := &StructLit{Decls: []Decl{
					&FieldReference{UpCount: 1, Label: x},
				}}
				list.Elems = append(list.Elems,
					&Comprehension{
						Clauses: []Yielder{
							&ForClause{
								Value: x,
								Src:   right,
							},
						},
						Value: st,
					},
				)
			}
			if err := c.Err(); err != nil {
				return err
			}

			n := &Vertex{}
			n.AddConjunct(MakeConjunct(c.Env(0), list, c.ci))
			c.Unify(n, Conjuncts)

			return n
		}

	case FloatQuotientOp:
		if leftKind&NumKind != 0 && rightKind&NumKind != 0 {
			return c.Quo(c.Num(left, op), c.Num(right, op))
		}

	case IntDivideOp:
		if leftKind&IntKind != 0 && rightKind&IntKind != 0 {
			return c.IntDiv(c.Num(left, op), c.Num(right, op))
		}

	case IntModuloOp:
		if leftKind&IntKind != 0 && rightKind&IntKind != 0 {
			return c.IntMod(c.Num(left, op), c.Num(right, op))
		}

	case IntQuotientOp:
		if leftKind&IntKind != 0 && rightKind&IntKind != 0 {
			return c.IntQuo(c.Num(left, op), c.Num(right, op))
		}

	case IntRemainderOp:
		if leftKind&IntKind != 0 && rightKind&IntKind != 0 {
			return c.IntRem(c.Num(left, op), c.Num(right, op))
		}
	}

	return c.NewErrf("invalid operands %s and %s to '%s' (type %s and %s)",
		left, right, op, left.Kind(), right.Kind())
}

func cmpTonode(c *OpContext, op Op, r int) Value {
	result := false
	switch op {
	case LessThanOp:
		result = r == -1
	case LessEqualOp:
		result = r != 1
	case EqualOp, AndOp:
		result = r == 0
	case NotEqualOp:
		result = r != 0
	case GreaterEqualOp:
		result = r != -1
	case GreaterThanOp:
		result = r == 1
	}
	return c.newBool(result)
}
