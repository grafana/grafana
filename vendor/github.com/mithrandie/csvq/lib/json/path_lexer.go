package json

import "fmt"

type PathLexer struct {
	PathScanner
	path  PathExpression
	token PathToken
	err   error
}

func (l *PathLexer) Lex(lval *jpSymType) int {
	tok := l.Scan()

	lval.token = tok
	l.token = lval.token
	return tok.Token
}

func (l *PathLexer) Error(_ string) {
	if l.token.Token == EOF {
		l.err = NewPathSyntaxError("unexpected termination", l.token)
	} else {
		l.err = NewPathSyntaxError(fmt.Sprintf("unexpected token %q", l.token.Literal), l.token)
	}
}

type PathToken struct {
	Token   int
	Literal string
	Column  int
}

type PathSyntaxError struct {
	Column  int
	Message string
}

func (e PathSyntaxError) Error() string {
	return e.Message
}

func NewPathSyntaxError(message string, token PathToken) error {
	return &PathSyntaxError{
		Column:  token.Column,
		Message: message,
	}
}
