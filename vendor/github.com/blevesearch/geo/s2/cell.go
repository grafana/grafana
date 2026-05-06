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
	"io"
	"math"

	"github.com/golang/geo/r1"
	"github.com/golang/geo/r2"
	"github.com/golang/geo/r3"
	"github.com/golang/geo/s1"
)

// Cell is an S2 region object that represents a cell. Unlike CellIDs,
// it supports efficient containment and intersection tests. However, it is
// also a more expensive representation.
type Cell struct {
	face        int8
	level       int8
	orientation int8
	id          CellID
	uv          r2.Rect
}

// CellFromCellID constructs a Cell corresponding to the given CellID.
func CellFromCellID(id CellID) Cell {
	c := Cell{}
	c.id = id
	f, i, j, o := c.id.faceIJOrientation()
	c.face = int8(f)
	c.level = int8(c.id.Level())
	c.orientation = int8(o)
	c.uv = ijLevelToBoundUV(i, j, int(c.level))
	return c
}

// CellFromPoint constructs a cell for the given Point.
func CellFromPoint(p Point) Cell {
	return CellFromCellID(cellIDFromPoint(p))
}

// CellFromLatLng constructs a cell for the given LatLng.
func CellFromLatLng(ll LatLng) Cell {
	return CellFromCellID(CellIDFromLatLng(ll))
}

// Face returns the face this cell is on.
func (c Cell) Face() int {
	return int(c.face)
}

// oppositeFace returns the face opposite the given face.
func oppositeFace(face int) int {
	return (face + 3) % 6
}

// Level returns the level of this cell.
func (c Cell) Level() int {
	return int(c.level)
}

// ID returns the CellID this cell represents.
func (c Cell) ID() CellID {
	return c.id
}

// IsLeaf returns whether this Cell is a leaf or not.
func (c Cell) IsLeaf() bool {
	return c.level == maxLevel
}

// SizeIJ returns the edge length of this cell in (i,j)-space.
func (c Cell) SizeIJ() int {
	return sizeIJ(int(c.level))
}

// SizeST returns the edge length of this cell in (s,t)-space.
func (c Cell) SizeST() float64 {
	return c.id.sizeST(int(c.level))
}

// Vertex returns the k-th vertex of the cell (k = 0,1,2,3) in CCW order
// (lower left, lower right, upper right, upper left in the UV plane).
func (c Cell) Vertex(k int) Point {
	return Point{faceUVToXYZ(int(c.face), c.uv.Vertices()[k].X, c.uv.Vertices()[k].Y).Normalize()}
}

// Edge returns the inward-facing normal of the great circle passing through
// the CCW ordered edge from vertex k to vertex k+1 (mod 4) (for k = 0,1,2,3).
func (c Cell) Edge(k int) Point {
	switch k {
	case 0:
		return Point{vNorm(int(c.face), c.uv.Y.Lo).Normalize()} // Bottom
	case 1:
		return Point{uNorm(int(c.face), c.uv.X.Hi).Normalize()} // Right
	case 2:
		return Point{vNorm(int(c.face), c.uv.Y.Hi).Mul(-1.0).Normalize()} // Top
	default:
		return Point{uNorm(int(c.face), c.uv.X.Lo).Mul(-1.0).Normalize()} // Left
	}
}

// BoundUV returns the bounds of this cell in (u,v)-space.
func (c Cell) BoundUV() r2.Rect {
	return c.uv
}

// Center returns the direction vector corresponding to the center in
// (s,t)-space of the given cell. This is the point at which the cell is
// divided into four subcells; it is not necessarily the centroid of the
// cell in (u,v)-space or (x,y,z)-space
func (c Cell) Center() Point {
	return Point{c.id.rawPoint().Normalize()}
}

// Children returns the four direct children of this cell in traversal order
// and returns true. If this is a leaf cell, or the children could not be created,
// false is returned.
// The C++ method is called Subdivide.
func (c Cell) Children() ([4]Cell, bool) {
	var children [4]Cell

	if c.id.IsLeaf() {
		return children, false
	}

	// Compute the cell midpoint in uv-space.
	uvMid := c.id.centerUV()

	// Create four children with the appropriate bounds.
	cid := c.id.ChildBegin()
	for pos := 0; pos < 4; pos++ {
		children[pos] = Cell{
			face:        c.face,
			level:       c.level + 1,
			orientation: c.orientation ^ int8(posToOrientation[pos]),
			id:          cid,
		}

		// We want to split the cell in half in u and v. To decide which
		// side to set equal to the midpoint value, we look at cell's (i,j)
		// position within its parent. The index for i is in bit 1 of ij.
		ij := posToIJ[c.orientation][pos]
		i := ij >> 1
		j := ij & 1
		if i == 1 {
			children[pos].uv.X.Hi = c.uv.X.Hi
			children[pos].uv.X.Lo = uvMid.X
		} else {
			children[pos].uv.X.Lo = c.uv.X.Lo
			children[pos].uv.X.Hi = uvMid.X
		}
		if j == 1 {
			children[pos].uv.Y.Hi = c.uv.Y.Hi
			children[pos].uv.Y.Lo = uvMid.Y
		} else {
			children[pos].uv.Y.Lo = c.uv.Y.Lo
			children[pos].uv.Y.Hi = uvMid.Y
		}
		cid = cid.Next()
	}
	return children, true
}

// ExactArea returns the area of this cell as accurately as possible.
func (c Cell) ExactArea() float64 {
	v0, v1, v2, v3 := c.Vertex(0), c.Vertex(1), c.Vertex(2), c.Vertex(3)
	return PointArea(v0, v1, v2) + PointArea(v0, v2, v3)
}

// ApproxArea returns the approximate area of this cell. This method is accurate
// to within 3% percent for all cell sizes and accurate to within 0.1% for cells
// at level 5 or higher (i.e. squares 350km to a side or smaller on the Earth's
// surface). It is moderately cheap to compute.
func (c Cell) ApproxArea() float64 {
	// All cells at the first two levels have the same area.
	if c.level < 2 {
		return c.AverageArea()
	}

	// First, compute the approximate area of the cell when projected
	// perpendicular to its normal. The cross product of its diagonals gives
	// the normal, and the length of the normal is twice the projected area.
	flatArea := 0.5 * (c.Vertex(2).Sub(c.Vertex(0).Vector).
		Cross(c.Vertex(3).Sub(c.Vertex(1).Vector)).Norm())

	// Now, compensate for the curvature of the cell surface by pretending
	// that the cell is shaped like a spherical cap. The ratio of the
	// area of a spherical cap to the area of its projected disc turns out
	// to be 2 / (1 + sqrt(1 - r*r)) where r is the radius of the disc.
	// For example, when r=0 the ratio is 1, and when r=1 the ratio is 2.
	// Here we set Pi*r*r == flatArea to find the equivalent disc.
	return flatArea * 2 / (1 + math.Sqrt(1-math.Min(1/math.Pi*flatArea, 1)))
}

// AverageArea returns the average area of cells at the level of this cell.
// This is accurate to within a factor of 1.7.
func (c Cell) AverageArea() float64 {
	return AvgAreaMetric.Value(int(c.level))
}

// IntersectsCell reports whether the intersection of this cell and the other cell is not nil.
func (c Cell) IntersectsCell(oc Cell) bool {
	return c.id.Intersects(oc.id)
}

// ContainsCell reports whether this cell contains the other cell.
func (c Cell) ContainsCell(oc Cell) bool {
	return c.id.Contains(oc.id)
}

// CellUnionBound computes a covering of the Cell.
func (c Cell) CellUnionBound() []CellID {
	return c.CapBound().CellUnionBound()
}

// latitude returns the latitude of the cell vertex in radians given by (i,j),
// where i and j indicate the Hi (1) or Lo (0) corner.
func (c Cell) latitude(i, j int) float64 {
	var u, v float64
	switch {
	case i == 0 && j == 0:
		u = c.uv.X.Lo
		v = c.uv.Y.Lo
	case i == 0 && j == 1:
		u = c.uv.X.Lo
		v = c.uv.Y.Hi
	case i == 1 && j == 0:
		u = c.uv.X.Hi
		v = c.uv.Y.Lo
	case i == 1 && j == 1:
		u = c.uv.X.Hi
		v = c.uv.Y.Hi
	default:
		panic("i and/or j is out of bounds")
	}
	return latitude(Point{faceUVToXYZ(int(c.face), u, v)}).Radians()
}

// longitude returns the longitude of the cell vertex in radians given by (i,j),
// where i and j indicate the Hi (1) or Lo (0) corner.
func (c Cell) longitude(i, j int) float64 {
	var u, v float64
	switch {
	case i == 0 && j == 0:
		u = c.uv.X.Lo
		v = c.uv.Y.Lo
	case i == 0 && j == 1:
		u = c.uv.X.Lo
		v = c.uv.Y.Hi
	case i == 1 && j == 0:
		u = c.uv.X.Hi
		v = c.uv.Y.Lo
	case i == 1 && j == 1:
		u = c.uv.X.Hi
		v = c.uv.Y.Hi
	default:
		panic("i and/or j is out of bounds")
	}
	return longitude(Point{faceUVToXYZ(int(c.face), u, v)}).Radians()
}

var (
	poleMinLat = math.Asin(math.Sqrt(1.0/3)) - 0.5*dblEpsilon
)

// RectBound returns the bounding rectangle of this cell.
func (c Cell) RectBound() Rect {
	if c.level > 0 {
		// Except for cells at level 0, the latitude and longitude extremes are
		// attained at the vertices.  Furthermore, the latitude range is
		// determined by one pair of diagonally opposite vertices and the
		// longitude range is determined by the other pair.
		//
		// We first determine which corner (i,j) of the cell has the largest
		// absolute latitude.  To maximize latitude, we want to find the point in
		// the cell that has the largest absolute z-coordinate and the smallest
		// absolute x- and y-coordinates.  To do this we look at each coordinate
		// (u and v), and determine whether we want to minimize or maximize that
		// coordinate based on the axis direction and the cell's (u,v) quadrant.
		u := c.uv.X.Lo + c.uv.X.Hi
		v := c.uv.Y.Lo + c.uv.Y.Hi
		var i, j int
		if uAxis(int(c.face)).Z == 0 {
			if u < 0 {
				i = 1
			}
		} else if u > 0 {
			i = 1
		}
		if vAxis(int(c.face)).Z == 0 {
			if v < 0 {
				j = 1
			}
		} else if v > 0 {
			j = 1
		}
		lat := r1.IntervalFromPoint(c.latitude(i, j)).AddPoint(c.latitude(1-i, 1-j))
		lng := s1.EmptyInterval().AddPoint(c.longitude(i, 1-j)).AddPoint(c.longitude(1-i, j))

		// We grow the bounds slightly to make sure that the bounding rectangle
		// contains LatLngFromPoint(P) for any point P inside the loop L defined by the
		// four *normalized* vertices.  Note that normalization of a vector can
		// change its direction by up to 0.5 * dblEpsilon radians, and it is not
		// enough just to add Normalize calls to the code above because the
		// latitude/longitude ranges are not necessarily determined by diagonally
		// opposite vertex pairs after normalization.
		//
		// We would like to bound the amount by which the latitude/longitude of a
		// contained point P can exceed the bounds computed above.  In the case of
		// longitude, the normalization error can change the direction of rounding
		// leading to a maximum difference in longitude of 2 * dblEpsilon.  In
		// the case of latitude, the normalization error can shift the latitude by
		// up to 0.5 * dblEpsilon and the other sources of error can cause the
		// two latitudes to differ by up to another 1.5 * dblEpsilon, which also
		// leads to a maximum difference of 2 * dblEpsilon.
		return Rect{lat, lng}.expanded(LatLng{s1.Angle(2 * dblEpsilon), s1.Angle(2 * dblEpsilon)}).PolarClosure()
	}

	// The 4 cells around the equator extend to +/-45 degrees latitude at the
	// midpoints of their top and bottom edges.  The two cells covering the
	// poles extend down to +/-35.26 degrees at their vertices.  The maximum
	// error in this calculation is 0.5 * dblEpsilon.
	var bound Rect
	switch c.face {
	case 0:
		bound = Rect{r1.Interval{-math.Pi / 4, math.Pi / 4}, s1.Interval{-math.Pi / 4, math.Pi / 4}}
	case 1:
		bound = Rect{r1.Interval{-math.Pi / 4, math.Pi / 4}, s1.Interval{math.Pi / 4, 3 * math.Pi / 4}}
	case 2:
		bound = Rect{r1.Interval{poleMinLat, math.Pi / 2}, s1.FullInterval()}
	case 3:
		bound = Rect{r1.Interval{-math.Pi / 4, math.Pi / 4}, s1.Interval{3 * math.Pi / 4, -3 * math.Pi / 4}}
	case 4:
		bound = Rect{r1.Interval{-math.Pi / 4, math.Pi / 4}, s1.Interval{-3 * math.Pi / 4, -math.Pi / 4}}
	default:
		bound = Rect{r1.Interval{-math.Pi / 2, -poleMinLat}, s1.FullInterval()}
	}

	// Finally, we expand the bound to account for the error when a point P is
	// converted to an LatLng to test for containment. (The bound should be
	// large enough so that it contains the computed LatLng of any contained
	// point, not just the infinite-precision version.) We don't need to expand
	// longitude because longitude is calculated via a single call to math.Atan2,
	// which is guaranteed to be semi-monotonic.
	return bound.expanded(LatLng{s1.Angle(dblEpsilon), s1.Angle(0)})
}

// CapBound returns the bounding cap of this cell.
func (c Cell) CapBound() Cap {
	// We use the cell center in (u,v)-space as the cap axis.  This vector is very close
	// to GetCenter() and faster to compute.  Neither one of these vectors yields the
	// bounding cap with minimal surface area, but they are both pretty close.
	cap := CapFromPoint(Point{faceUVToXYZ(int(c.face), c.uv.Center().X, c.uv.Center().Y).Normalize()})
	for k := 0; k < 4; k++ {
		cap = cap.AddPoint(c.Vertex(k))
	}
	return cap
}

// ContainsPoint reports whether this cell contains the given point. Note that
// unlike Loop/Polygon, a Cell is considered to be a closed set. This means
// that a point on a Cell's edge or vertex belong to the Cell and the relevant
// adjacent Cells too.
//
// If you want every point to be contained by exactly one Cell,
// you will need to convert the Cell to a Loop.
func (c Cell) ContainsPoint(p Point) bool {
	var uv r2.Point
	var ok bool
	if uv.X, uv.Y, ok = faceXYZToUV(int(c.face), p); !ok {
		return false
	}

	// Expand the (u,v) bound to ensure that
	//
	//   CellFromPoint(p).ContainsPoint(p)
	//
	// is always true. To do this, we need to account for the error when
	// converting from (u,v) coordinates to (s,t) coordinates. In the
	// normal case the total error is at most dblEpsilon.
	return c.uv.ExpandedByMargin(dblEpsilon).ContainsPoint(uv)
}

// Encode encodes the Cell.
func (c Cell) Encode(w io.Writer) error {
	e := &encoder{w: w}
	c.encode(e)
	return e.err
}

func (c Cell) encode(e *encoder) {
	c.id.encode(e)
}

// Decode decodes the Cell.
func (c *Cell) Decode(r io.Reader) error {
	d := &decoder{r: asByteReader(r)}
	c.decode(d)
	return d.err
}

func (c *Cell) decode(d *decoder) {
	c.id.decode(d)
	*c = CellFromCellID(c.id)
}

// vertexChordDist2 returns the squared chord distance from point P to the
// given corner vertex specified by the Hi or Lo values of each.
func (c Cell) vertexChordDist2(p Point, xHi, yHi bool) s1.ChordAngle {
	x := c.uv.X.Lo
	y := c.uv.Y.Lo
	if xHi {
		x = c.uv.X.Hi
	}
	if yHi {
		y = c.uv.Y.Hi
	}

	return ChordAngleBetweenPoints(p, PointFromCoords(x, y, 1))
}

// uEdgeIsClosest reports whether a point P is closer to the interior of the specified
// Cell edge (either the lower or upper edge of the Cell) or to the endpoints.
func (c Cell) uEdgeIsClosest(p Point, vHi bool) bool {
	u0 := c.uv.X.Lo
	u1 := c.uv.X.Hi
	v := c.uv.Y.Lo
	if vHi {
		v = c.uv.Y.Hi
	}
	// These are the normals to the planes that are perpendicular to the edge
	// and pass through one of its two endpoints.
	dir0 := r3.Vector{v*v + 1, -u0 * v, -u0}
	dir1 := r3.Vector{v*v + 1, -u1 * v, -u1}
	return p.Dot(dir0) > 0 && p.Dot(dir1) < 0
}

// vEdgeIsClosest reports whether a point P is closer to the interior of the specified
// Cell edge (either the right or left edge of the Cell) or to the endpoints.
func (c Cell) vEdgeIsClosest(p Point, uHi bool) bool {
	v0 := c.uv.Y.Lo
	v1 := c.uv.Y.Hi
	u := c.uv.X.Lo
	if uHi {
		u = c.uv.X.Hi
	}
	dir0 := r3.Vector{-u * v0, u*u + 1, -v0}
	dir1 := r3.Vector{-u * v1, u*u + 1, -v1}
	return p.Dot(dir0) > 0 && p.Dot(dir1) < 0
}

// edgeDistance reports the distance from a Point P to a given Cell edge. The point
// P is given by its dot product, and the uv edge by its normal in the
// given coordinate value.
func edgeDistance(ij, uv float64) s1.ChordAngle {
	// Let P by the target point and let R be the closest point on the given
	// edge AB.  The desired distance PR can be expressed as PR^2 = PQ^2 + QR^2
	// where Q is the point P projected onto the plane through the great circle
	// through AB.  We can compute the distance PQ^2 perpendicular to the plane
	// from "dirIJ" (the dot product of the target point P with the edge
	// normal) and the squared length the edge normal (1 + uv**2).
	pq2 := (ij * ij) / (1 + uv*uv)

	// We can compute the distance QR as (1 - OQ) where O is the sphere origin,
	// and we can compute OQ^2 = 1 - PQ^2 using the Pythagorean theorem.
	// (This calculation loses accuracy as angle POQ approaches Pi/2.)
	qr := 1 - math.Sqrt(1-pq2)
	return s1.ChordAngleFromSquaredLength(pq2 + qr*qr)
}

// distanceInternal reports the distance from the given point to the interior of
// the cell if toInterior is true or to the boundary of the cell otherwise.
func (c Cell) distanceInternal(targetXYZ Point, toInterior bool) s1.ChordAngle {
	// All calculations are done in the (u,v,w) coordinates of this cell's face.
	target := faceXYZtoUVW(int(c.face), targetXYZ)

	// Compute dot products with all four upward or rightward-facing edge
	// normals. dirIJ is the dot product for the edge corresponding to axis
	// I, endpoint J. For example, dir01 is the right edge of the Cell
	// (corresponding to the upper endpoint of the u-axis).
	dir00 := target.X - target.Z*c.uv.X.Lo
	dir01 := target.X - target.Z*c.uv.X.Hi
	dir10 := target.Y - target.Z*c.uv.Y.Lo
	dir11 := target.Y - target.Z*c.uv.Y.Hi
	inside := true
	if dir00 < 0 {
		inside = false // Target is to the left of the cell
		if c.vEdgeIsClosest(target, false) {
			return edgeDistance(-dir00, c.uv.X.Lo)
		}
	}
	if dir01 > 0 {
		inside = false // Target is to the right of the cell
		if c.vEdgeIsClosest(target, true) {
			return edgeDistance(dir01, c.uv.X.Hi)
		}
	}
	if dir10 < 0 {
		inside = false // Target is below the cell
		if c.uEdgeIsClosest(target, false) {
			return edgeDistance(-dir10, c.uv.Y.Lo)
		}
	}
	if dir11 > 0 {
		inside = false // Target is above the cell
		if c.uEdgeIsClosest(target, true) {
			return edgeDistance(dir11, c.uv.Y.Hi)
		}
	}
	if inside {
		if toInterior {
			return s1.ChordAngle(0)
		}
		// Although you might think of Cells as rectangles, they are actually
		// arbitrary quadrilaterals after they are projected onto the sphere.
		// Therefore the simplest approach is just to find the minimum distance to
		// any of the four edges.
		return minChordAngle(edgeDistance(-dir00, c.uv.X.Lo),
			edgeDistance(dir01, c.uv.X.Hi),
			edgeDistance(-dir10, c.uv.Y.Lo),
			edgeDistance(dir11, c.uv.Y.Hi))
	}

	// Otherwise, the closest point is one of the four cell vertices. Note that
	// it is *not* trivial to narrow down the candidates based on the edge sign
	// tests above, because (1) the edges don't meet at right angles and (2)
	// there are points on the far side of the sphere that are both above *and*
	// below the cell, etc.
	return minChordAngle(c.vertexChordDist2(target, false, false),
		c.vertexChordDist2(target, true, false),
		c.vertexChordDist2(target, false, true),
		c.vertexChordDist2(target, true, true))
}

// Distance reports the distance from the cell to the given point. Returns zero if
// the point is inside the cell.
func (c Cell) Distance(target Point) s1.ChordAngle {
	return c.distanceInternal(target, true)
}

// MaxDistance reports the maximum distance from the cell (including its interior) to the
// given point.
func (c Cell) MaxDistance(target Point) s1.ChordAngle {
	// First check the 4 cell vertices.  If all are within the hemisphere
	// centered around target, the max distance will be to one of these vertices.
	targetUVW := faceXYZtoUVW(int(c.face), target)
	maxDist := maxChordAngle(c.vertexChordDist2(targetUVW, false, false),
		c.vertexChordDist2(targetUVW, true, false),
		c.vertexChordDist2(targetUVW, false, true),
		c.vertexChordDist2(targetUVW, true, true))

	if maxDist <= s1.RightChordAngle {
		return maxDist
	}

	// Otherwise, find the minimum distance dMin to the antipodal point and the
	// maximum distance will be pi - dMin.
	return s1.StraightChordAngle - c.BoundaryDistance(Point{target.Mul(-1)})
}

// BoundaryDistance reports the distance from the cell boundary to the given point.
func (c Cell) BoundaryDistance(target Point) s1.ChordAngle {
	return c.distanceInternal(target, false)
}

// DistanceToEdge returns the minimum distance from the cell to the given edge AB. Returns
// zero if the edge intersects the cell interior.
func (c Cell) DistanceToEdge(a, b Point) s1.ChordAngle {
	// Possible optimizations:
	//  - Currently the (cell vertex, edge endpoint) distances are computed
	//    twice each, and the length of AB is computed 4 times.
	//  - To fix this, refactor GetDistance(target) so that it skips calculating
	//    the distance to each cell vertex. Instead, compute the cell vertices
	//    and distances in this function, and add a low-level UpdateMinDistance
	//    that allows the XA, XB, and AB distances to be passed in.
	//  - It might also be more efficient to do all calculations in UVW-space,
	//    since this would involve transforming 2 points rather than 4.

	// First, check the minimum distance to the edge endpoints A and B.
	// (This also detects whether either endpoint is inside the cell.)
	minDist := minChordAngle(c.Distance(a), c.Distance(b))
	if minDist == 0 {
		return minDist
	}

	// Otherwise, check whether the edge crosses the cell boundary.
	crosser := NewChainEdgeCrosser(a, b, c.Vertex(3))
	for i := 0; i < 4; i++ {
		if crosser.ChainCrossingSign(c.Vertex(i)) != DoNotCross {
			return 0
		}
	}

	// Finally, check whether the minimum distance occurs between a cell vertex
	// and the interior of the edge AB. (Some of this work is redundant, since
	// it also checks the distance to the endpoints A and B again.)
	//
	// Note that we don't need to check the distance from the interior of AB to
	// the interior of a cell edge, because the only way that this distance can
	// be minimal is if the two edges cross (already checked above).
	for i := 0; i < 4; i++ {
		minDist, _ = UpdateMinDistance(c.Vertex(i), a, b, minDist)
	}
	return minDist
}

// MaxDistanceToEdge returns the maximum distance from the cell (including its interior)
// to the given edge AB.
func (c Cell) MaxDistanceToEdge(a, b Point) s1.ChordAngle {
	// If the maximum distance from both endpoints to the cell is less than π/2
	// then the maximum distance from the edge to the cell is the maximum of the
	// two endpoint distances.
	maxDist := maxChordAngle(c.MaxDistance(a), c.MaxDistance(b))
	if maxDist <= s1.RightChordAngle {
		return maxDist
	}

	return s1.StraightChordAngle - c.DistanceToEdge(Point{a.Mul(-1)}, Point{b.Mul(-1)})
}

// DistanceToCell returns the minimum distance from this cell to the given cell.
// It returns zero if one cell contains the other.
func (c Cell) DistanceToCell(target Cell) s1.ChordAngle {
	// If the cells intersect, the distance is zero.  We use the (u,v) ranges
	// rather than CellID intersects so that cells that share a partial edge or
	// corner are considered to intersect.
	if c.face == target.face && c.uv.Intersects(target.uv) {
		return 0
	}

	// Otherwise, the minimum distance always occurs between a vertex of one
	// cell and an edge of the other cell (including the edge endpoints).  This
	// represents a total of 32 possible (vertex, edge) pairs.
	//
	// TODO(roberts): This could be optimized to be at least 5x faster by pruning
	// the set of possible closest vertex/edge pairs using the faces and (u,v)
	// ranges of both cells.
	var va, vb [4]Point
	for i := 0; i < 4; i++ {
		va[i] = c.Vertex(i)
		vb[i] = target.Vertex(i)
	}
	minDist := s1.InfChordAngle()
	for i := 0; i < 4; i++ {
		for j := 0; j < 4; j++ {
			minDist, _ = UpdateMinDistance(va[i], vb[j], vb[(j+1)&3], minDist)
			minDist, _ = UpdateMinDistance(vb[i], va[j], va[(j+1)&3], minDist)
		}
	}
	return minDist
}

// MaxDistanceToCell returns the maximum distance from the cell (including its
// interior) to the given target cell.
func (c Cell) MaxDistanceToCell(target Cell) s1.ChordAngle {
	// Need to check the antipodal target for intersection with the cell. If it
	// intersects, the distance is the straight ChordAngle.
	// antipodalUV is the transpose of the original UV, interpreted within the opposite face.
	antipodalUV := r2.Rect{target.uv.Y, target.uv.X}
	if int(c.face) == oppositeFace(int(target.face)) && c.uv.Intersects(antipodalUV) {
		return s1.StraightChordAngle
	}

	// Otherwise, the maximum distance always occurs between a vertex of one
	// cell and an edge of the other cell (including the edge endpoints).  This
	// represents a total of 32 possible (vertex, edge) pairs.
	//
	// TODO(roberts): When the maximum distance is at most π/2, the maximum is
	// always attained between a pair of vertices, and this could be made much
	// faster by testing each vertex pair once rather than the current 4 times.
	var va, vb [4]Point
	for i := 0; i < 4; i++ {
		va[i] = c.Vertex(i)
		vb[i] = target.Vertex(i)
	}
	maxDist := s1.NegativeChordAngle
	for i := 0; i < 4; i++ {
		for j := 0; j < 4; j++ {
			maxDist, _ = UpdateMaxDistance(va[i], vb[j], vb[(j+1)&3], maxDist)
			maxDist, _ = UpdateMaxDistance(vb[i], va[j], va[(j+1)&3], maxDist)
		}
	}
	return maxDist
}
