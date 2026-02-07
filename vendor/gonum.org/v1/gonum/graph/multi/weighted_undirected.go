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
	wug *WeightedUndirectedGraph

	_ graph.Graph                        = wug
	_ graph.Weighted                     = wug
	_ graph.Undirected                   = wug
	_ graph.WeightedUndirected           = wug
	_ graph.Multigraph                   = wug
	_ graph.UndirectedMultigraph         = wug
	_ graph.WeightedUndirectedMultigraph = wug
	_ graph.NodeAdder                    = wug
	_ graph.NodeRemover                  = wug
	_ graph.WeightedLineAdder            = wug
	_ graph.LineRemover                  = wug
)

// WeightedUndirectedGraph implements a generalized undirected graph.
type WeightedUndirectedGraph struct {
	// EdgeWeightFunc is used to provide
	// the WeightFunc function for WeightedEdge
	// values returned by the graph.
	// WeightFunc must accept a nil input.
	EdgeWeightFunc func(graph.WeightedLines) float64

	nodes map[int64]graph.Node
	lines map[int64]map[int64]map[int64]graph.WeightedLine

	nodeIDs *uid.Set
	lineIDs map[int64]map[int64]*uid.Set
}

// NewWeightedUndirectedGraph returns an WeightedUndirectedGraph.
func NewWeightedUndirectedGraph() *WeightedUndirectedGraph {
	return &WeightedUndirectedGraph{
		nodes: make(map[int64]graph.Node),
		lines: make(map[int64]map[int64]map[int64]graph.WeightedLine),

		nodeIDs: uid.NewSet(),
		lineIDs: make(map[int64]map[int64]*uid.Set),
	}
}

// AddNode adds n to the graph. It panics if the added node ID matches an existing node ID.
func (g *WeightedUndirectedGraph) AddNode(n graph.Node) {
	if _, exists := g.nodes[n.ID()]; exists {
		panic(fmt.Sprintf("simple: node ID collision: %d", n.ID()))
	}
	g.nodes[n.ID()] = n
	g.nodeIDs.Use(n.ID())
}

// Edge returns the edge from u to v if such an edge exists and nil otherwise.
// The node v must be directly reachable from u as defined by the From method.
// The returned graph.Edge is a multi.WeightedEdge if an edge exists.
func (g *WeightedUndirectedGraph) Edge(uid, vid int64) graph.Edge {
	return g.WeightedEdge(uid, vid)
}

// EdgeBetween returns the edge between nodes x and y.
func (g *WeightedUndirectedGraph) EdgeBetween(xid, yid int64) graph.Edge {
	return g.WeightedEdge(xid, yid)
}

// Edges returns all the edges in the graph. Each edge in the returned slice
// is a multi.WeightedEdge.
//
// The returned graph.Edges is only valid until the next mutation of
// the receiver.
func (g *WeightedUndirectedGraph) Edges() graph.Edges {
	if len(g.lines) == 0 {
		return graph.Empty
	}
	var edges []graph.Edge
	for xid, u := range g.lines {
		for yid, lines := range u {
			if yid < xid {
				// Do not consider lines when the To node ID is
				// before the From node ID. Both orientations
				// are stored.
				continue
			}
			if len(lines) == 0 {
				continue
			}
			edges = append(edges, WeightedEdge{
				F:             g.Node(xid),
				T:             g.Node(yid),
				WeightedLines: iterator.NewWeightedLines(lines),
				WeightFunc:    g.EdgeWeightFunc,
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
func (g *WeightedUndirectedGraph) From(id int64) graph.Nodes {
	if len(g.lines[id]) == 0 {
		return graph.Empty
	}
	return iterator.NewNodesByWeightedLines(g.nodes, g.lines[id])
}

// HasEdgeBetween returns whether an edge exists between nodes x and y.
func (g *WeightedUndirectedGraph) HasEdgeBetween(xid, yid int64) bool {
	_, ok := g.lines[xid][yid]
	return ok
}

// Lines returns the lines from u to v if such an edge exists and nil otherwise.
// The node v must be directly reachable from u as defined by the From method.
func (g *WeightedUndirectedGraph) Lines(uid, vid int64) graph.Lines {
	return g.LinesBetween(uid, vid)
}

// LinesBetween returns the lines between nodes x and y.
func (g *WeightedUndirectedGraph) LinesBetween(xid, yid int64) graph.Lines {
	if !g.HasEdgeBetween(xid, yid) {
		return graph.Empty
	}
	var lines []graph.Line
	for _, l := range g.lines[xid][yid] {
		if l.From().ID() != xid {
			l = l.ReversedLine().(graph.WeightedLine)
		}
		lines = append(lines, l)
	}
	return iterator.NewOrderedLines(lines)
}

// NewNode returns a new unique Node to be added to g. The Node's ID does
// not become valid in g until the Node is added to g.
func (g *WeightedUndirectedGraph) NewNode() graph.Node {
	if len(g.nodes) == 0 {
		return Node(0)
	}
	if int64(len(g.nodes)) == uid.Max {
		panic("simple: cannot allocate node: no slot")
	}
	return Node(g.nodeIDs.NewID())
}

// NewWeightedLine returns a new WeightedLine from the source to the destination node.
// The returned WeightedLine will have a graph-unique ID.
// The Line's ID does not become valid in g until the Line is added to g.
func (g *WeightedUndirectedGraph) NewWeightedLine(from, to graph.Node, weight float64) graph.WeightedLine {
	xid := from.ID()
	yid := to.ID()
	if yid < xid {
		xid, yid = yid, xid
	}
	var lineID int64
	switch {
	case g.lineIDs[xid] == nil:
		uids := uid.NewSet()
		lineID = uids.NewID()
		g.lineIDs[xid] = map[int64]*uid.Set{yid: uids}
	case g.lineIDs[xid][yid] == nil:
		uids := uid.NewSet()
		lineID = uids.NewID()
		g.lineIDs[xid][yid] = uids
	default:
		lineID = g.lineIDs[xid][yid].NewID()
	}
	return WeightedLine{F: from, T: to, W: weight, UID: lineID}
}

// Node returns the node with the given ID if it exists in the graph,
// and nil otherwise.
func (g *WeightedUndirectedGraph) Node(id int64) graph.Node {
	return g.nodes[id]
}

// Nodes returns all the nodes in the graph.
//
// The returned graph.Nodes is only valid until the next mutation of
// the receiver.
func (g *WeightedUndirectedGraph) Nodes() graph.Nodes {
	if len(g.nodes) == 0 {
		return graph.Empty
	}
	return iterator.NewNodes(g.nodes)
}

// NodeWithID returns a Node with the given ID if possible. If a graph.Node
// is returned that is not already in the graph NodeWithID will return true
// for new and the graph.Node must be added to the graph before use.
func (g *WeightedUndirectedGraph) NodeWithID(id int64) (n graph.Node, new bool) {
	n, ok := g.nodes[id]
	if ok {
		return n, false
	}
	return Node(id), true
}

// RemoveLine removes the line with the given end point and line IDs from the graph,
// leaving the terminal nodes. If the line does not exist it is a no-op.
func (g *WeightedUndirectedGraph) RemoveLine(fid, tid, id int64) {
	if _, ok := g.nodes[fid]; !ok {
		return
	}
	if _, ok := g.nodes[tid]; !ok {
		return
	}

	delete(g.lines[fid][tid], id)
	if len(g.lines[fid][tid]) == 0 {
		delete(g.lines[fid], tid)
	}
	delete(g.lines[tid][fid], id)
	if len(g.lines[tid][fid]) == 0 {
		delete(g.lines[tid], fid)
	}

	xid := fid
	yid := tid
	if yid < xid {
		xid, yid = yid, xid
	}
	g.lineIDs[xid][yid].Release(id)
}

// RemoveNode removes the node with the given ID from the graph, as well as any edges attached
// to it. If the node is not in the graph it is a no-op.
func (g *WeightedUndirectedGraph) RemoveNode(id int64) {
	if _, ok := g.nodes[id]; !ok {
		return
	}
	delete(g.nodes, id)

	for from := range g.lines[id] {
		delete(g.lines[from], id)
	}
	delete(g.lines, id)

	g.nodeIDs.Release(id)
}

// SetWeightedLine adds l, a line from one node to another. If the nodes do not exist, they are added
// and are set to the nodes of the line otherwise.
func (g *WeightedUndirectedGraph) SetWeightedLine(l graph.WeightedLine) {
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
	case g.lines[fid] == nil:
		g.lines[fid] = map[int64]map[int64]graph.WeightedLine{tid: {lid: l}}
	case g.lines[fid][tid] == nil:
		g.lines[fid][tid] = map[int64]graph.WeightedLine{lid: l}
	default:
		g.lines[fid][tid][lid] = l
	}
	switch {
	case g.lines[tid] == nil:
		g.lines[tid] = map[int64]map[int64]graph.WeightedLine{fid: {lid: l}}
	case g.lines[tid][fid] == nil:
		g.lines[tid][fid] = map[int64]graph.WeightedLine{lid: l}
	default:
		g.lines[tid][fid][lid] = l
	}

	xid := fid
	yid := tid
	if yid < xid {
		xid, yid = yid, xid
	}
	switch {
	case g.lineIDs[xid] == nil:
		uids := uid.NewSet()
		g.lineIDs[xid] = map[int64]*uid.Set{yid: uids}
	case g.lineIDs[xid][yid] == nil:
		uids := uid.NewSet()
		g.lineIDs[xid][yid] = uids
	}
	g.lineIDs[xid][yid].Use(lid)
}

// Weight returns the weight for the lines between x and y summarised by the receiver's
// EdgeWeightFunc. Weight returns true if an edge exists between x and y, false otherwise.
func (g *WeightedUndirectedGraph) Weight(xid, yid int64) (w float64, ok bool) {
	lines := g.WeightedLines(xid, yid)
	return WeightedEdge{WeightedLines: lines, WeightFunc: g.EdgeWeightFunc}.Weight(), lines != graph.Empty
}

// WeightedEdge returns the weighted edge from u to v if such an edge exists and nil otherwise.
// The node v must be directly reachable from u as defined by the From method.
// The returned graph.WeightedEdge is a multi.WeightedEdge if an edge exists.
func (g *WeightedUndirectedGraph) WeightedEdge(uid, vid int64) graph.WeightedEdge {
	lines := g.WeightedLines(uid, vid)
	if lines == graph.Empty {
		return nil
	}
	return WeightedEdge{
		F: g.Node(uid), T: g.Node(vid),
		WeightedLines: lines,
		WeightFunc:    g.EdgeWeightFunc,
	}
}

// WeightedEdgeBetween returns the weighted edge between nodes x and y.
func (g *WeightedUndirectedGraph) WeightedEdgeBetween(xid, yid int64) graph.WeightedEdge {
	return g.WeightedEdge(xid, yid)
}

// WeightedEdges returns all the edges in the graph. Each edge in the returned slice
// is a multi.WeightedEdge.
//
// The returned graph.WeightedEdges is only valid until the next mutation of
// the receiver.
func (g *WeightedUndirectedGraph) WeightedEdges() graph.WeightedEdges {
	if len(g.lines) == 0 {
		return graph.Empty
	}
	var edges []graph.WeightedEdge
	for xid, u := range g.lines {
		for yid, lines := range u {
			if yid < xid {
				// Do not consider lines when the To node ID is
				// before the From node ID. Both orientations
				// are stored.
				continue
			}
			if len(lines) == 0 {
				continue
			}
			edges = append(edges, WeightedEdge{
				F:             g.Node(xid),
				T:             g.Node(yid),
				WeightedLines: iterator.NewWeightedLines(lines),
				WeightFunc:    g.EdgeWeightFunc,
			})
		}
	}
	if len(edges) == 0 {
		return graph.Empty
	}
	return iterator.NewOrderedWeightedEdges(edges)
}

// WeightedLines returns the lines from u to v if such an edge exists and nil otherwise.
// The node v must be directly reachable from u as defined by the From method.
func (g *WeightedUndirectedGraph) WeightedLines(uid, vid int64) graph.WeightedLines {
	return g.WeightedLinesBetween(uid, vid)
}

// WeightedLinesBetween returns the lines between nodes x and y.
func (g *WeightedUndirectedGraph) WeightedLinesBetween(xid, yid int64) graph.WeightedLines {
	if !g.HasEdgeBetween(xid, yid) {
		return graph.Empty
	}
	var lines []graph.WeightedLine
	for _, l := range g.lines[xid][yid] {
		if l.From().ID() != xid {
			l = l.ReversedLine().(graph.WeightedLine)
		}
		lines = append(lines, l)
	}
	return iterator.NewOrderedWeightedLines(lines)
}
