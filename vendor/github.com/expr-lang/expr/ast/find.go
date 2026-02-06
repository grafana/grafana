package ast

func Find(node Node, fn func(node Node) bool) Node {
	v := &finder{fn: fn}
	Walk(&node, v)
	return v.node
}

type finder struct {
	node Node
	fn   func(node Node) bool
}

func (f *finder) Visit(node *Node) {
	if f.fn(*node) {
		f.node = *node
	}
}
