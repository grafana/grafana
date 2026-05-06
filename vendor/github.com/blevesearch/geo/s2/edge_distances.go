// Copyright 2017 Google Inc. All rights reserved.
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

// This file defines a collection of methods for computing the distance to an edge,
// interpolating along an edge, projecting points onto edges, etc.

import (
	"math"

	"github.com/golang/geo/s1"
)

// DistanceFromSegment returns the distance of point X from line segment AB.
// The points are expected to be normalized. The result is very accurate for small
// distances but may have some numerical error if the distance is large
// (approximately pi/2 or greater). The case A == B is handled correctly.
func DistanceFromSegment(x, a, b Point) s1.Angle {
	var minDist s1.ChordAngle
	minDist, _ = updateMinDistance(x, a, b, minDist, true)
	return minDist.Angle()
}

// IsDistanceLess reports whether the distance from X to the edge AB is less
// than limit. (For less than or equal to, specify limit.Successor()).
// This method is faster than DistanceFromSegment(). If you want to
// compare against a fixed s1.Angle, you should convert it to an s1.ChordAngle
// once and save the value, since this conversion is relatively expensive.
func IsDistanceLess(x, a, b Point, limit s1.ChordAngle) bool {
	_, less := UpdateMinDistance(x, a, b, limit)
	return less
}

// UpdateMinDistance checks if the distance from X to the edge AB is less
// than minDist, and if so, returns the updated value and true.
// The case A == B is handled correctly.
//
// Use this method when you want to compute many distances and keep track of
// the minimum. It is significantly faster than using DistanceFromSegment
// because (1) using s1.ChordAngle is much faster than s1.Angle, and (2) it
// can save a lot of work by not actually computing the distance when it is
// obviously larger than the current minimum.
func UpdateMinDistance(x, a, b Point, minDist s1.ChordAngle) (s1.ChordAngle, bool) {
	return updateMinDistance(x, a, b, minDist, false)
}

// UpdateMaxDistance checks if the distance from X to the edge AB is greater
// than maxDist, and if so, returns the updated value and true.
// Otherwise it returns false. The case A == B is handled correctly.
func UpdateMaxDistance(x, a, b Point, maxDist s1.ChordAngle) (s1.ChordAngle, bool) {
	dist := maxChordAngle(ChordAngleBetweenPoints(x, a), ChordAngleBetweenPoints(x, b))
	if dist > s1.RightChordAngle {
		dist, _ = updateMinDistance(Point{x.Mul(-1)}, a, b, dist, true)
		dist = s1.StraightChordAngle - dist
	}
	if maxDist < dist {
		return dist, true
	}

	return maxDist, false
}

// IsInteriorDistanceLess reports whether the minimum distance from X to the edge
// AB is attained at an interior point of AB (i.e., not an endpoint), and that
// distance is less than limit. (Specify limit.Successor() for less than or equal to).
func IsInteriorDistanceLess(x, a, b Point, limit s1.ChordAngle) bool {
	_, less := UpdateMinInteriorDistance(x, a, b, limit)
	return less
}

// UpdateMinInteriorDistance reports whether the minimum distance from X to AB
// is attained at an interior point of AB (i.e., not an endpoint), and that distance
// is less than minDist. If so, the value of minDist is updated and true is returned.
// Otherwise it is unchanged and returns false.
func UpdateMinInteriorDistance(x, a, b Point, minDist s1.ChordAngle) (s1.ChordAngle, bool) {
	return interiorDist(x, a, b, minDist, false)
}

// Project returns the point along the edge AB that is closest to the point X.
// The fractional distance of this point along the edge AB can be obtained
// using DistanceFraction.
//
// This requires that all points are unit length.
func Project(x, a, b Point) Point {
	aXb := a.PointCross(b)
	// Find the closest point to X along the great circle through AB.
	p := x.Sub(aXb.Mul(x.Dot(aXb.Vector) / aXb.Vector.Norm2()))

	// If this point is on the edge AB, then it's the closest point.
	if Sign(aXb, a, Point{p}) && Sign(Point{p}, b, aXb) {
		return Point{p.Normalize()}
	}

	// Otherwise, the closest point is either A or B.
	if x.Sub(a.Vector).Norm2() <= x.Sub(b.Vector).Norm2() {
		return a
	}
	return b
}

// DistanceFraction returns the distance ratio of the point X along an edge AB.
// If X is on the line segment AB, this is the fraction T such
// that X == Interpolate(T, A, B).
//
// This requires that A and B are distinct.
func DistanceFraction(x, a, b Point) float64 {
	d0 := x.Angle(a.Vector)
	d1 := x.Angle(b.Vector)
	return float64(d0 / (d0 + d1))
}

// Interpolate returns the point X along the line segment AB whose distance from A
// is the given fraction "t" of the distance AB. Does NOT require that "t" be
// between 0 and 1. Note that all distances are measured on the surface of
// the sphere, so this is more complicated than just computing (1-t)*a + t*b
// and normalizing the result.
func Interpolate(t float64, a, b Point) Point {
	if t == 0 {
		return a
	}
	if t == 1 {
		return b
	}
	ab := a.Angle(b.Vector)
	return InterpolateAtDistance(s1.Angle(t)*ab, a, b)
}

// InterpolateAtDistance returns the point X along the line segment AB whose
// distance from A is the angle ax.
func InterpolateAtDistance(ax s1.Angle, a, b Point) Point {
	aRad := ax.Radians()

	// Use PointCross to compute the tangent vector at A towards B. The
	// result is always perpendicular to A, even if A=B or A=-B, but it is not
	// necessarily unit length. (We effectively normalize it below.)
	normal := a.PointCross(b)
	tangent := normal.Vector.Cross(a.Vector)

	// Now compute the appropriate linear combination of A and "tangent". With
	// infinite precision the result would always be unit length, but we
	// normalize it anyway to ensure that the error is within acceptable bounds.
	// (Otherwise errors can build up when the result of one interpolation is
	// fed into another interpolation.)
	return Point{(a.Mul(math.Cos(aRad)).Add(tangent.Mul(math.Sin(aRad) / tangent.Norm()))).Normalize()}
}

// minUpdateDistanceMaxError returns the maximum error in the result of
// UpdateMinDistance (and the associated functions such as
// UpdateMinInteriorDistance, IsDistanceLess, etc), assuming that all
// input points are normalized to within the bounds guaranteed by r3.Vector's
// Normalize. The error can be added or subtracted from an s1.ChordAngle
// using its Expanded method.
func minUpdateDistanceMaxError(dist s1.ChordAngle) float64 {
	// There are two cases for the maximum error in UpdateMinDistance(),
	// depending on whether the closest point is interior to the edge.
	return math.Max(minUpdateInteriorDistanceMaxError(dist), dist.MaxPointError())
}

// minUpdateInteriorDistanceMaxError returns the maximum error in the result of
// UpdateMinInteriorDistance, assuming that all input points are normalized
// to within the bounds guaranteed by Point's Normalize. The error can be added
// or subtracted from an s1.ChordAngle using its Expanded method.
//
// Note that accuracy goes down as the distance approaches 0 degrees or 180
// degrees (for different reasons). Near 0 degrees the error is acceptable
// for all practical purposes (about 1.2e-15 radians ~= 8 nanometers).  For
// exactly antipodal points the maximum error is quite high (0.5 meters),
// but this error drops rapidly as the points move away from antipodality
// (approximately 1 millimeter for points that are 50 meters from antipodal,
// and 1 micrometer for points that are 50km from antipodal).
//
// TODO(roberts): Currently the error bound does not hold for edges whose endpoints
// are antipodal to within about 1e-15 radians (less than 1 micron). This could
// be fixed by extending PointCross to use higher precision when necessary.
func minUpdateInteriorDistanceMaxError(dist s1.ChordAngle) float64 {
	// If a point is more than 90 degrees from an edge, then the minimum
	// distance is always to one of the endpoints, not to the edge interior.
	if dist >= s1.RightChordAngle {
		return 0.0
	}

	// This bound includes all source of error, assuming that the input points
	// are normalized. a and b are components of chord length that are
	// perpendicular and parallel to a plane containing the edge respectively.
	b := math.Min(1.0, 0.5*float64(dist))
	a := math.Sqrt(b * (2 - b))
	return ((2.5+2*math.Sqrt(3)+8.5*a)*a +
		(2+2*math.Sqrt(3)/3+6.5*(1-b))*b +
		(23+16/math.Sqrt(3))*dblEpsilon) * dblEpsilon
}

// updateMinDistance computes the distance from a point X to a line segment AB,
// and if either the distance was less than the given minDist, or alwaysUpdate is
// true, the value and whether it was updated are returned.
func updateMinDistance(x, a, b Point, minDist s1.ChordAngle, alwaysUpdate bool) (s1.ChordAngle, bool) {
	if d, ok := interiorDist(x, a, b, minDist, alwaysUpdate); ok {
		// Minimum distance is attained along the edge interior.
		return d, true
	}

	// Otherwise the minimum distance is to one of the endpoints.
	xa2, xb2 := (x.Sub(a.Vector)).Norm2(), x.Sub(b.Vector).Norm2()
	dist := s1.ChordAngle(math.Min(xa2, xb2))
	if !alwaysUpdate && dist >= minDist {
		return minDist, false
	}
	return dist, true
}

// interiorDist returns the shortest distance from point x to edge ab, assuming
// that the closest point to X is interior to AB. If the closest point is not
// interior to AB, interiorDist returns (minDist, false). If alwaysUpdate is set to
// false, the distance is only updated when the value exceeds certain the given minDist.
func interiorDist(x, a, b Point, minDist s1.ChordAngle, alwaysUpdate bool) (s1.ChordAngle, bool) {
	// Chord distance of x to both end points a and b.
	xa2, xb2 := (x.Sub(a.Vector)).Norm2(), x.Sub(b.Vector).Norm2()

	// The closest point on AB could either be one of the two vertices (the
	// vertex case) or in the interior (the interior case). Let C = A x B.
	// If X is in the spherical wedge extending from A to B around the axis
	// through C, then we are in the interior case. Otherwise we are in the
	// vertex case.
	//
	// Check whether we might be in the interior case. For this to be true, XAB
	// and XBA must both be acute angles. Checking this condition exactly is
	// expensive, so instead we consider the planar triangle ABX (which passes
	// through the sphere's interior). The planar angles XAB and XBA are always
	// less than the corresponding spherical angles, so if we are in the
	// interior case then both of these angles must be acute.
	//
	// We check this by computing the squared edge lengths of the planar
	// triangle ABX, and testing whether angles XAB and XBA are both acute using
	// the law of cosines:
	//
	//            | XA^2 - XB^2 | < AB^2      (*)
	//
	// This test must be done conservatively (taking numerical errors into
	// account) since otherwise we might miss a situation where the true minimum
	// distance is achieved by a point on the edge interior.
	//
	// There are two sources of error in the expression above (*).  The first is
	// that points are not normalized exactly; they are only guaranteed to be
	// within 2 * dblEpsilon of unit length.  Under the assumption that the two
	// sides of (*) are nearly equal, the total error due to normalization errors
	// can be shown to be at most
	//
	//        2 * dblEpsilon * (XA^2 + XB^2 + AB^2) + 8 * dblEpsilon ^ 2 .
	//
	// The other source of error is rounding of results in the calculation of (*).
	// Each of XA^2, XB^2, AB^2 has a maximum relative error of 2.5 * dblEpsilon,
	// plus an additional relative error of 0.5 * dblEpsilon in the final
	// subtraction which we further bound as 0.25 * dblEpsilon * (XA^2 + XB^2 +
	// AB^2) for convenience.  This yields a final error bound of
	//
	//        4.75 * dblEpsilon * (XA^2 + XB^2 + AB^2) + 8 * dblEpsilon ^ 2 .
	ab2 := a.Sub(b.Vector).Norm2()
	maxError := (4.75*dblEpsilon*(xa2+xb2+ab2) + 8*dblEpsilon*dblEpsilon)
	if math.Abs(xa2-xb2) >= ab2+maxError {
		return minDist, false
	}

	// The minimum distance might be to a point on the edge interior. Let R
	// be closest point to X that lies on the great circle through AB. Rather
	// than computing the geodesic distance along the surface of the sphere,
	// instead we compute the "chord length" through the sphere's interior.
	//
	// The squared chord length XR^2 can be expressed as XQ^2 + QR^2, where Q
	// is the point X projected onto the plane through the great circle AB.
	// The distance XQ^2 can be written as (X.C)^2 / |C|^2 where C = A x B.
	// We ignore the QR^2 term and instead use XQ^2 as a lower bound, since it
	// is faster and the corresponding distance on the Earth's surface is
	// accurate to within 1% for distances up to about 1800km.
	c := a.PointCross(b)
	c2 := c.Norm2()
	xDotC := x.Dot(c.Vector)
	xDotC2 := xDotC * xDotC
	if !alwaysUpdate && xDotC2 > c2*float64(minDist) {
		// The closest point on the great circle AB is too far away.  We need to
		// test this using ">" rather than ">=" because the actual minimum bound
		// on the distance is (xDotC2 / c2), which can be rounded differently
		// than the (more efficient) multiplicative test above.
		return minDist, false
	}

	// Otherwise we do the exact, more expensive test for the interior case.
	// This test is very likely to succeed because of the conservative planar
	// test we did initially.
	//
	// TODO(roberts): Ensure that the errors in test are accurately reflected in the
	// minUpdateInteriorDistanceMaxError.
	cx := c.Cross(x.Vector)
	if a.Sub(x.Vector).Dot(cx) >= 0 || b.Sub(x.Vector).Dot(cx) <= 0 {
		return minDist, false
	}

	// Compute the squared chord length XR^2 = XQ^2 + QR^2 (see above).
	// This calculation has good accuracy for all chord lengths since it
	// is based on both the dot product and cross product (rather than
	// deriving one from the other). However, note that the chord length
	// representation itself loses accuracy as the angle approaches π.
	qr := 1 - math.Sqrt(cx.Norm2()/c2)
	dist := s1.ChordAngle((xDotC2 / c2) + (qr * qr))

	if !alwaysUpdate && dist >= minDist {
		return minDist, false
	}

	return dist, true
}

// updateEdgePairMinDistance computes the minimum distance between the given
// pair of edges. If the two edges cross, the distance is zero. The cases
// a0 == a1 and b0 == b1 are handled correctly.
func updateEdgePairMinDistance(a0, a1, b0, b1 Point, minDist s1.ChordAngle) (s1.ChordAngle, bool) {
	if minDist == 0 {
		return 0, false
	}
	if CrossingSign(a0, a1, b0, b1) == Cross {
		minDist = 0
		return 0, true
	}

	// Otherwise, the minimum distance is achieved at an endpoint of at least
	// one of the two edges. We ensure that all four possibilities are always checked.
	//
	// The calculation below computes each of the six vertex-vertex distances
	// twice (this could be optimized).
	var ok1, ok2, ok3, ok4 bool
	minDist, ok1 = UpdateMinDistance(a0, b0, b1, minDist)
	minDist, ok2 = UpdateMinDistance(a1, b0, b1, minDist)
	minDist, ok3 = UpdateMinDistance(b0, a0, a1, minDist)
	minDist, ok4 = UpdateMinDistance(b1, a0, a1, minDist)
	return minDist, ok1 || ok2 || ok3 || ok4
}

// updateEdgePairMaxDistance reports the minimum distance between the given pair of edges.
// If one edge crosses the antipodal reflection of the other, the distance is pi.
func updateEdgePairMaxDistance(a0, a1, b0, b1 Point, maxDist s1.ChordAngle) (s1.ChordAngle, bool) {
	if maxDist == s1.StraightChordAngle {
		return s1.StraightChordAngle, false
	}
	if CrossingSign(a0, a1, Point{b0.Mul(-1)}, Point{b1.Mul(-1)}) == Cross {
		return s1.StraightChordAngle, true
	}

	// Otherwise, the maximum distance is achieved at an endpoint of at least
	// one of the two edges. We ensure that all four possibilities are always checked.
	//
	// The calculation below computes each of the six vertex-vertex distances
	// twice (this could be optimized).
	var ok1, ok2, ok3, ok4 bool
	maxDist, ok1 = UpdateMaxDistance(a0, b0, b1, maxDist)
	maxDist, ok2 = UpdateMaxDistance(a1, b0, b1, maxDist)
	maxDist, ok3 = UpdateMaxDistance(b0, a0, a1, maxDist)
	maxDist, ok4 = UpdateMaxDistance(b1, a0, a1, maxDist)
	return maxDist, ok1 || ok2 || ok3 || ok4
}

// EdgePairClosestPoints returns the pair of points (a, b) that achieves the
// minimum distance between edges a0a1 and b0b1, where a is a point on a0a1 and
// b is a point on b0b1. If the two edges intersect, a and b are both equal to
// the intersection point. Handles a0 == a1 and b0 == b1 correctly.
func EdgePairClosestPoints(a0, a1, b0, b1 Point) (Point, Point) {
	if CrossingSign(a0, a1, b0, b1) == Cross {
		x := Intersection(a0, a1, b0, b1)
		return x, x
	}
	// We save some work by first determining which vertex/edge pair achieves
	// the minimum distance, and then computing the closest point on that edge.
	var minDist s1.ChordAngle
	var ok bool

	minDist, ok = updateMinDistance(a0, b0, b1, minDist, true)
	closestVertex := 0
	if minDist, ok = UpdateMinDistance(a1, b0, b1, minDist); ok {
		closestVertex = 1
	}
	if minDist, ok = UpdateMinDistance(b0, a0, a1, minDist); ok {
		closestVertex = 2
	}
	if minDist, ok = UpdateMinDistance(b1, a0, a1, minDist); ok {
		closestVertex = 3
	}
	switch closestVertex {
	case 0:
		return a0, Project(a0, b0, b1)
	case 1:
		return a1, Project(a1, b0, b1)
	case 2:
		return Project(b0, a0, a1), b0
	case 3:
		return Project(b1, a0, a1), b1
	default:
		panic("illegal case reached")
	}
}
