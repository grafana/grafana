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
	"fmt"

	"github.com/blevesearch/geo/r3"
)

// matrix3x3 represents a traditional 3x3 matrix of floating point values.
// This is not a full fledged matrix. It only contains the pieces needed
// to satisfy the computations done within the s2 package.
type matrix3x3 [3][3]float64

// col returns the given column as a Point.
func (m *matrix3x3) col(col int) Point {
	return Point{r3.Vector{X: m[0][col], Y: m[1][col], Z: m[2][col]}}
}

// row returns the given row as a Point.
func (m *matrix3x3) row(row int) Point {
	return Point{r3.Vector{X: m[row][0], Y: m[row][1], Z: m[row][2]}}
}

// setCol sets the specified column to the value in the given Point.
func (m *matrix3x3) setCol(col int, p Point) *matrix3x3 {
	m[0][col] = p.X
	m[1][col] = p.Y
	m[2][col] = p.Z

	return m
}

// setRow sets the specified row to the value in the given Point.
func (m *matrix3x3) setRow(row int, p Point) *matrix3x3 {
	m[row][0] = p.X
	m[row][1] = p.Y
	m[row][2] = p.Z

	return m
}

// scale multiplies the matrix by the given value.
func (m *matrix3x3) scale(f float64) *matrix3x3 {
	return &matrix3x3{
		[3]float64{f * m[0][0], f * m[0][1], f * m[0][2]},
		[3]float64{f * m[1][0], f * m[1][1], f * m[1][2]},
		[3]float64{f * m[2][0], f * m[2][1], f * m[2][2]},
	}
}

// mul returns the multiplication of m by the Point p and converts the
// resulting 1x3 matrix into a Point.
func (m *matrix3x3) mul(p Point) Point {
	return Point{r3.Vector{
		X: float64(m[0][0]*p.X) + float64(m[0][1]*p.Y) + float64(m[0][2]*p.Z),
		Y: float64(m[1][0]*p.X) + float64(m[1][1]*p.Y) + float64(m[1][2]*p.Z),
		Z: float64(m[2][0]*p.X) + float64(m[2][1]*p.Y) + float64(m[2][2]*p.Z),
	}}
}

// det returns the determinant of this matrix.
func (m *matrix3x3) det() float64 {
	//      | a  b  c |
	//  det | d  e  f | = aei + bfg + cdh - ceg - bdi - afh
	//      | g  h  i |
	return float64(m[0][0]*m[1][1]*m[2][2]) + float64(m[0][1]*m[1][2]*m[2][0]) +
		float64(m[0][2]*m[1][0]*m[2][1]) - float64(m[0][2]*m[1][1]*m[2][0]) -
		float64(m[0][1]*m[1][0]*m[2][2]) - float64(m[0][0]*m[1][2]*m[2][1])
}

// transpose reflects the matrix along its diagonal and returns the result.
func (m *matrix3x3) transpose() *matrix3x3 {
	m[0][1], m[1][0] = m[1][0], m[0][1]
	m[0][2], m[2][0] = m[2][0], m[0][2]
	m[1][2], m[2][1] = m[2][1], m[1][2]

	return m
}

// String formats the matrix into an easier to read layout.
func (m *matrix3x3) String() string {
	return fmt.Sprintf("[ %0.4f %0.4f %0.4f ] [ %0.4f %0.4f %0.4f ] [ %0.4f %0.4f %0.4f ]",
		m[0][0], m[0][1], m[0][2],
		m[1][0], m[1][1], m[1][2],
		m[2][0], m[2][1], m[2][2],
	)
}

// getFrame returns the orthonormal frame for the given point on the unit sphere.
func getFrame(p Point) matrix3x3 {
	// Given the point p on the unit sphere, extend this into a right-handed
	// coordinate frame of unit-length column vectors m = (x,y,z).  Note that
	// the vectors (x,y) are an orthonormal frame for the tangent space at point p,
	// while p itself is an orthonormal frame for the normal space at p.
	m := matrix3x3{}
	m.setCol(2, p)
	m.setCol(1, Ortho(p))
	m.setCol(0, Point{m.col(1).Cross(p.Vector)})
	return m
}

// toFrame returns the coordinates of the given point with respect to its orthonormal basis m.
// The resulting point q satisfies the identity (m * q == p).
func toFrame(m matrix3x3, p Point) Point {
	// The inverse of an orthonormal matrix is its transpose.
	return m.transpose().mul(p)
}

// fromFrame returns the coordinates of the given point in standard axis-aligned basis
// from its orthonormal basis m.
// The resulting point p satisfies the identity (p == m * q).
func fromFrame(m matrix3x3, q Point) Point {
	return m.mul(q)
}
