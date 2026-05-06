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

package r2

import (
	"fmt"
	"math"

	"github.com/golang/geo/r1"
)

// Point represents a point in ℝ².
type Point struct {
	X, Y float64
}

// Add returns the sum of p and op.
func (p Point) Add(op Point) Point { return Point{p.X + op.X, p.Y + op.Y} }

// Sub returns the difference of p and op.
func (p Point) Sub(op Point) Point { return Point{p.X - op.X, p.Y - op.Y} }

// Mul returns the scalar product of p and m.
func (p Point) Mul(m float64) Point { return Point{m * p.X, m * p.Y} }

// Ortho returns a counterclockwise orthogonal point with the same norm.
func (p Point) Ortho() Point { return Point{-p.Y, p.X} }

// Dot returns the dot product between p and op.
func (p Point) Dot(op Point) float64 { return p.X*op.X + p.Y*op.Y }

// Cross returns the cross product of p and op.
func (p Point) Cross(op Point) float64 { return p.X*op.Y - p.Y*op.X }

// Norm returns the vector's norm.
func (p Point) Norm() float64 { return math.Hypot(p.X, p.Y) }

// Normalize returns a unit point in the same direction as p.
func (p Point) Normalize() Point {
	if p.X == 0 && p.Y == 0 {
		return p
	}
	return p.Mul(1 / p.Norm())
}

func (p Point) String() string { return fmt.Sprintf("(%.12f, %.12f)", p.X, p.Y) }

// Rect represents a closed axis-aligned rectangle in the (x,y) plane.
type Rect struct {
	X, Y r1.Interval
}

// RectFromPoints constructs a rect that contains the given points.
func RectFromPoints(pts ...Point) Rect {
	// Because the default value on interval is 0,0, we need to manually
	// define the interval from the first point passed in as our starting
	// interval, otherwise we end up with the case of passing in
	// Point{0.2, 0.3} and getting the starting Rect of {0, 0.2}, {0, 0.3}
	// instead of the Rect {0.2, 0.2}, {0.3, 0.3} which is not correct.
	if len(pts) == 0 {
		return Rect{}
	}

	r := Rect{
		X: r1.Interval{Lo: pts[0].X, Hi: pts[0].X},
		Y: r1.Interval{Lo: pts[0].Y, Hi: pts[0].Y},
	}

	for _, p := range pts[1:] {
		r = r.AddPoint(p)
	}
	return r
}

// RectFromCenterSize constructs a rectangle with the given center and size.
// Both dimensions of size must be non-negative.
func RectFromCenterSize(center, size Point) Rect {
	return Rect{
		r1.Interval{Lo: center.X - size.X/2, Hi: center.X + size.X/2},
		r1.Interval{Lo: center.Y - size.Y/2, Hi: center.Y + size.Y/2},
	}
}

// EmptyRect constructs the canonical empty rectangle. Use IsEmpty() to test
// for empty rectangles, since they have more than one representation. A Rect{}
// is not the same as the EmptyRect.
func EmptyRect() Rect {
	return Rect{r1.EmptyInterval(), r1.EmptyInterval()}
}

// IsValid reports whether the rectangle is valid.
// This requires the width to be empty iff the height is empty.
func (r Rect) IsValid() bool {
	return r.X.IsEmpty() == r.Y.IsEmpty()
}

// IsEmpty reports whether the rectangle is empty.
func (r Rect) IsEmpty() bool {
	return r.X.IsEmpty()
}

// Vertices returns all four vertices of the rectangle. Vertices are returned in
// CCW direction starting with the lower left corner.
func (r Rect) Vertices() [4]Point {
	return [4]Point{
		{r.X.Lo, r.Y.Lo},
		{r.X.Hi, r.Y.Lo},
		{r.X.Hi, r.Y.Hi},
		{r.X.Lo, r.Y.Hi},
	}
}

// VertexIJ returns the vertex in direction i along the X-axis (0=left, 1=right) and
// direction j along the Y-axis (0=down, 1=up).
func (r Rect) VertexIJ(i, j int) Point {
	x := r.X.Lo
	if i == 1 {
		x = r.X.Hi
	}
	y := r.Y.Lo
	if j == 1 {
		y = r.Y.Hi
	}
	return Point{x, y}
}

// Lo returns the low corner of the rect.
func (r Rect) Lo() Point {
	return Point{r.X.Lo, r.Y.Lo}
}

// Hi returns the high corner of the rect.
func (r Rect) Hi() Point {
	return Point{r.X.Hi, r.Y.Hi}
}

// Center returns the center of the rectangle in (x,y)-space
func (r Rect) Center() Point {
	return Point{r.X.Center(), r.Y.Center()}
}

// Size returns the width and height of this rectangle in (x,y)-space. Empty
// rectangles have a negative width and height.
func (r Rect) Size() Point {
	return Point{r.X.Length(), r.Y.Length()}
}

// ContainsPoint reports whether the rectangle contains the given point.
// Rectangles are closed regions, i.e. they contain their boundary.
func (r Rect) ContainsPoint(p Point) bool {
	return r.X.Contains(p.X) && r.Y.Contains(p.Y)
}

// InteriorContainsPoint returns true iff the given point is contained in the interior
// of the region (i.e. the region excluding its boundary).
func (r Rect) InteriorContainsPoint(p Point) bool {
	return r.X.InteriorContains(p.X) && r.Y.InteriorContains(p.Y)
}

// Contains reports whether the rectangle contains the given rectangle.
func (r Rect) Contains(other Rect) bool {
	return r.X.ContainsInterval(other.X) && r.Y.ContainsInterval(other.Y)
}

// InteriorContains reports whether the interior of this rectangle contains all of the
// points of the given other rectangle (including its boundary).
func (r Rect) InteriorContains(other Rect) bool {
	return r.X.InteriorContainsInterval(other.X) && r.Y.InteriorContainsInterval(other.Y)
}

// Intersects reports whether this rectangle and the other rectangle have any points in common.
func (r Rect) Intersects(other Rect) bool {
	return r.X.Intersects(other.X) && r.Y.Intersects(other.Y)
}

// InteriorIntersects reports whether the interior of this rectangle intersects
// any point (including the boundary) of the given other rectangle.
func (r Rect) InteriorIntersects(other Rect) bool {
	return r.X.InteriorIntersects(other.X) && r.Y.InteriorIntersects(other.Y)
}

// AddPoint expands the rectangle to include the given point. The rectangle is
// expanded by the minimum amount possible.
func (r Rect) AddPoint(p Point) Rect {
	return Rect{r.X.AddPoint(p.X), r.Y.AddPoint(p.Y)}
}

// AddRect expands the rectangle to include the given rectangle. This is the
// same as replacing the rectangle by the union of the two rectangles, but
// is more efficient.
func (r Rect) AddRect(other Rect) Rect {
	return Rect{r.X.Union(other.X), r.Y.Union(other.Y)}
}

// ClampPoint returns the closest point in the rectangle to the given point.
// The rectangle must be non-empty.
func (r Rect) ClampPoint(p Point) Point {
	return Point{r.X.ClampPoint(p.X), r.Y.ClampPoint(p.Y)}
}

// Expanded returns a rectangle that has been expanded in the x-direction
// by margin.X, and in y-direction by margin.Y. If either margin is empty,
// then shrink the interval on the corresponding sides instead. The resulting
// rectangle may be empty. Any expansion of an empty rectangle remains empty.
func (r Rect) Expanded(margin Point) Rect {
	xx := r.X.Expanded(margin.X)
	yy := r.Y.Expanded(margin.Y)
	if xx.IsEmpty() || yy.IsEmpty() {
		return EmptyRect()
	}
	return Rect{xx, yy}
}

// ExpandedByMargin returns a Rect that has been expanded by the amount on all sides.
func (r Rect) ExpandedByMargin(margin float64) Rect {
	return r.Expanded(Point{margin, margin})
}

// Union returns the smallest rectangle containing the union of this rectangle and
// the given rectangle.
func (r Rect) Union(other Rect) Rect {
	return Rect{r.X.Union(other.X), r.Y.Union(other.Y)}
}

// Intersection returns the smallest rectangle containing the intersection of this
// rectangle and the given rectangle.
func (r Rect) Intersection(other Rect) Rect {
	xx := r.X.Intersection(other.X)
	yy := r.Y.Intersection(other.Y)
	if xx.IsEmpty() || yy.IsEmpty() {
		return EmptyRect()
	}

	return Rect{xx, yy}
}

// ApproxEqual returns true if the x- and y-intervals of the two rectangles are
// the same up to the given tolerance.
func (r Rect) ApproxEqual(r2 Rect) bool {
	return r.X.ApproxEqual(r2.X) && r.Y.ApproxEqual(r2.Y)
}

func (r Rect) String() string { return fmt.Sprintf("[Lo%s, Hi%s]", r.Lo(), r.Hi()) }
