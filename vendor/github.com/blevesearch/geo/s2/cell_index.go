// Copyright 2020 Google Inc. All rights reserved.
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
)

const (
	// A special label indicating that the ContentsIterator done is true.
	cellIndexDoneContents = -1
)

// cellIndexNode represents a node in the CellIndex. Cells are organized in a
// tree such that the ancestors of a given node contain that node.
type cellIndexNode struct {
	cellID CellID
	label  int32
	parent int32
}

// newCellIndexNode returns a node with the appropriate default values.
func newCellIndexNode() cellIndexNode {
	return cellIndexNode{
		cellID: 0,
		label:  cellIndexDoneContents,
		parent: -1,
	}
}

// A rangeNode represents a range of leaf CellIDs. The range starts at
// startID (a leaf cell) and ends at the startID field of the next
// rangeNode. contents points to the node of the CellIndex cellTree
// representing the cells that overlap this range.
type rangeNode struct {
	startID  CellID // First leaf cell contained by this range.
	contents int32  // Contents of this node (an index within the cell tree).
}

// CellIndexIterator is an iterator that visits the entire set of indexed
// (CellID, label) pairs in an unspecified order.
type CellIndexIterator struct {
	// TODO(roberts): Implement
	cellTree []cellIndexNode
	pos      int
}

// NewCellIndexIterator creates an iterator for the given CellIndex.
func NewCellIndexIterator(index *CellIndex) *CellIndexIterator {
	return &CellIndexIterator{
		cellTree: index.cellTree,
	}
}

// CellID returns the current CellID.
func (c *CellIndexIterator) CellID() CellID {
	return c.cellTree[c.pos].cellID
}

// Label returns the current Label.
func (c *CellIndexIterator) Label() int32 {
	return c.cellTree[c.pos].label
}

func (c *CellIndexIterator) Done() bool {
	return c.pos == len(c.cellTree)-1
}

func (c *CellIndexIterator) Next() {
	c.pos++
}

// CellIndexRangeIterator is an iterator that seeks and iterates over a set of
// non-overlapping leaf cell ranges that cover the entire sphere. The indexed
// (CellID, label) pairs that intersect the current leaf cell range can be
// visited using CellIndexContentsIterator (see below).
type CellIndexRangeIterator struct {
	rangeNodes []rangeNode
	pos        int
	nonEmpty   bool
}

// NewCellIndexRangeIterator creates an iterator for the given CellIndex.
// The iterator is initially *unpositioned*; you must call a positioning method
// such as Begin() or Seek() before accessing its contents.
func NewCellIndexRangeIterator(index *CellIndex) *CellIndexRangeIterator {
	return &CellIndexRangeIterator{
		rangeNodes: index.rangeNodes,
	}
}

// NewCellIndexNonEmptyRangeIterator creates an iterator for the given CellIndex.
// The iterator is initially *unpositioned*; you must call a positioning method such as
// Begin() or Seek() before accessing its contents.
func NewCellIndexNonEmptyRangeIterator(index *CellIndex) *CellIndexRangeIterator {
	return &CellIndexRangeIterator{
		rangeNodes: index.rangeNodes,
		nonEmpty:   true,
	}
}

// StartID reports the CellID of the start of the current range of leaf CellIDs.
//
// If done is true, this returns the last possible CellID. This property means
// that most loops do not need to test done explicitly.
func (c *CellIndexRangeIterator) StartID() CellID {
	return c.rangeNodes[c.pos].startID
}

// LimitID reports the non-inclusive end of the current range of leaf CellIDs.
//
// This assumes the iterator is not done.
func (c *CellIndexRangeIterator) LimitID() CellID {
	return c.rangeNodes[c.pos+1].startID
}

// IsEmpty reports if no (CellID, label) pairs intersect this range.
// Also returns true if done() is true.
func (c *CellIndexRangeIterator) IsEmpty() bool {
	return c.rangeNodes[c.pos].contents == cellIndexDoneContents
}

// Begin positions the iterator at the first range of leaf cells (if any).
func (c *CellIndexRangeIterator) Begin() {
	c.pos = 0
	for c.nonEmpty && c.IsEmpty() && !c.Done() {
		c.pos++
	}
}

// Prev positions the iterator at the previous entry and reports whether it was not
// already positioned at the beginning.
func (c *CellIndexRangeIterator) Prev() bool {
	if c.nonEmpty {
		return c.nonEmptyPrev()
	}
	return c.prev()
}

// prev is used to position the iterator at the previous entry without checking
// if nonEmpty is true to prevent unwanted recursion.
func (c *CellIndexRangeIterator) prev() bool {
	if c.pos == 0 {
		return false
	}

	c.pos--
	return true
}

// Prev positions the iterator at the previous entry, and reports whether it was
// already positioned at the beginning.
func (c *CellIndexRangeIterator) nonEmptyPrev() bool {
	for c.prev() {
		if !c.IsEmpty() {
			return true
		}
	}

	// Return the iterator to its original position.
	if c.IsEmpty() && !c.Done() {
		c.Next()
	}
	return false
}

// Next advances the iterator to the next range of leaf cells.
//
// This assumes the iterator is not done.
func (c *CellIndexRangeIterator) Next() {
	c.pos++
	for c.nonEmpty && c.IsEmpty() && !c.Done() {
		c.pos++
	}
}

// Advance reports if advancing would leave it positioned on a valid range. If
// the value would not be valid, the positioning is not changed.
func (c *CellIndexRangeIterator) Advance(n int) bool {
	// Note that the last element of rangeNodes is a sentinel value.
	if n >= len(c.rangeNodes)-1-c.pos {
		return false
	}
	c.pos += n
	return true
}

// Finish positions the iterator so that done is true.
func (c *CellIndexRangeIterator) Finish() {
	// Note that the last element of rangeNodes is a sentinel value.
	c.pos = len(c.rangeNodes) - 1
}

// Done reports if the iterator is positioned beyond the last valid range.
func (c *CellIndexRangeIterator) Done() bool {
	return c.pos >= len(c.rangeNodes)-1
}

// Seek positions the iterator at the first range with startID >= target.
// Such an entry always exists as long as "target" is a valid leaf cell.
//
// Note that it is valid to access startID even when done is true.
func (c *CellIndexRangeIterator) Seek(target CellID) {
	c.pos = sort.Search(len(c.rangeNodes), func(i int) bool {
		return c.rangeNodes[i].startID > target
	}) - 1

	// Ensure we don't go beyond the beginning.
	if c.pos < 0 {
		c.pos = 0
	}

	// Nonempty needs to find the next non-empty entry.
	for c.nonEmpty && c.IsEmpty() && !c.Done() {
		// c.Next()
		c.pos++
	}
}

// CellIndexContentsIterator is an iterator that visits the (CellID, label) pairs
// that cover a set of leaf cell ranges (see CellIndexRangeIterator). Note that
// when multiple leaf cell ranges are visited, this iterator only guarantees that
// each result will be reported at least once, i.e. duplicate values may be
// suppressed. If you want duplicate values to be reported again, be sure to call
// Clear first.
//
// In particular, the implementation guarantees that when multiple leaf
// cell ranges are visited in monotonically increasing order, then each
// (CellID, label) pair is reported exactly once.
type CellIndexContentsIterator struct {
	// The maximum index within the cellTree slice visited during the
	// previous call to StartUnion. This is used to eliminate duplicate
	// values when StartUnion is called multiple times.
	nodeCutoff int32

	// The maximum index within the cellTree visited during the
	// current call to StartUnion. This is used to update nodeCutoff.
	nextNodeCutoff int32

	// The value of startID from the previous call to StartUnion.
	// This is used to check whether these values are monotonically
	// increasing.
	prevStartID CellID

	// The cell tree from CellIndex
	cellTree []cellIndexNode

	// A copy of the current node in the cell tree.
	node cellIndexNode
}

// NewCellIndexContentsIterator returns a new contents iterator.
//
// Note that the iterator needs to be positioned using StartUnion before
// it can be safely used.
func NewCellIndexContentsIterator(index *CellIndex) *CellIndexContentsIterator {
	it := &CellIndexContentsIterator{
		cellTree:       index.cellTree,
		prevStartID:    0,
		nodeCutoff:     -1,
		nextNodeCutoff: -1,
		node:           cellIndexNode{label: cellIndexDoneContents},
	}
	return it
}

// Clear clears all state with respect to which range(s) have been visited.
func (c *CellIndexContentsIterator) Clear() {
	c.prevStartID = 0
	c.nodeCutoff = -1
	c.nextNodeCutoff = -1
	c.node.label = cellIndexDoneContents
}

// CellID returns the current CellID.
func (c *CellIndexContentsIterator) CellID() CellID {
	return c.node.cellID
}

// Label returns the current Label.
func (c *CellIndexContentsIterator) Label() int32 {
	return c.node.label
}

// Next advances the iterator to the next (CellID, label) pair covered by the
// current leaf cell range.
//
// This requires the iterator to not be done.
func (c *CellIndexContentsIterator) Next() {
	if c.node.parent <= c.nodeCutoff {
		// We have already processed this node and its ancestors.
		c.nodeCutoff = c.nextNodeCutoff
		c.node.label = cellIndexDoneContents
	} else {
		c.node = c.cellTree[c.node.parent]
	}
}

// Done reports if all (CellID, label) pairs have been visited.
func (c *CellIndexContentsIterator) Done() bool {
	return c.node.label == cellIndexDoneContents
}

// StartUnion positions the ContentsIterator at the first (cell_id, label) pair
// that covers the given leaf cell range. Note that when multiple leaf cell
// ranges are visited using the same ContentsIterator, duplicate values
// may be suppressed. If you don't want this behavior, call Reset() first.
func (c *CellIndexContentsIterator) StartUnion(r *CellIndexRangeIterator) {
	if r.StartID() < c.prevStartID {
		c.nodeCutoff = -1 // Can't automatically eliminate duplicates.
	}
	c.prevStartID = r.StartID()

	contents := r.rangeNodes[r.pos].contents
	if contents <= c.nodeCutoff {
		c.node.label = cellIndexDoneContents
	} else {
		c.node = c.cellTree[contents]
	}

	// When visiting ancestors, we can stop as soon as the node index is smaller
	// than any previously visited node index. Because indexes are assigned
	// using a preorder traversal, such nodes are guaranteed to have already
	// been reported.
	c.nextNodeCutoff = contents
}

// CellIndex stores a collection of (CellID, label) pairs.
//
// The CellIDs may be overlapping or contain duplicate values. For example, a
// CellIndex could store a collection of CellUnions, where each CellUnion
// gets its own non-negative int32 label.
//
// Similar to ShapeIndex and PointIndex which map each stored element to an
// identifier, CellIndex stores a label that is typically used to map the
// results of queries back to client's specific data.
//
// The zero value for a CellIndex is sufficient when constructing a CellIndex.
//
// To build a CellIndex where each Cell has a distinct label, call Add for each
// (CellID, label) pair, and then Build the index. For example:
//
//	// contents is a mapping of an identifier in my system (restaurantID,
//	// vehicleID, etc) to a CellID
//	var contents = map[int32]CellID{...}
//
//	for key, val := range contents {
//		index.Add(val, key)
//	}
//
//	index.Build()
//
// There is also a helper method that adds all elements of CellUnion with the
// same label:
//
//	index.AddCellUnion(cellUnion, label)
//
// Note that the index is not dynamic; the contents of the index cannot be
// changed once it has been built. Adding more after calling Build results in
// undefined behavior of the index.
//
// There are several options for retrieving data from the index. The simplest
// is to use a built-in method such as IntersectingLabels (which returns
// the labels of all cells that intersect a given target CellUnion):
//
//	labels := index.IntersectingLabels(targetUnion);
//
// Alternatively, you can use a ClosestCellQuery which computes the cell(s)
// that are closest to a given target geometry.
//
// For example, here is how to find all cells that are closer than
// distanceLimit to a given target point:
//
//	query := NewClosestCellQuery(cellIndex, opts)
//	target := NewMinDistanceToPointTarget(targetPoint);
//	for result := range query.FindCells(target) {
//		// result.Distance() is the distance to the target.
//		// result.CellID() is the indexed CellID.
//		// result.Label() is the label associated with the CellID.
//		DoSomething(targetPoint, result);
//	}
//
// Internally, the index consists of a set of non-overlapping leaf cell ranges
// that subdivide the sphere and such that each range intersects a particular
// set of (cellID, label) pairs.
//
// Most clients should use either the methods such as VisitIntersectingCells
// and IntersectingLabels, or a helper such as ClosestCellQuery.
type CellIndex struct {
	// A tree of (cellID, label) pairs such that if X is an ancestor of Y, then
	// X.cellID contains Y.cellID. The contents of a given range of leaf
	// cells can be represented by pointing to a node of this tree.
	cellTree []cellIndexNode

	// The last element of rangeNodes is a sentinel value, which is necessary
	// in order to represent the range covered by the previous element.
	rangeNodes []rangeNode
}

// Add adds the given CellID and Label to the index.
func (c *CellIndex) Add(id CellID, label int32) {
	if label < 0 {
		panic("labels must be non-negative")
	}
	c.cellTree = append(c.cellTree, cellIndexNode{cellID: id, label: label, parent: -1})
}

// AddCellUnion adds all of the elements of the given CellUnion to the index with the same label.
func (c *CellIndex) AddCellUnion(cu CellUnion, label int32) {
	if label < 0 {
		panic("labels must be non-negative")
	}
	for _, cell := range cu {
		c.Add(cell, label)
	}
}

// Build builds the index for use. This method should only be called once.
func (c *CellIndex) Build() {
	// To build the cell tree and leaf cell ranges, we maintain a stack of
	// (CellID, label) pairs that contain the current leaf cell. This struct
	// represents an instruction to push or pop a (cellID, label) pair.
	//
	// If label >= 0, the (cellID, label) pair is pushed on the stack.
	// If CellID == SentinelCellID, a pair is popped from the stack.
	// Otherwise the stack is unchanged but a rangeNode is still emitted.

	// delta represents an entry in a stack of (CellID, label) pairs used in the
	// construction of the CellIndex structure.
	type delta struct {
		startID CellID
		cellID  CellID
		label   int32
	}

	deltas := make([]delta, 0, 2*len(c.cellTree)+2)

	// Create two deltas for each (cellID, label) pair: one to add the pair to
	// the stack (at the start of its leaf cell range), and one to remove it from
	// the stack (at the end of its leaf cell range).
	for _, node := range c.cellTree {
		deltas = append(deltas, delta{
			startID: node.cellID.RangeMin(),
			cellID:  node.cellID,
			label:   node.label,
		})
		deltas = append(deltas, delta{
			startID: node.cellID.RangeMax().Next(),
			cellID:  SentinelCellID,
			label:   -1,
		})
	}

	// We also create two special deltas to ensure that a RangeNode is emitted at
	// the beginning and end of the CellID range.
	deltas = append(deltas, delta{
		startID: CellIDFromFace(0).ChildBeginAtLevel(MaxLevel),
		cellID:  CellID(0),
		label:   -1,
	})
	deltas = append(deltas, delta{
		startID: CellIDFromFace(5).ChildEndAtLevel(MaxLevel),
		cellID:  CellID(0),
		label:   -1,
	})

	sort.Slice(deltas, func(i, j int) bool {
		// deltas are sorted first by startID, then in reverse order by cellID,
		// and then by label. This is necessary to ensure that (1) larger cells
		// are pushed on the stack before smaller cells, and (2) cells are popped
		// off the stack before any new cells are added.

		if si, sj := deltas[i].startID, deltas[j].startID; si != sj {
			return si < sj
		}
		if si, sj := deltas[i].cellID, deltas[j].cellID; si != sj {
			return si > sj
		}
		return deltas[i].label < deltas[j].label
	})

	// Now walk through the deltas to build the leaf cell ranges and cell tree
	// (which is essentially a permanent form of the "stack" described above).
	c.cellTree = nil
	c.rangeNodes = nil
	contents := int32(-1)
	for i := 0; i < len(deltas); {
		startID := deltas[i].startID
		// Process all the deltas associated with the current startID.
		for ; i < len(deltas) && deltas[i].startID == startID; i++ {
			if deltas[i].label >= 0 {
				c.cellTree = append(c.cellTree, cellIndexNode{
					cellID: deltas[i].cellID,
					label:  deltas[i].label,
					parent: contents})
				contents = int32(len(c.cellTree) - 1)
			} else if deltas[i].cellID == SentinelCellID {
				contents = c.cellTree[contents].parent
			}
		}
		c.rangeNodes = append(c.rangeNodes, rangeNode{startID, contents})
	}
}

type CellVisitor func(CellID, int32) bool

func (c *CellIndex) GetIntersectingLabels(target CellUnion) []int32 {
	var rv []int32
	c.IntersectingLabels(target, &rv)
	return rv
}

func (c *CellIndex) IntersectingLabels(target CellUnion, labels *[]int32) {
	c.VisitIntersectingCells(target, func(cellID CellID, label int32) bool {
		*labels = append(*labels, label)
		return true
	})
	dedupe(labels)
	sort.Slice(*labels, func(i, j int) bool { return (*labels)[i] < (*labels)[j] })
}

func dedupe(labels *[]int32) {
	encountered := make(map[int32]struct{})

	for v := range *labels {
		encountered[(*labels)[v]] = struct{}{}
	}

	(*labels) = (*labels)[:0]
	for key, _ := range encountered {
		*labels = append(*labels, key)
	}
}

func (c *CellIndex) VisitIntersectingCells(target CellUnion,
	visitor CellVisitor) bool {
	if len(target) == 0 {
		return true
	}

	var pos int
	cItr := NewCellIndexContentsIterator(c)
	rItr := NewCellIndexNonEmptyRangeIterator(c)
	rItr.Begin()
	for pos < len(target) {
		if rItr.LimitID() <= target[pos].RangeMin() {
			rItr.Seek(target[pos].RangeMin())
		}

		for rItr.StartID() <= target[pos].RangeMax() {
			for cItr.StartUnion(rItr); cItr.Done(); cItr.Next() {
				if !visitor(cItr.CellID(), cItr.Label()) {
					return false
				}
			}
		}

		pos++
		if pos < len(target) && target[pos].RangeMax() < rItr.StartID() {
			pos = target.lowerBound(pos, len(target), rItr.StartID())
			if target[pos-1].RangeMax() >= rItr.StartID() {
				pos--
			}
		}
	}
	return true
}

// TODO(roberts): Differences from C++
// IntersectingLabels
// VisitIntersectingCells
// CellIndexIterator
