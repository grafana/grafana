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
	"sort"

	"github.com/blevesearch/geo/r3"
)

// ConvexHullQuery builds the convex hull of any collection of points,
// polylines, loops, and polygons. It returns a single convex loop.
//
// The convex hull is defined as the smallest convex region on the sphere that
// contains all of your input geometry. Recall that a region is "convex" if
// for every pair of points inside the region, the straight edge between them
// is also inside the region. In our case, a "straight" edge is a geodesic,
// i.e. the shortest path on the sphere between two points.
//
// Containment of input geometry is defined as follows:
//
//   - Each input loop and polygon is contained by the convex hull exactly
//     (i.e., according to Polygon's Contains(Polygon)).
//
//   - Each input point is either contained by the convex hull or is a vertex
//     of the convex hull. (Recall that S2Loops do not necessarily contain their
//     vertices.)
//
//   - For each input polyline, the convex hull contains all of its vertices
//     according to the rule for points above. (The definition of convexity
//     then ensures that the convex hull also contains the polyline edges.)
//
// To use this type, call the various Add... methods to add your input geometry, and
// then call ConvexHull. Note that ConvexHull does *not* reset the
// state; you can continue adding geometry if desired and compute the convex
// hull again. If you want to start from scratch, simply create a new
// ConvexHullQuery value.
//
// This implement Andrew's monotone chain algorithm, which is a variant of the
// Graham scan (see https://en.wikipedia.org/wiki/Graham_scan). The time
// complexity is O(n log n), and the space required is O(n). In fact only the
// call to "sort" takes O(n log n) time; the rest of the algorithm is linear.
//
// Demonstration of the algorithm and code:
// en.wikibooks.org/wiki/Algorithm_Implementation/Geometry/Convex_hull/Monotone_chain
//
// This type is not safe for concurrent use.
type ConvexHullQuery struct {
	bound  Rect
	points []Point
}

// NewConvexHullQuery creates a new ConvexHullQuery.
func NewConvexHullQuery() *ConvexHullQuery {
	return &ConvexHullQuery{
		bound: EmptyRect(),
	}
}

// AddPoint adds the given point to the input geometry.
func (q *ConvexHullQuery) AddPoint(p Point) {
	q.bound = q.bound.AddPoint(LatLngFromPoint(p))
	q.points = append(q.points, p)
}

// AddPolyline adds the given polyline to the input geometry.
func (q *ConvexHullQuery) AddPolyline(p *Polyline) {
	q.bound = q.bound.Union(p.RectBound())
	q.points = append(q.points, (*p)...)
}

// AddLoop adds the given loop to the input geometry.
func (q *ConvexHullQuery) AddLoop(l *Loop) {
	q.bound = q.bound.Union(l.RectBound())
	if l.isEmptyOrFull() {
		return
	}
	q.points = append(q.points, l.vertices...)
}

// AddPolygon adds the given polygon to the input geometry.
func (q *ConvexHullQuery) AddPolygon(p *Polygon) {
	q.bound = q.bound.Union(p.RectBound())
	for _, l := range p.loops {
		// Only loops at depth 0 can contribute to the convex hull.
		if l.depth == 0 {
			q.AddLoop(l)
		}
	}
}

// CapBound returns a bounding cap for the input geometry provided.
//
// Note that this method does not clear the geometry; you can continue
// adding to it and call this method again if desired.
func (q *ConvexHullQuery) CapBound() Cap {
	// We keep track of a rectangular bound rather than a spherical cap because
	// it is easy to compute a tight bound for a union of rectangles, whereas it
	// is quite difficult to compute a tight bound around a union of caps.
	// Also, polygons and polylines implement CapBound() in terms of
	// RectBound() for this same reason, so it is much better to keep track
	// of a rectangular bound as we go along and convert it at the end.
	//
	// TODO(roberts): We could compute an optimal bound by implementing Welzl's
	// algorithm. However we would still need to have special handling of loops
	// and polygons, since if a loop spans more than 180 degrees in any
	// direction (i.e., if it contains two antipodal points), then it is not
	// enough just to bound its vertices. In this case the only convex bounding
	// cap is FullCap(), and the only convex bounding loop is the full loop.
	return q.bound.CapBound()
}

// ConvexHull returns a Loop representing the convex hull of the input geometry provided.
//
// If there is no geometry, this method returns an empty loop containing no
// points.
//
// If the geometry spans more than half of the sphere, this method returns a
// full loop containing the entire sphere.
//
// If the geometry contains 1 or 2 points, or a single edge, this method
// returns a very small loop consisting of three vertices (which are a
// superset of the input vertices).
//
// Note that this method does not clear the geometry; you can continue
// adding to the query and call this method again.
func (q *ConvexHullQuery) ConvexHull() *Loop {
	c := q.CapBound()
	if c.Height() >= 1 {
		// The bounding cap is not convex. The current bounding cap
		// implementation is not optimal, but nevertheless it is likely that the
		// input geometry itself is not contained by any convex polygon. In any
		// case, we need a convex bounding cap to proceed with the algorithm below
		// (in order to construct a point "origin" that is definitely outside the
		// convex hull).
		return FullLoop()
	}

	// Remove duplicates. We need to do this before checking whether there are
	// fewer than 3 points.
	x := make(map[Point]bool)
	r, w := 0, 0 // read/write indexes
	for ; r < len(q.points); r++ {
		if x[q.points[r]] {
			continue
		}
		q.points[w] = q.points[r]
		x[q.points[r]] = true
		w++
	}
	q.points = q.points[:w]

	// This code implements Andrew's monotone chain algorithm, which is a simple
	// variant of the Graham scan. Rather than sorting by x-coordinate, instead
	// we sort the points in CCW order around an origin O such that all points
	// are guaranteed to be on one side of some geodesic through O. This
	// ensures that as we scan through the points, each new point can only
	// belong at the end of the chain (i.e., the chain is monotone in terms of
	// the angle around O from the starting point).
	origin := Point{c.Center().Ortho()}
	sort.Slice(q.points, func(i, j int) bool {
		return RobustSign(origin, q.points[i], q.points[j]) == CounterClockwise
	})

	// Special cases for fewer than 3 points.
	switch len(q.points) {
	case 0:
		return EmptyLoop()
	case 1:
		return singlePointLoop(q.points[0])
	case 2:
		return singleEdgeLoop(q.points[0], q.points[1])
	}

	// Generate the lower and upper halves of the convex hull. Each half
	// consists of the maximal subset of vertices such that the edge chain
	// makes only left (CCW) turns.
	lower := q.monotoneChain()

	// reverse the points
	for left, right := 0, len(q.points)-1; left < right; left, right = left+1, right-1 {
		q.points[left], q.points[right] = q.points[right], q.points[left]
	}
	upper := q.monotoneChain()

	// Remove the duplicate vertices and combine the chains.
	lower = lower[:len(lower)-1]
	upper = upper[:len(upper)-1]
	lower = append(lower, upper...)

	return LoopFromPoints(lower)
}

// monotoneChain iterates through the points, selecting the maximal subset of points
// such that the edge chain makes only left (CCW) turns.
func (q *ConvexHullQuery) monotoneChain() []Point {
	var output []Point
	for _, p := range q.points {
		// Remove any points that would cause the chain to make a clockwise turn.
		for len(output) >= 2 && RobustSign(output[len(output)-2], output[len(output)-1], p) != CounterClockwise {
			output = output[:len(output)-1]
		}
		output = append(output, p)
	}
	return output
}

// singlePointLoop constructs a 3-vertex polygon consisting of "p" and two nearby
// vertices. Note that ContainsPoint(p) may be false for the resulting loop.
func singlePointLoop(p Point) *Loop {
	const offset = 1e-15
	d0 := p.Ortho()
	d1 := p.Cross(d0)
	vertices := []Point{
		p,
		{p.Add(d0.Mul(offset)).Normalize()},
		{p.Add(d1.Mul(offset)).Normalize()},
	}
	return LoopFromPoints(vertices)
}

// singleEdgeLoop constructs a loop consisting of the two vertices and their midpoint.
func singleEdgeLoop(a, b Point) *Loop {
	// If the points are exactly antipodal we return the full loop.
	//
	// Note that we could use the code below even in this case (which would
	// return a zero-area loop that follows the edge AB), except that (1) the
	// direction of AB is defined using symbolic perturbations and therefore is
	// not predictable by ordinary users, and (2) Loop disallows anitpodal
	// adjacent vertices and so we would need to use 4 vertices to define the
	// degenerate loop. (Note that the Loop antipodal vertex restriction is
	// historical and now could easily be removed, however it would still have
	// the problem that the edge direction is not easily predictable.)
	if a.Add(b.Vector) == (r3.Vector{}) {
		return FullLoop()
	}

	// Construct a loop consisting of the two vertices and their midpoint.  We
	// use Interpolate() to ensure that the midpoint is very close to
	// the edge even when its endpoints nearly antipodal.
	vertices := []Point{a, b, Interpolate(0.5, a, b)}
	loop := LoopFromPoints(vertices)
	// The resulting loop may be clockwise, so invert it if necessary.
	loop.Normalize()
	return loop
}
