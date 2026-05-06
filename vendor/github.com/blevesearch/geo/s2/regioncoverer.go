// Copyright 2015 Google Inc. All rights reserved.
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
	"container/heap"
	"sort"
)

// RegionCoverer allows arbitrary regions to be approximated as unions of cells (CellUnion).
// This is useful for implementing various sorts of search and precomputation operations.
//
// Typical usage:
//
//	rc := &s2.RegionCoverer{MaxLevel: 30, MaxCells: 5}
//	r := s2.Region(CapFromCenterArea(center, area))
//	covering := rc.Covering(r)
//
// This yields a CellUnion of at most 5 cells that is guaranteed to cover the
// given region (a disc-shaped region on the sphere).
//
// For covering, only cells where (level - MinLevel) is a multiple of LevelMod will be used.
// This effectively allows the branching factor of the S2 CellID hierarchy to be increased.
// Currently the only parameter values allowed are 1, 2, or 3, corresponding to
// branching factors of 4, 16, and 64 respectively.
//
// Note the following:
//
//  - MinLevel takes priority over MaxCells, i.e. cells below the given level will
//    never be used even if this causes a large number of cells to be returned.
//
//  - For any setting of MaxCells, up to 6 cells may be returned if that
//    is the minimum number of cells required (e.g. if the region intersects
//    all six face cells).  Up to 3 cells may be returned even for very tiny
//    convex regions if they happen to be located at the intersection of
//    three cube faces.
//
//  - For any setting of MaxCells, an arbitrary number of cells may be
//    returned if MinLevel is too high for the region being approximated.
//
//  - If MaxCells is less than 4, the area of the covering may be
//    arbitrarily large compared to the area of the original region even if
//    the region is convex (e.g. a Cap or Rect).
//
// The approximation algorithm is not optimal but does a pretty good job in
// practice. The output does not always use the maximum number of cells
// allowed, both because this would not always yield a better approximation,
// and because MaxCells is a limit on how much work is done exploring the
// possible covering as well as a limit on the final output size.
//
// Because it is an approximation algorithm, one should not rely on the
// stability of the output. In particular, the output of the covering algorithm
// may change across different versions of the library.
//
// One can also generate interior coverings, which are sets of cells which
// are entirely contained within a region. Interior coverings can be
// empty, even for non-empty regions, if there are no cells that satisfy
// the provided constraints and are contained by the region. Note that for
// performance reasons, it is wise to specify a MaxLevel when computing
// interior coverings - otherwise for regions with small or zero area, the
// algorithm may spend a lot of time subdividing cells all the way to leaf
// level to try to find contained cells.
type RegionCoverer struct {
	MinLevel int // the minimum cell level to be used.
	MaxLevel int // the maximum cell level to be used.
	LevelMod int // the LevelMod to be used.
	MaxCells int // the maximum desired number of cells in the approximation.
}

// NewRegionCoverer returns a region coverer with the appropriate defaults.
func NewRegionCoverer() *RegionCoverer {
	return &RegionCoverer{
		MinLevel: 0,
		MaxLevel: maxLevel,
		LevelMod: 1,
		MaxCells: 8,
	}
}

type coverer struct {
	minLevel         int // the minimum cell level to be used.
	maxLevel         int // the maximum cell level to be used.
	levelMod         int // the LevelMod to be used.
	maxCells         int // the maximum desired number of cells in the approximation.
	region           Region
	result           CellUnion
	pq               priorityQueue
	interiorCovering bool
}

type candidate struct {
	cell        Cell
	terminal    bool         // Cell should not be expanded further.
	numChildren int          // Number of children that intersect the region.
	children    []*candidate // Actual size may be 0, 4, 16, or 64 elements.
	priority    int          // Priority of the candidate.
}

type priorityQueue []*candidate

func (pq priorityQueue) Len() int {
	return len(pq)
}

func (pq priorityQueue) Less(i, j int) bool {
	// We want Pop to give us the highest, not lowest, priority so we use greater than here.
	return pq[i].priority > pq[j].priority
}

func (pq priorityQueue) Swap(i, j int) {
	pq[i], pq[j] = pq[j], pq[i]
}

func (pq *priorityQueue) Push(x interface{}) {
	item := x.(*candidate)
	*pq = append(*pq, item)
}

func (pq *priorityQueue) Pop() interface{} {
	item := (*pq)[len(*pq)-1]
	*pq = (*pq)[:len(*pq)-1]
	return item
}

func (pq *priorityQueue) Reset() {
	*pq = (*pq)[:0]
}

// newCandidate returns a new candidate with no children if the cell intersects the given region.
// The candidate is marked as terminal if it should not be expanded further.
func (c *coverer) newCandidate(cell Cell) *candidate {
	if !c.region.IntersectsCell(cell) {
		return nil
	}
	cand := &candidate{cell: cell}
	level := int(cell.level)
	if level >= c.minLevel {
		if c.interiorCovering {
			if c.region.ContainsCell(cell) {
				cand.terminal = true
			} else if level+c.levelMod > c.maxLevel {
				return nil
			}
		} else if level+c.levelMod > c.maxLevel || c.region.ContainsCell(cell) {
			cand.terminal = true
		}
	}
	return cand
}

// expandChildren populates the children of the candidate by expanding the given number of
// levels from the given cell.  Returns the number of children that were marked "terminal".
func (c *coverer) expandChildren(cand *candidate, cell Cell, numLevels int) int {
	numLevels--
	var numTerminals int
	last := cell.id.ChildEnd()
	for ci := cell.id.ChildBegin(); ci != last; ci = ci.Next() {
		childCell := CellFromCellID(ci)
		if numLevels > 0 {
			if c.region.IntersectsCell(childCell) {
				numTerminals += c.expandChildren(cand, childCell, numLevels)
			}
			continue
		}
		if child := c.newCandidate(childCell); child != nil {
			cand.children = append(cand.children, child)
			cand.numChildren++
			if child.terminal {
				numTerminals++
			}
		}
	}
	return numTerminals
}

// addCandidate adds the given candidate to the result if it is marked as "terminal",
// otherwise expands its children and inserts it into the priority queue.
// Passing an argument of nil does nothing.
func (c *coverer) addCandidate(cand *candidate) {
	if cand == nil {
		return
	}

	if cand.terminal {
		c.result = append(c.result, cand.cell.id)
		return
	}

	// Expand one level at a time until we hit minLevel to ensure that we don't skip over it.
	numLevels := c.levelMod
	level := int(cand.cell.level)
	if level < c.minLevel {
		numLevels = 1
	}

	numTerminals := c.expandChildren(cand, cand.cell, numLevels)
	maxChildrenShift := uint(2 * c.levelMod)
	if cand.numChildren == 0 {
		return
	} else if !c.interiorCovering && numTerminals == 1<<maxChildrenShift && level >= c.minLevel {
		// Optimization: add the parent cell rather than all of its children.
		// We can't do this for interior coverings, since the children just
		// intersect the region, but may not be contained by it - we need to
		// subdivide them further.
		cand.terminal = true
		c.addCandidate(cand)
	} else {
		// We negate the priority so that smaller absolute priorities are returned
		// first. The heuristic is designed to refine the largest cells first,
		// since those are where we have the largest potential gain. Among cells
		// of the same size, we prefer the cells with the fewest children.
		// Finally, among cells with equal numbers of children we prefer those
		// with the smallest number of children that cannot be refined further.
		cand.priority = -(((level<<maxChildrenShift)+cand.numChildren)<<maxChildrenShift + numTerminals)
		heap.Push(&c.pq, cand)
	}
}

// adjustLevel returns the reduced "level" so that it satisfies levelMod. Levels smaller than minLevel
// are not affected (since cells at these levels are eventually expanded).
func (c *coverer) adjustLevel(level int) int {
	if c.levelMod > 1 && level > c.minLevel {
		level -= (level - c.minLevel) % c.levelMod
	}
	return level
}

// adjustCellLevels ensures that all cells with level > minLevel also satisfy levelMod,
// by replacing them with an ancestor if necessary. Cell levels smaller
// than minLevel are not modified (see AdjustLevel). The output is
// then normalized to ensure that no redundant cells are present.
func (c *coverer) adjustCellLevels(cells *CellUnion) {
	if c.levelMod == 1 {
		return
	}

	var out int
	for _, ci := range *cells {
		level := ci.Level()
		newLevel := c.adjustLevel(level)
		if newLevel != level {
			ci = ci.Parent(newLevel)
		}
		if out > 0 && (*cells)[out-1].Contains(ci) {
			continue
		}
		for out > 0 && ci.Contains((*cells)[out-1]) {
			out--
		}
		(*cells)[out] = ci
		out++
	}
	*cells = (*cells)[:out]
}

// initialCandidates computes a set of initial candidates that cover the given region.
func (c *coverer) initialCandidates() {
	// Optimization: start with a small (usually 4 cell) covering of the region's bounding cap.
	temp := &RegionCoverer{MaxLevel: c.maxLevel, LevelMod: 1, MaxCells: minInt(4, c.maxCells)}

	cells := temp.FastCovering(c.region)
	c.adjustCellLevels(&cells)
	for _, ci := range cells {
		c.addCandidate(c.newCandidate(CellFromCellID(ci)))
	}
}

// coveringInternal generates a covering and stores it in result.
// Strategy: Start with the 6 faces of the cube.  Discard any
// that do not intersect the shape.  Then repeatedly choose the
// largest cell that intersects the shape and subdivide it.
//
// result contains the cells that will be part of the output, while pq
// contains cells that we may still subdivide further. Cells that are
// entirely contained within the region are immediately added to the output,
// while cells that do not intersect the region are immediately discarded.
// Therefore pq only contains cells that partially intersect the region.
// Candidates are prioritized first according to cell size (larger cells
// first), then by the number of intersecting children they have (fewest
// children first), and then by the number of fully contained children
// (fewest children first).
func (c *coverer) coveringInternal(region Region) {
	c.region = region

	c.initialCandidates()
	for c.pq.Len() > 0 && (!c.interiorCovering || len(c.result) < c.maxCells) {
		cand := heap.Pop(&c.pq).(*candidate)

		// For interior covering we keep subdividing no matter how many children
		// candidate has. If we reach MaxCells before expanding all children,
		// we will just use some of them.
		// For exterior covering we cannot do this, because result has to cover the
		// whole region, so all children have to be used.
		// candidate.numChildren == 1 case takes care of the situation when we
		// already have more than MaxCells in result (minLevel is too high).
		// Subdividing of the candidate with one child does no harm in this case.
		if c.interiorCovering || int(cand.cell.level) < c.minLevel || cand.numChildren == 1 || len(c.result)+c.pq.Len()+cand.numChildren <= c.maxCells {
			for _, child := range cand.children {
				if !c.interiorCovering || len(c.result) < c.maxCells {
					c.addCandidate(child)
				}
			}
		} else {
			cand.terminal = true
			c.addCandidate(cand)
		}
	}

	c.pq.Reset()
	c.region = nil

	// Rather than just returning the raw list of cell ids, we construct a cell
	// union and then denormalize it. This has the effect of replacing four
	// child cells with their parent whenever this does not violate the covering
	// parameters specified (min_level, level_mod, etc). This significantly
	// reduces the number of cells returned in many cases, and it is cheap
	// compared to computing the covering in the first place.
	c.result.Normalize()
	if c.minLevel > 0 || c.levelMod > 1 {
		c.result.Denormalize(c.minLevel, c.levelMod)
	}
}

// newCoverer returns an instance of coverer.
func (rc *RegionCoverer) newCoverer() *coverer {
	return &coverer{
		minLevel: maxInt(0, minInt(maxLevel, rc.MinLevel)),
		maxLevel: maxInt(0, minInt(maxLevel, rc.MaxLevel)),
		levelMod: maxInt(1, minInt(3, rc.LevelMod)),
		maxCells: rc.MaxCells,
	}
}

// Covering returns a CellUnion that covers the given region and satisfies the various restrictions.
func (rc *RegionCoverer) Covering(region Region) CellUnion {
	covering := rc.CellUnion(region)
	covering.Denormalize(maxInt(0, minInt(maxLevel, rc.MinLevel)), maxInt(1, minInt(3, rc.LevelMod)))
	return covering
}

// InteriorCovering returns a CellUnion that is contained within the given region and satisfies the various restrictions.
func (rc *RegionCoverer) InteriorCovering(region Region) CellUnion {
	intCovering := rc.InteriorCellUnion(region)
	intCovering.Denormalize(maxInt(0, minInt(maxLevel, rc.MinLevel)), maxInt(1, minInt(3, rc.LevelMod)))
	return intCovering
}

// CellUnion returns a normalized CellUnion that covers the given region and
// satisfies the restrictions except for minLevel and levelMod. These criteria
// cannot be satisfied using a cell union because cell unions are
// automatically normalized by replacing four child cells with their parent
// whenever possible. (Note that the list of cell ids passed to the CellUnion
// constructor does in fact satisfy all the given restrictions.)
func (rc *RegionCoverer) CellUnion(region Region) CellUnion {
	c := rc.newCoverer()
	c.coveringInternal(region)
	cu := c.result
	cu.Normalize()
	return cu
}

// InteriorCellUnion returns a normalized CellUnion that is contained within the given region and
// satisfies the restrictions except for minLevel and levelMod. These criteria
// cannot be satisfied using a cell union because cell unions are
// automatically normalized by replacing four child cells with their parent
// whenever possible. (Note that the list of cell ids passed to the CellUnion
// constructor does in fact satisfy all the given restrictions.)
func (rc *RegionCoverer) InteriorCellUnion(region Region) CellUnion {
	c := rc.newCoverer()
	c.interiorCovering = true
	c.coveringInternal(region)
	cu := c.result
	cu.Normalize()
	return cu
}

// FastCovering returns a CellUnion that covers the given region similar to Covering,
// except that this method is much faster and the coverings are not as tight.
// All of the usual parameters are respected (MaxCells, MinLevel, MaxLevel, and LevelMod),
// except that the implementation makes no attempt to take advantage of large values of
// MaxCells.  (A small number of cells will always be returned.)
//
// This function is useful as a starting point for algorithms that
// recursively subdivide cells.
func (rc *RegionCoverer) FastCovering(region Region) CellUnion {
	c := rc.newCoverer()
	cu := CellUnion(region.CellUnionBound())
	c.normalizeCovering(&cu)
	return cu
}

// IsCanonical reports whether the given CellUnion represents a valid covering
// that conforms to the current covering parameters.  In particular:
//
//  - All CellIDs must be valid.
//
//  - CellIDs must be sorted and non-overlapping.
//
//  - CellID levels must satisfy MinLevel, MaxLevel, and LevelMod.
//
//  - If the covering has more than MaxCells, there must be no two cells with
//    a common ancestor at MinLevel or higher.
//
//  - There must be no sequence of cells that could be replaced by an
//    ancestor (i.e. with LevelMod == 1, the 4 child cells of a parent).
func (rc *RegionCoverer) IsCanonical(covering CellUnion) bool {
	return rc.newCoverer().isCanonical(covering)
}

// normalizeCovering normalizes the "covering" so that it conforms to the
// current covering parameters (maxCells, minLevel, maxLevel, and levelMod).
// This method makes no attempt to be optimal. In particular, if
// minLevel > 0 or levelMod > 1 then it may return more than the
// desired number of cells even when this isn't necessary.
//
// Note that when the covering parameters have their default values, almost
// all of the code in this function is skipped.
func (c *coverer) normalizeCovering(covering *CellUnion) {
	// If any cells are too small, or don't satisfy levelMod, then replace them with ancestors.
	if c.maxLevel < maxLevel || c.levelMod > 1 {
		for i, ci := range *covering {
			level := ci.Level()
			newLevel := c.adjustLevel(minInt(level, c.maxLevel))
			if newLevel != level {
				(*covering)[i] = ci.Parent(newLevel)
			}
		}
	}
	// Sort the cells and simplify them.
	covering.Normalize()

	// Make sure that the covering satisfies minLevel and levelMod,
	// possibly at the expense of satisfying MaxCells.
	if c.minLevel > 0 || c.levelMod > 1 {
		covering.Denormalize(c.minLevel, c.levelMod)
	}

	// If there are too many cells and the covering is very large, use the
	// RegionCoverer to compute a new covering. (This avoids possible O(n^2)
	// behavior of the simpler algorithm below.)
	excess := len(*covering) - c.maxCells
	if excess <= 0 || c.isCanonical(*covering) {
		return
	}
	if excess*len(*covering) > 10000 {
		rc := NewRegionCoverer()
		(*covering) = rc.Covering(covering)
		return
	}

	// If there are still too many cells, then repeatedly replace two adjacent
	// cells in CellID order by their lowest common ancestor.
	for len(*covering) > c.maxCells {
		bestIndex := -1
		bestLevel := -1
		for i := 0; i+1 < len(*covering); i++ {
			level, ok := (*covering)[i].CommonAncestorLevel((*covering)[i+1])
			if !ok {
				continue
			}
			level = c.adjustLevel(level)
			if level > bestLevel {
				bestLevel = level
				bestIndex = i
			}
		}

		if bestLevel < c.minLevel {
			break
		}

		// Replace all cells contained by the new ancestor cell.
		id := (*covering)[bestIndex].Parent(bestLevel)
		(*covering) = c.replaceCellsWithAncestor(*covering, id)

		// Now repeatedly check whether all children of the parent cell are
		// present, in which case we can replace those cells with their parent.
		for bestLevel > c.minLevel {
			bestLevel -= c.levelMod
			id = id.Parent(bestLevel)
			if !c.containsAllChildren(*covering, id) {
				break
			}
			(*covering) = c.replaceCellsWithAncestor(*covering, id)
		}
	}
}

// isCanonical reports whether the covering is canonical.
func (c *coverer) isCanonical(covering CellUnion) bool {
	trueMax := c.maxLevel
	if c.levelMod != 1 {
		trueMax = c.maxLevel - (c.maxLevel-c.minLevel)%c.levelMod
	}
	tooManyCells := len(covering) > c.maxCells
	sameParentCount := 1

	prevID := CellID(0)
	for _, id := range covering {
		if !id.IsValid() {
			return false
		}

		// Check that the CellID level is acceptable.
		level := id.Level()
		if level < c.minLevel || level > trueMax {
			return false
		}
		if c.levelMod > 1 && (level-c.minLevel)%c.levelMod != 0 {
			return false
		}

		if prevID != 0 {
			// Check that cells are sorted and non-overlapping.
			if prevID.RangeMax() >= id.RangeMin() {
				return false
			}

			lev, ok := id.CommonAncestorLevel(prevID)
			// If there are too many cells, check that no pair of adjacent cells
			// could be replaced by an ancestor.
			if tooManyCells && (ok && lev >= c.minLevel) {
				return false
			}

			// Check that there are no sequences of (4 ** level_mod) cells that all
			// have the same parent (considering only multiples of "level_mod").
			pLevel := level - c.levelMod
			if pLevel < c.minLevel || level != prevID.Level() ||
				id.Parent(pLevel) != prevID.Parent(pLevel) {
				sameParentCount = 1
			} else {
				sameParentCount++
				if sameParentCount == 1<<uint(2*c.levelMod) {
					return false
				}
			}
		}
		prevID = id
	}

	return true
}

func (c *coverer) containsAllChildren(covering []CellID, id CellID) bool {
	pos := sort.Search(len(covering), func(i int) bool { return (covering)[i] >= id.RangeMin() })
	level := id.Level() + c.levelMod
	for child := id.ChildBeginAtLevel(level); child != id.ChildEndAtLevel(level); child = child.Next() {
		if pos == len(covering) || covering[pos] != child {
			return false
		}
		pos++
	}
	return true
}

// replaceCellsWithAncestor replaces all descendants of the given id in covering
// with id. This requires the covering contains at least one descendant of id.
func (c *coverer) replaceCellsWithAncestor(covering []CellID, id CellID) []CellID {
	begin := sort.Search(len(covering), func(i int) bool { return covering[i] > id.RangeMin() })
	end := sort.Search(len(covering), func(i int) bool { return covering[i] > id.RangeMax() })

	return append(append(covering[:begin], id), covering[end:]...)
}

// SimpleRegionCovering returns a set of cells at the given level that cover
// the connected region and a starting point on the boundary or inside the
// region. The cells are returned in arbitrary order.
//
// Note that this method is not faster than the regular Covering
// method for most region types, such as Cap or Polygon, and in fact it
// can be much slower when the output consists of a large number of cells.
// Currently it can be faster at generating coverings of long narrow regions
// such as polylines, but this may change in the future.
func SimpleRegionCovering(region Region, start Point, level int) []CellID {
	return FloodFillRegionCovering(region, cellIDFromPoint(start).Parent(level))
}

// FloodFillRegionCovering returns all edge-connected cells at the same level as
// the given CellID that intersect the given region, in arbitrary order.
func FloodFillRegionCovering(region Region, start CellID) []CellID {
	var output []CellID
	all := map[CellID]bool{
		start: true,
	}
	frontier := []CellID{start}
	for len(frontier) > 0 {
		id := frontier[len(frontier)-1]
		frontier = frontier[:len(frontier)-1]
		if !region.IntersectsCell(CellFromCellID(id)) {
			continue
		}
		output = append(output, id)
		for _, nbr := range id.EdgeNeighbors() {
			if !all[nbr] {
				all[nbr] = true
				frontier = append(frontier, nbr)
			}
		}
	}

	return output
}
