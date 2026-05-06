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
	"sort"

	"github.com/golang/geo/r2"
)

// CrossingEdgeQuery is used to find the Edge IDs of Shapes that are crossed by
// a given edge(s).
//
// Note that if you need to query many edges, it is more efficient to declare
// a single CrossingEdgeQuery instance and reuse it.
//
// If you want to find *all* the pairs of crossing edges, it is more efficient to
// use the not yet implemented VisitCrossings in shapeutil.
type CrossingEdgeQuery struct {
	index *ShapeIndex

	// temporary values used while processing a query.
	a, b r2.Point
	iter *ShapeIndexIterator

	// candidate cells generated when finding crossings.
	cells []*ShapeIndexCell
}

// NewCrossingEdgeQuery creates a CrossingEdgeQuery for the given index.
func NewCrossingEdgeQuery(index *ShapeIndex) *CrossingEdgeQuery {
	c := &CrossingEdgeQuery{
		index: index,
		iter:  index.Iterator(),
	}
	return c
}

// Crossings returns the set of edge of the shape S that intersect the given edge AB.
// If the CrossingType is Interior, then only intersections at a point interior to both
// edges are reported, while if it is CrossingTypeAll then edges that share a vertex
// are also reported.
func (c *CrossingEdgeQuery) Crossings(a, b Point, shape Shape, crossType CrossingType) []int {
	edges := c.candidates(a, b, shape)
	if len(edges) == 0 {
		return nil
	}

	crosser := NewEdgeCrosser(a, b)
	out := 0
	n := len(edges)

	for in := 0; in < n; in++ {
		b := shape.Edge(edges[in])
		sign := crosser.CrossingSign(b.V0, b.V1)
		if crossType == CrossingTypeAll && (sign == MaybeCross || sign == Cross) || crossType != CrossingTypeAll && sign == Cross {
			edges[out] = edges[in]
			out++
		}
	}

	if out < n {
		edges = edges[0:out]
	}
	return edges
}

// EdgeMap stores a sorted set of edge ids for each shape.
type EdgeMap map[Shape][]int

// CrossingsEdgeMap returns the set of all edges in the index that intersect the given
// edge AB. If crossType is CrossingTypeInterior, then only intersections at a
// point interior to both edges are reported, while if it is CrossingTypeAll
// then edges that share a vertex are also reported.
//
// The edges are returned as a mapping from shape to the edges of that shape
// that intersect AB. Every returned shape has at least one crossing edge.
func (c *CrossingEdgeQuery) CrossingsEdgeMap(a, b Point, crossType CrossingType) EdgeMap {
	edgeMap := c.candidatesEdgeMap(a, b)
	if len(edgeMap) == 0 {
		return nil
	}

	crosser := NewEdgeCrosser(a, b)
	for shape, edges := range edgeMap {
		out := 0
		n := len(edges)
		for in := 0; in < n; in++ {
			edge := shape.Edge(edges[in])
			sign := crosser.CrossingSign(edge.V0, edge.V1)
			if (crossType == CrossingTypeAll && (sign == MaybeCross || sign == Cross)) || (crossType != CrossingTypeAll && sign == Cross) {
				edgeMap[shape][out] = edges[in]
				out++
			}
		}

		if out == 0 {
			delete(edgeMap, shape)
		} else {
			if out < n {
				edgeMap[shape] = edgeMap[shape][0:out]
			}
		}
	}
	return edgeMap
}

// candidates returns a superset of the edges of the given shape that intersect
// the edge AB.
func (c *CrossingEdgeQuery) candidates(a, b Point, shape Shape) []int {
	var edges []int

	// For small loops it is faster to use brute force. The threshold below was
	// determined using benchmarks.
	const maxBruteForceEdges = 27
	maxEdges := shape.NumEdges()
	if maxEdges <= maxBruteForceEdges {
		edges = make([]int, maxEdges)
		for i := 0; i < maxEdges; i++ {
			edges[i] = i
		}
		return edges
	}

	// Compute the set of index cells intersected by the query edge.
	c.getCellsForEdge(a, b)
	if len(c.cells) == 0 {
		return nil
	}

	// Gather all the edges that intersect those cells and sort them.
	// TODO(roberts): Shapes don't track their ID, so we need to range over
	// the index to find the ID manually.
	var shapeID int32
	for k, v := range c.index.shapes {
		if v == shape {
			shapeID = k
		}
	}

	for _, cell := range c.cells {
		if cell == nil {
			continue
		}
		clipped := cell.findByShapeID(shapeID)
		if clipped == nil {
			continue
		}
		edges = append(edges, clipped.edges...)
	}

	if len(c.cells) > 1 {
		edges = uniqueInts(edges)
	}

	return edges
}

// uniqueInts returns the sorted uniqued values from the given input.
func uniqueInts(in []int) []int {
	var edges []int
	m := make(map[int]bool)
	for _, i := range in {
		if m[i] {
			continue
		}
		m[i] = true
		edges = append(edges, i)
	}
	sort.Ints(edges)
	return edges
}

// candidatesEdgeMap returns a map from shapes to the superse of edges for that
// shape that intersect the edge AB.
//
// CAVEAT: This method may return shapes that have an empty set of candidate edges.
// However the return value is non-empty only if at least one shape has a candidate edge.
func (c *CrossingEdgeQuery) candidatesEdgeMap(a, b Point) EdgeMap {
	edgeMap := make(EdgeMap)

	// If there are only a few edges then it's faster to use brute force. We
	// only bother with this optimization when there is a single shape.
	if len(c.index.shapes) == 1 {
		// Typically this method is called many times, so it is worth checking
		// whether the edge map is empty or already consists of a single entry for
		// this shape, and skip clearing edge map in that case.
		shape := c.index.Shape(0)

		// Note that we leave the edge map non-empty even if there are no candidates
		// (i.e., there is a single entry with an empty set of edges).
		edgeMap[shape] = c.candidates(a, b, shape)
		return edgeMap
	}

	// Compute the set of index cells intersected by the query edge.
	c.getCellsForEdge(a, b)
	if len(c.cells) == 0 {
		return edgeMap
	}

	// Gather all the edges that intersect those cells and sort them.
	for _, cell := range c.cells {
		for _, clipped := range cell.shapes {
			s := c.index.Shape(clipped.shapeID)
			for j := 0; j < clipped.numEdges(); j++ {
				edgeMap[s] = append(edgeMap[s], clipped.edges[j])
			}
		}
	}

	if len(c.cells) > 1 {
		for s, edges := range edgeMap {
			edgeMap[s] = uniqueInts(edges)
		}
	}

	return edgeMap
}

// getCells returns the set of ShapeIndexCells that might contain edges intersecting
// the edge AB in the given cell root. This method is used primarily by loop and shapeutil.
func (c *CrossingEdgeQuery) getCells(a, b Point, root *PaddedCell) []*ShapeIndexCell {
	aUV, bUV, ok := ClipToFace(a, b, root.id.Face())
	if ok {
		c.a = aUV
		c.b = bUV
		edgeBound := r2.RectFromPoints(c.a, c.b)
		if root.Bound().Intersects(edgeBound) {
			c.computeCellsIntersected(root, edgeBound)
		}
	}

	if len(c.cells) == 0 {
		return nil
	}

	return c.cells
}

// getCellsForEdge populates the cells field to the set of index cells intersected by an edge AB.
func (c *CrossingEdgeQuery) getCellsForEdge(a, b Point) {
	c.cells = nil

	segments := FaceSegments(a, b)
	for _, segment := range segments {
		c.a = segment.a
		c.b = segment.b

		// Optimization: rather than always starting the recursive subdivision at
		// the top level face cell, instead we start at the smallest S2CellId that
		// contains the edge (the edge root cell). This typically lets us skip
		// quite a few levels of recursion since most edges are short.
		edgeBound := r2.RectFromPoints(c.a, c.b)
		pcell := PaddedCellFromCellID(CellIDFromFace(segment.face), 0)
		edgeRoot := pcell.ShrinkToFit(edgeBound)

		// Now we need to determine how the edge root cell is related to the cells
		// in the spatial index (cellMap). There are three cases:
		//
		//  1. edgeRoot is an index cell or is contained within an index cell.
		//     In this case we only need to look at the contents of that cell.
		//  2. edgeRoot is subdivided into one or more index cells. In this case
		//     we recursively subdivide to find the cells intersected by AB.
		//  3. edgeRoot does not intersect any index cells. In this case there
		//     is nothing to do.
		relation := c.iter.LocateCellID(edgeRoot)
		if relation == Indexed {
			// edgeRoot is an index cell or is contained by an index cell (case 1).
			c.cells = append(c.cells, c.iter.IndexCell())
		} else if relation == Subdivided {
			// edgeRoot is subdivided into one or more index cells (case 2). We
			// find the cells intersected by AB using recursive subdivision.
			if !edgeRoot.isFace() {
				pcell = PaddedCellFromCellID(edgeRoot, 0)
			}
			c.computeCellsIntersected(pcell, edgeBound)
		}
	}
}

// computeCellsIntersected computes the index cells intersected by the current
// edge that are descendants of pcell and adds them to this queries set of cells.
func (c *CrossingEdgeQuery) computeCellsIntersected(pcell *PaddedCell, edgeBound r2.Rect) {

	c.iter.seek(pcell.id.RangeMin())
	if c.iter.Done() || c.iter.CellID() > pcell.id.RangeMax() {
		// The index does not contain pcell or any of its descendants.
		return
	}
	if c.iter.CellID() == pcell.id {
		// The index contains this cell exactly.
		c.cells = append(c.cells, c.iter.IndexCell())
		return
	}

	// Otherwise, split the edge among the four children of pcell.
	center := pcell.Middle().Lo()

	if edgeBound.X.Hi < center.X {
		// Edge is entirely contained in the two left children.
		c.clipVAxis(edgeBound, center.Y, 0, pcell)
		return
	} else if edgeBound.X.Lo >= center.X {
		// Edge is entirely contained in the two right children.
		c.clipVAxis(edgeBound, center.Y, 1, pcell)
		return
	}

	childBounds := c.splitUBound(edgeBound, center.X)
	if edgeBound.Y.Hi < center.Y {
		// Edge is entirely contained in the two lower children.
		c.computeCellsIntersected(PaddedCellFromParentIJ(pcell, 0, 0), childBounds[0])
		c.computeCellsIntersected(PaddedCellFromParentIJ(pcell, 1, 0), childBounds[1])
	} else if edgeBound.Y.Lo >= center.Y {
		// Edge is entirely contained in the two upper children.
		c.computeCellsIntersected(PaddedCellFromParentIJ(pcell, 0, 1), childBounds[0])
		c.computeCellsIntersected(PaddedCellFromParentIJ(pcell, 1, 1), childBounds[1])
	} else {
		// The edge bound spans all four children. The edge itself intersects
		// at most three children (since no padding is being used).
		c.clipVAxis(childBounds[0], center.Y, 0, pcell)
		c.clipVAxis(childBounds[1], center.Y, 1, pcell)
	}
}

// clipVAxis computes the intersected cells recursively for a given padded cell.
// Given either the left (i=0) or right (i=1) side of a padded cell pcell,
// determine whether the current edge intersects the lower child, upper child,
// or both children, and call c.computeCellsIntersected recursively on those children.
// The center is the v-coordinate at the center of pcell.
func (c *CrossingEdgeQuery) clipVAxis(edgeBound r2.Rect, center float64, i int, pcell *PaddedCell) {
	if edgeBound.Y.Hi < center {
		// Edge is entirely contained in the lower child.
		c.computeCellsIntersected(PaddedCellFromParentIJ(pcell, i, 0), edgeBound)
	} else if edgeBound.Y.Lo >= center {
		// Edge is entirely contained in the upper child.
		c.computeCellsIntersected(PaddedCellFromParentIJ(pcell, i, 1), edgeBound)
	} else {
		// The edge intersects both children.
		childBounds := c.splitVBound(edgeBound, center)
		c.computeCellsIntersected(PaddedCellFromParentIJ(pcell, i, 0), childBounds[0])
		c.computeCellsIntersected(PaddedCellFromParentIJ(pcell, i, 1), childBounds[1])
	}
}

// splitUBound returns the bound for two children as a result of spliting the
// current edge at the given value U.
func (c *CrossingEdgeQuery) splitUBound(edgeBound r2.Rect, u float64) [2]r2.Rect {
	v := edgeBound.Y.ClampPoint(interpolateFloat64(u, c.a.X, c.b.X, c.a.Y, c.b.Y))
	// diag indicates which diagonal of the bounding box is spanned by AB:
	// it is 0 if AB has positive slope, and 1 if AB has negative slope.
	var diag int
	if (c.a.X > c.b.X) != (c.a.Y > c.b.Y) {
		diag = 1
	}
	return splitBound(edgeBound, 0, diag, u, v)
}

// splitVBound returns the bound for two children as a result of spliting the
// current edge into two child edges at the given value V.
func (c *CrossingEdgeQuery) splitVBound(edgeBound r2.Rect, v float64) [2]r2.Rect {
	u := edgeBound.X.ClampPoint(interpolateFloat64(v, c.a.Y, c.b.Y, c.a.X, c.b.X))
	var diag int
	if (c.a.X > c.b.X) != (c.a.Y > c.b.Y) {
		diag = 1
	}
	return splitBound(edgeBound, diag, 0, u, v)
}

// splitBound returns the bounds for the two childrenn as a result of spliting
// the current edge into two child edges at the given point (u,v). uEnd and vEnd
// indicate which bound endpoints of the first child will be updated.
func splitBound(edgeBound r2.Rect, uEnd, vEnd int, u, v float64) [2]r2.Rect {
	var childBounds = [2]r2.Rect{
		edgeBound,
		edgeBound,
	}

	if uEnd == 1 {
		childBounds[0].X.Lo = u
		childBounds[1].X.Hi = u
	} else {
		childBounds[0].X.Hi = u
		childBounds[1].X.Lo = u
	}

	if vEnd == 1 {
		childBounds[0].Y.Lo = v
		childBounds[1].Y.Hi = v
	} else {
		childBounds[0].Y.Hi = v
		childBounds[1].Y.Lo = v
	}

	return childBounds
}
