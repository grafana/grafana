package analysis

import (
	"go/ast"
	"go/token"
)

func HasBreak(n ast.Node) bool {
	v := hasBreakVisitor{}
	ast.Walk(&v, n)
	return v.hasBreak
}

type hasBreakVisitor struct {
	hasBreak bool
}

func (v *hasBreakVisitor) Visit(node ast.Node) (w ast.Visitor) {
	if v.hasBreak {
		return nil
	}
	switch n := node.(type) {
	case *ast.BranchStmt:
		if n.Tok == token.BREAK && n.Label == nil {
			v.hasBreak = true
			return nil
		}
	case *ast.ForStmt, *ast.RangeStmt, *ast.SwitchStmt, *ast.TypeSwitchStmt, *ast.SelectStmt, ast.Expr:
		return nil
	}
	return v
}
