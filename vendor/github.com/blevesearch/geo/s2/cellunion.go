// Copyright 2014 Google Inc. All rights reserved.
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
	"fmt"
	"io"
	"sort"

	"github.com/golang/geo/s1"
)

// A CellUnion is a collection of CellIDs.
//
// It is normalized if it is sorted, and does not contain redundancy.
// Specifically, it may not contain the same CellID twice, nor a CellID that
// is contained by another, nor the four sibling CellIDs that are children of
// a single higher level CellID.
//
// CellUnions are not required to be normalized, but certain operations will
// return different results if they are not (e.g. Contains).
type CellUnion []CellID

// CellUnionFromRange creates a CellUnion that covers the half-open range
// of leaf cells [begin, end). If begin == end the resulting union is empty.
// This requires that begin and end are both leaves, and begin <= end.
// To create a closed-ended range, pass in end.Next().
func CellUnionFromRange(begin, end CellID) CellUnion {
	// We repeatedly add the largest cell we can.
	var cu CellUnion
	for id := begin.MaxTile(end); id != end; id = id.Next().MaxTile(end) {
		cu = append(cu, id)
	}
	// The output is normalized because the cells are added in order by the iteration.
	return cu
}

// CellUnionFromUnion creates a CellUnion from the union of the given CellUnions.
func CellUnionFromUnion(cellUnions ...CellUnion) CellUnion {
	var cu CellUnion
	for _, cellUnion := range cellUnions {
		cu = append(cu, cellUnion...)
	}
	cu.Normalize()
	return cu
}

// CellUnionFromIntersection creates a CellUnion from the intersection of the given CellUnions.
func CellUnionFromIntersection(x, y CellUnion) CellUnion {
	var cu CellUnion

	// This is a fairly efficient calculation that uses binary search to skip
	// over sections of both input vectors. It takes constant time if all the
	// cells of x come before or after all the cells of y in CellID order.
	var i, j int
	for i < len(x) && j < len(y) {
		iMin := x[i].RangeMin()
		jMin := y[j].RangeMin()
		if iMin > jMin {
			// Either j.Contains(i) or the two cells are disjoint.
			if x[i] <= y[j].RangeMax() {
				cu = append(cu, x[i])
				i++
			} else {
				// Advance j to the first cell possibly contained by x[i].
				j = y.lowerBound(j+1, len(y), iMin)
				// The previous cell y[j-1] may now contain x[i].
				if x[i] <= y[j-1].RangeMax() {
					j--
				}
			}
		} else if jMin > iMin {
			// Identical to the code above with i and j reversed.
			if y[j] <= x[i].RangeMax() {
				cu = append(cu, y[j])
				j++
			} else {
				i = x.lowerBound(i+1, len(x), jMin)
				if y[j] <= x[i-1].RangeMax() {
					i--
				}
			}
		} else {
			// i and j have the same RangeMin(), so one contains the other.
			if x[i] < y[j] {
				cu = append(cu, x[i])
				i++
			} else {
				cu = append(cu, y[j])
				j++
			}
		}
	}

	// The output is generated in sorted order.
	cu.Normalize()
	return cu
}

// CellUnionFromIntersectionWithCellID creates a CellUnion from the intersection
// of a CellUnion with the given CellID. This can be useful for splitting a
// CellUnion into chunks.
func CellUnionFromIntersectionWithCellID(x CellUnion, id CellID) CellUnion {
	var cu CellUnion
	if x.ContainsCellID(id) {
		cu = append(cu, id)
		cu.Normalize()
		return cu
	}

	idmax := id.RangeMax()
	for i := x.lowerBound(0, len(x), id.RangeMin()); i < len(x) && x[i] <= idmax; i++ {
		cu = append(cu, x[i])
	}

	cu.Normalize()
	return cu
}

// CellUnionFromDifference creates a CellUnion from the difference (x - y)
// of the given CellUnions.
func CellUnionFromDifference(x, y CellUnion) CellUnion {
	// TODO(roberts): This is approximately O(N*log(N)), but could probably
	// use similar techniques as CellUnionFromIntersectionWithCellID to be more efficient.

	var cu CellUnion
	for _, xid := range x {
		cu.cellUnionDifferenceInternal(xid, &y)
	}

	// The output is generated in sorted order, and there should not be any
	// cells that can be merged (provided that both inputs were normalized).
	return cu
}

// The C++ constructor methods FromNormalized and FromVerbatim are not necessary
// since they don't call Normalize, and just set the CellIDs directly on the object,
// so straight casting is sufficient in Go to replicate this behavior.

// IsValid reports whether the cell union is valid, meaning that the CellIDs are
// valid, non-overlapping, and sorted in increasing order.
func (cu *CellUnion) IsValid() bool {
	for i, cid := range *cu {
		if !cid.IsValid() {
			return false
		}
		if i == 0 {
			continue
		}
		if (*cu)[i-1].RangeMax() >= cid.RangeMin() {
			return false
		}
	}
	return true
}

// IsNormalized reports whether the cell union is normalized, meaning that it is
// satisfies IsValid and that no four cells have a common parent.
// Certain operations such as Contains will return a different
// result if the cell union is not normalized.
func (cu *CellUnion) IsNormalized() bool {
	for i, cid := range *cu {
		if !cid.IsValid() {
			return false
		}
		if i == 0 {
			continue
		}
		if (*cu)[i-1].RangeMax() >= cid.RangeMin() {
			return false
		}
		if i < 3 {
			continue
		}
		if areSiblings((*cu)[i-3], (*cu)[i-2], (*cu)[i-1], cid) {
			return false
		}
	}
	return true
}

// Normalize normalizes the CellUnion.
func (cu *CellUnion) Normalize() {
	sortCellIDs(*cu)

	output := make([]CellID, 0, len(*cu)) // the list of accepted cells
	// Loop invariant: output is a sorted list of cells with no redundancy.
	for _, ci := range *cu {
		// The first two passes here either ignore this new candidate,
		// or remove previously accepted cells that are covered by this candidate.

		// Ignore this cell if it is contained by the previous one.
		// We only need to check the last accepted cell. The ordering of the
		// cells implies containment (but not the converse), and output has no redundancy,
		// so if this candidate is not contained by the last accepted cell
		// then it cannot be contained by any previously accepted cell.
		if len(output) > 0 && output[len(output)-1].Contains(ci) {
			continue
		}

		// Discard any previously accepted cells contained by this one.
		// This could be any contiguous trailing subsequence, but it can't be
		// a discontiguous subsequence because of the containment property of
		// sorted S2 cells mentioned above.
		j := len(output) - 1 // last index to keep
		for j >= 0 {
			if !ci.Contains(output[j]) {
				break
			}
			j--
		}
		output = output[:j+1]

		// See if the last three cells plus this one can be collapsed.
		// We loop because collapsing three accepted cells and adding a higher level cell
		// could cascade into previously accepted cells.
		for len(output) >= 3 && areSiblings(output[len(output)-3], output[len(output)-2], output[len(output)-1], ci) {
			// Replace four children by their parent cell.
			output = output[:len(output)-3]
			ci = ci.immediateParent() // checked !ci.isFace above
		}
		output = append(output, ci)
	}
	*cu = output
}

// IntersectsCellID reports whether this CellUnion intersects the given cell ID.
func (cu *CellUnion) IntersectsCellID(id CellID) bool {
	// Find index of array item that occurs directly after our probe cell:
	i := sort.Search(len(*cu), func(i int) bool { return id < (*cu)[i] })

	if i != len(*cu) && (*cu)[i].RangeMin() <= id.RangeMax() {
		return true
	}
	return i != 0 && (*cu)[i-1].RangeMax() >= id.RangeMin()
}

// ContainsCellID reports whether the CellUnion contains the given cell ID.
// Containment is defined with respect to regions, e.g. a cell contains its 4 children.
//
// CAVEAT: If you have constructed a non-normalized CellUnion, note that groups
// of 4 child cells are *not* considered to contain their parent cell. To get
// this behavior you must use one of the call Normalize() explicitly.
func (cu *CellUnion) ContainsCellID(id CellID) bool {
	// Find index of array item that occurs directly after our probe cell:
	i := sort.Search(len(*cu), func(i int) bool { return id < (*cu)[i] })

	if i != len(*cu) && (*cu)[i].RangeMin() <= id {
		return true
	}
	return i != 0 && (*cu)[i-1].RangeMax() >= id
}

// Denormalize replaces this CellUnion with an expanded version of the
// CellUnion where any cell whose level is less than minLevel or where
// (level - minLevel) is not a multiple of levelMod is replaced by its
// children, until either both of these conditions are satisfied or the
// maximum level is reached.
func (cu *CellUnion) Denormalize(minLevel, levelMod int) {
	var denorm CellUnion
	for _, id := range *cu {
		level := id.Level()
		newLevel := level
		if newLevel < minLevel {
			newLevel = minLevel
		}
		if levelMod > 1 {
			newLevel += (maxLevel - (newLevel - minLevel)) % levelMod
			if newLevel > maxLevel {
				newLevel = maxLevel
			}
		}
		if newLevel == level {
			denorm = append(denorm, id)
		} else {
			end := id.ChildEndAtLevel(newLevel)
			for ci := id.ChildBeginAtLevel(newLevel); ci != end; ci = ci.Next() {
				denorm = append(denorm, ci)
			}
		}
	}
	*cu = denorm
}

// RectBound returns a Rect that bounds this entity.
func (cu *CellUnion) RectBound() Rect {
	bound := EmptyRect()
	for _, c := range *cu {
		bound = bound.Union(CellFromCellID(c).RectBound())
	}
	return bound
}

// CapBound returns a Cap that bounds this entity.
func (cu *CellUnion) CapBound() Cap {
	if len(*cu) == 0 {
		return EmptyCap()
	}

	// Compute the approximate centroid of the region. This won't produce the
	// bounding cap of minimal area, but it should be close enough.
	var centroid Point

	for _, ci := range *cu {
		area := AvgAreaMetric.Value(ci.Level())
		centroid = Point{centroid.Add(ci.Point().Mul(area))}
	}

	if zero := (Point{}); centroid == zero {
		centroid = PointFromCoords(1, 0, 0)
	} else {
		centroid = Point{centroid.Normalize()}
	}

	// Use the centroid as the cap axis, and expand the cap angle so that it
	// contains the bounding caps of all the individual cells.  Note that it is
	// *not* sufficient to just bound all the cell vertices because the bounding
	// cap may be concave (i.e. cover more than one hemisphere).
	c := CapFromPoint(centroid)
	for _, ci := range *cu {
		c = c.AddCap(CellFromCellID(ci).CapBound())
	}

	return c
}

// ContainsCell reports whether this cell union contains the given cell.
func (cu *CellUnion) ContainsCell(c Cell) bool {
	return cu.ContainsCellID(c.id)
}

// IntersectsCell reports whether this cell union intersects the given cell.
func (cu *CellUnion) IntersectsCell(c Cell) bool {
	return cu.IntersectsCellID(c.id)
}

// ContainsPoint reports whether this cell union contains the given point.
func (cu *CellUnion) ContainsPoint(p Point) bool {
	return cu.ContainsCell(CellFromPoint(p))
}

// CellUnionBound computes a covering of the CellUnion.
func (cu *CellUnion) CellUnionBound() []CellID {
	return cu.CapBound().CellUnionBound()
}

// LeafCellsCovered reports the number of leaf cells covered by this cell union.
// This will be no more than 6*2^60 for the whole sphere.
func (cu *CellUnion) LeafCellsCovered() int64 {
	var numLeaves int64
	for _, c := range *cu {
		numLeaves += 1 << uint64((maxLevel-int64(c.Level()))<<1)
	}
	return numLeaves
}

// Returns true if the given four cells have a common parent.
// This requires that the four CellIDs are distinct.
func areSiblings(a, b, c, d CellID) bool {
	// A necessary (but not sufficient) condition is that the XOR of the
	// four cell IDs must be zero. This is also very fast to test.
	if (a ^ b ^ c) != d {
		return false
	}

	// Now we do a slightly more expensive but exact test. First, compute a
	// mask that blocks out the two bits that encode the child position of
	// "id" with respect to its parent, then check that the other three
	// children all agree with "mask".
	mask := d.lsb() << 1
	mask = ^(mask + (mask << 1))
	idMasked := (uint64(d) & mask)
	return ((uint64(a)&mask) == idMasked &&
		(uint64(b)&mask) == idMasked &&
		(uint64(c)&mask) == idMasked &&
		!d.isFace())
}

// Contains reports whether this CellUnion contains all of the CellIDs of the given CellUnion.
func (cu *CellUnion) Contains(o CellUnion) bool {
	// TODO(roberts): Investigate alternatives such as divide-and-conquer
	// or alternating-skip-search that may be significantly faster in both
	// the average and worst case. This applies to Intersects as well.
	for _, id := range o {
		if !cu.ContainsCellID(id) {
			return false
		}
	}

	return true
}

// Intersects reports whether this CellUnion intersects any of the CellIDs of the given CellUnion.
func (cu *CellUnion) Intersects(o CellUnion) bool {
	for _, c := range *cu {
		if o.IntersectsCellID(c) {
			return true
		}
	}

	return false
}

// lowerBound returns the index in this CellUnion to the first element whose value
// is not considered to go before the given cell id. (i.e., either it is equivalent
// or comes after the given id.) If there is no match, then end is returned.
func (cu *CellUnion) lowerBound(begin, end int, id CellID) int {
	for i := begin; i < end; i++ {
		if (*cu)[i] >= id {
			return i
		}
	}

	return end
}

// cellUnionDifferenceInternal adds the difference between the CellID and the union to
// the result CellUnion. If they intersect but the difference is non-empty, it divides
// and conquers.
func (cu *CellUnion) cellUnionDifferenceInternal(id CellID, other *CellUnion) {
	if !other.IntersectsCellID(id) {
		(*cu) = append((*cu), id)
		return
	}

	if !other.ContainsCellID(id) {
		for _, child := range id.Children() {
			cu.cellUnionDifferenceInternal(child, other)
		}
	}
}

// ExpandAtLevel expands this CellUnion by adding a rim of cells at expandLevel
// around the unions boundary.
//
// For each cell c in the union, we add all cells at level
// expandLevel that abut c. There are typically eight of those
// (four edge-abutting and four sharing a vertex). However, if c is
// finer than expandLevel, we add all cells abutting
// c.Parent(expandLevel) as well as c.Parent(expandLevel) itself,
// as an expandLevel cell rarely abuts a smaller cell.
//
// Note that the size of the output is exponential in
// expandLevel. For example, if expandLevel == 20 and the input
// has a cell at level 10, there will be on the order of 4000
// adjacent cells in the output. For most applications the
// ExpandByRadius method below is easier to use.
func (cu *CellUnion) ExpandAtLevel(level int) {
	var output CellUnion
	levelLsb := lsbForLevel(level)
	for i := len(*cu) - 1; i >= 0; i-- {
		id := (*cu)[i]
		if id.lsb() < levelLsb {
			id = id.Parent(level)
			// Optimization: skip over any cells contained by this one. This is
			// especially important when very small regions are being expanded.
			for i > 0 && id.Contains((*cu)[i-1]) {
				i--
			}
		}
		output = append(output, id)
		output = append(output, id.AllNeighbors(level)...)
	}
	sortCellIDs(output)

	*cu = output
	cu.Normalize()
}

// ExpandByRadius expands this CellUnion such that it contains all points whose
// distance to the CellUnion is at most minRadius, but do not use cells that
// are more than maxLevelDiff levels higher than the largest cell in the input.
// The second parameter controls the tradeoff between accuracy and output size
// when a large region is being expanded by a small amount (e.g. expanding Canada
// by 1km). For example, if maxLevelDiff == 4 the region will always be expanded
// by approximately 1/16 the width of its largest cell. Note that in the worst case,
// the number of cells in the output can be up to 4 * (1 + 2 ** maxLevelDiff) times
// larger than the number of cells in the input.
func (cu *CellUnion) ExpandByRadius(minRadius s1.Angle, maxLevelDiff int) {
	minLevel := maxLevel
	for _, cid := range *cu {
		minLevel = minInt(minLevel, cid.Level())
	}

	// Find the maximum level such that all cells are at least "minRadius" wide.
	radiusLevel := MinWidthMetric.MaxLevel(minRadius.Radians())
	if radiusLevel == 0 && minRadius.Radians() > MinWidthMetric.Value(0) {
		// The requested expansion is greater than the width of a face cell.
		// The easiest way to handle this is to expand twice.
		cu.ExpandAtLevel(0)
	}
	cu.ExpandAtLevel(minInt(minLevel+maxLevelDiff, radiusLevel))
}

// Equal reports whether the two CellUnions are equal.
func (cu CellUnion) Equal(o CellUnion) bool {
	if len(cu) != len(o) {
		return false
	}
	for i := 0; i < len(cu); i++ {
		if cu[i] != o[i] {
			return false
		}
	}
	return true
}

// AverageArea returns the average area of this CellUnion.
// This is accurate to within a factor of 1.7.
func (cu *CellUnion) AverageArea() float64 {
	return AvgAreaMetric.Value(maxLevel) * float64(cu.LeafCellsCovered())
}

// ApproxArea returns the approximate area of this CellUnion. This method is accurate
// to within 3% percent for all cell sizes and accurate to within 0.1% for cells
// at level 5 or higher within the union.
func (cu *CellUnion) ApproxArea() float64 {
	var area float64
	for _, id := range *cu {
		area += CellFromCellID(id).ApproxArea()
	}
	return area
}

// ExactArea returns the area of this CellUnion as accurately as possible.
func (cu *CellUnion) ExactArea() float64 {
	var area float64
	for _, id := range *cu {
		area += CellFromCellID(id).ExactArea()
	}
	return area
}

// Encode encodes the CellUnion.
func (cu *CellUnion) Encode(w io.Writer) error {
	e := &encoder{w: w}
	cu.encode(e)
	return e.err
}

func (cu *CellUnion) encode(e *encoder) {
	e.writeInt8(encodingVersion)
	e.writeInt64(int64(len(*cu)))
	for _, ci := range *cu {
		ci.encode(e)
	}
}

// Decode decodes the CellUnion.
func (cu *CellUnion) Decode(r io.Reader) error {
	d := &decoder{r: asByteReader(r)}
	cu.decode(d)
	return d.err
}

func (cu *CellUnion) decode(d *decoder) {
	version := d.readInt8()
	if d.err != nil {
		return
	}
	if version != encodingVersion {
		d.err = fmt.Errorf("only version %d is supported", encodingVersion)
		return
	}
	n := d.readInt64()
	if d.err != nil {
		return
	}
	const maxCells = 1000000
	if n > maxCells {
		d.err = fmt.Errorf("too many cells (%d; max is %d)", n, maxCells)
		return
	}
	*cu = make([]CellID, n)
	for i := range *cu {
		(*cu)[i].decode(d)
	}
}
