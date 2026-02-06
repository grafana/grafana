//  Copyright (c) 2023 Couchbase, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// 		http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

//go:build vectors
// +build vectors

package zap

import (
	"encoding/binary"
	"math"
	"reflect"

	"github.com/RoaringBitmap/roaring/v2"
	"github.com/RoaringBitmap/roaring/v2/roaring64"
	segment "github.com/blevesearch/scorch_segment_api/v2"
)

var reflectStaticSizeVecPostingsList int
var reflectStaticSizeVecPostingsIterator int
var reflectStaticSizeVecPosting int

func init() {
	var pl VecPostingsList
	reflectStaticSizeVecPostingsList = int(reflect.TypeOf(pl).Size())
	var pi VecPostingsIterator
	reflectStaticSizeVecPostingsIterator = int(reflect.TypeOf(pi).Size())
	var p VecPosting
	reflectStaticSizeVecPosting = int(reflect.TypeOf(p).Size())
}

type VecPosting struct {
	docNum uint64
	score  float32
}

func (vp *VecPosting) Number() uint64 {
	return vp.docNum
}

func (vp *VecPosting) Score() float32 {
	return vp.score
}

func (vp *VecPosting) Size() int {
	sizeInBytes := reflectStaticSizePosting

	return sizeInBytes
}

// =============================================================================

// the vector postings list is supposed to store the docNum and its similarity
// score as a vector postings entry in it.
// The way in which is it stored is using a roaring64 bitmap.
// the docNum is stored in high 32 and the lower 32 bits contains the score value.
// the score is actually a float32 value and in order to store it as a uint32 in
// the bitmap, we use the IEEE 754 floating point format.
//
// each entry in the roaring64 bitmap of the vector postings list is a 64 bit
// number which looks like this:
// MSB                         LSB
// |64 63 62 ... 32| 31 30 ... 0|
// |    <docNum>   |   <score>  |
type VecPostingsList struct {
	// todo: perhaps we don't even need to store a bitmap if there is only
	// one similar vector the query, but rather store it as a field value
	// in the struct
	except   *roaring64.Bitmap
	postings *roaring64.Bitmap
}

var emptyVecPostingsIterator = &VecPostingsIterator{}
var emptyVecPostingsList = &VecPostingsList{}

func (vpl *VecPostingsList) Iterator(prealloc segment.VecPostingsIterator) segment.VecPostingsIterator {
	if vpl.postings == nil {
		return emptyVecPostingsIterator
	}
	// tbd: do we check the cardinality of postings and scores?
	var preallocPI *VecPostingsIterator
	pi, ok := prealloc.(*VecPostingsIterator)
	if ok && pi != nil {
		preallocPI = pi
	}
	if preallocPI == emptyVecPostingsIterator {
		preallocPI = nil
	}

	return vpl.iterator(preallocPI)
}

func (vpl *VecPostingsList) iterator(rv *VecPostingsIterator) *VecPostingsIterator {
	if rv == nil {
		rv = &VecPostingsIterator{}
	} else {
		*rv = VecPostingsIterator{} // clear the struct
	}
	// think on some of the edge cases over here.
	if vpl.postings == nil {
		return rv
	}
	rv.postings = vpl
	rv.all = vpl.postings.Iterator()
	if vpl.except != nil {
		rv.ActualBM = roaring64.AndNot(vpl.postings, vpl.except)
		rv.Actual = rv.ActualBM.Iterator()
	} else {
		rv.ActualBM = vpl.postings
		rv.Actual = rv.all // Optimize to use same iterator for all & Actual.
	}
	return rv
}

func (vpl *VecPostingsList) Size() int {
	sizeInBytes := reflectStaticSizeVecPostingsList + SizeOfPtr

	if vpl.except != nil {
		sizeInBytes += int(vpl.except.GetSizeInBytes())
	}

	return sizeInBytes
}

func (vpl *VecPostingsList) Count() uint64 {
	if vpl.postings != nil {
		n := vpl.postings.GetCardinality()
		var e uint64
		if vpl.except != nil {
			e = vpl.postings.AndCardinality(vpl.except)
		}
		return n - e
	}
	return 0
}

func (vpl *VecPostingsList) ResetBytesRead(val uint64) {

}

func (vpl *VecPostingsList) BytesRead() uint64 {
	return 0
}

func (vpl *VecPostingsList) BytesWritten() uint64 {
	return 0
}

// =============================================================================

type VecPostingsIterator struct {
	postings *VecPostingsList
	all      roaring64.IntPeekable64
	Actual   roaring64.IntPeekable64
	ActualBM *roaring64.Bitmap

	next VecPosting // reused across Next() calls
}

func (vpItr *VecPostingsIterator) nextCodeAtOrAfterClean(atOrAfter uint64) (uint64, bool, error) {
	vpItr.Actual.AdvanceIfNeeded(atOrAfter)

	if !vpItr.Actual.HasNext() {
		return 0, false, nil // couldn't find anything
	}

	return vpItr.Actual.Next(), true, nil
}

func (vpItr *VecPostingsIterator) nextCodeAtOrAfter(atOrAfter uint64) (uint64, bool, error) {
	if vpItr.Actual == nil || !vpItr.Actual.HasNext() {
		return 0, false, nil
	}

	if vpItr.postings == nil || vpItr.postings == emptyVecPostingsList {
		// couldn't find anything
		return 0, false, nil
	}

	if vpItr.postings.postings == vpItr.ActualBM {
		return vpItr.nextCodeAtOrAfterClean(atOrAfter)
	}

	vpItr.Actual.AdvanceIfNeeded(atOrAfter)

	if !vpItr.Actual.HasNext() || !vpItr.all.HasNext() {
		// couldn't find anything
		return 0, false, nil
	}

	n := vpItr.Actual.Next()
	allN := vpItr.all.Next()

	// n is the next actual hit (excluding some postings), and
	// allN is the next hit in the full postings, and
	// if they don't match, move 'all' forwards until they do.
	for allN != n {
		if !vpItr.all.HasNext() {
			return 0, false, nil
		}
		allN = vpItr.all.Next()
	}

	return n, true, nil
}

// a transformation function which stores both the score and the docNum as a single
// entry which is a uint64 number.
func getVectorCode(docNum uint32, score float32) uint64 {
	return uint64(docNum)<<32 | uint64(math.Float32bits(score))
}

// Next returns the next posting on the vector postings list, or nil at the end
func (vpItr *VecPostingsIterator) nextAtOrAfter(atOrAfter uint64) (segment.VecPosting, error) {
	// transform the docNum provided to the vector code format and use that to
	// get the next entry. the comparison still happens docNum wise since after
	// the transformation, the docNum occupies the upper 32 bits just an entry in
	// the postings list
	atOrAfter = getVectorCode(uint32(atOrAfter), 0)
	code, exists, err := vpItr.nextCodeAtOrAfter(atOrAfter)
	if err != nil || !exists {
		return nil, err
	}

	vpItr.next = VecPosting{} // clear the struct
	rv := &vpItr.next
	rv.score = math.Float32frombits(uint32(code))
	rv.docNum = code >> 32

	return rv, nil
}

func (vpItr *VecPostingsIterator) Next() (segment.VecPosting, error) {
	return vpItr.nextAtOrAfter(0)
}

func (vpItr *VecPostingsIterator) Advance(docNum uint64) (segment.VecPosting, error) {
	return vpItr.nextAtOrAfter(docNum)
}

func (vpItr *VecPostingsIterator) Size() int {
	sizeInBytes := reflectStaticSizePostingsIterator + SizeOfPtr +
		vpItr.next.Size()

	return sizeInBytes
}

func (vpItr *VecPostingsIterator) ResetBytesRead(val uint64) {

}

func (vpItr *VecPostingsIterator) BytesRead() uint64 {
	return 0
}

func (vpItr *VecPostingsIterator) BytesWritten() uint64 {
	return 0
}

// InterpretVectorIndex returns a struct based implementation (vectorIndexWrapper)
// that will allow the caller to -
// (1) search within an attached vector index
// (2) search limited to a subset of documents within an attached vector index
// (3) close attached vector index
// (4) get the size of the attached vector index
func (sb *SegmentBase) InterpretVectorIndex(field string, requiresFiltering bool,
	except *roaring.Bitmap) (
	segment.VectorIndex, error) {

	rv := &vectorIndexWrapper{sb: sb}
	fieldIDPlus1 := sb.fieldsMap[field]
	if fieldIDPlus1 <= 0 {
		return rv, nil
	}
	rv.fieldIDPlus1 = fieldIDPlus1

	vectorSection := sb.fieldsSectionsMap[fieldIDPlus1-1][SectionFaissVectorIndex]
	// check if the field has a vector section in the segment.
	if vectorSection <= 0 {
		return rv, nil
	}

	pos := int(vectorSection)

	// the below loop loads the following:
	// 1. doc values(first 2 iterations) - adhering to the sections format. never
	// valid values for vector section
	// 2. index optimization type.
	for i := 0; i < 3; i++ {
		_, n := binary.Uvarint(sb.mem[pos : pos+binary.MaxVarintLen64])
		pos += n
	}

	var err error
	rv.vecIndex, rv.vecDocIDMap, rv.docVecIDMap, rv.vectorIDsToExclude, err =
		sb.vecIndexCache.loadOrCreate(fieldIDPlus1, sb.mem[pos:], requiresFiltering,
			except)
	if err != nil {
		return nil, err
	}

	if rv.vecIndex != nil {
		rv.vecIndexSize = rv.vecIndex.Size()
	}

	return rv, nil
}

func (sb *SegmentBase) UpdateFieldStats(stats segment.FieldStats) {
	for _, fieldName := range sb.fieldsInv {
		pos := int(sb.fieldsSectionsMap[sb.fieldsMap[fieldName]-1][SectionFaissVectorIndex])
		if pos == 0 {
			continue
		}

		for i := 0; i < 3; i++ {
			_, n := binary.Uvarint(sb.mem[pos : pos+binary.MaxVarintLen64])
			pos += n
		}
		numVecs, _ := binary.Uvarint(sb.mem[pos : pos+binary.MaxVarintLen64])

		stats.Store("num_vectors", fieldName, numVecs)
	}
}
