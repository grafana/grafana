package cuetsy

import (
	"bytes"
	"fmt"
	"math/bits"

	"cuelang.org/go/cue"
	"github.com/xlab/treeprint"
)

type exprNode struct {
	// The parent node - backlink up the tree. The contained cue.Value in that node either:
	//   - Returns this node (and possibly others) when its Expr() method is called.
	//   - Is the return from calling Default() on the parent cue.Value
	//   - Is the return from calling cue.Dereference() on the parent cue.Value
	parent *exprNode
	// The cue.Value representing this node.
	self cue.Value
	// The op produced from calling Expr() on self.
	op cue.Op
	// Child nodes returned from calling self.Expr()
	children []*exprNode

	// The default value for this node. nil if there is no default.
	dfault *exprNode
	// Indicator that the node came from a default
	isdefault bool

	// The underlying value to which self is a reference. nil if self is not a reference.
	ref *exprNode
	// Path to the referenced value
	refpath cue.Path
	// Indicator that the node is part of the tree through dereferencing
	isref bool
}

func exprTree(v cue.Value) *exprNode {
	op, args := v.Expr()
	dv, has := v.Default()
	_, path := v.ReferencePath()

	n := &exprNode{
		op:   op,
		self: v,
	}

	var doargs, dodefault bool
	switch v.IncompleteKind() {
	case cue.ListKind:
		dodefault = has && !v.Equals(dv)
		doargs = op != cue.NoOp || dodefault
	case cue.StructKind:
		doargs = op != cue.NoOp || has
		dodefault = has
	default:
		doargs = op != cue.NoOp || has
		dodefault = has
	}

	if dodefault {
		n.dfault = exprTree(dv)
		n.dfault.parent = n
		n.dfault.isdefault = true
	}

	if len(path.Selectors()) > 0 {
		n.ref = exprTree(cue.Dereference(v))
		n.refpath = path
		n.ref.parent = n
		n.ref.isref = true
	}

	if doargs {
		for _, cv := range args {
			cn := exprTree(cv)
			cn.parent = n
			n.children = append(n.children, cn)
		}
	}

	return n
}

func (n *exprNode) Walk(f func(x *exprNode) bool) {
	if !f(n) {
		return
	}

	if n.ref != nil {
		n.ref.Walk(f)
	}
	for _, c := range n.children {
		c.Walk(f)
	}

	if n.dfault != nil {
		n.dfault.Walk(f)
	}
}

func (n *exprNode) String() string {
	tp := treeprint.NewWithRoot(n.printSelf())
	n.treeprint(tp)
	return tp.String()
}

func (n *exprNode) treeprint(tp treeprint.Tree) {
	if n.isLeaf() {
		if !n.isRoot() {
			tp.AddNode(n.printSelf())
		}
		return
	}

	var b treeprint.Tree
	if n.isRoot() {
		b = tp
		tp.SetMetaValue(n.opString())
	} else {
		b = tp.AddMetaBranch(n.opString(), n.printSelf())
	}

	for _, cn := range n.children {
		cn.treeprint(b)
	}
	if n.ref != nil {
		// n.ref.treeprint(b.AddMetaBranch(fmt.Sprintf("ref:%s", n.refpath), n.ref.kindStr()))
		n.ref.treeprint(b.AddMetaBranch(fmt.Sprintf("ref:%s", n.refpath), ""))
	}

	if n.dfault != nil {
		n.dfault.treeprint(b.AddMetaBranch("*", ""))
	}
}

func (n *exprNode) printSelf() string {
	return fmt.Sprintf("%s%s", n.kindStr(), n.attrStr())
}

func (n *exprNode) opString() string {
	return n.op.String()
}

func (n *exprNode) isRoot() bool {
	return n.parent == nil && !n.isref && !n.isdefault
}

func (n *exprNode) isLeaf() bool {
	return n.ref == nil && n.dfault == nil && len(n.children) == 0
}

func (n *exprNode) kindStr() string {
	switch n.self.Kind() {
	case cue.BottomKind, cue.StructKind, cue.ListKind:
		ik := n.self.IncompleteKind()
		if bits.OnesCount16(uint16(ik)) != 1 {
			return ik.String()
		}
		if ik != cue.ListKind {
			return fmt.Sprintf("(%s)", ik.String())
		}

		l := n.self.Len()
		if l.IsConcrete() {
			return "(olist)"
		} else {
			return "(clist)"
		}
	default:
		str := fmt.Sprint(n.self)
		if len(str) < 12 {
			return str
		}
		return str[:12] + "..."
	}
}

func (n *exprNode) attrStr() string {
	attrs := n.self.Attributes(cue.ValueAttr)
	var buf bytes.Buffer
	for _, attr := range attrs {
		fmt.Fprintf(&buf, " @%s(%s)", attr.Name(), attr.Contents())
	}
	return buf.String()
}
