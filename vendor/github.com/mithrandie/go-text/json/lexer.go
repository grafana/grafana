package json

import (
	"fmt"
)

type Lexer struct {
	Scanner
	structure Structure
	token     Token
	err       error
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
			l.err = NewSyntaxError("unexpected termination", l.token)
		} else {
			l.err = NewSyntaxError(fmt.Sprintf("unexpected token %q", l.token.Literal), l.token)
		}
	} else {
		l.err = NewSyntaxError(e, l.token)
	}
}

type Token struct {
	Token   int
	Literal string
	Line    int
	Column  int
}

type SyntaxError struct {
	Line    int
	Column  int
	Message string
}

func (e SyntaxError) Error() string {
	return e.Message
}

func NewSyntaxError(message string, token Token) error {
	return &SyntaxError{
		Line:    token.Line,
		Column:  token.Column,
		Message: message,
	}
}
