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

// CrossingType defines different ways of reporting edge intersections.
type CrossingType int

const (
	// CrossingTypeInterior reports intersections that occur at a point
	// interior to both edges (i.e., not at a vertex).
	CrossingTypeInterior CrossingType = iota

	// CrossingTypeAll reports all intersections, even those where two edges
	// intersect only because they share a common vertex.
	CrossingTypeAll

	// CrossingTypeNonAdjacent reports all intersections except for pairs of
	// the form (AB, BC) where both edges are from the same ShapeIndex.
	CrossingTypeNonAdjacent
)

// rangeIterator is a wrapper over ShapeIndexIterator with extra methods
// that are useful for merging the contents of two or more ShapeIndexes.
type rangeIterator struct {
	it *ShapeIndexIterator
	// The min and max leaf cell ids covered by the current cell. If done() is
	// true, these methods return a value larger than any valid cell id.
	rangeMin CellID
	rangeMax CellID
}

// newRangeIterator creates a new rangeIterator positioned at the first cell of the given index.
func newRangeIterator(index *ShapeIndex) *rangeIterator {
	r := &rangeIterator{
		it: index.Iterator(),
	}
	r.refresh()
	return r
}

func (r *rangeIterator) cellID() CellID             { return r.it.CellID() }
func (r *rangeIterator) indexCell() *ShapeIndexCell { return r.it.IndexCell() }
func (r *rangeIterator) next()                      { r.it.Next(); r.refresh() }
func (r *rangeIterator) done() bool                 { return r.it.Done() }

// seekTo positions the iterator at the first cell that overlaps or follows
// the current range minimum of the target iterator, i.e. such that its
// rangeMax >= target.rangeMin.
func (r *rangeIterator) seekTo(target *rangeIterator) {
	r.it.seek(target.rangeMin)
	// If the current cell does not overlap target, it is possible that the
	// previous cell is the one we are looking for. This can only happen when
	// the previous cell contains target but has a smaller CellID.
	if r.it.Done() || r.it.CellID().RangeMin() > target.rangeMax {
		if r.it.Prev() && r.it.CellID().RangeMax() < target.cellID() {
			r.it.Next()
		}
	}
	r.refresh()
}

// seekBeyond positions the iterator at the first cell that follows the current
// range minimum of the target iterator. i.e. the first cell such that its
// rangeMin > target.rangeMax.
func (r *rangeIterator) seekBeyond(target *rangeIterator) {
	r.it.seek(target.rangeMax.Next())
	if !r.it.Done() && r.it.CellID().RangeMin() <= target.rangeMax {
		r.it.Next()
	}
	r.refresh()
}

// refresh updates the iterators min and max values.
func (r *rangeIterator) refresh() {
	r.rangeMin = r.cellID().RangeMin()
	r.rangeMax = r.cellID().RangeMax()
}

// referencePointForShape is a helper function for implementing various Shapes
// ReferencePoint functions.
//
// Given a shape consisting of closed polygonal loops, the interior of the
// shape is defined as the region to the left of all edges (which must be
// oriented consistently). This function then chooses an arbitrary point and
// returns true if that point is contained by the shape.
//
// Unlike Loop and Polygon, this method allows duplicate vertices and
// edges, which requires some extra care with definitions. The rule that we
// apply is that an edge and its reverse edge cancel each other: the result
// is the same as if that edge pair were not present. Therefore shapes that
// consist only of degenerate loop(s) are either empty or full; by convention,
// the shape is considered full if and only if it contains an empty loop (see
// laxPolygon for details).
//
// Determining whether a loop on the sphere contains a point is harder than
// the corresponding problem in 2D plane geometry. It cannot be implemented
// just by counting edge crossings because there is no such thing as a point
// at infinity that is guaranteed to be outside the loop.
//
// This function requires that the given Shape have an interior.
func referencePointForShape(shape Shape) ReferencePoint {
	if shape.NumEdges() == 0 {
		// A shape with no edges is defined to be full if and only if it
		// contains at least one chain.
		return OriginReferencePoint(shape.NumChains() > 0)
	}
	// Define a "matched" edge as one that can be paired with a corresponding
	// reversed edge. Define a vertex as "balanced" if all of its edges are
	// matched. In order to determine containment, we must find an unbalanced
	// vertex. Often every vertex is unbalanced, so we start by trying an
	// arbitrary vertex.
	edge := shape.Edge(0)

	if ref, ok := referencePointAtVertex(shape, edge.V0); ok {
		return ref
	}

	// That didn't work, so now we do some extra work to find an unbalanced
	// vertex (if any). Essentially we gather a list of edges and a list of
	// reversed edges, and then sort them. The first edge that appears in one
	// list but not the other is guaranteed to be unmatched.
	n := shape.NumEdges()
	var edges = make([]Edge, n)
	var revEdges = make([]Edge, n)
	for i := 0; i < n; i++ {
		edge := shape.Edge(i)
		edges[i] = edge
		revEdges[i] = Edge{V0: edge.V1, V1: edge.V0}
	}

	sortEdges(edges)
	sortEdges(revEdges)

	for i := 0; i < n; i++ {
		if edges[i].Cmp(revEdges[i]) == -1 { // edges[i] is unmatched
			if ref, ok := referencePointAtVertex(shape, edges[i].V0); ok {
				return ref
			}
		}
		if revEdges[i].Cmp(edges[i]) == -1 { // revEdges[i] is unmatched
			if ref, ok := referencePointAtVertex(shape, revEdges[i].V0); ok {
				return ref
			}
		}
	}

	// All vertices are balanced, so this polygon is either empty or full except
	// for degeneracies. By convention it is defined to be full if it contains
	// any chain with no edges.
	for i := 0; i < shape.NumChains(); i++ {
		if shape.Chain(i).Length == 0 {
			return OriginReferencePoint(true)
		}
	}

	return OriginReferencePoint(false)
}

// referencePointAtVertex reports whether the given vertex is unbalanced, and
// returns a ReferencePoint indicating if the point is contained.
// Otherwise returns false.
func referencePointAtVertex(shape Shape, vTest Point) (ReferencePoint, bool) {
	var ref ReferencePoint

	// Let P be an unbalanced vertex. Vertex P is defined to be inside the
	// region if the region contains a particular direction vector starting from
	// P, namely the direction p.Ortho(). This can be calculated using
	// ContainsVertexQuery.

	containsQuery := NewContainsVertexQuery(vTest)
	n := shape.NumEdges()
	for e := 0; e < n; e++ {
		edge := shape.Edge(e)
		if edge.V0 == vTest {
			containsQuery.AddEdge(edge.V1, 1)
		}
		if edge.V1 == vTest {
			containsQuery.AddEdge(edge.V0, -1)
		}
	}
	containsSign := containsQuery.ContainsVertex()
	if containsSign == 0 {
		return ref, false // There are no unmatched edges incident to this vertex.
	}
	ref.Point = vTest
	ref.Contained = containsSign > 0

	return ref, true
}

// containsBruteForce reports whether the given shape contains the given point.
// Most clients should not use this method, since its running time is linear in
// the number of shape edges. Instead clients should create a ShapeIndex and use
// ContainsPointQuery, since this strategy is much more efficient when many
// points need to be tested.
//
// Polygon boundaries are treated as being semi-open (see ContainsPointQuery
// and VertexModel for other options).
func containsBruteForce(shape Shape, point Point) bool {
	if shape.Dimension() != 2 {
		return false
	}

	refPoint := shape.ReferencePoint()
	if refPoint.Point == point {
		return refPoint.Contained
	}

	crosser := NewEdgeCrosser(refPoint.Point, point)
	inside := refPoint.Contained
	for e := 0; e < shape.NumEdges(); e++ {
		edge := shape.Edge(e)
		inside = inside != crosser.EdgeOrVertexCrossing(edge.V0, edge.V1)
	}
	return inside
}
