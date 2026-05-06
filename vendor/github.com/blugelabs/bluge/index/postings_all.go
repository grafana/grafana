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
	"fmt"

	segment "github.com/blugelabs/bluge_segment_api"

	"github.com/RoaringBitmap/roaring"
)

type postingsIteratorAll struct {
	snapshot      *Snapshot
	iterators     []roaring.IntPeekable
	segmentOffset int

	preAlloc virtualPosting
}

func (i *postingsIteratorAll) Size() int {
	return reflectStaticSizeIndexSnapshotDocIDReader + sizeOfPtr
}

func (i *postingsIteratorAll) Next() (segment.Posting, error) {
	for i.segmentOffset < len(i.iterators) {
		if !i.iterators[i.segmentOffset].HasNext() {
			i.segmentOffset++
			continue
		}
		next := i.iterators[i.segmentOffset].Next()
		// make segment number into global number by adding offset
		globalOffset := i.snapshot.offsets[i.segmentOffset]
		i.preAlloc.number = uint64(next) + globalOffset
		return &i.preAlloc, nil
	}
	return nil, nil
}

func (i *postingsIteratorAll) Advance(number uint64) (segment.Posting, error) {
	segIndex, localDocNum := i.snapshot.segmentIndexAndLocalDocNumFromGlobal(number)
	if segIndex >= len(i.snapshot.segment) {
		return nil, fmt.Errorf("computed segment index %d out of bounds %d",
			segIndex, len(i.snapshot.segment))
	}
	// skip directly to the target segment
	i.segmentOffset = segIndex

	// now advance within this segment
	i.iterators[i.segmentOffset].AdvanceIfNeeded(uint32(localDocNum))

	// let next do the rest of the work for us
	return i.Next()
}

func (i *postingsIteratorAll) Count() uint64 {
	rv, _ := i.snapshot.Count()
	return rv
}

func (i *postingsIteratorAll) Close() error {
	return nil
}

func (i *postingsIteratorAll) Empty() bool {
	return i.Count() == 0
}

type virtualPosting struct {
	term   string
	number uint64
}

func (v *virtualPosting) Term() string {
	return v.term
}

func (v *virtualPosting) Number() uint64 {
	return v.number
}

func (v *virtualPosting) SetNumber(n uint64) {
	v.number = n
}

func (v *virtualPosting) Frequency() int {
	return 1
}

func (v *virtualPosting) Norm() float64 {
	return 1
}

func (v *virtualPosting) Locations() []segment.Location {
	return nil
}

func (v *virtualPosting) Size() int {
	return 0
}
