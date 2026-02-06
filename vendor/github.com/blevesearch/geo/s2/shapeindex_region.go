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

// ShapeIndexRegion wraps a ShapeIndex and implements the Region interface.
// This allows RegionCoverer to work with ShapeIndexes as well as being
// able to be used by some of the Query types.
type ShapeIndexRegion struct {
	index         *ShapeIndex
	containsQuery *ContainsPointQuery
	iter          *ShapeIndexIterator
}

// TODO(roberts): Uncomment once implementation is complete.
// Enforce Region interface satisfaction similar to other types that implement Region.
// var _ Region = (*ShapeIndexRegion)(nil)

// CapBound returns a bounding spherical cap for this collection of geometry.
// This is not guaranteed to be exact.
func (s *ShapeIndexRegion) CapBound() Cap {
	cu := CellUnion(s.CellUnionBound())
	return cu.CapBound()
}

// RectBound returns a bounding rectangle for this collection of geometry.
// The bounds are not guaranteed to be tight.
func (s *ShapeIndexRegion) RectBound() Rect {
	cu := CellUnion(s.CellUnionBound())
	return cu.RectBound()
}

// CellUnionBound returns the bounding CellUnion for this collection of geometry.
// This method currently returns at most 4 cells, unless the index spans
// multiple faces in which case it may return up to 6 cells.
func (s *ShapeIndexRegion) CellUnionBound() []CellID {
	// We find the range of Cells spanned by the index and choose a level such
	// that the entire index can be covered with just a few cells.  There are
	// two cases:
	//
	//  - If the index intersects two or more faces, then for each intersected
	//    face we add one cell to the covering.  Rather than adding the entire
	//    face, instead we add the smallest Cell that covers the ShapeIndex
	//    cells within that face.
	//
	//  - If the index intersects only one face, then we first find the smallest
	//    cell S that contains the index cells (just like the case above).
	//    However rather than using the cell S itself, instead we repeat this
	//    process for each of its child cells.  In other words, for each
	//    child cell C we add the smallest Cell C' that covers the index cells
	//    within C.  This extra step is relatively cheap and produces much
	//    tighter coverings when the ShapeIndex consists of a small region
	//    near the center of a large Cell.
	var cellIDs []CellID

	// Find the last CellID in the index.
	s.iter.End()
	if !s.iter.Prev() {
		return cellIDs // Empty index.
	}
	lastIndexID := s.iter.CellID()
	s.iter.Begin()
	if s.iter.CellID() != lastIndexID {
		// The index has at least two cells. Choose a CellID level such that
		// the entire index can be spanned with at most 6 cells (if the index
		// spans multiple faces) or 4 cells (it the index spans a single face).
		level, ok := s.iter.CellID().CommonAncestorLevel(lastIndexID)
		if !ok {
			// C++ returns -1 for no common level, ours returns 0. Set
			// to -1 so the next ++ puts us at the same place as C++ does.
			level = -1
		}
		level++

		// For each cell C at the chosen level, we compute the smallest Cell
		// that covers the ShapeIndex cells within C.
		lastID := lastIndexID.Parent(level)
		for id := s.iter.CellID().Parent(level); id != lastID; id = id.Next() {
			// If the cell C does not contain any index cells, then skip it.
			if id.RangeMax() < s.iter.CellID() {
				continue
			}

			// Find the range of index cells contained by C and then shrink C so
			// that it just covers those cells.
			first := s.iter.CellID()
			s.iter.seek(id.RangeMax().Next())
			s.iter.Prev()
			cellIDs = s.coverRange(first, s.iter.CellID(), cellIDs)
			s.iter.Next()
		}
	}

	return s.coverRange(s.iter.CellID(), lastIndexID, cellIDs)
}

// coverRange computes the smallest CellID that covers the Cell range (first, last)
// and returns the updated slice.
//
// This requires first and last have a common ancestor.
func (s *ShapeIndexRegion) coverRange(first, last CellID, cellIDs []CellID) []CellID {
	// The range consists of a single index cell.
	if first == last {
		return append(cellIDs, first)
	}

	// Add the lowest common ancestor of the given range.
	level, ok := first.CommonAncestorLevel(last)
	if !ok {
		return append(cellIDs, CellID(0))
	}
	return append(cellIDs, first.Parent(level))
}

// TODO(roberts): remaining methods
/*
// ContainsCell(target Cell) bool {
// IntersectsCell(target Cell) bool {
// ContainsPoint(p Point) bool {
// contains(id CellID, clipped clippedShape, p Point) bool {
// anyEdgeIntersects(clipped clippedShape, target Cell) bool {
*/
