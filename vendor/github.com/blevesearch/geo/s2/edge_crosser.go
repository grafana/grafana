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
)

// EdgeCrosser allows edges to be efficiently tested for intersection with a
// given fixed edge AB. It is especially efficient when testing for
// intersection with an edge chain connecting vertices v0, v1, v2, ...
//
// Example usage:
//
//	func CountIntersections(a, b Point, edges []Edge) int {
//		count := 0
//		crosser := NewEdgeCrosser(a, b)
//		for _, edge := range edges {
//			if crosser.CrossingSign(&edge.First, &edge.Second) != DoNotCross {
//				count++
//			}
//		}
//		return count
//	}
//
type EdgeCrosser struct {
	a   Point
	b   Point
	aXb Point

	// To reduce the number of calls to expensiveSign, we compute an
	// outward-facing tangent at A and B if necessary. If the plane
	// perpendicular to one of these tangents separates AB from CD (i.e., one
	// edge on each side) then there is no intersection.
	aTangent Point // Outward-facing tangent at A.
	bTangent Point // Outward-facing tangent at B.

	// The fields below are updated for each vertex in the chain.
	c   Point     // Previous vertex in the vertex chain.
	acb Direction // The orientation of triangle ACB.
}

// NewEdgeCrosser returns an EdgeCrosser with the fixed edge AB.
func NewEdgeCrosser(a, b Point) *EdgeCrosser {
	norm := a.PointCross(b)
	return &EdgeCrosser{
		a:        a,
		b:        b,
		aXb:      Point{a.Cross(b.Vector)},
		aTangent: Point{a.Cross(norm.Vector)},
		bTangent: Point{norm.Cross(b.Vector)},
	}
}

// CrossingSign reports whether the edge AB intersects the edge CD. If any two
// vertices from different edges are the same, returns MaybeCross. If either edge
// is degenerate (A == B or C == D), returns either DoNotCross or MaybeCross.
//
// Properties of CrossingSign:
//
//  (1) CrossingSign(b,a,c,d) == CrossingSign(a,b,c,d)
//  (2) CrossingSign(c,d,a,b) == CrossingSign(a,b,c,d)
//  (3) CrossingSign(a,b,c,d) == MaybeCross if a==c, a==d, b==c, b==d
//  (3) CrossingSign(a,b,c,d) == DoNotCross or MaybeCross if a==b or c==d
//
// Note that if you want to check an edge against a chain of other edges,
// it is slightly more efficient to use the single-argument version
// ChainCrossingSign below.
func (e *EdgeCrosser) CrossingSign(c, d Point) Crossing {
	if c != e.c {
		e.RestartAt(c)
	}
	return e.ChainCrossingSign(d)
}

// EdgeOrVertexCrossing reports whether if CrossingSign(c, d) > 0, or AB and
// CD share a vertex and VertexCrossing(a, b, c, d) is true.
//
// This method extends the concept of a "crossing" to the case where AB
// and CD have a vertex in common. The two edges may or may not cross,
// according to the rules defined in VertexCrossing above. The rules
// are designed so that point containment tests can be implemented simply
// by counting edge crossings. Similarly, determining whether one edge
// chain crosses another edge chain can be implemented by counting.
func (e *EdgeCrosser) EdgeOrVertexCrossing(c, d Point) bool {
	if c != e.c {
		e.RestartAt(c)
	}
	return e.EdgeOrVertexChainCrossing(d)
}

// NewChainEdgeCrosser is a convenience constructor that uses AB as the fixed edge,
// and C as the first vertex of the vertex chain (equivalent to calling RestartAt(c)).
//
// You don't need to use this or any of the chain functions unless you're trying to
// squeeze out every last drop of performance. Essentially all you are saving is a test
// whether the first vertex of the current edge is the same as the second vertex of the
// previous edge.
func NewChainEdgeCrosser(a, b, c Point) *EdgeCrosser {
	e := NewEdgeCrosser(a, b)
	e.RestartAt(c)
	return e
}

// RestartAt sets the current point of the edge crosser to be c.
// Call this method when your chain 'jumps' to a new place.
// The argument must point to a value that persists until the next call.
func (e *EdgeCrosser) RestartAt(c Point) {
	e.c = c
	e.acb = -triageSign(e.a, e.b, e.c)
}

// ChainCrossingSign is like CrossingSign, but uses the last vertex passed to one of
// the crossing methods (or RestartAt) as the first vertex of the current edge.
func (e *EdgeCrosser) ChainCrossingSign(d Point) Crossing {
	// For there to be an edge crossing, the triangles ACB, CBD, BDA, DAC must
	// all be oriented the same way (CW or CCW). We keep the orientation of ACB
	// as part of our state. When each new point D arrives, we compute the
	// orientation of BDA and check whether it matches ACB. This checks whether
	// the points C and D are on opposite sides of the great circle through AB.

	// Recall that triageSign is invariant with respect to rotating its
	// arguments, i.e. ABD has the same orientation as BDA.
	bda := triageSign(e.a, e.b, d)
	if e.acb == -bda && bda != Indeterminate {
		// The most common case -- triangles have opposite orientations. Save the
		// current vertex D as the next vertex C, and also save the orientation of
		// the new triangle ACB (which is opposite to the current triangle BDA).
		e.c = d
		e.acb = -bda
		return DoNotCross
	}
	return e.crossingSign(d, bda)
}

// EdgeOrVertexChainCrossing is like EdgeOrVertexCrossing, but uses the last vertex
// passed to one of the crossing methods (or RestartAt) as the first vertex of the current edge.
func (e *EdgeCrosser) EdgeOrVertexChainCrossing(d Point) bool {
	// We need to copy e.c since it is clobbered by ChainCrossingSign.
	c := e.c
	switch e.ChainCrossingSign(d) {
	case DoNotCross:
		return false
	case Cross:
		return true
	}
	return VertexCrossing(e.a, e.b, c, d)
}

// crossingSign handle the slow path of CrossingSign.
func (e *EdgeCrosser) crossingSign(d Point, bda Direction) Crossing {
	// Compute the actual result, and then save the current vertex D as the next
	// vertex C, and save the orientation of the next triangle ACB (which is
	// opposite to the current triangle BDA).
	defer func() {
		e.c = d
		e.acb = -bda
	}()

	// At this point, a very common situation is that A,B,C,D are four points on
	// a line such that AB does not overlap CD. (For example, this happens when
	// a line or curve is sampled finely, or when geometry is constructed by
	// computing the union of S2CellIds.) Most of the time, we can determine
	// that AB and CD do not intersect using the two outward-facing
	// tangents at A and B (parallel to AB) and testing whether AB and CD are on
	// opposite sides of the plane perpendicular to one of these tangents. This
	// is moderately expensive but still much cheaper than expensiveSign.

	// The error in RobustCrossProd is insignificant. The maximum error in
	// the call to CrossProd (i.e., the maximum norm of the error vector) is
	// (0.5 + 1/sqrt(3)) * dblEpsilon. The maximum error in each call to
	// DotProd below is dblEpsilon. (There is also a small relative error
	// term that is insignificant because we are comparing the result against a
	// constant that is very close to zero.)
	maxError := (1.5 + 1/math.Sqrt(3)) * dblEpsilon
	if (e.c.Dot(e.aTangent.Vector) > maxError && d.Dot(e.aTangent.Vector) > maxError) || (e.c.Dot(e.bTangent.Vector) > maxError && d.Dot(e.bTangent.Vector) > maxError) {
		return DoNotCross
	}

	// Otherwise, eliminate the cases where two vertices from different edges are
	// equal. (These cases could be handled in the code below, but we would rather
	// avoid calling ExpensiveSign if possible.)
	if e.a == e.c || e.a == d || e.b == e.c || e.b == d {
		return MaybeCross
	}

	// Eliminate the cases where an input edge is degenerate. (Note that in
	// most cases, if CD is degenerate then this method is not even called
	// because acb and bda have different signs.)
	if e.a == e.b || e.c == d {
		return DoNotCross
	}

	// Otherwise it's time to break out the big guns.
	if e.acb == Indeterminate {
		e.acb = -expensiveSign(e.a, e.b, e.c)
	}
	if bda == Indeterminate {
		bda = expensiveSign(e.a, e.b, d)
	}

	if bda != e.acb {
		return DoNotCross
	}

	cbd := -RobustSign(e.c, d, e.b)
	if cbd != e.acb {
		return DoNotCross
	}
	dac := RobustSign(e.c, d, e.a)
	if dac != e.acb {
		return DoNotCross
	}
	return Cross
}
