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

import (
	"fmt"
	"math"

	"github.com/blevesearch/geo/r3"
	"github.com/blevesearch/geo/s1"
)

const (
	// intersectionError can be set somewhat arbitrarily, because the algorithm
	// uses more precision if necessary in order to achieve the specified error.
	// The only strict requirement is that intersectionError >= dblEpsilon
	// radians. However, using a larger error tolerance makes the algorithm more
	// efficient because it reduces the number of cases where exact arithmetic is
	// needed.
	intersectionError = s1.Angle(8 * dblError)

	// intersectionMergeRadius is used to ensure that intersection points that
	// are supposed to be coincident are merged back together into a single
	// vertex. This is required in order for various polygon operations (union,
	// intersection, etc) to work correctly. It is twice the intersection error
	// because two coincident intersection points might have errors in
	// opposite directions.
	intersectionMergeRadius = 2 * intersectionError
)

// A Crossing indicates how edges cross.
type Crossing int

const (
	// Cross means the edges cross.
	Cross Crossing = iota
	// MaybeCross means two vertices from different edges are the same.
	MaybeCross
	// DoNotCross means the edges do not cross.
	DoNotCross
)

func (c Crossing) String() string {
	switch c {
	case Cross:
		return "Cross"
	case MaybeCross:
		return "MaybeCross"
	case DoNotCross:
		return "DoNotCross"
	default:
		return fmt.Sprintf("(BAD CROSSING %d)", c)
	}
}

// CrossingSign reports whether the edge AB intersects the edge CD.
// If AB crosses CD at a point that is interior to both edges, Cross is returned.
// If any two vertices from different edges are the same it returns MaybeCross.
// Otherwise it returns DoNotCross.
// If either edge is degenerate (A == B or C == D), the return value is MaybeCross
// if two vertices from different edges are the same and DoNotCross otherwise.
//
// Properties of CrossingSign:
//
//	(1) CrossingSign(b,a,c,d) == CrossingSign(a,b,c,d)
//	(2) CrossingSign(c,d,a,b) == CrossingSign(a,b,c,d)
//	(3) CrossingSign(a,b,c,d) == MaybeCross if a==c, a==d, b==c, b==d
//	(3) CrossingSign(a,b,c,d) == DoNotCross or MaybeCross if a==b or c==d
//
// This method implements an exact, consistent perturbation model such
// that no three points are ever considered to be collinear. This means
// that even if you have 4 points A, B, C, D that lie exactly in a line
// (say, around the equator), C and D will be treated as being slightly to
// one side or the other of AB. This is done in a way such that the
// results are always consistent (see RobustSign).
func CrossingSign(a, b, c, d Point) Crossing {
	crosser := NewChainEdgeCrosser(a, b, c)
	return crosser.ChainCrossingSign(d)
}

// VertexCrossing reports whether two edges "cross" in such a way that point-in-polygon
// containment tests can be implemented by counting the number of edge crossings.
//
// Given two edges AB and CD where at least two vertices are identical
// (i.e. CrossingSign(a,b,c,d) == 0), the basic rule is that a "crossing"
// occurs if AB is encountered after CD during a CCW sweep around the shared
// vertex starting from a fixed reference point.
//
// Note that according to this rule, if AB crosses CD then in general CD
// does not cross AB. However, this leads to the correct result when
// counting polygon edge crossings. For example, suppose that A,B,C are
// three consecutive vertices of a CCW polygon. If we now consider the edge
// crossings of a segment BP as P sweeps around B, the crossing number
// changes parity exactly when BP crosses BA or BC.
//
// Useful properties of VertexCrossing (VC):
//
//	(1) VC(a,a,c,d) == VC(a,b,c,c) == false
//	(2) VC(a,b,a,b) == VC(a,b,b,a) == true
//	(3) VC(a,b,c,d) == VC(a,b,d,c) == VC(b,a,c,d) == VC(b,a,d,c)
//	(3) If exactly one of a,b equals one of c,d, then exactly one of
//	    VC(a,b,c,d) and VC(c,d,a,b) is true
//
// It is an error to call this method with 4 distinct vertices.
func VertexCrossing(a, b, c, d Point) bool {
	// If A == B or C == D there is no intersection. We need to check this
	// case first in case 3 or more input points are identical.
	if a == b || c == d {
		return false
	}

	// If any other pair of vertices is equal, there is a crossing if and only
	// if OrderedCCW indicates that the edge AB is further CCW around the
	// shared vertex O (either A or B) than the edge CD, starting from an
	// arbitrary fixed reference point.

	// Optimization: if AB=CD or AB=DC, we can avoid most of the calculations.
	switch {
	case a == c:
		return (b == d) || OrderedCCW(a.referenceDir(), d, b, a)
	case b == d:
		return OrderedCCW(b.referenceDir(), c, a, b)
	case a == d:
		return (b == c) || OrderedCCW(a.referenceDir(), c, b, a)
	case b == c:
		return OrderedCCW(b.referenceDir(), d, a, b)
	}

	return false
}

// EdgeOrVertexCrossing is a convenience function that calls CrossingSign to
// handle cases where all four vertices are distinct, and VertexCrossing to
// handle cases where two or more vertices are the same. This defines a crossing
// function such that point-in-polygon containment tests can be implemented
// by simply counting edge crossings.
func EdgeOrVertexCrossing(a, b, c, d Point) bool {
	switch CrossingSign(a, b, c, d) {
	case DoNotCross:
		return false
	case Cross:
		return true
	case MaybeCross:
		// Fall through to the final return.
	}
	return VertexCrossing(a, b, c, d)
}

// Intersection returns the intersection point of two edges AB and CD that cross
// (CrossingSign(a,b,c,d) == Crossing).
//
// Useful properties of Intersection:
//
//	(1) Intersection(b,a,c,d) == Intersection(a,b,d,c) == Intersection(a,b,c,d)
//	(2) Intersection(c,d,a,b) == Intersection(a,b,c,d)
//
// The returned intersection point X is guaranteed to be very close to the
// true intersection point of AB and CD, even if the edges intersect at a
// very small angle.
func Intersection(a0, a1, b0, b1 Point) Point {
	// It is difficult to compute the intersection point of two edges accurately
	// when the angle between the edges is very small. Previously we handled
	// this by only guaranteeing that the returned intersection point is within
	// intersectionError of each edge. However, this means that when the edges
	// cross at a very small angle, the computed result may be very far from the
	// true intersection point.
	//
	// Instead this function now guarantees that the result is always within
	// intersectionError of the true intersection. This requires using more
	// sophisticated techniques and in some cases extended precision.
	//
	//  - intersectionStable computes the intersection point using
	//    projection and interpolation, taking care to minimize cancellation
	//    error.
	//
	//  - intersectionExact computes the intersection point using precision
	//    arithmetic and converts the final result back to a Point.
	pt, ok := intersectionStable(a0, a1, b0, b1)
	if !ok {
		pt = intersectionExact(a0, a1, b0, b1)
	}

	// Make sure the intersection point is on the correct side of the sphere.
	// Since all vertices are unit length, and edges are less than 180 degrees,
	// (a0 + a1) and (b0 + b1) both have positive dot product with the
	// intersection point.  We use the sum of all vertices to make sure that the
	// result is unchanged when the edges are swapped or reversed.
	if pt.Dot((a0.Add(a1.Vector)).Add(b0.Add(b1.Vector))) < 0 {
		pt = Point{pt.Mul(-1)}
	}

	return pt
}

// Computes the cross product of two vectors, normalized to be unit length.
// Also returns the length of the cross
// product before normalization, which is useful for estimating the amount of
// error in the result.  For numerical stability, the vectors should both be
// approximately unit length.
func robustNormalWithLength(x, y r3.Vector) (r3.Vector, float64) {
	var pt r3.Vector
	// This computes 2 * (x.Cross(y)), but has much better numerical
	// stability when x and y are unit length.
	tmp := x.Sub(y).Cross(x.Add(y))
	length := tmp.Norm()
	if length != 0 {
		pt = tmp.Mul(1 / length)
	}
	return pt, 0.5 * length // Since tmp == 2 * (x.Cross(y))
}

/*
// intersectionSimple is not used by the C++ so it is skipped here.
*/

// projection returns the projection of aNorm onto X (x.Dot(aNorm)), and a bound
// on the error in the result. aNorm is not necessarily unit length.
//
// The remaining parameters (the length of aNorm (aNormLen) and the edge endpoints
// a0 and a1) allow this dot product to be computed more accurately and efficiently.
func projection(x, aNorm r3.Vector, aNormLen float64, a0, a1 Point) (proj, bound float64) {
	// The error in the dot product is proportional to the lengths of the input
	// vectors, so rather than using x itself (a unit-length vector) we use
	// the vectors from x to the closer of the two edge endpoints. This
	// typically reduces the error by a huge factor.
	x0 := x.Sub(a0.Vector)
	x1 := x.Sub(a1.Vector)
	x0Dist2 := x0.Norm2()
	x1Dist2 := x1.Norm2()

	// If both distances are the same, we need to be careful to choose one
	// endpoint deterministically so that the result does not change if the
	// order of the endpoints is reversed.
	var dist float64
	if x0Dist2 < x1Dist2 || (x0Dist2 == x1Dist2 && x0.Cmp(x1) == -1) {
		dist = math.Sqrt(x0Dist2)
		proj = x0.Dot(aNorm)
	} else {
		dist = math.Sqrt(x1Dist2)
		proj = x1.Dot(aNorm)
	}

	// This calculation bounds the error from all sources: the computation of
	// the normal, the subtraction of one endpoint, and the dot product itself.
	// dblError appears because the input points are assumed to be
	// normalized in double precision.
	//
	// For reference, the bounds that went into this calculation are:
	// ||N'-N|| <= ((1 + 2 * sqrt(3))||N|| + 32 * sqrt(3) * dblError) * tErr
	// |(A.B)'-(A.B)| <= (1.5 * (A.B) + 1.5 * ||A|| * ||B||) * tErr
	// ||(X-Y)'-(X-Y)|| <= ||X-Y|| * tErr
	tErr := roundingEpsilon(x.X)
	bound = (((3.5+2*math.Sqrt(3))*aNormLen+32*math.Sqrt(3)*dblError)*dist + 1.5*math.Abs(proj)) * tErr
	return proj, bound
}

// compareEdges reports whether (a0,a1) is less than (b0,b1) with respect to a total
// ordering on edges that is invariant under edge reversals.
func compareEdges(a0, a1, b0, b1 Point) bool {
	if a0.Cmp(a1.Vector) != -1 {
		a0, a1 = a1, a0
	}
	if b0.Cmp(b1.Vector) != -1 {
		b0, b1 = b1, b0
	}
	return a0.Cmp(b0.Vector) == -1 || (a0 == b0 && b0.Cmp(b1.Vector) == -1)
}

// intersectionStable returns the intersection point of the edges (a0,a1) and
// (b0,b1) if it can be computed to within an error of at most intersectionError
// by this function.
//
// The intersection point is not guaranteed to have the correct sign because we
// choose to use the longest of the two edges first. The sign is corrected by
// Intersection.
func intersectionStable(a0, a1, b0, b1 Point) (Point, bool) {
	// Sort the two edges so that (a0,a1) is longer, breaking ties in a
	// deterministic way that does not depend on the ordering of the endpoints.
	// This is desirable for two reasons:
	//  - So that the result doesn't change when edges are swapped or reversed.
	//  - It reduces error, since the first edge is used to compute the edge
	//    normal (where a longer edge means less error), and the second edge
	//    is used for interpolation (where a shorter edge means less error).
	aLen2 := a1.Sub(a0.Vector).Norm2()
	bLen2 := b1.Sub(b0.Vector).Norm2()
	if aLen2 < bLen2 || (aLen2 == bLen2 && compareEdges(a0, a1, b0, b1)) {
		return intersectionStableSorted(b0, b1, a0, a1)
	}
	return intersectionStableSorted(a0, a1, b0, b1)
}

// intersectionStableSorted is a helper function for intersectionStable.
// It expects that the edges (a0,a1) and (b0,b1) have been sorted so that
// the first edge passed in is longer.
func intersectionStableSorted(a0, a1, b0, b1 Point) (Point, bool) {
	var pt Point

	// Compute the normal of the plane through (a0, a1) in a stable way.
	aNorm := a0.Sub(a1.Vector).Cross(a0.Add(a1.Vector))
	aNormLen := aNorm.Norm()
	bLen := b1.Sub(b0.Vector).Norm()

	// Compute the projection (i.e., signed distance) of b0 and b1 onto the
	// plane through (a0, a1).  Distances are scaled by the length of aNorm.
	b0Dist, b0Error := projection(b0.Vector, aNorm, aNormLen, a0, a1)
	b1Dist, b1Error := projection(b1.Vector, aNorm, aNormLen, a0, a1)

	// The total distance from b0 to b1 measured perpendicularly to (a0,a1) is
	// |b0Dist - b1Dist|.  Note that b0Dist and b1Dist generally have
	// opposite signs because b0 and b1 are on opposite sides of (a0, a1).  The
	// code below finds the intersection point by interpolating along the edge
	// (b0, b1) to a fractional distance of b0Dist / (b0Dist - b1Dist).
	//
	// It can be shown that the maximum error in the interpolation fraction is
	//
	//   (b0Dist * b1Error - b1Dist * b0Error) / (distSum * (distSum - errorSum))
	//
	// We save ourselves some work by scaling the result and the error bound by
	// "distSum", since the result is normalized to be unit length anyway.
	distSum := math.Abs(b0Dist - b1Dist)
	errorSum := b0Error + b1Error
	if distSum <= errorSum {
		return pt, false // Error is unbounded in this case.
	}

	x := b1.Mul(b0Dist).Sub(b0.Mul(b1Dist))
	tErr := roundingEpsilon(x.X)
	err := bLen*math.Abs(b0Dist*b1Error-b1Dist*b0Error)/
		(distSum-errorSum) + 2*distSum*tErr

	// Finally we normalize the result, compute the corresponding error, and
	// check whether the total error is acceptable.

	// TODO(rsned): C++ checks Norm2 > some small amount to prevent precision loss.
	// xLen2 := x.Norm2()
	// if xLen2 < math.SmallestNonzeroFloat64 {
	//         // If x.Norm2() is less than the minimum normalized value of T, xLen might
	//         // lose precision and the result might fail to satisfy IsUnitLength().
	//         // TODO(rsned): Implement RobustNormalize().
	//         return pt, false
	// }

	xLen := x.Norm()
	maxError := intersectionError
	if err > (float64(maxError)-tErr)*xLen {
		return pt, false
	}

	return Point{x.Mul(1 / xLen)}, true
}

// intersectionExact returns the intersection point of (a0, a1) and (b0, b1)
// using precise arithmetic. Note that the result is not exact because it is
// rounded down to double precision at the end. Also, the intersection point
// is not guaranteed to have the correct sign (i.e., the return value may need
// to be negated).
func intersectionExact(a0, a1, b0, b1 Point) Point {
	// Since we are using precise arithmetic, we don't need to worry about
	// numerical stability.
	a0P := r3.PreciseVectorFromVector(a0.Vector)
	a1P := r3.PreciseVectorFromVector(a1.Vector)
	b0P := r3.PreciseVectorFromVector(b0.Vector)
	b1P := r3.PreciseVectorFromVector(b1.Vector)
	aNormP := a0P.Cross(a1P)
	bNormP := b0P.Cross(b1P)
	xP := aNormP.Cross(bNormP)

	// The final Normalize() call is done in double precision, which creates a
	// directional error of up to 2*dblError. (Precise conversion and Normalize()
	// each contribute up to dblError of directional error.)
	x := xP.Vector()

	if x == (r3.Vector{}) {
		// The two edges are exactly collinear, but we still consider them to be
		// "crossing" because of simulation of simplicity. Out of the four
		// endpoints, exactly two lie in the interior of the other edge. Of
		// those two we return the one that is lexicographically smallest.
		x = r3.Vector{X: 10, Y: 10, Z: 10} // Greater than any valid S2Point

		aNorm := Point{aNormP.Vector()}
		bNorm := Point{bNormP.Vector()}
		if OrderedCCW(b0, a0, b1, bNorm) && a0.Cmp(x) == -1 {
			return a0
		}
		if OrderedCCW(b0, a1, b1, bNorm) && a1.Cmp(x) == -1 {
			return a1
		}
		if OrderedCCW(a0, b0, a1, aNorm) && b0.Cmp(x) == -1 {
			return b0
		}
		if OrderedCCW(a0, b1, a1, aNorm) && b1.Cmp(x) == -1 {
			return b1
		}
	}

	return Point{x}
}

// AngleContainsVertex reports if the angle ABC contains its vertex B.
// Containment is defined such that if several polygons tile the region around
// a vertex, then exactly one of those polygons contains that vertex.
// Returns false for degenerate angles of the form ABA.
//
// Note that this method is not sufficient to determine vertex containment in
// polygons with duplicate vertices (such as the polygon ABCADE).  Use
// ContainsVertexQuery for such polygons. AngleContainsVertex(a, b, c)
// is equivalent to using ContainsVertexQuery as follows:
//
//	ContainsVertexQuery query(b);
//	query.AddEdge(a, -1);  // incoming
//	query.AddEdge(c, 1);   // outgoing
//	return query.ContainsVertex() > 0;
//
// Useful properties of AngleContainsVertex:
//
//	(1) AngleContainsVertex(a,b,a) == false
//	(2) AngleContainsVertex(a,b,c) == !AngleContainsVertex(c,b,a) unless a == c
//	(3) Given vertices v_1 ... v_k ordered cyclically CCW around vertex b,
//	    AngleContainsVertex(v_{i+1}, b, v_i) is true for exactly one value of i.
//
// REQUIRES: a != b && b != c
func AngleContainsVertex(a, b, c Point) bool {
	// A loop with consecutive vertices A, B, C contains vertex B if and only if
	// the fixed vector R = referenceDir(B) is contained by the wedge ABC.  The
	// wedge is closed at A and open at C, i.e. the point B is inside the loop
	// if A = R but not if C = R.
	//
	// Note that the test below is written so as to get correct results when the
	// angle ABC is degenerate. If A = C or C = R it returns false, and
	// otherwise if A = R it returns true.
	return !OrderedCCW(b.referenceDir(), c, a, b)
}

// TODO(roberts): Differences from C++
// func RobustCrossProd(a, b Point) Point
// func symbolicCrossProd(a, b Point) Point
// func exactCrossProd(a, b Point) Point
// func SignedVertexCrossing(a, b, c, d Point) int
// func isNormalizable(p Point) bool
// func ensureNormalizable(p Point) Point
// func normalizableFromPrecise(p r3.PreciseVector) Point
