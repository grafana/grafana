package optimizer

import (
	"fmt"

	. "github.com/expr-lang/expr/ast"
)

type sumArray struct{}

func (*sumArray) Visit(node *Node) {
	if sumBuiltin, ok := (*node).(*BuiltinNode); ok &&
		sumBuiltin.Name == "sum" &&
		len(sumBuiltin.Arguments) == 1 {
		if array, ok := sumBuiltin.Arguments[0].(*ArrayNode); ok &&
			len(array.Nodes) >= 2 {
			patchCopyType(node, sumArrayFold(array))
		}
	}
}

func sumArrayFold(array *ArrayNode) *BinaryNode {
	if len(array.Nodes) > 2 {
		return &BinaryNode{
			Operator: "+",
			Left:     array.Nodes[0],
			Right:    sumArrayFold(&ArrayNode{Nodes: array.Nodes[1:]}),
		}
	} else if len(array.Nodes) == 2 {
		return &BinaryNode{
			Operator: "+",
			Left:     array.Nodes[0],
			Right:    array.Nodes[1],
		}
	}
	panic(fmt.Errorf("sumArrayFold: invalid array length %d", len(array.Nodes)))
}
