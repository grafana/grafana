// Copyright 2014 Google Inc. All rights reserved.
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

	"github.com/blevesearch/geo/r1"
	"github.com/blevesearch/geo/r3"
	"github.com/blevesearch/geo/s1"
)

// Rect represents a closed latitude-longitude rectangle.
type Rect struct {
	Lat r1.Interval
	Lng s1.Interval
}

var (
	// TODO(rsned): Make these public to match FullLat/FullLng from C++
	validRectLatRange = r1.Interval{Lo: -math.Pi / 2, Hi: math.Pi / 2}
	validRectLngRange = s1.FullInterval()
)

// EmptyRect returns the empty rectangle.
func EmptyRect() Rect { return Rect{r1.EmptyInterval(), s1.EmptyInterval()} }

// FullRect returns the full rectangle.
func FullRect() Rect { return Rect{validRectLatRange, validRectLngRange} }

// RectFromLatLng constructs a rectangle containing a single point p.
func RectFromLatLng(p LatLng) Rect {
	return Rect{
		Lat: r1.Interval{Lo: p.Lat.Radians(), Hi: p.Lat.Radians()},
		Lng: s1.Interval{Lo: p.Lng.Radians(), Hi: p.Lng.Radians()},
	}
}

// RectFromCenterSize constructs a rectangle with the given size and center.
// center needs to be normalized, but size does not. The latitude
// interval of the result is clamped to [-90,90] degrees, and the longitude
// interval of the result is FullRect() if and only if the longitude size is
// 360 degrees or more.
//
// Examples of clamping (in degrees):
//
//	center=(80,170),  size=(40,60)   -> lat=[60,90],   lng=[140,-160]
//	center=(10,40),   size=(210,400) -> lat=[-90,90],  lng=[-180,180]
//	center=(-90,180), size=(20,50)   -> lat=[-90,-80], lng=[155,-155]
func RectFromCenterSize(center, size LatLng) Rect {
	half := LatLng{size.Lat / 2, size.Lng / 2}
	return RectFromLatLng(center).expanded(half)
}

// IsValid returns true iff the rectangle is valid.
// This requires Lat ⊆ [-π/2,π/2] and Lng ⊆ [-π,π], and Lat = ∅ iff Lng = ∅
func (r Rect) IsValid() bool {
	return math.Abs(r.Lat.Lo) <= math.Pi/2 &&
		math.Abs(r.Lat.Hi) <= math.Pi/2 &&
		r.Lng.IsValid() &&
		r.Lat.IsEmpty() == r.Lng.IsEmpty()
}

// IsEmpty reports whether the rectangle is empty.
func (r Rect) IsEmpty() bool { return r.Lat.IsEmpty() }

// IsFull reports whether the rectangle is full.
func (r Rect) IsFull() bool { return r.Lat.Equal(validRectLatRange) && r.Lng.IsFull() }

// IsPoint reports whether the rectangle is a single point.
func (r Rect) IsPoint() bool { return r.Lat.Lo == r.Lat.Hi && r.Lng.Lo == r.Lng.Hi }

// Vertex returns the i-th vertex of the rectangle (i = 0,1,2,3) in CCW order
// (lower left, lower right, upper right, upper left).
func (r Rect) Vertex(i int) LatLng {
	var lat, lng float64

	switch i {
	case 0:
		lat = r.Lat.Lo
		lng = r.Lng.Lo
	case 1:
		lat = r.Lat.Lo
		lng = r.Lng.Hi
	case 2:
		lat = r.Lat.Hi
		lng = r.Lng.Hi
	case 3:
		lat = r.Lat.Hi
		lng = r.Lng.Lo
	}
	return LatLng{s1.Angle(lat) * s1.Radian, s1.Angle(lng) * s1.Radian}
}

// Lo returns one corner of the rectangle.
func (r Rect) Lo() LatLng {
	return LatLng{s1.Angle(r.Lat.Lo) * s1.Radian, s1.Angle(r.Lng.Lo) * s1.Radian}
}

// Hi returns the other corner of the rectangle.
func (r Rect) Hi() LatLng {
	return LatLng{s1.Angle(r.Lat.Hi) * s1.Radian, s1.Angle(r.Lng.Hi) * s1.Radian}
}

// Center returns the center of the rectangle.
func (r Rect) Center() LatLng {
	return LatLng{s1.Angle(r.Lat.Center()) * s1.Radian, s1.Angle(r.Lng.Center()) * s1.Radian}
}

// Size returns the size of the Rect.
func (r Rect) Size() LatLng {
	return LatLng{s1.Angle(r.Lat.Length()) * s1.Radian, s1.Angle(r.Lng.Length()) * s1.Radian}
}

// Area returns the surface area of the Rect.
func (r Rect) Area() float64 {
	if r.IsEmpty() {
		return 0
	}
	capDiff := math.Abs(math.Sin(r.Lat.Hi) - math.Sin(r.Lat.Lo))
	return r.Lng.Length() * capDiff
}

// AddPoint increases the size of the rectangle to include the given point.
func (r Rect) AddPoint(ll LatLng) Rect {
	if !ll.IsValid() {
		return r
	}
	return Rect{
		Lat: r.Lat.AddPoint(ll.Lat.Radians()),
		Lng: r.Lng.AddPoint(ll.Lng.Radians()),
	}
}

// expanded returns a rectangle that has been expanded by margin.Lat on each side
// in the latitude direction, and by margin.Lng on each side in the longitude
// direction. If either margin is negative, then it shrinks the rectangle on
// the corresponding sides instead. The resulting rectangle may be empty.
//
// The latitude-longitude space has the topology of a cylinder. Longitudes
// "wrap around" at +/-180 degrees, while latitudes are clamped to range [-90, 90].
// This means that any expansion (positive or negative) of the full longitude range
// remains full (since the "rectangle" is actually a continuous band around the
// cylinder), while expansion of the full latitude range remains full only if the
// margin is positive.
//
// If either the latitude or longitude interval becomes empty after
// expansion by a negative margin, the result is empty.
//
// Note that if an expanded rectangle contains a pole, it may not contain
// all possible lat/lng representations of that pole, e.g., both points [π/2,0]
// and [π/2,1] represent the same pole, but they might not be contained by the
// same Rect.
//
// If you are trying to grow a rectangle by a certain distance on the
// sphere (e.g. 5km), refer to the ExpandedByDistance() C++ method implementation
// instead.
func (r Rect) expanded(margin LatLng) Rect {
	lat := r.Lat.Expanded(margin.Lat.Radians())
	lng := r.Lng.Expanded(margin.Lng.Radians())

	if lat.IsEmpty() || lng.IsEmpty() {
		return EmptyRect()
	}

	return Rect{
		Lat: lat.Intersection(validRectLatRange),
		Lng: lng,
	}
}

func (r Rect) String() string { return fmt.Sprintf("[Lo%v, Hi%v]", r.Lo(), r.Hi()) }

// PolarClosure returns the rectangle unmodified if it does not include either pole.
// If it includes either pole, PolarClosure returns an expansion of the rectangle along
// the longitudinal range to include all possible representations of the contained poles.
func (r Rect) PolarClosure() Rect {
	if r.Lat.Lo == -math.Pi/2 || r.Lat.Hi == math.Pi/2 {
		return Rect{r.Lat, s1.FullInterval()}
	}
	return r
}

// Union returns the smallest Rect containing the union of this rectangle and the given rectangle.
func (r Rect) Union(other Rect) Rect {
	return Rect{
		Lat: r.Lat.Union(other.Lat),
		Lng: r.Lng.Union(other.Lng),
	}
}

// Intersection returns the smallest rectangle containing the intersection of
// this rectangle and the given rectangle. Note that the region of intersection
// may consist of two disjoint rectangles, in which case a single rectangle
// spanning both of them is returned.
func (r Rect) Intersection(other Rect) Rect {
	lat := r.Lat.Intersection(other.Lat)
	lng := r.Lng.Intersection(other.Lng)

	if lat.IsEmpty() || lng.IsEmpty() {
		return EmptyRect()
	}
	return Rect{lat, lng}
}

// Intersects reports whether this rectangle and the other have any points in common.
func (r Rect) Intersects(other Rect) bool {
	return r.Lat.Intersects(other.Lat) && r.Lng.Intersects(other.Lng)
}

// CapBound returns a cap that contains Rect.
func (r Rect) CapBound() Cap {
	// We consider two possible bounding caps, one whose axis passes
	// through the center of the lat-long rectangle and one whose axis
	// is the north or south pole.  We return the smaller of the two caps.

	if r.IsEmpty() {
		return EmptyCap()
	}

	var poleZ, poleAngle float64
	if r.Lat.Hi+r.Lat.Lo < 0 {
		// South pole axis yields smaller cap.
		poleZ = -1
		poleAngle = math.Pi/2 + r.Lat.Hi
	} else {
		poleZ = 1
		poleAngle = math.Pi/2 - r.Lat.Lo
	}
	poleCap := CapFromCenterAngle(Point{r3.Vector{X: 0, Y: 0, Z: poleZ}}, s1.Angle(poleAngle)*s1.Radian)

	// For bounding rectangles that span 180 degrees or less in longitude, the
	// maximum cap size is achieved at one of the rectangle vertices.  For
	// rectangles that are larger than 180 degrees, we punt and always return a
	// bounding cap centered at one of the two poles.
	if math.Remainder(r.Lng.Hi-r.Lng.Lo, 2*math.Pi) >= 0 && r.Lng.Hi-r.Lng.Lo < 2*math.Pi {
		midCap := CapFromPoint(PointFromLatLng(r.Center())).AddPoint(PointFromLatLng(r.Lo())).AddPoint(PointFromLatLng(r.Hi()))
		if midCap.Height() < poleCap.Height() {
			return midCap
		}
	}
	return poleCap
}

// RectBound returns itself.
func (r Rect) RectBound() Rect {
	return r
}

// Contains reports whether this Rect contains the other Rect.
func (r Rect) Contains(other Rect) bool {
	return r.Lat.ContainsInterval(other.Lat) && r.Lng.ContainsInterval(other.Lng)
}

// ContainsCell reports whether the given Cell is contained by this Rect.
func (r Rect) ContainsCell(c Cell) bool {
	// A latitude-longitude rectangle contains a cell if and only if it contains
	// the cell's bounding rectangle. This test is exact from a mathematical
	// point of view, assuming that the bounds returned by Cell.RectBound()
	// are tight. However, note that there can be a loss of precision when
	// converting between representations -- for example, if an s2.Cell is
	// converted to a polygon, the polygon's bounding rectangle may not contain
	// the cell's bounding rectangle. This has some slightly unexpected side
	// effects; for instance, if one creates an s2.Polygon from an s2.Cell, the
	// polygon will contain the cell, but the polygon's bounding box will not.
	return r.Contains(c.RectBound())
}

// ContainsLatLng reports whether the given LatLng is within the Rect.
func (r Rect) ContainsLatLng(ll LatLng) bool {
	if !ll.IsValid() {
		return false
	}
	return r.Lat.Contains(ll.Lat.Radians()) && r.Lng.Contains(ll.Lng.Radians())
}

// ContainsPoint reports whether the given Point is within the Rect.
func (r Rect) ContainsPoint(p Point) bool {
	return r.ContainsLatLng(LatLngFromPoint(p))
}

// CellUnionBound computes a covering of the Rect.
func (r Rect) CellUnionBound() []CellID {
	return r.CapBound().CellUnionBound()
}

// intersectsLatEdge reports whether the edge AB intersects the given edge of constant
// latitude. Requires the points to have unit length.
func intersectsLatEdge(a, b Point, lat s1.Angle, lng s1.Interval) bool {
	// Unfortunately, lines of constant latitude are curves on
	// the sphere. They can intersect a straight edge in 0, 1, or 2 points.

	// First, compute the normal to the plane AB that points vaguely north.
	z := Point{a.PointCross(b).Normalize()}
	if z.Z < 0 {
		z = Point{z.Mul(-1)}
	}

	// Extend this to an orthonormal frame (x,y,z) where x is the direction
	// where the great circle through AB achieves its maximum latitude.
	y := Point{z.PointCross(PointFromCoords(0, 0, 1)).Normalize()}
	x := y.Cross(z.Vector)

	// Compute the angle "theta" from the x-axis (in the x-y plane defined
	// above) where the great circle intersects the given line of latitude.
	sinLat := math.Sin(float64(lat))
	if math.Abs(sinLat) >= x.Z {
		// The great circle does not reach the given latitude.
		return false
	}

	cosTheta := sinLat / x.Z
	sinTheta := math.Sqrt(1 - cosTheta*cosTheta)
	theta := math.Atan2(sinTheta, cosTheta)

	// The candidate intersection points are located +/- theta in the x-y
	// plane. For an intersection to be valid, we need to check that the
	// intersection point is contained in the interior of the edge AB and
	// also that it is contained within the given longitude interval "lng".

	// Compute the range of theta values spanned by the edge AB.
	abTheta := s1.IntervalFromPointPair(
		math.Atan2(a.Dot(y.Vector), a.Dot(x)),
		math.Atan2(b.Dot(y.Vector), b.Dot(x)))

	if abTheta.Contains(theta) {
		// Check if the intersection point is also in the given lng interval.
		isect := x.Mul(cosTheta).Add(y.Mul(sinTheta))
		if lng.Contains(math.Atan2(isect.Y, isect.X)) {
			return true
		}
	}

	if abTheta.Contains(-theta) {
		// Check if the other intersection point is also in the given lng interval.
		isect := x.Mul(cosTheta).Sub(y.Mul(sinTheta))
		if lng.Contains(math.Atan2(isect.Y, isect.X)) {
			return true
		}
	}
	return false
}

// intersectsLngEdge reports whether the edge AB intersects the given edge of constant
// longitude. Requires the points to have unit length.
func intersectsLngEdge(a, b Point, lat r1.Interval, lng s1.Angle) bool {
	// The nice thing about edges of constant longitude is that
	// they are straight lines on the sphere (geodesics).
	return CrossingSign(a, b, PointFromLatLng(LatLng{s1.Angle(lat.Lo), lng}),
		PointFromLatLng(LatLng{s1.Angle(lat.Hi), lng})) == Cross
}

// IntersectsCell reports whether this rectangle intersects the given cell. This is an
// exact test and may be fairly expensive.
func (r Rect) IntersectsCell(c Cell) bool {
	// First we eliminate the cases where one region completely contains the
	// other. Once these are disposed of, then the regions will intersect
	// if and only if their boundaries intersect.
	if r.IsEmpty() {
		return false
	}
	if r.ContainsPoint(Point{c.id.rawPoint()}) {
		return true
	}
	if c.ContainsPoint(PointFromLatLng(r.Center())) {
		return true
	}

	// Quick rejection test (not required for correctness).
	if !r.Intersects(c.RectBound()) {
		return false
	}

	// Precompute the cell vertices as points and latitude-longitudes. We also
	// check whether the Cell contains any corner of the rectangle, or
	// vice-versa, since the edge-crossing tests only check the edge interiors.
	vertices := [4]Point{}
	latlngs := [4]LatLng{}

	for i := range vertices {
		vertices[i] = c.Vertex(i)
		latlngs[i] = LatLngFromPoint(vertices[i])
		if r.ContainsLatLng(latlngs[i]) {
			return true
		}
		if c.ContainsPoint(PointFromLatLng(r.Vertex(i))) {
			return true
		}
	}

	// Now check whether the boundaries intersect. Unfortunately, a
	// latitude-longitude rectangle does not have straight edges: two edges
	// are curved, and at least one of them is concave.
	for i := range vertices {
		edgeLng := s1.IntervalFromEndpoints(latlngs[i].Lng.Radians(), latlngs[(i+1)&3].Lng.Radians())
		if !r.Lng.Intersects(edgeLng) {
			continue
		}

		a := vertices[i]
		b := vertices[(i+1)&3]
		if edgeLng.Contains(r.Lng.Lo) && intersectsLngEdge(a, b, r.Lat, s1.Angle(r.Lng.Lo)) {
			return true
		}
		if edgeLng.Contains(r.Lng.Hi) && intersectsLngEdge(a, b, r.Lat, s1.Angle(r.Lng.Hi)) {
			return true
		}
		if intersectsLatEdge(a, b, s1.Angle(r.Lat.Lo), r.Lng) {
			return true
		}
		if intersectsLatEdge(a, b, s1.Angle(r.Lat.Hi), r.Lng) {
			return true
		}
	}
	return false
}

// Encode encodes the Rect.
func (r Rect) Encode(w io.Writer) error {
	e := &encoder{w: w}
	r.encode(e)
	return e.err
}

func (r Rect) encode(e *encoder) {
	e.writeInt8(encodingVersion)
	e.writeFloat64(r.Lat.Lo)
	e.writeFloat64(r.Lat.Hi)
	e.writeFloat64(r.Lng.Lo)
	e.writeFloat64(r.Lng.Hi)
}

// Decode decodes a rectangle.
func (r *Rect) Decode(rd io.Reader) error {
	d := &decoder{r: asByteReader(rd)}
	r.decode(d)
	return d.err
}

func (r *Rect) decode(d *decoder) {
	if version := d.readUint8(); int8(version) != encodingVersion && d.err == nil {
		d.err = fmt.Errorf("can't decode version %d; my version: %d", version, encodingVersion)
		return
	}
	r.Lat.Lo = d.readFloat64()
	r.Lat.Hi = d.readFloat64()
	r.Lng.Lo = d.readFloat64()
	r.Lng.Hi = d.readFloat64()
}

// DistanceToLatLng returns the minimum distance (measured along the surface of the sphere)
// from a given point to the rectangle (both its boundary and its interior).
// If r is empty, the result is meaningless.
// The latlng must be valid.
func (r Rect) DistanceToLatLng(ll LatLng) s1.Angle {
	if r.Lng.Contains(float64(ll.Lng)) {
		return maxAngle(0, ll.Lat-s1.Angle(r.Lat.Hi), s1.Angle(r.Lat.Lo)-ll.Lat)
	}

	i := s1.IntervalFromEndpoints(r.Lng.Hi, r.Lng.ComplementCenter())
	rectLng := r.Lng.Lo
	if i.Contains(float64(ll.Lng)) {
		rectLng = r.Lng.Hi
	}

	lo := LatLng{s1.Angle(r.Lat.Lo) * s1.Radian, s1.Angle(rectLng) * s1.Radian}
	hi := LatLng{s1.Angle(r.Lat.Hi) * s1.Radian, s1.Angle(rectLng) * s1.Radian}
	return DistanceFromSegment(PointFromLatLng(ll), PointFromLatLng(lo), PointFromLatLng(hi))
}

// DirectedHausdorffDistance returns the directed Hausdorff distance (measured along the
// surface of the sphere) to the given Rect. The directed Hausdorff
// distance from rectangle A to rectangle B is given by
//
//	h(A, B) = max_{p in A} min_{q in B} d(p, q).
func (r Rect) DirectedHausdorffDistance(other Rect) s1.Angle {
	if r.IsEmpty() {
		return 0 * s1.Radian
	}
	if other.IsEmpty() {
		return math.Pi * s1.Radian
	}

	lng := r.Lng.DirectedHausdorffDistance(other.Lng)
	return directedHausdorffDistance(lng, r.Lat, other.Lat)
}

// HausdorffDistance returns the undirected Hausdorff distance (measured along the
// surface of the sphere) to the given Rect.
// The Hausdorff distance between rectangle A and rectangle B is given by
//
//	H(A, B) = max{h(A, B), h(B, A)}.
func (r Rect) HausdorffDistance(other Rect) s1.Angle {
	return maxAngle(r.DirectedHausdorffDistance(other),
		other.DirectedHausdorffDistance(r))
}

// ApproxEqual reports whether the latitude and longitude intervals of the two rectangles
// are the same up to a small tolerance.
func (r Rect) ApproxEqual(other Rect) bool {
	return r.Lat.ApproxEqual(other.Lat) && r.Lng.ApproxEqual(other.Lng)
}

// directedHausdorffDistance returns the directed Hausdorff distance
// from one longitudinal edge spanning latitude range 'a' to the other
// longitudinal edge spanning latitude range 'b', with their longitudinal
// difference given by 'lngDiff'.
func directedHausdorffDistance(lngDiff s1.Angle, a, b r1.Interval) s1.Angle {
	// By symmetry, we can assume a's longitude is 0 and b's longitude is
	// lngDiff. Call b's two endpoints bLo and bHi. Let H be the hemisphere
	// containing a and delimited by the longitude line of b. The Voronoi diagram
	// of b on H has three edges (portions of great circles) all orthogonal to b
	// and meeting at bLo cross bHi.
	// E1: (bLo, bLo cross bHi)
	// E2: (bHi, bLo cross bHi)
	// E3: (-bMid, bLo cross bHi), where bMid is the midpoint of b
	//
	// They subdivide H into three Voronoi regions. Depending on how longitude 0
	// (which contains edge a) intersects these regions, we distinguish two cases:
	// Case 1: it intersects three regions. This occurs when lngDiff <= π/2.
	// Case 2: it intersects only two regions. This occurs when lngDiff > π/2.
	//
	// In the first case, the directed Hausdorff distance to edge b can only be
	// realized by the following points on a:
	// A1: two endpoints of a.
	// A2: intersection of a with the equator, if b also intersects the equator.
	//
	// In the second case, the directed Hausdorff distance to edge b can only be
	// realized by the following points on a:
	// B1: two endpoints of a.
	// B2: intersection of a with E3
	// B3: farthest point from bLo to the interior of D, and farthest point from
	//     bHi to the interior of U, if any, where D (resp. U) is the portion
	//     of edge a below (resp. above) the intersection point from B2.

	if lngDiff < 0 {
		panic("impossible: negative lngDiff")
	}
	if lngDiff > math.Pi {
		panic("impossible: lngDiff > Pi")
	}

	if lngDiff == 0 {
		return s1.Angle(a.DirectedHausdorffDistance(b))
	}

	// Assumed longitude of b.
	bLng := lngDiff
	// Two endpoints of b.
	bLo := PointFromLatLng(LatLng{s1.Angle(b.Lo), bLng})
	bHi := PointFromLatLng(LatLng{s1.Angle(b.Hi), bLng})

	// Cases A1 and B1.
	aLo := PointFromLatLng(LatLng{s1.Angle(a.Lo), 0})
	aHi := PointFromLatLng(LatLng{s1.Angle(a.Hi), 0})
	maxDistance := maxAngle(
		DistanceFromSegment(aLo, bLo, bHi),
		DistanceFromSegment(aHi, bLo, bHi))

	if lngDiff <= math.Pi/2 {
		// Case A2.
		if a.Contains(0) && b.Contains(0) {
			maxDistance = maxAngle(maxDistance, lngDiff)
		}
		return maxDistance
	}

	// Case B2.
	p := bisectorIntersection(b, bLng)
	pLat := LatLngFromPoint(p).Lat
	if a.Contains(float64(pLat)) {
		maxDistance = maxAngle(maxDistance, p.Angle(bLo.Vector))
	}

	// Case B3.
	if pLat > s1.Angle(a.Lo) {
		intDist, ok := interiorMaxDistance(r1.Interval{Lo: a.Lo, Hi: math.Min(float64(pLat), a.Hi)}, bLo)
		if ok {
			maxDistance = maxAngle(maxDistance, intDist)
		}
	}
	if pLat < s1.Angle(a.Hi) {
		intDist, ok := interiorMaxDistance(r1.Interval{Lo: math.Max(float64(pLat), a.Lo), Hi: a.Hi}, bHi)
		if ok {
			maxDistance = maxAngle(maxDistance, intDist)
		}
	}

	return maxDistance
}

// interiorMaxDistance returns the max distance from a point b to the segment spanning latitude range
// aLat on longitude 0 if the max occurs in the interior of aLat. Otherwise, returns (0, false).
func interiorMaxDistance(aLat r1.Interval, b Point) (a s1.Angle, ok bool) {
	// Longitude 0 is in the y=0 plane. b.X >= 0 implies that the maximum
	// does not occur in the interior of aLat.
	if aLat.IsEmpty() || b.X >= 0 {
		return 0, false
	}

	// Project b to the y=0 plane. The antipodal of the normalized projection is
	// the point at which the maximum distance from b occurs, if it is contained
	// in aLat.
	intersectionPoint := PointFromCoords(-b.X, 0, -b.Z)
	if !aLat.InteriorContains(float64(LatLngFromPoint(intersectionPoint).Lat)) {
		return 0, false
	}
	return b.Angle(intersectionPoint.Vector), true
}

// bisectorIntersection return the intersection of longitude 0 with the bisector of an edge
// on longitude 'lng' and spanning latitude range 'lat'.
func bisectorIntersection(lat r1.Interval, lng s1.Angle) Point {
	lng = s1.Angle(math.Abs(float64(lng)))
	latCenter := s1.Angle(lat.Center())

	// A vector orthogonal to the bisector of the given longitudinal edge.
	orthoBisector := LatLng{latCenter - math.Pi/2, lng}
	if latCenter < 0 {
		orthoBisector = LatLng{-latCenter - math.Pi/2, lng - math.Pi}
	}

	// A vector orthogonal to longitude 0.
	orthoLng := Point{r3.Vector{X: 0, Y: -1, Z: 0}}

	return orthoLng.PointCross(PointFromLatLng(orthoBisector))
}

// Centroid returns the true centroid of the given Rect multiplied by its
// surface area. The result is not unit length, so you may want to normalize it.
// Note that in general the centroid is *not* at the center of the rectangle, and
// in fact it may not even be contained by the rectangle. (It is the "center of
// mass" of the rectangle viewed as subset of the unit sphere, i.e. it is the
// point in space about which this curved shape would rotate.)
//
// The reason for multiplying the result by the rectangle area is to make it
// easier to compute the centroid of more complicated shapes. The centroid
// of a union of disjoint regions can be computed simply by adding their
// Centroid results.
func (r Rect) Centroid() Point {
	// When a sphere is divided into slices of constant thickness by a set
	// of parallel planes, all slices have the same surface area. This
	// implies that the z-component of the centroid is simply the midpoint
	// of the z-interval spanned by the Rect.
	//
	// Similarly, it is easy to see that the (x,y) of the centroid lies in
	// the plane through the midpoint of the rectangle's longitude interval.
	// We only need to determine the distance "d" of this point from the
	// z-axis.
	//
	// Let's restrict our attention to a particular z-value. In this
	// z-plane, the Rect is a circular arc. The centroid of this arc
	// lies on a radial line through the midpoint of the arc, and at a
	// distance from the z-axis of
	//
	//     r * (sin(alpha) / alpha)
	//
	// where r = sqrt(1-z^2) is the radius of the arc, and "alpha" is half
	// of the arc length (i.e., the arc covers longitudes [-alpha, alpha]).
	//
	// To find the centroid distance from the z-axis for the entire
	// rectangle, we just need to integrate over the z-interval. This gives
	//
	//    d = Integrate[sqrt(1-z^2)*sin(alpha)/alpha, z1..z2] / (z2 - z1)
	//
	// where [z1, z2] is the range of z-values covered by the rectangle.
	// This simplifies to
	//
	//    d = sin(alpha)/(2*alpha*(z2-z1))*(z2*r2 - z1*r1 + theta2 - theta1)
	//
	// where [theta1, theta2] is the latitude interval, z1=sin(theta1),
	// z2=sin(theta2), r1=cos(theta1), and r2=cos(theta2).
	//
	// Finally, we want to return not the centroid itself, but the centroid
	// scaled by the area of the rectangle. The area of the rectangle is
	//
	//    A = 2 * alpha * (z2 - z1)
	//
	// which fortunately appears in the denominator of "d".

	if r.IsEmpty() {
		return Point{}
	}

	z1 := math.Sin(r.Lat.Lo)
	z2 := math.Sin(r.Lat.Hi)
	r1 := math.Cos(r.Lat.Lo)
	r2 := math.Cos(r.Lat.Hi)

	alpha := 0.5 * r.Lng.Length()
	r0 := math.Sin(alpha) * (r2*z2 - r1*z1 + r.Lat.Length())
	lng := r.Lng.Center()
	z := alpha * (z2 + z1) * (z2 - z1) // scaled by the area

	return Point{r3.Vector{X: r0 * math.Cos(lng), Y: r0 * math.Sin(lng), Z: z}}
}

// BUG: The major differences from the C++ version are:
//  - Get*Distance, Vertex, InteriorContains(LatLng|Rect|Point)

func RectFromDegrees(latLo, lngLo, latHi, lngHi float64) Rect {
	// Convenience method to construct a rectangle. This method is
	// intentionally *not* in the S2LatLngRect interface because the
	// argument order is ambiguous, but is fine for the test.
	return Rect{
		Lat: r1.Interval{
			Lo: (s1.Angle(latLo) * s1.Degree).Radians(),
			Hi: (s1.Angle(latHi) * s1.Degree).Radians(),
		},
		Lng: s1.IntervalFromEndpoints(
			(s1.Angle(lngLo) * s1.Degree).Radians(),
			(s1.Angle(lngHi) * s1.Degree).Radians(),
		),
	}
}
