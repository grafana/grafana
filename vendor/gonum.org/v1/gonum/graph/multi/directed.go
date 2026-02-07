// Copyright ©2014 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package multi

import (
	"fmt"

	"gonum.org/v1/gonum/graph"
	"gonum.org/v1/gonum/graph/iterator"
	"gonum.org/v1/gonum/graph/set/uid"
)

var (
	dg *DirectedGraph

	_ graph.Graph              = dg
	_ graph.Directed           = dg
	_ graph.Multigraph         = dg
	_ graph.DirectedMultigraph = dg
	_ graph.NodeAdder          = dg
	_ graph.NodeRemover        = dg
	_ graph.LineAdder          = dg
	_ graph.LineRemover        = dg
)

// DirectedGraph implements a generalized directed graph.
type DirectedGraph struct {
	nodes map[int64]graph.Node
	from  map[int64]map[int64]map[int64]graph.Line
	to    map[int64]map[int64]map[int64]graph.Line

	nodeIDs *uid.Set
	lineIDs map[int64]map[int64]*uid.Set
}

// NewDirectedGraph returns a DirectedGraph.
func NewDirectedGraph() *DirectedGraph {
	return &DirectedGraph{
		nodes: make(map[int64]graph.Node),
		from:  make(map[int64]map[int64]map[int64]graph.Line),
		to:    make(map[int64]map[int64]map[int64]graph.Line),

		nodeIDs: uid.NewSet(),
		lineIDs: make(map[int64]map[int64]*uid.Set),
	}
}

// AddNode adds n to the graph. It panics if the added node ID matches an existing node ID.
func (g *DirectedGraph) AddNode(n graph.Node) {
	if _, exists := g.nodes[n.ID()]; exists {
		panic(fmt.Sprintf("simple: node ID collision: %d", n.ID()))
	}
	g.nodes[n.ID()] = n
	g.nodeIDs.Use(n.ID())
}

// Edge returns the edge from u to v if such an edge exists and nil otherwise.
// The node v must be directly reachable from u as defined by the From method.
// The returned graph.Edge is a multi.Edge if an edge exists.
func (g *DirectedGraph) Edge(uid, vid int64) graph.Edge {
	l := g.Lines(uid, vid)
	if l == graph.Empty {
		return nil
	}
	return Edge{F: g.Node(uid), T: g.Node(vid), Lines: l}
}

// Edges returns all the edges in the graph. Each edge in the returned slice
// is a multi.Edge.
//
// The returned graph.Edges is only valid until the next mutation of
// the receiver.
func (g *DirectedGraph) Edges() graph.Edges {
	if len(g.nodes) == 0 {
		return graph.Empty
	}
	var edges []graph.Edge
	for uid, u := range g.nodes {
		for vid, lines := range g.from[u.ID()] {
			if len(lines) == 0 {
				continue
			}
			edges = append(edges, Edge{
				F:     g.Node(uid),
				T:     g.Node(vid),
				Lines: iterator.NewLines(lines),
			})
		}
	}
	if len(edges) == 0 {
		return graph.Empty
	}
	return iterator.NewOrderedEdges(edges)
}

// From returns all nodes in g that can be reached directly from n.
//
// The returned graph.Nodes is only valid until the next mutation of
// the receiver.
func (g *DirectedGraph) From(id int64) graph.Nodes {
	if len(g.from[id]) == 0 {
		return graph.Empty
	}
	return iterator.NewNodesByLines(g.nodes, g.from[id])
}

// HasEdgeBetween returns whether an edge exists between nodes x and y without
// considering direction.
func (g *DirectedGraph) HasEdgeBetween(xid, yid int64) bool {
	if _, ok := g.from[xid][yid]; ok {
		return true
	}
	_, ok := g.from[yid][xid]
	return ok
}

// HasEdgeFromTo returns whether an edge exists in the graph from u to v.
func (g *DirectedGraph) HasEdgeFromTo(uid, vid int64) bool {
	_, ok := g.from[uid][vid]
	return ok
}

// Lines returns the lines from u to v if such any such lines exists and nil otherwise.
// The node v must be directly reachable from u as defined by the From method.
func (g *DirectedGraph) Lines(uid, vid int64) graph.Lines {
	edge := g.from[uid][vid]
	if len(edge) == 0 {
		return graph.Empty
	}
	var lines []graph.Line
	for _, l := range edge {
		lines = append(lines, l)
	}
	return iterator.NewOrderedLines(lines)
}

// NewLine returns a new Line from the source to the destination node.
// The returned Line will have a graph-unique ID.
// The Line's ID does not become valid in g until the Line is added to g.
func (g *DirectedGraph) NewLine(from, to graph.Node) graph.Line {
	fid := from.ID()
	tid := to.ID()
	var lineID int64
	switch {
	case g.lineIDs[fid] == nil:
		uids := uid.NewSet()
		lineID = uids.NewID()
		g.lineIDs[fid] = map[int64]*uid.Set{tid: uids}
	case g.lineIDs[fid][tid] == nil:
		uids := uid.NewSet()
		lineID = uids.NewID()
		g.lineIDs[fid][tid] = uids
	default:
		lineID = g.lineIDs[fid][tid].NewID()
	}
	return Line{F: from, T: to, UID: lineID}
}

// NewNode returns a new unique Node to be added to g. The Node's ID does
// not become valid in g until the Node is added to g.
func (g *DirectedGraph) NewNode() graph.Node {
	if len(g.nodes) == 0 {
		return Node(0)
	}
	if int64(len(g.nodes)) == uid.Max {
		panic("simple: cannot allocate node: no slot")
	}
	return Node(g.nodeIDs.NewID())
}

// Node returns the node with the given ID if it exists in the graph,
// and nil otherwise.
func (g *DirectedGraph) Node(id int64) graph.Node {
	return g.nodes[id]
}

// Nodes returns all the nodes in the graph.
//
// The returned graph.Nodes is only valid until the next mutation of
// the receiver.
func (g *DirectedGraph) Nodes() graph.Nodes {
	if len(g.nodes) == 0 {
		return graph.Empty
	}
	return iterator.NewNodes(g.nodes)
}

// NodeWithID returns a Node with the given ID if possible. If a graph.Node
// is returned that is not already in the graph NodeWithID will return true
// for new and the graph.Node must be added to the graph before use.
func (g *DirectedGraph) NodeWithID(id int64) (n graph.Node, new bool) {
	n, ok := g.nodes[id]
	if ok {
		return n, false
	}
	return Node(id), true
}

// RemoveLine removes the line with the given end point and line IDs from the graph, leaving
// the terminal nodes. If the line does not exist it is a no-op.
func (g *DirectedGraph) RemoveLine(fid, tid, id int64) {
	if _, ok := g.nodes[fid]; !ok {
		return
	}
	if _, ok := g.nodes[tid]; !ok {
		return
	}

	delete(g.from[fid][tid], id)
	if len(g.from[fid][tid]) == 0 {
		delete(g.from[fid], tid)
	}
	delete(g.to[tid][fid], id)
	if len(g.to[tid][fid]) == 0 {
		delete(g.to[tid], fid)
	}

	g.lineIDs[fid][tid].Release(id)
}

// RemoveNode removes the node with the given ID from the graph, as well as any edges attached
// to it. If the node is not in the graph it is a no-op.
func (g *DirectedGraph) RemoveNode(id int64) {
	if _, ok := g.nodes[id]; !ok {
		return
	}
	delete(g.nodes, id)

	for from := range g.from[id] {
		delete(g.to[from], id)
	}
	delete(g.from, id)

	for to := range g.to[id] {
		delete(g.from[to], id)
	}
	delete(g.to, id)

	g.nodeIDs.Release(id)
}

// SetLine adds l, a line from one node to another. If the nodes do not exist, they are added
// and are set to the nodes of the line otherwise.
func (g *DirectedGraph) SetLine(l graph.Line) {
	var (
		from = l.From()
		fid  = from.ID()
		to   = l.To()
		tid  = to.ID()
		lid  = l.ID()
	)

	if _, ok := g.nodes[fid]; !ok {
		g.AddNode(from)
	} else {
		g.nodes[fid] = from
	}
	if _, ok := g.nodes[tid]; !ok {
		g.AddNode(to)
	} else {
		g.nodes[tid] = to
	}

	switch {
	case g.from[fid] == nil:
		g.from[fid] = map[int64]map[int64]graph.Line{tid: {lid: l}}
	case g.from[fid][tid] == nil:
		g.from[fid][tid] = map[int64]graph.Line{lid: l}
	default:
		g.from[fid][tid][lid] = l
	}
	switch {
	case g.to[tid] == nil:
		g.to[tid] = map[int64]map[int64]graph.Line{fid: {lid: l}}
	case g.to[tid][fid] == nil:
		g.to[tid][fid] = map[int64]graph.Line{lid: l}
	default:
		g.to[tid][fid][lid] = l
	}

	switch {
	case g.lineIDs[fid] == nil:
		uids := uid.NewSet()
		g.lineIDs[fid] = map[int64]*uid.Set{tid: uids}
	case g.lineIDs[fid][tid] == nil:
		uids := uid.NewSet()
		g.lineIDs[fid][tid] = uids
	}
	g.lineIDs[fid][tid].Use(lid)
}

// To returns all nodes in g that can reach directly to n.
//
// The returned graph.Nodes is only valid until the next mutation of
// the receiver.
func (g *DirectedGraph) To(id int64) graph.Nodes {
	if len(g.to[id]) == 0 {
		return graph.Empty
	}
	return iterator.NewNodesByLines(g.nodes, g.to[id])
}
