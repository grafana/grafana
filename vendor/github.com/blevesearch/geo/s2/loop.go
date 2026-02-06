// Copyright 2015 Google Inc. All rights reserved.
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
	"encoding/binary"
	"fmt"
	"io"
	"math"
	"reflect"

	"github.com/blevesearch/geo/r1"
	"github.com/blevesearch/geo/r3"
	"github.com/blevesearch/geo/s1"
)

// Loop represents a simple spherical polygon. It consists of a sequence
// of vertices where the first vertex is implicitly connected to the
// last. All loops are defined to have a CCW orientation, i.e. the interior of
// the loop is on the left side of the edges. This implies that a clockwise
// loop enclosing a small area is interpreted to be a CCW loop enclosing a
// very large area.
//
// Loops are not allowed to have any duplicate vertices (whether adjacent or
// not).  Non-adjacent edges are not allowed to intersect, and furthermore edges
// of length 180 degrees are not allowed (i.e., adjacent vertices cannot be
// antipodal). Loops must have at least 3 vertices (except for the "empty" and
// "full" loops discussed below).
//
// There are two special loops: the "empty" loop contains no points and the
// "full" loop contains all points. These loops do not have any edges, but to
// preserve the invariant that every loop can be represented as a vertex
// chain, they are defined as having exactly one vertex each (see EmptyLoop
// and FullLoop).
type Loop struct {
	vertices []Point

	// originInside keeps a precomputed value whether this loop contains the origin
	// versus computing from the set of vertices every time.
	originInside bool

	// depth is the nesting depth of this Loop if it is contained by a Polygon
	// or other shape and is used to determine if this loop represents a hole
	// or a filled in portion.
	depth int

	// bound is a conservative bound on all points contained by this loop.
	// If l.ContainsPoint(P), then l.bound.ContainsPoint(P).
	bound Rect

	// Since bound is not exact, it is possible that a loop A contains
	// another loop B whose bounds are slightly larger. subregionBound
	// has been expanded sufficiently to account for this error, i.e.
	// if A.Contains(B), then A.subregionBound.Contains(B.bound).
	subregionBound Rect

	// index is the spatial index for this Loop.
	index *ShapeIndex

	// A buffer pool to be used while decoding the polygon
	BufPool *GeoBufferPool
}

// LoopFromPoints constructs a loop from the given points.
func LoopFromPoints(pts []Point) *Loop {
	l := &Loop{
		vertices: pts,
		index:    NewShapeIndex(),
	}

	l.initOriginAndBound()
	return l
}

// LoopFromCell constructs a loop corresponding to the given cell.
//
// Note that the loop and cell *do not* contain exactly the same set of
// points, because Loop and Cell have slightly different definitions of
// point containment. For example, a Cell vertex is contained by all
// four neighboring Cells, but it is contained by exactly one of four
// Loops constructed from those cells. As another example, the cell
// coverings of cell and LoopFromCell(cell) will be different, because the
// loop contains points on its boundary that actually belong to other cells
// (i.e., the covering will include a layer of neighboring cells).
func LoopFromCell(c Cell) *Loop {
	l := &Loop{
		vertices: []Point{
			c.Vertex(0),
			c.Vertex(1),
			c.Vertex(2),
			c.Vertex(3),
		},
		index: NewShapeIndex(),
	}

	l.initOriginAndBound()
	return l
}

// These two points are used for the special Empty and Full loops.
var (
	emptyLoopPoint = Point{r3.Vector{X: 0, Y: 0, Z: 1}}
	fullLoopPoint  = Point{r3.Vector{X: 0, Y: 0, Z: -1}}
)

// EmptyLoop returns a special "empty" loop.
func EmptyLoop() *Loop {
	return LoopFromPoints([]Point{emptyLoopPoint})
}

// FullLoop returns a special "full" loop.
func FullLoop() *Loop {
	return LoopFromPoints([]Point{fullLoopPoint})
}

// initOriginAndBound sets the origin containment for the given point and then calls
// the initialization for the bounds objects and the internal index.
func (l *Loop) initOriginAndBound() {
	if len(l.vertices) < 3 {
		// Check for the special "empty" and "full" loops (which have one vertex).
		if !l.isEmptyOrFull() {
			l.originInside = false
			return
		}

		// This is the special empty or full loop, so the origin depends on if
		// the vertex is in the southern hemisphere or not.
		l.originInside = l.vertices[0].Z < 0
	} else {
		// The brute force point containment algorithm works by counting edge
		// crossings starting at a fixed reference point (chosen as OriginPoint()
		// for historical reasons).  Loop initialization would be more efficient
		// if we used a loop vertex such as vertex(0) as the reference point
		// instead, however making this change would be a lot of work because
		// originInside is currently part of the Encode() format.
		//
		// In any case, we initialize originInside by first guessing that it is
		// outside, and then seeing whether we get the correct containment result
		// for vertex 1.  If the result is incorrect, the origin must be inside
		// the loop instead.  Note that the Loop is not necessarily valid and so
		// we need to check the requirements of AngleContainsVertex first.
		v1Inside := l.vertices[0] != l.vertices[1] &&
			l.vertices[2] != l.vertices[1] &&
			AngleContainsVertex(l.vertices[0], l.vertices[1], l.vertices[2])

		// initialize before calling ContainsPoint
		l.originInside = false

		// Note that ContainsPoint only does a bounds check once initIndex
		// has been called, so it doesn't matter that bound is undefined here.
		if v1Inside != l.ContainsPoint(l.vertices[1]) {
			l.originInside = true
		}

	}

	// We *must* call initBound before initializing the index, because
	// initBound calls ContainsPoint which does a bounds check before using
	// the index.
	l.initBound()

	// Create a new index and add us to it.
	l.index = NewShapeIndex()
	l.index.Add(l)
}

// initBound sets up the approximate bounding Rects for this loop.
func (l *Loop) initBound() {
	if len(l.vertices) == 0 {
		*l = *EmptyLoop()
		return
	}
	// Check for the special "empty" and "full" loops.
	if l.isEmptyOrFull() {
		if l.IsEmpty() {
			l.bound = EmptyRect()
		} else {
			l.bound = FullRect()
		}
		l.subregionBound = l.bound
		return
	}

	// The bounding rectangle of a loop is not necessarily the same as the
	// bounding rectangle of its vertices. First, the maximal latitude may be
	// attained along the interior of an edge. Second, the loop may wrap
	// entirely around the sphere (e.g. a loop that defines two revolutions of a
	// candy-cane stripe). Third, the loop may include one or both poles.
	// Note that a small clockwise loop near the equator contains both poles.
	bounder := NewRectBounder()
	for i := 0; i <= len(l.vertices); i++ { // add vertex 0 twice
		bounder.AddPoint(l.Vertex(i))
	}
	b := bounder.RectBound()

	if l.ContainsPoint(Point{r3.Vector{X: 0, Y: 0, Z: 1}}) {
		b = Rect{r1.Interval{Lo: b.Lat.Lo, Hi: math.Pi / 2}, s1.FullInterval()}
	}
	// If a loop contains the south pole, then either it wraps entirely
	// around the sphere (full longitude range), or it also contains the
	// north pole in which case b.Lng.IsFull() due to the test above.
	// Either way, we only need to do the south pole containment test if
	// b.Lng.IsFull().
	if b.Lng.IsFull() && l.ContainsPoint(Point{r3.Vector{X: 0, Y: 0, Z: -1}}) {
		b.Lat.Lo = -math.Pi / 2
	}
	l.bound = b
	l.subregionBound = ExpandForSubregions(l.bound)
}

// Validate checks whether this is a valid loop.
func (l *Loop) Validate() error {
	if err := l.findValidationErrorNoIndex(); err != nil {
		return err
	}

	// Check for intersections between non-adjacent edges (including at vertices)
	// TODO(roberts): Once shapeutil gets findAnyCrossing uncomment this.
	// return findAnyCrossing(l.index)

	return nil
}

// findValidationErrorNoIndex reports whether this is not a valid loop, but
// skips checks that would require a ShapeIndex to be built for the loop. This
// is primarily used by Polygon to do validation so it doesn't trigger the
// creation of unneeded ShapeIndices.
func (l *Loop) findValidationErrorNoIndex() error {
	// All vertices must be unit length.
	for i, v := range l.vertices {
		if !v.IsUnit() {
			return fmt.Errorf("vertex %d is not unit length", i)
		}
	}

	// Loops must have at least 3 vertices (except for empty and full).
	if len(l.vertices) < 3 {
		if l.isEmptyOrFull() {
			return nil // Skip remaining tests.
		}
		return fmt.Errorf("non-empty, non-full loops must have at least 3 vertices")
	}

	// Loops are not allowed to have any duplicate vertices or edge crossings.
	// We split this check into two parts. First we check that no edge is
	// degenerate (identical endpoints). Then we check that there are no
	// intersections between non-adjacent edges (including at vertices). The
	// second check needs the ShapeIndex, so it does not fall within the scope
	// of this method.
	for i, v := range l.vertices {
		if v == l.Vertex(i+1) {
			return fmt.Errorf("edge %d is degenerate (duplicate vertex)", i)
		}

		// Antipodal vertices are not allowed.
		if other := (Point{l.Vertex(i + 1).Mul(-1)}); v == other {
			return fmt.Errorf("vertices %d and %d are antipodal", i,
				(i+1)%len(l.vertices))
		}
	}

	return nil
}

// Contains reports whether the region contained by this loop is a superset of the
// region contained by the given other loop.
func (l *Loop) Contains(o *Loop) bool {
	// For a loop A to contain the loop B, all of the following must
	// be true:
	//
	//  (1) There are no edge crossings between A and B except at vertices.
	//
	//  (2) At every vertex that is shared between A and B, the local edge
	//      ordering implies that A contains B.
	//
	//  (3) If there are no shared vertices, then A must contain a vertex of B
	//      and B must not contain a vertex of A. (An arbitrary vertex may be
	//      chosen in each case.)
	//
	// The second part of (3) is necessary to detect the case of two loops whose
	// union is the entire sphere, i.e. two loops that contains each other's
	// boundaries but not each other's interiors.
	if !l.subregionBound.Contains(o.bound) {
		return false
	}

	// Special cases to handle either loop being empty or full.
	if l.isEmptyOrFull() || o.isEmptyOrFull() {
		return l.IsFull() || o.IsEmpty()
	}

	// Check whether there are any edge crossings, and also check the loop
	// relationship at any shared vertices.
	relation := &containsRelation{}
	if hasCrossingRelation(l, o, relation) {
		return false
	}

	// There are no crossings, and if there are any shared vertices then A
	// contains B locally at each shared vertex.
	if relation.foundSharedVertex {
		return true
	}

	// Since there are no edge intersections or shared vertices, we just need to
	// test condition (3) above. We can skip this test if we discovered that A
	// contains at least one point of B while checking for edge crossings.
	if !l.ContainsPoint(o.Vertex(0)) {
		return false
	}

	// We still need to check whether (A union B) is the entire sphere.
	// Normally this check is very cheap due to the bounding box precondition.
	if (o.subregionBound.Contains(l.bound) || o.bound.Union(l.bound).IsFull()) &&
		o.ContainsPoint(l.Vertex(0)) {
		return false
	}
	return true
}

// Intersects reports whether the region contained by this loop intersects the region
// contained by the other loop.
func (l *Loop) Intersects(o *Loop) bool {
	// Given two loops, A and B, A.Intersects(B) if and only if !A.Complement().Contains(B).
	//
	// This code is similar to Contains, but is optimized for the case
	// where both loops enclose less than half of the sphere.
	if !l.bound.Intersects(o.bound) {
		return false
	}

	// Check whether there are any edge crossings, and also check the loop
	// relationship at any shared vertices.
	relation := &intersectsRelation{}
	if hasCrossingRelation(l, o, relation) {
		return true
	}
	if relation.foundSharedVertex {
		return false
	}

	// Since there are no edge intersections or shared vertices, the loops
	// intersect only if A contains B, B contains A, or the two loops contain
	// each other's boundaries.  These checks are usually cheap because of the
	// bounding box preconditions.  Note that neither loop is empty (because of
	// the bounding box check above), so it is safe to access vertex(0).

	// Check whether A contains B, or A and B contain each other's boundaries.
	// (Note that A contains all the vertices of B in either case.)
	if l.subregionBound.Contains(o.bound) || l.bound.Union(o.bound).IsFull() {
		if l.ContainsPoint(o.Vertex(0)) {
			return true
		}
	}
	// Check whether B contains A.
	if o.subregionBound.Contains(l.bound) {
		if o.ContainsPoint(l.Vertex(0)) {
			return true
		}
	}
	return false
}

// Equal reports whether two loops have the same vertices in the same linear order
// (i.e., cyclic rotations are not allowed).
func (l *Loop) Equal(other *Loop) bool {
	if len(l.vertices) != len(other.vertices) {
		return false
	}

	for i, v := range l.vertices {
		if v != other.Vertex(i) {
			return false
		}
	}
	return true
}

// BoundaryEqual reports whether the two loops have the same boundary. This is
// true if and only if the loops have the same vertices in the same cyclic order
// (i.e., the vertices may be cyclically rotated). The empty and full loops are
// considered to have different boundaries.
func (l *Loop) BoundaryEqual(o *Loop) bool {
	if len(l.vertices) != len(o.vertices) {
		return false
	}

	// Special case to handle empty or full loops.  Since they have the same
	// number of vertices, if one loop is empty/full then so is the other.
	if l.isEmptyOrFull() {
		return l.IsEmpty() == o.IsEmpty()
	}

	// Loop through the vertices to find the first of ours that matches the
	// starting vertex of the other loop. Use that offset to then 'align' the
	// vertices for comparison.
	for offset, vertex := range l.vertices {
		if vertex == o.Vertex(0) {
			// There is at most one starting offset since loop vertices are unique.
			for i := 0; i < len(l.vertices); i++ {
				if l.Vertex(i+offset) != o.Vertex(i) {
					return false
				}
			}
			return true
		}
	}
	return false
}

// compareBoundary returns +1 if this loop contains the boundary of the other loop,
// -1 if it excludes the boundary of the other, and 0 if the boundaries of the two
// loops cross. Shared edges are handled as follows:
//
//	If XY is a shared edge, define Reversed(XY) to be true if XY
//	  appears in opposite directions in both loops.
//	Then this loop contains XY if and only if Reversed(XY) == the other loop is a hole.
//	(Intuitively, this checks whether this loop contains a vanishingly small region
//	extending from the boundary of the other toward the interior of the polygon to
//	which the other belongs.)
//
// This function is used for testing containment and intersection of
// multi-loop polygons. Note that this method is not symmetric, since the
// result depends on the direction of this loop but not on the direction of
// the other loop (in the absence of shared edges).
//
// This requires that neither loop is empty, and if other loop IsFull, then it must not
// be a hole.
func (l *Loop) compareBoundary(o *Loop) int {
	// The bounds must intersect for containment or crossing.
	if !l.bound.Intersects(o.bound) {
		return -1
	}

	// Full loops are handled as though the loop surrounded the entire sphere.
	if l.IsFull() {
		return 1
	}
	if o.IsFull() {
		return -1
	}

	// Check whether there are any edge crossings, and also check the loop
	// relationship at any shared vertices.
	relation := newCompareBoundaryRelation(o.IsHole())
	if hasCrossingRelation(l, o, relation) {
		return 0
	}
	if relation.foundSharedVertex {
		if relation.containsEdge {
			return 1
		}
		return -1
	}

	// There are no edge intersections or shared vertices, so we can check
	// whether A contains an arbitrary vertex of B.
	if l.ContainsPoint(o.Vertex(0)) {
		return 1
	}
	return -1
}

// ContainsOrigin reports true if this loop contains s2.OriginPoint().
func (l *Loop) ContainsOrigin() bool {
	return l.originInside
}

// ReferencePoint returns the reference point for this loop.
func (l *Loop) ReferencePoint() ReferencePoint {
	return OriginReferencePoint(l.originInside)
}

// NumEdges returns the number of edges in this shape.
func (l *Loop) NumEdges() int {
	if l.isEmptyOrFull() {
		return 0
	}
	return len(l.vertices)
}

// Edge returns the endpoints for the given edge index.
func (l *Loop) Edge(i int) Edge {
	return Edge{l.Vertex(i), l.Vertex(i + 1)}
}

// NumChains reports the number of contiguous edge chains in the Loop.
func (l *Loop) NumChains() int {
	if l.IsEmpty() {
		return 0
	}
	return 1
}

// Chain returns the i-th edge chain in the Shape.
func (l *Loop) Chain(chainID int) Chain {
	return Chain{0, l.NumEdges()}
}

// ChainEdge returns the j-th edge of the i-th edge chain.
func (l *Loop) ChainEdge(chainID, offset int) Edge {
	return Edge{l.Vertex(offset), l.Vertex(offset + 1)}
}

// ChainPosition returns a ChainPosition pair (i, j) such that edgeID is the
// j-th edge of the Loop.
func (l *Loop) ChainPosition(edgeID int) ChainPosition {
	return ChainPosition{0, edgeID}
}

// Dimension returns the dimension of the geometry represented by this Loop.
func (l *Loop) Dimension() int { return 2 }

func (l *Loop) typeTag() typeTag { return typeTagNone }

func (l *Loop) privateInterface() {}

// IsEmpty reports true if this is the special empty loop that contains no points.
func (l *Loop) IsEmpty() bool {
	return l.isEmptyOrFull() && !l.ContainsOrigin()
}

// IsFull reports true if this is the special full loop that contains all points.
func (l *Loop) IsFull() bool {
	return l.isEmptyOrFull() && l.ContainsOrigin()
}

// isEmptyOrFull reports true if this loop is either the "empty" or "full" special loops.
func (l *Loop) isEmptyOrFull() bool {
	return len(l.vertices) == 1
}

// Vertices returns the vertices in the loop.
func (l *Loop) Vertices() []Point {
	return l.vertices
}

// RectBound returns a tight bounding rectangle. If the loop contains the point,
// the bound also contains it.
func (l *Loop) RectBound() Rect {
	return l.bound
}

// CapBound returns a bounding cap that may have more padding than the corresponding
// RectBound. The bound is conservative such that if the loop contains a point P,
// the bound also contains it.
func (l *Loop) CapBound() Cap {
	return l.bound.CapBound()
}

// Vertex returns the vertex for the given index. For convenience, the vertex indices
// wrap automatically for methods that do index math such as Edge.
// i.e., Vertex(NumEdges() + n) is the same as Vertex(n).
func (l *Loop) Vertex(i int) Point {
	return l.vertices[i%len(l.vertices)]
}

// OrientedVertex returns the vertex in reverse order if the loop represents a polygon
// hole. For example, arguments 0, 1, 2 are mapped to vertices n-1, n-2, n-3, where
// n == len(vertices). This ensures that the interior of the polygon is always to
// the left of the vertex chain.
//
// This requires: 0 <= i < 2 * len(vertices)
func (l *Loop) OrientedVertex(i int) Point {
	j := i - len(l.vertices)
	if j < 0 {
		j = i
	}
	if l.IsHole() {
		j = len(l.vertices) - 1 - j
	}
	return l.Vertex(j)
}

// NumVertices returns the number of vertices in this loop.
func (l *Loop) NumVertices() int {
	return len(l.vertices)
}

// bruteForceContainsPoint reports if the given point is contained by this loop.
// This method does not use the ShapeIndex, so it is only preferable below a certain
// size of loop.
func (l *Loop) bruteForceContainsPoint(p Point) bool {
	origin := OriginPoint()
	inside := l.originInside
	crosser := NewChainEdgeCrosser(origin, p, l.Vertex(0))
	for i := 1; i <= len(l.vertices); i++ { // add vertex 0 twice
		inside = inside != crosser.EdgeOrVertexChainCrossing(l.Vertex(i))
	}
	return inside
}

// ContainsPoint returns true if the loop contains the point.
func (l *Loop) ContainsPoint(p Point) bool {
	if !l.index.IsFresh() && !l.bound.ContainsPoint(p) {
		return false
	}

	// For small loops it is faster to just check all the crossings.  We also
	// use this method during loop initialization because InitOriginAndBound()
	// calls Contains() before InitIndex().  Otherwise, we keep track of the
	// number of calls to Contains() and only build the index when enough calls
	// have been made so that we think it is worth the effort.  Note that the
	// code below is structured so that if many calls are made in parallel only
	// one thread builds the index, while the rest continue using brute force
	// until the index is actually available.

	const maxBruteForceVertices = 32
	// TODO(roberts): add unindexed contains calls tracking

	if len(l.index.shapes) == 0 || // Index has not been initialized yet.
		len(l.vertices) <= maxBruteForceVertices {
		return l.bruteForceContainsPoint(p)
	}

	// Otherwise, look up the point in the index.
	it := l.index.Iterator()
	if !it.LocatePoint(p) {
		return false
	}
	return l.iteratorContainsPoint(it, p)
}

// ContainsCell reports whether the given Cell is contained by this Loop.
func (l *Loop) ContainsCell(target Cell) bool {
	it := l.index.Iterator()
	relation := it.LocateCellID(target.ID())

	// If "target" is disjoint from all index cells, it is not contained.
	// Similarly, if "target" is subdivided into one or more index cells then it
	// is not contained, since index cells are subdivided only if they (nearly)
	// intersect a sufficient number of edges.  (But note that if "target" itself
	// is an index cell then it may be contained, since it could be a cell with
	// no edges in the loop interior.)
	if relation != Indexed {
		return false
	}

	// Otherwise check if any edges intersect "target".
	if l.boundaryApproxIntersects(it, target) {
		return false
	}

	// Otherwise check if the loop contains the center of "target".
	return l.iteratorContainsPoint(it, target.Center())
}

// IntersectsCell reports whether this Loop intersects the given cell.
func (l *Loop) IntersectsCell(target Cell) bool {
	it := l.index.Iterator()
	relation := it.LocateCellID(target.ID())

	// If target does not overlap any index cell, there is no intersection.
	if relation == Disjoint {
		return false
	}
	// If target is subdivided into one or more index cells, there is an
	// intersection to within the ShapeIndex error bound (see Contains).
	if relation == Subdivided {
		return true
	}
	// If target is an index cell, there is an intersection because index cells
	// are created only if they have at least one edge or they are entirely
	// contained by the loop.
	if it.CellID() == target.id {
		return true
	}
	// Otherwise check if any edges intersect target.
	if l.boundaryApproxIntersects(it, target) {
		return true
	}
	// Otherwise check if the loop contains the center of target.
	return l.iteratorContainsPoint(it, target.Center())
}

// CellUnionBound computes a covering of the Loop.
func (l *Loop) CellUnionBound() []CellID {
	return l.CapBound().CellUnionBound()
}

// boundaryApproxIntersects reports if the loop's boundary intersects target.
// It may also return true when the loop boundary does not intersect target but
// some edge comes within the worst-case error tolerance.
//
// This requires that it.Locate(target) returned Indexed.
func (l *Loop) boundaryApproxIntersects(it *ShapeIndexIterator, target Cell) bool {
	aClipped := it.IndexCell().findByShapeID(0)

	// If there are no edges, there is no intersection.
	if len(aClipped.edges) == 0 {
		return false
	}

	// We can save some work if target is the index cell itself.
	if it.CellID() == target.ID() {
		return true
	}

	// Otherwise check whether any of the edges intersect target.
	maxError := (faceClipErrorUVCoord + intersectsRectErrorUVDist)
	bound := target.BoundUV().ExpandedByMargin(maxError)
	for _, ai := range aClipped.edges {
		v0, v1, ok := ClipToPaddedFace(l.Vertex(ai), l.Vertex(ai+1), target.Face(), maxError)
		if ok && edgeIntersectsRect(v0, v1, bound) {
			return true
		}
	}
	return false
}

// iteratorContainsPoint reports if the iterator that is positioned at the ShapeIndexCell
// that may contain p, contains the point p.
func (l *Loop) iteratorContainsPoint(it *ShapeIndexIterator, p Point) bool {
	// Test containment by drawing a line segment from the cell center to the
	// given point and counting edge crossings.
	aClipped := it.IndexCell().findByShapeID(0)
	inside := aClipped.containsCenter
	if len(aClipped.edges) > 0 {
		center := it.Center()
		crosser := NewEdgeCrosser(center, p)
		aiPrev := -2
		for _, ai := range aClipped.edges {
			if ai != aiPrev+1 {
				crosser.RestartAt(l.Vertex(ai))
			}
			aiPrev = ai
			inside = inside != crosser.EdgeOrVertexChainCrossing(l.Vertex(ai+1))
		}
	}
	return inside
}

// RegularLoop creates a loop with the given number of vertices, all
// located on a circle of the specified radius around the given center.
func RegularLoop(center Point, radius s1.Angle, numVertices int) *Loop {
	return RegularLoopForFrame(getFrame(center), radius, numVertices)
}

// RegularLoopForFrame creates a loop centered around the z-axis of the given
// coordinate frame, with the first vertex in the direction of the positive x-axis.
func RegularLoopForFrame(frame matrix3x3, radius s1.Angle, numVertices int) *Loop {
	return LoopFromPoints(regularPointsForFrame(frame, radius, numVertices))
}

// CanonicalFirstVertex returns a first index and a direction (either +1 or -1)
// such that the vertex sequence (first, first+dir, ..., first+(n-1)*dir) does
// not change when the loop vertex order is rotated or inverted. This allows the
// loop vertices to be traversed in a canonical order. The return values are
// chosen such that (first, ..., first+n*dir) are in the range [0, 2*n-1] as
// expected by the Vertex method.
func (l *Loop) CanonicalFirstVertex() (firstIdx, direction int) {
	firstIdx = 0
	n := len(l.vertices)
	for i := 1; i < n; i++ {
		if l.Vertex(i).Cmp(l.Vertex(firstIdx).Vector) == -1 {
			firstIdx = i
		}
	}

	// 0 <= firstIdx <= n-1, so (firstIdx+n*dir) <= 2*n-1.
	if l.Vertex(firstIdx+1).Cmp(l.Vertex(firstIdx+n-1).Vector) == -1 {
		return firstIdx, 1
	}

	// n <= firstIdx <= 2*n-1, so (firstIdx+n*dir) >= 0.
	firstIdx += n
	return firstIdx, -1
}

// TurningAngle returns the sum of the turning angles at each vertex. The return
// value is positive if the loop is counter-clockwise, negative if the loop is
// clockwise, and zero if the loop is a great circle. Degenerate and
// nearly-degenerate loops are handled consistently with Sign. So for example,
// if a loop has zero area (i.e., it is a very small CCW loop) then the turning
// angle will always be negative.
//
// This quantity is also called the "geodesic curvature" of the loop.
func (l *Loop) TurningAngle() float64 {
	// For empty and full loops, we return the limit value as the loop area
	// approaches 0 or 4*Pi respectively.
	if l.isEmptyOrFull() {
		if l.ContainsOrigin() {
			return -2 * math.Pi
		}
		return 2 * math.Pi
	}

	// Don't crash even if the loop is not well-defined.
	if len(l.vertices) < 3 {
		return 0
	}

	// To ensure that we get the same result when the vertex order is rotated,
	// and that the result is negated when the vertex order is reversed, we need
	// to add up the individual turn angles in a consistent order. (In general,
	// adding up a set of numbers in a different order can change the sum due to
	// rounding errors.)
	//
	// Furthermore, if we just accumulate an ordinary sum then the worst-case
	// error is quadratic in the number of vertices. (This can happen with
	// spiral shapes, where the partial sum of the turning angles can be linear
	// in the number of vertices.) To avoid this we use the Kahan summation
	// algorithm (http://en.wikipedia.org/wiki/Kahan_summation_algorithm).
	n := len(l.vertices)
	i, dir := l.CanonicalFirstVertex()
	sum := TurnAngle(l.Vertex((i+n-dir)%n), l.Vertex(i), l.Vertex((i+dir)%n))

	compensation := s1.Angle(0)
	for n-1 > 0 {
		i += dir
		angle := TurnAngle(l.Vertex(i-dir), l.Vertex(i), l.Vertex(i+dir))
		oldSum := sum
		angle += compensation
		sum += angle
		compensation = (oldSum - sum) + angle
		n--
	}

	const maxCurvature = 2*math.Pi - 4*dblEpsilon

	return math.Max(-maxCurvature, math.Min(maxCurvature, float64(dir)*float64(sum+compensation)))
}

// turningAngleMaxError return the maximum error in TurningAngle. The value is not
// constant; it depends on the loop.
func (l *Loop) turningAngleMaxError() float64 {
	// The maximum error can be bounded as follows:
	//   3.00 * dblEpsilon    for RobustCrossProd(b, a)
	//   3.00 * dblEpsilon    for RobustCrossProd(c, b)
	//   3.25 * dblEpsilon    for Angle()
	//   2.00 * dblEpsilon    for each addition in the Kahan summation
	//   ------------------
	//  11.25 * dblEpsilon
	maxErrorPerVertex := 11.25 * dblEpsilon
	return maxErrorPerVertex * float64(len(l.vertices))
}

// IsHole reports whether this loop represents a hole in its containing polygon.
func (l *Loop) IsHole() bool { return l.depth&1 != 0 }

// Sign returns -1 if this Loop represents a hole in its containing polygon, and +1 otherwise.
func (l *Loop) Sign() int {
	if l.IsHole() {
		return -1
	}
	return 1
}

// IsNormalized reports whether the loop area is at most 2*pi. Degenerate loops are
// handled consistently with Sign, i.e., if a loop can be
// expressed as the union of degenerate or nearly-degenerate CCW triangles,
// then it will always be considered normalized.
func (l *Loop) IsNormalized() bool {
	// Optimization: if the longitude span is less than 180 degrees, then the
	// loop covers less than half the sphere and is therefore normalized.
	if l.bound.Lng.Length() < math.Pi {
		return true
	}

	// We allow some error so that hemispheres are always considered normalized.
	// TODO(roberts): This is no longer required by the Polygon implementation,
	// so alternatively we could create the invariant that a loop is normalized
	// if and only if its complement is not normalized.
	return l.TurningAngle() >= -l.turningAngleMaxError()
}

// Normalize inverts the loop if necessary so that the area enclosed by the loop
// is at most 2*pi.
func (l *Loop) Normalize() {
	if !l.IsNormalized() {
		l.Invert()
	}
}

// Invert reverses the order of the loop vertices, effectively complementing the
// region represented by the loop. For example, the loop ABCD (with edges
// AB, BC, CD, DA) becomes the loop DCBA (with edges DC, CB, BA, AD).
// Notice that the last edge is the same in both cases except that its
// direction has been reversed.
func (l *Loop) Invert() {
	l.index.Reset()
	if l.isEmptyOrFull() {
		if l.IsFull() {
			l.vertices[0] = emptyLoopPoint
		} else {
			l.vertices[0] = fullLoopPoint
		}
	} else {
		// For non-special loops, reverse the slice of vertices.
		for i := len(l.vertices)/2 - 1; i >= 0; i-- {
			opp := len(l.vertices) - 1 - i
			l.vertices[i], l.vertices[opp] = l.vertices[opp], l.vertices[i]
		}
	}

	// originInside must be set correctly before building the ShapeIndex.
	l.originInside = !l.originInside
	if l.bound.Lat.Lo > -math.Pi/2 && l.bound.Lat.Hi < math.Pi/2 {
		// The complement of this loop contains both poles.
		l.bound = FullRect()
		l.subregionBound = l.bound
	} else {
		l.initBound()
	}
	l.index.Add(l)
}

// findVertex returns the index of the vertex at the given Point in the range
// 1..numVertices, and a boolean indicating if a vertex was found.
func (l *Loop) findVertex(p Point) (index int, ok bool) {
	const notFound = 0
	if len(l.vertices) < 10 {
		// Exhaustive search for loops below a small threshold.
		for i := 1; i <= len(l.vertices); i++ {
			if l.Vertex(i) == p {
				return i, true
			}
		}
		return notFound, false
	}

	it := l.index.Iterator()
	if !it.LocatePoint(p) {
		return notFound, false
	}

	aClipped := it.IndexCell().findByShapeID(0)
	for i := aClipped.numEdges() - 1; i >= 0; i-- {
		ai := aClipped.edges[i]
		if l.Vertex(ai) == p {
			if ai == 0 {
				return len(l.vertices), true
			}
			return ai, true
		}

		if l.Vertex(ai+1) == p {
			return ai + 1, true
		}
	}
	return notFound, false
}

// ContainsNested reports whether the given loops is contained within this loop.
// This function does not test for edge intersections. The two loops must meet
// all of the Polygon requirements; for example this implies that their
// boundaries may not cross or have any shared edges (although they may have
// shared vertices).
func (l *Loop) ContainsNested(other *Loop) bool {
	if !l.subregionBound.Contains(other.bound) {
		return false
	}

	// Special cases to handle either loop being empty or full.  Also bail out
	// when B has no vertices to avoid heap overflow on the vertex(1) call
	// below.  (This method is called during polygon initialization before the
	// client has an opportunity to call IsValid().)
	if l.isEmptyOrFull() || other.NumVertices() < 2 {
		return l.IsFull() || other.IsEmpty()
	}

	// We are given that A and B do not share any edges, and that either one
	// loop contains the other or they do not intersect.
	m, ok := l.findVertex(other.Vertex(1))
	if !ok {
		// Since other.vertex(1) is not shared, we can check whether A contains it.
		return l.ContainsPoint(other.Vertex(1))
	}

	// Check whether the edge order around other.Vertex(1) is compatible with
	// A containing B.
	return WedgeContains(l.Vertex(m-1), l.Vertex(m), l.Vertex(m+1), other.Vertex(0), other.Vertex(2))
}

// surfaceIntegralFloat64 computes the oriented surface integral of some quantity f(x)
// over the loop interior, given a function f(A,B,C) that returns the
// corresponding integral over the spherical triangle ABC. Here "oriented
// surface integral" means:
//
// (1) f(A,B,C) must be the integral of f if ABC is counterclockwise,
//
//	and the integral of -f if ABC is clockwise.
//
// (2) The result of this function is *either* the integral of f over the
//
//	loop interior, or the integral of (-f) over the loop exterior.
//
// Note that there are at least two common situations where it easy to work
// around property (2) above:
//
//   - If the integral of f over the entire sphere is zero, then it doesn't
//     matter which case is returned because they are always equal.
//
//   - If f is non-negative, then it is easy to detect when the integral over
//     the loop exterior has been returned, and the integral over the loop
//     interior can be obtained by adding the integral of f over the entire
//     unit sphere (a constant) to the result.
//
// Any changes to this method may need corresponding changes to surfaceIntegralPoint as well.
func (l *Loop) surfaceIntegralFloat64(f func(a, b, c Point) float64) float64 {
	// We sum f over a collection T of oriented triangles, possibly
	// overlapping. Let the sign of a triangle be +1 if it is CCW and -1
	// otherwise, and let the sign of a point x be the sum of the signs of the
	// triangles containing x. Then the collection of triangles T is chosen
	// such that either:
	//
	//  (1) Each point in the loop interior has sign +1, and sign 0 otherwise; or
	//  (2) Each point in the loop exterior has sign -1, and sign 0 otherwise.
	//
	// The triangles basically consist of a fan from vertex 0 to every loop
	// edge that does not include vertex 0. These triangles will always satisfy
	// either (1) or (2). However, what makes this a bit tricky is that
	// spherical edges become numerically unstable as their length approaches
	// 180 degrees. Of course there is not much we can do if the loop itself
	// contains such edges, but we would like to make sure that all the triangle
	// edges under our control (i.e., the non-loop edges) are stable. For
	// example, consider a loop around the equator consisting of four equally
	// spaced points. This is a well-defined loop, but we cannot just split it
	// into two triangles by connecting vertex 0 to vertex 2.
	//
	// We handle this type of situation by moving the origin of the triangle fan
	// whenever we are about to create an unstable edge. We choose a new
	// location for the origin such that all relevant edges are stable. We also
	// create extra triangles with the appropriate orientation so that the sum
	// of the triangle signs is still correct at every point.

	// The maximum length of an edge for it to be considered numerically stable.
	// The exact value is fairly arbitrary since it depends on the stability of
	// the function f. The value below is quite conservative but could be
	// reduced further if desired.
	const maxLength = math.Pi - 1e-5

	var sum float64
	origin := l.Vertex(0)
	for i := 1; i+1 < len(l.vertices); i++ {
		// Let V_i be vertex(i), let O be the current origin, and let length(A,B)
		// be the length of edge (A,B). At the start of each loop iteration, the
		// "leading edge" of the triangle fan is (O,V_i), and we want to extend
		// the triangle fan so that the leading edge is (O,V_i+1).
		//
		// Invariants:
		//  1. length(O,V_i) < maxLength for all (i > 1).
		//  2. Either O == V_0, or O is approximately perpendicular to V_0.
		//  3. "sum" is the oriented integral of f over the area defined by
		//     (O, V_0, V_1, ..., V_i).
		if l.Vertex(i+1).Angle(origin.Vector) > maxLength {
			// We are about to create an unstable edge, so choose a new origin O'
			// for the triangle fan.
			oldOrigin := origin
			if origin == l.Vertex(0) {
				// The following point is well-separated from V_i and V_0 (and
				// therefore V_i+1 as well).
				origin = Point{l.Vertex(0).PointCross(l.Vertex(i)).Normalize()}
			} else if l.Vertex(i).Angle(l.Vertex(0).Vector) < maxLength {
				// All edges of the triangle (O, V_0, V_i) are stable, so we can
				// revert to using V_0 as the origin.
				origin = l.Vertex(0)
			} else {
				// (O, V_i+1) and (V_0, V_i) are antipodal pairs, and O and V_0 are
				// perpendicular. Therefore V_0.CrossProd(O) is approximately
				// perpendicular to all of {O, V_0, V_i, V_i+1}, and we can choose
				// this point O' as the new origin.
				origin = Point{l.Vertex(0).Cross(oldOrigin.Vector)}

				// Advance the edge (V_0,O) to (V_0,O').
				sum += f(l.Vertex(0), oldOrigin, origin)
			}
			// Advance the edge (O,V_i) to (O',V_i).
			sum += f(oldOrigin, l.Vertex(i), origin)
		}
		// Advance the edge (O,V_i) to (O,V_i+1).
		sum += f(origin, l.Vertex(i), l.Vertex(i+1))
	}
	// If the origin is not V_0, we need to sum one more triangle.
	if origin != l.Vertex(0) {
		// Advance the edge (O,V_n-1) to (O,V_0).
		sum += f(origin, l.Vertex(len(l.vertices)-1), l.Vertex(0))
	}
	return sum
}

// surfaceIntegralPoint mirrors the surfaceIntegralFloat64 method but over Points;
// see that method for commentary. The C++ version uses a templated method.
// Any changes to this method may need corresponding changes to surfaceIntegralFloat64 as well.
func (l *Loop) surfaceIntegralPoint(f func(a, b, c Point) Point) Point {
	const maxLength = math.Pi - 1e-5
	var sum r3.Vector

	origin := l.Vertex(0)
	for i := 1; i+1 < len(l.vertices); i++ {
		if l.Vertex(i+1).Angle(origin.Vector) > maxLength {
			oldOrigin := origin
			if origin == l.Vertex(0) {
				origin = Point{l.Vertex(0).PointCross(l.Vertex(i)).Normalize()}
			} else if l.Vertex(i).Angle(l.Vertex(0).Vector) < maxLength {
				origin = l.Vertex(0)
			} else {
				origin = Point{l.Vertex(0).Cross(oldOrigin.Vector)}
				sum = sum.Add(f(l.Vertex(0), oldOrigin, origin).Vector)
			}
			sum = sum.Add(f(oldOrigin, l.Vertex(i), origin).Vector)
		}
		sum = sum.Add(f(origin, l.Vertex(i), l.Vertex(i+1)).Vector)
	}
	if origin != l.Vertex(0) {
		sum = sum.Add(f(origin, l.Vertex(len(l.vertices)-1), l.Vertex(0)).Vector)
	}
	return Point{sum}
}

// Area returns the area of the loop interior, i.e. the region on the left side of
// the loop. The return value is between 0 and 4*pi. (Note that the return
// value is not affected by whether this loop is a "hole" or a "shell".)
func (l *Loop) Area() float64 {
	// It is surprisingly difficult to compute the area of a loop robustly. The
	// main issues are (1) whether degenerate loops are considered to be CCW or
	// not (i.e., whether their area is close to 0 or 4*pi), and (2) computing
	// the areas of small loops with good relative accuracy.
	//
	// With respect to degeneracies, we would like Area to be consistent
	// with ContainsPoint in that loops that contain many points
	// should have large areas, and loops that contain few points should have
	// small areas. For example, if a degenerate triangle is considered CCW
	// according to s2predicates Sign, then it will contain very few points and
	// its area should be approximately zero. On the other hand if it is
	// considered clockwise, then it will contain virtually all points and so
	// its area should be approximately 4*pi.
	//
	// More precisely, let U be the set of Points for which IsUnitLength
	// is true, let P(U) be the projection of those points onto the mathematical
	// unit sphere, and let V(P(U)) be the Voronoi diagram of the projected
	// points. Then for every loop x, we would like Area to approximately
	// equal the sum of the areas of the Voronoi regions of the points p for
	// which x.ContainsPoint(p) is true.
	//
	// The second issue is that we want to compute the area of small loops
	// accurately. This requires having good relative precision rather than
	// good absolute precision. For example, if the area of a loop is 1e-12 and
	// the error is 1e-15, then the area only has 3 digits of accuracy. (For
	// reference, 1e-12 is about 40 square meters on the surface of the earth.)
	// We would like to have good relative accuracy even for small loops.
	//
	// To achieve these goals, we combine two different methods of computing the
	// area. This first method is based on the Gauss-Bonnet theorem, which says
	// that the area enclosed by the loop equals 2*pi minus the total geodesic
	// curvature of the loop (i.e., the sum of the "turning angles" at all the
	// loop vertices). The big advantage of this method is that as long as we
	// use Sign to compute the turning angle at each vertex, then
	// degeneracies are always handled correctly. In other words, if a
	// degenerate loop is CCW according to the symbolic perturbations used by
	// Sign, then its turning angle will be approximately 2*pi.
	//
	// The disadvantage of the Gauss-Bonnet method is that its absolute error is
	// about 2e-15 times the number of vertices (see turningAngleMaxError).
	// So, it cannot compute the area of small loops accurately.
	//
	// The second method is based on splitting the loop into triangles and
	// summing the area of each triangle. To avoid the difficulty and expense
	// of decomposing the loop into a union of non-overlapping triangles,
	// instead we compute a signed sum over triangles that may overlap (see the
	// comments for surfaceIntegral). The advantage of this method
	// is that the area of each triangle can be computed with much better
	// relative accuracy (using l'Huilier's theorem). The disadvantage is that
	// the result is a signed area: CCW loops may yield a small positive value,
	// while CW loops may yield a small negative value (which is converted to a
	// positive area by adding 4*pi). This means that small errors in computing
	// the signed area may translate into a very large error in the result (if
	// the sign of the sum is incorrect).
	//
	// So, our strategy is to combine these two methods as follows. First we
	// compute the area using the "signed sum over triangles" approach (since it
	// is generally more accurate). We also estimate the maximum error in this
	// result. If the signed area is too close to zero (i.e., zero is within
	// the error bounds), then we double-check the sign of the result using the
	// Gauss-Bonnet method. (In fact we just call IsNormalized, which is
	// based on this method.) If the two methods disagree, we return either 0
	// or 4*pi based on the result of IsNormalized. Otherwise we return the
	// area that we computed originally.
	if l.isEmptyOrFull() {
		if l.ContainsOrigin() {
			return 4 * math.Pi
		}
		return 0
	}
	area := l.surfaceIntegralFloat64(SignedArea)

	// TODO(roberts): This error estimate is very approximate. There are two
	// issues: (1) SignedArea needs some improvements to ensure that its error
	// is actually never higher than GirardArea, and (2) although the number of
	// triangles in the sum is typically N-2, in theory it could be as high as
	// 2*N for pathological inputs. But in other respects this error bound is
	// very conservative since it assumes that the maximum error is achieved on
	// every triangle.
	maxError := l.turningAngleMaxError()

	// The signed area should be between approximately -4*pi and 4*pi.
	if area < 0 {
		// We have computed the negative of the area of the loop exterior.
		area += 4 * math.Pi
	}

	if area > 4*math.Pi {
		area = 4 * math.Pi
	}
	if area < 0 {
		area = 0
	}

	// If the area is close enough to zero or 4*pi so that the loop orientation
	// is ambiguous, then we compute the loop orientation explicitly.
	if area < maxError && !l.IsNormalized() {
		return 4 * math.Pi
	} else if area > (4*math.Pi-maxError) && l.IsNormalized() {
		return 0
	}

	return area
}

// Centroid returns the true centroid of the loop multiplied by the area of the
// loop. The result is not unit length, so you may want to normalize it. Also
// note that in general, the centroid may not be contained by the loop.
//
// We prescale by the loop area for two reasons: (1) it is cheaper to
// compute this way, and (2) it makes it easier to compute the centroid of
// more complicated shapes (by splitting them into disjoint regions and
// adding their centroids).
//
// Note that the return value is not affected by whether this loop is a
// "hole" or a "shell".
func (l *Loop) Centroid() Point {
	// surfaceIntegralPoint() returns either the integral of position over loop
	// interior, or the negative of the integral of position over the loop
	// exterior. But these two values are the same (!), because the integral of
	// position over the entire sphere is (0, 0, 0).
	return l.surfaceIntegralPoint(TrueCentroid)
}

// Encode encodes the Loop.
func (l Loop) Encode(w io.Writer) error {
	e := &encoder{w: w}
	l.encode(e)
	return e.err
}

func (l Loop) encode(e *encoder) {
	e.writeInt8(encodingVersion)
	e.writeUint32(uint32(len(l.vertices)))
	for _, v := range l.vertices {
		e.writeFloat64(v.X)
		e.writeFloat64(v.Y)
		e.writeFloat64(v.Z)
	}

	e.writeBool(l.originInside)
	e.writeInt32(int32(l.depth))

	// Encode the bound.
	l.bound.encode(e)
}

func init() {
	var f64 float64
	sizeOfFloat64 = int(reflect.TypeOf(f64).Size())
	sizeOfVertex = 3 * sizeOfFloat64
}

var sizeOfFloat64 int
var sizeOfVertex int

// Decode decodes a loop.
func (l *Loop) Decode(r io.Reader) error {
	*l = Loop{}
	d := &decoder{r: asByteReader(r)}
	l.decode(d)
	return d.err
}

func (l *Loop) decode(d *decoder) {
	version := int8(d.readUint8())
	if d.err != nil {
		return
	}
	if version != encodingVersion {
		d.err = fmt.Errorf("cannot decode version %d", version)
		return
	}

	// Empty loops are explicitly allowed here: a newly created loop has zero vertices
	// and such loops encode and decode properly.
	nvertices := d.readUint32()
	if nvertices > maxEncodedVertices {
		if d.err == nil {
			d.err = fmt.Errorf("too many vertices (%d; max is %d)", nvertices, maxEncodedVertices)

		}
		return
	}
	l.vertices = make([]Point, nvertices)

	// Each vertex requires 24 bytes of storage
	numBytesNeeded := int(nvertices) * sizeOfVertex

	i := 0

	for numBytesNeeded > 0 {
		arr := l.BufPool.Get(numBytesNeeded)
		numBytesRead := d.readFloat64Array(numBytesNeeded, arr)

		if numBytesRead == 0 {
			break
		}

		numBytesNeeded -= numBytesRead

		// Parsing one vertex at a time into the vertex array of the loop
		// by going through the buffer in steps of sizeOfVertex and converting
		// floatSize worth of bytes into the float values
		for j := 0; j < int(numBytesRead/sizeOfVertex); j++ {
			l.vertices[i+j].X = math.Float64frombits(
				binary.LittleEndian.Uint64(arr[sizeOfFloat64*(j*3) : sizeOfFloat64*(j*3+1)]))
			l.vertices[i+j].Y = math.Float64frombits(
				binary.LittleEndian.Uint64(arr[sizeOfFloat64*(j*3+1) : sizeOfFloat64*(j*3+2)]))
			l.vertices[i+j].Z = math.Float64frombits(
				binary.LittleEndian.Uint64(arr[sizeOfFloat64*(j*3+2) : sizeOfFloat64*(j*3+3)]))
		}

		i += int(numBytesRead/sizeOfVertex)
	}

	l.index = NewShapeIndex()
	l.originInside = d.readBool()
	l.depth = int(d.readUint32())
	l.bound.decode(d)
	l.subregionBound = ExpandForSubregions(l.bound)

	l.index.Add(l)
}

// Bitmasks to read from properties.
const (
	originInside = 1 << iota
	boundEncoded
)

func (l *Loop) xyzFaceSiTiVertices() []xyzFaceSiTi {
	ret := make([]xyzFaceSiTi, len(l.vertices))
	for i, v := range l.vertices {
		ret[i].xyz = v
		ret[i].face, ret[i].si, ret[i].ti, ret[i].level = xyzToFaceSiTi(v)
	}
	return ret
}

func (l *Loop) encodeCompressed(e *encoder, snapLevel int, vertices []xyzFaceSiTi) {
	if len(l.vertices) != len(vertices) {
		panic("encodeCompressed: vertices must be the same length as l.vertices")
	}
	if len(vertices) > maxEncodedVertices {
		if e.err == nil {
			e.err = fmt.Errorf("too many vertices (%d; max is %d)", len(vertices), maxEncodedVertices)
		}
		return
	}
	e.writeUvarint(uint64(len(vertices)))
	encodePointsCompressed(e, vertices, snapLevel)

	props := l.compressedEncodingProperties()
	e.writeUvarint(props)
	e.writeUvarint(uint64(l.depth))
	if props&boundEncoded != 0 {
		l.bound.encode(e)
	}
}

func (l *Loop) compressedEncodingProperties() uint64 {
	var properties uint64
	if l.originInside {
		properties |= originInside
	}

	// Write whether there is a bound so we can change the threshold later.
	// Recomputing the bound multiplies the decode time taken per vertex
	// by a factor of about 3.5.  Without recomputing the bound, decode
	// takes approximately 125 ns / vertex.  A loop with 63 vertices
	// encoded without the bound will take ~30us to decode, which is
	// acceptable.  At ~3.5 bytes / vertex without the bound, adding
	// the bound will increase the size by <15%, which is also acceptable.
	const minVerticesForBound = 64
	if len(l.vertices) >= minVerticesForBound {
		properties |= boundEncoded
	}

	return properties
}

func (l *Loop) decodeCompressed(d *decoder, snapLevel int) {
	nvertices := d.readUvarint()
	if d.err != nil {
		return
	}
	if nvertices > maxEncodedVertices {
		d.err = fmt.Errorf("too many vertices (%d; max is %d)", nvertices, maxEncodedVertices)
		return
	}
	l.vertices = make([]Point, nvertices)
	decodePointsCompressed(d, snapLevel, l.vertices)
	properties := d.readUvarint()

	// Make sure values are valid before using.
	if d.err != nil {
		return
	}

	l.index = NewShapeIndex()
	l.originInside = (properties & originInside) != 0

	l.depth = int(d.readUvarint())

	if (properties & boundEncoded) != 0 {
		l.bound.decode(d)
		if d.err != nil {
			return
		}
		l.subregionBound = ExpandForSubregions(l.bound)
	} else {
		l.initBound()
	}

	l.index.Add(l)
}

// crossingTarget is an enum representing the possible crossing target cases for relations.
type crossingTarget int

const (
	crossingTargetDontCare crossingTarget = iota
	crossingTargetDontCross
	crossingTargetCross
)

// loopRelation defines the interface for checking a type of relationship between two loops.
// Some examples of relations are Contains, Intersects, or CompareBoundary.
type loopRelation interface {
	// Optionally, aCrossingTarget and bCrossingTarget can specify an early-exit
	// condition for the loop relation. If any point P is found such that
	//
	//   A.ContainsPoint(P) == aCrossingTarget() &&
	//   B.ContainsPoint(P) == bCrossingTarget()
	//
	// then the loop relation is assumed to be the same as if a pair of crossing
	// edges were found. For example, the ContainsPoint relation has
	//
	//   aCrossingTarget() == crossingTargetDontCross
	//   bCrossingTarget() == crossingTargetCross
	//
	// because if A.ContainsPoint(P) == false and B.ContainsPoint(P) == true
	// for any point P, then it is equivalent to finding an edge crossing (i.e.,
	// since Contains returns false in both cases).
	//
	// Loop relations that do not have an early-exit condition of this form
	// should return crossingTargetDontCare for both crossing targets.

	// aCrossingTarget reports whether loop A crosses the target point with
	// the given relation type.
	aCrossingTarget() crossingTarget
	// bCrossingTarget reports whether loop B crosses the target point with
	// the given relation type.
	bCrossingTarget() crossingTarget

	// wedgesCross reports if a shared vertex ab1 and the two associated wedges
	// (a0, ab1, b2) and (b0, ab1, b2) are equivalent to an edge crossing.
	// The loop relation is also allowed to maintain its own internal state, and
	// can return true if it observes any sequence of wedges that are equivalent
	// to an edge crossing.
	wedgesCross(a0, ab1, a2, b0, b2 Point) bool
}

// loopCrosser is a helper type for determining whether two loops cross.
// It is instantiated twice for each pair of loops to be tested, once for the
// pair (A,B) and once for the pair (B,A), in order to be able to process
// edges in either loop nesting order.
type loopCrosser struct {
	a, b            *Loop
	relation        loopRelation
	swapped         bool
	aCrossingTarget crossingTarget
	bCrossingTarget crossingTarget

	// state maintained by startEdge and edgeCrossesCell.
	crosser    *EdgeCrosser
	aj, bjPrev int

	// temporary data declared here to avoid repeated memory allocations.
	bQuery *CrossingEdgeQuery
	bCells []*ShapeIndexCell
}

// newLoopCrosser creates a loopCrosser from the given values. If swapped is true,
// the loops A and B have been swapped. This affects how arguments are passed to
// the given loop relation, since for example A.Contains(B) is not the same as
// B.Contains(A).
func newLoopCrosser(a, b *Loop, relation loopRelation, swapped bool) *loopCrosser {
	l := &loopCrosser{
		a:               a,
		b:               b,
		relation:        relation,
		swapped:         swapped,
		aCrossingTarget: relation.aCrossingTarget(),
		bCrossingTarget: relation.bCrossingTarget(),
		bQuery:          NewCrossingEdgeQuery(b.index),
	}
	if swapped {
		l.aCrossingTarget, l.bCrossingTarget = l.bCrossingTarget, l.aCrossingTarget
	}

	return l
}

// startEdge sets the crossers state for checking the given edge of loop A.
func (l *loopCrosser) startEdge(aj int) {
	l.crosser = NewEdgeCrosser(l.a.Vertex(aj), l.a.Vertex(aj+1))
	l.aj = aj
	l.bjPrev = -2
}

// edgeCrossesCell reports whether the current edge of loop A has any crossings with
// edges of the index cell of loop B.
func (l *loopCrosser) edgeCrossesCell(bClipped *clippedShape) bool {
	// Test the current edge of A against all edges of bClipped
	bNumEdges := bClipped.numEdges()
	for j := 0; j < bNumEdges; j++ {
		bj := bClipped.edges[j]
		if bj != l.bjPrev+1 {
			l.crosser.RestartAt(l.b.Vertex(bj))
		}
		l.bjPrev = bj
		if crossing := l.crosser.ChainCrossingSign(l.b.Vertex(bj + 1)); crossing == DoNotCross {
			continue
		} else if crossing == Cross {
			return true
		}

		// We only need to check each shared vertex once, so we only
		// consider the case where l.aVertex(l.aj+1) == l.b.Vertex(bj+1).
		if l.a.Vertex(l.aj+1) == l.b.Vertex(bj+1) {
			if l.swapped {
				if l.relation.wedgesCross(l.b.Vertex(bj), l.b.Vertex(bj+1), l.b.Vertex(bj+2), l.a.Vertex(l.aj), l.a.Vertex(l.aj+2)) {
					return true
				}
			} else {
				if l.relation.wedgesCross(l.a.Vertex(l.aj), l.a.Vertex(l.aj+1), l.a.Vertex(l.aj+2), l.b.Vertex(bj), l.b.Vertex(bj+2)) {
					return true
				}
			}
		}
	}

	return false
}

// cellCrossesCell reports whether there are any edge crossings or wedge crossings
// within the two given cells.
func (l *loopCrosser) cellCrossesCell(aClipped, bClipped *clippedShape) bool {
	// Test all edges of aClipped against all edges of bClipped.
	for _, edge := range aClipped.edges {
		l.startEdge(edge)
		if l.edgeCrossesCell(bClipped) {
			return true
		}
	}

	return false
}

// cellCrossesAnySubcell reports whether given an index cell of A, if there are any
// edge or wedge crossings with any index cell of B contained within bID.
func (l *loopCrosser) cellCrossesAnySubcell(aClipped *clippedShape, bID CellID) bool {
	// Test all edges of aClipped against all edges of B. The relevant B
	// edges are guaranteed to be children of bID, which lets us find the
	// correct index cells more efficiently.
	bRoot := PaddedCellFromCellID(bID, 0)
	for _, aj := range aClipped.edges {
		// Use a CrossingEdgeQuery starting at bRoot to find the index cells
		// of B that might contain crossing edges.
		l.bCells = l.bQuery.getCells(l.a.Vertex(aj), l.a.Vertex(aj+1), bRoot)
		if len(l.bCells) == 0 {
			continue
		}
		l.startEdge(aj)
		for c := 0; c < len(l.bCells); c++ {
			if l.edgeCrossesCell(l.bCells[c].shapes[0]) {
				return true
			}
		}
	}

	return false
}

// hasCrossing reports whether given two iterators positioned such that
// ai.cellID().ContainsCellID(bi.cellID()), there is an edge or wedge crossing
// anywhere within ai.cellID(). This function advances bi only past ai.cellID().
func (l *loopCrosser) hasCrossing(ai, bi *rangeIterator) bool {
	// If ai.CellID() intersects many edges of B, then it is faster to use
	// CrossingEdgeQuery to narrow down the candidates. But if it intersects
	// only a few edges, it is faster to check all the crossings directly.
	// We handle this by advancing bi and keeping track of how many edges we
	// would need to test.
	const edgeQueryMinEdges = 20 // Tuned from benchmarks.
	var totalEdges int
	l.bCells = nil

	for {
		if n := bi.clipped().numEdges(); n > 0 {
			totalEdges += n
			if totalEdges >= edgeQueryMinEdges {
				// There are too many edges to test them directly, so use CrossingEdgeQuery.
				if l.cellCrossesAnySubcell(ai.clipped(), ai.cellID()) {
					return true
				}
				bi.seekBeyond(ai)
				return false
			}
			l.bCells = append(l.bCells, bi.indexCell())
		}
		bi.next()
		if bi.cellID() > ai.rangeMax {
			break
		}
	}

	// Test all the edge crossings directly.
	for _, c := range l.bCells {
		if l.cellCrossesCell(ai.clipped(), c.shapes[0]) {
			return true
		}
	}

	return false
}

// containsCenterMatches reports if the clippedShapes containsCenter boolean
// corresponds to the crossing target type given. (This is to work around C++
// allowing false == 0, true == 1 type implicit conversions and comparisons)
func containsCenterMatches(containsCenter bool, target crossingTarget) bool {
	return (!containsCenter && target == crossingTargetDontCross) ||
		(containsCenter && target == crossingTargetCross)
}

// hasCrossingRelation reports whether given two iterators positioned such that
// ai.cellID().ContainsCellID(bi.cellID()), there is a crossing relationship
// anywhere within ai.cellID(). Specifically, this method returns true if there
// is an edge crossing, a wedge crossing, or a point P that matches both relations
// crossing targets. This function advances both iterators past ai.cellID.
func (l *loopCrosser) hasCrossingRelation(ai, bi *rangeIterator) bool {
	// ABSL_DCHECK(ai->id().contains(bi->id()));
	aClipped := ai.clipped()
	if aClipped.numEdges() != 0 {
		// The current cell of A has at least one edge, so check for crossings.
		if l.hasCrossing(ai, bi) {
			return true
		}
		ai.next()
		return false
	}

	if !containsCenterMatches(ai.containsCenter(), l.aCrossingTarget) {
		// The crossing target for A is not satisfied, so we skip over
		// these cells of B.
		bi.seekBeyond(ai)
		ai.next()
		return false
	}

	// All points within ai.cellID() satisfy the crossing target for A, so it's
	// worth iterating through the cells of B to see whether any cell
	// centers also satisfy the crossing target for B.
	for bi.cellID() <= ai.rangeMax {
		if containsCenterMatches(bi.containsCenter(), l.bCrossingTarget) {
			return true
		}
		bi.next()
	}
	ai.next()
	return false
}

// hasCrossingRelation checks all edges of loop A for intersection against all edges
// of loop B and reports if there are any that satisfy the given relation. If there
// is any shared vertex, the wedges centered at this vertex are sent to the given
// relation to be tested.
//
// If the two loop boundaries cross, this method is guaranteed to return
// true. It also returns true in certain cases if the loop relationship is
// equivalent to crossing. For example, if the relation is Contains and a
// point P is found such that B contains P but A does not contain P, this
// method will return true to indicate that the result is the same as though
// a pair of crossing edges were found (since Contains returns false in
// both cases).
//
// See Contains, Intersects and CompareBoundary for the three uses of this function.
func hasCrossingRelation(a, b *Loop, relation loopRelation) bool {
	// We look for CellID ranges where the indexes of A and B overlap, and
	// then test those edges for crossings.
	ai := newRangeIterator(a.index)
	bi := newRangeIterator(b.index)

	ab := newLoopCrosser(a, b, relation, false) // Tests edges of A against B
	ba := newLoopCrosser(b, a, relation, true)  // Tests edges of B against A

	for !ai.done() || !bi.done() {
		if ai.rangeMax < bi.rangeMin {
			// The A and B cells don't overlap, and A precedes B.
			ai.seekTo(bi)
		} else if bi.rangeMax < ai.rangeMin {
			// The A and B cells don't overlap, and B precedes A.
			bi.seekTo(ai)
		} else {
			// One cell contains the other. Determine which cell is larger.
			abRelation := int64(ai.it.CellID().lsb() - bi.it.CellID().lsb())
			if abRelation > 0 {
				// A's index cell is larger.
				if ab.hasCrossingRelation(ai, bi) {
					return true
				}
			} else if abRelation < 0 {
				// B's index cell is larger.
				if ba.hasCrossingRelation(bi, ai) {
					return true
				}
			} else {
				// The A and B cells are the same. Since the two
				// cells have the same center point P, check
				// whether P satisfies the crossing targets.
				if containsCenterMatches(ai.containsCenter(), ab.aCrossingTarget) &&
					containsCenterMatches(bi.containsCenter(), ab.bCrossingTarget) {
					return true
				}
				// Otherwise test all the edge crossings directly.
				aClipped := ai.clipped()
				bClipped := bi.clipped()
				if aClipped.numEdges() > 0 && bClipped.numEdges() > 0 && ab.cellCrossesCell(aClipped, bClipped) {
					return true
				}
				ai.next()
				bi.next()
			}
		}
	}
	return false
}

// containsRelation implements loopRelation for a contains operation. If
// A.ContainsPoint(P) == false && B.ContainsPoint(P) == true, it is equivalent
// to having an edge crossing (i.e., Contains returns false).
type containsRelation struct {
	foundSharedVertex bool
}

func (c *containsRelation) aCrossingTarget() crossingTarget { return crossingTargetDontCross }
func (c *containsRelation) bCrossingTarget() crossingTarget { return crossingTargetCross }
func (c *containsRelation) wedgesCross(a0, ab1, a2, b0, b2 Point) bool {
	c.foundSharedVertex = true
	return !WedgeContains(a0, ab1, a2, b0, b2)
}

// intersectsRelation implements loopRelation for an intersects operation. Given
// two loops, A and B, if A.ContainsPoint(P) == true && B.ContainsPoint(P) == true,
// it is equivalent to having an edge crossing (i.e., Intersects returns true).
type intersectsRelation struct {
	foundSharedVertex bool
}

func (i *intersectsRelation) aCrossingTarget() crossingTarget { return crossingTargetCross }
func (i *intersectsRelation) bCrossingTarget() crossingTarget { return crossingTargetCross }
func (i *intersectsRelation) wedgesCross(a0, ab1, a2, b0, b2 Point) bool {
	i.foundSharedVertex = true
	return WedgeIntersects(a0, ab1, a2, b0, b2)
}

// compareBoundaryRelation implements loopRelation for comparing boundaries.
//
// The compare boundary relation does not have a useful early-exit condition,
// so we return crossingTargetDontCare for both crossing targets.
//
// Aside: A possible early exit condition could be based on the following.
//
//	If A contains a point of both B and ~B, then A intersects Boundary(B).
//	If ~A contains a point of both B and ~B, then ~A intersects Boundary(B).
//	So if the intersections of {A, ~A} with {B, ~B} are all non-empty,
//	the return value is 0, i.e., Boundary(A) intersects Boundary(B).
//
// Unfortunately it isn't worth detecting this situation because by the
// time we have seen a point in all four intersection regions, we are also
// guaranteed to have seen at least one pair of crossing edges.
type compareBoundaryRelation struct {
	reverse           bool // True if the other loop should be reversed.
	foundSharedVertex bool // True if any wedge was processed.
	containsEdge      bool // True if any edge of the other loop is contained by this loop.
	excludesEdge      bool // True if any edge of the other loop is excluded by this loop.
}

func newCompareBoundaryRelation(reverse bool) *compareBoundaryRelation {
	return &compareBoundaryRelation{reverse: reverse}
}

func (c *compareBoundaryRelation) aCrossingTarget() crossingTarget { return crossingTargetDontCare }
func (c *compareBoundaryRelation) bCrossingTarget() crossingTarget { return crossingTargetDontCare }
func (c *compareBoundaryRelation) wedgesCross(a0, ab1, a2, b0, b2 Point) bool {
	// Because we don't care about the interior of the other, only its boundary,
	// it is sufficient to check whether this one contains the semiwedge (ab1, b2).
	c.foundSharedVertex = true
	if wedgeContainsSemiwedge(a0, ab1, a2, b2, c.reverse) {
		c.containsEdge = true
	} else {
		c.excludesEdge = true
	}
	return c.containsEdge && c.excludesEdge
}

// wedgeContainsSemiwedge reports whether the wedge (a0, ab1, a2) contains the
// "semiwedge" defined as any non-empty open set of rays immediately CCW from
// the edge (ab1, b2). If reverse is true, then substitute clockwise for CCW;
// this simulates what would happen if the direction of the other loop was reversed.
func wedgeContainsSemiwedge(a0, ab1, a2, b2 Point, reverse bool) bool {
	if b2 == a0 || b2 == a2 {
		// We have a shared or reversed edge.
		return (b2 == a0) == reverse
	}
	return OrderedCCW(a0, a2, b2, ab1)
}

// containsNonCrossingBoundary reports whether given two loops whose boundaries
// do not cross (see compareBoundary), if this loop contains the boundary of the
// other loop. If reverse is true, the boundary of the other loop is reversed
// first (which only affects the result when there are shared edges). This method
// is cheaper than compareBoundary because it does not test for edge intersections.
//
// This function requires that neither loop is empty, and that if the other is full,
// then reverse == false.
func (l *Loop) containsNonCrossingBoundary(other *Loop, reverseOther bool) bool {
	// The bounds must intersect for containment.
	if !l.bound.Intersects(other.bound) {
		return false
	}

	// Full loops are handled as though the loop surrounded the entire sphere.
	if l.IsFull() {
		return true
	}
	if other.IsFull() {
		return false
	}

	m, ok := l.findVertex(other.Vertex(0))
	if !ok {
		// Since the other loops vertex 0 is not shared, we can check if this contains it.
		return l.ContainsPoint(other.Vertex(0))
	}
	// Otherwise check whether the edge (b0, b1) is contained by this loop.
	return wedgeContainsSemiwedge(l.Vertex(m-1), l.Vertex(m), l.Vertex(m+1),
		other.Vertex(1), reverseOther)
}

// TODO(roberts): Differences from the C++ version:
// DistanceToPoint
// DistanceToBoundary
// Project
// ProjectToBoundary
// BoundaryApproxEqual
// BoundaryNear
