package optimizer

import (
	. "github.com/expr-lang/expr/ast"
)

type filterMap struct{}

func (*filterMap) Visit(node *Node) {
	if mapBuiltin, ok := (*node).(*BuiltinNode); ok &&
		mapBuiltin.Name == "map" &&
		len(mapBuiltin.Arguments) == 2 &&
		Find(mapBuiltin.Arguments[1], isIndexPointer) == nil {
		if predicate, ok := mapBuiltin.Arguments[1].(*PredicateNode); ok {
			if filter, ok := mapBuiltin.Arguments[0].(*BuiltinNode); ok &&
				filter.Name == "filter" &&
				filter.Map == nil /* not already optimized */ {
				patchCopyType(node, &BuiltinNode{
					Name:      "filter",
					Arguments: filter.Arguments,
					Map:       predicate.Node,
				})
			}
		}
	}
}

func isIndexPointer(node Node) bool {
	if pointer, ok := node.(*PointerNode); ok && pointer.Name == "index" {
		return true
	}
	return false
}
