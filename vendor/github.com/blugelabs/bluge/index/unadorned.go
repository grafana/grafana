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

package index

import (
	"math"

	"github.com/RoaringBitmap/roaring"
	segment "github.com/blugelabs/bluge_segment_api"
)

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
	up := unadornedPosting(docNum)
	return &up, nil
}

func (i *unadornedPostingsIteratorBitmap) nextDocNumAtOrAfter(atOrAfter uint64) (int, bool) {
	if i.actual == nil || !i.actual.HasNext() {
		return 0, false
	}
	i.actual.AdvanceIfNeeded(uint32(atOrAfter))

	if !i.actual.HasNext() {
		return 0, false // couldn't find anything
	}

	return int(i.actual.Next()), true
}

func (i *unadornedPostingsIteratorBitmap) Size() int {
	return reflectStaticSizeUnadornedPostingsIteratorBitmap
}

func (i *unadornedPostingsIteratorBitmap) Empty() bool {
	return false
}

func (i *unadornedPostingsIteratorBitmap) Count() uint64 {
	return i.actualBM.GetCardinality()
}

func (i *unadornedPostingsIteratorBitmap) Close() error {
	return nil
}

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

func newUnadornedPostingsIteratorFromBitmap(bm *roaring.Bitmap) segment.PostingsIterator {
	return &unadornedPostingsIteratorBitmap{
		actualBM: bm,
		actual:   bm.Iterator(),
	}
}

const docNum1HitFinished = math.MaxUint64

type unadornedPostingsIterator1Hit struct {
	docNum uint64
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
	up := unadornedPosting(docNum)
	return &up, nil
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

func (i *unadornedPostingsIterator1Hit) Empty() bool {
	return false
}

func (i *unadornedPostingsIterator1Hit) Count() uint64 {
	return 1
}

func (i *unadornedPostingsIterator1Hit) Close() error {
	return nil
}

func newUnadornedPostingsIteratorFrom1Hit(docNum1Hit uint64) segment.PostingsIterator {
	return &unadornedPostingsIterator1Hit{
		docNum1Hit,
	}
}

type unadornedPosting uint64

func (p *unadornedPosting) Number() uint64 {
	return uint64(*p)
}

func (p *unadornedPosting) SetNumber(n uint64) {
	*p = unadornedPosting(n)
}

func (p *unadornedPosting) Frequency() int {
	return 0
}

func (p *unadornedPosting) Norm() float64 {
	return 0
}

func (p *unadornedPosting) Locations() []segment.Location {
	return nil
}

func (p *unadornedPosting) Size() int {
	return reflectStaticSizeUnadornedPosting
}
