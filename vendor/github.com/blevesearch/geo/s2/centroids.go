// Copyright 2018 Google Inc. All rights reserved.
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

// There are several notions of the "centroid" of a triangle. First, there
// is the planar centroid, which is simply the centroid of the ordinary
// (non-spherical) triangle defined by the three vertices. Second, there is
// the surface centroid, which is defined as the intersection of the three
// medians of the spherical triangle. It is possible to show that this
// point is simply the planar centroid projected to the surface of the
// sphere. Finally, there is the true centroid (mass centroid), which is
// defined as the surface integral over the spherical triangle of (x,y,z)
// divided by the triangle area. This is the point that the triangle would
// rotate around if it was spinning in empty space.
//
// The best centroid for most purposes is the true centroid. Unlike the
// planar and surface centroids, the true centroid behaves linearly as
// regions are added or subtracted. That is, if you split a triangle into
// pieces and compute the average of their centroids (weighted by triangle
// area), the result equals the centroid of the original triangle. This is
// not true of the other centroids.
//
// Also note that the surface centroid may be nowhere near the intuitive
// "center" of a spherical triangle. For example, consider the triangle
// with vertices A=(1,eps,0), B=(0,0,1), C=(-1,eps,0) (a quarter-sphere).
// The surface centroid of this triangle is at S=(0, 2*eps, 1), which is
// within a distance of 2*eps of the vertex B. Note that the median from A
// (the segment connecting A to the midpoint of BC) passes through S, since
// this is the shortest path connecting the two endpoints. On the other
// hand, the true centroid is at M=(0, 0.5, 0.5), which when projected onto
// the surface is a much more reasonable interpretation of the "center" of
// this triangle.
//

// TrueCentroid returns the true centroid of the spherical triangle ABC
// multiplied by the signed area of spherical triangle ABC. The reasons for
// multiplying by the signed area are (1) this is the quantity that needs to be
// summed to compute the centroid of a union or difference of triangles, and
// (2) it's actually easier to calculate this way. All points must have unit length.
//
// Note that the result of this function is defined to be Point(0, 0, 0) if
// the triangle is degenerate.
func TrueCentroid(a, b, c Point) Point {
	// Use Distance to get accurate results for small triangles.
	ra := float64(1)
	if sa := float64(b.Distance(c)); sa != 0 {
		ra = sa / math.Sin(sa)
	}
	rb := float64(1)
	if sb := float64(c.Distance(a)); sb != 0 {
		rb = sb / math.Sin(sb)
	}
	rc := float64(1)
	if sc := float64(a.Distance(b)); sc != 0 {
		rc = sc / math.Sin(sc)
	}

	// Now compute a point M such that:
	//
	//  [Ax Ay Az] [Mx]                       [ra]
	//  [Bx By Bz] [My]  = 0.5 * det(A,B,C) * [rb]
	//  [Cx Cy Cz] [Mz]                       [rc]
	//
	// To improve the numerical stability we subtract the first row (A) from the
	// other two rows; this reduces the cancellation error when A, B, and C are
	// very close together. Then we solve it using Cramer's rule.
	//
	// The result is the true centroid of the triangle multiplied by the
	// triangle's area.
	//
	// This code still isn't as numerically stable as it could be.
	// The biggest potential improvement is to compute B-A and C-A more
	// accurately so that (B-A)x(C-A) is always inside triangle ABC.
	x := r3.Vector{a.X, b.X - a.X, c.X - a.X}
	y := r3.Vector{a.Y, b.Y - a.Y, c.Y - a.Y}
	z := r3.Vector{a.Z, b.Z - a.Z, c.Z - a.Z}
	r := r3.Vector{ra, rb - ra, rc - ra}

	return Point{r3.Vector{y.Cross(z).Dot(r), z.Cross(x).Dot(r), x.Cross(y).Dot(r)}.Mul(0.5)}
}

// EdgeTrueCentroid returns the true centroid of the spherical geodesic edge AB
// multiplied by the length of the edge AB. As with triangles, the true centroid
// of a collection of line segments may be computed simply by summing the result
// of this method for each segment.
//
// Note that the planar centroid of a line segment is simply 0.5 * (a + b),
// while the surface centroid is (a + b).Normalize(). However neither of
// these values is appropriate for computing the centroid of a collection of
// edges (such as a polyline).
//
// Also note that the result of this function is defined to be Point(0, 0, 0)
// if the edge is degenerate.
func EdgeTrueCentroid(a, b Point) Point {
	// The centroid (multiplied by length) is a vector toward the midpoint
	// of the edge, whose length is twice the sine of half the angle between
	// the two vertices. Defining theta to be this angle, we have:
	vDiff := a.Sub(b.Vector) // Length == 2*sin(theta)
	vSum := a.Add(b.Vector)  // Length == 2*cos(theta)
	sin2 := vDiff.Norm2()
	cos2 := vSum.Norm2()
	if cos2 == 0 {
		return Point{} // Ignore antipodal edges.
	}
	return Point{vSum.Mul(math.Sqrt(sin2 / cos2))} // Length == 2*sin(theta)
}

// PlanarCentroid returns the centroid of the planar triangle ABC. This can be
// normalized to unit length to obtain the "surface centroid" of the corresponding
// spherical triangle, i.e. the intersection of the three medians. However, note
// that for large spherical triangles the surface centroid may be nowhere near
// the intuitive "center".
func PlanarCentroid(a, b, c Point) Point {
	return Point{a.Add(b.Vector).Add(c.Vector).Mul(1. / 3)}
}
