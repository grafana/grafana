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
	"math"

	"github.com/golang/geo/r3"
)

//
// This file contains documentation of the various coordinate systems used
// throughout the library. Most importantly, S2 defines a framework for
// decomposing the unit sphere into a hierarchy of "cells". Each cell is a
// quadrilateral bounded by four geodesics. The top level of the hierarchy is
// obtained by projecting the six faces of a cube onto the unit sphere, and
// lower levels are obtained by subdividing each cell into four children
// recursively. Cells are numbered such that sequentially increasing cells
// follow a continuous space-filling curve over the entire sphere. The
// transformation is designed to make the cells at each level fairly uniform
// in size.
//
////////////////////////// S2 Cell Decomposition /////////////////////////
//
// The following methods define the cube-to-sphere projection used by
// the Cell decomposition.
//
// In the process of converting a latitude-longitude pair to a 64-bit cell
// id, the following coordinate systems are used:
//
//  (id)
//    An CellID is a 64-bit encoding of a face and a Hilbert curve position
//    on that face. The Hilbert curve position implicitly encodes both the
//    position of a cell and its subdivision level (see s2cellid.go).
//
//  (face, i, j)
//    Leaf-cell coordinates. "i" and "j" are integers in the range
//    [0,(2**30)-1] that identify a particular leaf cell on the given face.
//    The (i, j) coordinate system is right-handed on each face, and the
//    faces are oriented such that Hilbert curves connect continuously from
//    one face to the next.
//
//  (face, s, t)
//    Cell-space coordinates. "s" and "t" are real numbers in the range
//    [0,1] that identify a point on the given face. For example, the point
//    (s, t) = (0.5, 0.5) corresponds to the center of the top-level face
//    cell. This point is also a vertex of exactly four cells at each
//    subdivision level greater than zero.
//
//  (face, si, ti)
//    Discrete cell-space coordinates. These are obtained by multiplying
//    "s" and "t" by 2**31 and rounding to the nearest unsigned integer.
//    Discrete coordinates lie in the range [0,2**31]. This coordinate
//    system can represent the edge and center positions of all cells with
//    no loss of precision (including non-leaf cells). In binary, each
//    coordinate of a level-k cell center ends with a 1 followed by
//    (30 - k) 0s. The coordinates of its edges end with (at least)
//    (31 - k) 0s.
//
//  (face, u, v)
//    Cube-space coordinates in the range [-1,1]. To make the cells at each
//    level more uniform in size after they are projected onto the sphere,
//    we apply a nonlinear transformation of the form u=f(s), v=f(t).
//    The (u, v) coordinates after this transformation give the actual
//    coordinates on the cube face (modulo some 90 degree rotations) before
//    it is projected onto the unit sphere.
//
//  (face, u, v, w)
//    Per-face coordinate frame. This is an extension of the (face, u, v)
//    cube-space coordinates that adds a third axis "w" in the direction of
//    the face normal. It is always a right-handed 3D coordinate system.
//    Cube-space coordinates can be converted to this frame by setting w=1,
//    while (u,v,w) coordinates can be projected onto the cube face by
//    dividing by w, i.e. (face, u/w, v/w).
//
//  (x, y, z)
//    Direction vector (Point). Direction vectors are not necessarily unit
//    length, and are often chosen to be points on the biunit cube
//    [-1,+1]x[-1,+1]x[-1,+1]. They can be be normalized to obtain the
//    corresponding point on the unit sphere.
//
//  (lat, lng)
//    Latitude and longitude (LatLng). Latitudes must be between -90 and
//    90 degrees inclusive, and longitudes must be between -180 and 180
//    degrees inclusive.
//
// Note that the (i, j), (s, t), (si, ti), and (u, v) coordinate systems are
// right-handed on all six faces.
//
//
// There are a number of different projections from cell-space (s,t) to
// cube-space (u,v): linear, quadratic, and tangent. They have the following
// tradeoffs:
//
//   Linear - This is the fastest transformation, but also produces the least
//   uniform cell sizes. Cell areas vary by a factor of about 5.2, with the
//   largest cells at the center of each face and the smallest cells in
//   the corners.
//
//   Tangent - Transforming the coordinates via Atan makes the cell sizes
//   more uniform. The areas vary by a maximum ratio of 1.4 as opposed to a
//   maximum ratio of 5.2. However, each call to Atan is about as expensive
//   as all of the other calculations combined when converting from points to
//   cell ids, i.e. it reduces performance by a factor of 3.
//
//   Quadratic - This is an approximation of the tangent projection that
//   is much faster and produces cells that are almost as uniform in size.
//   It is about 3 times faster than the tangent projection for converting
//   cell ids to points or vice versa. Cell areas vary by a maximum ratio of
//   about 2.1.
//
// Here is a table comparing the cell uniformity using each projection. Area
// Ratio is the maximum ratio over all subdivision levels of the largest cell
// area to the smallest cell area at that level, Edge Ratio is the maximum
// ratio of the longest edge of any cell to the shortest edge of any cell at
// the same level, and Diag Ratio is the ratio of the longest diagonal of
// any cell to the shortest diagonal of any cell at the same level.
//
//               Area    Edge    Diag
//              Ratio   Ratio   Ratio
// -----------------------------------
// Linear:      5.200   2.117   2.959
// Tangent:     1.414   1.414   1.704
// Quadratic:   2.082   1.802   1.932
//
// The worst-case cell aspect ratios are about the same with all three
// projections. The maximum ratio of the longest edge to the shortest edge
// within the same cell is about 1.4 and the maximum ratio of the diagonals
// within the same cell is about 1.7.
//
// For Go we have chosen to use only the Quadratic approach. Other language
// implementations may offer other choices.

const (
	// maxSiTi is the maximum value of an si- or ti-coordinate.
	// It is one shift more than maxSize. The range of valid (si,ti)
	// values is [0..maxSiTi].
	maxSiTi = maxSize << 1
)

// siTiToST converts an si- or ti-value to the corresponding s- or t-value.
// Value is capped at 1.0 because there is no DCHECK in Go.
func siTiToST(si uint32) float64 {
	if si > maxSiTi {
		return 1.0
	}
	return float64(si) / float64(maxSiTi)
}

// stToSiTi converts the s- or t-value to the nearest si- or ti-coordinate.
// The result may be outside the range of valid (si,ti)-values. Value of
// 0.49999999999999994 (math.NextAfter(0.5, -1)), will be incorrectly rounded up.
func stToSiTi(s float64) uint32 {
	if s < 0 {
		return uint32(s*maxSiTi - 0.5)
	}
	return uint32(s*maxSiTi + 0.5)
}

// stToUV converts an s or t value to the corresponding u or v value.
// This is a non-linear transformation from [-1,1] to [-1,1] that
// attempts to make the cell sizes more uniform.
// This uses what the C++ version calls 'the quadratic transform'.
func stToUV(s float64) float64 {
	if s >= 0.5 {
		return (1 / 3.) * (4*s*s - 1)
	}
	return (1 / 3.) * (1 - 4*(1-s)*(1-s))
}

// uvToST is the inverse of the stToUV transformation. Note that it
// is not always true that uvToST(stToUV(x)) == x due to numerical
// errors.
func uvToST(u float64) float64 {
	if u >= 0 {
		return 0.5 * math.Sqrt(1+3*u)
	}
	return 1 - 0.5*math.Sqrt(1-3*u)
}

// face returns face ID from 0 to 5 containing the r. For points on the
// boundary between faces, the result is arbitrary but deterministic.
func face(r r3.Vector) int {
	f := r.LargestComponent()
	switch {
	case f == r3.XAxis && r.X < 0:
		f += 3
	case f == r3.YAxis && r.Y < 0:
		f += 3
	case f == r3.ZAxis && r.Z < 0:
		f += 3
	}
	return int(f)
}

// validFaceXYZToUV given a valid face for the given point r (meaning that
// dot product of r with the face normal is positive), returns
// the corresponding u and v values, which may lie outside the range [-1,1].
func validFaceXYZToUV(face int, r r3.Vector) (float64, float64) {
	switch face {
	case 0:
		return r.Y / r.X, r.Z / r.X
	case 1:
		return -r.X / r.Y, r.Z / r.Y
	case 2:
		return -r.X / r.Z, -r.Y / r.Z
	case 3:
		return r.Z / r.X, r.Y / r.X
	case 4:
		return r.Z / r.Y, -r.X / r.Y
	}
	return -r.Y / r.Z, -r.X / r.Z
}

// xyzToFaceUV converts a direction vector (not necessarily unit length) to
// (face, u, v) coordinates.
func xyzToFaceUV(r r3.Vector) (f int, u, v float64) {
	f = face(r)
	u, v = validFaceXYZToUV(f, r)
	return f, u, v
}

// faceUVToXYZ turns face and UV coordinates into an unnormalized 3 vector.
func faceUVToXYZ(face int, u, v float64) r3.Vector {
	switch face {
	case 0:
		return r3.Vector{1, u, v}
	case 1:
		return r3.Vector{-u, 1, v}
	case 2:
		return r3.Vector{-u, -v, 1}
	case 3:
		return r3.Vector{-1, -v, -u}
	case 4:
		return r3.Vector{v, -1, -u}
	default:
		return r3.Vector{v, u, -1}
	}
}

// faceXYZToUV returns the u and v values (which may lie outside the range
// [-1, 1]) if the dot product of the point p with the given face normal is positive.
func faceXYZToUV(face int, p Point) (u, v float64, ok bool) {
	switch face {
	case 0:
		if p.X <= 0 {
			return 0, 0, false
		}
	case 1:
		if p.Y <= 0 {
			return 0, 0, false
		}
	case 2:
		if p.Z <= 0 {
			return 0, 0, false
		}
	case 3:
		if p.X >= 0 {
			return 0, 0, false
		}
	case 4:
		if p.Y >= 0 {
			return 0, 0, false
		}
	default:
		if p.Z >= 0 {
			return 0, 0, false
		}
	}

	u, v = validFaceXYZToUV(face, p.Vector)
	return u, v, true
}

// faceXYZtoUVW transforms the given point P to the (u,v,w) coordinate frame of the given
// face where the w-axis represents the face normal.
func faceXYZtoUVW(face int, p Point) Point {
	// The result coordinates are simply the dot products of P with the (u,v,w)
	// axes for the given face (see faceUVWAxes).
	switch face {
	case 0:
		return Point{r3.Vector{p.Y, p.Z, p.X}}
	case 1:
		return Point{r3.Vector{-p.X, p.Z, p.Y}}
	case 2:
		return Point{r3.Vector{-p.X, -p.Y, p.Z}}
	case 3:
		return Point{r3.Vector{-p.Z, -p.Y, -p.X}}
	case 4:
		return Point{r3.Vector{-p.Z, p.X, -p.Y}}
	default:
		return Point{r3.Vector{p.Y, p.X, -p.Z}}
	}
}

// faceSiTiToXYZ transforms the (si, ti) coordinates to a (not necessarily
// unit length) Point on the given face.
func faceSiTiToXYZ(face int, si, ti uint32) Point {
	return Point{faceUVToXYZ(face, stToUV(siTiToST(si)), stToUV(siTiToST(ti)))}
}

// xyzToFaceSiTi transforms the (not necessarily unit length) Point to
// (face, si, ti) coordinates and the level the Point is at.
func xyzToFaceSiTi(p Point) (face int, si, ti uint32, level int) {
	face, u, v := xyzToFaceUV(p.Vector)
	si = stToSiTi(uvToST(u))
	ti = stToSiTi(uvToST(v))

	// If the levels corresponding to si,ti are not equal, then p is not a cell
	// center. The si,ti values of 0 and maxSiTi need to be handled specially
	// because they do not correspond to cell centers at any valid level; they
	// are mapped to level -1 by the code at the end.
	level = maxLevel - findLSBSetNonZero64(uint64(si|maxSiTi))
	if level < 0 || level != maxLevel-findLSBSetNonZero64(uint64(ti|maxSiTi)) {
		return face, si, ti, -1
	}

	// In infinite precision, this test could be changed to ST == SiTi. However,
	// due to rounding errors, uvToST(xyzToFaceUV(faceUVToXYZ(stToUV(...)))) is
	// not idempotent. On the other hand, the center is computed exactly the same
	// way p was originally computed (if it is indeed the center of a Cell);
	// the comparison can be exact.
	if p.Vector == faceSiTiToXYZ(face, si, ti).Normalize() {
		return face, si, ti, level
	}

	return face, si, ti, -1
}

// uNorm returns the right-handed normal (not necessarily unit length) for an
// edge in the direction of the positive v-axis at the given u-value on
// the given face.  (This vector is perpendicular to the plane through
// the sphere origin that contains the given edge.)
func uNorm(face int, u float64) r3.Vector {
	switch face {
	case 0:
		return r3.Vector{u, -1, 0}
	case 1:
		return r3.Vector{1, u, 0}
	case 2:
		return r3.Vector{1, 0, u}
	case 3:
		return r3.Vector{-u, 0, 1}
	case 4:
		return r3.Vector{0, -u, 1}
	default:
		return r3.Vector{0, -1, -u}
	}
}

// vNorm returns the right-handed normal (not necessarily unit length) for an
// edge in the direction of the positive u-axis at the given v-value on
// the given face.
func vNorm(face int, v float64) r3.Vector {
	switch face {
	case 0:
		return r3.Vector{-v, 0, 1}
	case 1:
		return r3.Vector{0, -v, 1}
	case 2:
		return r3.Vector{0, -1, -v}
	case 3:
		return r3.Vector{v, -1, 0}
	case 4:
		return r3.Vector{1, v, 0}
	default:
		return r3.Vector{1, 0, v}
	}
}

// faceUVWAxes are the U, V, and W axes for each face.
var faceUVWAxes = [6][3]Point{
	{Point{r3.Vector{0, 1, 0}}, Point{r3.Vector{0, 0, 1}}, Point{r3.Vector{1, 0, 0}}},
	{Point{r3.Vector{-1, 0, 0}}, Point{r3.Vector{0, 0, 1}}, Point{r3.Vector{0, 1, 0}}},
	{Point{r3.Vector{-1, 0, 0}}, Point{r3.Vector{0, -1, 0}}, Point{r3.Vector{0, 0, 1}}},
	{Point{r3.Vector{0, 0, -1}}, Point{r3.Vector{0, -1, 0}}, Point{r3.Vector{-1, 0, 0}}},
	{Point{r3.Vector{0, 0, -1}}, Point{r3.Vector{1, 0, 0}}, Point{r3.Vector{0, -1, 0}}},
	{Point{r3.Vector{0, 1, 0}}, Point{r3.Vector{1, 0, 0}}, Point{r3.Vector{0, 0, -1}}},
}

// faceUVWFaces are the precomputed neighbors of each face.
var faceUVWFaces = [6][3][2]int{
	{{4, 1}, {5, 2}, {3, 0}},
	{{0, 3}, {5, 2}, {4, 1}},
	{{0, 3}, {1, 4}, {5, 2}},
	{{2, 5}, {1, 4}, {0, 3}},
	{{2, 5}, {3, 0}, {1, 4}},
	{{4, 1}, {3, 0}, {2, 5}},
}

// uvwAxis returns the given axis of the given face.
func uvwAxis(face, axis int) Point {
	return faceUVWAxes[face][axis]
}

// uvwFaces returns the face in the (u,v,w) coordinate system on the given axis
// in the given direction.
func uvwFace(face, axis, direction int) int {
	return faceUVWFaces[face][axis][direction]
}

// uAxis returns the u-axis for the given face.
func uAxis(face int) Point {
	return uvwAxis(face, 0)
}

// vAxis returns the v-axis for the given face.
func vAxis(face int) Point {
	return uvwAxis(face, 1)
}

// Return the unit-length normal for the given face.
func unitNorm(face int) Point {
	return uvwAxis(face, 2)
}
