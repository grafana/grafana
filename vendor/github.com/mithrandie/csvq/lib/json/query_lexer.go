package json

import "fmt"

type QueryLexer struct {
	QueryScanner
	query QueryExpression
	token QueryToken
	err   error
}

func (l *QueryLexer) Lex(lval *jqSymType) int {
	tok, err := l.Scan()
	lval.token = tok
	l.token = lval.token

	if err != nil {
		l.Error(err.Error())
	}

	return lval.token.Token
}

func (l *QueryLexer) Error(e string) {
	if e == "syntax error" {
		if l.token.Token == EOF {
			l.err = NewQuerySyntaxError(fmt.Sprintf("column %d: unexpected termination", l.token.Column), l.token)
		} else {
			l.err = NewQuerySyntaxError(fmt.Sprintf("column %d: unexpected token %q", l.token.Column, l.token.Literal), l.token)
		}
	} else {
		l.err = NewQuerySyntaxError(fmt.Sprintf("column %d: %s", l.token.Column, e), l.token)
	}
}

type QueryToken struct {
	Token   int
	Literal string
	Column  int
}

type QuerySyntaxError struct {
	Char    int
	Message string
}

func (e QuerySyntaxError) Error() string {
	return e.Message
}

func NewQuerySyntaxError(message string, token QueryToken) error {
	return &QuerySyntaxError{
		Char:    token.Column,
		Message: message,
	}
}
