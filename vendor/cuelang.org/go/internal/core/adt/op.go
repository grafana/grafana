// Copyright 2018 The CUE Authors
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

import "cuelang.org/go/cue/token"

// Op indicates the operation at the top of an expression tree of the expression
// use to evaluate a value.
type Op int

func (o Op) String() string {
	return opToString[o]
}

// Values of Op.
const (
	NoOp Op = iota

	AndOp
	OrOp

	SelectorOp
	IndexOp
	SliceOp
	CallOp

	BoolAndOp
	BoolOrOp

	EqualOp
	NotOp
	NotEqualOp
	LessThanOp
	LessEqualOp
	GreaterThanOp
	GreaterEqualOp

	MatchOp
	NotMatchOp

	AddOp
	SubtractOp
	MultiplyOp
	FloatQuotientOp
	IntQuotientOp
	IntRemainderOp
	IntDivideOp
	IntModuloOp

	InterpolationOp
)

var opToString = map[Op]string{
	AndOp:           "&",
	OrOp:            "|",
	BoolAndOp:       "&&",
	BoolOrOp:        "||",
	EqualOp:         "==",
	NotOp:           "!",
	NotEqualOp:      "!=",
	LessThanOp:      "<",
	LessEqualOp:     "<=",
	GreaterThanOp:   ">",
	GreaterEqualOp:  ">=",
	MatchOp:         "=~",
	NotMatchOp:      "!~",
	AddOp:           "+",
	SubtractOp:      "-",
	MultiplyOp:      "*",
	FloatQuotientOp: "/",
	IntQuotientOp:   "quo",
	IntRemainderOp:  "rem",
	IntDivideOp:     "div",
	IntModuloOp:     "mod",

	SelectorOp: ".",
	IndexOp:    "[]",
	SliceOp:    "[:]",
	CallOp:     "()",

	InterpolationOp: `\()`,
}

// OpFromToken converts a token.Token to an Op.
func OpFromToken(t token.Token) Op {
	return tokenMap[t]
}

// Token returns the token.Token corresponding to the Op.
func (op Op) Token() token.Token {
	return opMap[op]
}

var tokenMap = map[token.Token]Op{
	token.OR:  OrOp,  // |
	token.AND: AndOp, // &

	token.ADD: AddOp,           // +
	token.SUB: SubtractOp,      // -
	token.MUL: MultiplyOp,      // *
	token.QUO: FloatQuotientOp, // /

	token.IDIV: IntDivideOp,    // div
	token.IMOD: IntModuloOp,    // mod
	token.IQUO: IntQuotientOp,  // quo
	token.IREM: IntRemainderOp, // rem

	token.LAND: BoolAndOp, // &&
	token.LOR:  BoolOrOp,  // ||

	token.EQL: EqualOp,       // ==
	token.LSS: LessThanOp,    // <
	token.GTR: GreaterThanOp, // >
	token.NOT: NotOp,         // !

	token.NEQ:  NotEqualOp,     // !=
	token.LEQ:  LessEqualOp,    // <=
	token.GEQ:  GreaterEqualOp, // >=
	token.MAT:  MatchOp,        // =~
	token.NMAT: NotMatchOp,     // !~
}

var opMap = map[Op]token.Token{}

func init() {
	for t, o := range tokenMap {
		opMap[o] = t
	}
}
