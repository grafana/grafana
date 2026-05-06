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
	"bytes"
	"fmt"
	"io"
	"math"
	"sort"
	"strconv"
	"strings"

	"github.com/golang/geo/r1"
	"github.com/golang/geo/r2"
	"github.com/golang/geo/r3"
	"github.com/golang/geo/s1"
)

// CellID uniquely identifies a cell in the S2 cell decomposition.
// The most significant 3 bits encode the face number (0-5). The
// remaining 61 bits encode the position of the center of this cell
// along the Hilbert curve on that face. The zero value and the value
// (1<<64)-1 are invalid cell IDs. The first compares less than any
// valid cell ID, the second as greater than any valid cell ID.
//
// Sequentially increasing cell IDs follow a continuous space-filling curve
// over the entire sphere. They have the following properties:
//
//  - The ID of a cell at level k consists of a 3-bit face number followed
//    by k bit pairs that recursively select one of the four children of
//    each cell. The next bit is always 1, and all other bits are 0.
//    Therefore, the level of a cell is determined by the position of its
//    lowest-numbered bit that is turned on (for a cell at level k, this
//    position is 2 * (maxLevel - k)).
//
//  - The ID of a parent cell is at the midpoint of the range of IDs spanned
//    by its children (or by its descendants at any level).
//
// Leaf cells are often used to represent points on the unit sphere, and
// this type provides methods for converting directly between these two
// representations. For cells that represent 2D regions rather than
// discrete point, it is better to use Cells.
type CellID uint64

// SentinelCellID is an invalid cell ID guaranteed to be larger than any
// valid cell ID. It is used primarily by ShapeIndex. The value is also used
// by some S2 types when encoding data.
// Note that the sentinel's RangeMin == RangeMax == itself.
const SentinelCellID = CellID(^uint64(0))

// sortCellIDs sorts the slice of CellIDs in place.
func sortCellIDs(ci []CellID) {
	sort.Sort(cellIDs(ci))
}

// cellIDs implements the Sort interface for slices of CellIDs.
type cellIDs []CellID

func (c cellIDs) Len() int           { return len(c) }
func (c cellIDs) Swap(i, j int)      { c[i], c[j] = c[j], c[i] }
func (c cellIDs) Less(i, j int) bool { return c[i] < c[j] }

// TODO(dsymonds): Some of these constants should probably be exported.
const (
	faceBits = 3
	numFaces = 6

	// This is the number of levels needed to specify a leaf cell.
	maxLevel = 30

	// The extra position bit (61 rather than 60) lets us encode each cell as its
	// Hilbert curve position at the cell center (which is halfway along the
	// portion of the Hilbert curve that fills that cell).
	posBits = 2*maxLevel + 1

	// The maximum index of a valid leaf cell plus one. The range of valid leaf
	// cell indices is [0..maxSize-1].
	maxSize = 1 << maxLevel

	wrapOffset = uint64(numFaces) << posBits
)

// CellIDFromFacePosLevel returns a cell given its face in the range
// [0,5], the 61-bit Hilbert curve position pos within that face, and
// the level in the range [0,maxLevel]. The position in the cell ID
// will be truncated to correspond to the Hilbert curve position at
// the center of the returned cell.
func CellIDFromFacePosLevel(face int, pos uint64, level int) CellID {
	return CellID(uint64(face)<<posBits + pos | 1).Parent(level)
}

// CellIDFromFace returns the cell corresponding to a given S2 cube face.
func CellIDFromFace(face int) CellID {
	return CellID((uint64(face) << posBits) + lsbForLevel(0))
}

// CellIDFromLatLng returns the leaf cell containing ll.
func CellIDFromLatLng(ll LatLng) CellID {
	return cellIDFromPoint(PointFromLatLng(ll))
}

// CellIDFromToken returns a cell given a hex-encoded string of its uint64 ID.
func CellIDFromToken(s string) CellID {
	if len(s) > 16 {
		return CellID(0)
	}
	n, err := strconv.ParseUint(s, 16, 64)
	if err != nil {
		return CellID(0)
	}
	// Equivalent to right-padding string with zeros to 16 characters.
	if len(s) < 16 {
		n = n << (4 * uint(16-len(s)))
	}
	return CellID(n)
}

// ToToken returns a hex-encoded string of the uint64 cell id, with leading
// zeros included but trailing zeros stripped.
func (ci CellID) ToToken() string {
	s := strings.TrimRight(fmt.Sprintf("%016x", uint64(ci)), "0")
	if len(s) == 0 {
		return "X"
	}
	return s
}

// IsValid reports whether ci represents a valid cell.
func (ci CellID) IsValid() bool {
	return ci.Face() < numFaces && (ci.lsb()&0x1555555555555555 != 0)
}

// Face returns the cube face for this cell ID, in the range [0,5].
func (ci CellID) Face() int { return int(uint64(ci) >> posBits) }

// Pos returns the position along the Hilbert curve of this cell ID, in the range [0,2^posBits-1].
func (ci CellID) Pos() uint64 { return uint64(ci) & (^uint64(0) >> faceBits) }

// Level returns the subdivision level of this cell ID, in the range [0, maxLevel].
func (ci CellID) Level() int {
	return maxLevel - findLSBSetNonZero64(uint64(ci))>>1
}

// IsLeaf returns whether this cell ID is at the deepest level;
// that is, the level at which the cells are smallest.
func (ci CellID) IsLeaf() bool { return uint64(ci)&1 != 0 }

// ChildPosition returns the child position (0..3) of this cell's
// ancestor at the given level, relative to its parent.  The argument
// should be in the range 1..kMaxLevel.  For example,
// ChildPosition(1) returns the position of this cell's level-1
// ancestor within its top-level face cell.
func (ci CellID) ChildPosition(level int) int {
	return int(uint64(ci)>>uint64(2*(maxLevel-level)+1)) & 3
}

// lsbForLevel returns the lowest-numbered bit that is on for cells at the given level.
func lsbForLevel(level int) uint64 { return 1 << uint64(2*(maxLevel-level)) }

// Parent returns the cell at the given level, which must be no greater than the current level.
func (ci CellID) Parent(level int) CellID {
	lsb := lsbForLevel(level)
	return CellID((uint64(ci) & -lsb) | lsb)
}

// immediateParent is cheaper than Parent, but assumes !ci.isFace().
func (ci CellID) immediateParent() CellID {
	nlsb := CellID(ci.lsb() << 2)
	return (ci & -nlsb) | nlsb
}

// isFace returns whether this is a top-level (face) cell.
func (ci CellID) isFace() bool { return uint64(ci)&(lsbForLevel(0)-1) == 0 }

// lsb returns the least significant bit that is set.
func (ci CellID) lsb() uint64 { return uint64(ci) & -uint64(ci) }

// Children returns the four immediate children of this cell.
// If ci is a leaf cell, it returns four identical cells that are not the children.
func (ci CellID) Children() [4]CellID {
	var ch [4]CellID
	lsb := CellID(ci.lsb())
	ch[0] = ci - lsb + lsb>>2
	lsb >>= 1
	ch[1] = ch[0] + lsb
	ch[2] = ch[1] + lsb
	ch[3] = ch[2] + lsb
	return ch
}

func sizeIJ(level int) int {
	return 1 << uint(maxLevel-level)
}

// EdgeNeighbors returns the four cells that are adjacent across the cell's four edges.
// Edges 0, 1, 2, 3 are in the down, right, up, left directions in the face space.
// All neighbors are guaranteed to be distinct.
func (ci CellID) EdgeNeighbors() [4]CellID {
	level := ci.Level()
	size := sizeIJ(level)
	f, i, j, _ := ci.faceIJOrientation()
	return [4]CellID{
		cellIDFromFaceIJWrap(f, i, j-size).Parent(level),
		cellIDFromFaceIJWrap(f, i+size, j).Parent(level),
		cellIDFromFaceIJWrap(f, i, j+size).Parent(level),
		cellIDFromFaceIJWrap(f, i-size, j).Parent(level),
	}
}

// VertexNeighbors returns the neighboring cellIDs with vertex closest to this cell at the given level.
// (Normally there are four neighbors, but the closest vertex may only have three neighbors if it is one of
// the 8 cube vertices.)
func (ci CellID) VertexNeighbors(level int) []CellID {
	halfSize := sizeIJ(level + 1)
	size := halfSize << 1
	f, i, j, _ := ci.faceIJOrientation()

	var isame, jsame bool
	var ioffset, joffset int
	if i&halfSize != 0 {
		ioffset = size
		isame = (i + size) < maxSize
	} else {
		ioffset = -size
		isame = (i - size) >= 0
	}
	if j&halfSize != 0 {
		joffset = size
		jsame = (j + size) < maxSize
	} else {
		joffset = -size
		jsame = (j - size) >= 0
	}

	results := []CellID{
		ci.Parent(level),
		cellIDFromFaceIJSame(f, i+ioffset, j, isame).Parent(level),
		cellIDFromFaceIJSame(f, i, j+joffset, jsame).Parent(level),
	}

	if isame || jsame {
		results = append(results, cellIDFromFaceIJSame(f, i+ioffset, j+joffset, isame && jsame).Parent(level))
	}

	return results
}

// AllNeighbors returns all neighbors of this cell at the given level. Two
// cells X and Y are neighbors if their boundaries intersect but their
// interiors do not. In particular, two cells that intersect at a single
// point are neighbors. Note that for cells adjacent to a face vertex, the
// same neighbor may be returned more than once. There could be up to eight
// neighbors including the diagonal ones that share the vertex.
//
// This requires level >= ci.Level().
func (ci CellID) AllNeighbors(level int) []CellID {
	var neighbors []CellID

	face, i, j, _ := ci.faceIJOrientation()

	// Find the coordinates of the lower left-hand leaf cell. We need to
	// normalize (i,j) to a known position within the cell because level
	// may be larger than this cell's level.
	size := sizeIJ(ci.Level())
	i &= -size
	j &= -size

	nbrSize := sizeIJ(level)

	// We compute the top-bottom, left-right, and diagonal neighbors in one
	// pass. The loop test is at the end of the loop to avoid 32-bit overflow.
	for k := -nbrSize; ; k += nbrSize {
		var sameFace bool
		if k < 0 {
			sameFace = (j+k >= 0)
		} else if k >= size {
			sameFace = (j+k < maxSize)
		} else {
			sameFace = true
			// Top and bottom neighbors.
			neighbors = append(neighbors, cellIDFromFaceIJSame(face, i+k, j-nbrSize,
				j-size >= 0).Parent(level))
			neighbors = append(neighbors, cellIDFromFaceIJSame(face, i+k, j+size,
				j+size < maxSize).Parent(level))
		}

		// Left, right, and diagonal neighbors.
		neighbors = append(neighbors, cellIDFromFaceIJSame(face, i-nbrSize, j+k,
			sameFace && i-size >= 0).Parent(level))
		neighbors = append(neighbors, cellIDFromFaceIJSame(face, i+size, j+k,
			sameFace && i+size < maxSize).Parent(level))

		if k >= size {
			break
		}
	}

	return neighbors
}

// RangeMin returns the minimum CellID that is contained within this cell.
func (ci CellID) RangeMin() CellID { return CellID(uint64(ci) - (ci.lsb() - 1)) }

// RangeMax returns the maximum CellID that is contained within this cell.
func (ci CellID) RangeMax() CellID { return CellID(uint64(ci) + (ci.lsb() - 1)) }

// Contains returns true iff the CellID contains oci.
func (ci CellID) Contains(oci CellID) bool {
	return uint64(ci.RangeMin()) <= uint64(oci) && uint64(oci) <= uint64(ci.RangeMax())
}

// Intersects returns true iff the CellID intersects oci.
func (ci CellID) Intersects(oci CellID) bool {
	return uint64(oci.RangeMin()) <= uint64(ci.RangeMax()) && uint64(oci.RangeMax()) >= uint64(ci.RangeMin())
}

// String returns the string representation of the cell ID in the form "1/3210".
func (ci CellID) String() string {
	if !ci.IsValid() {
		return "Invalid: " + strconv.FormatInt(int64(ci), 16)
	}
	var b bytes.Buffer
	b.WriteByte("012345"[ci.Face()]) // values > 5 will have been picked off by !IsValid above
	b.WriteByte('/')
	for level := 1; level <= ci.Level(); level++ {
		b.WriteByte("0123"[ci.ChildPosition(level)])
	}
	return b.String()
}

// cellIDFromString returns a CellID from a string in the form "1/3210".
func cellIDFromString(s string) CellID {
	level := len(s) - 2
	if level < 0 || level > maxLevel {
		return CellID(0)
	}
	face := int(s[0] - '0')
	if face < 0 || face > 5 || s[1] != '/' {
		return CellID(0)
	}
	id := CellIDFromFace(face)
	for i := 2; i < len(s); i++ {
		childPos := s[i] - '0'
		if childPos < 0 || childPos > 3 {
			return CellID(0)
		}
		id = id.Children()[childPos]
	}
	return id
}

// Point returns the center of the s2 cell on the sphere as a Point.
// The maximum directional error in Point (compared to the exact
// mathematical result) is 1.5 * dblEpsilon radians, and the maximum length
// error is 2 * dblEpsilon (the same as Normalize).
func (ci CellID) Point() Point { return Point{ci.rawPoint().Normalize()} }

// LatLng returns the center of the s2 cell on the sphere as a LatLng.
func (ci CellID) LatLng() LatLng { return LatLngFromPoint(Point{ci.rawPoint()}) }

// ChildBegin returns the first child in a traversal of the children of this cell, in Hilbert curve order.
//
//    for ci := c.ChildBegin(); ci != c.ChildEnd(); ci = ci.Next() {
//        ...
//    }
func (ci CellID) ChildBegin() CellID {
	ol := ci.lsb()
	return CellID(uint64(ci) - ol + ol>>2)
}

// ChildBeginAtLevel returns the first cell in a traversal of children a given level deeper than this cell, in
// Hilbert curve order. The given level must be no smaller than the cell's level.
// See ChildBegin for example use.
func (ci CellID) ChildBeginAtLevel(level int) CellID {
	return CellID(uint64(ci) - ci.lsb() + lsbForLevel(level))
}

// ChildEnd returns the first cell after a traversal of the children of this cell in Hilbert curve order.
// The returned cell may be invalid.
func (ci CellID) ChildEnd() CellID {
	ol := ci.lsb()
	return CellID(uint64(ci) + ol + ol>>2)
}

// ChildEndAtLevel returns the first cell after the last child in a traversal of children a given level deeper
// than this cell, in Hilbert curve order.
// The given level must be no smaller than the cell's level.
// The returned cell may be invalid.
func (ci CellID) ChildEndAtLevel(level int) CellID {
	return CellID(uint64(ci) + ci.lsb() + lsbForLevel(level))
}

// Next returns the next cell along the Hilbert curve.
// This is expected to be used with ChildBegin and ChildEnd,
// or ChildBeginAtLevel and ChildEndAtLevel.
func (ci CellID) Next() CellID {
	return CellID(uint64(ci) + ci.lsb()<<1)
}

// Prev returns the previous cell along the Hilbert curve.
func (ci CellID) Prev() CellID {
	return CellID(uint64(ci) - ci.lsb()<<1)
}

// NextWrap returns the next cell along the Hilbert curve, wrapping from last to
// first as necessary. This should not be used with ChildBegin and ChildEnd.
func (ci CellID) NextWrap() CellID {
	n := ci.Next()
	if uint64(n) < wrapOffset {
		return n
	}
	return CellID(uint64(n) - wrapOffset)
}

// PrevWrap returns the previous cell along the Hilbert curve, wrapping around from
// first to last as necessary. This should not be used with ChildBegin and ChildEnd.
func (ci CellID) PrevWrap() CellID {
	p := ci.Prev()
	if uint64(p) < wrapOffset {
		return p
	}
	return CellID(uint64(p) + wrapOffset)
}

// AdvanceWrap advances or retreats the indicated number of steps along the
// Hilbert curve at the current level and returns the new position. The
// position wraps between the first and last faces as necessary.
func (ci CellID) AdvanceWrap(steps int64) CellID {
	if steps == 0 {
		return ci
	}

	// We clamp the number of steps if necessary to ensure that we do not
	// advance past the End() or before the Begin() of this level.
	shift := uint(2*(maxLevel-ci.Level()) + 1)
	if steps < 0 {
		if min := -int64(uint64(ci) >> shift); steps < min {
			wrap := int64(wrapOffset >> shift)
			steps %= wrap
			if steps < min {
				steps += wrap
			}
		}
	} else {
		// Unlike Advance(), we don't want to return End(level).
		if max := int64((wrapOffset - uint64(ci)) >> shift); steps > max {
			wrap := int64(wrapOffset >> shift)
			steps %= wrap
			if steps > max {
				steps -= wrap
			}
		}
	}

	// If steps is negative, then shifting it left has undefined behavior.
	// Cast to uint64 for a 2's complement answer.
	return CellID(uint64(ci) + (uint64(steps) << shift))
}

// Encode encodes the CellID.
func (ci CellID) Encode(w io.Writer) error {
	e := &encoder{w: w}
	ci.encode(e)
	return e.err
}

func (ci CellID) encode(e *encoder) {
	e.writeUint64(uint64(ci))
}

// Decode decodes the CellID.
func (ci *CellID) Decode(r io.Reader) error {
	d := &decoder{r: asByteReader(r)}
	ci.decode(d)
	return d.err
}

func (ci *CellID) decode(d *decoder) {
	*ci = CellID(d.readUint64())
}

// TODO: the methods below are not exported yet.  Settle on the entire API design
// before doing this.  Do we want to mirror the C++ one as closely as possible?

// distanceFromBegin returns the number of steps along the Hilbert curve that
// this cell is from the first node in the S2 hierarchy at our level. (i.e.,
// FromFace(0).ChildBeginAtLevel(ci.Level())). This is analogous to Pos(), but
// for this cell's level.
// The return value is always non-negative.
func (ci CellID) distanceFromBegin() int64 {
	return int64(ci >> uint64(2*(maxLevel-ci.Level())+1))
}

// rawPoint returns an unnormalized r3 vector from the origin through the center
// of the s2 cell on the sphere.
func (ci CellID) rawPoint() r3.Vector {
	face, si, ti := ci.faceSiTi()
	return faceUVToXYZ(face, stToUV((0.5/maxSize)*float64(si)), stToUV((0.5/maxSize)*float64(ti)))
}

// faceSiTi returns the Face/Si/Ti coordinates of the center of the cell.
func (ci CellID) faceSiTi() (face int, si, ti uint32) {
	face, i, j, _ := ci.faceIJOrientation()
	delta := 0
	if ci.IsLeaf() {
		delta = 1
	} else {
		if (i^(int(ci)>>2))&1 != 0 {
			delta = 2
		}
	}
	return face, uint32(2*i + delta), uint32(2*j + delta)
}

// faceIJOrientation uses the global lookupIJ table to unfiddle the bits of ci.
func (ci CellID) faceIJOrientation() (f, i, j, orientation int) {
	f = ci.Face()
	orientation = f & swapMask
	nbits := maxLevel - 7*lookupBits // first iteration

	// Each iteration maps 8 bits of the Hilbert curve position into
	// 4 bits of "i" and "j". The lookup table transforms a key of the
	// form "ppppppppoo" to a value of the form "iiiijjjjoo", where the
	// letters [ijpo] represents bits of "i", "j", the Hilbert curve
	// position, and the Hilbert curve orientation respectively.
	//
	// On the first iteration we need to be careful to clear out the bits
	// representing the cube face.
	for k := 7; k >= 0; k-- {
		orientation += (int(uint64(ci)>>uint64(k*2*lookupBits+1)) & ((1 << uint(2*nbits)) - 1)) << 2
		orientation = lookupIJ[orientation]
		i += (orientation >> (lookupBits + 2)) << uint(k*lookupBits)
		j += ((orientation >> 2) & ((1 << lookupBits) - 1)) << uint(k*lookupBits)
		orientation &= (swapMask | invertMask)
		nbits = lookupBits // following iterations
	}

	// The position of a non-leaf cell at level "n" consists of a prefix of
	// 2*n bits that identifies the cell, followed by a suffix of
	// 2*(maxLevel-n)+1 bits of the form 10*. If n==maxLevel, the suffix is
	// just "1" and has no effect. Otherwise, it consists of "10", followed
	// by (maxLevel-n-1) repetitions of "00", followed by "0". The "10" has
	// no effect, while each occurrence of "00" has the effect of reversing
	// the swapMask bit.
	if ci.lsb()&0x1111111111111110 != 0 {
		orientation ^= swapMask
	}

	return
}

// cellIDFromFaceIJ returns a leaf cell given its cube face (range 0..5) and IJ coordinates.
func cellIDFromFaceIJ(f, i, j int) CellID {
	// Note that this value gets shifted one bit to the left at the end
	// of the function.
	n := uint64(f) << (posBits - 1)
	// Alternating faces have opposite Hilbert curve orientations; this
	// is necessary in order for all faces to have a right-handed
	// coordinate system.
	bits := f & swapMask
	// Each iteration maps 4 bits of "i" and "j" into 8 bits of the Hilbert
	// curve position.  The lookup table transforms a 10-bit key of the form
	// "iiiijjjjoo" to a 10-bit value of the form "ppppppppoo", where the
	// letters [ijpo] denote bits of "i", "j", Hilbert curve position, and
	// Hilbert curve orientation respectively.
	for k := 7; k >= 0; k-- {
		mask := (1 << lookupBits) - 1
		bits += ((i >> uint(k*lookupBits)) & mask) << (lookupBits + 2)
		bits += ((j >> uint(k*lookupBits)) & mask) << 2
		bits = lookupPos[bits]
		n |= uint64(bits>>2) << (uint(k) * 2 * lookupBits)
		bits &= (swapMask | invertMask)
	}
	return CellID(n*2 + 1)
}

func cellIDFromFaceIJWrap(f, i, j int) CellID {
	// Convert i and j to the coordinates of a leaf cell just beyond the
	// boundary of this face.  This prevents 32-bit overflow in the case
	// of finding the neighbors of a face cell.
	i = clampInt(i, -1, maxSize)
	j = clampInt(j, -1, maxSize)

	// We want to wrap these coordinates onto the appropriate adjacent face.
	// The easiest way to do this is to convert the (i,j) coordinates to (x,y,z)
	// (which yields a point outside the normal face boundary), and then call
	// xyzToFaceUV to project back onto the correct face.
	//
	// The code below converts (i,j) to (si,ti), and then (si,ti) to (u,v) using
	// the linear projection (u=2*s-1 and v=2*t-1).  (The code further below
	// converts back using the inverse projection, s=0.5*(u+1) and t=0.5*(v+1).
	// Any projection would work here, so we use the simplest.)  We also clamp
	// the (u,v) coordinates so that the point is barely outside the
	// [-1,1]x[-1,1] face rectangle, since otherwise the reprojection step
	// (which divides by the new z coordinate) might change the other
	// coordinates enough so that we end up in the wrong leaf cell.
	const scale = 1.0 / maxSize
	limit := math.Nextafter(1, 2)
	u := math.Max(-limit, math.Min(limit, scale*float64((i<<1)+1-maxSize)))
	v := math.Max(-limit, math.Min(limit, scale*float64((j<<1)+1-maxSize)))

	// Find the leaf cell coordinates on the adjacent face, and convert
	// them to a cell id at the appropriate level.
	f, u, v = xyzToFaceUV(faceUVToXYZ(f, u, v))
	return cellIDFromFaceIJ(f, stToIJ(0.5*(u+1)), stToIJ(0.5*(v+1)))
}

func cellIDFromFaceIJSame(f, i, j int, sameFace bool) CellID {
	if sameFace {
		return cellIDFromFaceIJ(f, i, j)
	}
	return cellIDFromFaceIJWrap(f, i, j)
}

// ijToSTMin converts the i- or j-index of a leaf cell to the minimum corresponding
// s- or t-value contained by that cell. The argument must be in the range
// [0..2**30], i.e. up to one position beyond the normal range of valid leaf
// cell indices.
func ijToSTMin(i int) float64 {
	return float64(i) / float64(maxSize)
}

// stToIJ converts value in ST coordinates to a value in IJ coordinates.
func stToIJ(s float64) int {
	return clampInt(int(math.Floor(maxSize*s)), 0, maxSize-1)
}

// cellIDFromPoint returns a leaf cell containing point p. Usually there is
// exactly one such cell, but for points along the edge of a cell, any
// adjacent cell may be (deterministically) chosen. This is because
// s2.CellIDs are considered to be closed sets. The returned cell will
// always contain the given point, i.e.
//
//   CellFromPoint(p).ContainsPoint(p)
//
// is always true.
func cellIDFromPoint(p Point) CellID {
	f, u, v := xyzToFaceUV(r3.Vector{p.X, p.Y, p.Z})
	i := stToIJ(uvToST(u))
	j := stToIJ(uvToST(v))
	return cellIDFromFaceIJ(f, i, j)
}

// ijLevelToBoundUV returns the bounds in (u,v)-space for the cell at the given
// level containing the leaf cell with the given (i,j)-coordinates.
func ijLevelToBoundUV(i, j, level int) r2.Rect {
	cellSize := sizeIJ(level)
	xLo := i & -cellSize
	yLo := j & -cellSize

	return r2.Rect{
		X: r1.Interval{
			Lo: stToUV(ijToSTMin(xLo)),
			Hi: stToUV(ijToSTMin(xLo + cellSize)),
		},
		Y: r1.Interval{
			Lo: stToUV(ijToSTMin(yLo)),
			Hi: stToUV(ijToSTMin(yLo + cellSize)),
		},
	}
}

// Constants related to the bit mangling in the Cell ID.
const (
	lookupBits = 4
	swapMask   = 0x01
	invertMask = 0x02
)

// The following lookup tables are used to convert efficiently between an
// (i,j) cell index and the corresponding position along the Hilbert curve.
//
// lookupPos maps 4 bits of "i", 4 bits of "j", and 2 bits representing the
// orientation of the current cell into 8 bits representing the order in which
// that subcell is visited by the Hilbert curve, plus 2 bits indicating the
// new orientation of the Hilbert curve within that subcell. (Cell
// orientations are represented as combination of swapMask and invertMask.)
//
// lookupIJ is an inverted table used for mapping in the opposite
// direction.
//
// We also experimented with looking up 16 bits at a time (14 bits of position
// plus 2 of orientation) but found that smaller lookup tables gave better
// performance. (2KB fits easily in the primary cache.)
var (
	ijToPos = [4][4]int{
		{0, 1, 3, 2}, // canonical order
		{0, 3, 1, 2}, // axes swapped
		{2, 3, 1, 0}, // bits inverted
		{2, 1, 3, 0}, // swapped & inverted
	}
	posToIJ = [4][4]int{
		{0, 1, 3, 2}, // canonical order:    (0,0), (0,1), (1,1), (1,0)
		{0, 2, 3, 1}, // axes swapped:       (0,0), (1,0), (1,1), (0,1)
		{3, 2, 0, 1}, // bits inverted:      (1,1), (1,0), (0,0), (0,1)
		{3, 1, 0, 2}, // swapped & inverted: (1,1), (0,1), (0,0), (1,0)
	}
	posToOrientation = [4]int{swapMask, 0, 0, invertMask | swapMask}
	lookupIJ         [1 << (2*lookupBits + 2)]int
	lookupPos        [1 << (2*lookupBits + 2)]int
)

func init() {
	initLookupCell(0, 0, 0, 0, 0, 0)
	initLookupCell(0, 0, 0, swapMask, 0, swapMask)
	initLookupCell(0, 0, 0, invertMask, 0, invertMask)
	initLookupCell(0, 0, 0, swapMask|invertMask, 0, swapMask|invertMask)
}

// initLookupCell initializes the lookupIJ table at init time.
func initLookupCell(level, i, j, origOrientation, pos, orientation int) {
	if level == lookupBits {
		ij := (i << lookupBits) + j
		lookupPos[(ij<<2)+origOrientation] = (pos << 2) + orientation
		lookupIJ[(pos<<2)+origOrientation] = (ij << 2) + orientation
		return
	}

	level++
	i <<= 1
	j <<= 1
	pos <<= 2
	r := posToIJ[orientation]
	initLookupCell(level, i+(r[0]>>1), j+(r[0]&1), origOrientation, pos, orientation^posToOrientation[0])
	initLookupCell(level, i+(r[1]>>1), j+(r[1]&1), origOrientation, pos+1, orientation^posToOrientation[1])
	initLookupCell(level, i+(r[2]>>1), j+(r[2]&1), origOrientation, pos+2, orientation^posToOrientation[2])
	initLookupCell(level, i+(r[3]>>1), j+(r[3]&1), origOrientation, pos+3, orientation^posToOrientation[3])
}

// CommonAncestorLevel returns the level of the common ancestor of the two S2 CellIDs.
func (ci CellID) CommonAncestorLevel(other CellID) (level int, ok bool) {
	bits := uint64(ci ^ other)
	if bits < ci.lsb() {
		bits = ci.lsb()
	}
	if bits < other.lsb() {
		bits = other.lsb()
	}

	msbPos := findMSBSetNonZero64(bits)
	if msbPos > 60 {
		return 0, false
	}
	return (60 - msbPos) >> 1, true
}

// Advance advances or retreats the indicated number of steps along the
// Hilbert curve at the current level, and returns the new position. The
// position is never advanced past End() or before Begin().
func (ci CellID) Advance(steps int64) CellID {
	if steps == 0 {
		return ci
	}

	// We clamp the number of steps if necessary to ensure that we do not
	// advance past the End() or before the Begin() of this level. Note that
	// minSteps and maxSteps always fit in a signed 64-bit integer.
	stepShift := uint(2*(maxLevel-ci.Level()) + 1)
	if steps < 0 {
		minSteps := -int64(uint64(ci) >> stepShift)
		if steps < minSteps {
			steps = minSteps
		}
	} else {
		maxSteps := int64((wrapOffset + ci.lsb() - uint64(ci)) >> stepShift)
		if steps > maxSteps {
			steps = maxSteps
		}
	}
	return ci + CellID(steps)<<stepShift
}

// centerST return the center of the CellID in (s,t)-space.
func (ci CellID) centerST() r2.Point {
	_, si, ti := ci.faceSiTi()
	return r2.Point{siTiToST(si), siTiToST(ti)}
}

// sizeST returns the edge length of this CellID in (s,t)-space at the given level.
func (ci CellID) sizeST(level int) float64 {
	return ijToSTMin(sizeIJ(level))
}

// boundST returns the bound of this CellID in (s,t)-space.
func (ci CellID) boundST() r2.Rect {
	s := ci.sizeST(ci.Level())
	return r2.RectFromCenterSize(ci.centerST(), r2.Point{s, s})
}

// centerUV returns the center of this CellID in (u,v)-space. Note that
// the center of the cell is defined as the point at which it is recursively
// subdivided into four children; in general, it is not at the midpoint of
// the (u,v) rectangle covered by the cell.
func (ci CellID) centerUV() r2.Point {
	_, si, ti := ci.faceSiTi()
	return r2.Point{stToUV(siTiToST(si)), stToUV(siTiToST(ti))}
}

// boundUV returns the bound of this CellID in (u,v)-space.
func (ci CellID) boundUV() r2.Rect {
	_, i, j, _ := ci.faceIJOrientation()
	return ijLevelToBoundUV(i, j, ci.Level())
}

// expandEndpoint returns a new u-coordinate u' such that the distance from the
// line u=u' to the given edge (u,v0)-(u,v1) is exactly the given distance
// (which is specified as the sine of the angle corresponding to the distance).
func expandEndpoint(u, maxV, sinDist float64) float64 {
	// This is based on solving a spherical right triangle, similar to the
	// calculation in Cap.RectBound.
	// Given an edge of the form (u,v0)-(u,v1), let maxV = max(abs(v0), abs(v1)).
	sinUShift := sinDist * math.Sqrt((1+u*u+maxV*maxV)/(1+u*u))
	cosUShift := math.Sqrt(1 - sinUShift*sinUShift)
	// The following is an expansion of tan(atan(u) + asin(sinUShift)).
	return (cosUShift*u + sinUShift) / (cosUShift - sinUShift*u)
}

// expandedByDistanceUV returns a rectangle expanded in (u,v)-space so that it
// contains all points within the given distance of the boundary, and return the
// smallest such rectangle. If the distance is negative, then instead shrink this
// rectangle so that it excludes all points within the given absolute distance
// of the boundary.
//
// Distances are measured *on the sphere*, not in (u,v)-space. For example,
// you can use this method to expand the (u,v)-bound of an CellID so that
// it contains all points within 5km of the original cell. You can then
// test whether a point lies within the expanded bounds like this:
//
//   if u, v, ok := faceXYZtoUV(face, point); ok && bound.ContainsPoint(r2.Point{u,v}) { ... }
//
// Limitations:
//
//  - Because the rectangle is drawn on one of the six cube-face planes
//    (i.e., {x,y,z} = +/-1), it can cover at most one hemisphere. This
//    limits the maximum amount that a rectangle can be expanded. For
//    example, CellID bounds can be expanded safely by at most 45 degrees
//    (about 5000 km on the Earth's surface).
//
//  - The implementation is not exact for negative distances. The resulting
//    rectangle will exclude all points within the given distance of the
//    boundary but may be slightly smaller than necessary.
func expandedByDistanceUV(uv r2.Rect, distance s1.Angle) r2.Rect {
	// Expand each of the four sides of the rectangle just enough to include all
	// points within the given distance of that side. (The rectangle may be
	// expanded by a different amount in (u,v)-space on each side.)
	maxU := math.Max(math.Abs(uv.X.Lo), math.Abs(uv.X.Hi))
	maxV := math.Max(math.Abs(uv.Y.Lo), math.Abs(uv.Y.Hi))
	sinDist := math.Sin(float64(distance))
	return r2.Rect{
		X: r1.Interval{expandEndpoint(uv.X.Lo, maxV, -sinDist),
			expandEndpoint(uv.X.Hi, maxV, sinDist)},
		Y: r1.Interval{expandEndpoint(uv.Y.Lo, maxU, -sinDist),
			expandEndpoint(uv.Y.Hi, maxU, sinDist)}}
}

// MaxTile returns the largest cell with the same RangeMin such that
// RangeMax < limit.RangeMin. It returns limit if no such cell exists.
// This method can be used to generate a small set of CellIDs that covers
// a given range (a tiling). This example shows how to generate a tiling
// for a semi-open range of leaf cells [start, limit):
//
//   for id := start.MaxTile(limit); id != limit; id = id.Next().MaxTile(limit)) { ... }
//
// Note that in general the cells in the tiling will be of different sizes;
// they gradually get larger (near the middle of the range) and then
// gradually get smaller as limit is approached.
func (ci CellID) MaxTile(limit CellID) CellID {
	start := ci.RangeMin()
	if start >= limit.RangeMin() {
		return limit
	}

	if ci.RangeMax() >= limit {
		// The cell is too large, shrink it. Note that when generating coverings
		// of CellID ranges, this loop usually executes only once. Also because
		// ci.RangeMin() < limit.RangeMin(), we will always exit the loop by the
		// time we reach a leaf cell.
		for {
			ci = ci.Children()[0]
			if ci.RangeMax() < limit {
				break
			}
		}
		return ci
	}

	// The cell may be too small. Grow it if necessary. Note that generally
	// this loop only iterates once.
	for !ci.isFace() {
		parent := ci.immediateParent()
		if parent.RangeMin() != start || parent.RangeMax() >= limit {
			break
		}
		ci = parent
	}
	return ci
}

// centerFaceSiTi returns the (face, si, ti) coordinates of the center of the cell.
// Note that although (si,ti) coordinates span the range [0,2**31] in general,
// the cell center coordinates are always in the range [1,2**31-1] and
// therefore can be represented using a signed 32-bit integer.
func (ci CellID) centerFaceSiTi() (face, si, ti int) {
	// First we compute the discrete (i,j) coordinates of a leaf cell contained
	// within the given cell. Given that cells are represented by the Hilbert
	// curve position corresponding at their center, it turns out that the cell
	// returned by faceIJOrientation is always one of two leaf cells closest
	// to the center of the cell (unless the given cell is a leaf cell itself,
	// in which case there is only one possibility).
	//
	// Given a cell of size s >= 2 (i.e. not a leaf cell), and letting (imin,
	// jmin) be the coordinates of its lower left-hand corner, the leaf cell
	// returned by faceIJOrientation is either (imin + s/2, jmin + s/2)
	// (imin + s/2 - 1, jmin + s/2 - 1). The first case is the one we want.
	// We can distinguish these two cases by looking at the low bit of i or
	// j. In the second case the low bit is one, unless s == 2 (i.e. the
	// level just above leaf cells) in which case the low bit is zero.
	//
	// In the code below, the expression ((i ^ (int(id) >> 2)) & 1) is true
	// if we are in the second case described above.
	face, i, j, _ := ci.faceIJOrientation()
	delta := 0
	if ci.IsLeaf() {
		delta = 1
	} else if (int64(i)^(int64(ci)>>2))&1 == 1 {
		delta = 2
	}

	// Note that (2 * {i,j} + delta) will never overflow a 32-bit integer.
	return face, 2*i + delta, 2*j + delta
}
