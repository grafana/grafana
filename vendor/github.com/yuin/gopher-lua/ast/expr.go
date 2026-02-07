package ast

type Expr interface {
	PositionHolder
	exprMarker()
}

type ExprBase struct {
	Node
}

func (expr *ExprBase) exprMarker() {}

/* ConstExprs {{{ */

type ConstExpr interface {
	Expr
	constExprMarker()
}

type ConstExprBase struct {
	ExprBase
}

func (expr *ConstExprBase) constExprMarker() {}

type TrueExpr struct {
	ConstExprBase
}

type FalseExpr struct {
	ConstExprBase
}

type NilExpr struct {
	ConstExprBase
}

type NumberExpr struct {
	ConstExprBase

	Value string
}

type StringExpr struct {
	ConstExprBase

	Value string
}

/* ConstExprs }}} */

type Comma3Expr struct {
	ExprBase
	AdjustRet bool
}

type IdentExpr struct {
	ExprBase

	Value string
}

type AttrGetExpr struct {
	ExprBase

	Object Expr
	Key    Expr
}

type TableExpr struct {
	ExprBase

	Fields []*Field
}

type FuncCallExpr struct {
	ExprBase

	Func      Expr
	Receiver  Expr
	Method    string
	Args      []Expr
	AdjustRet bool
}

type LogicalOpExpr struct {
	ExprBase

	Operator string
	Lhs      Expr
	Rhs      Expr
}

type RelationalOpExpr struct {
	ExprBase

	Operator string
	Lhs      Expr
	Rhs      Expr
}

type StringConcatOpExpr struct {
	ExprBase

	Lhs Expr
	Rhs Expr
}

type ArithmeticOpExpr struct {
	ExprBase

	Operator string
	Lhs      Expr
	Rhs      Expr
}

type UnaryMinusOpExpr struct {
	ExprBase
	Expr Expr
}

type UnaryNotOpExpr struct {
	ExprBase
	Expr Expr
}

type UnaryLenOpExpr struct {
	ExprBase
	Expr Expr
}

type FunctionExpr struct {
	ExprBase

	ParList *ParList
	Stmts   []Stmt
}
