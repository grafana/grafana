// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package hclwrite

import (
	"fmt"

	"github.com/google/go-cmp/cmp"
)

// node represents a node in the AST.
type node struct {
	content nodeContent

	list          *nodes
	before, after *node
}

func newNode(c nodeContent) *node {
	return &node{
		content: c,
	}
}

func (n *node) Equal(other *node) bool {
	return cmp.Equal(n.content, other.content)
}

func (n *node) BuildTokens(to Tokens) Tokens {
	return n.content.BuildTokens(to)
}

// Detach removes the receiver from the list it currently belongs to. If the
// node is not currently in a list, this is a no-op.
func (n *node) Detach() {
	if n.list == nil {
		return
	}
	if n.before != nil {
		n.before.after = n.after
	}
	if n.after != nil {
		n.after.before = n.before
	}
	if n.list.first == n {
		n.list.first = n.after
	}
	if n.list.last == n {
		n.list.last = n.before
	}
	n.list = nil
	n.before = nil
	n.after = nil
}

// ReplaceWith removes the receiver from the list it currently belongs to and
// inserts a new node with the given content in its place. If the node is not
// currently in a list, this function will panic.
//
// The return value is the newly-constructed node, containing the given content.
// After this function returns, the reciever is no longer attached to a list.
func (n *node) ReplaceWith(c nodeContent) *node {
	if n.list == nil {
		panic("can't replace node that is not in a list")
	}

	before := n.before
	after := n.after
	list := n.list
	n.before, n.after, n.list = nil, nil, nil

	nn := newNode(c)
	nn.before = before
	nn.after = after
	nn.list = list
	if before != nil {
		before.after = nn
	}
	if after != nil {
		after.before = nn
	}
	return nn
}

func (n *node) assertUnattached() {
	if n.list != nil {
		panic(fmt.Sprintf("attempt to attach already-attached node %#v", n))
	}
}

// nodeContent is the interface type implemented by all AST content types.
type nodeContent interface {
	walkChildNodes(w internalWalkFunc)
	BuildTokens(to Tokens) Tokens
}

// nodes is a list of nodes.
type nodes struct {
	first, last *node
}

func (ns *nodes) BuildTokens(to Tokens) Tokens {
	for n := ns.first; n != nil; n = n.after {
		to = n.BuildTokens(to)
	}
	return to
}

func (ns *nodes) Clear() {
	ns.first = nil
	ns.last = nil
}

func (ns *nodes) Append(c nodeContent) *node {
	n := &node{
		content: c,
	}
	ns.AppendNode(n)
	n.list = ns
	return n
}

func (ns *nodes) AppendNode(n *node) {
	if ns.last != nil {
		n.before = ns.last
		ns.last.after = n
	}
	n.list = ns
	ns.last = n
	if ns.first == nil {
		ns.first = n
	}
}

// Insert inserts a nodeContent at a given position.
// This is just a wrapper for InsertNode. See InsertNode for details.
func (ns *nodes) Insert(pos *node, c nodeContent) *node {
	n := &node{
		content: c,
	}
	ns.InsertNode(pos, n)
	n.list = ns
	return n
}

// InsertNode inserts a node at a given position.
// The first argument is a node reference before which to insert.
// To insert it to an empty list, set position to nil.
func (ns *nodes) InsertNode(pos *node, n *node) {
	if pos == nil {
		// inserts n to empty list.
		ns.first = n
		ns.last = n
	} else {
		// inserts n before pos.
		pos.before.after = n
		n.before = pos.before
		pos.before = n
		n.after = pos
	}

	n.list = ns
}

func (ns *nodes) AppendUnstructuredTokens(tokens Tokens) *node {
	if len(tokens) == 0 {
		return nil
	}
	n := newNode(tokens)
	ns.AppendNode(n)
	n.list = ns
	return n
}

// FindNodeWithContent searches the nodes for a node whose content equals
// the given content. If it finds one then it returns it. Otherwise it returns
// nil.
func (ns *nodes) FindNodeWithContent(content nodeContent) *node {
	for n := ns.first; n != nil; n = n.after {
		if n.content == content {
			return n
		}
	}
	return nil
}

// nodeSet is an unordered set of nodes. It is used to describe a set of nodes
// that all belong to the same list that have some role or characteristic
// in common.
type nodeSet map[*node]struct{}

func newNodeSet() nodeSet {
	return make(nodeSet)
}

func (ns nodeSet) Has(n *node) bool {
	if ns == nil {
		return false
	}
	_, exists := ns[n]
	return exists
}

func (ns nodeSet) Add(n *node) {
	ns[n] = struct{}{}
}

func (ns nodeSet) Remove(n *node) {
	delete(ns, n)
}

func (ns nodeSet) Clear() {
	for n := range ns {
		delete(ns, n)
	}
}

func (ns nodeSet) List() []*node {
	if len(ns) == 0 {
		return nil
	}

	ret := make([]*node, 0, len(ns))

	// Determine which list we are working with. We assume here that all of
	// the nodes belong to the same list, since that is part of the contract
	// for nodeSet.
	var list *nodes
	for n := range ns {
		list = n.list
		break
	}

	// We recover the order by iterating over the whole list. This is not
	// the most efficient way to do it, but our node lists should always be
	// small so not worth making things more complex.
	for n := list.first; n != nil; n = n.after {
		if ns.Has(n) {
			ret = append(ret, n)
		}
	}
	return ret
}

// FindNodeWithContent searches the nodes for a node whose content equals
// the given content. If it finds one then it returns it. Otherwise it returns
// nil.
func (ns nodeSet) FindNodeWithContent(content nodeContent) *node {
	for n := range ns {
		if n.content == content {
			return n
		}
	}
	return nil
}

type internalWalkFunc func(*node)

// inTree can be embedded into a content struct that has child nodes to get
// a standard implementation of the NodeContent interface and a record of
// a potential parent node.
type inTree struct {
	parent   *node
	children *nodes
}

func newInTree() inTree {
	return inTree{
		children: &nodes{},
	}
}

func (it *inTree) assertUnattached() {
	if it.parent != nil {
		panic(fmt.Sprintf("node is already attached to %T", it.parent.content))
	}
}

func (it *inTree) walkChildNodes(w internalWalkFunc) {
	for n := it.children.first; n != nil; n = n.after {
		w(n)
	}
}

func (it *inTree) BuildTokens(to Tokens) Tokens {
	for n := it.children.first; n != nil; n = n.after {
		to = n.BuildTokens(to)
	}
	return to
}

// leafNode can be embedded into a content struct to give it a do-nothing
// implementation of walkChildNodes
type leafNode struct {
}

func (n *leafNode) walkChildNodes(w internalWalkFunc) {
}
