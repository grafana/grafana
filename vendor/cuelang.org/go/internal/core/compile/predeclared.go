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
	"strconv"

	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/token"
	"cuelang.org/go/internal/core/adt"
)

func predeclared(n *ast.Ident) adt.Expr {
	// TODO: consider supporting GraphQL-style names:
	// String, Bytes, Boolean, Integer, Number.
	// These names will not conflict with idiomatic camel-case JSON.
	switch n.Name {
	case "string", "__string":
		return &adt.BasicType{Src: n, K: adt.StringKind}
	case "bytes", "__bytes":
		return &adt.BasicType{Src: n, K: adt.BytesKind}
	case "bool", "__bool":
		return &adt.BasicType{Src: n, K: adt.BoolKind}
	case "int", "__int":
		return &adt.BasicType{Src: n, K: adt.IntKind}
	case "float", "__float":
		return &adt.BasicType{Src: n, K: adt.FloatKind}
	case "number", "__number":
		return &adt.BasicType{Src: n, K: adt.NumKind}

	case "len", "__len":
		return lenBuiltin
	case "close", "__close":
		return closeBuiltin
	case "and", "__and":
		return andBuiltin
	case "or", "__or":
		return orBuiltin
	case "div", "__div":
		return divBuiltin
	case "mod", "__mod":
		return modBuiltin
	case "quo", "__quo":
		return quoBuiltin
	case "rem", "__rem":
		return remBuiltin
	}

	if r, ok := predefinedRanges[n.Name]; ok {
		return r
	}

	return nil
}

// LookupRange returns a CUE expressions for the given predeclared identifier
// representing a range, such as uint8, int128, and float64.
func LookupRange(name string) adt.Expr {
	return predefinedRanges[name]
}

var predefinedRanges = map[string]adt.Expr{
	"rune":  mkIntRange("0", strconv.Itoa(0x10FFFF)),
	"int8":  mkIntRange("-128", "127"),
	"int16": mkIntRange("-32768", "32767"),
	"int32": mkIntRange("-2147483648", "2147483647"),
	"int64": mkIntRange("-9223372036854775808", "9223372036854775807"),
	"int128": mkIntRange(
		"-170141183460469231731687303715884105728",
		"170141183460469231731687303715884105727"),

	// Do not include an alias for "byte", as it would be too easily confused
	// with the builtin "bytes".
	"uint":    mkUint(),
	"uint8":   mkIntRange("0", "255"),
	"uint16":  mkIntRange("0", "65535"),
	"uint32":  mkIntRange("0", "4294967295"),
	"uint64":  mkIntRange("0", "18446744073709551615"),
	"uint128": mkIntRange("0", "340282366920938463463374607431768211455"),

	// 2**127 * (2**24 - 1) / 2**23
	"float32": mkFloatRange(
		"-3.40282346638528859811704183484516925440e+38",
		"3.40282346638528859811704183484516925440e+38",
	),
	// 2**1023 * (2**53 - 1) / 2**52
	"float64": mkFloatRange(
		"-1.797693134862315708145274237317043567981e+308",
		"1.797693134862315708145274237317043567981e+308",
	),
}

func init() {
	for k, v := range predefinedRanges {
		predefinedRanges["__"+k] = v
	}
}

// TODO: use an adt.BoundValue here. and conjunctions here.

func mkUint() adt.Expr {
	from := newBound(adt.GreaterEqualOp, adt.IntKind, parseInt("0"))
	ident := ast.NewIdent("__int")
	src := ast.NewBinExpr(token.AND, ident, from.Src)
	return &adt.Conjunction{
		Src: src,
		Values: []adt.Value{
			&adt.BasicType{Src: ident, K: adt.IntKind}, from,
		},
	}
}

func mkIntRange(a, b string) adt.Expr {
	from := newBound(adt.GreaterEqualOp, adt.IntKind, parseInt(a))
	to := newBound(adt.LessEqualOp, adt.IntKind, parseInt(b))
	ident := ast.NewIdent("__int")
	src := ast.NewBinExpr(token.AND, ident, from.Src, to.Src)
	return &adt.Conjunction{
		Src: src,
		Values: []adt.Value{
			&adt.BasicType{Src: ident, K: adt.IntKind}, from, to,
		},
	}
}

func mkFloatRange(a, b string) adt.Expr {
	from := newBound(adt.GreaterEqualOp, adt.NumKind, parseFloat(a))
	to := newBound(adt.LessEqualOp, adt.NumKind, parseFloat(b))
	src := ast.NewBinExpr(token.AND, from.Src, to.Src)
	return &adt.Conjunction{Src: src, Values: []adt.Value{from, to}}
}

func newBound(op adt.Op, k adt.Kind, v adt.Value) *adt.BoundValue {
	src := &ast.UnaryExpr{Op: op.Token(), X: v.Source().(ast.Expr)}
	return &adt.BoundValue{Src: src, Op: op, Value: v}
}

func parseInt(s string) *adt.Num {
	n := parseNum(adt.IntKind, s)
	n.Src = &ast.BasicLit{Kind: token.INT, Value: s}
	return n
}

func parseFloat(s string) *adt.Num {
	n := parseNum(adt.FloatKind, s)
	n.Src = &ast.BasicLit{Kind: token.FLOAT, Value: s}
	return n
}

func parseNum(k adt.Kind, s string) *adt.Num {
	num := &adt.Num{K: k}
	_, _, err := num.X.SetString(s)
	if err != nil {
		panic(err)
	}
	return num
}
