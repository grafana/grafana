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
	"math"

	"github.com/golang/geo/r1"
	"github.com/golang/geo/r3"
	"github.com/golang/geo/s1"
)

// RectBounder is used to compute a bounding rectangle that contains all edges
// defined by a vertex chain (v0, v1, v2, ...). All vertices must be unit length.
// Note that the bounding rectangle of an edge can be larger than the bounding
// rectangle of its endpoints, e.g. consider an edge that passes through the North Pole.
//
// The bounds are calculated conservatively to account for numerical errors
// when points are converted to LatLngs. More precisely, this function
// guarantees the following:
// Let L be a closed edge chain (Loop) such that the interior of the loop does
// not contain either pole. Now if P is any point such that L.ContainsPoint(P),
// then RectBound(L).ContainsPoint(LatLngFromPoint(P)).
type RectBounder struct {
	// The previous vertex in the chain.
	a Point
	// The previous vertex latitude longitude.
	aLL   LatLng
	bound Rect
}

// NewRectBounder returns a new instance of a RectBounder.
func NewRectBounder() *RectBounder {
	return &RectBounder{
		bound: EmptyRect(),
	}
}

// maxErrorForTests returns the maximum error in RectBound provided that the
// result does not include either pole. It is only used for testing purposes
func (r *RectBounder) maxErrorForTests() LatLng {
	// The maximum error in the latitude calculation is
	//    3.84 * dblEpsilon   for the PointCross calculation
	//    0.96 * dblEpsilon   for the Latitude calculation
	//    5    * dblEpsilon   added by AddPoint/RectBound to compensate for error
	//    -----------------
	//    9.80 * dblEpsilon   maximum error in result
	//
	// The maximum error in the longitude calculation is dblEpsilon. RectBound
	// does not do any expansion because this isn't necessary in order to
	// bound the *rounded* longitudes of contained points.
	return LatLng{10 * dblEpsilon * s1.Radian, 1 * dblEpsilon * s1.Radian}
}

// AddPoint adds the given point to the chain. The Point must be unit length.
func (r *RectBounder) AddPoint(b Point) {
	bLL := LatLngFromPoint(b)

	if r.bound.IsEmpty() {
		r.a = b
		r.aLL = bLL
		r.bound = r.bound.AddPoint(bLL)
		return
	}

	// First compute the cross product N = A x B robustly. This is the normal
	// to the great circle through A and B. We don't use RobustSign
	// since that method returns an arbitrary vector orthogonal to A if the two
	// vectors are proportional, and we want the zero vector in that case.
	n := r.a.Sub(b.Vector).Cross(r.a.Add(b.Vector)) // N = 2 * (A x B)

	// The relative error in N gets large as its norm gets very small (i.e.,
	// when the two points are nearly identical or antipodal). We handle this
	// by choosing a maximum allowable error, and if the error is greater than
	// this we fall back to a different technique. Since it turns out that
	// the other sources of error in converting the normal to a maximum
	// latitude add up to at most 1.16 * dblEpsilon, and it is desirable to
	// have the total error be a multiple of dblEpsilon, we have chosen to
	// limit the maximum error in the normal to be 3.84 * dblEpsilon.
	// It is possible to show that the error is less than this when
	//
	// n.Norm() >= 8 * sqrt(3) / (3.84 - 0.5 - sqrt(3)) * dblEpsilon
	//          = 1.91346e-15 (about 8.618 * dblEpsilon)
	nNorm := n.Norm()
	if nNorm < 1.91346e-15 {
		// A and B are either nearly identical or nearly antipodal (to within
		// 4.309 * dblEpsilon, or about 6 nanometers on the earth's surface).
		if r.a.Dot(b.Vector) < 0 {
			// The two points are nearly antipodal. The easiest solution is to
			// assume that the edge between A and B could go in any direction
			// around the sphere.
			r.bound = FullRect()
		} else {
			// The two points are nearly identical (to within 4.309 * dblEpsilon).
			// In this case we can just use the bounding rectangle of the points,
			// since after the expansion done by GetBound this Rect is
			// guaranteed to include the (lat,lng) values of all points along AB.
			r.bound = r.bound.Union(RectFromLatLng(r.aLL).AddPoint(bLL))
		}
		r.a = b
		r.aLL = bLL
		return
	}

	// Compute the longitude range spanned by AB.
	lngAB := s1.EmptyInterval().AddPoint(r.aLL.Lng.Radians()).AddPoint(bLL.Lng.Radians())
	if lngAB.Length() >= math.Pi-2*dblEpsilon {
		// The points lie on nearly opposite lines of longitude to within the
		// maximum error of the calculation. The easiest solution is to assume
		// that AB could go on either side of the pole.
		lngAB = s1.FullInterval()
	}

	// Next we compute the latitude range spanned by the edge AB. We start
	// with the range spanning the two endpoints of the edge:
	latAB := r1.IntervalFromPoint(r.aLL.Lat.Radians()).AddPoint(bLL.Lat.Radians())

	// This is the desired range unless the edge AB crosses the plane
	// through N and the Z-axis (which is where the great circle through A
	// and B attains its minimum and maximum latitudes). To test whether AB
	// crosses this plane, we compute a vector M perpendicular to this
	// plane and then project A and B onto it.
	m := n.Cross(r3.Vector{0, 0, 1})
	mA := m.Dot(r.a.Vector)
	mB := m.Dot(b.Vector)

	// We want to test the signs of "mA" and "mB", so we need to bound
	// the error in these calculations. It is possible to show that the
	// total error is bounded by
	//
	// (1 + sqrt(3)) * dblEpsilon * nNorm + 8 * sqrt(3) * (dblEpsilon**2)
	//   = 6.06638e-16 * nNorm + 6.83174e-31

	mError := 6.06638e-16*nNorm + 6.83174e-31
	if mA*mB < 0 || math.Abs(mA) <= mError || math.Abs(mB) <= mError {
		// Minimum/maximum latitude *may* occur in the edge interior.
		//
		// The maximum latitude is 90 degrees minus the latitude of N. We
		// compute this directly using atan2 in order to get maximum accuracy
		// near the poles.
		//
		// Our goal is compute a bound that contains the computed latitudes of
		// all S2Points P that pass the point-in-polygon containment test.
		// There are three sources of error we need to consider:
		// - the directional error in N (at most 3.84 * dblEpsilon)
		// - converting N to a maximum latitude
		// - computing the latitude of the test point P
		// The latter two sources of error are at most 0.955 * dblEpsilon
		// individually, but it is possible to show by a more complex analysis
		// that together they can add up to at most 1.16 * dblEpsilon, for a
		// total error of 5 * dblEpsilon.
		//
		// We add 3 * dblEpsilon to the bound here, and GetBound() will pad
		// the bound by another 2 * dblEpsilon.
		maxLat := math.Min(
			math.Atan2(math.Sqrt(n.X*n.X+n.Y*n.Y), math.Abs(n.Z))+3*dblEpsilon,
			math.Pi/2)

		// In order to get tight bounds when the two points are close together,
		// we also bound the min/max latitude relative to the latitudes of the
		// endpoints A and B. First we compute the distance between A and B,
		// and then we compute the maximum change in latitude between any two
		// points along the great circle that are separated by this distance.
		// This gives us a latitude change "budget". Some of this budget must
		// be spent getting from A to B; the remainder bounds the round-trip
		// distance (in latitude) from A or B to the min or max latitude
		// attained along the edge AB.
		latBudget := 2 * math.Asin(0.5*(r.a.Sub(b.Vector)).Norm()*math.Sin(maxLat))
		maxDelta := 0.5*(latBudget-latAB.Length()) + dblEpsilon

		// Test whether AB passes through the point of maximum latitude or
		// minimum latitude. If the dot product(s) are small enough then the
		// result may be ambiguous.
		if mA <= mError && mB >= -mError {
			latAB.Hi = math.Min(maxLat, latAB.Hi+maxDelta)
		}
		if mB <= mError && mA >= -mError {
			latAB.Lo = math.Max(-maxLat, latAB.Lo-maxDelta)
		}
	}
	r.a = b
	r.aLL = bLL
	r.bound = r.bound.Union(Rect{latAB, lngAB})
}

// RectBound returns the bounding rectangle of the edge chain that connects the
// vertices defined so far. This bound satisfies the guarantee made
// above, i.e. if the edge chain defines a Loop, then the bound contains
// the LatLng coordinates of all Points contained by the loop.
func (r *RectBounder) RectBound() Rect {
	return r.bound.expanded(LatLng{s1.Angle(2 * dblEpsilon), 0}).PolarClosure()
}

// ExpandForSubregions expands a bounding Rect so that it is guaranteed to
// contain the bounds of any subregion whose bounds are computed using
// ComputeRectBound. For example, consider a loop L that defines a square.
// GetBound ensures that if a point P is contained by this square, then
// LatLngFromPoint(P) is contained by the bound. But now consider a diamond
// shaped loop S contained by L. It is possible that GetBound returns a
// *larger* bound for S than it does for L, due to rounding errors. This
// method expands the bound for L so that it is guaranteed to contain the
// bounds of any subregion S.
//
// More precisely, if L is a loop that does not contain either pole, and S
// is a loop such that L.Contains(S), then
//
//   ExpandForSubregions(L.RectBound).Contains(S.RectBound).
//
func ExpandForSubregions(bound Rect) Rect {
	// Empty bounds don't need expansion.
	if bound.IsEmpty() {
		return bound
	}

	// First we need to check whether the bound B contains any nearly-antipodal
	// points (to within 4.309 * dblEpsilon). If so then we need to return
	// FullRect, since the subregion might have an edge between two
	// such points, and AddPoint returns Full for such edges. Note that
	// this can happen even if B is not Full for example, consider a loop
	// that defines a 10km strip straddling the equator extending from
	// longitudes -100 to +100 degrees.
	//
	// It is easy to check whether B contains any antipodal points, but checking
	// for nearly-antipodal points is trickier. Essentially we consider the
	// original bound B and its reflection through the origin B', and then test
	// whether the minimum distance between B and B' is less than 4.309 * dblEpsilon.

	// lngGap is a lower bound on the longitudinal distance between B and its
	// reflection B'. (2.5 * dblEpsilon is the maximum combined error of the
	// endpoint longitude calculations and the Length call.)
	lngGap := math.Max(0, math.Pi-bound.Lng.Length()-2.5*dblEpsilon)

	// minAbsLat is the minimum distance from B to the equator (if zero or
	// negative, then B straddles the equator).
	minAbsLat := math.Max(bound.Lat.Lo, -bound.Lat.Hi)

	// latGapSouth and latGapNorth measure the minimum distance from B to the
	// south and north poles respectively.
	latGapSouth := math.Pi/2 + bound.Lat.Lo
	latGapNorth := math.Pi/2 - bound.Lat.Hi

	if minAbsLat >= 0 {
		// The bound B does not straddle the equator. In this case the minimum
		// distance is between one endpoint of the latitude edge in B closest to
		// the equator and the other endpoint of that edge in B'. The latitude
		// distance between these two points is 2*minAbsLat, and the longitude
		// distance is lngGap. We could compute the distance exactly using the
		// Haversine formula, but then we would need to bound the errors in that
		// calculation. Since we only need accuracy when the distance is very
		// small (close to 4.309 * dblEpsilon), we substitute the Euclidean
		// distance instead. This gives us a right triangle XYZ with two edges of
		// length x = 2*minAbsLat and y ~= lngGap. The desired distance is the
		// length of the third edge z, and we have
		//
		//         z  ~=  sqrt(x^2 + y^2)  >=  (x + y) / sqrt(2)
		//
		// Therefore the region may contain nearly antipodal points only if
		//
		//  2*minAbsLat + lngGap  <  sqrt(2) * 4.309 * dblEpsilon
		//                        ~= 1.354e-15
		//
		// Note that because the given bound B is conservative, minAbsLat and
		// lngGap are both lower bounds on their true values so we do not need
		// to make any adjustments for their errors.
		if 2*minAbsLat+lngGap < 1.354e-15 {
			return FullRect()
		}
	} else if lngGap >= math.Pi/2 {
		// B spans at most Pi/2 in longitude. The minimum distance is always
		// between one corner of B and the diagonally opposite corner of B'. We
		// use the same distance approximation that we used above; in this case
		// we have an obtuse triangle XYZ with two edges of length x = latGapSouth
		// and y = latGapNorth, and angle Z >= Pi/2 between them. We then have
		//
		//         z  >=  sqrt(x^2 + y^2)  >=  (x + y) / sqrt(2)
		//
		// Unlike the case above, latGapSouth and latGapNorth are not lower bounds
		// (because of the extra addition operation, and because math.Pi/2 is not
		// exactly equal to Pi/2); they can exceed their true values by up to
		// 0.75 * dblEpsilon. Putting this all together, the region may contain
		// nearly antipodal points only if
		//
		//   latGapSouth + latGapNorth  <  (sqrt(2) * 4.309 + 1.5) * dblEpsilon
		//                              ~= 1.687e-15
		if latGapSouth+latGapNorth < 1.687e-15 {
			return FullRect()
		}
	} else {
		// Otherwise we know that (1) the bound straddles the equator and (2) its
		// width in longitude is at least Pi/2. In this case the minimum
		// distance can occur either between a corner of B and the diagonally
		// opposite corner of B' (as in the case above), or between a corner of B
		// and the opposite longitudinal edge reflected in B'. It is sufficient
		// to only consider the corner-edge case, since this distance is also a
		// lower bound on the corner-corner distance when that case applies.

		// Consider the spherical triangle XYZ where X is a corner of B with
		// minimum absolute latitude, Y is the closest pole to X, and Z is the
		// point closest to X on the opposite longitudinal edge of B'. This is a
		// right triangle (Z = Pi/2), and from the spherical law of sines we have
		//
		//     sin(z) / sin(Z)  =  sin(y) / sin(Y)
		//     sin(maxLatGap) / 1  =  sin(dMin) / sin(lngGap)
		//     sin(dMin)  =  sin(maxLatGap) * sin(lngGap)
		//
		// where "maxLatGap" = max(latGapSouth, latGapNorth) and "dMin" is the
		// desired minimum distance. Now using the facts that sin(t) >= (2/Pi)*t
		// for 0 <= t <= Pi/2, that we only need an accurate approximation when
		// at least one of "maxLatGap" or lngGap is extremely small (in which
		// case sin(t) ~= t), and recalling that "maxLatGap" has an error of up
		// to 0.75 * dblEpsilon, we want to test whether
		//
		//   maxLatGap * lngGap  <  (4.309 + 0.75) * (Pi/2) * dblEpsilon
		//                       ~= 1.765e-15
		if math.Max(latGapSouth, latGapNorth)*lngGap < 1.765e-15 {
			return FullRect()
		}
	}
	// Next we need to check whether the subregion might contain any edges that
	// span (math.Pi - 2 * dblEpsilon) radians or more in longitude, since AddPoint
	// sets the longitude bound to Full in that case. This corresponds to
	// testing whether (lngGap <= 0) in lngExpansion below.

	// Otherwise, the maximum latitude error in AddPoint is 4.8 * dblEpsilon.
	// In the worst case, the errors when computing the latitude bound for a
	// subregion could go in the opposite direction as the errors when computing
	// the bound for the original region, so we need to double this value.
	// (More analysis shows that it's okay to round down to a multiple of
	// dblEpsilon.)
	//
	// For longitude, we rely on the fact that atan2 is correctly rounded and
	// therefore no additional bounds expansion is necessary.

	latExpansion := 9 * dblEpsilon
	lngExpansion := 0.0
	if lngGap <= 0 {
		lngExpansion = math.Pi
	}
	return bound.expanded(LatLng{s1.Angle(latExpansion), s1.Angle(lngExpansion)}).PolarClosure()
}
