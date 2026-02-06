package optimizer

import (
	. "github.com/expr-lang/expr/ast"
)

type filterFirst struct{}

func (*filterFirst) Visit(node *Node) {
	if member, ok := (*node).(*MemberNode); ok && member.Property != nil && !member.Optional {
		if prop, ok := member.Property.(*IntegerNode); ok && prop.Value == 0 {
			if filter, ok := member.Node.(*BuiltinNode); ok &&
				filter.Name == "filter" &&
				len(filter.Arguments) == 2 {
				patchCopyType(node, &BuiltinNode{
					Name:      "find",
					Arguments: filter.Arguments,
					Throws:    true, // to match the behavior of filter()[0]
					Map:       filter.Map,
				})
			}
		}
	}
	if first, ok := (*node).(*BuiltinNode); ok &&
		first.Name == "first" &&
		len(first.Arguments) == 1 {
		if filter, ok := first.Arguments[0].(*BuiltinNode); ok &&
			filter.Name == "filter" &&
			len(filter.Arguments) == 2 {
			patchCopyType(node, &BuiltinNode{
				Name:      "find",
				Arguments: filter.Arguments,
				Throws:    false, // as first() will return nil if not found
				Map:       filter.Map,
			})
		}
	}
}
