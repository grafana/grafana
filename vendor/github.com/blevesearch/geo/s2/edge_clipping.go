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

// This file contains a collection of methods for:
//
//   (1) Robustly clipping geodesic edges to the faces of the S2 biunit cube
//       (see s2stuv), and
//
//   (2) Robustly clipping 2D edges against 2D rectangles.
//
// These functions can be used to efficiently find the set of CellIDs that
// are intersected by a geodesic edge (e.g., see CrossingEdgeQuery).

import (
	"math"

	"github.com/golang/geo/r1"
	"github.com/golang/geo/r2"
	"github.com/golang/geo/r3"
)

const (
	// edgeClipErrorUVCoord is the maximum error in a u- or v-coordinate
	// compared to the exact result, assuming that the points A and B are in
	// the rectangle [-1,1]x[1,1] or slightly outside it (by 1e-10 or less).
	edgeClipErrorUVCoord = 2.25 * dblEpsilon

	// edgeClipErrorUVDist is the maximum distance from a clipped point to
	// the corresponding exact result. It is equal to the error in a single
	// coordinate because at most one coordinate is subject to error.
	edgeClipErrorUVDist = 2.25 * dblEpsilon

	// faceClipErrorRadians is the maximum angle between a returned vertex
	// and the nearest point on the exact edge AB. It is equal to the
	// maximum directional error in PointCross, plus the error when
	// projecting points onto a cube face.
	faceClipErrorRadians = 3 * dblEpsilon

	// faceClipErrorDist is the same angle expressed as a maximum distance
	// in (u,v)-space. In other words, a returned vertex is at most this far
	// from the exact edge AB projected into (u,v)-space.
	faceClipErrorUVDist = 9 * dblEpsilon

	// faceClipErrorUVCoord is the maximum angle between a returned vertex
	// and the nearest point on the exact edge AB expressed as the maximum error
	// in an individual u- or v-coordinate. In other words, for each
	// returned vertex there is a point on the exact edge AB whose u- and
	// v-coordinates differ from the vertex by at most this amount.
	faceClipErrorUVCoord = 9.0 * (1.0 / math.Sqrt2) * dblEpsilon

	// intersectsRectErrorUVDist is the maximum error when computing if a point
	// intersects with a given Rect. If some point of AB is inside the
	// rectangle by at least this distance, the result is guaranteed to be true;
	// if all points of AB are outside the rectangle by at least this distance,
	// the result is guaranteed to be false. This bound assumes that rect is
	// a subset of the rectangle [-1,1]x[-1,1] or extends slightly outside it
	// (e.g., by 1e-10 or less).
	intersectsRectErrorUVDist = 3 * math.Sqrt2 * dblEpsilon
)

// ClipToFace returns the (u,v) coordinates for the portion of the edge AB that
// intersects the given face, or false if the edge AB does not intersect.
// This method guarantees that the clipped vertices lie within the [-1,1]x[-1,1]
// cube face rectangle and are within faceClipErrorUVDist of the line AB, but
// the results may differ from those produced by FaceSegments.
func ClipToFace(a, b Point, face int) (aUV, bUV r2.Point, intersects bool) {
	return ClipToPaddedFace(a, b, face, 0.0)
}

// ClipToPaddedFace returns the (u,v) coordinates for the portion of the edge AB that
// intersects the given face, but rather than clipping to the square [-1,1]x[-1,1]
// in (u,v) space, this method clips to [-R,R]x[-R,R] where R=(1+padding).
// Padding must be non-negative.
func ClipToPaddedFace(a, b Point, f int, padding float64) (aUV, bUV r2.Point, intersects bool) {
	// Fast path: both endpoints are on the given face.
	if face(a.Vector) == f && face(b.Vector) == f {
		au, av := validFaceXYZToUV(f, a.Vector)
		bu, bv := validFaceXYZToUV(f, b.Vector)
		return r2.Point{au, av}, r2.Point{bu, bv}, true
	}

	// Convert everything into the (u,v,w) coordinates of the given face. Note
	// that the cross product *must* be computed in the original (x,y,z)
	// coordinate system because PointCross (unlike the mathematical cross
	// product) can produce different results in different coordinate systems
	// when one argument is a linear multiple of the other, due to the use of
	// symbolic perturbations.
	normUVW := pointUVW(faceXYZtoUVW(f, a.PointCross(b)))
	aUVW := pointUVW(faceXYZtoUVW(f, a))
	bUVW := pointUVW(faceXYZtoUVW(f, b))

	// Padding is handled by scaling the u- and v-components of the normal.
	// Letting R=1+padding, this means that when we compute the dot product of
	// the normal with a cube face vertex (such as (-1,-1,1)), we will actually
	// compute the dot product with the scaled vertex (-R,-R,1). This allows
	// methods such as intersectsFace, exitAxis, etc, to handle padding
	// with no further modifications.
	scaleUV := 1 + padding
	scaledN := pointUVW{r3.Vector{X: scaleUV * normUVW.X, Y: scaleUV * normUVW.Y, Z: normUVW.Z}}
	if !scaledN.intersectsFace() {
		return aUV, bUV, false
	}

	// TODO(roberts): This is a workaround for extremely small vectors where some
	// loss of precision can occur in Normalize causing underflow. When PointCross
	// is updated to work around this, this can be removed.
	if math.Max(math.Abs(normUVW.X), math.Max(math.Abs(normUVW.Y), math.Abs(normUVW.Z))) < math.Ldexp(1, -511) {
		normUVW = pointUVW{normUVW.Mul(math.Ldexp(1, 563))}
	}

	normUVW = pointUVW{normUVW.Normalize()}

	aTan := pointUVW{normUVW.Cross(aUVW.Vector)}
	bTan := pointUVW{bUVW.Cross(normUVW.Vector)}

	// As described in clipDestination, if the sum of the scores from clipping the two
	// endpoints is 3 or more, then the segment does not intersect this face.
	aUV, aScore := clipDestination(bUVW, aUVW, pointUVW{scaledN.Mul(-1)}, bTan, aTan, scaleUV)
	bUV, bScore := clipDestination(aUVW, bUVW, scaledN, aTan, bTan, scaleUV)

	return aUV, bUV, aScore+bScore < 3
}

// ClipEdge returns the portion of the edge defined by AB that is contained by the
// given rectangle. If there is no intersection, false is returned and aClip and bClip
// are undefined.
func ClipEdge(a, b r2.Point, clip r2.Rect) (aClip, bClip r2.Point, intersects bool) {
	// Compute the bounding rectangle of AB, clip it, and then extract the new
	// endpoints from the clipped bound.
	bound := r2.RectFromPoints(a, b)
	if bound, intersects = clipEdgeBound(a, b, clip, bound); !intersects {
		return aClip, bClip, false
	}
	ai := 0
	if a.X > b.X {
		ai = 1
	}
	aj := 0
	if a.Y > b.Y {
		aj = 1
	}

	return bound.VertexIJ(ai, aj), bound.VertexIJ(1-ai, 1-aj), true
}

// The three functions below (sumEqual, intersectsFace, intersectsOppositeEdges)
// all compare a sum (u + v) to a third value w. They are implemented in such a
// way that they produce an exact result even though all calculations are done
// with ordinary floating-point operations. Here are the principles on which these
// functions are based:
//
// A. If u + v < w in floating-point, then u + v < w in exact arithmetic.
//
// B. If u + v < w in exact arithmetic, then at least one of the following
//    expressions is true in floating-point:
//       u + v < w
//       u < w - v
//       v < w - u
//
// Proof: By rearranging terms and substituting ">" for "<", we can assume
// that all values are non-negative.  Now clearly "w" is not the smallest
// value, so assume WLOG that "u" is the smallest.  We want to show that
// u < w - v in floating-point.  If v >= w/2, the calculation of w - v is
// exact since the result is smaller in magnitude than either input value,
// so the result holds.  Otherwise we have u <= v < w/2 and w - v >= w/2
// (even in floating point), so the result also holds.

// sumEqual reports whether u + v == w exactly.
func sumEqual(u, v, w float64) bool {
	return (u+v == w) && (u == w-v) && (v == w-u)
}

// pointUVW represents a Point in (u,v,w) coordinate space of a cube face.
type pointUVW Point

// intersectsFace reports whether a given directed line L intersects the cube face F.
// The line L is defined by its normal N in the (u,v,w) coordinates of F.
func (p pointUVW) intersectsFace() bool {
	// L intersects the [-1,1]x[-1,1] square in (u,v) if and only if the dot
	// products of N with the four corner vertices (-1,-1,1), (1,-1,1), (1,1,1),
	// and (-1,1,1) do not all have the same sign. This is true exactly when
	// |Nu| + |Nv| >= |Nw|. The code below evaluates this expression exactly.
	u := math.Abs(p.X)
	v := math.Abs(p.Y)
	w := math.Abs(p.Z)

	// We only need to consider the cases where u or v is the smallest value,
	// since if w is the smallest then both expressions below will have a
	// positive LHS and a negative RHS.
	return (v >= w-u) && (u >= w-v)
}

// intersectsOppositeEdges reports whether a directed line L intersects two
// opposite edges of a cube face F. This includs the case where L passes
// exactly through a corner vertex of F. The directed line L is defined
// by its normal N in the (u,v,w) coordinates of F.
func (p pointUVW) intersectsOppositeEdges() bool {
	// The line L intersects opposite edges of the [-1,1]x[-1,1] (u,v) square if
	// and only exactly two of the corner vertices lie on each side of L. This
	// is true exactly when ||Nu| - |Nv|| >= |Nw|. The code below evaluates this
	// expression exactly.
	u := math.Abs(p.X)
	v := math.Abs(p.Y)
	w := math.Abs(p.Z)

	// If w is the smallest, the following line returns an exact result.
	if math.Abs(u-v) != w {
		return math.Abs(u-v) >= w
	}

	// Otherwise u - v = w exactly, or w is not the smallest value. In either
	// case the following returns the correct result.
	if u >= v {
		return u-w >= v
	}
	return v-w >= u
}

// axis represents the possible results of exitAxis.
type axis int

const (
	axisU axis = iota
	axisV
)

// exitAxis reports which axis the directed line L exits the cube face F on.
// The directed line L is represented by its CCW normal N in the (u,v,w) coordinates
// of F. It returns axisU if L exits through the u=-1 or u=+1 edge, and axisV if L exits
// through the v=-1 or v=+1 edge. Either result is acceptable if L exits exactly
// through a corner vertex of the cube face.
func (p pointUVW) exitAxis() axis {
	if p.intersectsOppositeEdges() {
		// The line passes through through opposite edges of the face.
		// It exits through the v=+1 or v=-1 edge if the u-component of N has a
		// larger absolute magnitude than the v-component.
		if math.Abs(p.X) >= math.Abs(p.Y) {
			return axisV
		}
		return axisU
	}

	// The line passes through through two adjacent edges of the face.
	// It exits the v=+1 or v=-1 edge if an even number of the components of N
	// are negative. We test this using signbit() rather than multiplication
	// to avoid the possibility of underflow.
	var x, y, z int
	if math.Signbit(p.X) {
		x = 1
	}
	if math.Signbit(p.Y) {
		y = 1
	}
	if math.Signbit(p.Z) {
		z = 1
	}

	if x^y^z == 0 {
		return axisV
	}
	return axisU
}

// exitPoint returns the UV coordinates of the point where a directed line L (represented
// by the CCW normal of this point), exits the cube face this point is derived from along
// the given axis.
func (p pointUVW) exitPoint(a axis) r2.Point {
	if a == axisU {
		u := -1.0
		if p.Y > 0 {
			u = 1.0
		}
		return r2.Point{u, (-u*p.X - p.Z) / p.Y}
	}

	v := -1.0
	if p.X < 0 {
		v = 1.0
	}
	return r2.Point{(-v*p.Y - p.Z) / p.X, v}
}

// clipDestination returns a score which is used to indicate if the clipped edge AB
// on the given face intersects the face at all. This function returns the score for
// the given endpoint, which is an integer ranging from 0 to 3. If the sum of the scores
// from both of the endpoints is 3 or more, then edge AB does not intersect this face.
//
// First, it clips the line segment AB to find the clipped destination B' on a given
// face. (The face is specified implicitly by expressing *all arguments* in the (u,v,w)
// coordinates of that face.) Second, it partially computes whether the segment AB
// intersects this face at all. The actual condition is fairly complicated, but it
// turns out that it can be expressed as a "score" that can be computed independently
// when clipping the two endpoints A and B.
func clipDestination(a, b, scaledN, aTan, bTan pointUVW, scaleUV float64) (r2.Point, int) {
	var uv r2.Point

	// Optimization: if B is within the safe region of the face, use it.
	maxSafeUVCoord := 1 - faceClipErrorUVCoord
	if b.Z > 0 {
		uv = r2.Point{b.X / b.Z, b.Y / b.Z}
		if math.Max(math.Abs(uv.X), math.Abs(uv.Y)) <= maxSafeUVCoord {
			return uv, 0
		}
	}

	// Otherwise find the point B' where the line AB exits the face.
	uv = scaledN.exitPoint(scaledN.exitAxis()).Mul(scaleUV)

	p := pointUVW(Point{r3.Vector{uv.X, uv.Y, 1.0}})

	// Determine if the exit point B' is contained within the segment. We do this
	// by computing the dot products with two inward-facing tangent vectors at A
	// and B. If either dot product is negative, we say that B' is on the "wrong
	// side" of that point. As the point B' moves around the great circle AB past
	// the segment endpoint B, it is initially on the wrong side of B only; as it
	// moves further it is on the wrong side of both endpoints; and then it is on
	// the wrong side of A only. If the exit point B' is on the wrong side of
	// either endpoint, we can't use it; instead the segment is clipped at the
	// original endpoint B.
	//
	// We reject the segment if the sum of the scores of the two endpoints is 3
	// or more. Here is what that rule encodes:
	//  - If B' is on the wrong side of A, then the other clipped endpoint A'
	//    must be in the interior of AB (otherwise AB' would go the wrong way
	//    around the circle). There is a similar rule for A'.
	//  - If B' is on the wrong side of either endpoint (and therefore we must
	//    use the original endpoint B instead), then it must be possible to
	//    project B onto this face (i.e., its w-coordinate must be positive).
	//    This rule is only necessary to handle certain zero-length edges (A=B).
	score := 0
	if p.Sub(a.Vector).Dot(aTan.Vector) < 0 {
		score = 2 // B' is on wrong side of A.
	} else if p.Sub(b.Vector).Dot(bTan.Vector) < 0 {
		score = 1 // B' is on wrong side of B.
	}

	if score > 0 { // B' is not in the interior of AB.
		if b.Z <= 0 {
			score = 3 // B cannot be projected onto this face.
		} else {
			uv = r2.Point{b.X / b.Z, b.Y / b.Z}
		}
	}

	return uv, score
}

// updateEndpoint returns the interval with the specified endpoint updated to
// the given value. If the value lies beyond the opposite endpoint, nothing is
// changed and false is returned.
func updateEndpoint(bound r1.Interval, highEndpoint bool, value float64) (r1.Interval, bool) {
	if !highEndpoint {
		if bound.Hi < value {
			return bound, false
		}
		if bound.Lo < value {
			bound.Lo = value
		}
		return bound, true
	}

	if bound.Lo > value {
		return bound, false
	}
	if bound.Hi > value {
		bound.Hi = value
	}
	return bound, true
}

// clipBoundAxis returns the clipped versions of the bounding intervals for the given
// axes for the line segment from (a0,a1) to (b0,b1) so that neither extends beyond the
// given clip interval. negSlope is a precomputed helper variable that indicates which
// diagonal of the bounding box is spanned by AB; it is false if AB has positive slope,
// and true if AB has negative slope. If the clipping interval doesn't overlap the bounds,
// false is returned.
func clipBoundAxis(a0, b0 float64, bound0 r1.Interval, a1, b1 float64, bound1 r1.Interval,
	negSlope bool, clip r1.Interval) (bound0c, bound1c r1.Interval, updated bool) {

	if bound0.Lo < clip.Lo {
		// If the upper bound is below the clips lower bound, there is nothing to do.
		if bound0.Hi < clip.Lo {
			return bound0, bound1, false
		}
		// narrow the intervals lower bound to the clip bound.
		bound0.Lo = clip.Lo
		if bound1, updated = updateEndpoint(bound1, negSlope, interpolateFloat64(clip.Lo, a0, b0, a1, b1)); !updated {
			return bound0, bound1, false
		}
	}

	if bound0.Hi > clip.Hi {
		// If the lower bound is above the clips upper bound, there is nothing to do.
		if bound0.Lo > clip.Hi {
			return bound0, bound1, false
		}
		// narrow the intervals upper bound to the clip bound.
		bound0.Hi = clip.Hi
		if bound1, updated = updateEndpoint(bound1, !negSlope, interpolateFloat64(clip.Hi, a0, b0, a1, b1)); !updated {
			return bound0, bound1, false
		}
	}
	return bound0, bound1, true
}

// edgeIntersectsRect reports whether the edge defined by AB intersects the
// given closed rectangle to within the error bound.
func edgeIntersectsRect(a, b r2.Point, r r2.Rect) bool {
	// First check whether the bounds of a Rect around AB intersects the given rect.
	if !r.Intersects(r2.RectFromPoints(a, b)) {
		return false
	}

	// Otherwise AB intersects the rect if and only if all four vertices of rect
	// do not lie on the same side of the extended line AB. We test this by finding
	// the two vertices of rect with minimum and maximum projections onto the normal
	// of AB, and computing their dot products with the edge normal.
	n := b.Sub(a).Ortho()

	i := 0
	if n.X >= 0 {
		i = 1
	}
	j := 0
	if n.Y >= 0 {
		j = 1
	}

	max := n.Dot(r.VertexIJ(i, j).Sub(a))
	min := n.Dot(r.VertexIJ(1-i, 1-j).Sub(a))

	return (max >= 0) && (min <= 0)
}

// clippedEdgeBound returns the bounding rectangle of the portion of the edge defined
// by AB intersected by clip. The resulting bound may be empty. This is a convenience
// function built on top of clipEdgeBound.
func clippedEdgeBound(a, b r2.Point, clip r2.Rect) r2.Rect {
	bound := r2.RectFromPoints(a, b)
	if b1, intersects := clipEdgeBound(a, b, clip, bound); intersects {
		return b1
	}
	return r2.EmptyRect()
}

// clipEdgeBound clips an edge AB to sequence of rectangles efficiently.
// It represents the clipped edges by their bounding boxes rather than as a pair of
// endpoints. Specifically, let A'B' be some portion of an edge AB, and let bound be
// a tight bound of A'B'. This function returns the bound that is a tight bound
// of A'B' intersected with a given rectangle. If A'B' does not intersect clip,
// it returns false and the original bound.
func clipEdgeBound(a, b r2.Point, clip, bound r2.Rect) (r2.Rect, bool) {
	// negSlope indicates which diagonal of the bounding box is spanned by AB: it
	// is false if AB has positive slope, and true if AB has negative slope. This is
	// used to determine which interval endpoints need to be updated each time
	// the edge is clipped.
	negSlope := (a.X > b.X) != (a.Y > b.Y)

	b0x, b0y, up1 := clipBoundAxis(a.X, b.X, bound.X, a.Y, b.Y, bound.Y, negSlope, clip.X)
	if !up1 {
		return bound, false
	}
	b1y, b1x, up2 := clipBoundAxis(a.Y, b.Y, b0y, a.X, b.X, b0x, negSlope, clip.Y)
	if !up2 {
		return r2.Rect{b0x, b0y}, false
	}
	return r2.Rect{X: b1x, Y: b1y}, true
}

// interpolateFloat64 returns a value with the same combination of a1 and b1 as the
// given value x is of a and b. This function makes the following guarantees:
//  - If x == a, then x1 = a1 (exactly).
//  - If x == b, then x1 = b1 (exactly).
//  - If a <= x <= b, then a1 <= x1 <= b1 (even if a1 == b1).
// This requires a != b.
func interpolateFloat64(x, a, b, a1, b1 float64) float64 {
	// To get results that are accurate near both A and B, we interpolate
	// starting from the closer of the two points.
	if math.Abs(a-x) <= math.Abs(b-x) {
		return a1 + (b1-a1)*(x-a)/(b-a)
	}
	return b1 + (a1-b1)*(x-b)/(a-b)
}

// FaceSegment represents an edge AB clipped to an S2 cube face. It is
// represented by a face index and a pair of (u,v) coordinates.
type FaceSegment struct {
	face int
	a, b r2.Point
}

// FaceSegments subdivides the given edge AB at every point where it crosses the
// boundary between two S2 cube faces and returns the corresponding FaceSegments.
// The segments are returned in order from A toward B. The input points must be
// unit length.
//
// This function guarantees that the returned segments form a continuous path
// from A to B, and that all vertices are within faceClipErrorUVDist of the
// line AB. All vertices lie within the [-1,1]x[-1,1] cube face rectangles.
// The results are consistent with Sign, i.e. the edge is well-defined even its
// endpoints are antipodal.
// TODO(roberts): Extend the implementation of PointCross so that this is true.
func FaceSegments(a, b Point) []FaceSegment {
	var segment FaceSegment

	// Fast path: both endpoints are on the same face.
	var aFace, bFace int
	aFace, segment.a.X, segment.a.Y = xyzToFaceUV(a.Vector)
	bFace, segment.b.X, segment.b.Y = xyzToFaceUV(b.Vector)
	if aFace == bFace {
		segment.face = aFace
		return []FaceSegment{segment}
	}

	// Starting at A, we follow AB from face to face until we reach the face
	// containing B. The following code is designed to ensure that we always
	// reach B, even in the presence of numerical errors.
	//
	// First we compute the normal to the plane containing A and B. This normal
	// becomes the ultimate definition of the line AB; it is used to resolve all
	// questions regarding where exactly the line goes. Unfortunately due to
	// numerical errors, the line may not quite intersect the faces containing
	// the original endpoints. We handle this by moving A and/or B slightly if
	// necessary so that they are on faces intersected by the line AB.
	ab := a.PointCross(b)

	aFace, segment.a = moveOriginToValidFace(aFace, a, ab, segment.a)
	bFace, segment.b = moveOriginToValidFace(bFace, b, Point{ab.Mul(-1)}, segment.b)

	// Now we simply follow AB from face to face until we reach B.
	var segments []FaceSegment
	segment.face = aFace
	bSaved := segment.b

	for face := aFace; face != bFace; {
		// Complete the current segment by finding the point where AB
		// exits the current face.
		z := faceXYZtoUVW(face, ab)
		n := pointUVW{z.Vector}

		exitAxis := n.exitAxis()
		segment.b = n.exitPoint(exitAxis)
		segments = append(segments, segment)

		// Compute the next face intersected by AB, and translate the exit
		// point of the current segment into the (u,v) coordinates of the
		// next face. This becomes the first point of the next segment.
		exitXyz := faceUVToXYZ(face, segment.b.X, segment.b.Y)
		face = nextFace(face, segment.b, exitAxis, n, bFace)
		exitUvw := faceXYZtoUVW(face, Point{exitXyz})
		segment.face = face
		segment.a = r2.Point{exitUvw.X, exitUvw.Y}
	}
	// Finish the last segment.
	segment.b = bSaved
	return append(segments, segment)
}

// moveOriginToValidFace updates the origin point to a valid face if necessary.
// Given a line segment AB whose origin A has been projected onto a given cube
// face, determine whether it is necessary to project A onto a different face
// instead. This can happen because the normal of the line AB is not computed
// exactly, so that the line AB (defined as the set of points perpendicular to
// the normal) may not intersect the cube face containing A. Even if it does
// intersect the face, the exit point of the line from that face may be on
// the wrong side of A (i.e., in the direction away from B). If this happens,
// we reproject A onto the adjacent face where the line AB approaches A most
// closely. This moves the origin by a small amount, but never more than the
// error tolerances.
func moveOriginToValidFace(face int, a, ab Point, aUV r2.Point) (int, r2.Point) {
	// Fast path: if the origin is sufficiently far inside the face, it is
	// always safe to use it.
	const maxSafeUVCoord = 1 - faceClipErrorUVCoord
	if math.Max(math.Abs((aUV).X), math.Abs((aUV).Y)) <= maxSafeUVCoord {
		return face, aUV
	}

	// Otherwise check whether the normal AB even intersects this face.
	z := faceXYZtoUVW(face, ab)
	n := pointUVW{z.Vector}
	if n.intersectsFace() {
		// Check whether the point where the line AB exits this face is on the
		// wrong side of A (by more than the acceptable error tolerance).
		uv := n.exitPoint(n.exitAxis())
		exit := faceUVToXYZ(face, uv.X, uv.Y)
		aTangent := ab.Normalize().Cross(a.Vector)

		// We can use the given face.
		if exit.Sub(a.Vector).Dot(aTangent) >= -faceClipErrorRadians {
			return face, aUV
		}
	}

	// Otherwise we reproject A to the nearest adjacent face. (If line AB does
	// not pass through a given face, it must pass through all adjacent faces.)
	var dir int
	if math.Abs((aUV).X) >= math.Abs((aUV).Y) {
		// U-axis
		if aUV.X > 0 {
			dir = 1
		}
		face = uvwFace(face, 0, dir)
	} else {
		// V-axis
		if aUV.Y > 0 {
			dir = 1
		}
		face = uvwFace(face, 1, dir)
	}

	aUV.X, aUV.Y = validFaceXYZToUV(face, a.Vector)
	aUV.X = math.Max(-1.0, math.Min(1.0, aUV.X))
	aUV.Y = math.Max(-1.0, math.Min(1.0, aUV.Y))

	return face, aUV
}

// nextFace returns the next face that should be visited by FaceSegments, given that
// we have just visited face and we are following the line AB (represented
// by its normal N in the (u,v,w) coordinates of that face). The other
// arguments include the point where AB exits face, the corresponding
// exit axis, and the target face containing the destination point B.
func nextFace(face int, exit r2.Point, axis axis, n pointUVW, targetFace int) int {
	// this bit is to work around C++ cleverly casting bools to ints for you.
	exitA := exit.X
	exit1MinusA := exit.Y

	if axis == axisV {
		exitA = exit.Y
		exit1MinusA = exit.X
	}
	exitAPos := 0
	if exitA > 0 {
		exitAPos = 1
	}
	exit1MinusAPos := 0
	if exit1MinusA > 0 {
		exit1MinusAPos = 1
	}

	// We return the face that is adjacent to the exit point along the given
	// axis. If line AB exits *exactly* through a corner of the face, there are
	// two possible next faces. If one is the target face containing B, then
	// we guarantee that we advance to that face directly.
	//
	// The three conditions below check that (1) AB exits approximately through
	// a corner, (2) the adjacent face along the non-exit axis is the target
	// face, and (3) AB exits *exactly* through the corner. (The sumEqual
	// code checks whether the dot product of (u,v,1) and n is exactly zero.)
	if math.Abs(exit1MinusA) == 1 &&
		uvwFace(face, int(1-axis), exit1MinusAPos) == targetFace &&
		sumEqual(exit.X*n.X, exit.Y*n.Y, -n.Z) {
		return targetFace
	}

	// Otherwise return the face that is adjacent to the exit point in the
	// direction of the exit axis.
	return uvwFace(face, int(axis), exitAPos)
}
