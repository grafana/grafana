// Copyright 2019 Google Inc. All rights reserved.
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

	"github.com/blevesearch/geo/s1"
)

// EdgeQueryOptions holds the options for controlling how EdgeQuery operates.
//
// Options can be chained together builder-style:
//
//		opts = NewClosestEdgeQueryOptions().
//			MaxResults(1).
//			DistanceLimit(s1.ChordAngleFromAngle(3 * s1.Degree)).
//			MaxError(s1.ChordAngleFromAngle(0.001 * s1.Degree))
//		query = NewClosestEdgeQuery(index, opts)
//
//	 or set individually:
//
//		opts = NewClosestEdgeQueryOptions()
//		opts.IncludeInteriors(true)
//
// or just inline:
//
//	query = NewClosestEdgeQuery(index, NewClosestEdgeQueryOptions().MaxResults(3))
//
// If you pass a nil as the options you get the default values for the options.
type EdgeQueryOptions struct {
	common *queryOptions
}

// DistanceLimit specifies that only edges whose distance to the target is
// within, this distance should be returned.  Edges whose distance is equal
// are not returned. To include values that are equal, specify the limit with
// the next largest representable distance. i.e. limit.Successor().
func (e *EdgeQueryOptions) DistanceLimit(limit s1.ChordAngle) *EdgeQueryOptions {
	e.common = e.common.DistanceLimit(limit)
	return e
}

// IncludeInteriors specifies whether polygon interiors should be
// included when measuring distances.
func (e *EdgeQueryOptions) IncludeInteriors(x bool) *EdgeQueryOptions {
	e.common = e.common.IncludeInteriors(x)
	return e
}

// UseBruteForce sets or disables the use of brute force in a query.
func (e *EdgeQueryOptions) UseBruteForce(x bool) *EdgeQueryOptions {
	e.common = e.common.UseBruteForce(x)
	return e
}

// MaxError specifies that edges up to dist away than the true
// matching edges may be substituted in the result set, as long as such
// edges satisfy all the remaining search criteria (such as DistanceLimit).
// This option only has an effect if MaxResults is also specified;
// otherwise all edges closer than MaxDistance will always be returned.
func (e *EdgeQueryOptions) MaxError(dist s1.ChordAngle) *EdgeQueryOptions {
	e.common = e.common.MaxError(dist)
	return e
}

// MaxResults specifies that at most MaxResults edges should be returned.
// This must be at least 1.
func (e *EdgeQueryOptions) MaxResults(n int) *EdgeQueryOptions {
	e.common = e.common.MaxResults(n)
	return e
}

// NewClosestEdgeQueryOptions returns a set of edge query options suitable
// for performing closest edge queries.
func NewClosestEdgeQueryOptions() *EdgeQueryOptions {
	return &EdgeQueryOptions{
		common: newQueryOptions(minDistance(0)),
	}
}

// NewFurthestEdgeQueryOptions returns a set of edge query options suitable
// for performing furthest edge queries.
func NewFurthestEdgeQueryOptions() *EdgeQueryOptions {
	return &EdgeQueryOptions{
		common: newQueryOptions(maxDistance(0)),
	}
}

// EdgeQueryResult represents an edge that meets the target criteria for the
// query. Note the following special cases:
//
//   - ShapeID >= 0 && EdgeID < 0 represents the interior of a shape.
//     Such results may be returned when the option IncludeInteriors is true.
//
//   - ShapeID < 0 && EdgeID < 0 is returned to indicate that no edge
//     satisfies the requested query options.
type EdgeQueryResult struct {
	distance distance
	shapeID  int32
	edgeID   int32
}

// Distance reports the distance between the edge in this shape that satisfied
// the query's parameters.
func (e EdgeQueryResult) Distance() s1.ChordAngle { return e.distance.chordAngle() }

// ShapeID reports the ID of the Shape this result is for.
func (e EdgeQueryResult) ShapeID() int32 { return e.shapeID }

// EdgeID reports the ID of the edge in the results Shape.
func (e EdgeQueryResult) EdgeID() int32 { return e.edgeID }

// newEdgeQueryResult returns a result instance with default values.
func newEdgeQueryResult(target distanceTarget) EdgeQueryResult {
	return EdgeQueryResult{
		distance: target.distance().infinity(),
		shapeID:  -1,
		edgeID:   -1,
	}
}

// IsInterior reports if this result represents the interior of a Shape.
func (e EdgeQueryResult) IsInterior() bool {
	return e.shapeID >= 0 && e.edgeID < 0
}

// IsEmpty reports if this has no edge that satisfies the given edge query options.
// This result is only returned in one special case, namely when FindEdge() does
// not find any suitable edges.
func (e EdgeQueryResult) IsEmpty() bool {
	return e.shapeID < 0
}

// Less reports if this results is less that the other first by distance,
// then by (shapeID, edgeID). This is used for sorting.
func (e EdgeQueryResult) Less(other EdgeQueryResult) bool {
	if e.distance.chordAngle() != other.distance.chordAngle() {
		return e.distance.less(other.distance)
	}
	if e.shapeID != other.shapeID {
		return e.shapeID < other.shapeID
	}
	return e.edgeID < other.edgeID
}

// EdgeQuery is used to find the edge(s) between two geometries that match a
// given set of options. It is flexible enough so that it can be adapted to
// compute maximum distances and even potentially Hausdorff distances.
//
// By using the appropriate options, this type can answer questions such as:
//
//   - Find the minimum distance between two geometries A and B.
//   - Find all edges of geometry A that are within a distance D of geometry B.
//   - Find the k edges of geometry A that are closest to a given point P.
//
// You can also specify whether polygons should include their interiors (i.e.,
// if a point is contained by a polygon, should the distance be zero or should
// it be measured to the polygon boundary?)
//
// The input geometries may consist of any number of points, polylines, and
// polygons (collectively referred to as "shapes"). Shapes do not need to be
// disjoint; they may overlap or intersect arbitrarily. The implementation is
// designed to be fast for both simple and complex geometries.
type EdgeQuery struct {
	index  *ShapeIndex
	opts   *queryOptions
	target distanceTarget

	// True if opts.maxError must be subtracted from ShapeIndex cell distances
	// in order to ensure that such distances are measured conservatively. This
	// is true only if the target takes advantage of maxError in order to
	// return faster results, and 0 < maxError < distanceLimit.
	useConservativeCellDistance bool

	// The decision about whether to use the brute force algorithm is based on
	// counting the total number of edges in the index. However if the index
	// contains a large number of shapes, this in itself might take too long.
	// So instead we only count edges up to (maxBruteForceIndexSize() + 1)
	// for the current target type (stored as indexNumEdgesLimit).
	indexNumEdges      int
	indexNumEdgesLimit int

	// The distance beyond which we can safely ignore further candidate edges.
	// (Candidates that are exactly at the limit are ignored; this is more
	// efficient for UpdateMinDistance and should not affect clients since
	// distance measurements have a small amount of error anyway.)
	//
	// Initially this is the same as the maximum distance specified by the user,
	// but it can also be updated by the algorithm (see maybeAddResult).
	distanceLimit distance

	// The current set of results of the query.
	results []EdgeQueryResult

	// This field is true when duplicates must be avoided explicitly. This
	// is achieved by maintaining a separate set keyed by (shapeID, edgeID)
	// only, and checking whether each edge is in that set before computing the
	// distance to it.
	avoidDuplicates bool

	// testedEdges tracks the set of shape and edges that have already been tested.
	testedEdges map[ShapeEdgeID]uint32

	// For the optimized algorithm we precompute the top-level CellIDs that
	// will be added to the priority queue. There can be at most 6 of these
	// cells. Essentially this is just a covering of the indexed edges, except
	// that we also store pointers to the corresponding ShapeIndexCells to
	// reduce the number of index seeks required.
	indexCovering []CellID
	indexCells    []*ShapeIndexCell

	// The algorithm maintains a priority queue of unprocessed CellIDs, sorted
	// in increasing order of distance from the target.
	queue *queryQueue

	iter                *ShapeIndexIterator
	maxDistanceCovering []CellID
	initialCells        []CellID
}

// NewClosestEdgeQuery returns an EdgeQuery that is used for finding the
// closest edge(s) to a given Point, Edge, Cell, or geometry collection.
//
// You can find either the k closest edges, or all edges within a given
// radius, or both (i.e., the k closest edges up to a given maximum radius).
// E.g. to find all the edges within 5 kilometers, set the DistanceLimit in
// the options.
//
// By default *all* edges are returned, so you should always specify either
// MaxResults or DistanceLimit options or both.
//
// Note that by default, distances are measured to the boundary and interior
// of polygons. For example, if a point is inside a polygon then its distance
// is zero. To change this behavior, set the IncludeInteriors option to false.
//
// If you only need to test whether the distance is above or below a given
// threshold (e.g., 10 km), you can use the IsDistanceLess() method.  This is
// much faster than actually calculating the distance with FindEdge,
// since the implementation can stop as soon as it can prove that the minimum
// distance is either above or below the threshold.
func NewClosestEdgeQuery(index *ShapeIndex, opts *EdgeQueryOptions) *EdgeQuery {
	if opts == nil {
		opts = NewClosestEdgeQueryOptions()
	}
	e := &EdgeQuery{
		testedEdges: make(map[ShapeEdgeID]uint32),
		index:       index,
		opts:        opts.common,
		queue:       newQueryQueue(),
	}

	return e
}

// NewFurthestEdgeQuery returns an EdgeQuery that is used for finding the
// furthest edge(s) to a given Point, Edge, Cell, or geometry collection.
//
// The furthest edge is defined as the one which maximizes the
// distance from any point on that edge to any point on the target geometry.
//
// Similar to the example in NewClosestEdgeQuery, to find the 5 furthest edges
// from a given Point:
func NewFurthestEdgeQuery(index *ShapeIndex, opts *EdgeQueryOptions) *EdgeQuery {
	if opts == nil {
		opts = NewFurthestEdgeQueryOptions()
	}
	e := &EdgeQuery{
		testedEdges: make(map[ShapeEdgeID]uint32),
		index:       index,
		opts:        opts.common,
		queue:       newQueryQueue(),
	}

	return e
}

// Reset resets the state of this EdgeQuery.
func (e *EdgeQuery) Reset() {
	e.indexNumEdges = 0
	e.indexNumEdgesLimit = 0
	e.indexCovering = nil
	e.indexCells = nil
}

// FindEdges returns the edges for the given target that satisfy the current options.
//
// Note that if opts.IncludeInteriors is true, the results may include some
// entries with edge_id == -1. This indicates that the target intersects
// the indexed polygon with the given ShapeID.
func (e *EdgeQuery) FindEdges(target distanceTarget) []EdgeQueryResult {
	return e.findEdges(target, e.opts)
}

// Distance reports the distance to the target. If the index or target is empty,
// returns the EdgeQuery's maximal sentinel.
//
// Use IsDistanceLess()/IsDistanceGreater() if you only want to compare the
// distance against a threshold value, since it is often much faster.
func (e *EdgeQuery) Distance(target distanceTarget) s1.ChordAngle {
	return e.findEdge(target, e.opts).Distance()
}

// IsDistanceLess reports if the distance to target is less than the given limit.
//
// This method is usually much faster than Distance(), since it is much
// less work to determine whether the minimum distance is above or below a
// threshold than it is to calculate the actual minimum distance.
//
// If you wish to check if the distance is less than or equal to the limit, use:
//
//	query.IsDistanceLess(target, limit.Successor())
func (e *EdgeQuery) IsDistanceLess(target distanceTarget, limit s1.ChordAngle) bool {
	opts := e.opts
	opts = opts.MaxResults(1).
		DistanceLimit(limit).
		MaxError(s1.StraightChordAngle)
	return !e.findEdge(target, opts).IsEmpty()
}

// IsDistanceGreater reports if the distance to target is greater than limit.
//
// This method is usually much faster than Distance, since it is much
// less work to determine whether the maximum distance is above or below a
// threshold than it is to calculate the actual maximum distance.
// If you wish to check if the distance is less than or equal to the limit, use:
//
//	query.IsDistanceGreater(target, limit.Predecessor())
func (e *EdgeQuery) IsDistanceGreater(target distanceTarget, limit s1.ChordAngle) bool {
	return e.IsDistanceLess(target, limit)
}

// IsConservativeDistanceLessOrEqual reports if the distance to target is less
// or equal to the limit, where the limit has been expanded by the maximum error
// for the distance calculation.
//
// For example, suppose that we want to test whether two geometries might
// intersect each other after they are snapped together using Builder
// (using the IdentitySnapFunction with a given "snap radius").  Since
// Builder uses exact distance predicates (s2predicates), we need to
// measure the distance between the two geometries conservatively.  If the
// distance is definitely greater than "snap radius", then the geometries
// are guaranteed to not intersect after snapping.
func (e *EdgeQuery) IsConservativeDistanceLessOrEqual(target distanceTarget, limit s1.ChordAngle) bool {
	return e.IsDistanceLess(target, limit.Expanded(minUpdateDistanceMaxError(limit)))
}

// IsConservativeDistanceGreaterOrEqual reports if the distance to the target is greater
// than or equal to the given limit with some small tolerance.
func (e *EdgeQuery) IsConservativeDistanceGreaterOrEqual(target distanceTarget, limit s1.ChordAngle) bool {
	return e.IsDistanceGreater(target, limit.Expanded(-minUpdateDistanceMaxError(limit)))
}

// findEdges returns the closest edges to the given target that satisfy the given options.
//
// Note that if opts.includeInteriors is true, the results may include some
// entries with edgeID == -1. This indicates that the target intersects the
// indexed polygon with the given shapeID.
func (e *EdgeQuery) findEdges(target distanceTarget, opts *queryOptions) []EdgeQueryResult {
	e.findEdgesInternal(target, opts)
	// TODO(roberts): Revisit this if there is a heap or other sorted and
	// uniquing datastructure we can use instead of just a slice.
	e.results = sortAndUniqueResults(e.results)
	if len(e.results) > e.opts.maxResults {
		e.results = e.results[:e.opts.maxResults]
	}
	return e.results
}

func sortAndUniqueResults(results []EdgeQueryResult) []EdgeQueryResult {
	if len(results) <= 1 {
		return results
	}
	sort.Slice(results, func(i, j int) bool { return results[i].Less(results[j]) })
	j := 0
	for i := 1; i < len(results); i++ {
		if results[j] == results[i] {
			continue
		}
		j++
		results[j] = results[i]
	}
	return results[:j+1]
}

// findEdge is a convenience method that returns exactly one edge, and if no
// edges satisfy the given search criteria, then a default Result is returned.
//
// This is primarily to ease the usage of a number of the methods in the DistanceTargets
// and in EdgeQuery.
func (e *EdgeQuery) findEdge(target distanceTarget, opts *queryOptions) EdgeQueryResult {
	opts.MaxResults(1)
	e.findEdges(target, opts)
	if len(e.results) > 0 {
		return e.results[0]
	}

	return newEdgeQueryResult(target)
}

// findEdgesInternal does the actual work for find edges that match the given options.
func (e *EdgeQuery) findEdgesInternal(target distanceTarget, opts *queryOptions) {
	e.target = target
	e.opts = opts

	e.testedEdges = make(map[ShapeEdgeID]uint32)
	e.distanceLimit = target.distance().fromChordAngle(opts.distanceLimit)
	e.results = make([]EdgeQueryResult, 0)

	if e.distanceLimit == target.distance().zero() {
		return
	}

	if opts.includeInteriors {
		shapeIDs := map[int32]struct{}{}
		e.target.visitContainingShapes(e.index, func(containingShape Shape, targetPoint Point) bool {
			shapeIDs[e.index.idForShape(containingShape)] = struct{}{}
			return len(shapeIDs) < opts.maxResults
		})
		for shapeID := range shapeIDs {
			e.addResult(EdgeQueryResult{target.distance().zero(), shapeID, -1})
		}

		if e.distanceLimit == target.distance().zero() {
			return
		}
	}

	// If maxError > 0 and the target takes advantage of this, then we may
	// need to adjust the distance estimates to ShapeIndex cells to ensure
	// that they are always a lower bound on the true distance. For example,
	// suppose max_distance == 100, maxError == 30, and we compute the distance
	// to the target from some cell C0 as d(C0) == 80. Then because the target
	// takes advantage of maxError, the true distance could be as low as 50.
	// In order not to miss edges contained by such cells, we need to subtract
	// maxError from the distance estimates. This behavior is controlled by
	// the useConservativeCellDistance flag.
	//
	// However there is one important case where this adjustment is not
	// necessary, namely when distanceLimit < maxError, This is because
	// maxError only affects the algorithm once at least maxEdges edges
	// have been found that satisfy the given distance limit. At that point,
	// maxError is subtracted from distanceLimit in order to ensure that
	// any further matches are closer by at least that amount. But when
	// distanceLimit < maxError, this reduces the distance limit to 0,
	// i.e. all remaining candidate cells and edges can safely be discarded.
	// (This is how IsDistanceLess() and friends are implemented.)
	targetUsesMaxError := opts.maxError != target.distance().zero().chordAngle() &&
		e.target.setMaxError(opts.maxError)

	// Note that we can't compare maxError and distanceLimit directly
	// because one is a Delta and one is a Distance. Instead we subtract them.
	e.useConservativeCellDistance = targetUsesMaxError &&
		(e.distanceLimit == target.distance().infinity() ||
			target.distance().zero().less(e.distanceLimit.sub(target.distance().fromChordAngle(opts.maxError))))

	// Use the brute force algorithm if the index is small enough. To avoid
	// spending too much time counting edges when there are many shapes, we stop
	// counting once there are too many edges. We may need to recount the edges
	// if we later see a target with a larger brute force edge threshold.
	minOptimizedEdges := e.target.maxBruteForceIndexSize() + 1
	if minOptimizedEdges > e.indexNumEdgesLimit && e.indexNumEdges >= e.indexNumEdgesLimit {
		e.indexNumEdges = e.index.NumEdgesUpTo(minOptimizedEdges)
		e.indexNumEdgesLimit = minOptimizedEdges
	}

	if opts.useBruteForce || e.indexNumEdges < minOptimizedEdges {
		// The brute force algorithm already considers each edge exactly once.
		e.avoidDuplicates = false
		e.findEdgesBruteForce()
	} else {
		// If the target takes advantage of maxError then we need to avoid
		// duplicate edges explicitly. (Otherwise it happens automatically.)
		e.avoidDuplicates = targetUsesMaxError && opts.maxResults > 1
		e.findEdgesOptimized()
	}
}

func (e *EdgeQuery) addResult(r EdgeQueryResult) {
	e.results = append(e.results, r)
	if e.opts.maxResults == 1 {
		// Optimization for the common case where only the closest edge is wanted.
		e.distanceLimit = r.distance.sub(e.target.distance().fromChordAngle(e.opts.maxError))
	}
	// TODO(roberts): Add the other if/else cases when a different data structure
	// is used for the results.
}

func (e *EdgeQuery) maybeAddResult(shape Shape, shapeID, edgeID int32) {
	if _, ok := e.testedEdges[ShapeEdgeID{shapeID, edgeID}]; e.avoidDuplicates && !ok {
		return
	}
	edge := shape.Edge(int(edgeID))
	dist := e.distanceLimit

	if dist, ok := e.target.updateDistanceToEdge(edge, dist); ok {
		e.addResult(EdgeQueryResult{dist, shapeID, edgeID})
	}
}

func (e *EdgeQuery) findEdgesBruteForce() {
	// Range over all shapes in the index. Does order matter here? if so
	// switch to for i = 0 .. n?
	for shapeID, shape := range e.index.shapes {
		// TODO(roberts): can this happen if we are only ranging over current entries?
		if shape == nil {
			continue
		}
		for edgeID := int32(0); edgeID < int32(shape.NumEdges()); edgeID++ {
			e.maybeAddResult(shape, shapeID, edgeID)
		}
	}
}

func (e *EdgeQuery) findEdgesOptimized() {
	e.initQueue()
	// Repeatedly find the closest Cell to "target" and either split it into
	// its four children or process all of its edges.
	for e.queue.size() > 0 {
		// We need to copy the top entry before removing it, and we need to
		// remove it before adding any new entries to the queue.
		entry := e.queue.pop()

		if !entry.distance.less(e.distanceLimit) {
			e.queue.reset() // Clear any remaining entries.
			break
		}
		// If this is already known to be an index cell, just process it.
		if entry.indexCell != nil {
			e.processEdges(entry)
			continue
		}
		// Otherwise split the cell into its four children.  Before adding a
		// child back to the queue, we first check whether it is empty.  We do
		// this in two seek operations rather than four by seeking to the key
		// between children 0 and 1 and to the key between children 2 and 3.
		id := entry.id
		ch := id.Children()
		e.iter.seek(ch[1].RangeMin())

		if !e.iter.Done() && e.iter.CellID() <= ch[1].RangeMax() {
			e.processOrEnqueueCell(ch[1])
		}
		if e.iter.Prev() && e.iter.CellID() >= id.RangeMin() {
			e.processOrEnqueueCell(ch[0])
		}

		e.iter.seek(ch[3].RangeMin())
		if !e.iter.Done() && e.iter.CellID() <= id.RangeMax() {
			e.processOrEnqueueCell(ch[3])
		}
		if e.iter.Prev() && e.iter.CellID() >= ch[2].RangeMin() {
			e.processOrEnqueueCell(ch[2])
		}
	}
}

func (e *EdgeQuery) processOrEnqueueCell(id CellID) {
	if e.iter.CellID() == id {
		e.processOrEnqueue(id, e.iter.IndexCell())
	} else {
		e.processOrEnqueue(id, nil)
	}
}

func (e *EdgeQuery) initQueue() {
	if len(e.indexCovering) == 0 {
		// We delay iterator initialization until now to make queries on very
		// small indexes a bit faster (i.e., where brute force is used).
		e.iter = NewShapeIndexIterator(e.index)
	}

	// Optimization: if the user is searching for just the closest edge, and the
	// center of the target's bounding cap happens to intersect an index cell,
	// then we try to limit the search region to a small disc by first
	// processing the edges in that cell.  This sets distance_limit_ based on
	// the closest edge in that cell, which we can then use to limit the search
	// area.  This means that the cell containing "target" will be processed
	// twice, but in general this is still faster.
	//
	// TODO(roberts): Even if the cap center is not contained, we could still
	// process one or both of the adjacent index cells in CellID order,
	// provided that those cells are closer than distanceLimit.
	cb := e.target.capBound()
	if cb.IsEmpty() {
		return // Empty target.
	}

	if e.opts.maxResults == 1 && e.iter.LocatePoint(cb.Center()) {
		e.processEdges(&queryQueueEntry{
			distance:  e.target.distance().zero(),
			id:        e.iter.CellID(),
			indexCell: e.iter.IndexCell(),
		})
		// Skip the rest of the algorithm if we found an intersecting edge.
		if e.distanceLimit == e.target.distance().zero() {
			return
		}
	}
	if len(e.indexCovering) == 0 {
		e.initCovering()
	}
	if e.distanceLimit == e.target.distance().infinity() {
		// Start with the precomputed index covering.
		for i := range e.indexCovering {
			e.processOrEnqueue(e.indexCovering[i], e.indexCells[i])
		}
	} else {
		// Compute a covering of the search disc and intersect it with the
		// precomputed index covering.
		coverer := &RegionCoverer{MaxCells: 4, LevelMod: 1, MaxLevel: MaxLevel}

		radius := cb.Radius() + e.distanceLimit.chordAngleBound().Angle()
		searchCB := CapFromCenterAngle(cb.Center(), radius)
		maxDistCover := coverer.FastCovering(searchCB)
		e.initialCells = CellUnionFromIntersection(e.indexCovering, maxDistCover)

		// Now we need to clean up the initial cells to ensure that they all
		// contain at least one cell of the ShapeIndex. (Some may not intersect
		// the index at all, while other may be descendants of an index cell.)
		i, j := 0, 0
		for i < len(e.initialCells) {
			idI := e.initialCells[i]
			// Find the top-level cell that contains this initial cell.
			for e.indexCovering[j].RangeMax() < idI {
				j++
			}

			idJ := e.indexCovering[j]
			if idI == idJ {
				// This initial cell is one of the top-level cells.  Use the
				// precomputed ShapeIndexCell pointer to avoid an index seek.
				e.processOrEnqueue(idJ, e.indexCells[j])
				i++
				j++
			} else {
				// This initial cell is a proper descendant of a top-level cell.
				// Check how it is related to the cells of the ShapeIndex.
				r := e.iter.LocateCellID(idI)
				if r == Indexed {
					// This cell is a descendant of an index cell.
					// Enqueue it and skip any other initial cells
					// that are also descendants of this cell.
					e.processOrEnqueue(e.iter.CellID(), e.iter.IndexCell())
					lastID := e.iter.CellID().RangeMax()
					for i < len(e.initialCells) && e.initialCells[i] <= lastID {
						i++
					}
				} else {
					// Enqueue the cell only if it contains at least one index cell.
					if r == Subdivided {
						e.processOrEnqueue(idI, nil)
					}
					i++
				}
			}
		}
	}
}

func (e *EdgeQuery) initCovering() {
	// Find the range of Cells spanned by the index and choose a level such
	// that the entire index can be covered with just a few cells. These are
	// the "top-level" cells. There are two cases:
	//
	//  - If the index spans more than one face, then there is one top-level cell
	// per spanned face, just big enough to cover the index cells on that face.
	//
	//  - If the index spans only one face, then we find the smallest cell "C"
	// that covers the index cells on that face (just like the case above).
	// Then for each of the 4 children of "C", if the child contains any index
	// cells then we create a top-level cell that is big enough to just fit
	// those index cells (i.e., shrinking the child as much as possible to fit
	// its contents). This essentially replicates what would happen if we
	// started with "C" as the top-level cell, since "C" would immediately be
	// split, except that we take the time to prune the children further since
	// this will save work on every subsequent query.
	e.indexCovering = make([]CellID, 0, 6)

	// TODO(roberts): Use a single iterator below and save position
	// information using pair {CellID, ShapeIndexCell}.
	next := NewShapeIndexIterator(e.index, IteratorBegin)
	last := NewShapeIndexIterator(e.index, IteratorEnd)
	last.Prev()
	if next.CellID() != last.CellID() {
		// The index has at least two cells. Choose a level such that the entire
		// index can be spanned with at most 6 cells (if the index spans multiple
		// faces) or 4 cells (it the index spans a single face).
		level, ok := next.CellID().CommonAncestorLevel(last.CellID())
		if !ok {
			level = 0
		} else {
			level++
		}

		// Visit each potential top-level cell except the last (handled below).
		lastID := last.CellID().Parent(level)
		for id := next.CellID().Parent(level); id != lastID; id = id.Next() {
			// Skip any top-level cells that don't contain any index cells.
			if id.RangeMax() < next.CellID() {
				continue
			}

			// Find the range of index cells contained by this top-level cell and
			// then shrink the cell if necessary so that it just covers them.
			cellFirst := next.clone()
			next.seek(id.RangeMax().Next())
			cellLast := next.clone()
			cellLast.Prev()
			e.addInitialRange(cellFirst, cellLast)
			break
		}

	}
	e.addInitialRange(next, last)
}

// addInitialRange adds an entry to the indexCovering and indexCells that covers the given
// inclusive range of cells.
//
// This requires that first and last cells have a common ancestor.
func (e *EdgeQuery) addInitialRange(first, last *ShapeIndexIterator) {
	if first.CellID() == last.CellID() {
		// The range consists of a single index cell.
		e.indexCovering = append(e.indexCovering, first.CellID())
		e.indexCells = append(e.indexCells, first.IndexCell())
	} else {
		// Add the lowest common ancestor of the given range.
		level, _ := first.CellID().CommonAncestorLevel(last.CellID())
		e.indexCovering = append(e.indexCovering, first.CellID().Parent(level))
		e.indexCells = append(e.indexCells, nil)
	}
}

// processEdges processes all the edges of the given index cell.
func (e *EdgeQuery) processEdges(entry *queryQueueEntry) {
	for _, clipped := range entry.indexCell.shapes {
		shape := e.index.Shape(clipped.shapeID)
		for j := 0; j < clipped.numEdges(); j++ {
			e.maybeAddResult(shape, clipped.shapeID, int32(clipped.edges[j]))
		}
	}
}

// processOrEnqueue the given cell id and indexCell.
func (e *EdgeQuery) processOrEnqueue(id CellID, indexCell *ShapeIndexCell) {
	if indexCell != nil {
		// If this index cell has only a few edges, then it is faster to check
		// them directly rather than computing the minimum distance to the Cell
		// and inserting it into the queue.
		const minEdgesToEnqueue = 10
		numEdges := indexCell.numEdges()
		if numEdges == 0 {
			return
		}
		if numEdges < minEdgesToEnqueue {
			// Set "distance" to zero to avoid the expense of computing it.
			e.processEdges(&queryQueueEntry{
				distance:  e.target.distance().zero(),
				id:        id,
				indexCell: indexCell,
			})
			return
		}
	}

	// Otherwise compute the minimum distance to any point in the cell and add
	// it to the priority queue.
	cell := CellFromCellID(id)
	dist := e.distanceLimit
	var ok bool
	if dist, ok = e.target.updateDistanceToCell(cell, dist); !ok {
		return
	}
	if e.useConservativeCellDistance {
		// Ensure that "distance" is a lower bound on the true distance to the cell.
		dist = dist.sub(e.target.distance().fromChordAngle(e.opts.maxError))
	}

	e.queue.push(&queryQueueEntry{
		distance:  dist,
		id:        id,
		indexCell: indexCell,
	})
}

func (e *EdgeQuery) GetEdge(result EdgeQueryResult) Edge {
	return e.index.Shape(result.shapeID).Edge(int(result.edgeID))
}

func (e *EdgeQuery) Project(point Point, result EdgeQueryResult) Point {
	if result.edgeID < 0 {
		return point
	}

	edge := e.GetEdge(result)
	return Project(point, edge.V0, edge.V1)
}

// TODO(roberts): Remaining pieces
// GetEdge
// Project
