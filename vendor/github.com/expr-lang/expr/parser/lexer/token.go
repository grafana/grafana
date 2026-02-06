package lexer

import (
	"fmt"

	"github.com/expr-lang/expr/file"
)

type Kind string

const (
	Identifier Kind = "Identifier"
	Number     Kind = "Number"
	String     Kind = "String"
	Operator   Kind = "Operator"
	Bracket    Kind = "Bracket"
	EOF        Kind = "EOF"
)

type Token struct {
	file.Location
	Kind  Kind
	Value string
}

func (t Token) String() string {
	if t.Value == "" {
		return string(t.Kind)
	}
	return fmt.Sprintf("%s(%#v)", t.Kind, t.Value)
}

func (t Token) Is(kind Kind, values ...string) bool {
	if kind != t.Kind {
		return false
	}
	for _, v := range values {
		if v == t.Value {
			return true
		}
	}
	return len(values) == 0
}
