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

	"github.com/blevesearch/geo/s1"
)

// PointArea returns the area of triangle ABC. This method combines two different
// algorithms to get accurate results for both large and small triangles.
// The maximum error is about 5e-15 (about 0.25 square meters on the Earth's
// surface), the same as GirardArea below, but unlike that method it is
// also accurate for small triangles. Example: when the true area is 100
// square meters, PointArea yields an error about 1 trillion times smaller than
// GirardArea.
//
// All points should be unit length, and no two points should be antipodal.
// The area is always positive.
func PointArea(a, b, c Point) float64 {
	// This method is based on l'Huilier's theorem,
	//
	//   tan(E/4) = sqrt(tan(s/2) tan((s-a)/2) tan((s-b)/2) tan((s-c)/2))
	//
	// where E is the spherical excess of the triangle (i.e. its area),
	//       a, b, c are the side lengths, and
	//       s is the semiperimeter (a + b + c) / 2.
	//
	// The only significant source of error using l'Huilier's method is the
	// cancellation error of the terms (s-a), (s-b), (s-c). This leads to a
	// *relative* error of about 1e-16 * s / min(s-a, s-b, s-c). This compares
	// to a relative error of about 1e-15 / E using Girard's formula, where E is
	// the true area of the triangle. Girard's formula can be even worse than
	// this for very small triangles, e.g. a triangle with a true area of 1e-30
	// might evaluate to 1e-5.
	//
	// So, we prefer l'Huilier's formula unless dmin < s * (0.1 * E), where
	// dmin = min(s-a, s-b, s-c). This basically includes all triangles
	// except for extremely long and skinny ones.
	//
	// Since we don't know E, we would like a conservative upper bound on
	// the triangle area in terms of s and dmin. It's possible to show that
	// E <= k1 * s * sqrt(s * dmin), where k1 = 2*sqrt(3)/Pi (about 1).
	// Using this, it's easy to show that we should always use l'Huilier's
	// method if dmin >= k2 * s^5, where k2 is about 1e-2. Furthermore,
	// if dmin < k2 * s^5, the triangle area is at most k3 * s^4, where
	// k3 is about 0.1. Since the best case error using Girard's formula
	// is about 1e-15, this means that we shouldn't even consider it unless
	// s >= 3e-4 or so.
	sa := b.stableAngle(c)
	sb := c.stableAngle(a)
	sc := a.stableAngle(b)
	s := 0.5 * (sa + sb + sc)
	if s >= 3e-4 {
		// Consider whether Girard's formula might be more accurate.
		dmin := s - maxAngle(sa, sb, sc)
		if dmin < 1e-2*s*s*s*s*s {
			// This triangle is skinny enough to use Girard's formula.
			area := GirardArea(a, b, c)
			if dmin < s*0.1*s1.Angle(area+5e-15) {
				return area
			}
		}
	}

	// Use l'Huilier's formula.
	return 4 * math.Atan(math.Sqrt(math.Max(0.0,
		math.Tan(float64(0.5*s))*math.Tan(0.5*float64(s-sa))*
			math.Tan(0.5*float64(s-sb))*math.Tan(0.5*float64(s-sc)))))
}

// GirardArea returns the area of the triangle computed using Girard's formula.
// All points should be unit length, and no two points should be antipodal.
//
// This method is about twice as fast as PointArea() but has poor relative
// accuracy for small triangles. The maximum error is about 5e-15 (about
// 0.25 square meters on the Earth's surface) and the average error is about
// 1e-15. These bounds apply to triangles of any size, even as the maximum
// edge length of the triangle approaches 180 degrees. But note that for
// such triangles, tiny perturbations of the input points can change the
// true mathematical area dramatically.
func GirardArea(a, b, c Point) float64 {
	// This is equivalent to the usual Girard's formula but is slightly more
	// accurate, faster to compute, and handles a == b == c without a special
	// case. PointCross is necessary to get good accuracy when two of
	// the input points are very close together.
	ab := a.PointCross(b)
	bc := b.PointCross(c)
	ac := a.PointCross(c)

	area := float64(ab.Angle(ac.Vector) - ab.Angle(bc.Vector) + bc.Angle(ac.Vector))
	if area < 0 {
		area = 0
	}
	return area
}

// SignedArea returns a positive value for counterclockwise triangles and a negative
// value otherwise (similar to PointArea).
func SignedArea(a, b, c Point) float64 {
	return float64(RobustSign(a, b, c)) * PointArea(a, b, c)
}

// Angle returns the interior angle at the vertex B in the triangle ABC. The
// return value is always in the range [0, pi]. All points should be
// normalized. Ensures that Angle(a,b,c) == Angle(c,b,a) for all a,b,c.
//
// The angle is undefined if A or C is diametrically opposite from B, and
// becomes numerically unstable as the length of edge AB or BC approaches
// 180 degrees.
func Angle(a, b, c Point) s1.Angle {
	// PointCross is necessary to get good accuracy when two of the input
	// points are very close together.
	return a.PointCross(b).Angle(c.PointCross(b).Vector)
}

// TurnAngle returns the exterior angle at vertex B in the triangle ABC. The
// return value is positive if ABC is counterclockwise and negative otherwise.
// If you imagine an ant walking from A to B to C, this is the angle that the
// ant turns at vertex B (positive = left = CCW, negative = right = CW).
// This quantity is also known as the "geodesic curvature" at B.
//
// Ensures that TurnAngle(a,b,c) == -TurnAngle(c,b,a) for all distinct
// a,b,c. The result is undefined if (a == b || b == c), but is either
// -Pi or Pi if (a == c). All points should be normalized.
func TurnAngle(a, b, c Point) s1.Angle {
	// We use PointCross to get good accuracy when two points are very
	// close together, and RobustSign to ensure that the sign is correct for
	// turns that are close to 180 degrees.
	angle := a.PointCross(b).Angle(b.PointCross(c).Vector)

	// Don't return RobustSign * angle because it is legal to have (a == c).
	if RobustSign(a, b, c) == CounterClockwise {
		return angle
	}
	return -angle
}
