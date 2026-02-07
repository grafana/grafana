// Copyright ©2018 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:build safe
// +build safe

package iterator

import (
	"reflect"

	"gonum.org/v1/gonum/graph"
)

// Nodes implements the graph.Nodes interfaces.
// The iteration order of Nodes is randomized.
type Nodes struct {
	iter     reflect.MapIter
	pos, len int
	curr     graph.Node
	value    reflect.Value
	nodes    reflect.Value
}

// NewNodes returns a Nodes initialized with the provided nodes, a
// map of node IDs to graph.Nodes. No check is made that the keys
// match the graph.Node IDs, and the map keys are not used.
//
// Behavior of the Nodes is unspecified if nodes is mutated after
// the call to NewNodes.
func NewNodes(nodes map[int64]graph.Node) *Nodes {
	rv := reflect.ValueOf(nodes)
	n := &Nodes{nodes: rv, len: len(nodes)}
	n.iter.Reset(rv)
	n.value = reflect.ValueOf(&n.curr).Elem()
	return n
}

// Len returns the remaining number of nodes to be iterated over.
func (n *Nodes) Len() int {
	return n.len - n.pos
}

// Next returns whether the next call of Node will return a valid node.
func (n *Nodes) Next() bool {
	if n.pos >= n.len {
		return false
	}
	ok := n.iter.Next()
	if ok {
		n.pos++
		n.value.SetIterValue(&n.iter)
	}
	return ok
}

// Node returns the current node of the iterator. Next must have been
// called prior to a call to Node.
func (n *Nodes) Node() graph.Node {
	return n.curr
}

// Reset returns the iterator to its initial state.
func (n *Nodes) Reset() {
	n.curr = nil
	n.pos = 0
	n.iter.Reset(n.nodes)
}

// NodeSlice returns all the remaining nodes in the iterator and advances
// the iterator. The order of nodes within the returned slice is not
// specified.
func (n *Nodes) NodeSlice() []graph.Node {
	if n.Len() == 0 {
		return nil
	}
	nodes := make([]graph.Node, 0, n.Len())
	for n.iter.Next() {
		n.value.SetIterValue(&n.iter)
		nodes = append(nodes, n.curr)
	}
	n.pos = n.len
	return nodes
}

// NodesByEdge implements the graph.Nodes interfaces.
// The iteration order of Nodes is randomized.
type NodesByEdge struct {
	iter     reflect.MapIter
	pos, len int
	edges    reflect.Value
	curr     graph.Node
	nodes    map[int64]graph.Node
}

// NewNodesByEdge returns a NodesByEdge initialized with the
// provided nodes, a map of node IDs to graph.Nodes, and the set
// of edges, a map of to-node IDs to graph.Edge, that can be
// traversed to reach the nodes that the NodesByEdge will iterate
// over. No check is made that the keys match the graph.Node IDs,
// and the map keys are not used.
//
// Behavior of the NodesByEdge is unspecified if nodes or edges
// is mutated after the call to NewNodes.
func NewNodesByEdge(nodes map[int64]graph.Node, edges map[int64]graph.Edge) *NodesByEdge {
	rv := reflect.ValueOf(edges)
	n := &NodesByEdge{nodes: nodes, len: len(edges), edges: rv}
	n.iter.Reset(rv)
	return n
}

// NewNodesByWeightedEdge returns a NodesByEdge initialized with the
// provided nodes, a map of node IDs to graph.Nodes, and the set
// of edges, a map of to-node IDs to graph.WeightedEdge, that can be
// traversed to reach the nodes that the NodesByEdge will iterate
// over. No check is made that the keys match the graph.Node IDs,
// and the map keys are not used.
//
// Behavior of the NodesByEdge is unspecified if nodes or edges
// is mutated after the call to NewNodes.
func NewNodesByWeightedEdge(nodes map[int64]graph.Node, edges map[int64]graph.WeightedEdge) *NodesByEdge {
	rv := reflect.ValueOf(edges)
	n := &NodesByEdge{nodes: nodes, len: len(edges), edges: rv}
	n.iter.Reset(rv)
	return n
}

// NewNodesByLines returns a NodesByEdge initialized with the
// provided nodes, a map of node IDs to graph.Nodes, and the set
// of lines, a map to-node IDs to map of graph.Line, that can be
// traversed to reach the nodes that the NodesByEdge will iterate
// over. No check is made that the keys match the graph.Node IDs,
// and the map keys are not used.
//
// Behavior of the NodesByEdge is unspecified if nodes or lines
// is mutated after the call to NewNodes.
func NewNodesByLines(nodes map[int64]graph.Node, lines map[int64]map[int64]graph.Line) *NodesByEdge {
	rv := reflect.ValueOf(lines)
	n := &NodesByEdge{nodes: nodes, len: len(lines), edges: rv}
	n.iter.Reset(rv)
	return n
}

// NewNodesByWeightedLines returns a NodesByEdge initialized with the
// provided nodes, a map of node IDs to graph.Nodes, and the set
// of lines, a map to-node IDs to map of graph.WeightedLine, that can be
// traversed to reach the nodes that the NodesByEdge will iterate
// over. No check is made that the keys match the graph.Node IDs,
// and the map keys are not used.
//
// Behavior of the NodesByEdge is unspecified if nodes or lines
// is mutated after the call to NewNodes.
func NewNodesByWeightedLines(nodes map[int64]graph.Node, lines map[int64]map[int64]graph.WeightedLine) *NodesByEdge {
	rv := reflect.ValueOf(lines)
	n := &NodesByEdge{nodes: nodes, len: len(lines), edges: rv}
	n.iter.Reset(rv)
	return n
}

// Len returns the remaining number of nodes to be iterated over.
func (n *NodesByEdge) Len() int {
	return n.len - n.pos
}

// Next returns whether the next call of Node will return a valid node.
func (n *NodesByEdge) Next() bool {
	if n.pos >= n.len {
		return false
	}
	ok := n.iter.Next()
	if ok {
		n.pos++
		n.curr = n.nodes[n.iter.Key().Int()]
	}
	return ok
}

// Node returns the current node of the iterator. Next must have been
// called prior to a call to Node.
func (n *NodesByEdge) Node() graph.Node {
	return n.curr
}

// Reset returns the iterator to its initial state.
func (n *NodesByEdge) Reset() {
	n.curr = nil
	n.pos = 0
	n.iter.Reset(n.edges)
}

// NodeSlice returns all the remaining nodes in the iterator and advances
// the iterator. The order of nodes within the returned slice is not
// specified.
func (n *NodesByEdge) NodeSlice() []graph.Node {
	if n.Len() == 0 {
		return nil
	}
	nodes := make([]graph.Node, 0, n.Len())
	for n.iter.Next() {
		n.curr = n.nodes[n.iter.Key().Int()]
		nodes = append(nodes, n.curr)
	}
	n.pos = n.len
	return nodes
}
