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
	"github.com/blevesearch/geo/r1"
	"github.com/blevesearch/geo/r2"
)

// PaddedCell represents a Cell whose (u,v)-range has been expanded on
// all sides by a given amount of "padding". Unlike Cell, its methods and
// representation are optimized for clipping edges against Cell boundaries
// to determine which cells are intersected by a given set of edges.
type PaddedCell struct {
	id          CellID
	padding     float64
	bound       r2.Rect
	middle      r2.Rect // A rect in (u, v)-space that belongs to all four children.
	iLo, jLo    int     // Minimum (i,j)-coordinates of this cell before padding
	orientation int     // Hilbert curve orientation of this cell.
	level       int
}

// PaddedCellFromCellID constructs a padded cell with the given padding.
func PaddedCellFromCellID(id CellID, padding float64) *PaddedCell {
	p := &PaddedCell{
		id:      id,
		padding: padding,
		middle:  r2.EmptyRect(),
	}

	// Fast path for constructing a top-level face (the most common case).
	if id.isFace() {
		limit := padding + 1
		p.bound = r2.Rect{X: r1.Interval{Lo: -limit, Hi: limit}, Y: r1.Interval{Lo: -limit, Hi: limit}}
		p.middle = r2.Rect{X: r1.Interval{Lo: -padding, Hi: padding}, Y: r1.Interval{Lo: -padding, Hi: padding}}
		p.orientation = id.Face() & 1
		return p
	}

	_, p.iLo, p.jLo, p.orientation = id.faceIJOrientation()
	p.level = id.Level()
	p.bound = ijLevelToBoundUV(p.iLo, p.jLo, p.level).ExpandedByMargin(padding)
	ijSize := sizeIJ(p.level)
	p.iLo &= -ijSize
	p.jLo &= -ijSize

	return p
}

// PaddedCellFromParentIJ constructs the child of parent with the given (i,j) index.
// The four child cells have indices of (0,0), (0,1), (1,0), (1,1), where the i and j
// indices correspond to increasing u- and v-values respectively.
func PaddedCellFromParentIJ(parent *PaddedCell, i, j int) *PaddedCell {
	// Compute the position and orientation of the child incrementally from the
	// orientation of the parent.
	pos := ijToPos[parent.orientation][2*i+j]

	p := &PaddedCell{
		id:          parent.id.Children()[pos],
		padding:     parent.padding,
		bound:       parent.bound,
		orientation: parent.orientation ^ posToOrientation[pos],
		level:       parent.level + 1,
		middle:      r2.EmptyRect(),
	}

	ijSize := sizeIJ(p.level)
	p.iLo = parent.iLo + i*ijSize
	p.jLo = parent.jLo + j*ijSize

	// For each child, one corner of the bound is taken directly from the parent
	// while the diagonally opposite corner is taken from middle().
	middle := parent.Middle()
	if i == 1 {
		p.bound.X.Lo = middle.X.Lo
	} else {
		p.bound.X.Hi = middle.X.Hi
	}
	if j == 1 {
		p.bound.Y.Lo = middle.Y.Lo
	} else {
		p.bound.Y.Hi = middle.Y.Hi
	}

	return p
}

// CellID returns the CellID this padded cell represents.
func (p PaddedCell) CellID() CellID {
	return p.id
}

// Padding returns the amount of padding on this cell.
func (p PaddedCell) Padding() float64 {
	return p.padding
}

// Level returns the level this cell is at.
func (p PaddedCell) Level() int {
	return p.level
}

// Center returns the center of this cell.
func (p PaddedCell) Center() Point {
	ijSize := sizeIJ(p.level)
	si := uint32(2*p.iLo + ijSize)
	ti := uint32(2*p.jLo + ijSize)
	return Point{faceSiTiToXYZ(p.id.Face(), si, ti).Normalize()}
}

// Middle returns the rectangle in the middle of this cell that belongs to
// all four of its children in (u,v)-space.
func (p *PaddedCell) Middle() r2.Rect {
	// We compute this field lazily because it is not needed the majority of the
	// time (i.e., for cells where the recursion terminates).
	if p.middle.IsEmpty() {
		ijSize := sizeIJ(p.level)
		u := stToUV(siTiToST(uint32(2*p.iLo + ijSize)))
		v := stToUV(siTiToST(uint32(2*p.jLo + ijSize)))
		p.middle = r2.Rect{
			X: r1.Interval{Lo: u - p.padding, Hi: u + p.padding},
			Y: r1.Interval{Lo: v - p.padding, Hi: v + p.padding},
		}
	}
	return p.middle
}

// Bound returns the bounds for this cell in (u,v)-space including padding.
func (p PaddedCell) Bound() r2.Rect {
	return p.bound
}

// ChildIJ returns the (i,j) coordinates for the child cell at the given traversal
// position. The traversal position corresponds to the order in which child
// cells are visited by the Hilbert curve.
func (p PaddedCell) ChildIJ(pos int) (i, j int) {
	ij := posToIJ[p.orientation][pos]
	return ij >> 1, ij & 1
}

// EntryVertex return the vertex where the space-filling curve enters this cell.
func (p PaddedCell) EntryVertex() Point {
	// The curve enters at the (0,0) vertex unless the axis directions are
	// reversed, in which case it enters at the (1,1) vertex.
	i := p.iLo
	j := p.jLo
	if p.orientation&invertMask != 0 {
		ijSize := sizeIJ(p.level)
		i += ijSize
		j += ijSize
	}
	return Point{faceSiTiToXYZ(p.id.Face(), uint32(2*i), uint32(2*j)).Normalize()}
}

// ExitVertex returns the vertex where the space-filling curve exits this cell.
func (p PaddedCell) ExitVertex() Point {
	// The curve exits at the (1,0) vertex unless the axes are swapped or
	// inverted but not both, in which case it exits at the (0,1) vertex.
	i := p.iLo
	j := p.jLo
	ijSize := sizeIJ(p.level)
	if p.orientation == 0 || p.orientation == swapMask+invertMask {
		i += ijSize
	} else {
		j += ijSize
	}
	return Point{faceSiTiToXYZ(p.id.Face(), uint32(2*i), uint32(2*j)).Normalize()}
}

// ShrinkToFit returns the smallest CellID that contains all descendants of this
// padded cell whose bounds intersect the given rect. For algorithms that use
// recursive subdivision to find the cells that intersect a particular object, this
// method can be used to skip all of the initial subdivision steps where only
// one child needs to be expanded.
//
// Note that this method is not the same as returning the smallest cell that contains
// the intersection of this cell with rect. Because of the padding, even if one child
// completely contains rect it is still possible that a neighboring child may also
// intersect the given rect.
//
// The provided Rect must intersect the bounds of this cell.
func (p *PaddedCell) ShrinkToFit(rect r2.Rect) CellID {
	// Quick rejection test: if rect contains the center of this cell along
	// either axis, then no further shrinking is possible.
	if p.level == 0 {
		// Fast path (most calls to this function start with a face cell).
		if rect.X.Contains(0) || rect.Y.Contains(0) {
			return p.id
		}
	}

	ijSize := sizeIJ(p.level)
	if rect.X.Contains(stToUV(siTiToST(uint32(2*p.iLo+ijSize)))) ||
		rect.Y.Contains(stToUV(siTiToST(uint32(2*p.jLo+ijSize)))) {
		return p.id
	}

	// Otherwise we expand rect by the given padding on all sides and find
	// the range of coordinates that it spans along the i- and j-axes. We then
	// compute the highest bit position at which the min and max coordinates
	// differ. This corresponds to the first cell level at which at least two
	// children intersect rect.

	// Increase the padding to compensate for the error in uvToST.
	// (The constant below is a provable upper bound on the additional error.)
	padded := rect.ExpandedByMargin(p.padding + 1.5*dblEpsilon)
	iMin, jMin := p.iLo, p.jLo // Min i- or j- coordinate spanned by padded
	var iXor, jXor int         // XOR of the min and max i- or j-coordinates

	if iMin < stToIJ(uvToST(padded.X.Lo)) {
		iMin = stToIJ(uvToST(padded.X.Lo))
	}
	if a, b := p.iLo+ijSize-1, stToIJ(uvToST(padded.X.Hi)); a <= b {
		iXor = iMin ^ a
	} else {
		iXor = iMin ^ b
	}

	if jMin < stToIJ(uvToST(padded.Y.Lo)) {
		jMin = stToIJ(uvToST(padded.Y.Lo))
	}
	if a, b := p.jLo+ijSize-1, stToIJ(uvToST(padded.Y.Hi)); a <= b {
		jXor = jMin ^ a
	} else {
		jXor = jMin ^ b
	}

	// Compute the highest bit position where the two i- or j-endpoints differ,
	// and then choose the cell level that includes both of these endpoints. So
	// if both pairs of endpoints are equal we choose MaxLevel; if they differ
	// only at bit 0, we choose (MaxLevel - 1), and so on.
	levelMSB := uint64(((iXor | jXor) << 1) + 1)
	level := MaxLevel - findMSBSetNonZero64(levelMSB)
	if level <= p.level {
		return p.id
	}

	return cellIDFromFaceIJ(p.id.Face(), iMin, jMin).Parent(level)
}
