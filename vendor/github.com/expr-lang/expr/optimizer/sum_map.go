package optimizer

import (
	. "github.com/expr-lang/expr/ast"
)

type sumMap struct{}

func (*sumMap) Visit(node *Node) {
	if sumBuiltin, ok := (*node).(*BuiltinNode); ok &&
		sumBuiltin.Name == "sum" &&
		len(sumBuiltin.Arguments) == 1 {
		if mapBuiltin, ok := sumBuiltin.Arguments[0].(*BuiltinNode); ok &&
			mapBuiltin.Name == "map" &&
			len(mapBuiltin.Arguments) == 2 {
			patchCopyType(node, &BuiltinNode{
				Name: "sum",
				Arguments: []Node{
					mapBuiltin.Arguments[0],
					mapBuiltin.Arguments[1],
				},
			})
		}
	}
}
