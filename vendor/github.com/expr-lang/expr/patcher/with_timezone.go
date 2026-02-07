package patcher

import (
	"time"

	"github.com/expr-lang/expr/ast"
)

// WithTimezone passes Location to date() and now() functions.
type WithTimezone struct {
	Location *time.Location
}

func (t WithTimezone) Visit(node *ast.Node) {
	if btin, ok := (*node).(*ast.BuiltinNode); ok {
		switch btin.Name {
		case "date", "now":
			loc := &ast.ConstantNode{Value: t.Location}
			ast.Patch(node, &ast.BuiltinNode{
				Name:      btin.Name,
				Arguments: append([]ast.Node{loc}, btin.Arguments...),
			})
		}
	}
}
