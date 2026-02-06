// Copyright ©2014 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package multi

import "gonum.org/v1/gonum/graph"

// Node here is a duplication of simple.Node
// to avoid needing to import both packages.

// Node is a simple graph node.
type Node int64

// ID returns the ID number of the node.
func (n Node) ID() int64 {
	return int64(n)
}

// Edge is a collection of multigraph edges sharing end points.
type Edge struct {
	F, T graph.Node

	graph.Lines
}

// From returns the from-node of the edge.
func (e Edge) From() graph.Node { return e.F }

// To returns the to-node of the edge.
func (e Edge) To() graph.Node { return e.T }

// ReversedEdge returns a new Edge with the F and T fields
// swapped.
func (e Edge) ReversedEdge() graph.Edge { return Edge{F: e.T, T: e.F} }

// Line is a multigraph edge.
type Line struct {
	F, T graph.Node

	UID int64
}

// From returns the from-node of the line.
func (l Line) From() graph.Node { return l.F }

// To returns the to-node of the line.
func (l Line) To() graph.Node { return l.T }

// ReversedLine returns a new Line with the F and T fields
// swapped. The UID of the new Line is the same as the
// UID of the receiver. The Lines within the Edge are
// not altered.
func (l Line) ReversedLine() graph.Line { l.F, l.T = l.T, l.F; return l }

// ID returns the ID of the line.
func (l Line) ID() int64 { return l.UID }

// WeightedEdge is a collection of weighted multigraph edges sharing end points.
type WeightedEdge struct {
	F, T graph.Node

	graph.WeightedLines

	// WeightFunc calculates the aggregate
	// weight of the lines in Lines. If
	// WeightFunc is nil, the sum of weights
	// is used as the edge weight.
	// The graph.WeightedLines can be expected
	// to be positioned at the first line of
	// the iterator on entry and must be
	// Reset before exit.
	// WeightFunc must accept a nil input.
	WeightFunc func(graph.WeightedLines) float64
}

// From returns the from-node of the edge.
func (e WeightedEdge) From() graph.Node { return e.F }

// To returns the to-node of the edge.
func (e WeightedEdge) To() graph.Node { return e.T }

// ReversedEdge returns a new Edge with the F and T fields
// swapped. The Lines within the WeightedEdge are not
// altered.
func (e WeightedEdge) ReversedEdge() graph.Edge { e.F, e.T = e.T, e.F; return e }

// Weight returns the weight of the edge. Weight uses WeightFunc
// field to calculate the weight, so the WeightedLines field is
// expected to be positioned at the first line and is reset before
// Weight returns.
func (e WeightedEdge) Weight() float64 {
	if e.WeightFunc != nil {
		return e.WeightFunc(e.WeightedLines)
	}
	if e.WeightedLines == nil {
		return 0
	}
	var w float64
	for e.Next() {
		w += e.WeightedLine().Weight()
	}
	e.WeightedLines.Reset()
	return w
}

// WeightedLine is a weighted multigraph edge.
type WeightedLine struct {
	F, T graph.Node
	W    float64

	UID int64
}

// From returns the from-node of the line.
func (l WeightedLine) From() graph.Node { return l.F }

// To returns the to-node of the line.
func (l WeightedLine) To() graph.Node { return l.T }

// ReversedLine returns a new Line with the F and T fields
// swapped. The UID and W of the new Line are the same as the
// UID and W of the receiver.
func (l WeightedLine) ReversedLine() graph.Line { l.F, l.T = l.T, l.F; return l }

// ID returns the ID of the line.
func (l WeightedLine) ID() int64 { return l.UID }

// Weight returns the weight of the edge.
func (l WeightedLine) Weight() float64 { return l.W }
