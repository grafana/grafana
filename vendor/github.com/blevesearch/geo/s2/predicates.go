// Copyright 2016 Google Inc. All rights reserved.
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

// This file contains various predicates that are guaranteed to produce
// correct, consistent results. They are also relatively efficient. This is
// achieved by computing conservative error bounds and falling back to high
// precision or even exact arithmetic when the result is uncertain. Such
// predicates are useful in implementing robust algorithms.
//
// See also EdgeCrosser, which implements various exact
// edge-crossing predicates more efficiently than can be done here.

import (
	"math"
	"math/big"

	"github.com/golang/geo/r3"
	"github.com/golang/geo/s1"
)

const (
	// If any other machine architectures need to be suppported, these next three
	// values will need to be updated.

	// epsilon is a small number that represents a reasonable level of noise between two
	// values that can be considered to be equal.
	epsilon = 1e-15
	// dblEpsilon is a smaller number for values that require more precision.
	// This is the C++ DBL_EPSILON equivalent.
	dblEpsilon = 2.220446049250313e-16
	// dblError is the C++ value for S2 rounding_epsilon().
	dblError = 1.110223024625156e-16

	// maxDeterminantError is the maximum error in computing (AxB).C where all vectors
	// are unit length. Using standard inequalities, it can be shown that
	//
	//  fl(AxB) = AxB + D where |D| <= (|AxB| + (2/sqrt(3))*|A|*|B|) * e
	//
	// where "fl()" denotes a calculation done in floating-point arithmetic,
	// |x| denotes either absolute value or the L2-norm as appropriate, and
	// e is a reasonably small value near the noise level of floating point
	// number accuracy. Similarly,
	//
	//  fl(B.C) = B.C + d where |d| <= (|B.C| + 2*|B|*|C|) * e .
	//
	// Applying these bounds to the unit-length vectors A,B,C and neglecting
	// relative error (which does not affect the sign of the result), we get
	//
	//  fl((AxB).C) = (AxB).C + d where |d| <= (3 + 2/sqrt(3)) * e
	maxDeterminantError = 1.8274 * dblEpsilon

	// detErrorMultiplier is the factor to scale the magnitudes by when checking
	// for the sign of set of points with certainty. Using a similar technique to
	// the one used for maxDeterminantError, the error is at most:
	//
	//   |d| <= (3 + 6/sqrt(3)) * |A-C| * |B-C| * e
	//
	// If the determinant magnitude is larger than this value then we know
	// its sign with certainty.
	detErrorMultiplier = 3.2321 * dblEpsilon
)

// Direction is an indication of the ordering of a set of points.
type Direction int

// These are the three options for the direction of a set of points.
const (
	Clockwise        Direction = -1
	Indeterminate    Direction = 0
	CounterClockwise Direction = 1
)

// newBigFloat constructs a new big.Float with maximum precision.
func newBigFloat() *big.Float { return new(big.Float).SetPrec(big.MaxPrec) }

// Sign returns true if the points A, B, C are strictly counterclockwise,
// and returns false if the points are clockwise or collinear (i.e. if they are all
// contained on some great circle).
//
// Due to numerical errors, situations may arise that are mathematically
// impossible, e.g. ABC may be considered strictly CCW while BCA is not.
// However, the implementation guarantees the following:
//
// If Sign(a,b,c), then !Sign(c,b,a) for all a,b,c.
func Sign(a, b, c Point) bool {
	// NOTE(dnadasi): In the C++ API the equivalent method here was known as "SimpleSign".

	// We compute the signed volume of the parallelepiped ABC. The usual
	// formula for this is (A ⨯ B) · C, but we compute it here using (C ⨯ A) · B
	// in order to ensure that ABC and CBA are not both CCW. This follows
	// from the following identities (which are true numerically, not just
	// mathematically):
	//
	//     (1) x ⨯ y == -(y ⨯ x)
	//     (2) -x · y == -(x · y)
	return c.Cross(a.Vector).Dot(b.Vector) > 0
}

// RobustSign returns a Direction representing the ordering of the points.
// CounterClockwise is returned if the points are in counter-clockwise order,
// Clockwise for clockwise, and Indeterminate if any two points are the same (collinear),
// or the sign could not completely be determined.
//
// This function has additional logic to make sure that the above properties hold even
// when the three points are coplanar, and to deal with the limitations of
// floating-point arithmetic.
//
// RobustSign satisfies the following conditions:
//
//  (1) RobustSign(a,b,c) == Indeterminate if and only if a == b, b == c, or c == a
//  (2) RobustSign(b,c,a) == RobustSign(a,b,c) for all a,b,c
//  (3) RobustSign(c,b,a) == -RobustSign(a,b,c) for all a,b,c
//
// In other words:
//
//  (1) The result is Indeterminate if and only if two points are the same.
//  (2) Rotating the order of the arguments does not affect the result.
//  (3) Exchanging any two arguments inverts the result.
//
// On the other hand, note that it is not true in general that
// RobustSign(-a,b,c) == -RobustSign(a,b,c), or any similar identities
// involving antipodal points.
func RobustSign(a, b, c Point) Direction {
	sign := triageSign(a, b, c)
	if sign == Indeterminate {
		sign = expensiveSign(a, b, c)
	}
	return sign
}

// stableSign reports the direction sign of the points in a numerically stable way.
// Unlike triageSign, this method can usually compute the correct determinant sign
// even when all three points are as collinear as possible. For example if three
// points are spaced 1km apart along a random line on the Earth's surface using
// the nearest representable points, there is only a 0.4% chance that this method
// will not be able to find the determinant sign. The probability of failure
// decreases as the points get closer together; if the collinear points are 1 meter
// apart, the failure rate drops to 0.0004%.
//
// This method could be extended to also handle nearly-antipodal points, but antipodal
// points are rare in practice so it seems better to simply fall back to
// exact arithmetic in that case.
func stableSign(a, b, c Point) Direction {
	ab := b.Sub(a.Vector)
	ab2 := ab.Norm2()
	bc := c.Sub(b.Vector)
	bc2 := bc.Norm2()
	ca := a.Sub(c.Vector)
	ca2 := ca.Norm2()

	// Now compute the determinant ((A-C)x(B-C)).C, where the vertices have been
	// cyclically permuted if necessary so that AB is the longest edge. (This
	// minimizes the magnitude of cross product.)  At the same time we also
	// compute the maximum error in the determinant.

	// The two shortest edges, pointing away from their common point.
	var e1, e2, op r3.Vector
	if ab2 >= bc2 && ab2 >= ca2 {
		// AB is the longest edge.
		e1, e2, op = ca, bc, c.Vector
	} else if bc2 >= ca2 {
		// BC is the longest edge.
		e1, e2, op = ab, ca, a.Vector
	} else {
		// CA is the longest edge.
		e1, e2, op = bc, ab, b.Vector
	}

	det := -e1.Cross(e2).Dot(op)
	maxErr := detErrorMultiplier * math.Sqrt(e1.Norm2()*e2.Norm2())

	// If the determinant isn't zero, within maxErr, we know definitively the point ordering.
	if det > maxErr {
		return CounterClockwise
	}
	if det < -maxErr {
		return Clockwise
	}
	return Indeterminate
}

// triageSign returns the direction sign of the points. It returns Indeterminate if two
// points are identical or the result is uncertain. Uncertain cases can be resolved, if
// desired, by calling expensiveSign.
//
// The purpose of this method is to allow additional cheap tests to be done without
// calling expensiveSign.
func triageSign(a, b, c Point) Direction {
	det := a.Cross(b.Vector).Dot(c.Vector)
	if det > maxDeterminantError {
		return CounterClockwise
	}
	if det < -maxDeterminantError {
		return Clockwise
	}
	return Indeterminate
}

// expensiveSign reports the direction sign of the points. It returns Indeterminate
// if two of the input points are the same. It uses multiple-precision arithmetic
// to ensure that its results are always self-consistent.
func expensiveSign(a, b, c Point) Direction {
	// Return Indeterminate if and only if two points are the same.
	// This ensures RobustSign(a,b,c) == Indeterminate if and only if a == b, b == c, or c == a.
	// ie. Property 1 of RobustSign.
	if a == b || b == c || c == a {
		return Indeterminate
	}

	// Next we try recomputing the determinant still using floating-point
	// arithmetic but in a more precise way. This is more expensive than the
	// simple calculation done by triageSign, but it is still *much* cheaper
	// than using arbitrary-precision arithmetic. This optimization is able to
	// compute the correct determinant sign in virtually all cases except when
	// the three points are truly collinear (e.g., three points on the equator).
	detSign := stableSign(a, b, c)
	if detSign != Indeterminate {
		return detSign
	}

	// Otherwise fall back to exact arithmetic and symbolic permutations.
	return exactSign(a, b, c, true)
}

// exactSign reports the direction sign of the points computed using high-precision
// arithmetic and/or symbolic perturbations.
func exactSign(a, b, c Point, perturb bool) Direction {
	// Sort the three points in lexicographic order, keeping track of the sign
	// of the permutation. (Each exchange inverts the sign of the determinant.)
	permSign := CounterClockwise
	pa := &a
	pb := &b
	pc := &c
	if pa.Cmp(pb.Vector) > 0 {
		pa, pb = pb, pa
		permSign = -permSign
	}
	if pb.Cmp(pc.Vector) > 0 {
		pb, pc = pc, pb
		permSign = -permSign
	}
	if pa.Cmp(pb.Vector) > 0 {
		pa, pb = pb, pa
		permSign = -permSign
	}

	// Construct multiple-precision versions of the sorted points and compute
	// their precise 3x3 determinant.
	xa := r3.PreciseVectorFromVector(pa.Vector)
	xb := r3.PreciseVectorFromVector(pb.Vector)
	xc := r3.PreciseVectorFromVector(pc.Vector)
	xbCrossXc := xb.Cross(xc)
	det := xa.Dot(xbCrossXc)

	// The precision of big.Float is high enough that the result should always
	// be exact enough (no rounding was performed).

	// If the exact determinant is non-zero, we're done.
	detSign := Direction(det.Sign())
	if detSign == Indeterminate && perturb {
		// Otherwise, we need to resort to symbolic perturbations to resolve the
		// sign of the determinant.
		detSign = symbolicallyPerturbedSign(xa, xb, xc, xbCrossXc)
	}
	return permSign * detSign
}

// symbolicallyPerturbedSign reports the sign of the determinant of three points
// A, B, C under a model where every possible Point is slightly perturbed by
// a unique infinitesmal amount such that no three perturbed points are
// collinear and no four points are coplanar. The perturbations are so small
// that they do not change the sign of any determinant that was non-zero
// before the perturbations, and therefore can be safely ignored unless the
// determinant of three points is exactly zero (using multiple-precision
// arithmetic). This returns CounterClockwise or Clockwise according to the
// sign of the determinant after the symbolic perturbations are taken into account.
//
// Since the symbolic perturbation of a given point is fixed (i.e., the
// perturbation is the same for all calls to this method and does not depend
// on the other two arguments), the results of this method are always
// self-consistent. It will never return results that would correspond to an
// impossible configuration of non-degenerate points.
//
// This requires that the 3x3 determinant of A, B, C must be exactly zero.
// And the points must be distinct, with A < B < C in lexicographic order.
//
// Reference:
//   "Simulation of Simplicity" (Edelsbrunner and Muecke, ACM Transactions on
//   Graphics, 1990).
//
func symbolicallyPerturbedSign(a, b, c, bCrossC r3.PreciseVector) Direction {
	// This method requires that the points are sorted in lexicographically
	// increasing order. This is because every possible Point has its own
	// symbolic perturbation such that if A < B then the symbolic perturbation
	// for A is much larger than the perturbation for B.
	//
	// Alternatively, we could sort the points in this method and keep track of
	// the sign of the permutation, but it is more efficient to do this before
	// converting the inputs to the multi-precision representation, and this
	// also lets us re-use the result of the cross product B x C.
	//
	// Every input coordinate x[i] is assigned a symbolic perturbation dx[i].
	// We then compute the sign of the determinant of the perturbed points,
	// i.e.
	//               | a.X+da.X  a.Y+da.Y  a.Z+da.Z |
	//               | b.X+db.X  b.Y+db.Y  b.Z+db.Z |
	//               | c.X+dc.X  c.Y+dc.Y  c.Z+dc.Z |
	//
	// The perturbations are chosen such that
	//
	//   da.Z > da.Y > da.X > db.Z > db.Y > db.X > dc.Z > dc.Y > dc.X
	//
	// where each perturbation is so much smaller than the previous one that we
	// don't even need to consider it unless the coefficients of all previous
	// perturbations are zero. In fact, it is so small that we don't need to
	// consider it unless the coefficient of all products of the previous
	// perturbations are zero. For example, we don't need to consider the
	// coefficient of db.Y unless the coefficient of db.Z *da.X is zero.
	//
	// The follow code simply enumerates the coefficients of the perturbations
	// (and products of perturbations) that appear in the determinant above, in
	// order of decreasing perturbation magnitude. The first non-zero
	// coefficient determines the sign of the result. The easiest way to
	// enumerate the coefficients in the correct order is to pretend that each
	// perturbation is some tiny value "eps" raised to a power of two:
	//
	// eps**     1      2      4      8     16     32     64    128    256
	//        da.Z   da.Y   da.X   db.Z   db.Y   db.X   dc.Z   dc.Y   dc.X
	//
	// Essentially we can then just count in binary and test the corresponding
	// subset of perturbations at each step. So for example, we must test the
	// coefficient of db.Z*da.X before db.Y because eps**12 > eps**16.
	//
	// Of course, not all products of these perturbations appear in the
	// determinant above, since the determinant only contains the products of
	// elements in distinct rows and columns. Thus we don't need to consider
	// da.Z*da.Y, db.Y *da.Y, etc. Furthermore, sometimes different pairs of
	// perturbations have the same coefficient in the determinant; for example,
	// da.Y*db.X and db.Y*da.X have the same coefficient (c.Z). Therefore
	// we only need to test this coefficient the first time we encounter it in
	// the binary order above (which will be db.Y*da.X).
	//
	// The sequence of tests below also appears in Table 4-ii of the paper
	// referenced above, if you just want to look it up, with the following
	// translations: [a,b,c] -> [i,j,k] and [0,1,2] -> [1,2,3]. Also note that
	// some of the signs are different because the opposite cross product is
	// used (e.g., B x C rather than C x B).

	detSign := bCrossC.Z.Sign() // da.Z
	if detSign != 0 {
		return Direction(detSign)
	}
	detSign = bCrossC.Y.Sign() // da.Y
	if detSign != 0 {
		return Direction(detSign)
	}
	detSign = bCrossC.X.Sign() // da.X
	if detSign != 0 {
		return Direction(detSign)
	}

	detSign = newBigFloat().Sub(newBigFloat().Mul(c.X, a.Y), newBigFloat().Mul(c.Y, a.X)).Sign() // db.Z
	if detSign != 0 {
		return Direction(detSign)
	}
	detSign = c.X.Sign() // db.Z * da.Y
	if detSign != 0 {
		return Direction(detSign)
	}
	detSign = -(c.Y.Sign()) // db.Z * da.X
	if detSign != 0 {
		return Direction(detSign)
	}

	detSign = newBigFloat().Sub(newBigFloat().Mul(c.Z, a.X), newBigFloat().Mul(c.X, a.Z)).Sign() // db.Y
	if detSign != 0 {
		return Direction(detSign)
	}
	detSign = c.Z.Sign() // db.Y * da.X
	if detSign != 0 {
		return Direction(detSign)
	}

	// The following test is listed in the paper, but it is redundant because
	// the previous tests guarantee that C == (0, 0, 0).
	// (c.Y*a.Z - c.Z*a.Y).Sign() // db.X

	detSign = newBigFloat().Sub(newBigFloat().Mul(a.X, b.Y), newBigFloat().Mul(a.Y, b.X)).Sign() // dc.Z
	if detSign != 0 {
		return Direction(detSign)
	}
	detSign = -(b.X.Sign()) // dc.Z * da.Y
	if detSign != 0 {
		return Direction(detSign)
	}
	detSign = b.Y.Sign() // dc.Z * da.X
	if detSign != 0 {
		return Direction(detSign)
	}
	detSign = a.X.Sign() // dc.Z * db.Y
	if detSign != 0 {
		return Direction(detSign)
	}
	return CounterClockwise // dc.Z * db.Y * da.X
}

// CompareDistances returns -1, 0, or +1 according to whether AX < BX, A == B,
// or AX > BX respectively. Distances are measured with respect to the positions
// of X, A, and B as though they were reprojected to lie exactly on the surface of
// the unit sphere. Furthermore, this method uses symbolic perturbations to
// ensure that the result is non-zero whenever A != B, even when AX == BX
// exactly, or even when A and B project to the same point on the sphere.
// Such results are guaranteed to be self-consistent, i.e. if AB < BC and
// BC < AC, then AB < AC.
func CompareDistances(x, a, b Point) int {
	// We start by comparing distances using dot products (i.e., cosine of the
	// angle), because (1) this is the cheapest technique, and (2) it is valid
	// over the entire range of possible angles. (We can only use the sin^2
	// technique if both angles are less than 90 degrees or both angles are
	// greater than 90 degrees.)
	sign := triageCompareCosDistances(x, a, b)
	if sign != 0 {
		return sign
	}

	// Optimization for (a == b) to avoid falling back to exact arithmetic.
	if a == b {
		return 0
	}

	// It is much better numerically to compare distances using cos(angle) if
	// the distances are near 90 degrees and sin^2(angle) if the distances are
	// near 0 or 180 degrees. We only need to check one of the two angles when
	// making this decision because the fact that the test above failed means
	// that angles "a" and "b" are very close together.
	cosAX := a.Dot(x.Vector)
	if cosAX > 1/math.Sqrt2 {
		// Angles < 45 degrees.
		sign = triageCompareSin2Distances(x, a, b)
	} else if cosAX < -1/math.Sqrt2 {
		// Angles > 135 degrees. sin^2(angle) is decreasing in this range.
		sign = -triageCompareSin2Distances(x, a, b)
	}
	// C++ adds an additional check here using 80-bit floats.
	// This is skipped in Go because we only have 32 and 64 bit floats.

	if sign != 0 {
		return sign
	}

	sign = exactCompareDistances(r3.PreciseVectorFromVector(x.Vector), r3.PreciseVectorFromVector(a.Vector), r3.PreciseVectorFromVector(b.Vector))
	if sign != 0 {
		return sign
	}
	return symbolicCompareDistances(x, a, b)
}

// cosDistance returns cos(XY) where XY is the angle between X and Y, and the
// maximum error amount in the result. This requires X and Y be normalized.
func cosDistance(x, y Point) (cos, err float64) {
	cos = x.Dot(y.Vector)
	return cos, 9.5*dblError*math.Abs(cos) + 1.5*dblError
}

// sin2Distance returns sin**2(XY), where XY is the angle between X and Y,
// and the maximum error amount in the result. This requires X and Y be normalized.
func sin2Distance(x, y Point) (sin2, err float64) {
	// The (x-y).Cross(x+y) trick eliminates almost all of error due to x
	// and y being not quite unit length. This method is extremely accurate
	// for small distances; the *relative* error in the result is O(dblError) for
	// distances as small as dblError.
	n := x.Sub(y.Vector).Cross(x.Add(y.Vector))
	sin2 = 0.25 * n.Norm2()
	err = ((21+4*math.Sqrt(3))*dblError*sin2 +
		32*math.Sqrt(3)*dblError*dblError*math.Sqrt(sin2) +
		768*dblError*dblError*dblError*dblError)
	return sin2, err
}

// triageCompareCosDistances returns -1, 0, or +1 according to whether AX < BX,
// A == B, or AX > BX by comparing the distances between them using cosDistance.
func triageCompareCosDistances(x, a, b Point) int {
	cosAX, cosAXerror := cosDistance(a, x)
	cosBX, cosBXerror := cosDistance(b, x)
	diff := cosAX - cosBX
	err := cosAXerror + cosBXerror
	if diff > err {
		return -1
	}
	if diff < -err {
		return 1
	}
	return 0
}

// triageCompareSin2Distances returns -1, 0, or +1 according to whether AX < BX,
// A == B, or AX > BX by comparing the distances between them using sin2Distance.
func triageCompareSin2Distances(x, a, b Point) int {
	sin2AX, sin2AXerror := sin2Distance(a, x)
	sin2BX, sin2BXerror := sin2Distance(b, x)
	diff := sin2AX - sin2BX
	err := sin2AXerror + sin2BXerror
	if diff > err {
		return 1
	}
	if diff < -err {
		return -1
	}
	return 0
}

// exactCompareDistances returns -1, 0, or 1 after comparing using the values as
// PreciseVectors.
func exactCompareDistances(x, a, b r3.PreciseVector) int {
	// This code produces the same result as though all points were reprojected
	// to lie exactly on the surface of the unit sphere. It is based on testing
	// whether x.Dot(a.Normalize()) < x.Dot(b.Normalize()), reformulated
	// so that it can be evaluated using exact arithmetic.
	cosAX := x.Dot(a)
	cosBX := x.Dot(b)

	// If the two values have different signs, we need to handle that case now
	// before squaring them below.
	aSign := cosAX.Sign()
	bSign := cosBX.Sign()
	if aSign != bSign {
		// If cos(AX) > cos(BX), then AX < BX.
		if aSign > bSign {
			return -1
		}
		return 1
	}
	cosAX2 := newBigFloat().Mul(cosAX, cosAX)
	cosBX2 := newBigFloat().Mul(cosBX, cosBX)
	cmp := newBigFloat().Sub(cosBX2.Mul(cosBX2, a.Norm2()), cosAX2.Mul(cosAX2, b.Norm2()))
	return aSign * cmp.Sign()
}

// symbolicCompareDistances returns -1, 0, or +1 given three points such that AX == BX
// (exactly) according to whether AX < BX, AX == BX, or AX > BX after symbolic
// perturbations are taken into account.
func symbolicCompareDistances(x, a, b Point) int {
	// Our symbolic perturbation strategy is based on the following model.
	// Similar to "simulation of simplicity", we assign a perturbation to every
	// point such that if A < B, then the symbolic perturbation for A is much,
	// much larger than the symbolic perturbation for B. We imagine that
	// rather than projecting every point to lie exactly on the unit sphere,
	// instead each point is positioned on its own tiny pedestal that raises it
	// just off the surface of the unit sphere. This means that the distance AX
	// is actually the true distance AX plus the (symbolic) heights of the
	// pedestals for A and X. The pedestals are infinitesmally thin, so they do
	// not affect distance measurements except at the two endpoints. If several
	// points project to exactly the same point on the unit sphere, we imagine
	// that they are placed on separate pedestals placed close together, where
	// the distance between pedestals is much, much less than the height of any
	// pedestal. (There are a finite number of Points, and therefore a finite
	// number of pedestals, so this is possible.)
	//
	// If A < B, then A is on a higher pedestal than B, and therefore AX > BX.
	switch a.Cmp(b.Vector) {
	case -1:
		return 1
	case 1:
		return -1
	default:
		return 0
	}
}

var (
	// ca45Degrees is a predefined ChordAngle representing (approximately) 45 degrees.
	ca45Degrees = s1.ChordAngleFromSquaredLength(2 - math.Sqrt2)
)

// CompareDistance returns -1, 0, or +1 according to whether the distance XY is
// respectively less than, equal to, or greater than the provided chord angle. Distances are measured
// with respect to the positions of all points as though they are projected to lie
// exactly on the surface of the unit sphere.
func CompareDistance(x, y Point, r s1.ChordAngle) int {
	// As with CompareDistances, we start by comparing dot products because
	// the sin^2 method is only valid when the distance XY and the limit "r" are
	// both less than 90 degrees.
	sign := triageCompareCosDistance(x, y, float64(r))
	if sign != 0 {
		return sign
	}

	// Unlike with CompareDistances, it's not worth using the sin^2 method
	// when the distance limit is near 180 degrees because the ChordAngle
	// representation itself has has a rounding error of up to 2e-8 radians for
	// distances near 180 degrees.
	if r < ca45Degrees {
		sign = triageCompareSin2Distance(x, y, float64(r))
		if sign != 0 {
			return sign
		}
	}
	return exactCompareDistance(r3.PreciseVectorFromVector(x.Vector), r3.PreciseVectorFromVector(y.Vector), big.NewFloat(float64(r)).SetPrec(big.MaxPrec))
}

// triageCompareCosDistance returns -1, 0, or +1 according to whether the distance XY is
// less than, equal to, or greater than r2 respectively using cos distance.
func triageCompareCosDistance(x, y Point, r2 float64) int {
	cosXY, cosXYError := cosDistance(x, y)
	cosR := 1.0 - 0.5*r2
	cosRError := 2.0 * dblError * cosR
	diff := cosXY - cosR
	err := cosXYError + cosRError
	if diff > err {
		return -1
	}
	if diff < -err {
		return 1
	}
	return 0
}

// triageCompareSin2Distance returns -1, 0, or +1 according to whether the distance XY is
// less than, equal to, or greater than r2 respectively using sin^2 distance.
func triageCompareSin2Distance(x, y Point, r2 float64) int {
	// Only valid for distance limits < 90 degrees.
	sin2XY, sin2XYError := sin2Distance(x, y)
	sin2R := r2 * (1.0 - 0.25*r2)
	sin2RError := 3.0 * dblError * sin2R
	diff := sin2XY - sin2R
	err := sin2XYError + sin2RError
	if diff > err {
		return 1
	}
	if diff < -err {
		return -1
	}
	return 0
}

var (
	bigOne  = big.NewFloat(1.0).SetPrec(big.MaxPrec)
	bigHalf = big.NewFloat(0.5).SetPrec(big.MaxPrec)
)

// exactCompareDistance returns -1, 0, or +1 after comparing using PreciseVectors.
func exactCompareDistance(x, y r3.PreciseVector, r2 *big.Float) int {
	// This code produces the same result as though all points were reprojected
	// to lie exactly on the surface of the unit sphere.  It is based on
	// comparing the cosine of the angle XY (when both points are projected to
	// lie exactly on the sphere) to the given threshold.
	cosXY := x.Dot(y)
	cosR := newBigFloat().Sub(bigOne, newBigFloat().Mul(bigHalf, r2))

	// If the two values have different signs, we need to handle that case now
	// before squaring them below.
	xySign := cosXY.Sign()
	rSign := cosR.Sign()
	if xySign != rSign {
		if xySign > rSign {
			return -1
		}
		return 1 // If cos(XY) > cos(r), then XY < r.
	}
	cmp := newBigFloat().Sub(
		newBigFloat().Mul(
			newBigFloat().Mul(cosR, cosR), newBigFloat().Mul(x.Norm2(), y.Norm2())),
		newBigFloat().Mul(cosXY, cosXY))
	return xySign * cmp.Sign()
}

// TODO(roberts): Differences from C++
// CompareEdgeDistance
// CompareEdgeDirections
// EdgeCircumcenterSign
// GetVoronoiSiteExclusion
// GetClosestVertex
// TriageCompareLineSin2Distance
// TriageCompareLineCos2Distance
// TriageCompareLineDistance
// TriageCompareEdgeDistance
// ExactCompareLineDistance
// ExactCompareEdgeDistance
// TriageCompareEdgeDirections
// ExactCompareEdgeDirections
// ArePointsAntipodal
// ArePointsLinearlyDependent
// GetCircumcenter
// TriageEdgeCircumcenterSign
// ExactEdgeCircumcenterSign
// UnperturbedSign
// SymbolicEdgeCircumcenterSign
// ExactVoronoiSiteExclusion
