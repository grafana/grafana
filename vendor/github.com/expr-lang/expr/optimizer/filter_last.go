package optimizer

import (
	. "github.com/expr-lang/expr/ast"
)

type filterLast struct{}

func (*filterLast) Visit(node *Node) {
	if member, ok := (*node).(*MemberNode); ok && member.Property != nil && !member.Optional {
		if prop, ok := member.Property.(*IntegerNode); ok && prop.Value == -1 {
			if filter, ok := member.Node.(*BuiltinNode); ok &&
				filter.Name == "filter" &&
				len(filter.Arguments) == 2 {
				patchCopyType(node, &BuiltinNode{
					Name:      "findLast",
					Arguments: filter.Arguments,
					Throws:    true, // to match the behavior of filter()[-1]
					Map:       filter.Map,
				})
			}
		}
	}
	if first, ok := (*node).(*BuiltinNode); ok &&
		first.Name == "last" &&
		len(first.Arguments) == 1 {
		if filter, ok := first.Arguments[0].(*BuiltinNode); ok &&
			filter.Name == "filter" &&
			len(filter.Arguments) == 2 {
			patchCopyType(node, &BuiltinNode{
				Name:      "findLast",
				Arguments: filter.Arguments,
				Throws:    false, // as last() will return nil if not found
				Map:       filter.Map,
			})
		}
	}
}
