package ast

import (
	"fmt"
)

type Position struct {
	Source string
	Line   int
	Column int
}

type Token struct {
	Type int
	Name string
	Str  string
	Pos  Position
}

func (self *Token) String() string {
	return fmt.Sprintf("<type:%v, str:%v>", self.Name, self.Str)
}
