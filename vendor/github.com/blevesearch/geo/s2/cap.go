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

	"github.com/golang/geo/r1"
	"github.com/golang/geo/s1"
)

var (
	// centerPoint is the default center for Caps
	centerPoint = PointFromCoords(1.0, 0, 0)
)

// Cap represents a disc-shaped region defined by a center and radius.
// Technically this shape is called a "spherical cap" (rather than disc)
// because it is not planar; the cap represents a portion of the sphere that
// has been cut off by a plane. The boundary of the cap is the circle defined
// by the intersection of the sphere and the plane. For containment purposes,
// the cap is a closed set, i.e. it contains its boundary.
//
// For the most part, you can use a spherical cap wherever you would use a
// disc in planar geometry. The radius of the cap is measured along the
// surface of the sphere (rather than the straight-line distance through the
// interior). Thus a cap of radius π/2 is a hemisphere, and a cap of radius
// π covers the entire sphere.
//
// The center is a point on the surface of the unit sphere. (Hence the need for
// it to be of unit length.)
//
// A cap can also be defined by its center point and height. The height is the
// distance from the center point to the cutoff plane. There is also support for
// "empty" and "full" caps, which contain no points and all points respectively.
//
// Here are some useful relationships between the cap height (h), the cap
// radius (r), the maximum chord length from the cap's center (d), and the
// radius of cap's base (a).
//
//     h = 1 - cos(r)
//       = 2 * sin^2(r/2)
//   d^2 = 2 * h
//       = a^2 + h^2
//
// The zero value of Cap is an invalid cap. Use EmptyCap to get a valid empty cap.
type Cap struct {
	center Point
	radius s1.ChordAngle
}

// CapFromPoint constructs a cap containing a single point.
func CapFromPoint(p Point) Cap {
	return CapFromCenterChordAngle(p, 0)
}

// CapFromCenterAngle constructs a cap with the given center and angle.
func CapFromCenterAngle(center Point, angle s1.Angle) Cap {
	return CapFromCenterChordAngle(center, s1.ChordAngleFromAngle(angle))
}

// CapFromCenterChordAngle constructs a cap where the angle is expressed as an
// s1.ChordAngle. This constructor is more efficient than using an s1.Angle.
func CapFromCenterChordAngle(center Point, radius s1.ChordAngle) Cap {
	return Cap{
		center: center,
		radius: radius,
	}
}

// CapFromCenterHeight constructs a cap with the given center and height. A
// negative height yields an empty cap; a height of 2 or more yields a full cap.
// The center should be unit length.
func CapFromCenterHeight(center Point, height float64) Cap {
	return CapFromCenterChordAngle(center, s1.ChordAngleFromSquaredLength(2*height))
}

// CapFromCenterArea constructs a cap with the given center and surface area.
// Note that the area can also be interpreted as the solid angle subtended by the
// cap (because the sphere has unit radius). A negative area yields an empty cap;
// an area of 4*π or more yields a full cap.
func CapFromCenterArea(center Point, area float64) Cap {
	return CapFromCenterChordAngle(center, s1.ChordAngleFromSquaredLength(area/math.Pi))
}

// EmptyCap returns a cap that contains no points.
func EmptyCap() Cap {
	return CapFromCenterChordAngle(centerPoint, s1.NegativeChordAngle)
}

// FullCap returns a cap that contains all points.
func FullCap() Cap {
	return CapFromCenterChordAngle(centerPoint, s1.StraightChordAngle)
}

// IsValid reports whether the Cap is considered valid.
func (c Cap) IsValid() bool {
	return c.center.Vector.IsUnit() && c.radius <= s1.StraightChordAngle
}

// IsEmpty reports whether the cap is empty, i.e. it contains no points.
func (c Cap) IsEmpty() bool {
	return c.radius < 0
}

// IsFull reports whether the cap is full, i.e. it contains all points.
func (c Cap) IsFull() bool {
	return c.radius == s1.StraightChordAngle
}

// Center returns the cap's center point.
func (c Cap) Center() Point {
	return c.center
}

// Height returns the height of the cap. This is the distance from the center
// point to the cutoff plane.
func (c Cap) Height() float64 {
	return float64(0.5 * c.radius)
}

// Radius returns the cap radius as an s1.Angle. (Note that the cap angle
// is stored internally as a ChordAngle, so this method requires a trigonometric
// operation and may yield a slightly different result than the value passed
// to CapFromCenterAngle).
func (c Cap) Radius() s1.Angle {
	return c.radius.Angle()
}

// Area returns the surface area of the Cap on the unit sphere.
func (c Cap) Area() float64 {
	return 2.0 * math.Pi * math.Max(0, c.Height())
}

// Contains reports whether this cap contains the other.
func (c Cap) Contains(other Cap) bool {
	// In a set containment sense, every cap contains the empty cap.
	if c.IsFull() || other.IsEmpty() {
		return true
	}
	return c.radius >= ChordAngleBetweenPoints(c.center, other.center).Add(other.radius)
}

// Intersects reports whether this cap intersects the other cap.
// i.e. whether they have any points in common.
func (c Cap) Intersects(other Cap) bool {
	if c.IsEmpty() || other.IsEmpty() {
		return false
	}

	return c.radius.Add(other.radius) >= ChordAngleBetweenPoints(c.center, other.center)
}

// InteriorIntersects reports whether this caps interior intersects the other cap.
func (c Cap) InteriorIntersects(other Cap) bool {
	// Make sure this cap has an interior and the other cap is non-empty.
	if c.radius <= 0 || other.IsEmpty() {
		return false
	}

	return c.radius.Add(other.radius) > ChordAngleBetweenPoints(c.center, other.center)
}

// ContainsPoint reports whether this cap contains the point.
func (c Cap) ContainsPoint(p Point) bool {
	return ChordAngleBetweenPoints(c.center, p) <= c.radius
}

// InteriorContainsPoint reports whether the point is within the interior of this cap.
func (c Cap) InteriorContainsPoint(p Point) bool {
	return c.IsFull() || ChordAngleBetweenPoints(c.center, p) < c.radius
}

// Complement returns the complement of the interior of the cap. A cap and its
// complement have the same boundary but do not share any interior points.
// The complement operator is not a bijection because the complement of a
// singleton cap (containing a single point) is the same as the complement
// of an empty cap.
func (c Cap) Complement() Cap {
	if c.IsFull() {
		return EmptyCap()
	}
	if c.IsEmpty() {
		return FullCap()
	}

	return CapFromCenterChordAngle(Point{c.center.Mul(-1)}, s1.StraightChordAngle.Sub(c.radius))
}

// CapBound returns a bounding spherical cap. This is not guaranteed to be exact.
func (c Cap) CapBound() Cap {
	return c
}

// RectBound returns a bounding latitude-longitude rectangle.
// The bounds are not guaranteed to be tight.
func (c Cap) RectBound() Rect {
	if c.IsEmpty() {
		return EmptyRect()
	}

	capAngle := c.Radius().Radians()
	allLongitudes := false
	lat := r1.Interval{
		Lo: latitude(c.center).Radians() - capAngle,
		Hi: latitude(c.center).Radians() + capAngle,
	}
	lng := s1.FullInterval()

	// Check whether cap includes the south pole.
	if lat.Lo <= -math.Pi/2 {
		lat.Lo = -math.Pi / 2
		allLongitudes = true
	}

	// Check whether cap includes the north pole.
	if lat.Hi >= math.Pi/2 {
		lat.Hi = math.Pi / 2
		allLongitudes = true
	}

	if !allLongitudes {
		// Compute the range of longitudes covered by the cap. We use the law
		// of sines for spherical triangles. Consider the triangle ABC where
		// A is the north pole, B is the center of the cap, and C is the point
		// of tangency between the cap boundary and a line of longitude. Then
		// C is a right angle, and letting a,b,c denote the sides opposite A,B,C,
		// we have sin(a)/sin(A) = sin(c)/sin(C), or sin(A) = sin(a)/sin(c).
		// Here "a" is the cap angle, and "c" is the colatitude (90 degrees
		// minus the latitude). This formula also works for negative latitudes.
		//
		// The formula for sin(a) follows from the relationship h = 1 - cos(a).
		sinA := c.radius.Sin()
		sinC := math.Cos(latitude(c.center).Radians())
		if sinA <= sinC {
			angleA := math.Asin(sinA / sinC)
			lng.Lo = math.Remainder(longitude(c.center).Radians()-angleA, math.Pi*2)
			lng.Hi = math.Remainder(longitude(c.center).Radians()+angleA, math.Pi*2)
		}
	}
	return Rect{lat, lng}
}

// Equal reports whether this cap is equal to the other cap.
func (c Cap) Equal(other Cap) bool {
	return (c.radius == other.radius && c.center == other.center) ||
		(c.IsEmpty() && other.IsEmpty()) ||
		(c.IsFull() && other.IsFull())
}

// ApproxEqual reports whether this cap is equal to the other cap within the given tolerance.
func (c Cap) ApproxEqual(other Cap) bool {
	const epsilon = 1e-14
	r2 := float64(c.radius)
	otherR2 := float64(other.radius)
	return c.center.ApproxEqual(other.center) &&
		math.Abs(r2-otherR2) <= epsilon ||
		c.IsEmpty() && otherR2 <= epsilon ||
		other.IsEmpty() && r2 <= epsilon ||
		c.IsFull() && otherR2 >= 2-epsilon ||
		other.IsFull() && r2 >= 2-epsilon
}

// AddPoint increases the cap if necessary to include the given point. If this cap is empty,
// then the center is set to the point with a zero height. p must be unit-length.
func (c Cap) AddPoint(p Point) Cap {
	if c.IsEmpty() {
		c.center = p
		c.radius = 0
		return c
	}

	// After calling cap.AddPoint(p), cap.Contains(p) must be true. However
	// we don't need to do anything special to achieve this because Contains()
	// does exactly the same distance calculation that we do here.
	if newRad := ChordAngleBetweenPoints(c.center, p); newRad > c.radius {
		c.radius = newRad
	}
	return c
}

// AddCap increases the cap height if necessary to include the other cap. If this cap is empty,
// it is set to the other cap.
func (c Cap) AddCap(other Cap) Cap {
	if c.IsEmpty() {
		return other
	}
	if other.IsEmpty() {
		return c
	}

	// We round up the distance to ensure that the cap is actually contained.
	// TODO(roberts): Do some error analysis in order to guarantee this.
	dist := ChordAngleBetweenPoints(c.center, other.center).Add(other.radius)
	if newRad := dist.Expanded(dblEpsilon * float64(dist)); newRad > c.radius {
		c.radius = newRad
	}
	return c
}

// Expanded returns a new cap expanded by the given angle. If the cap is empty,
// it returns an empty cap.
func (c Cap) Expanded(distance s1.Angle) Cap {
	if c.IsEmpty() {
		return EmptyCap()
	}
	return CapFromCenterChordAngle(c.center, c.radius.Add(s1.ChordAngleFromAngle(distance)))
}

func (c Cap) String() string {
	return fmt.Sprintf("[Center=%v, Radius=%f]", c.center.Vector, c.Radius().Degrees())
}

// radiusToHeight converts an s1.Angle into the height of the cap.
func radiusToHeight(r s1.Angle) float64 {
	if r.Radians() < 0 {
		return float64(s1.NegativeChordAngle)
	}
	if r.Radians() >= math.Pi {
		return float64(s1.RightChordAngle)
	}
	return float64(0.5 * s1.ChordAngleFromAngle(r))

}

// ContainsCell reports whether the cap contains the given cell.
func (c Cap) ContainsCell(cell Cell) bool {
	// If the cap does not contain all cell vertices, return false.
	var vertices [4]Point
	for k := 0; k < 4; k++ {
		vertices[k] = cell.Vertex(k)
		if !c.ContainsPoint(vertices[k]) {
			return false
		}
	}
	// Otherwise, return true if the complement of the cap does not intersect the cell.
	return !c.Complement().intersects(cell, vertices)
}

// IntersectsCell reports whether the cap intersects the cell.
func (c Cap) IntersectsCell(cell Cell) bool {
	// If the cap contains any cell vertex, return true.
	var vertices [4]Point
	for k := 0; k < 4; k++ {
		vertices[k] = cell.Vertex(k)
		if c.ContainsPoint(vertices[k]) {
			return true
		}
	}
	return c.intersects(cell, vertices)
}

// intersects reports whether the cap intersects any point of the cell excluding
// its vertices (which are assumed to already have been checked).
func (c Cap) intersects(cell Cell, vertices [4]Point) bool {
	// If the cap is a hemisphere or larger, the cell and the complement of the cap
	// are both convex. Therefore since no vertex of the cell is contained, no other
	// interior point of the cell is contained either.
	if c.radius >= s1.RightChordAngle {
		return false
	}

	// We need to check for empty caps due to the center check just below.
	if c.IsEmpty() {
		return false
	}

	// Optimization: return true if the cell contains the cap center. This allows half
	// of the edge checks below to be skipped.
	if cell.ContainsPoint(c.center) {
		return true
	}

	// At this point we know that the cell does not contain the cap center, and the cap
	// does not contain any cell vertex. The only way that they can intersect is if the
	// cap intersects the interior of some edge.
	sin2Angle := c.radius.Sin2()
	for k := 0; k < 4; k++ {
		edge := cell.Edge(k).Vector
		dot := c.center.Vector.Dot(edge)
		if dot > 0 {
			// The center is in the interior half-space defined by the edge. We do not need
			// to consider these edges, since if the cap intersects this edge then it also
			// intersects the edge on the opposite side of the cell, because the center is
			// not contained with the cell.
			continue
		}

		// The Norm2() factor is necessary because "edge" is not normalized.
		if dot*dot > sin2Angle*edge.Norm2() {
			return false
		}

		// Otherwise, the great circle containing this edge intersects the interior of the cap. We just
		// need to check whether the point of closest approach occurs between the two edge endpoints.
		dir := edge.Cross(c.center.Vector)
		if dir.Dot(vertices[k].Vector) < 0 && dir.Dot(vertices[(k+1)&3].Vector) > 0 {
			return true
		}
	}
	return false
}

// CellUnionBound computes a covering of the Cap. In general the covering
// consists of at most 4 cells except for very large caps, which may need
// up to 6 cells. The output is not sorted.
func (c Cap) CellUnionBound() []CellID {
	// TODO(roberts): The covering could be made quite a bit tighter by mapping
	// the cap to a rectangle in (i,j)-space and finding a covering for that.

	// Find the maximum level such that the cap contains at most one cell vertex
	// and such that CellID.AppendVertexNeighbors() can be called.
	level := MinWidthMetric.MaxLevel(c.Radius().Radians()) - 1

	// If level < 0, more than three face cells are required.
	if level < 0 {
		cellIDs := make([]CellID, 6)
		for face := 0; face < 6; face++ {
			cellIDs[face] = CellIDFromFace(face)
		}
		return cellIDs
	}
	// The covering consists of the 4 cells at the given level that share the
	// cell vertex that is closest to the cap center.
	return cellIDFromPoint(c.center).VertexNeighbors(level)
}

// Centroid returns the true centroid of the cap multiplied by its surface area
// The result lies on the ray from the origin through the cap's center, but it
// is not unit length. Note that if you just want the "surface centroid", i.e.
// the normalized result, then it is simpler to call Center.
//
// The reason for multiplying the result by the cap area is to make it
// easier to compute the centroid of more complicated shapes. The centroid
// of a union of disjoint regions can be computed simply by adding their
// Centroid() results. Caveat: for caps that contain a single point
// (i.e., zero radius), this method always returns the origin (0, 0, 0).
// This is because shapes with no area don't affect the centroid of a
// union whose total area is positive.
func (c Cap) Centroid() Point {
	// From symmetry, the centroid of the cap must be somewhere on the line
	// from the origin to the center of the cap on the surface of the sphere.
	// When a sphere is divided into slices of constant thickness by a set of
	// parallel planes, all slices have the same surface area. This implies
	// that the radial component of the centroid is simply the midpoint of the
	// range of radial distances spanned by the cap. That is easily computed
	// from the cap height.
	if c.IsEmpty() {
		return Point{}
	}
	r := 1 - 0.5*c.Height()
	return Point{c.center.Mul(r * c.Area())}
}

// Union returns the smallest cap which encloses this cap and other.
func (c Cap) Union(other Cap) Cap {
	// If the other cap is larger, swap c and other for the rest of the computations.
	if c.radius < other.radius {
		c, other = other, c
	}

	if c.IsFull() || other.IsEmpty() {
		return c
	}

	// TODO: This calculation would be more efficient using s1.ChordAngles.
	cRadius := c.Radius()
	otherRadius := other.Radius()
	distance := c.center.Distance(other.center)
	if cRadius >= distance+otherRadius {
		return c
	}

	resRadius := 0.5 * (distance + cRadius + otherRadius)
	resCenter := InterpolateAtDistance(0.5*(distance-cRadius+otherRadius), c.center, other.center)
	return CapFromCenterAngle(resCenter, resRadius)
}

// Encode encodes the Cap.
func (c Cap) Encode(w io.Writer) error {
	e := &encoder{w: w}
	c.encode(e)
	return e.err
}

func (c Cap) encode(e *encoder) {
	e.writeFloat64(c.center.X)
	e.writeFloat64(c.center.Y)
	e.writeFloat64(c.center.Z)
	e.writeFloat64(float64(c.radius))
}

// Decode decodes the Cap.
func (c *Cap) Decode(r io.Reader) error {
	d := &decoder{r: asByteReader(r)}
	c.decode(d)
	return d.err
}

func (c *Cap) decode(d *decoder) {
	c.center.X = d.readFloat64()
	c.center.Y = d.readFloat64()
	c.center.Z = d.readFloat64()
	c.radius = s1.ChordAngle(d.readFloat64())
}
