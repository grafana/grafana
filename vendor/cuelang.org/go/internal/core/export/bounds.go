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
	"cuelang.org/go/cue/ast"
	"cuelang.org/go/internal/core/adt"
	"github.com/cockroachdb/apd/v2"
)

// boundSimplifier simplifies bound values into predeclared identifiers, if
// possible.
type boundSimplifier struct {
	e *exporter

	isInt  bool
	min    *adt.BoundValue
	minNum *adt.Num
	max    *adt.BoundValue
	maxNum *adt.Num
}

func (s *boundSimplifier) add(v adt.Value) (used bool) {
	switch x := v.(type) {
	case *adt.BasicType:
		switch x.K & adt.ScalarKinds {
		case adt.IntKind:
			s.isInt = true
			return true
		}

	case *adt.BoundValue:
		if adt.IsConcrete(x.Value) && x.Kind() == adt.IntKind {
			s.isInt = true
		}
		switch x.Op {
		case adt.GreaterThanOp:
			if n, ok := x.Value.(*adt.Num); ok {
				if s.min == nil || s.minNum.X.Cmp(&n.X) != 1 {
					s.min = x
					s.minNum = n
				}
				return true
			}

		case adt.GreaterEqualOp:
			if n, ok := x.Value.(*adt.Num); ok {
				if s.min == nil || s.minNum.X.Cmp(&n.X) == -1 {
					s.min = x
					s.minNum = n
				}
				return true
			}

		case adt.LessThanOp:
			if n, ok := x.Value.(*adt.Num); ok {
				if s.max == nil || s.maxNum.X.Cmp(&n.X) != -1 {
					s.max = x
					s.maxNum = n
				}
				return true
			}

		case adt.LessEqualOp:
			if n, ok := x.Value.(*adt.Num); ok {
				if s.max == nil || s.maxNum.X.Cmp(&n.X) == 1 {
					s.max = x
					s.maxNum = n
				}
				return true
			}
		}
	}

	return false
}

type builtinRange struct {
	typ string
	lo  *apd.Decimal
	hi  *apd.Decimal
}

func makeDec(s string) *apd.Decimal {
	d, _, err := apd.NewFromString(s)
	if err != nil {
		panic(err)
	}
	return d
}

func (s *boundSimplifier) expr(ctx *adt.OpContext) (e ast.Expr) {
	if s.min == nil || s.max == nil {
		return nil
	}
	switch {
	case s.isInt:
		t := s.matchRange(intRanges)
		if t != "" {
			e = ast.NewIdent(t)
			break
		}
		if sign := s.minNum.X.Sign(); sign == -1 {
			e = ast.NewIdent("int")

		} else {
			e = ast.NewIdent("uint")
			if sign == 0 && s.min.Op == adt.GreaterEqualOp {
				s.min = nil
				break
			}
		}
		fallthrough
	default:
		t := s.matchRange(floatRanges)
		if t != "" {
			e = wrapBin(e, ast.NewIdent(t), adt.AndOp)
		}
	}

	if s.min != nil {
		e = wrapBin(e, s.e.expr(nil, s.min), adt.AndOp)
	}
	if s.max != nil {
		e = wrapBin(e, s.e.expr(nil, s.max), adt.AndOp)
	}
	return e
}

func (s *boundSimplifier) matchRange(ranges []builtinRange) (t string) {
	for _, r := range ranges {
		if !s.minNum.X.IsZero() && s.min.Op == adt.GreaterEqualOp && s.minNum.X.Cmp(r.lo) == 0 {
			switch s.maxNum.X.Cmp(r.hi) {
			case 0:
				if s.max.Op == adt.LessEqualOp {
					s.max = nil
				}
				s.min = nil
				return r.typ
			case -1:
				if !s.minNum.X.IsZero() {
					s.min = nil
					return r.typ
				}
			case 1:
			}
		} else if s.max.Op == adt.LessEqualOp && s.maxNum.X.Cmp(r.hi) == 0 {
			switch s.minNum.X.Cmp(r.lo) {
			case -1:
			case 0:
				if s.min.Op == adt.GreaterEqualOp {
					s.min = nil
				}
				fallthrough
			case 1:
				s.max = nil
				return r.typ
			}
		}
	}
	return ""
}

var intRanges = []builtinRange{
	{"int8", makeDec("-128"), makeDec("127")},
	{"int16", makeDec("-32768"), makeDec("32767")},
	{"int32", makeDec("-2147483648"), makeDec("2147483647")},
	{"int64", makeDec("-9223372036854775808"), makeDec("9223372036854775807")},
	{"int128", makeDec("-170141183460469231731687303715884105728"),
		makeDec("170141183460469231731687303715884105727")},

	{"uint8", makeDec("0"), makeDec("255")},
	{"uint16", makeDec("0"), makeDec("65535")},
	{"uint32", makeDec("0"), makeDec("4294967295")},
	{"uint64", makeDec("0"), makeDec("18446744073709551615")},
	{"uint128", makeDec("0"), makeDec("340282366920938463463374607431768211455")},

	// {"rune", makeDec("0"), makeDec(strconv.Itoa(0x10FFFF))},
}

var floatRanges = []builtinRange{
	// 2**127 * (2**24 - 1) / 2**23
	{"float32",
		makeDec("-3.40282346638528859811704183484516925440e+38"),
		makeDec("3.40282346638528859811704183484516925440e+38")},

	// 2**1023 * (2**53 - 1) / 2**52
	{"float64",
		makeDec("-1.797693134862315708145274237317043567981e+308"),
		makeDec("1.797693134862315708145274237317043567981e+308")},
}

func wrapBin(a, b ast.Expr, op adt.Op) ast.Expr {
	if a == nil {
		return b
	}
	if b == nil {
		return a
	}
	return ast.NewBinExpr(op.Token(), a, b)
}
