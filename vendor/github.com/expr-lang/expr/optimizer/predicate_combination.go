package optimizer

import (
	. "github.com/expr-lang/expr/ast"
	"github.com/expr-lang/expr/parser/operator"
)

/*
predicateCombination is a visitor that combines multiple predicate calls into a single call.
For example, the following expression:

	all(x, x > 1) && all(x, x < 10) -> all(x, x > 1 && x < 10)
	any(x, x > 1) || any(x, x < 10) -> any(x, x > 1 || x < 10)
	none(x, x > 1) && none(x, x < 10) -> none(x, x > 1 || x < 10)
*/
type predicateCombination struct{}

func (v *predicateCombination) Visit(node *Node) {
	if op, ok := (*node).(*BinaryNode); ok && operator.IsBoolean(op.Operator) {
		if left, ok := op.Left.(*BuiltinNode); ok {
			if combinedOp, ok := combinedOperator(left.Name, op.Operator); ok {
				if right, ok := op.Right.(*BuiltinNode); ok && right.Name == left.Name {
					if left.Arguments[0].Type() == right.Arguments[0].Type() && left.Arguments[0].String() == right.Arguments[0].String() {
						predicate := &PredicateNode{
							Node: &BinaryNode{
								Operator: combinedOp,
								Left:     left.Arguments[1].(*PredicateNode).Node,
								Right:    right.Arguments[1].(*PredicateNode).Node,
							},
						}
						v.Visit(&predicate.Node)
						patchCopyType(node, &BuiltinNode{
							Name: left.Name,
							Arguments: []Node{
								left.Arguments[0],
								predicate,
							},
						})
					}
				}
			}
		}
	}
}

func combinedOperator(fn, op string) (string, bool) {
	switch {
	case fn == "all" && (op == "and" || op == "&&"):
		return op, true
	case fn == "any" && (op == "or" || op == "||"):
		return op, true
	case fn == "none" && (op == "and" || op == "&&"):
		switch op {
		case "and":
			return "or", true
		case "&&":
			return "||", true
		}
	}
	return "", false
}
