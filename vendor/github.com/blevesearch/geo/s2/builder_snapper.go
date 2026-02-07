// Copyright 2023 Google Inc. All rights reserved.
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

// A Snapper restricts the locations of the output vertices. For
// example, there are predefined snap functions that require vertices to be
// located at CellID centers or at E5/E6/E7 coordinates. The Snapper
// can also specify a minimum spacing between vertices (i.e. the snap radius).
//
// A Snapper defines the following methods:
//
//  1. The SnapPoint method, which snaps a point P to a nearby point (the
//     candidate snap site). Any point may be returned, including P
//     itself (the identity snap function).
//
//  2. SnapRadius, the maximum distance that vertices can move when
//     snapped. The snapRadius must be at least as large as the maximum
//     distance between P and SnapPoint(P) for any point P.
//
//     Note that the maximum distance that edge interiors can move when
//     snapped is slightly larger than "snapRadius", and is reported by
//     the Builder options maxEdgeDeviation (see there for details).
//
//  3. MinVertexSeparation, the guaranteed minimum distance between
//     vertices in the output. This is generally a fraction of
//     snapRadius where the fraction depends on the snap function.
//
//  4. A MinEdgeVertexSeparation, the guaranteed minimum distance
//     between edges and non-incident vertices in the output. This is
//     generally a fraction of snapRadius where the fraction depends on
//     the snap function.
//
// It is important to note that SnapPoint does not define the actual
// mapping from input vertices to output vertices, since the points it
// returns (the candidate snap sites) are further filtered to ensure that
// they are separated by at least the snap radius. For example, if you
// specify E7 coordinates (2cm resolution) and a snap radius of 10m, then a
// subset of points returned by SnapPoint will be chosen (the snap sites),
// and each input vertex will be mapped to the closest site. Therefore you
// cannot assume that P is necessarily snapped to SnapPoint(P).
//
// Builder makes the following guarantees (within a small error margin):
//
//  1. Every vertex is at a location returned by SnapPoint.
//
//  2. Vertices are within snapRadius of the corresponding input vertex.
//
//  3. Edges are within maxEdgeDeviation of the corresponding input edge
//     (a distance slightly larger than snapRadius).
//
//  4. Vertices are separated by at least minVertexSeparation
//     (a fraction of snapRadius that depends on the snap function).
//
//  5. Edges and non-incident vertices are separated by at least
//     minEdgeVertexSeparation (a fraction of snapRadius).
//
//  6. Vertex and edge locations do not change unless one of the conditions
//     above is not already met (idempotency / stability).
//
//  7. The topology of the input geometry is preserved (up to the creation
//     of degeneracies). This means that there exists a continuous
//     deformation from the input to the output such that no vertex
//     crosses an edge.
type Snapper interface {
	// SnapRadius reports the maximum distance that vertices can move when
	// snapped. The snap radius can be any value between 0 and maxSnapRadius.
	//
	// If the snap radius is zero, then vertices are snapped together only if
	// they are identical. Edges will not be snapped to any vertices other
	// than their endpoints, even if there are vertices whose distance to the
	// edge is zero, unless split_crossing_edges() is true (see below).
	SnapRadius() s1.Angle
	// TODO(rsned): Add SetSnapRadius method to allow users to update value.

	// MinVertexSeparation returns the guaranteed minimum distance between
	// vertices in the output. This is generally some fraction of SnapRadius.
	MinVertexSeparation() s1.Angle

	// MinEdgeVertexSeparation returns the guaranteed minimum spacing between
	// edges and non-incident vertices in the output. This is generally some
	// fraction of SnapRadius.
	MinEdgeVertexSeparation() s1.Angle

	// SnapPoint returns a candidate snap site for the given point. The final vertex
	// locations are a subset of the snap sites returned by this function
	// (spaced at least MinVertexSeparation apart).
	//
	// The only requirement is that SnapPoint(x) must return a point whose
	// distance from x is no greater than SnapRadius.
	SnapPoint(point Point) Point
}

// Ensure the various snapping function types satisfy the interface.
var (
	_ Snapper = IdentitySnapper{}
	_ Snapper = CellIDSnapper{}
	_ Snapper = IntLatLngSnapper{}
)

// maxSnapRadius defines the maximum supported snap radius (equivalent to about 7800km).
// This value can't be larger than 85.7 degrees without changing the code
// related to minEdgeLengthToSplitChordAngle, and increasing it to 90 degrees
// or more would most likely require significant changes to the algorithm.
const maxSnapRadius = 70 * s1.Degree

// IdentitySnapper is a Snapper that snaps every vertex to itself.
// It should be used when vertices do not need to be snapped to a discrete set
// of locations (such as E7 lat/lngs), or when maximum accuracy is desired.
//
// If the snapRadius is zero, then all input vertices are preserved
// exactly. Otherwise, Builder merges nearby vertices to ensure that no
// vertex pair is closer than snapRadius. Furthermore, vertices are
// separated from non-incident edges by at least MinEdgeVertexSeparation,
// equal to (0.5 * snapRadius). For example, if the snapRadius is 1km, then
// vertices will be separated from non-incident edges by at least 500m.
type IdentitySnapper struct {
	snapRadius s1.Angle
}

// NewIdentitySnapper returns an IdentitySnapper with the given snap radius.
func NewIdentitySnapper(snapRadius s1.Angle) IdentitySnapper {
	return IdentitySnapper{
		snapRadius: snapRadius,
	}
}

// SnapRadius returns this types snapping radius.
func (sf IdentitySnapper) SnapRadius() s1.Angle {
	return sf.snapRadius
}

// MinVertexSeparation returns the minimum vertex separation for this snap type.
func (sf IdentitySnapper) MinVertexSeparation() s1.Angle {
	// Since SnapFunction does not move the input point, output vertices are
	// separated by the full snapRadius.
	return sf.snapRadius
}

// MinEdgeVertexSeparation returns the minimum edge vertex separation.
// For the identity snap function, edges are separated from all non-incident
// vertices by at least 0.5 * snapRadius.
func (sf IdentitySnapper) MinEdgeVertexSeparation() s1.Angle {
	// In the worst case configuration, the edge-vertex separation is half of the
	// vertex separation.
	return 0.5 * sf.snapRadius
}

// SnapPoint snaps the given point to the appropriate level for this type.
func (sf IdentitySnapper) SnapPoint(point Point) Point {
	return point
}

// CellIDSnapper is a type that snaps vertices to CellID centers. This can
// be useful if you want to encode your geometry compactly for example. You can
// snap to the centers of cells at any level.
//
// Every snap level has a corresponding minimum snap radius, which is simply
// the maximum distance that a vertex can move when snapped. It is
// approximately equal to half of the maximum diagonal length for cells at the
// chosen level. You can also set the snap radius to a larger value; for
// example, you could snap to the centers of leaf cells (1cm resolution) but
// set the snapRadius to 10m. This would result in significant extra
// simplification, without moving vertices unnecessarily (i.e., vertices that
// are at least 10m away from all other vertices will move by less than 1cm).
type CellIDSnapper struct {
	level      int
	snapRadius s1.Angle
}

// TODO(rsned): Add SetLevel method to allow changes to the type.

// NewCellIDSnapper returns a snap function with the default level set.
func NewCellIDSnapper() CellIDSnapper {
	return CellIDSnapper{
		level: MaxLevel,
	}
}

// CellIDSnapperForLevel returns a snap function at the given level.
func CellIDSnapperForLevel(level int) CellIDSnapper {
	sf := CellIDSnapper{
		level: level,
	}
	sf.snapRadius = sf.minSnapRadiusForLevel(level)
	return sf
}

// SnapRadius reports the maximum distance that vertices can move when snapped.
// This requires that SnapRadius <= maxSnapRadius
func (sf CellIDSnapper) SnapRadius() s1.Angle {
	return sf.snapRadius
}

// minSnapRadiusForLevel returns the minimum allowable snap radius for the given level
// (approximately equal to half of the maximum cell diagonal length).
func (sf CellIDSnapper) minSnapRadiusForLevel(level int) s1.Angle {
	// snapRadius needs to be an upper bound on the true distance that a
	// point can move when snapped, taking into account numerical errors.
	//
	// The maximum error when converting from a Point to a CellID is
	// MaxDiagMetric.Deriv * dblEpsilon. The maximum error when converting a
	// CellID center back to a Point is 1.5 * dblEpsilon. These add up to
	// just slightly less than 4 * dblEpsilon.
	return s1.Angle(0.5*MaxDiagMetric.Value(level) + 4*dblEpsilon)
}

// levelForMaxSnapRadius reports the minimum Cell level (i.e., largest Cells) such
// that vertices will not move by more than snapRadius. This can be useful
// when choosing an appropriate level to snap to. The return value is
// always a valid level (out of range values are silently clamped).
//
// If you want to choose the snap level based on a distance, and then use
// the minimum possible snap radius for the chosen level, do this:
//
//	sf := CellIDSnapperForLevel(f.levelForMaxSnapRadius(distance));
//
// TODO(rsned): pop this method out to standalone.
func (sf CellIDSnapper) levelForMaxSnapRadius(snapRadius s1.Angle) int {
	// When choosing a level, we need to account for the error bound of
	// 4 * dblEpsilon that is added by MinSnapRadiusForLevel.
	return MaxDiagMetric.MinLevel(2 * (snapRadius.Radians() - 4*dblEpsilon))
}

// MinVertexSeparation reports the minimum separation between vertices depending
// on level and snapRadius. It can vary between 0.5 * snapRadius and snapRadius.
func (sf CellIDSnapper) MinVertexSeparation() s1.Angle {
	// We have three different bounds for the minimum vertex separation: one is
	// a constant bound, one is proportional to snapRadius, and one is equal to
	// snapRadius minus a constant. These bounds give the best results for
	// small, medium, and large snap radii respectively. We return the maximum
	// of the three bounds.
	//
	// 1. Constant bound: Vertices are always separated by at least
	//    MinEdgeMetric.Value(level), the minimum edge length for the chosen
	//    snap level.
	//
	// 2. Proportional bound: It can be shown that in the plane, the worst-case
	//    configuration has a vertex separation of 2 / sqrt(13) * snapRadius.
	//    This is verified in the unit test, except that on the sphere the ratio
	//    is slightly smaller at cell level 2 (0.54849 vs. 0.55470).  We reduce
	//    that value a bit more below to be conservative.
	//
	// 3. Best asymptotic bound: This bound is derived by observing we
	//    only select a new site when it is at least snapRadius away from all
	//    existing sites, and the site can move by at most
	//    0.5 * MaxDiagMetric.Value(level) when snapped.
	minEdge := s1.Angle(MinEdgeMetric.Value(sf.level))
	maxDiag := s1.Angle(MaxDiagMetric.Value(sf.level))
	return maxAngle(minEdge,
		// per 2 above, a little less than 2 / sqrt(13)
		maxAngle(0.548*sf.snapRadius,
			sf.snapRadius-0.5*maxDiag))
}

// MinEdgeVertexSeparation returns the guaranteed minimum spacing between
// edges and non-incident vertices in the output depending on level and snapRadius..
// It can be as low as 0.219 * snapRadius, but is typically 0.5 * snapRadius
// or more.
func (sf CellIDSnapper) MinEdgeVertexSeparation() s1.Angle {
	// Similar to MinVertexSeparation, in this case we have four bounds: a
	// constant bound that holds only at the minimum snap radius, a constant
	// bound that holds for any snap radius, a bound that is proportional to
	// snapRadius, and a bound that is equal to snapRadius minus a constant.
	//
	// 1. Constant bounds:
	//    (a) At the minimum snap radius for a given level, it can be shown
	//    that vertices are separated from edges by at least 0.5 *a
	//    MinDiagMetric.Value(level) in the plane. The unit test verifies this,
	//    except that on the sphere the worst case is slightly better:
	//    0.5652980068 * MinDiagMetric.Value(level).
	//
	//    (b) Otherwise, for arbitrary snap radii the worst-case configuration
	//    in the plane has an edge-vertex separation of sqrt(3/19) *
	//    MinDiagMetric.Value(level), where sqrt(3/19) is about 0.3973597071.
	//    The unit test verifies that the bound is slightly better on the sphere:
	//    0.3973595687 * MinDiagMetric.Value(level).
	//
	// 2. Proportional bound: In the plane, the worst-case configuration has an
	//    edge-vertex separation of 2 * sqrt(3/247) * snapRadius, which is
	//    about 0.2204155075. The unit test verifies this, except that on the
	//    sphere the bound is slightly worse for certain large Cells: the
	//    minimum ratio occurs at cell level 6, and is about 0.2196666953.
	//
	// 3. Best asymptotic bound: If snapRadius is large compared to the
	//    minimum snap radius, then the best bound is achieved by 3 sites on a
	//    circular arc of radius snapRadius, spaced MinVertexSeparation
	//    apart. An input edge passing just to one side of the center of the
	//    circle intersects the Voronoi regions of the two end sites but not the
	//    Voronoi region of the center site, and gives an edge separation of
	//    (MinVertexSeparation ** 2) / (2 * snapRadius). This bound
	//    approaches 0.5 * snapRadius for large snap radii, i.e. the minimum
	//    edge-vertex separation approaches half of the minimum vertex
	//    separation as the snap radius becomes large compared to the cell size.
	minDiag := s1.Angle(MinDiagMetric.Value(sf.level))
	if sf.snapRadius == sf.minSnapRadiusForLevel(sf.level) {
		// This bound only holds when the minimum snap radius is being used.
		return 0.565 * minDiag // 0.500 in the plane
	}

	// Otherwise, these bounds hold for any snapRadius.
	vertexSep := sf.MinVertexSeparation()
	return maxAngle(0.397*minDiag, // sqrt(3/19) in the plane
		maxAngle(0.219*sf.snapRadius, // 2*sqrt(3/247) in the plane
			0.5*(vertexSep/sf.snapRadius)*vertexSep))
}

// SnapPoint returns a candidate snap site for the given point.
func (sf CellIDSnapper) SnapPoint(point Point) Point {
	return CellFromPoint(point).id.Parent(sf.level).Point()
}

const (
	// The minimum exponent supported for snapping.
	minIntSnappingExponent = 0
	// The maximum exponent supported for snapping.
	maxIntSnappingExponent = 10
)

// IntLatLngSnapper is a Snapper that snaps vertices to LatLngs in
// E5, E6, or E7 coordinates. These coordinates are expressed in degrees
// multiplied by a power of 10 and then rounded to the nearest integer. For
// example, in E6 coordinates the point (23.12345651, -45.65432149) would
// become (23123457, -45654321).
//
// The main argument of the Snapper is the exponent for the power of 10
// that coordinates should be multiplied by before rounding.  For example,
// NewIntLatLngSnapper(7) is a function that snaps to E7 coordinates.  The
// exponent can range from 0 to 10.
//
// Each exponent has a corresponding minimum snap radius, which is simply the
// maximum distance that a vertex can move when snapped. It is approximately
// equal to 1/sqrt(2) times the nominal point spacing; for example, for
// snapping to E7 the minimum snap radius is (1e-7 / sqrt(2)) degrees.
// You can also set the snap radius to any value larger than this; this can
// result in significant extra simplification (similar to using a larger
// exponent) but does not move vertices unnecessarily.
type IntLatLngSnapper struct {
	exponent   int
	snapRadius s1.Angle
	from, to   s1.Angle
}

// NewIntLatLngSnapper returns a Snapper with the specified exponent.
func NewIntLatLngSnapper(exponent int) IntLatLngSnapper {
	// Precompute the scale factors needed for snapping. Note that these
	// calculations need to exactly match the ones in s1.Angle to ensure
	// that the same Points are generated.
	power := s1.Angle(math.Pow10(exponent))
	sf := IntLatLngSnapper{
		exponent: exponent,
		from:     power,
		to:       1 / power,
	}
	sf.snapRadius = sf.minSnapRadiusForExponent(exponent)
	return sf
}

// TODO(rsned): Add SetExponent() method.

// SnapRadius reports the snap radius to be used. The snap radius
// must be at least the minimum value for the current exponent, but larger
// values can also be used (e.g., to simplify the geometry).
//
// This requires snapRadius >= minSnapRadiusForExponent(sh.exponent)
// and snapRadius <= maxSnapRadius
func (sf IntLatLngSnapper) SnapRadius() s1.Angle {
	return sf.snapRadius
}

// minSnapRadiusForExponent returns the minimum allowable snap radius for the given
// exponent (approximately equal to 10**(-exponent) / sqrt(2)) degrees).
//
// TODO(rsned): Pop this method out so it can be used by other callers.
func (sf IntLatLngSnapper) minSnapRadiusForExponent(exponent int) s1.Angle {
	// snapRadius needs to be an upper bound on the true distance that a
	// point can move when snapped, taking into account numerical errors.
	//
	// The maximum errors in latitude and longitude can be bounded as
	// follows (as absolute errors in terms of dblEpsilon):
	//
	//                                      Latitude      Longitude
	// Convert to LatLng:                      1.000          1.000
	// Convert to degrees:                     1.032          2.063
	// Scale by 10**exp:                       0.786          1.571
	// Round to integer: 0.5 * s1.Degrees(sf.to)
	// Scale by 10**(-exp):                    1.375          2.749
	// Convert to radians:                     1.252          1.503
	// ------------------------------------------------------------
	// Total (except for rounding)             5.445          8.886
	//
	// The maximum error when converting the LatLng back to a Point is
	//
	//   sqrt(2) * (maximum error in latitude or longitude) + 1.5 * dblEpsilon
	//
	// which works out to (9 * sqrt(2) + 1.5) * dblEpsilon radians. Finally
	// we need to consider the effect of rounding to integer coordinates
	// (much larger than the errors above), which can change the position by
	// up to (sqrt(2) * 0.5 * sf.to) radians.
	power := math.Pow10(exponent)
	return (s1.Degree*s1.Angle((1/math.Sqrt2)/power) +
		s1.Angle((9*math.Sqrt2+1.5)*dblEpsilon))
}

// exponentForMaxSnapRadius returns the minimum exponent such that vertices will
// not move by more than snapRadius. This can be useful when choosing an appropriate
// exponent for snapping. The return value is always a valid exponent (out of
// range values are silently clamped).
//
// TODO(rsned): Pop this method out so it can be used by other callers.
func (sf IntLatLngSnapper) exponentForMaxSnapRadius(snapRadius s1.Angle) int {
	// When choosing an exponent, we need to account for the error bound of
	// (9 * sqrt(2) + 1.5) * dblEpsilon added by minSnapRadiusForExponent.
	snapRadius -= (9*math.Sqrt2 + 1.5) * dblEpsilon
	snapRadius = maxAngle(snapRadius, 1e-30)
	exponent := math.Log10((1 / math.Sqrt2) / snapRadius.Degrees())

	// There can be small errors in the calculation above, so to ensure that
	// this function is the inverse of minSnapRadiusForExponent we subtract a
	// small error tolerance.
	return maxInt(minIntSnappingExponent,
		minInt(maxIntSnappingExponent, int(math.Ceil(exponent-2*dblEpsilon))))
}

// MinVertexSeparation reports the minimum separation between vertices depending on
// exponent and snapRadius. It can vary between 0.471 * snapRadius and snapRadius.
func (sf IntLatLngSnapper) MinVertexSeparation() s1.Angle {
	// We have two bounds for the minimum vertex separation: one is proportional
	// to snapRadius, and one is equal to snapRadius minus a constant.  These
	// bounds give the best results for small and large snap radii respectively.
	// We return the maximum of the two bounds.
	//
	// 1. Proportional bound: It can be shown that in the plane, the worst-case
	//    configuration has a vertex separation of (sqrt(2) / 3) * snapRadius.
	//    This is verified in the unit test, except that on the sphere the ratio
	//    is slightly smaller (0.471337 vs. 0.471404).  We reduce that value a
	//    bit more below to be conservative.
	//
	// 2. Best asymptotic bound: This bound bound is derived by observing we
	//    only select a new site when it is at least snapRadius away from all
	//    existing sites, and snapping a vertex can move it by up to
	//    ((1 / sqrt(2)) * sf.to) degrees.
	return maxAngle(0.471*sf.snapRadius, // sqrt(2)/3 in the plane
		sf.snapRadius-s1.Degree*s1.Angle(1/math.Sqrt2)*sf.to)
}

// MinEdgeVertexSeparation reports the minimum separation between edges
// and non-incident vertices in the output depending on the level and
// snapRadius. It can be as low as 0.222 * snapRadius, but is typically
// 0.39 * snapRadius or more.
func (sf IntLatLngSnapper) MinEdgeVertexSeparation() s1.Angle {
	// Similar to MinVertexSeparation, in this case we have three bounds:
	// one is a constant bound, one is proportional to snapRadius, and one is
	// approaches 0.5 * snapRadius asymptotically.
	//
	// 1. Constant bound: In the plane, the worst-case configuration has an
	//    edge-vertex separation of ((1 / sqrt(13)) * sf.to) degrees.
	//    The unit test verifies this, except that on the sphere the ratio is
	//    slightly lower when small exponents such as E1 are used
	//    (0.2772589 vs 0.2773501).
	//
	// 2. Proportional bound: In the plane, the worst-case configuration has an
	//    edge-vertex separation of (2 / 9) * snapRadius (0.222222222222). The
	//    unit test verifies this, except that on the sphere the bound can be
	//    slightly worse with large exponents (e.g., E9) due to small numerical
	//    errors (0.222222126756717).
	//
	// 3. Best asymptotic bound: If snapRadius is large compared to the
	//    minimum snap radius, then the best bound is achieved by 3 sites on a
	//    circular arc of radius snapRadius, spaced MinVertexSeparation
	//    apart (see CellIDSnapper.MinEdgeVertexSeparation). This
	//    bound approaches 0.5 * snapRadius as the snap radius becomes large
	//    relative to the grid spacing.
	vertexSep := sf.MinVertexSeparation()
	return maxAngle(0.277*s1.Degree*sf.to, // 1/sqrt(13) in the plane
		maxAngle(0.222*sf.snapRadius, // 2/9 in the plane
			0.5*(vertexSep/sf.snapRadius)*vertexSep))
}

// SnapPoint returns a candidate snap site for the given point.
func (sf IntLatLngSnapper) SnapPoint(point Point) Point {
	// TODO(rsned): C++ DCHECK's on exponent being in valid range. What should we
	// do when it's bad here.
	input := LatLngFromPoint(point)
	lat := s1.Angle(roundAngle(input.Lat * sf.from))
	lng := s1.Angle(roundAngle(input.Lng * sf.from))
	return PointFromLatLng(LatLng{lat * sf.to, lng * sf.to})
}
