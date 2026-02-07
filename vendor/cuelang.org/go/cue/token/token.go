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

// Package token defines constants representing the lexical tokens of the Go
// programming language and basic operations on tokens (printing, predicates).
package token // import "cuelang.org/go/cue/token"

import "strconv"

// Token is the set of lexical tokens of the CUE configuration language.
type Token int

// The list of tokens.
const (
	// Special tokens
	ILLEGAL Token = iota
	EOF
	COMMENT
	ATTRIBUTE // @foo(bar,baz=4)

	literalBeg
	// Identifiers and basic type literals
	// (these tokens stand for classes of literals)
	IDENT // main, _tmp
	INT   // 12_345Mi, 0700, 0xdeadbeef, 1.2M
	FLOAT // 123.45,
	// DURATION // 3m4s TODO
	STRING        // "abc"
	INTERPOLATION // a part of a template string, e.g. `"age: \(`
	BOTTOM        // _|_

	literalEnd

	operatorBeg
	// Operators and delimiters
	ADD // +
	SUB // -
	MUL // *
	POW // ^
	QUO // /

	IQUO // quo
	IREM // rem
	IDIV // div
	IMOD // mod

	AND // &
	OR  // |

	LAND // &&
	LOR  // ||

	BIND  // =
	EQL   // ==
	LSS   // <
	GTR   // >
	NOT   // !
	ARROW // <-

	NEQ // !=
	LEQ // <=
	GEQ // >=

	MAT  // =~
	NMAT // !~

	LPAREN   // (
	LBRACK   // [
	LBRACE   // {
	COMMA    // ,
	PERIOD   // .
	ELLIPSIS // ...

	RPAREN    // )
	RBRACK    // ]
	RBRACE    // }
	SEMICOLON // ;
	COLON     // :
	OPTION    // ?
	operatorEnd

	keywordBeg

	IF
	FOR
	IN
	LET
	FUNC // experimental

	TRUE
	FALSE
	NULL

	keywordEnd
)

var tokens = [...]string{
	ILLEGAL: "ILLEGAL",

	EOF:     "EOF",
	COMMENT: "COMMENT",

	IDENT:         "IDENT",
	INT:           "INT",
	FLOAT:         "FLOAT",
	STRING:        "STRING",
	INTERPOLATION: "INTERPOLATION",
	ATTRIBUTE:     "ATTRIBUTE",

	ADD: "+",
	SUB: "-",
	MUL: "*",
	POW: "^",
	QUO: "/",

	IQUO: "quo",
	IREM: "rem",
	IDIV: "div",
	IMOD: "mod",

	AND: "&",
	OR:  "|",

	LAND: "&&",
	LOR:  "||",

	BIND:  "=",
	EQL:   "==",
	LSS:   "<",
	GTR:   ">",
	NOT:   "!",
	ARROW: "<-",

	NEQ: "!=",
	LEQ: "<=",
	GEQ: ">=",

	MAT:  "=~",
	NMAT: "!~",

	LPAREN:   "(",
	LBRACK:   "[",
	LBRACE:   "{",
	COMMA:    ",",
	PERIOD:   ".",
	ELLIPSIS: "...",

	RPAREN:    ")",
	RBRACK:    "]",
	RBRACE:    "}",
	SEMICOLON: ";",
	COLON:     ":",
	OPTION:    "?",

	BOTTOM: "_|_",

	FALSE: "false",
	TRUE:  "true",
	NULL:  "null",

	FOR:  "for",
	IF:   "if",
	IN:   "in",
	LET:  "let",
	FUNC: "func",
}

// String returns the string corresponding to the token tok.
// For operators, delimiters, and keywords the string is the actual
// token character sequence (e.g., for the token ADD, the string is
// "+"). For all other tokens the string corresponds to the token
// constant name (e.g. for the token IDENT, the string is "IDENT").
func (tok Token) String() string {
	s := ""
	if 0 <= tok && tok < Token(len(tokens)) {
		s = tokens[tok]
	}
	if s == "" {
		s = "token(" + strconv.Itoa(int(tok)) + ")"
	}
	return s
}

// A set of constants for precedence-based expression parsing.
// Non-operators have lowest precedence, followed by operators
// starting with precedence 1 up to unary operators. The highest
// precedence serves as "catch-all" precedence for selector,
// indexing, and other operator and delimiter tokens.
const (
	LowestPrec  = lowestPrec
	UnaryPrec   = unaryPrec
	HighestPrec = highestPrec
)

const (
	lowestPrec  = 0 // non-operators
	unaryPrec   = 8
	highestPrec = 9
)

// Precedence returns the operator precedence of the binary
// operator op. If op is not a binary operator, the result
// is LowestPrecedence.
func (tok Token) Precedence() int {
	switch tok {
	case OR:
		return 1
	case AND:
		return 2
	case LOR:
		return 3
	case LAND:
		return 4
	case EQL, NEQ, LSS, LEQ, GTR, GEQ, MAT, NMAT:
		return 5
	case ADD, SUB:
		return 6
	case MUL, QUO, IDIV, IMOD, IQUO, IREM:
		return 7
	}
	return lowestPrec
}

var keywords map[string]Token

func init() {
	keywords = make(map[string]Token)
	for i := keywordBeg + 1; i < keywordEnd; i++ {
		keywords[tokens[i]] = i
	}
}

// Lookup maps an identifier to its keyword token or IDENT (if not a keyword).
func Lookup(ident string) Token {
	if tok, isKeyword := keywords[ident]; isKeyword {
		return tok
	}
	return IDENT
}

// Predicates

// IsLiteral returns true for tokens corresponding to identifiers
// and basic type literals; it returns false otherwise.
func (tok Token) IsLiteral() bool { return literalBeg < tok && tok < literalEnd }

// IsOperator returns true for tokens corresponding to operators and
// delimiters; it returns false otherwise.
func (tok Token) IsOperator() bool { return operatorBeg < tok && tok < operatorEnd }

// IsKeyword returns true for tokens corresponding to keywords;
// it returns false otherwise.
func (tok Token) IsKeyword() bool { return keywordBeg < tok && tok < keywordEnd }
