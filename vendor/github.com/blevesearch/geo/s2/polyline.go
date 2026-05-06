// Copyright 2016 Google Inc. All rights reserved.
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
	"fmt"
	"io"
	"math"

	"github.com/golang/geo/s1"
)

// Polyline represents a sequence of zero or more vertices connected by
// straight edges (geodesics). Edges of length 0 and 180 degrees are not
// allowed, i.e. adjacent vertices should not be identical or antipodal.
type Polyline []Point

// PolylineFromLatLngs creates a new Polyline from the given LatLngs.
func PolylineFromLatLngs(points []LatLng) *Polyline {
	p := make(Polyline, len(points))
	for k, v := range points {
		p[k] = PointFromLatLng(v)
	}
	return &p
}

// Reverse reverses the order of the Polyline vertices.
func (p *Polyline) Reverse() {
	for i := 0; i < len(*p)/2; i++ {
		(*p)[i], (*p)[len(*p)-i-1] = (*p)[len(*p)-i-1], (*p)[i]
	}
}

// Length returns the length of this Polyline.
func (p *Polyline) Length() s1.Angle {
	var length s1.Angle

	for i := 1; i < len(*p); i++ {
		length += (*p)[i-1].Distance((*p)[i])
	}
	return length
}

// Centroid returns the true centroid of the polyline multiplied by the length of the
// polyline. The result is not unit length, so you may wish to normalize it.
//
// Scaling by the Polyline length makes it easy to compute the centroid
// of several Polylines (by simply adding up their centroids).
func (p *Polyline) Centroid() Point {
	var centroid Point
	for i := 1; i < len(*p); i++ {
		// The centroid (multiplied by length) is a vector toward the midpoint
		// of the edge, whose length is twice the sin of half the angle between
		// the two vertices. Defining theta to be this angle, we have:
		vSum := (*p)[i-1].Add((*p)[i].Vector)  // Length == 2*cos(theta)
		vDiff := (*p)[i-1].Sub((*p)[i].Vector) // Length == 2*sin(theta)

		// Length == 2*sin(theta)
		centroid = Point{centroid.Add(vSum.Mul(math.Sqrt(vDiff.Norm2() / vSum.Norm2())))}
	}
	return centroid
}

// Equal reports whether the given Polyline is exactly the same as this one.
func (p *Polyline) Equal(b *Polyline) bool {
	if len(*p) != len(*b) {
		return false
	}
	for i, v := range *p {
		if v != (*b)[i] {
			return false
		}
	}

	return true
}

// ApproxEqual reports whether two polylines have the same number of vertices,
// and corresponding vertex pairs are separated by no more the standard margin.
func (p *Polyline) ApproxEqual(o *Polyline) bool {
	return p.approxEqual(o, s1.Angle(epsilon))
}

// approxEqual reports whether two polylines are equal within the given margin.
func (p *Polyline) approxEqual(o *Polyline, maxError s1.Angle) bool {
	if len(*p) != len(*o) {
		return false
	}
	for offset, val := range *p {
		if !val.approxEqual((*o)[offset], maxError) {
			return false
		}
	}
	return true
}

// CapBound returns the bounding Cap for this Polyline.
func (p *Polyline) CapBound() Cap {
	return p.RectBound().CapBound()
}

// RectBound returns the bounding Rect for this Polyline.
func (p *Polyline) RectBound() Rect {
	rb := NewRectBounder()
	for _, v := range *p {
		rb.AddPoint(v)
	}
	return rb.RectBound()
}

// ContainsCell reports whether this Polyline contains the given Cell. Always returns false
// because "containment" is not numerically well-defined except at the Polyline vertices.
func (p *Polyline) ContainsCell(cell Cell) bool {
	return false
}

// IntersectsCell reports whether this Polyline intersects the given Cell.
func (p *Polyline) IntersectsCell(cell Cell) bool {
	if len(*p) == 0 {
		return false
	}

	// We only need to check whether the cell contains vertex 0 for correctness,
	// but these tests are cheap compared to edge crossings so we might as well
	// check all the vertices.
	for _, v := range *p {
		if cell.ContainsPoint(v) {
			return true
		}
	}

	cellVertices := []Point{
		cell.Vertex(0),
		cell.Vertex(1),
		cell.Vertex(2),
		cell.Vertex(3),
	}

	for j := 0; j < 4; j++ {
		crosser := NewChainEdgeCrosser(cellVertices[j], cellVertices[(j+1)&3], (*p)[0])
		for i := 1; i < len(*p); i++ {
			if crosser.ChainCrossingSign((*p)[i]) != DoNotCross {
				// There is a proper crossing, or two vertices were the same.
				return true
			}
		}
	}
	return false
}

// ContainsPoint returns false since Polylines are not closed.
func (p *Polyline) ContainsPoint(point Point) bool {
	return false
}

// CellUnionBound computes a covering of the Polyline.
func (p *Polyline) CellUnionBound() []CellID {
	return p.CapBound().CellUnionBound()
}

// NumEdges returns the number of edges in this shape.
func (p *Polyline) NumEdges() int {
	if len(*p) == 0 {
		return 0
	}
	return len(*p) - 1
}

// Edge returns endpoints for the given edge index.
func (p *Polyline) Edge(i int) Edge {
	return Edge{(*p)[i], (*p)[i+1]}
}

// ReferencePoint returns the default reference point with negative containment because Polylines are not closed.
func (p *Polyline) ReferencePoint() ReferencePoint {
	return OriginReferencePoint(false)
}

// NumChains reports the number of contiguous edge chains in this Polyline.
func (p *Polyline) NumChains() int {
	return minInt(1, p.NumEdges())
}

// Chain returns the i-th edge Chain in the Shape.
func (p *Polyline) Chain(chainID int) Chain {
	return Chain{0, p.NumEdges()}
}

// ChainEdge returns the j-th edge of the i-th edge Chain.
func (p *Polyline) ChainEdge(chainID, offset int) Edge {
	return Edge{(*p)[offset], (*p)[offset+1]}
}

// ChainPosition returns a pair (i, j) such that edgeID is the j-th edge
func (p *Polyline) ChainPosition(edgeID int) ChainPosition {
	return ChainPosition{0, edgeID}
}

// Dimension returns the dimension of the geometry represented by this Polyline.
func (p *Polyline) Dimension() int { return 1 }

// IsEmpty reports whether this shape contains no points.
func (p *Polyline) IsEmpty() bool { return defaultShapeIsEmpty(p) }

// IsFull reports whether this shape contains all points on the sphere.
func (p *Polyline) IsFull() bool { return defaultShapeIsFull(p) }

func (p *Polyline) typeTag() typeTag { return typeTagPolyline }

func (p *Polyline) privateInterface() {}

// findEndVertex reports the maximal end index such that the line segment between
// the start index and this one such that the line segment between these two
// vertices passes within the given tolerance of all interior vertices, in order.
func findEndVertex(p Polyline, tolerance s1.Angle, index int) int {
	// The basic idea is to keep track of the "pie wedge" of angles
	// from the starting vertex such that a ray from the starting
	// vertex at that angle will pass through the discs of radius
	// tolerance centered around all vertices processed so far.
	//
	// First we define a coordinate frame for the tangent and normal
	// spaces at the starting vertex. Essentially this means picking
	// three orthonormal vectors X,Y,Z such that X and Y span the
	// tangent plane at the starting vertex, and Z is up. We use
	// the coordinate frame to define a mapping from 3D direction
	// vectors to a one-dimensional ray angle in the range (-π,
	// π]. The angle of a direction vector is computed by
	// transforming it into the X,Y,Z basis, and then calculating
	// atan2(y,x). This mapping allows us to represent a wedge of
	// angles as a 1D interval. Since the interval wraps around, we
	// represent it as an Interval, i.e. an interval on the unit
	// circle.
	origin := p[index]
	frame := getFrame(origin)

	// As we go along, we keep track of the current wedge of angles
	// and the distance to the last vertex (which must be
	// non-decreasing).
	currentWedge := s1.FullInterval()
	var lastDistance s1.Angle

	for index++; index < len(p); index++ {
		candidate := p[index]
		distance := origin.Distance(candidate)

		// We don't allow simplification to create edges longer than
		// 90 degrees, to avoid numeric instability as lengths
		// approach 180 degrees. We do need to allow for original
		// edges longer than 90 degrees, though.
		if distance > math.Pi/2 && lastDistance > 0 {
			break
		}

		// Vertices must be in increasing order along the ray, except
		// for the initial disc around the origin.
		if distance < lastDistance && lastDistance > tolerance {
			break
		}

		lastDistance = distance

		// Points that are within the tolerance distance of the origin
		// do not constrain the ray direction, so we can ignore them.
		if distance <= tolerance {
			continue
		}

		// If the current wedge of angles does not contain the angle
		// to this vertex, then stop right now. Note that the wedge
		// of possible ray angles is not necessarily empty yet, but we
		// can't continue unless we are willing to backtrack to the
		// last vertex that was contained within the wedge (since we
		// don't create new vertices). This would be more complicated
		// and also make the worst-case running time more than linear.
		direction := toFrame(frame, candidate)
		center := math.Atan2(direction.Y, direction.X)
		if !currentWedge.Contains(center) {
			break
		}

		// To determine how this vertex constrains the possible ray
		// angles, consider the triangle ABC where A is the origin, B
		// is the candidate vertex, and C is one of the two tangent
		// points between A and the spherical cap of radius
		// tolerance centered at B. Then from the spherical law of
		// sines, sin(a)/sin(A) = sin(c)/sin(C), where a and c are
		// the lengths of the edges opposite A and C. In our case C
		// is a 90 degree angle, therefore A = asin(sin(a) / sin(c)).
		// Angle A is the half-angle of the allowable wedge.
		halfAngle := math.Asin(math.Sin(tolerance.Radians()) / math.Sin(distance.Radians()))
		target := s1.IntervalFromPointPair(center, center).Expanded(halfAngle)
		currentWedge = currentWedge.Intersection(target)
	}

	// We break out of the loop when we reach a vertex index that
	// can't be included in the line segment, so back up by one
	// vertex.
	return index - 1
}

// SubsampleVertices returns a subsequence of vertex indices such that the
// polyline connecting these vertices is never further than the given tolerance from
// the original polyline. Provided the first and last vertices are distinct,
// they are always preserved; if they are not, the subsequence may contain
// only a single index.
//
// Some useful properties of the algorithm:
//
//  - It runs in linear time.
//
//  - The output always represents a valid polyline. In particular, adjacent
//    output vertices are never identical or antipodal.
//
//  - The method is not optimal, but it tends to produce 2-3% fewer
//    vertices than the Douglas-Peucker algorithm with the same tolerance.
//
//  - The output is parametrically equivalent to the original polyline to
//    within the given tolerance. For example, if a polyline backtracks on
//    itself and then proceeds onwards, the backtracking will be preserved
//    (to within the given tolerance). This is different than the
//    Douglas-Peucker algorithm which only guarantees geometric equivalence.
func (p *Polyline) SubsampleVertices(tolerance s1.Angle) []int {
	var result []int

	if len(*p) < 1 {
		return result
	}

	result = append(result, 0)
	clampedTolerance := s1.Angle(math.Max(tolerance.Radians(), 0))

	for index := 0; index+1 < len(*p); {
		nextIndex := findEndVertex(*p, clampedTolerance, index)
		// Don't create duplicate adjacent vertices.
		if (*p)[nextIndex] != (*p)[index] {
			result = append(result, nextIndex)
		}
		index = nextIndex
	}

	return result
}

// Encode encodes the Polyline.
func (p Polyline) Encode(w io.Writer) error {
	e := &encoder{w: w}
	p.encode(e)
	return e.err
}

func (p Polyline) encode(e *encoder) {
	e.writeInt8(encodingVersion)
	e.writeUint32(uint32(len(p)))
	for _, v := range p {
		e.writeFloat64(v.X)
		e.writeFloat64(v.Y)
		e.writeFloat64(v.Z)
	}
}

// Decode decodes the polyline.
func (p *Polyline) Decode(r io.Reader) error {
	d := decoder{r: asByteReader(r)}
	p.decode(d)
	return d.err
}

func (p *Polyline) decode(d decoder) {
	version := d.readInt8()
	if d.err != nil {
		return
	}
	if int(version) != int(encodingVersion) {
		d.err = fmt.Errorf("can't decode version %d; my version: %d", version, encodingVersion)
		return
	}
	nvertices := d.readUint32()
	if d.err != nil {
		return
	}
	if nvertices > maxEncodedVertices {
		d.err = fmt.Errorf("too many vertices (%d; max is %d)", nvertices, maxEncodedVertices)
		return
	}
	*p = make([]Point, nvertices)
	for i := range *p {
		(*p)[i].X = d.readFloat64()
		(*p)[i].Y = d.readFloat64()
		(*p)[i].Z = d.readFloat64()
	}
}

// Project returns a point on the polyline that is closest to the given point,
// and the index of the next vertex after the projected point. The
// value of that index is always in the range [1, len(polyline)].
// The polyline must not be empty.
func (p *Polyline) Project(point Point) (Point, int) {
	if len(*p) == 1 {
		// If there is only one vertex, it is always closest to any given point.
		return (*p)[0], 1
	}

	// Initial value larger than any possible distance on the unit sphere.
	minDist := 10 * s1.Radian
	minIndex := -1

	// Find the line segment in the polyline that is closest to the point given.
	for i := 1; i < len(*p); i++ {
		if dist := DistanceFromSegment(point, (*p)[i-1], (*p)[i]); dist < minDist {
			minDist = dist
			minIndex = i
		}
	}

	// Compute the point on the segment found that is closest to the point given.
	closest := Project(point, (*p)[minIndex-1], (*p)[minIndex])
	if closest == (*p)[minIndex] {
		minIndex++
	}

	return closest, minIndex
}

// IsOnRight reports whether the point given is on the right hand side of the
// polyline, using a naive definition of "right-hand-sideness" where the point
// is on the RHS of the polyline iff the point is on the RHS of the line segment
// in the polyline which it is closest to.
// The polyline must have at least 2 vertices.
func (p *Polyline) IsOnRight(point Point) bool {
	// If the closest point C is an interior vertex of the polyline, let B and D
	// be the previous and next vertices. The given point P is on the right of
	// the polyline (locally) if B, P, D are ordered CCW around vertex C.
	closest, next := p.Project(point)
	if closest == (*p)[next-1] && next > 1 && next < len(*p) {
		if point == (*p)[next-1] {
			// Polyline vertices are not on the RHS.
			return false
		}
		return OrderedCCW((*p)[next-2], point, (*p)[next], (*p)[next-1])
	}
	// Otherwise, the closest point C is incident to exactly one polyline edge.
	// We test the point P against that edge.
	if next == len(*p) {
		next--
	}
	return Sign(point, (*p)[next], (*p)[next-1])
}

// Validate checks whether this is a valid polyline or not.
func (p *Polyline) Validate() error {
	// All vertices must be unit length.
	for i, pt := range *p {
		if !pt.IsUnit() {
			return fmt.Errorf("vertex %d is not unit length", i)
		}
	}

	// Adjacent vertices must not be identical or antipodal.
	for i := 1; i < len(*p); i++ {
		prev, cur := (*p)[i-1], (*p)[i]
		if prev == cur {
			return fmt.Errorf("vertices %d and %d are identical", i-1, i)
		}
		if prev == (Point{cur.Mul(-1)}) {
			return fmt.Errorf("vertices %d and %d are antipodal", i-1, i)
		}
	}

	return nil
}

// Intersects reports whether this polyline intersects the given polyline. If
// the polylines share a vertex they are considered to be intersecting. When a
// polyline endpoint is the only intersection with the other polyline, the
// function may return true or false arbitrarily.
//
// The running time is quadratic in the number of vertices.
func (p *Polyline) Intersects(o *Polyline) bool {
	if len(*p) == 0 || len(*o) == 0 {
		return false
	}

	if !p.RectBound().Intersects(o.RectBound()) {
		return false
	}

	// TODO(roberts): Use ShapeIndex here.
	for i := 1; i < len(*p); i++ {
		crosser := NewChainEdgeCrosser((*p)[i-1], (*p)[i], (*o)[0])
		for j := 1; j < len(*o); j++ {
			if crosser.ChainCrossingSign((*o)[j]) != DoNotCross {
				return true
			}
		}
	}
	return false
}

// Interpolate returns the point whose distance from vertex 0 along the polyline is
// the given fraction of the polyline's total length, and the index of
// the next vertex after the interpolated point P. Fractions less than zero
// or greater than one are clamped. The return value is unit length. The cost of
// this function is currently linear in the number of vertices.
//
// This method allows the caller to easily construct a given suffix of the
// polyline by concatenating P with the polyline vertices starting at that next
// vertex. Note that P is guaranteed to be different than the point at the next
// vertex, so this will never result in a duplicate vertex.
//
// The polyline must not be empty. Note that if fraction >= 1.0, then the next
// vertex will be set to len(p) (indicating that no vertices from the polyline
// need to be appended). The value of the next vertex is always between 1 and
// len(p).
//
// This method can also be used to construct a prefix of the polyline, by
// taking the polyline vertices up to next vertex-1 and appending the
// returned point P if it is different from the last vertex (since in this
// case there is no guarantee of distinctness).
func (p *Polyline) Interpolate(fraction float64) (Point, int) {
	// We intentionally let the (fraction >= 1) case fall through, since
	// we need to handle it in the loop below in any case because of
	// possible roundoff errors.
	if fraction <= 0 {
		return (*p)[0], 1
	}
	target := s1.Angle(fraction) * p.Length()

	for i := 1; i < len(*p); i++ {
		length := (*p)[i-1].Distance((*p)[i])
		if target < length {
			// This interpolates with respect to arc length rather than
			// straight-line distance, and produces a unit-length result.
			result := InterpolateAtDistance(target, (*p)[i-1], (*p)[i])

			// It is possible that (result == vertex(i)) due to rounding errors.
			if result == (*p)[i] {
				return result, i + 1
			}
			return result, i
		}
		target -= length
	}

	return (*p)[len(*p)-1], len(*p)
}

// Uninterpolate is the inverse operation of Interpolate. Given a point on the
// polyline, it returns the ratio of the distance to the point from the
// beginning of the polyline over the length of the polyline. The return
// value is always betwen 0 and 1 inclusive.
//
// The polyline should not be empty.  If it has fewer than 2 vertices, the
// return value is zero.
func (p *Polyline) Uninterpolate(point Point, nextVertex int) float64 {
	if len(*p) < 2 {
		return 0
	}

	var sum s1.Angle
	for i := 1; i < nextVertex; i++ {
		sum += (*p)[i-1].Distance((*p)[i])
	}
	lengthToPoint := sum + (*p)[nextVertex-1].Distance(point)
	for i := nextVertex; i < len(*p); i++ {
		sum += (*p)[i-1].Distance((*p)[i])
	}
	// The ratio can be greater than 1.0 due to rounding errors or because the
	// point is not exactly on the polyline.
	return minFloat64(1.0, float64(lengthToPoint/sum))
}

// TODO(roberts): Differences from C++.
// NearlyCoversPolyline
// InitToSnapped
// InitToSimplified
// SnapLevel
// encode/decode compressed
