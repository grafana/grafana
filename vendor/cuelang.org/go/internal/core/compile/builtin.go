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

package compile

import (
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/internal/core/adt"
)

// This file contains predeclared builtins.

const supportedByLen = adt.StructKind | adt.BytesKind | adt.StringKind | adt.ListKind

var (
	stringParam = adt.Param{Value: &adt.BasicType{K: adt.StringKind}}
	structParam = adt.Param{Value: &adt.BasicType{K: adt.StructKind}}
	listParam   = adt.Param{Value: &adt.BasicType{K: adt.ListKind}}
	intParam    = adt.Param{Value: &adt.BasicType{K: adt.IntKind}}
)

var lenBuiltin = &adt.Builtin{
	Name:   "len",
	Params: []adt.Param{{Value: &adt.BasicType{K: supportedByLen}}},
	Result: adt.IntKind,
	Func: func(c *adt.OpContext, args []adt.Value) adt.Expr {
		v := args[0]
		if x, ok := v.(*adt.Vertex); ok {
			x.LockArcs = true
			switch x.BaseValue.(type) {
			case nil:
				// This should not happen, but be defensive.
				return c.NewErrf("unevaluated vertex")
			case *adt.ListMarker:
				return c.NewInt64(int64(len(x.Elems())), v)

			case *adt.StructMarker:
				n := 0
				v, _ := v.(*adt.Vertex)
				for _, a := range v.Arcs {
					if a.Label.IsRegular() && a.IsDefined(c) {
						n++
					}
				}
				return c.NewInt64(int64(n), v)

			default:
				v = x.Value()
			}
		}

		switch x := v.(type) {
		case *adt.Bytes:
			return c.NewInt64(int64(len(x.B)), v)
		case *adt.String:
			return c.NewInt64(int64(len(x.Str)), v)
		default:
			k := x.Kind()
			if k&supportedByLen == adt.BottomKind {
				return c.NewErrf("invalid argument type %v", k)
			}
			b := c.NewErrf("incomplete argument %s (type %v)", v, k)
			b.Code = adt.IncompleteError
			return b
		}
	},
}

var closeBuiltin = &adt.Builtin{
	Name:   "close",
	Params: []adt.Param{structParam},
	Result: adt.StructKind,
	Func: func(c *adt.OpContext, args []adt.Value) adt.Expr {
		s, ok := args[0].(*adt.Vertex)
		if !ok {
			return c.NewErrf("struct argument must be concrete")
		}
		if m, ok := s.BaseValue.(*adt.StructMarker); ok && m.NeedClose || s.Closed {
			return s
		}
		v := s.Clone()
		// TODO(perf): do not copy the arc, but rather find a way to mark the
		// calling nodeContext.
		v.BaseValue = &adt.StructMarker{NeedClose: true}
		return v
	},
}

var andBuiltin = &adt.Builtin{
	Name:   "and",
	Params: []adt.Param{listParam},
	Result: adt.IntKind,
	Func: func(c *adt.OpContext, args []adt.Value) adt.Expr {
		list := c.RawElems(args[0])
		if len(list) == 0 {
			return &adt.Top{}
		}
		a := []adt.Value{}
		for _, c := range list {
			a = append(a, c)
		}
		return &adt.Conjunction{Values: a}
	},
}

var orBuiltin = &adt.Builtin{
	Name:   "or",
	Params: []adt.Param{listParam},
	Result: adt.IntKind,
	Func: func(c *adt.OpContext, args []adt.Value) adt.Expr {
		d := []adt.Disjunct{}
		for _, c := range c.RawElems(args[0]) {
			d = append(d, adt.Disjunct{Val: c, Default: false})
		}
		if len(d) == 0 {
			// TODO(manifest): This should not be unconditionally incomplete,
			// but it requires results from comprehensions and all to have
			// some special status. Maybe this can be solved by having results
			// of list comprehensions be open if they result from iterating over
			// an open list or struct. This would actually be exactly what
			// that means. The error here could then only add an incomplete
			// status if the source is open.
			return &adt.Bottom{
				Code: adt.IncompleteError,
				Err:  errors.Newf(c.Pos(), "empty list in call to or"),
			}
		}
		v := &adt.Vertex{}
		// TODO: make a Disjunction.
		closeInfo := c.CloseInfo()
		v.AddConjunct(adt.MakeConjunct(nil,
			&adt.DisjunctionExpr{Values: d, HasDefaults: false},
			closeInfo,
		))
		c.Unify(v, adt.Conjuncts)
		return v
	},
}

var divBuiltin = &adt.Builtin{
	Name:   "div",
	Params: []adt.Param{intParam, intParam},
	Result: adt.IntKind,
	Func: func(c *adt.OpContext, args []adt.Value) adt.Expr {
		const name = "argument to div builtin"

		return intDivOp(c, (*adt.OpContext).IntDiv, name, args)
	},
}

var modBuiltin = &adt.Builtin{
	Name:   "mod",
	Params: []adt.Param{intParam, intParam},
	Result: adt.IntKind,
	Func: func(c *adt.OpContext, args []adt.Value) adt.Expr {
		const name = "argument to mod builtin"

		return intDivOp(c, (*adt.OpContext).IntMod, name, args)
	},
}

var quoBuiltin = &adt.Builtin{
	Name:   "quo",
	Params: []adt.Param{intParam, intParam},
	Result: adt.IntKind,
	Func: func(c *adt.OpContext, args []adt.Value) adt.Expr {
		const name = "argument to quo builtin"

		return intDivOp(c, (*adt.OpContext).IntQuo, name, args)
	},
}

var remBuiltin = &adt.Builtin{
	Name:   "rem",
	Params: []adt.Param{intParam, intParam},
	Result: adt.IntKind,
	Func: func(c *adt.OpContext, args []adt.Value) adt.Expr {
		const name = "argument to rem builtin"

		return intDivOp(c, (*adt.OpContext).IntRem, name, args)
	},
}

type intFunc func(c *adt.OpContext, x, y *adt.Num) adt.Value

func intDivOp(c *adt.OpContext, fn intFunc, name string, args []adt.Value) adt.Value {
	a := c.Num(args[0], name)
	b := c.Num(args[1], name)

	if c.HasErr() {
		return nil
	}

	return fn(c, a, b)
}
