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
	"github.com/golang/geo/r2"
	"github.com/golang/geo/s1"
)

// Tessellation is implemented by subdividing the edge until the estimated
// maximum error is below the given tolerance. Estimating error is a hard
// problem, especially when the only methods available are point evaluation of
// the projection and its inverse. (These are the only methods that
// Projection provides, which makes it easier and less error-prone to
// implement new projections.)
//
// One technique that significantly increases robustness is to treat the
// geodesic and projected edges as parametric curves rather than geometric ones.
// Given a spherical edge AB and a projection p:S2->R2, let f(t) be the
// normalized arc length parametrization of AB and let g(t) be the normalized
// arc length parameterization of the projected edge p(A)p(B). (In other words,
// f(0)=A, f(1)=B, g(0)=p(A), g(1)=p(B).)  We now define the geometric error as
// the maximum distance from the point p^-1(g(t)) to the geodesic edge AB for
// any t in [0,1], where p^-1 denotes the inverse projection. In other words,
// the geometric error is the maximum distance from any point on the projected
// edge (mapped back onto the sphere) to the geodesic edge AB. On the other
// hand we define the parametric error as the maximum distance between the
// points f(t) and p^-1(g(t)) for any t in [0,1], i.e. the maximum distance
// (measured on the sphere) between the geodesic and projected points at the
// same interpolation fraction t.
//
// The easiest way to estimate the parametric error is to simply evaluate both
// edges at their midpoints and measure the distance between them (the "midpoint
// method"). This is very fast and works quite well for most edges, however it
// has one major drawback: it doesn't handle points of inflection (i.e., points
// where the curvature changes sign). For example, edges in the Mercator and
// Plate Carree projections always curve towards the equator relative to the
// corresponding geodesic edge, so in these projections there is a point of
// inflection whenever the projected edge crosses the equator. The worst case
// occurs when the edge endpoints have different longitudes but the same
// absolute latitude, since in that case the error is non-zero but the edges
// have exactly the same midpoint (on the equator).
//
// One solution to this problem is to split the input edges at all inflection
// points (i.e., along the equator in the case of the Mercator and Plate Carree
// projections). However for general projections these inflection points can
// occur anywhere on the sphere (e.g., consider the Transverse Mercator
// projection). This could be addressed by adding methods to the S2Projection
// interface to split edges at inflection points but this would make it harder
// and more error-prone to implement new projections.
//
// Another problem with this approach is that the midpoint method sometimes
// underestimates the true error even when edges do not cross the equator.
// For the Plate Carree and Mercator projections, the midpoint method can
// underestimate the error by up to 3%.
//
// Both of these problems can be solved as follows. We assume that the error
// can be modeled as a convex combination of two worst-case functions, one
// where the error is maximized at the edge midpoint and another where the
// error is *minimized* (i.e., zero) at the edge midpoint. For example, we
// could choose these functions as:
//
//    E1(x) = 1 - x^2
//    E2(x) = x * (1 - x^2)
//
// where for convenience we use an interpolation parameter "x" in the range
// [-1, 1] rather than the original "t" in the range [0, 1]. Note that both
// error functions must have roots at x = {-1, 1} since the error must be zero
// at the edge endpoints. E1 is simply a parabola whose maximum value is 1
// attained at x = 0, while E2 is a cubic with an additional root at x = 0,
// and whose maximum value is 2 * sqrt(3) / 9 attained at x = 1 / sqrt(3).
//
// Next, it is convenient to scale these functions so that the both have a
// maximum value of 1. E1 already satisfies this requirement, and we simply
// redefine E2 as
//
//   E2(x) = x * (1 - x^2) / (2 * sqrt(3) / 9)
//
// Now define x0 to be the point where these two functions intersect, i.e. the
// point in the range (-1, 1) where E1(x0) = E2(x0). This value has the very
// convenient property that if we evaluate the actual error E(x0), then the
// maximum error on the entire interval [-1, 1] is bounded by
//
//   E(x) <= E(x0) / E1(x0)
//
// since whether the error is modeled using E1 or E2, the resulting function
// has the same maximum value (namely E(x0) / E1(x0)). If it is modeled as
// some other convex combination of E1 and E2, the maximum value can only
// decrease.
//
// Finally, since E2 is not symmetric about the y-axis, we must also allow for
// the possibility that the error is a convex combination of E1 and -E2. This
// can be handled by evaluating the error at E(-x0) as well, and then
// computing the final error bound as
//
//   E(x) <= max(E(x0), E(-x0)) / E1(x0) .
//
// Effectively, this method is simply evaluating the error at two points about
// 1/3 and 2/3 of the way along the edges, and then scaling the maximum of
// these two errors by a constant factor. Intuitively, the reason this works
// is that if the two edges cross somewhere in the interior, then at least one
// of these points will be far from the crossing.
//
// The actual algorithm implemented below has some additional refinements.
// First, edges longer than 90 degrees are always subdivided; this avoids
// various unusual situations that can happen with very long edges, and there
// is really no reason to avoid adding vertices to edges that are so long.
//
// Second, the error function E1 above needs to be modified to take into
// account spherical distortions. (It turns out that spherical distortions are
// beneficial in the case of E2, i.e. they only make its error estimates
// slightly more conservative.)  To do this, we model E1 as the maximum error
// in a Plate Carree edge of length 90 degrees or less. This turns out to be
// an edge from 45:-90 to 45:90 (in lat:lng format). The corresponding error
// as a function of "x" in the range [-1, 1] can be computed as the distance
// between the Plate Caree edge point (45, 90 * x) and the geodesic
// edge point (90 - 45 * abs(x), 90 * sgn(x)). Using the Haversine formula,
// the corresponding function E1 (normalized to have a maximum value of 1) is:
//
//   E1(x) =
//     asin(sqrt(sin(Pi / 8 * (1 - x)) ^ 2 +
//               sin(Pi / 4 * (1 - x)) ^ 2 * cos(Pi / 4) * sin(Pi / 4 * x))) /
//     asin(sqrt((1 - 1 / sqrt(2)) / 2))
//
// Note that this function does not need to be evaluated at runtime, it
// simply affects the calculation of the value x0 where E1(x0) = E2(x0)
// and the corresponding scaling factor C = 1 / E1(x0).
//
// ------------------------------------------------------------------
//
// In the case of the Mercator and Plate Carree projections this strategy
// produces a conservative upper bound (verified using 10 million random
// edges). Furthermore the bound is nearly tight; the scaling constant is
// C = 1.19289, whereas the maximum observed value was 1.19254.
//
// Compared to the simpler midpoint evaluation method, this strategy requires
// more function evaluations (currently twice as many, but with a smarter
// tessellation algorithm it will only be 50% more). It also results in a
// small amount of additional tessellation (about 1.5%) compared to the
// midpoint method, but this is due almost entirely to the fact that the
// midpoint method does not yield conservative error estimates.
//
// For random edges with a tolerance of 1 meter, the expected amount of
// overtessellation is as follows:
//
//                   Midpoint Method    Cubic Method
//   Plate Carree               1.8%            3.0%
//   Mercator                  15.8%           17.4%

const (
	// tessellationInterpolationFraction is the fraction at which the two edges
	// are evaluated in order to measure the error between them. (Edges are
	// evaluated at two points measured this fraction from either end.)
	tessellationInterpolationFraction = 0.31215691082248312
	tessellationScaleFactor           = 0.83829992569888509

	// minTessellationTolerance is the minimum supported tolerance (which
	// corresponds to a distance less than 1 micrometer on the Earth's
	// surface, but is still much larger than the expected projection and
	// interpolation errors).
	minTessellationTolerance s1.Angle = 1e-13
)

// EdgeTessellator converts an edge in a given projection (e.g., Mercator) into
// a chain of spherical geodesic edges such that the maximum distance between
// the original edge and the geodesic edge chain is at most the requested
// tolerance. Similarly, it can convert a spherical geodesic edge into a chain
// of edges in a given 2D projection such that the maximum distance between the
// geodesic edge and the chain of projected edges is at most the requested tolerance.
//
//   Method      | Input                  | Output
//   ------------|------------------------|-----------------------
//   Projected   | S2 geodesics           | Planar projected edges
//   Unprojected | Planar projected edges | S2 geodesics
type EdgeTessellator struct {
	projection Projection

	// The given tolerance scaled by a constant fraction so that it can be
	// compared against the result returned by estimateMaxError.
	scaledTolerance s1.ChordAngle
}

// NewEdgeTessellator creates a new edge tessellator for the given projection and tolerance.
func NewEdgeTessellator(p Projection, tolerance s1.Angle) *EdgeTessellator {
	return &EdgeTessellator{
		projection:      p,
		scaledTolerance: s1.ChordAngleFromAngle(maxAngle(tolerance, minTessellationTolerance)),
	}
}

// AppendProjected converts the spherical geodesic edge AB to a chain of planar edges
// in the given projection and returns the corresponding vertices.
//
// If the given projection has one or more coordinate axes that wrap, then
// every vertex's coordinates will be as close as possible to the previous
// vertex's coordinates. Note that this may yield vertices whose
// coordinates are outside the usual range. For example, tessellating the
// edge (0:170, 0:-170) (in lat:lng notation) yields (0:170, 0:190).
func (e *EdgeTessellator) AppendProjected(a, b Point, vertices []r2.Point) []r2.Point {
	pa := e.projection.Project(a)
	if len(vertices) == 0 {
		vertices = []r2.Point{pa}
	} else {
		pa = e.projection.WrapDestination(vertices[len(vertices)-1], pa)
	}

	pb := e.projection.Project(b)
	return e.appendProjected(pa, a, pb, b, vertices)
}

// appendProjected splits a geodesic edge AB as necessary and returns the
// projected vertices appended to the given vertices.
//
// The maximum recursion depth is (math.Pi / minTessellationTolerance) < 45
func (e *EdgeTessellator) appendProjected(pa r2.Point, a Point, pbIn r2.Point, b Point, vertices []r2.Point) []r2.Point {
	pb := e.projection.WrapDestination(pa, pbIn)
	if e.estimateMaxError(pa, a, pb, b) <= e.scaledTolerance {
		return append(vertices, pb)
	}

	mid := Point{a.Add(b.Vector).Normalize()}
	pmid := e.projection.WrapDestination(pa, e.projection.Project(mid))
	vertices = e.appendProjected(pa, a, pmid, mid, vertices)
	return e.appendProjected(pmid, mid, pb, b, vertices)
}

// AppendUnprojected converts the planar edge AB in the given projection to a chain of
// spherical geodesic edges and returns the vertices.
//
// Note that to construct a Loop, you must eliminate the duplicate first and last
// vertex. Note also that if the given projection involves coordinate wrapping
// (e.g. across the 180 degree meridian) then the first and last vertices may not
// be exactly the same.
func (e *EdgeTessellator) AppendUnprojected(pa, pb r2.Point, vertices []Point) []Point {
	a := e.projection.Unproject(pa)
	b := e.projection.Unproject(pb)

	if len(vertices) == 0 {
		vertices = []Point{a}
	}

	// Note that coordinate wrapping can create a small amount of error. For
	// example in the edge chain "0:-175, 0:179, 0:-177", the first edge is
	// transformed into "0:-175, 0:-181" while the second is transformed into
	// "0:179, 0:183". The two coordinate pairs for the middle vertex
	// ("0:-181" and "0:179") may not yield exactly the same S2Point.
	return e.appendUnprojected(pa, a, pb, b, vertices)
}

// appendUnprojected interpolates a projected edge and appends the corresponding
// points on the sphere.
func (e *EdgeTessellator) appendUnprojected(pa r2.Point, a Point, pbIn r2.Point, b Point, vertices []Point) []Point {
	pb := e.projection.WrapDestination(pa, pbIn)
	if e.estimateMaxError(pa, a, pb, b) <= e.scaledTolerance {
		return append(vertices, b)
	}

	pmid := e.projection.Interpolate(0.5, pa, pb)
	mid := e.projection.Unproject(pmid)

	vertices = e.appendUnprojected(pa, a, pmid, mid, vertices)
	return e.appendUnprojected(pmid, mid, pb, b, vertices)
}

func (e *EdgeTessellator) estimateMaxError(pa r2.Point, a Point, pb r2.Point, b Point) s1.ChordAngle {
	// See the algorithm description at the top of this file.
	// We always tessellate edges longer than 90 degrees on the sphere, since the
	// approximation below is not robust enough to handle such edges.
	if a.Dot(b.Vector) < -1e-14 {
		return s1.InfChordAngle()
	}
	t1 := tessellationInterpolationFraction
	t2 := 1 - tessellationInterpolationFraction
	mid1 := Interpolate(t1, a, b)
	mid2 := Interpolate(t2, a, b)
	pmid1 := e.projection.Unproject(e.projection.Interpolate(t1, pa, pb))
	pmid2 := e.projection.Unproject(e.projection.Interpolate(t2, pa, pb))
	return maxChordAngle(ChordAngleBetweenPoints(mid1, pmid1), ChordAngleBetweenPoints(mid2, pmid2))
}
