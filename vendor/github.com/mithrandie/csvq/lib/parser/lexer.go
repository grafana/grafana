package parser

import (
	"fmt"
)

type Lexer struct {
	Scanner
	program []Statement
	token   Token
	err     error
}

func (l *Lexer) Lex(lval *yySymType) int {
	tok, err := l.Scan()
	lval.token = tok
	l.token = lval.token

	if err != nil {
		l.Error(err.Error())
	}

	return lval.token.Token
}

func (l *Lexer) Error(e string) {
	if e == "syntax error" {
		if l.token.Token == EOF {
			l.err = NewSyntaxError(fmt.Sprintf("%s: unexpected termination", e), l.token)
		} else {
			l.err = NewSyntaxError(fmt.Sprintf("%s: unexpected token %q", e, l.token.Literal), l.token)
		}
	} else {
		l.err = NewSyntaxError(fmt.Sprintf("%s", e), l.token)
	}
}

type Token struct {
	Token         int
	Literal       string
	Quoted        bool
	HolderOrdinal int
	Line          int
	Char          int
	SourceFile    string
}

func (t Token) IsEmpty() bool {
	return t.Token == 0
}

func (t Token) String() string {
	if lit, err := KeywordLiteral(t.Token); err == nil {
		return lit
	}
	return t.Literal
}

type SyntaxError struct {
	SourceFile string
	Line       int
	Char       int
	Message    string
}

func (e SyntaxError) Error() string {
	return e.Message
}

func NewSyntaxError(message string, token Token) error {
	return &SyntaxError{
		SourceFile: token.SourceFile,
		Line:       token.Line,
		Char:       token.Char,
		Message:    message,
	}
}
