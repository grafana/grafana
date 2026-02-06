//  Copyright (c) 2020 Couchbase, Inc.
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

package scorch

import (
	"math"
	"reflect"

	"github.com/RoaringBitmap/roaring/v2"
	segment "github.com/blevesearch/scorch_segment_api/v2"
)

var reflectStaticSizeUnadornedPostingsIteratorBitmap int
var reflectStaticSizeUnadornedPostingsIterator1Hit int
var reflectStaticSizeUnadornedPosting int

func init() {
	var pib unadornedPostingsIteratorBitmap
	reflectStaticSizeUnadornedPostingsIteratorBitmap = int(reflect.TypeOf(pib).Size())
	var pi1h unadornedPostingsIterator1Hit
	reflectStaticSizeUnadornedPostingsIterator1Hit = int(reflect.TypeOf(pi1h).Size())
	var up UnadornedPosting
	reflectStaticSizeUnadornedPosting = int(reflect.TypeOf(up).Size())
}

type unadornedPostingsIteratorBitmap struct {
	actual   roaring.IntPeekable
	actualBM *roaring.Bitmap
}

func (i *unadornedPostingsIteratorBitmap) Next() (segment.Posting, error) {
	return i.nextAtOrAfter(0)
}

func (i *unadornedPostingsIteratorBitmap) Advance(docNum uint64) (segment.Posting, error) {
	return i.nextAtOrAfter(docNum)
}

func (i *unadornedPostingsIteratorBitmap) nextAtOrAfter(atOrAfter uint64) (segment.Posting, error) {
	docNum, exists := i.nextDocNumAtOrAfter(atOrAfter)
	if !exists {
		return nil, nil
	}
	return UnadornedPosting(docNum), nil
}

func (i *unadornedPostingsIteratorBitmap) nextDocNumAtOrAfter(atOrAfter uint64) (uint64, bool) {
	if i.actual == nil || !i.actual.HasNext() {
		return 0, false
	}
	i.actual.AdvanceIfNeeded(uint32(atOrAfter))

	if !i.actual.HasNext() {
		return 0, false // couldn't find anything
	}

	return uint64(i.actual.Next()), true
}

func (i *unadornedPostingsIteratorBitmap) Size() int {
	return reflectStaticSizeUnadornedPostingsIteratorBitmap
}

func (i *unadornedPostingsIteratorBitmap) BytesRead() uint64 {
	return 0
}

func (i *unadornedPostingsIteratorBitmap) BytesWritten() uint64 {
	return 0
}

func (i *unadornedPostingsIteratorBitmap) ResetBytesRead(uint64) {}

func (i *unadornedPostingsIteratorBitmap) ActualBitmap() *roaring.Bitmap {
	return i.actualBM
}

func (i *unadornedPostingsIteratorBitmap) DocNum1Hit() (uint64, bool) {
	return 0, false
}

func (i *unadornedPostingsIteratorBitmap) ReplaceActual(actual *roaring.Bitmap) {
	i.actualBM = actual
	i.actual = actual.Iterator()
}

// Resets the iterator to the beginning of the postings list.
// by resetting the actual iterator.
func (i *unadornedPostingsIteratorBitmap) ResetIterator() {
	i.actual = i.actualBM.Iterator()
}

func newUnadornedPostingsIteratorFromBitmap(bm *roaring.Bitmap) segment.PostingsIterator {
	return &unadornedPostingsIteratorBitmap{
		actualBM: bm,
		actual:   bm.Iterator(),
	}
}

const docNum1HitFinished = math.MaxUint64

type unadornedPostingsIterator1Hit struct {
	docNumOrig uint64 // original 1-hit docNum used to create this iterator
	docNum     uint64 // current docNum
}

func (i *unadornedPostingsIterator1Hit) Next() (segment.Posting, error) {
	return i.nextAtOrAfter(0)
}

func (i *unadornedPostingsIterator1Hit) Advance(docNum uint64) (segment.Posting, error) {
	return i.nextAtOrAfter(docNum)
}

func (i *unadornedPostingsIterator1Hit) nextAtOrAfter(atOrAfter uint64) (segment.Posting, error) {
	docNum, exists := i.nextDocNumAtOrAfter(atOrAfter)
	if !exists {
		return nil, nil
	}
	return UnadornedPosting(docNum), nil
}

func (i *unadornedPostingsIterator1Hit) nextDocNumAtOrAfter(atOrAfter uint64) (uint64, bool) {
	if i.docNum == docNum1HitFinished {
		return 0, false
	}
	if i.docNum < atOrAfter {
		// advanced past our 1-hit
		i.docNum = docNum1HitFinished // consume our 1-hit docNum
		return 0, false
	}
	docNum := i.docNum
	i.docNum = docNum1HitFinished // consume our 1-hit docNum
	return docNum, true
}

func (i *unadornedPostingsIterator1Hit) Size() int {
	return reflectStaticSizeUnadornedPostingsIterator1Hit
}

func (i *unadornedPostingsIterator1Hit) BytesRead() uint64 {
	return 0
}

func (i *unadornedPostingsIterator1Hit) BytesWritten() uint64 {
	return 0
}

func (i *unadornedPostingsIterator1Hit) ResetBytesRead(uint64) {}

// ResetIterator resets the iterator to the original state.
func (i *unadornedPostingsIterator1Hit) ResetIterator() {
	i.docNum = i.docNumOrig
}

func newUnadornedPostingsIteratorFrom1Hit(docNum1Hit uint64) segment.PostingsIterator {
	return &unadornedPostingsIterator1Hit{
		docNumOrig: docNum1Hit,
		docNum:     docNum1Hit,
	}
}

type ResetablePostingsIterator interface {
	ResetIterator()
}

type UnadornedPosting uint64

func (p UnadornedPosting) Number() uint64 {
	return uint64(p)
}

func (p UnadornedPosting) Frequency() uint64 {
	return 0
}

func (p UnadornedPosting) Norm() float64 {
	return 0
}

func (p UnadornedPosting) Locations() []segment.Location {
	return nil
}

func (p UnadornedPosting) Size() int {
	return reflectStaticSizeUnadornedPosting
}
