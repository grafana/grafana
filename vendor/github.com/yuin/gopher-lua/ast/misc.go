package ast

type Field struct {
	Key   Expr
	Value Expr
}

type ParList struct {
	HasVargs bool
	Names    []string
}

type FuncName struct {
	Func     Expr
	Receiver Expr
	Method   string
}
