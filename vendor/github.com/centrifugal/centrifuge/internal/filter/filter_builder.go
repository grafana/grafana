package filter

import "github.com/centrifugal/protocol"

func Eq(key, val string) *protocol.FilterNode {
	return &protocol.FilterNode{Op: "", Key: key, Cmp: CompareEQ, Val: val}
}

func Neq(key, val string) *protocol.FilterNode {
	return &protocol.FilterNode{Op: "", Key: key, Cmp: CompareNotEQ, Val: val}
}

func In(key string, vals ...string) *protocol.FilterNode {
	return &protocol.FilterNode{Op: "", Key: key, Cmp: CompareIn, Vals: vals}
}

func Nin(key string, vals ...string) *protocol.FilterNode {
	return &protocol.FilterNode{Op: "", Key: key, Cmp: CompareNotIn, Vals: vals}
}

func Gt(key, val string) *protocol.FilterNode {
	return &protocol.FilterNode{Op: "", Key: key, Cmp: CompareGT, Val: val}
}

func Gte(key, val string) *protocol.FilterNode {
	return &protocol.FilterNode{Op: "", Key: key, Cmp: CompareGTE, Val: val}
}

func Lt(key, val string) *protocol.FilterNode {
	return &protocol.FilterNode{Op: "", Key: key, Cmp: CompareLT, Val: val}
}

func Lte(key, val string) *protocol.FilterNode {
	return &protocol.FilterNode{Op: "", Key: key, Cmp: CompareLTE, Val: val}
}

func Contains(key, val string) *protocol.FilterNode {
	return &protocol.FilterNode{Op: "", Key: key, Cmp: CompareContains, Val: val}
}

func Starts(key, val string) *protocol.FilterNode {
	return &protocol.FilterNode{Op: "", Key: key, Cmp: CompareStartsWith, Val: val}
}

func Ends(key, val string) *protocol.FilterNode {
	return &protocol.FilterNode{Op: "", Key: key, Cmp: CompareEndsWith, Val: val}
}

func Exists(key string) *protocol.FilterNode {
	return &protocol.FilterNode{Op: "", Key: key, Cmp: CompareExists}
}

func NotExists(key string) *protocol.FilterNode {
	return &protocol.FilterNode{Op: "", Key: key, Cmp: CompareNotExists}
}

// And combines multiple FilterNode children with logical AND
func And(nodes ...*protocol.FilterNode) *protocol.FilterNode {
	return &protocol.FilterNode{Op: OpAnd, Nodes: nodes}
}

// Or combines multiple FilterNode children with logical OR
func Or(nodes ...*protocol.FilterNode) *protocol.FilterNode {
	return &protocol.FilterNode{Op: OpOr, Nodes: nodes}
}

// Not negates a single FilterNode
func Not(node *protocol.FilterNode) *protocol.FilterNode {
	return &protocol.FilterNode{Op: OpNot, Nodes: []*protocol.FilterNode{node}}
}
