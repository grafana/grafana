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
	"sort"

	"github.com/golang/geo/r3"
	"github.com/golang/geo/s1"
)

// Point represents a point on the unit sphere as a normalized 3D vector.
// Fields should be treated as read-only. Use one of the factory methods for creation.
type Point struct {
	r3.Vector
}

// sortPoints sorts the slice of Points in place.
func sortPoints(e []Point) {
	sort.Sort(points(e))
}

// points implements the Sort interface for slices of Point.
type points []Point

func (p points) Len() int           { return len(p) }
func (p points) Swap(i, j int)      { p[i], p[j] = p[j], p[i] }
func (p points) Less(i, j int) bool { return p[i].Cmp(p[j].Vector) == -1 }

// PointFromCoords creates a new normalized point from coordinates.
//
// This always returns a valid point. If the given coordinates can not be normalized
// the origin point will be returned.
//
// This behavior is different from the C++ construction of a S2Point from coordinates
// (i.e. S2Point(x, y, z)) in that in C++ they do not Normalize.
func PointFromCoords(x, y, z float64) Point {
	if x == 0 && y == 0 && z == 0 {
		return OriginPoint()
	}
	return Point{r3.Vector{x, y, z}.Normalize()}
}

// OriginPoint returns a unique "origin" on the sphere for operations that need a fixed
// reference point. In particular, this is the "point at infinity" used for
// point-in-polygon testing (by counting the number of edge crossings).
//
// It should *not* be a point that is commonly used in edge tests in order
// to avoid triggering code to handle degenerate cases (this rules out the
// north and south poles). It should also not be on the boundary of any
// low-level S2Cell for the same reason.
func OriginPoint() Point {
	return Point{r3.Vector{-0.0099994664350250197, 0.0025924542609324121, 0.99994664350250195}}
}

// PointCross returns a Point that is orthogonal to both p and op. This is similar to
// p.Cross(op) (the true cross product) except that it does a better job of
// ensuring orthogonality when the Point is nearly parallel to op, it returns
// a non-zero result even when p == op or p == -op and the result is a Point.
//
// It satisfies the following properties (f == PointCross):
//
//   (1) f(p, op) != 0 for all p, op
//   (2) f(op,p) == -f(p,op) unless p == op or p == -op
//   (3) f(-p,op) == -f(p,op) unless p == op or p == -op
//   (4) f(p,-op) == -f(p,op) unless p == op or p == -op
func (p Point) PointCross(op Point) Point {
	// NOTE(dnadasi): In the C++ API the equivalent method here was known as "RobustCrossProd",
	// but PointCross more accurately describes how this method is used.
	x := p.Add(op.Vector).Cross(op.Sub(p.Vector))

	// Compare exactly to the 0 vector.
	if x == (r3.Vector{}) {
		// The only result that makes sense mathematically is to return zero, but
		// we find it more convenient to return an arbitrary orthogonal vector.
		return Point{p.Ortho()}
	}

	return Point{x}
}

// OrderedCCW returns true if the edges OA, OB, and OC are encountered in that
// order while sweeping CCW around the point O.
//
// You can think of this as testing whether A <= B <= C with respect to the
// CCW ordering around O that starts at A, or equivalently, whether B is
// contained in the range of angles (inclusive) that starts at A and extends
// CCW to C. Properties:
//
//  (1) If OrderedCCW(a,b,c,o) && OrderedCCW(b,a,c,o), then a == b
//  (2) If OrderedCCW(a,b,c,o) && OrderedCCW(a,c,b,o), then b == c
//  (3) If OrderedCCW(a,b,c,o) && OrderedCCW(c,b,a,o), then a == b == c
//  (4) If a == b or b == c, then OrderedCCW(a,b,c,o) is true
//  (5) Otherwise if a == c, then OrderedCCW(a,b,c,o) is false
func OrderedCCW(a, b, c, o Point) bool {
	sum := 0
	if RobustSign(b, o, a) != Clockwise {
		sum++
	}
	if RobustSign(c, o, b) != Clockwise {
		sum++
	}
	if RobustSign(a, o, c) == CounterClockwise {
		sum++
	}
	return sum >= 2
}

// Distance returns the angle between two points.
func (p Point) Distance(b Point) s1.Angle {
	return p.Vector.Angle(b.Vector)
}

// ApproxEqual reports whether the two points are similar enough to be equal.
func (p Point) ApproxEqual(other Point) bool {
	return p.approxEqual(other, s1.Angle(epsilon))
}

// approxEqual reports whether the two points are within the given epsilon.
func (p Point) approxEqual(other Point, eps s1.Angle) bool {
	return p.Vector.Angle(other.Vector) <= eps
}

// ChordAngleBetweenPoints constructs a ChordAngle corresponding to the distance
// between the two given points. The points must be unit length.
func ChordAngleBetweenPoints(x, y Point) s1.ChordAngle {
	return s1.ChordAngle(math.Min(4.0, x.Sub(y.Vector).Norm2()))
}

// regularPoints generates a slice of points shaped as a regular polygon with
// the numVertices vertices, all located on a circle of the specified angular radius
// around the center. The radius is the actual distance from center to each vertex.
func regularPoints(center Point, radius s1.Angle, numVertices int) []Point {
	return regularPointsForFrame(getFrame(center), radius, numVertices)
}

// regularPointsForFrame generates a slice of points shaped as a regular polygon
// with numVertices vertices, all on a circle of the specified angular radius around
// the center. The radius is the actual distance from the center to each vertex.
func regularPointsForFrame(frame matrix3x3, radius s1.Angle, numVertices int) []Point {
	// We construct the loop in the given frame coordinates, with the center at
	// (0, 0, 1). For a loop of radius r, the loop vertices have the form
	// (x, y, z) where x^2 + y^2 = sin(r) and z = cos(r). The distance on the
	// sphere (arc length) from each vertex to the center is acos(cos(r)) = r.
	z := math.Cos(radius.Radians())
	r := math.Sin(radius.Radians())
	radianStep := 2 * math.Pi / float64(numVertices)
	var vertices []Point

	for i := 0; i < numVertices; i++ {
		angle := float64(i) * radianStep
		p := Point{r3.Vector{r * math.Cos(angle), r * math.Sin(angle), z}}
		vertices = append(vertices, Point{fromFrame(frame, p).Normalize()})
	}

	return vertices
}

// CapBound returns a bounding cap for this point.
func (p Point) CapBound() Cap {
	return CapFromPoint(p)
}

// RectBound returns a bounding latitude-longitude rectangle from this point.
func (p Point) RectBound() Rect {
	return RectFromLatLng(LatLngFromPoint(p))
}

// ContainsCell returns false as Points do not contain any other S2 types.
func (p Point) ContainsCell(c Cell) bool { return false }

// IntersectsCell reports whether this Point intersects the given cell.
func (p Point) IntersectsCell(c Cell) bool {
	return c.ContainsPoint(p)
}

// ContainsPoint reports if this Point contains the other Point.
// (This method is named to satisfy the Region interface.)
func (p Point) ContainsPoint(other Point) bool {
	return p.Contains(other)
}

// CellUnionBound computes a covering of the Point.
func (p Point) CellUnionBound() []CellID {
	return p.CapBound().CellUnionBound()
}

// Contains reports if this Point contains the other Point.
// (This method matches all other s2 types where the reflexive Contains
// method does not contain the type's name.)
func (p Point) Contains(other Point) bool { return p == other }

// Encode encodes the Point.
func (p Point) Encode(w io.Writer) error {
	e := &encoder{w: w}
	p.encode(e)
	return e.err
}

func (p Point) encode(e *encoder) {
	e.writeInt8(encodingVersion)
	e.writeFloat64(p.X)
	e.writeFloat64(p.Y)
	e.writeFloat64(p.Z)
}

// Decode decodes the Point.
func (p *Point) Decode(r io.Reader) error {
	d := &decoder{r: asByteReader(r)}
	p.decode(d)
	return d.err
}

func (p *Point) decode(d *decoder) {
	version := d.readInt8()
	if d.err != nil {
		return
	}
	if version != encodingVersion {
		d.err = fmt.Errorf("only version %d is supported", encodingVersion)
		return
	}
	p.X = d.readFloat64()
	p.Y = d.readFloat64()
	p.Z = d.readFloat64()
}

// Rotate the given point about the given axis by the given angle. p and
// axis must be unit length; angle has no restrictions (e.g., it can be
// positive, negative, greater than 360 degrees, etc).
func Rotate(p, axis Point, angle s1.Angle) Point {
	// Let M be the plane through P that is perpendicular to axis, and let
	// center be the point where M intersects axis. We construct a
	// right-handed orthogonal frame (dx, dy, center) such that dx is the
	// vector from center to P, and dy has the same length as dx. The
	// result can then be expressed as (cos(angle)*dx + sin(angle)*dy + center).
	center := axis.Mul(p.Dot(axis.Vector))
	dx := p.Sub(center)
	dy := axis.Cross(p.Vector)
	// Mathematically the result is unit length, but normalization is necessary
	// to ensure that numerical errors don't accumulate.
	return Point{dx.Mul(math.Cos(angle.Radians())).Add(dy.Mul(math.Sin(angle.Radians()))).Add(center).Normalize()}
}
