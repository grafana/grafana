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

import (
	"math"
	"sort"
	"sync"
	"sync/atomic"

	"github.com/golang/geo/r1"
	"github.com/golang/geo/r2"
)

// CellRelation describes the possible relationships between a target cell
// and the cells of the ShapeIndex. If the target is an index cell or is
// contained by an index cell, it is Indexed. If the target is subdivided
// into one or more index cells, it is Subdivided. Otherwise it is Disjoint.
type CellRelation int

// The possible CellRelations for a ShapeIndex.
const (
	Indexed CellRelation = iota
	Subdivided
	Disjoint
)

const (
	// cellPadding defines the total error when clipping an edge which comes
	// from two sources:
	// (1) Clipping the original spherical edge to a cube face (the face edge).
	//     The maximum error in this step is faceClipErrorUVCoord.
	// (2) Clipping the face edge to the u- or v-coordinate of a cell boundary.
	//     The maximum error in this step is edgeClipErrorUVCoord.
	// Finally, since we encounter the same errors when clipping query edges, we
	// double the total error so that we only need to pad edges during indexing
	// and not at query time.
	cellPadding = 2.0 * (faceClipErrorUVCoord + edgeClipErrorUVCoord)

	// cellSizeToLongEdgeRatio defines the cell size relative to the length of an
	// edge at which it is first considered to be long. Long edges do not
	// contribute toward the decision to subdivide a cell further. For example,
	// a value of 2.0 means that the cell must be at least twice the size of the
	// edge in order for that edge to be counted. There are two reasons for not
	// counting long edges: (1) such edges typically need to be propagated to
	// several children, which increases time and memory costs without much benefit,
	// and (2) in pathological cases, many long edges close together could force
	// subdivision to continue all the way to the leaf cell level.
	cellSizeToLongEdgeRatio = 1.0
)

// clippedShape represents the part of a shape that intersects a Cell.
// It consists of the set of edge IDs that intersect that cell and a boolean
// indicating whether the center of the cell is inside the shape (for shapes
// that have an interior).
//
// Note that the edges themselves are not clipped; we always use the original
// edges for intersection tests so that the results will be the same as the
// original shape.
type clippedShape struct {
	// shapeID is the index of the shape this clipped shape is a part of.
	shapeID int32

	// containsCenter indicates if the center of the CellID this shape has been
	// clipped to falls inside this shape. This is false for shapes that do not
	// have an interior.
	containsCenter bool

	// edges is the ordered set of ShapeIndex original edge IDs. Edges
	// are stored in increasing order of edge ID.
	edges []int
}

// newClippedShape returns a new clipped shape for the given shapeID and number of expected edges.
func newClippedShape(id int32, numEdges int) *clippedShape {
	return &clippedShape{
		shapeID: id,
		edges:   make([]int, numEdges),
	}
}

// numEdges returns the number of edges that intersect the CellID of the Cell this was clipped to.
func (c *clippedShape) numEdges() int {
	return len(c.edges)
}

// containsEdge reports if this clipped shape contains the given edge ID.
func (c *clippedShape) containsEdge(id int) bool {
	// Linear search is fast because the number of edges per shape is typically
	// very small (less than 10).
	for _, e := range c.edges {
		if e == id {
			return true
		}
	}
	return false
}

// ShapeIndexCell stores the index contents for a particular CellID.
type ShapeIndexCell struct {
	shapes []*clippedShape
}

// NewShapeIndexCell creates a new cell that is sized to hold the given number of shapes.
func NewShapeIndexCell(numShapes int) *ShapeIndexCell {
	return &ShapeIndexCell{
		shapes: make([]*clippedShape, numShapes),
	}
}

// numEdges reports the total number of edges in all clipped shapes in this cell.
func (s *ShapeIndexCell) numEdges() int {
	var e int
	for _, cs := range s.shapes {
		e += cs.numEdges()
	}
	return e
}

// add adds the given clipped shape to this index cell.
func (s *ShapeIndexCell) add(c *clippedShape) {
	// C++ uses a set, so it's ordered and unique. We don't currently catch
	// the case when a duplicate value is added.
	s.shapes = append(s.shapes, c)
}

// findByShapeID returns the clipped shape that contains the given shapeID,
// or nil if none of the clipped shapes contain it.
func (s *ShapeIndexCell) findByShapeID(shapeID int32) *clippedShape {
	// Linear search is fine because the number of shapes per cell is typically
	// very small (most often 1), and is large only for pathological inputs
	// (e.g. very deeply nested loops).
	for _, clipped := range s.shapes {
		if clipped.shapeID == shapeID {
			return clipped
		}
	}
	return nil
}

// faceEdge and clippedEdge store temporary edge data while the index is being
// updated.
//
// While it would be possible to combine all the edge information into one
// structure, there are two good reasons for separating it:
//
//  - Memory usage. Separating the two means that we only need to
//    store one copy of the per-face data no matter how many times an edge is
//    subdivided, and it also lets us delay computing bounding boxes until
//    they are needed for processing each face (when the dataset spans
//    multiple faces).
//
//  - Performance. UpdateEdges is significantly faster on large polygons when
//    the data is separated, because it often only needs to access the data in
//    clippedEdge and this data is cached more successfully.

// faceEdge represents an edge that has been projected onto a given face,
type faceEdge struct {
	shapeID     int32    // The ID of shape that this edge belongs to
	edgeID      int      // Edge ID within that shape
	maxLevel    int      // Not desirable to subdivide this edge beyond this level
	hasInterior bool     // Belongs to a shape that has a dimension of 2
	a, b        r2.Point // The edge endpoints, clipped to a given face
	edge        Edge     // The original edge.
}

// clippedEdge represents the portion of that edge that has been clipped to a given Cell.
type clippedEdge struct {
	faceEdge *faceEdge // The original unclipped edge
	bound    r2.Rect   // Bounding box for the clipped portion
}

// ShapeIndexIteratorPos defines the set of possible iterator starting positions. By
// default iterators are unpositioned, since this avoids an extra seek in this
// situation where one of the seek methods (such as Locate) is immediately called.
type ShapeIndexIteratorPos int

const (
	// IteratorBegin specifies the iterator should be positioned at the beginning of the index.
	IteratorBegin ShapeIndexIteratorPos = iota
	// IteratorEnd specifies the iterator should be positioned at the end of the index.
	IteratorEnd
)

// ShapeIndexIterator is an iterator that provides low-level access to
// the cells of the index. Cells are returned in increasing order of CellID.
//
//   for it := index.Iterator(); !it.Done(); it.Next() {
//     fmt.Print(it.CellID())
//   }
//
type ShapeIndexIterator struct {
	index    *ShapeIndex
	position int
	id       CellID
	cell     *ShapeIndexCell
}

// NewShapeIndexIterator creates a new iterator for the given index. If a starting
// position is specified, the iterator is positioned at the given spot.
func NewShapeIndexIterator(index *ShapeIndex, pos ...ShapeIndexIteratorPos) *ShapeIndexIterator {
	s := &ShapeIndexIterator{
		index: index,
	}

	if len(pos) > 0 {
		if len(pos) > 1 {
			panic("too many ShapeIndexIteratorPos arguments")
		}
		switch pos[0] {
		case IteratorBegin:
			s.Begin()
		case IteratorEnd:
			s.End()
		default:
			panic("unknown ShapeIndexIteratorPos value")
		}
	}

	return s
}

func (s *ShapeIndexIterator) clone() *ShapeIndexIterator {
	return &ShapeIndexIterator{
		index:    s.index,
		position: s.position,
		id:       s.id,
		cell:     s.cell,
	}
}

// CellID returns the CellID of the current index cell.
// If s.Done() is true, a value larger than any valid CellID is returned.
func (s *ShapeIndexIterator) CellID() CellID {
	return s.id
}

// IndexCell returns the current index cell.
func (s *ShapeIndexIterator) IndexCell() *ShapeIndexCell {
	// TODO(roberts): C++ has this call a virtual method to allow subclasses
	// of ShapeIndexIterator to do other work before returning the cell. Do
	// we need such a thing?
	return s.cell
}

// Center returns the Point at the center of the current position of the iterator.
func (s *ShapeIndexIterator) Center() Point {
	return s.CellID().Point()
}

// Begin positions the iterator at the beginning of the index.
func (s *ShapeIndexIterator) Begin() {
	if !s.index.IsFresh() {
		s.index.maybeApplyUpdates()
	}
	s.position = 0
	s.refresh()
}

// Next positions the iterator at the next index cell.
func (s *ShapeIndexIterator) Next() {
	s.position++
	s.refresh()
}

// Prev advances the iterator to the previous cell in the index and returns true to
// indicate it was not yet at the beginning of the index. If the iterator is at the
// first cell the call does nothing and returns false.
func (s *ShapeIndexIterator) Prev() bool {
	if s.position <= 0 {
		return false
	}

	s.position--
	s.refresh()
	return true
}

// End positions the iterator at the end of the index.
func (s *ShapeIndexIterator) End() {
	s.position = len(s.index.cells)
	s.refresh()
}

// Done reports if the iterator is positioned at or after the last index cell.
func (s *ShapeIndexIterator) Done() bool {
	return s.id == SentinelCellID
}

// refresh updates the stored internal iterator values.
func (s *ShapeIndexIterator) refresh() {
	if s.position < len(s.index.cells) {
		s.id = s.index.cells[s.position]
		s.cell = s.index.cellMap[s.CellID()]
	} else {
		s.id = SentinelCellID
		s.cell = nil
	}
}

// seek positions the iterator at the first cell whose ID >= target, or at the
// end of the index if no such cell exists.
func (s *ShapeIndexIterator) seek(target CellID) {
	s.position = sort.Search(len(s.index.cells), func(i int) bool {
		return s.index.cells[i] >= target
	})
	s.refresh()
}

// LocatePoint positions the iterator at the cell that contains the given Point.
// If no such cell exists, the iterator position is unspecified, and false is returned.
// The cell at the matched position is guaranteed to contain all edges that might
// intersect the line segment between target and the cell's center.
func (s *ShapeIndexIterator) LocatePoint(p Point) bool {
	// Let I = cellMap.LowerBound(T), where T is the leaf cell containing
	// point P. Then if T is contained by an index cell, then the
	// containing cell is either I or I'. We test for containment by comparing
	// the ranges of leaf cells spanned by T, I, and I'.
	target := cellIDFromPoint(p)
	s.seek(target)
	if !s.Done() && s.CellID().RangeMin() <= target {
		return true
	}

	if s.Prev() && s.CellID().RangeMax() >= target {
		return true
	}
	return false
}

// LocateCellID attempts to position the iterator at the first matching index cell
// in the index that has some relation to the given CellID. Let T be the target CellID.
// If T is contained by (or equal to) some index cell I, then the iterator is positioned
// at I and returns Indexed. Otherwise if T contains one or more (smaller) index cells,
// then the iterator is positioned at the first such cell I and return Subdivided.
// Otherwise Disjoint is returned and the iterator position is undefined.
func (s *ShapeIndexIterator) LocateCellID(target CellID) CellRelation {
	// Let T be the target, let I = cellMap.LowerBound(T.RangeMin()), and
	// let I' be the predecessor of I. If T contains any index cells, then T
	// contains I. Similarly, if T is contained by an index cell, then the
	// containing cell is either I or I'. We test for containment by comparing
	// the ranges of leaf cells spanned by T, I, and I'.
	s.seek(target.RangeMin())
	if !s.Done() {
		if s.CellID() >= target && s.CellID().RangeMin() <= target {
			return Indexed
		}
		if s.CellID() <= target.RangeMax() {
			return Subdivided
		}
	}
	if s.Prev() && s.CellID().RangeMax() >= target {
		return Indexed
	}
	return Disjoint
}

// tracker keeps track of which shapes in a given set contain a particular point
// (the focus). It provides an efficient way to move the focus from one point
// to another and incrementally update the set of shapes which contain it. We use
// this to compute which shapes contain the center of every CellID in the index,
// by advancing the focus from one cell center to the next.
//
// Initially the focus is at the start of the CellID space-filling curve. We then
// visit all the cells that are being added to the ShapeIndex in increasing order
// of CellID. For each cell, we draw two edges: one from the entry vertex to the
// center, and another from the center to the exit vertex (where entry and exit
// refer to the points where the space-filling curve enters and exits the cell).
// By counting edge crossings we can incrementally compute which shapes contain
// the cell center. Note that the same set of shapes will always contain the exit
// point of one cell and the entry point of the next cell in the index, because
// either (a) these two points are actually the same, or (b) the intervening
// cells in CellID order are all empty, and therefore there are no edge crossings
// if we follow this path from one cell to the other.
//
// In C++, this is S2ShapeIndex::InteriorTracker.
type tracker struct {
	isActive   bool
	a          Point
	b          Point
	nextCellID CellID
	crosser    *EdgeCrosser
	shapeIDs   []int32

	// Shape ids saved by saveAndClearStateBefore. The state is never saved
	// recursively so we don't need to worry about maintaining a stack.
	savedIDs []int32
}

// newTracker returns a new tracker with the appropriate defaults.
func newTracker() *tracker {
	// As shapes are added, we compute which ones contain the start of the
	// CellID space-filling curve by drawing an edge from OriginPoint to this
	// point and counting how many shape edges cross this edge.
	t := &tracker{
		isActive:   false,
		b:          trackerOrigin(),
		nextCellID: CellIDFromFace(0).ChildBeginAtLevel(maxLevel),
	}
	t.drawTo(Point{faceUVToXYZ(0, -1, -1).Normalize()}) // CellID curve start

	return t
}

// trackerOrigin returns the initial focus point when the tracker is created
// (corresponding to the start of the CellID space-filling curve).
func trackerOrigin() Point {
	// The start of the S2CellId space-filling curve.
	return Point{faceUVToXYZ(0, -1, -1).Normalize()}
}

// focus returns the current focus point of the tracker.
func (t *tracker) focus() Point { return t.b }

// addShape adds a shape whose interior should be tracked. containsOrigin indicates
// whether the current focus point is inside the shape. Alternatively, if
// the focus point is in the process of being moved (via moveTo/drawTo), you
// can also specify containsOrigin at the old focus point and call testEdge
// for every edge of the shape that might cross the current drawTo line.
// This updates the state to correspond to the new focus point.
//
// This requires shape.HasInterior
func (t *tracker) addShape(shapeID int32, containsFocus bool) {
	t.isActive = true
	if containsFocus {
		t.toggleShape(shapeID)
	}
}

// moveTo moves the focus of the tracker to the given point. This method should
// only be used when it is known that there are no edge crossings between the old
// and new focus locations; otherwise use drawTo.
func (t *tracker) moveTo(b Point) { t.b = b }

// drawTo moves the focus of the tracker to the given point. After this method is
// called, testEdge should be called with all edges that may cross the line
// segment between the old and new focus locations.
func (t *tracker) drawTo(b Point) {
	t.a = t.b
	t.b = b
	// TODO: the edge crosser may need an in-place Init method if this gets expensive
	t.crosser = NewEdgeCrosser(t.a, t.b)
}

// testEdge checks if the given edge crosses the current edge, and if so, then
// toggle the state of the given shapeID.
// This requires shape to have an interior.
func (t *tracker) testEdge(shapeID int32, edge Edge) {
	if t.crosser.EdgeOrVertexCrossing(edge.V0, edge.V1) {
		t.toggleShape(shapeID)
	}
}

// setNextCellID is used to indicate that the last argument to moveTo or drawTo
// was the entry vertex of the given CellID, i.e. the tracker is positioned at the
// start of this cell. By using this method together with atCellID, the caller
// can avoid calling moveTo in cases where the exit vertex of the previous cell
// is the same as the entry vertex of the current cell.
func (t *tracker) setNextCellID(nextCellID CellID) {
	t.nextCellID = nextCellID.RangeMin()
}

// atCellID reports if the focus is already at the entry vertex of the given
// CellID (provided that the caller calls setNextCellID as each cell is processed).
func (t *tracker) atCellID(cellid CellID) bool {
	return cellid.RangeMin() == t.nextCellID
}

// toggleShape adds or removes the given shapeID from the set of IDs it is tracking.
func (t *tracker) toggleShape(shapeID int32) {
	// Most shapeIDs slices are small, so special case the common steps.

	// If there is nothing here, add it.
	if len(t.shapeIDs) == 0 {
		t.shapeIDs = append(t.shapeIDs, shapeID)
		return
	}

	// If it's the first element, drop it from the slice.
	if t.shapeIDs[0] == shapeID {
		t.shapeIDs = t.shapeIDs[1:]
		return
	}

	for i, s := range t.shapeIDs {
		if s < shapeID {
			continue
		}

		// If it's in the set, cut it out.
		if s == shapeID {
			copy(t.shapeIDs[i:], t.shapeIDs[i+1:]) // overwrite the ith element
			t.shapeIDs = t.shapeIDs[:len(t.shapeIDs)-1]
			return
		}

		// We've got to a point in the slice where we should be inserted.
		// (the given shapeID is now less than the current positions id.)
		t.shapeIDs = append(t.shapeIDs[0:i],
			append([]int32{shapeID}, t.shapeIDs[i:len(t.shapeIDs)]...)...)
		return
	}

	// We got to the end and didn't find it, so add it to the list.
	t.shapeIDs = append(t.shapeIDs, shapeID)
}

// saveAndClearStateBefore makes an internal copy of the state for shape ids below
// the given limit, and then clear the state for those shapes. This is used during
// incremental updates to track the state of added and removed shapes separately.
func (t *tracker) saveAndClearStateBefore(limitShapeID int32) {
	limit := t.lowerBound(limitShapeID)
	t.savedIDs = append([]int32(nil), t.shapeIDs[:limit]...)
	t.shapeIDs = t.shapeIDs[limit:]
}

// restoreStateBefore restores the state previously saved by saveAndClearStateBefore.
// This only affects the state for shapeIDs below "limitShapeID".
func (t *tracker) restoreStateBefore(limitShapeID int32) {
	limit := t.lowerBound(limitShapeID)
	t.shapeIDs = append(append([]int32(nil), t.savedIDs...), t.shapeIDs[limit:]...)
	t.savedIDs = nil
}

// lowerBound returns the shapeID of the first entry x where x >= shapeID.
func (t *tracker) lowerBound(shapeID int32) int32 {
	panic("not implemented")
}

// removedShape represents a set of edges from the given shape that is queued for removal.
type removedShape struct {
	shapeID               int32
	hasInterior           bool
	containsTrackerOrigin bool
	edges                 []Edge
}

// There are three basic states the index can be in.
const (
	stale    int32 = iota // There are pending updates.
	updating              // Updates are currently being applied.
	fresh                 // There are no pending updates.
)

// ShapeIndex indexes a set of Shapes, where a Shape is some collection of edges
// that optionally defines an interior. It can be used to represent a set of
// points, a set of polylines, or a set of polygons. For Shapes that have
// interiors, the index makes it very fast to determine which Shape(s) contain
// a given point or region.
//
// The index can be updated incrementally by adding or removing shapes. It is
// designed to handle up to hundreds of millions of edges. All data structures
// are designed to be small, so the index is compact; generally it is smaller
// than the underlying data being indexed. The index is also fast to construct.
//
// Polygon, Loop, and Polyline implement Shape which allows these objects to
// be indexed easily. You can find useful query methods in CrossingEdgeQuery
// and ClosestEdgeQuery (Not yet implemented in Go).
//
// Example showing how to build an index of Polylines:
//
//   index := NewShapeIndex()
//   for _, polyline := range polylines {
//       index.Add(polyline);
//   }
//   // Now you can use a CrossingEdgeQuery or ClosestEdgeQuery here.
//
type ShapeIndex struct {
	// shapes is a map of shape ID to shape.
	shapes map[int32]Shape

	// The maximum number of edges per cell.
	// TODO(roberts): Update the comments when the usage of this is implemented.
	maxEdgesPerCell int

	// nextID tracks the next ID to hand out. IDs are not reused when shapes
	// are removed from the index.
	nextID int32

	// cellMap is a map from CellID to the set of clipped shapes that intersect that
	// cell. The cell IDs cover a set of non-overlapping regions on the sphere.
	// In C++, this is a BTree, so the cells are ordered naturally by the data structure.
	cellMap map[CellID]*ShapeIndexCell
	// Track the ordered list of cell IDs.
	cells []CellID

	// The current status of the index; accessed atomically.
	status int32

	// Additions and removals are queued and processed on the first subsequent
	// query. There are several reasons to do this:
	//
	//  - It is significantly more efficient to process updates in batches if
	//    the amount of entities added grows.
	//  - Often the index will never be queried, in which case we can save both
	//    the time and memory required to build it. Examples:
	//     + Loops that are created simply to pass to an Polygon. (We don't
	//       need the Loop index, because Polygon builds its own index.)
	//     + Applications that load a database of geometry and then query only
	//       a small fraction of it.
	//
	// The main drawback is that we need to go to some extra work to ensure that
	// some methods are still thread-safe. Note that the goal is *not* to
	// make this thread-safe in general, but simply to hide the fact that
	// we defer some of the indexing work until query time.
	//
	// This mutex protects all of following fields in the index.
	mu sync.RWMutex

	// pendingAdditionsPos is the index of the first entry that has not been processed
	// via applyUpdatesInternal.
	pendingAdditionsPos int32

	// The set of shapes that have been queued for removal but not processed yet by
	// applyUpdatesInternal.
	pendingRemovals []*removedShape
}

// NewShapeIndex creates a new ShapeIndex.
func NewShapeIndex() *ShapeIndex {
	return &ShapeIndex{
		maxEdgesPerCell: 10,
		shapes:          make(map[int32]Shape),
		cellMap:         make(map[CellID]*ShapeIndexCell),
		cells:           nil,
		status:          fresh,
	}
}

// Iterator returns an iterator for this index.
func (s *ShapeIndex) Iterator() *ShapeIndexIterator {
	s.maybeApplyUpdates()
	return NewShapeIndexIterator(s, IteratorBegin)
}

// Begin positions the iterator at the first cell in the index.
func (s *ShapeIndex) Begin() *ShapeIndexIterator {
	s.maybeApplyUpdates()
	return NewShapeIndexIterator(s, IteratorBegin)
}

// End positions the iterator at the last cell in the index.
func (s *ShapeIndex) End() *ShapeIndexIterator {
	// TODO(roberts): It's possible that updates could happen to the index between
	// the time this is called and the time the iterators position is used and this
	// will be invalid or not the end. For now, things will be undefined if this
	// happens. See about referencing the IsFresh to guard for this in the future.
	s.maybeApplyUpdates()
	return NewShapeIndexIterator(s, IteratorEnd)
}

// Len reports the number of Shapes in this index.
func (s *ShapeIndex) Len() int {
	return len(s.shapes)
}

// Reset resets the index to its original state.
func (s *ShapeIndex) Reset() {
	s.shapes = make(map[int32]Shape)
	s.nextID = 0
	s.cellMap = make(map[CellID]*ShapeIndexCell)
	s.cells = nil
	atomic.StoreInt32(&s.status, fresh)
}

// NumEdges returns the number of edges in this index.
func (s *ShapeIndex) NumEdges() int {
	numEdges := 0
	for _, shape := range s.shapes {
		numEdges += shape.NumEdges()
	}
	return numEdges
}

// NumEdgesUpTo returns the number of edges in the given index, up to the given
// limit. If the limit is encountered, the current running total is returned,
// which may be more than the limit.
func (s *ShapeIndex) NumEdgesUpTo(limit int) int {
	var numEdges int
	// We choose to iterate over the shapes in order to match the counting
	// up behavior in C++ and for test compatibility instead of using a
	// more idiomatic range over the shape map.
	for i := int32(0); i <= s.nextID; i++ {
		s := s.Shape(i)
		if s == nil {
			continue
		}
		numEdges += s.NumEdges()
		if numEdges >= limit {
			break
		}
	}

	return numEdges
}

// Shape returns the shape with the given ID, or nil if the shape has been removed from the index.
func (s *ShapeIndex) Shape(id int32) Shape { return s.shapes[id] }

// idForShape returns the id of the given shape in this index, or -1 if it is
// not in the index.
//
// TODO(roberts): Need to figure out an appropriate way to expose this on a Shape.
// C++ allows a given S2 type (Loop, Polygon, etc) to be part of multiple indexes.
// By having each type extend S2Shape which has an id element, they all inherit their
// own id field rather than having to track it themselves.
func (s *ShapeIndex) idForShape(shape Shape) int32 {
	for k, v := range s.shapes {
		if v == shape {
			return k
		}
	}
	return -1
}

// Add adds the given shape to the index and returns the assigned ID..
func (s *ShapeIndex) Add(shape Shape) int32 {
	s.shapes[s.nextID] = shape
	s.nextID++
	atomic.StoreInt32(&s.status, stale)
	return s.nextID - 1
}

// Remove removes the given shape from the index.
func (s *ShapeIndex) Remove(shape Shape) {
	// The index updates itself lazily because it is much more efficient to
	// process additions and removals in batches.
	id := s.idForShape(shape)

	// If the shape wasn't found, it's already been removed or was not in the index.
	if s.shapes[id] == nil {
		return
	}

	// Remove the shape from the shapes map.
	delete(s.shapes, id)

	// We are removing a shape that has not yet been added to the index,
	// so there is nothing else to do.
	if id >= s.pendingAdditionsPos {
		return
	}

	numEdges := shape.NumEdges()
	removed := &removedShape{
		shapeID:               id,
		hasInterior:           shape.Dimension() == 2,
		containsTrackerOrigin: shape.ReferencePoint().Contained,
		edges:                 make([]Edge, numEdges),
	}

	for e := 0; e < numEdges; e++ {
		removed.edges[e] = shape.Edge(e)
	}

	s.pendingRemovals = append(s.pendingRemovals, removed)
	atomic.StoreInt32(&s.status, stale)
}

// Build triggers the update of the index. Calls to Add and Release are normally
// queued and processed on the first subsequent query. This has many advantages,
// the most important of which is that sometimes there *is* no subsequent
// query, which lets us avoid building the index completely.
//
// This method forces any pending updates to be applied immediately.
func (s *ShapeIndex) Build() {
	s.maybeApplyUpdates()
}

// IsFresh reports if there are no pending updates that need to be applied.
// This can be useful to avoid building the index unnecessarily, or for
// choosing between two different algorithms depending on whether the index
// is available.
//
// The returned index status may be slightly out of date if the index was
// built in a different thread. This is fine for the intended use (as an
// efficiency hint), but it should not be used by internal methods.
func (s *ShapeIndex) IsFresh() bool {
	return atomic.LoadInt32(&s.status) == fresh
}

// isFirstUpdate reports if this is the first update to the index.
func (s *ShapeIndex) isFirstUpdate() bool {
	// Note that it is not sufficient to check whether cellMap is empty, since
	// entries are added to it during the update process.
	return s.pendingAdditionsPos == 0
}

// isShapeBeingRemoved reports if the shape with the given ID is currently slated for removal.
func (s *ShapeIndex) isShapeBeingRemoved(shapeID int32) bool {
	// All shape ids being removed fall below the index position of shapes being added.
	return shapeID < s.pendingAdditionsPos
}

// maybeApplyUpdates checks if the index pieces have changed, and if so, applies pending updates.
func (s *ShapeIndex) maybeApplyUpdates() {
	// TODO(roberts): To avoid acquiring and releasing the mutex on every
	// query, we should use atomic operations when testing whether the status
	// is fresh and when updating the status to be fresh. This guarantees
	// that any thread that sees a status of fresh will also see the
	// corresponding index updates.
	if atomic.LoadInt32(&s.status) != fresh {
		s.mu.Lock()
		s.applyUpdatesInternal()
		atomic.StoreInt32(&s.status, fresh)
		s.mu.Unlock()
	}
}

// applyUpdatesInternal does the actual work of updating the index by applying all
// pending additions and removals. It does *not* update the indexes status.
func (s *ShapeIndex) applyUpdatesInternal() {
	// TODO(roberts): Building the index can use up to 20x as much memory per
	// edge as the final index memory size. If this causes issues, add in
	// batched updating to limit the amount of items per batch to a
	// configurable memory footprint overhead.
	t := newTracker()

	// allEdges maps a Face to a collection of faceEdges.
	allEdges := make([][]faceEdge, 6)

	for _, p := range s.pendingRemovals {
		s.removeShapeInternal(p, allEdges, t)
	}

	for id := s.pendingAdditionsPos; id < int32(len(s.shapes)); id++ {
		s.addShapeInternal(id, allEdges, t)
	}

	for face := 0; face < 6; face++ {
		s.updateFaceEdges(face, allEdges[face], t)
	}

	s.pendingRemovals = s.pendingRemovals[:0]
	s.pendingAdditionsPos = int32(len(s.shapes))
	// It is the caller's responsibility to update the index status.
}

// addShapeInternal clips all edges of the given shape to the six cube faces,
// adds the clipped edges to the set of allEdges, and starts tracking its
// interior if necessary.
func (s *ShapeIndex) addShapeInternal(shapeID int32, allEdges [][]faceEdge, t *tracker) {
	shape, ok := s.shapes[shapeID]
	if !ok {
		// This shape has already been removed.
		return
	}

	faceEdge := faceEdge{
		shapeID:     shapeID,
		hasInterior: shape.Dimension() == 2,
	}

	if faceEdge.hasInterior {
		t.addShape(shapeID, containsBruteForce(shape, t.focus()))
	}

	numEdges := shape.NumEdges()
	for e := 0; e < numEdges; e++ {
		edge := shape.Edge(e)

		faceEdge.edgeID = e
		faceEdge.edge = edge
		faceEdge.maxLevel = maxLevelForEdge(edge)
		s.addFaceEdge(faceEdge, allEdges)
	}
}

// addFaceEdge adds the given faceEdge into the collection of all edges.
func (s *ShapeIndex) addFaceEdge(fe faceEdge, allEdges [][]faceEdge) {
	aFace := face(fe.edge.V0.Vector)
	// See if both endpoints are on the same face, and are far enough from
	// the edge of the face that they don't intersect any (padded) adjacent face.
	if aFace == face(fe.edge.V1.Vector) {
		x, y := validFaceXYZToUV(aFace, fe.edge.V0.Vector)
		fe.a = r2.Point{x, y}
		x, y = validFaceXYZToUV(aFace, fe.edge.V1.Vector)
		fe.b = r2.Point{x, y}

		maxUV := 1 - cellPadding
		if math.Abs(fe.a.X) <= maxUV && math.Abs(fe.a.Y) <= maxUV &&
			math.Abs(fe.b.X) <= maxUV && math.Abs(fe.b.Y) <= maxUV {
			allEdges[aFace] = append(allEdges[aFace], fe)
			return
		}
	}

	// Otherwise, we simply clip the edge to all six faces.
	for face := 0; face < 6; face++ {
		if aClip, bClip, intersects := ClipToPaddedFace(fe.edge.V0, fe.edge.V1, face, cellPadding); intersects {
			fe.a = aClip
			fe.b = bClip
			allEdges[face] = append(allEdges[face], fe)
		}
	}
}

// updateFaceEdges adds or removes the various edges from the index.
// An edge is added if shapes[id] is not nil, and removed otherwise.
func (s *ShapeIndex) updateFaceEdges(face int, faceEdges []faceEdge, t *tracker) {
	numEdges := len(faceEdges)
	if numEdges == 0 && len(t.shapeIDs) == 0 {
		return
	}

	// Create the initial clippedEdge for each faceEdge. Additional clipped
	// edges are created when edges are split between child cells. We create
	// two arrays, one containing the edge data and another containing pointers
	// to those edges, so that during the recursion we only need to copy
	// pointers in order to propagate an edge to the correct child.
	clippedEdges := make([]*clippedEdge, numEdges)
	bound := r2.EmptyRect()
	for e := 0; e < numEdges; e++ {
		clipped := &clippedEdge{
			faceEdge: &faceEdges[e],
		}
		clipped.bound = r2.RectFromPoints(faceEdges[e].a, faceEdges[e].b)
		clippedEdges[e] = clipped
		bound = bound.AddRect(clipped.bound)
	}

	// Construct the initial face cell containing all the edges, and then update
	// all the edges in the index recursively.
	faceID := CellIDFromFace(face)
	pcell := PaddedCellFromCellID(faceID, cellPadding)

	disjointFromIndex := s.isFirstUpdate()
	if numEdges > 0 {
		shrunkID := s.shrinkToFit(pcell, bound)
		if shrunkID != pcell.id {
			// All the edges are contained by some descendant of the face cell. We
			// can save a lot of work by starting directly with that cell, but if we
			// are in the interior of at least one shape then we need to create
			// index entries for the cells we are skipping over.
			s.skipCellRange(faceID.RangeMin(), shrunkID.RangeMin(), t, disjointFromIndex)
			pcell = PaddedCellFromCellID(shrunkID, cellPadding)
			s.updateEdges(pcell, clippedEdges, t, disjointFromIndex)
			s.skipCellRange(shrunkID.RangeMax().Next(), faceID.RangeMax().Next(), t, disjointFromIndex)
			return
		}
	}

	// Otherwise (no edges, or no shrinking is possible), subdivide normally.
	s.updateEdges(pcell, clippedEdges, t, disjointFromIndex)
}

// shrinkToFit shrinks the PaddedCell to fit within the given bounds.
func (s *ShapeIndex) shrinkToFit(pcell *PaddedCell, bound r2.Rect) CellID {
	shrunkID := pcell.ShrinkToFit(bound)

	if !s.isFirstUpdate() && shrunkID != pcell.CellID() {
		// Don't shrink any smaller than the existing index cells, since we need
		// to combine the new edges with those cells.
		iter := s.Iterator()
		if iter.LocateCellID(shrunkID) == Indexed {
			shrunkID = iter.CellID()
		}
	}
	return shrunkID
}

// skipCellRange skips over the cells in the given range, creating index cells if we are
// currently in the interior of at least one shape.
func (s *ShapeIndex) skipCellRange(begin, end CellID, t *tracker, disjointFromIndex bool) {
	// If we aren't in the interior of a shape, then skipping over cells is easy.
	if len(t.shapeIDs) == 0 {
		return
	}

	// Otherwise generate the list of cell ids that we need to visit, and create
	// an index entry for each one.
	skipped := CellUnionFromRange(begin, end)
	for _, cell := range skipped {
		var clippedEdges []*clippedEdge
		s.updateEdges(PaddedCellFromCellID(cell, cellPadding), clippedEdges, t, disjointFromIndex)
	}
}

// updateEdges adds or removes the given edges whose bounding boxes intersect a
// given cell. disjointFromIndex is an optimization hint indicating that cellMap
// does not contain any entries that overlap the given cell.
func (s *ShapeIndex) updateEdges(pcell *PaddedCell, edges []*clippedEdge, t *tracker, disjointFromIndex bool) {
	// This function is recursive with a maximum recursion depth of 30 (maxLevel).

	// Incremental updates are handled as follows. All edges being added or
	// removed are combined together in edges, and all shapes with interiors
	// are tracked using tracker. We subdivide recursively as usual until we
	// encounter an existing index cell. At this point we absorb the index
	// cell as follows:
	//
	//   - Edges and shapes that are being removed are deleted from edges and
	//     tracker.
	//   - All remaining edges and shapes from the index cell are added to
	//     edges and tracker.
	//   - Continue subdividing recursively, creating new index cells as needed.
	//   - When the recursion gets back to the cell that was absorbed, we
	//     restore edges and tracker to their previous state.
	//
	// Note that the only reason that we include removed shapes in the recursive
	// subdivision process is so that we can find all of the index cells that
	// contain those shapes efficiently, without maintaining an explicit list of
	// index cells for each shape (which would be expensive in terms of memory).
	indexCellAbsorbed := false
	if !disjointFromIndex {
		// There may be existing index cells contained inside pcell. If we
		// encounter such a cell, we need to combine the edges being updated with
		// the existing cell contents by absorbing the cell.
		iter := s.Iterator()
		r := iter.LocateCellID(pcell.id)
		if r == Disjoint {
			disjointFromIndex = true
		} else if r == Indexed {
			// Absorb the index cell by transferring its contents to edges and
			// deleting it. We also start tracking the interior of any new shapes.
			s.absorbIndexCell(pcell, iter, edges, t)
			indexCellAbsorbed = true
			disjointFromIndex = true
		} else {
			// DCHECK_EQ(SUBDIVIDED, r)
		}
	}

	// If there are existing index cells below us, then we need to keep
	// subdividing so that we can merge with those cells. Otherwise,
	// makeIndexCell checks if the number of edges is small enough, and creates
	// an index cell if possible (returning true when it does so).
	if !disjointFromIndex || !s.makeIndexCell(pcell, edges, t) {
		// TODO(roberts): If it turns out to have memory problems when there
		// are 10M+ edges in the index, look into pre-allocating space so we
		// are not always appending.
		childEdges := [2][2][]*clippedEdge{} // [i][j]

		// Compute the middle of the padded cell, defined as the rectangle in
		// (u,v)-space that belongs to all four (padded) children. By comparing
		// against the four boundaries of middle we can determine which children
		// each edge needs to be propagated to.
		middle := pcell.Middle()

		// Build up a vector edges to be passed to each child cell. The (i,j)
		// directions are left (i=0), right (i=1), lower (j=0), and upper (j=1).
		// Note that the vast majority of edges are propagated to a single child.
		for _, edge := range edges {
			if edge.bound.X.Hi <= middle.X.Lo {
				// Edge is entirely contained in the two left children.
				a, b := s.clipVAxis(edge, middle.Y)
				if a != nil {
					childEdges[0][0] = append(childEdges[0][0], a)
				}
				if b != nil {
					childEdges[0][1] = append(childEdges[0][1], b)
				}
			} else if edge.bound.X.Lo >= middle.X.Hi {
				// Edge is entirely contained in the two right children.
				a, b := s.clipVAxis(edge, middle.Y)
				if a != nil {
					childEdges[1][0] = append(childEdges[1][0], a)
				}
				if b != nil {
					childEdges[1][1] = append(childEdges[1][1], b)
				}
			} else if edge.bound.Y.Hi <= middle.Y.Lo {
				// Edge is entirely contained in the two lower children.
				if a := s.clipUBound(edge, 1, middle.X.Hi); a != nil {
					childEdges[0][0] = append(childEdges[0][0], a)
				}
				if b := s.clipUBound(edge, 0, middle.X.Lo); b != nil {
					childEdges[1][0] = append(childEdges[1][0], b)
				}
			} else if edge.bound.Y.Lo >= middle.Y.Hi {
				// Edge is entirely contained in the two upper children.
				if a := s.clipUBound(edge, 1, middle.X.Hi); a != nil {
					childEdges[0][1] = append(childEdges[0][1], a)
				}
				if b := s.clipUBound(edge, 0, middle.X.Lo); b != nil {
					childEdges[1][1] = append(childEdges[1][1], b)
				}
			} else {
				// The edge bound spans all four children. The edge
				// itself intersects either three or four padded children.
				left := s.clipUBound(edge, 1, middle.X.Hi)
				a, b := s.clipVAxis(left, middle.Y)
				if a != nil {
					childEdges[0][0] = append(childEdges[0][0], a)
				}
				if b != nil {
					childEdges[0][1] = append(childEdges[0][1], b)
				}
				right := s.clipUBound(edge, 0, middle.X.Lo)
				a, b = s.clipVAxis(right, middle.Y)
				if a != nil {
					childEdges[1][0] = append(childEdges[1][0], a)
				}
				if b != nil {
					childEdges[1][1] = append(childEdges[1][1], b)
				}
			}
		}

		// Now recursively update the edges in each child. We call the children in
		// increasing order of CellID so that when the index is first constructed,
		// all insertions into cellMap are at the end (which is much faster).
		for pos := 0; pos < 4; pos++ {
			i, j := pcell.ChildIJ(pos)
			if len(childEdges[i][j]) > 0 || len(t.shapeIDs) > 0 {
				s.updateEdges(PaddedCellFromParentIJ(pcell, i, j), childEdges[i][j],
					t, disjointFromIndex)
			}
		}
	}

	if indexCellAbsorbed {
		// Restore the state for any edges being removed that we are tracking.
		t.restoreStateBefore(s.pendingAdditionsPos)
	}
}

// makeIndexCell builds an indexCell from the given padded cell and set of edges and adds
// it to the index. If the cell or edges are empty, no cell is added.
func (s *ShapeIndex) makeIndexCell(p *PaddedCell, edges []*clippedEdge, t *tracker) bool {
	// If the cell is empty, no index cell is needed. (In most cases this
	// situation is detected before we get to this point, but this can happen
	// when all shapes in a cell are removed.)
	if len(edges) == 0 && len(t.shapeIDs) == 0 {
		return true
	}

	// Count the number of edges that have not reached their maximum level yet.
	// Return false if there are too many such edges.
	count := 0
	for _, ce := range edges {
		if p.Level() < ce.faceEdge.maxLevel {
			count++
		}

		if count > s.maxEdgesPerCell {
			return false
		}
	}

	// Possible optimization: Continue subdividing as long as exactly one child
	// of the padded cell intersects the given edges. This can be done by finding
	// the bounding box of all the edges and calling ShrinkToFit:
	//
	// cellID = p.ShrinkToFit(RectBound(edges));
	//
	// Currently this is not beneficial; it slows down construction by 4-25%
	// (mainly computing the union of the bounding rectangles) and also slows
	// down queries (since more recursive clipping is required to get down to
	// the level of a spatial index cell). But it may be worth trying again
	// once containsCenter is computed and all algorithms are modified to
	// take advantage of it.

	// We update the InteriorTracker as follows. For every Cell in the index
	// we construct two edges: one edge from entry vertex of the cell to its
	// center, and one from the cell center to its exit vertex. Here entry
	// and exit refer the CellID ordering, i.e. the order in which points
	// are encountered along the 2 space-filling curve. The exit vertex then
	// becomes the entry vertex for the next cell in the index, unless there are
	// one or more empty intervening cells, in which case the InteriorTracker
	// state is unchanged because the intervening cells have no edges.

	// Shift the InteriorTracker focus point to the center of the current cell.
	if t.isActive && len(edges) != 0 {
		if !t.atCellID(p.id) {
			t.moveTo(p.EntryVertex())
		}
		t.drawTo(p.Center())
		s.testAllEdges(edges, t)
	}

	// Allocate and fill a new index cell. To get the total number of shapes we
	// need to merge the shapes associated with the intersecting edges together
	// with the shapes that happen to contain the cell center.
	cshapeIDs := t.shapeIDs
	numShapes := s.countShapes(edges, cshapeIDs)
	cell := NewShapeIndexCell(numShapes)

	// To fill the index cell we merge the two sources of shapes: edge shapes
	// (those that have at least one edge that intersects this cell), and
	// containing shapes (those that contain the cell center). We keep track
	// of the index of the next intersecting edge and the next containing shape
	// as we go along. Both sets of shape ids are already sorted.
	eNext := 0
	cNextIdx := 0
	for i := 0; i < numShapes; i++ {
		var clipped *clippedShape
		// advance to next value base + i
		eshapeID := int32(s.Len())
		cshapeID := eshapeID // Sentinels

		if eNext != len(edges) {
			eshapeID = edges[eNext].faceEdge.shapeID
		}
		if cNextIdx < len(cshapeIDs) {
			cshapeID = cshapeIDs[cNextIdx]
		}
		eBegin := eNext
		if cshapeID < eshapeID {
			// The entire cell is in the shape interior.
			clipped = newClippedShape(cshapeID, 0)
			clipped.containsCenter = true
			cNextIdx++
		} else {
			// Count the number of edges for this shape and allocate space for them.
			for eNext < len(edges) && edges[eNext].faceEdge.shapeID == eshapeID {
				eNext++
			}
			clipped = newClippedShape(eshapeID, eNext-eBegin)
			for e := eBegin; e < eNext; e++ {
				clipped.edges[e-eBegin] = edges[e].faceEdge.edgeID
			}
			if cshapeID == eshapeID {
				clipped.containsCenter = true
				cNextIdx++
			}
		}
		cell.shapes[i] = clipped
	}

	// Add this cell to the map.
	s.cellMap[p.id] = cell
	s.cells = append(s.cells, p.id)

	// Shift the tracker focus point to the exit vertex of this cell.
	if t.isActive && len(edges) != 0 {
		t.drawTo(p.ExitVertex())
		s.testAllEdges(edges, t)
		t.setNextCellID(p.id.Next())
	}
	return true
}

// updateBound updates the specified endpoint of the given clipped edge and returns the
// resulting clipped edge.
func (s *ShapeIndex) updateBound(edge *clippedEdge, uEnd int, u float64, vEnd int, v float64) *clippedEdge {
	c := &clippedEdge{faceEdge: edge.faceEdge}
	if uEnd == 0 {
		c.bound.X.Lo = u
		c.bound.X.Hi = edge.bound.X.Hi
	} else {
		c.bound.X.Lo = edge.bound.X.Lo
		c.bound.X.Hi = u
	}

	if vEnd == 0 {
		c.bound.Y.Lo = v
		c.bound.Y.Hi = edge.bound.Y.Hi
	} else {
		c.bound.Y.Lo = edge.bound.Y.Lo
		c.bound.Y.Hi = v
	}

	return c
}

// clipUBound clips the given endpoint (lo=0, hi=1) of the u-axis so that
// it does not extend past the given value of the given edge.
func (s *ShapeIndex) clipUBound(edge *clippedEdge, uEnd int, u float64) *clippedEdge {
	// First check whether the edge actually requires any clipping. (Sometimes
	// this method is called when clipping is not necessary, e.g. when one edge
	// endpoint is in the overlap area between two padded child cells.)
	if uEnd == 0 {
		if edge.bound.X.Lo >= u {
			return edge
		}
	} else {
		if edge.bound.X.Hi <= u {
			return edge
		}
	}
	// We interpolate the new v-value from the endpoints of the original edge.
	// This has two advantages: (1) we don't need to store the clipped endpoints
	// at all, just their bounding box; and (2) it avoids the accumulation of
	// roundoff errors due to repeated interpolations. The result needs to be
	// clamped to ensure that it is in the appropriate range.
	e := edge.faceEdge
	v := edge.bound.Y.ClampPoint(interpolateFloat64(u, e.a.X, e.b.X, e.a.Y, e.b.Y))

	// Determine which endpoint of the v-axis bound to update. If the edge
	// slope is positive we update the same endpoint, otherwise we update the
	// opposite endpoint.
	var vEnd int
	positiveSlope := (e.a.X > e.b.X) == (e.a.Y > e.b.Y)
	if (uEnd == 1) == positiveSlope {
		vEnd = 1
	}
	return s.updateBound(edge, uEnd, u, vEnd, v)
}

// clipVBound clips the given endpoint (lo=0, hi=1) of the v-axis so that
// it does not extend past the given value of the given edge.
func (s *ShapeIndex) clipVBound(edge *clippedEdge, vEnd int, v float64) *clippedEdge {
	if vEnd == 0 {
		if edge.bound.Y.Lo >= v {
			return edge
		}
	} else {
		if edge.bound.Y.Hi <= v {
			return edge
		}
	}

	// We interpolate the new v-value from the endpoints of the original edge.
	// This has two advantages: (1) we don't need to store the clipped endpoints
	// at all, just their bounding box; and (2) it avoids the accumulation of
	// roundoff errors due to repeated interpolations. The result needs to be
	// clamped to ensure that it is in the appropriate range.
	e := edge.faceEdge
	u := edge.bound.X.ClampPoint(interpolateFloat64(v, e.a.Y, e.b.Y, e.a.X, e.b.X))

	// Determine which endpoint of the v-axis bound to update. If the edge
	// slope is positive we update the same endpoint, otherwise we update the
	// opposite endpoint.
	var uEnd int
	positiveSlope := (e.a.X > e.b.X) == (e.a.Y > e.b.Y)
	if (vEnd == 1) == positiveSlope {
		uEnd = 1
	}
	return s.updateBound(edge, uEnd, u, vEnd, v)
}

// cliupVAxis returns the given edge clipped to within the boundaries of the middle
// interval along the v-axis, and adds the result to its children.
func (s *ShapeIndex) clipVAxis(edge *clippedEdge, middle r1.Interval) (a, b *clippedEdge) {
	if edge.bound.Y.Hi <= middle.Lo {
		// Edge is entirely contained in the lower child.
		return edge, nil
	} else if edge.bound.Y.Lo >= middle.Hi {
		// Edge is entirely contained in the upper child.
		return nil, edge
	}
	// The edge bound spans both children.
	return s.clipVBound(edge, 1, middle.Hi), s.clipVBound(edge, 0, middle.Lo)
}

// absorbIndexCell absorbs an index cell by transferring its contents to edges
// and/or "tracker", and then delete this cell from the index. If edges includes
// any edges that are being removed, this method also updates their
// InteriorTracker state to correspond to the exit vertex of this cell.
func (s *ShapeIndex) absorbIndexCell(p *PaddedCell, iter *ShapeIndexIterator, edges []*clippedEdge, t *tracker) {
	// When we absorb a cell, we erase all the edges that are being removed.
	// However when we are finished with this cell, we want to restore the state
	// of those edges (since that is how we find all the index cells that need
	// to be updated).  The edges themselves are restored automatically when
	// UpdateEdges returns from its recursive call, but the InteriorTracker
	// state needs to be restored explicitly.
	//
	// Here we first update the InteriorTracker state for removed edges to
	// correspond to the exit vertex of this cell, and then save the
	// InteriorTracker state.  This state will be restored by UpdateEdges when
	// it is finished processing the contents of this cell.
	if t.isActive && len(edges) != 0 && s.isShapeBeingRemoved(edges[0].faceEdge.shapeID) {
		// We probably need to update the tracker. ("Probably" because
		// it's possible that all shapes being removed do not have interiors.)
		if !t.atCellID(p.id) {
			t.moveTo(p.EntryVertex())
		}
		t.drawTo(p.ExitVertex())
		t.setNextCellID(p.id.Next())
		for _, edge := range edges {
			fe := edge.faceEdge
			if !s.isShapeBeingRemoved(fe.shapeID) {
				break // All shapes being removed come first.
			}
			if fe.hasInterior {
				t.testEdge(fe.shapeID, fe.edge)
			}
		}
	}

	// Save the state of the edges being removed, so that it can be restored
	// when we are finished processing this cell and its children.  We don't
	// need to save the state of the edges being added because they aren't being
	// removed from "edges" and will therefore be updated normally as we visit
	// this cell and its children.
	t.saveAndClearStateBefore(s.pendingAdditionsPos)

	// Create a faceEdge for each edge in this cell that isn't being removed.
	var faceEdges []*faceEdge
	trackerMoved := false

	cell := iter.IndexCell()
	for _, clipped := range cell.shapes {
		shapeID := clipped.shapeID
		shape := s.Shape(shapeID)
		if shape == nil {
			continue // This shape is being removed.
		}

		numClipped := clipped.numEdges()

		// If this shape has an interior, start tracking whether we are inside the
		// shape. updateEdges wants to know whether the entry vertex of this
		// cell is inside the shape, but we only know whether the center of the
		// cell is inside the shape, so we need to test all the edges against the
		// line segment from the cell center to the entry vertex.
		edge := &faceEdge{
			shapeID:     shapeID,
			hasInterior: shape.Dimension() == 2,
		}

		if edge.hasInterior {
			t.addShape(shapeID, clipped.containsCenter)
			// There might not be any edges in this entire cell (i.e., it might be
			// in the interior of all shapes), so we delay updating the tracker
			// until we see the first edge.
			if !trackerMoved && numClipped > 0 {
				t.moveTo(p.Center())
				t.drawTo(p.EntryVertex())
				t.setNextCellID(p.id)
				trackerMoved = true
			}
		}
		for i := 0; i < numClipped; i++ {
			edgeID := clipped.edges[i]
			edge.edgeID = edgeID
			edge.edge = shape.Edge(edgeID)
			edge.maxLevel = maxLevelForEdge(edge.edge)
			if edge.hasInterior {
				t.testEdge(shapeID, edge.edge)
			}
			var ok bool
			edge.a, edge.b, ok = ClipToPaddedFace(edge.edge.V0, edge.edge.V1, p.id.Face(), cellPadding)
			if !ok {
				panic("invariant failure in ShapeIndex")
			}
			faceEdges = append(faceEdges, edge)
		}
	}
	// Now create a clippedEdge for each faceEdge, and put them in "new_edges".
	var newEdges []*clippedEdge
	for _, faceEdge := range faceEdges {
		clipped := &clippedEdge{
			faceEdge: faceEdge,
			bound:    clippedEdgeBound(faceEdge.a, faceEdge.b, p.bound),
		}
		newEdges = append(newEdges, clipped)
	}

	// Discard any edges from "edges" that are being removed, and append the
	// remainder to "newEdges"  (This keeps the edges sorted by shape id.)
	for i, clipped := range edges {
		if !s.isShapeBeingRemoved(clipped.faceEdge.shapeID) {
			newEdges = append(newEdges, edges[i:]...)
			break
		}
	}

	// Update the edge list and delete this cell from the index.
	edges, newEdges = newEdges, edges
	delete(s.cellMap, p.id)
	// TODO(roberts): delete from s.Cells
}

// testAllEdges calls the trackers testEdge on all edges from shapes that have interiors.
func (s *ShapeIndex) testAllEdges(edges []*clippedEdge, t *tracker) {
	for _, edge := range edges {
		if edge.faceEdge.hasInterior {
			t.testEdge(edge.faceEdge.shapeID, edge.faceEdge.edge)
		}
	}
}

// countShapes reports the number of distinct shapes that are either associated with the
// given edges, or that are currently stored in the InteriorTracker.
func (s *ShapeIndex) countShapes(edges []*clippedEdge, shapeIDs []int32) int {
	count := 0
	lastShapeID := int32(-1)

	// next clipped shape id in the shapeIDs list.
	clippedNext := int32(0)
	// index of the current element in the shapeIDs list.
	shapeIDidx := 0
	for _, edge := range edges {
		if edge.faceEdge.shapeID == lastShapeID {
			continue
		}

		count++
		lastShapeID = edge.faceEdge.shapeID

		// Skip over any containing shapes up to and including this one,
		// updating count as appropriate.
		for ; shapeIDidx < len(shapeIDs); shapeIDidx++ {
			clippedNext = shapeIDs[shapeIDidx]
			if clippedNext > lastShapeID {
				break
			}
			if clippedNext < lastShapeID {
				count++
			}
		}
	}

	// Count any remaining containing shapes.
	count += len(shapeIDs) - shapeIDidx
	return count
}

// maxLevelForEdge reports the maximum level for a given edge.
func maxLevelForEdge(edge Edge) int {
	// Compute the maximum cell size for which this edge is considered long.
	// The calculation does not need to be perfectly accurate, so we use Norm
	// rather than Angle for speed.
	cellSize := edge.V0.Sub(edge.V1.Vector).Norm() * cellSizeToLongEdgeRatio
	// Now return the first level encountered during subdivision where the
	// average cell size is at most cellSize.
	return AvgEdgeMetric.MinLevel(cellSize)
}

// removeShapeInternal does the actual work for removing a given shape from the index.
func (s *ShapeIndex) removeShapeInternal(removed *removedShape, allEdges [][]faceEdge, t *tracker) {
	// TODO(roberts): finish the implementation of this.
}
