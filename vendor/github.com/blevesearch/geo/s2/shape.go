// Copyright 2017 Google Inc. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package s2

import (
	"sort"
)

// Edge represents a geodesic edge consisting of two vertices. Zero-length
// edges are allowed, and can be used to represent points.
type Edge struct {
	V0, V1 Point
}

// Cmp compares the two edges using the underlying Points Cmp method and returns
//
//	-1 if e <  other
//	 0 if e == other
//	+1 if e >  other
//
// The two edges are compared by first vertex, and then by the second vertex.
func (e Edge) Cmp(other Edge) int {
	if v0cmp := e.V0.Cmp(other.V0.Vector); v0cmp != 0 {
		return v0cmp
	}
	return e.V1.Cmp(other.V1.Vector)
}

// TODO(rsned): Add helpers for <=, >=

// Reversed returns a new edge with the vertices reversed.
func (e Edge) Reversed() Edge {
	return Edge{V0: e.V1, V1: e.V0}
}

// IsDegenerate reports if the edge is degenerate.
func (e Edge) IsDegenerate() bool { return e.V0 == e.V1 }

// Incoming reports if point equals v1, indicating this edge is arriving.
func (e Edge) Incoming(point Point) bool { return e.V1 == point }

// Outgoing reports if point equals v0, indicating this edge is leaving.
func (e Edge) Outgoing(point Point) bool { return e.V0 == point }

// IncidentOn reports if point is one of the vertices of this edge.
func (e Edge) IncidentOn(point Point) bool {
	return e.Incoming(point) || e.Outgoing(point)
}

// sortEdges sorts the slice of Edges in place.
func sortEdges(e []Edge) {
	sort.Sort(edges(e))
}

// edges implements the Sort interface for slices of Edge.
type edges []Edge

func (e edges) Len() int           { return len(e) }
func (e edges) Swap(i, j int)      { e[i], e[j] = e[j], e[i] }
func (e edges) Less(i, j int) bool { return e[i].Cmp(e[j]) == -1 }

// TODO(rsned): Implement the slices.SortFunc interface.

// ShapeEdgeID is a unique identifier for an Edge within an ShapeIndex,
// consisting of a (shapeID, edgeID) pair.
type ShapeEdgeID struct {
	ShapeID int32
	EdgeID  int32
}

// Cmp compares the two ShapeEdgeIDs and returns
//
//	-1 if s <  other
//	 0 if s == other
//	+1 if s >  other
//
// The two are compared first by shape id and then by edge id.
func (s ShapeEdgeID) Cmp(other ShapeEdgeID) int {
	switch {
	case s.ShapeID < other.ShapeID:
		return -1
	case s.ShapeID > other.ShapeID:
		return 1
	}
	switch {
	case s.EdgeID < other.EdgeID:
		return -1
	case s.EdgeID > other.EdgeID:
		return 1
	}
	return 0
}

// ShapeEdge represents a ShapeEdgeID with the two endpoints of that Edge.
type ShapeEdge struct {
	ID   ShapeEdgeID
	Edge Edge
}

// Chain represents a range of edge IDs corresponding to a chain of connected
// edges, specified as a (start, length) pair. The chain is defined to consist of
// edge IDs {start, start + 1, ..., start + length - 1}.
type Chain struct {
	Start, Length int
}

// ChainPosition represents the position of an edge within a given edge chain,
// specified as a (chainID, offset) pair. Chains are numbered sequentially
// starting from zero, and offsets are measured from the start of each chain.
type ChainPosition struct {
	ChainID, Offset int
}

// A ReferencePoint consists of a point and a boolean indicating whether the point
// is contained by a particular shape.
type ReferencePoint struct {
	Point     Point
	Contained bool
}

// OriginReferencePoint returns a ReferencePoint with the given value for
// contained and the origin point. It should be used when all points or no
// points are contained.
func OriginReferencePoint(contained bool) ReferencePoint {
	return ReferencePoint{Point: OriginPoint(), Contained: contained}
}

// typeTag is a 32-bit tag that can be used to identify the type of an encoded
// Shape. All encodable types have a non-zero type tag. The tag associated with
type typeTag uint32

const (
	// Indicates that a given Shape type cannot be encoded.
	typeTagNone        typeTag = 0
	typeTagPolygon     typeTag = 1
	typeTagPolyline    typeTag = 2
	typeTagPointVector typeTag = 3
	typeTagLaxPolyline typeTag = 4
	typeTagLaxPolygon  typeTag = 5

	// The minimum allowable tag for future user-defined Shape types.
	typeTagMinUser typeTag = 8192
)

// Shape represents polygonal geometry in a flexible way. It is organized as a
// collection of edges that optionally defines an interior. All geometry
// represented by a given Shape must have the same dimension, which means that
// an Shape can represent either a set of points, a set of polylines, or a set
// of polygons.
//
// Shape is defined as an interface in order to give clients control over the
// underlying data representation. Sometimes an Shape does not have any data of
// its own, but instead wraps some other type.
//
// Shape operations are typically defined on a ShapeIndex rather than
// individual shapes. An ShapeIndex is simply a collection of Shapes,
// possibly of different dimensions (e.g. 10 points and 3 polygons), organized
// into a data structure for efficient edge access.
//
// The edges of a Shape are indexed by a contiguous range of edge IDs
// starting at 0. The edges are further subdivided into chains, where each
// chain consists of a sequence of edges connected end-to-end (a polyline).
// For example, a Shape representing two polylines AB and CDE would have
// three edges (AB, CD, DE) grouped into two chains: (AB) and (CD, DE).
// Similarly, an Shape representing 5 points would have 5 chains consisting
// of one edge each.
//
// Shape has methods that allow edges to be accessed either using the global
// numbering (edge ID) or within a particular chain. The global numbering is
// sufficient for most purposes, but the chain representation is useful for
// certain algorithms such as intersection (see BooleanOperation).
type Shape interface {
	// NumEdges returns the number of edges in this shape.
	NumEdges() int

	// Edge returns the edge for the given edge index.
	Edge(i int) Edge

	// ReferencePoint returns an arbitrary reference point for the shape. (The
	// containment boolean value must be false for shapes that do not have an interior.)
	//
	// This reference point may then be used to compute the containment of other
	// points by counting edge crossings.
	ReferencePoint() ReferencePoint

	// NumChains reports the number of contiguous edge chains in the shape.
	// For example, a shape whose edges are [AB, BC, CD, AE, EF] would consist
	// of two chains (AB,BC,CD and AE,EF). Every chain is assigned a chain Id
	// numbered sequentially starting from zero.
	//
	// Note that it is always acceptable to implement this method by returning
	// NumEdges, i.e. every chain consists of a single edge, but this may
	// reduce the efficiency of some algorithms.
	NumChains() int

	// Chain returns the range of edge IDs corresponding to the given edge chain.
	// Edge chains must form contiguous, non-overlapping ranges that cover
	// the entire range of edge IDs. This is spelled out more formally below:
	//
	//  0 <= i < NumChains()
	//  Chain(i).length > 0, for all i
	//  Chain(0).start == 0
	//  Chain(i).start + Chain(i).length == Chain(i+1).start, for i < NumChains()-1
	//  Chain(i).start + Chain(i).length == NumEdges(), for i == NumChains()-1
	Chain(chainID int) Chain

	// ChainEdge returns the edge at offset "offset" within edge chain "chainID".
	// Equivalent to "shape.Edge(shape.Chain(chainID).start + offset)"
	// but more efficient.
	ChainEdge(chainID, offset int) Edge

	// ChainPosition finds the chain containing the given edge, and returns the
	// position of that edge as a ChainPosition(chainID, offset) pair.
	//
	//  shape.Chain(pos.chainID).start + pos.offset == edgeID
	//  shape.Chain(pos.chainID+1).start > edgeID
	//
	// where pos == shape.ChainPosition(edgeID).
	ChainPosition(edgeID int) ChainPosition

	// Dimension returns the dimension of the geometry represented by this shape,
	// either 0, 1 or 2 for point, polyline and polygon geometry respectively.
	//
	//  0 - Point geometry. Each point is represented as a degenerate edge.
	//
	//  1 - Polyline geometry. Polyline edges may be degenerate. A shape may
	//      represent any number of polylines. Polylines edges may intersect.
	//
	//  2 - Polygon geometry. Edges should be oriented such that the polygon
	//      interior is always on the left. In theory the edges may be returned
	//      in any order, but typically the edges are organized as a collection
	//      of edge chains where each chain represents one polygon loop.
	//      Polygons may have degeneracies (e.g., degenerate edges or sibling
	//      pairs consisting of an edge and its corresponding reversed edge).
	//      A polygon loop may also be full (containing all points on the
	//      sphere); by convention this is represented as a chain with no edges.
	//      (See laxPolygon for details.)
	//
	// This method allows degenerate geometry of different dimensions
	// to be distinguished, e.g. it allows a point to be distinguished from a
	// polyline or polygon that has been simplified to a single point.
	Dimension() int

	// IsEmpty reports whether the Shape contains no points. (Note that the full
	// polygon is represented as a chain with zero edges.)
	IsEmpty() bool

	// IsFull reports whether the Shape contains all points on the sphere.
	IsFull() bool

	// typeTag returns a value that can be used to identify the type of an
	// encoded Shape.
	typeTag() typeTag

	// We do not support implementations of this interface outside this package.
	privateInterface()
}

// defaultShapeIsEmpty reports whether this shape contains no points.
func defaultShapeIsEmpty(s Shape) bool {
	return s.NumEdges() == 0 && (s.Dimension() != 2 || s.NumChains() == 0)
}

// defaultShapeIsFull reports whether this shape contains all points on the sphere.
func defaultShapeIsFull(s Shape) bool {
	return s.NumEdges() == 0 && s.Dimension() == 2 && s.NumChains() > 0
}

// A minimal check for types that should satisfy the Shape interface.
var (
	_ Shape = &Loop{}
	_ Shape = &Polygon{}
	_ Shape = &Polyline{}
)

// TODO(rsned): Remaining methods and types from C++
// ChainVertexIterator
// ChainVertexRange
// ChainIterator
// ChainRange
