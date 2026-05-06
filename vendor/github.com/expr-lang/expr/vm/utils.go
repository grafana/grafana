package vm

import (
	"reflect"
	"time"
)

type (
	Function     = func(params ...any) (any, error)
	SafeFunction = func(params ...any) (any, uint, error)
)

var (
	errorType = reflect.TypeOf((*error)(nil)).Elem()
)

type Scope struct {
	Array reflect.Value
	Index int
	Len   int
	Count int
	Acc   any
}

type groupBy = map[any][]any

type Span struct {
	Name       string  `json:"name"`
	Expression string  `json:"expression"`
	Duration   int64   `json:"duration"`
	Children   []*Span `json:"children"`
	start      time.Time
}

func GetSpan(program *Program) *Span {
	return program.span
}
