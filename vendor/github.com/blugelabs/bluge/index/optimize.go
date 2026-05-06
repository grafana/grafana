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
	"sync/atomic"

	"github.com/RoaringBitmap/roaring"
	segment "github.com/blugelabs/bluge_segment_api"
)

func (i *postingsIterator) Optimize(kind string,
	octx segment.OptimizableContext) (segment.OptimizableContext, error) {
	if i.snapshot.parent.config.OptimizeConjunction && kind == "conjunction" {
		return i.optimizeConjunction(octx)
	}

	if i.snapshot.parent.config.OptimizeConjunctionUnadorned && kind == "conjunction:unadorned" {
		return i.optimizeConjunctionUnadorned(octx)
	}

	if i.snapshot.parent.config.OptimizeDisjunctionUnadorned && kind == "disjunction:unadorned" {
		return i.optimizeDisjunctionUnadorned(octx)
	}

	return nil, nil
}

// ----------------------------------------------------------------

func (i *postingsIterator) optimizeConjunction(
	octx segment.OptimizableContext) (segment.OptimizableContext, error) {
	if octx == nil {
		octx = &optimizeConjunction{snapshot: i.snapshot}
	}

	o, ok := octx.(*optimizeConjunction)
	if !ok {
		return octx, nil
	}

	if o.snapshot != i.snapshot {
		return nil, fmt.Errorf("tried to optimize conjunction across different snapshots")
	}

	o.tfrs = append(o.tfrs, i)

	return o, nil
}

type optimizeConjunction struct {
	snapshot *Snapshot

	tfrs []*postingsIterator
}

func (o *optimizeConjunction) Finish() (segment.PostingsIterator, error) {
	if len(o.tfrs) <= 1 {
		return nil, nil
	}

	for i := range o.snapshot.segment {
		itr0, ok := o.tfrs[0].iterators[i].(segment.OptimizablePostingsIterator)
		if !ok || itr0.ActualBitmap() == nil {
			continue
		}

		itr1, ok := o.tfrs[1].iterators[i].(segment.OptimizablePostingsIterator)
		if !ok || itr1.ActualBitmap() == nil {
			continue
		}

		bm := roaring.And(itr0.ActualBitmap(), itr1.ActualBitmap())

		for _, tfr := range o.tfrs[2:] {
			itr, ok := tfr.iterators[i].(segment.OptimizablePostingsIterator)
			if !ok || itr.ActualBitmap() == nil {
				continue
			}

			bm.And(itr.ActualBitmap())
		}

		// in this conjunction optimization, the postings iterators
		// will all share the same AND'ed together actual bitmap.  The
		// regular conjunction searcher machinery will still be used,
		// but the underlying bitmap will be smaller.
		for _, tfr := range o.tfrs {
			itr, ok := tfr.iterators[i].(segment.OptimizablePostingsIterator)
			if ok && itr.ActualBitmap() != nil {
				itr.ReplaceActual(bm)
			}
		}
	}

	return nil, nil
}

// ----------------------------------------------------------------

// An "unadorned" conjunction optimization is appropriate when
// additional or subsidiary information like freq-norm's and
// term-vectors are not required, and instead only the internal-id's
// are needed.
func (i *postingsIterator) optimizeConjunctionUnadorned(
	octx segment.OptimizableContext) (segment.OptimizableContext, error) {
	if octx == nil {
		octx = &optimizeConjunctionUnadorned{snapshot: i.snapshot}
	}

	o, ok := octx.(*optimizeConjunctionUnadorned)
	if !ok {
		return nil, nil
	}

	if o.snapshot != i.snapshot {
		return nil, fmt.Errorf("tried to optimize unadorned conjunction across different snapshots")
	}

	o.tfrs = append(o.tfrs, i)

	return o, nil
}

type optimizeConjunctionUnadorned struct {
	snapshot *Snapshot

	tfrs []*postingsIterator
}

var optimizeConjunctionUnadornedTerm = []byte("<conjunction:unadorned>")

const optimizeConjunctionUnadornedField = "*"

// Finish of an unadorned conjunction optimization will compute a
// termFieldReader with an "actual" bitmap that represents the
// constituent bitmaps AND'ed together.  This termFieldReader cannot
// provide any freq-norm or termVector associated information.
func (o *optimizeConjunctionUnadorned) Finish() (rv segment.PostingsIterator, err error) {
	if len(o.tfrs) <= 1 {
		return nil, nil
	}

	// We use an artificial term and field because the optimized
	// termFieldReader can represent multiple terms and fields.
	oTFR := o.snapshot.unadornedPostingsIterator(
		optimizeConjunctionUnadornedTerm, optimizeConjunctionUnadornedField)

	var actualBMs []*roaring.Bitmap // Collected from regular posting lists.

OUTER:
	for i := range o.snapshot.segment {
		actualBMs = actualBMs[:0]

		var docNum1HitLast uint64
		var docNum1HitLastOk bool

		for _, tfr := range o.tfrs {
			if tfr.iterators[i].Empty() {
				// An empty postings iterator means the entire AND is empty.
				oTFR.iterators[i] = anEmptyPostingsIterator
				continue OUTER
			}

			itr, ok := tfr.iterators[i].(segment.OptimizablePostingsIterator)
			if !ok {
				// We only optimize postings iterators that support this operation.
				return nil, nil
			}

			// If the postings iterator is "1-hit" optimized, then we
			// can perform several optimizations up-front here.
			docNum1Hit, ok := itr.DocNum1Hit()
			if ok {
				if docNum1HitLastOk && docNum1HitLast != docNum1Hit {
					// The docNum1Hit doesn't match the previous
					// docNum1HitLast, so the entire AND is empty.
					oTFR.iterators[i] = anEmptyPostingsIterator
					continue OUTER
				}

				docNum1HitLast = docNum1Hit
				docNum1HitLastOk = true

				continue
			}

			if itr.ActualBitmap() == nil {
				// An empty actual bitmap means the entire AND is empty.
				oTFR.iterators[i] = anEmptyPostingsIterator
				continue OUTER
			}

			// Collect the actual bitmap for more processing later.
			actualBMs = append(actualBMs, itr.ActualBitmap())
		}

		if docNum1HitLastOk {
			// We reach here if all the 1-hit optimized posting
			// iterators had the same 1-hit docNum, so we can check if
			// our collected actual bitmaps also have that docNum.
			for _, bm := range actualBMs {
				if !bm.Contains(uint32(docNum1HitLast)) {
					// The docNum1Hit isn't in one of our actual
					// bitmaps, so the entire AND is empty.
					oTFR.iterators[i] = anEmptyPostingsIterator
					continue OUTER
				}
			}

			// The actual bitmaps and docNum1Hits all contain or have
			// the same 1-hit docNum, so that's our AND'ed result.
			oTFR.iterators[i] = newUnadornedPostingsIteratorFrom1Hit(docNum1HitLast)

			continue OUTER
		}

		if len(actualBMs) == 0 {
			// If we've collected no actual bitmaps at this point,
			// then the entire AND is empty.
			oTFR.iterators[i] = anEmptyPostingsIterator
			continue OUTER
		}

		if len(actualBMs) == 1 {
			// If we've only 1 actual bitmap, then that's our result.
			oTFR.iterators[i] = newUnadornedPostingsIteratorFromBitmap(actualBMs[0])

			continue OUTER
		}

		// Else, AND together our collected bitmaps as our result.
		bm := roaring.And(actualBMs[0], actualBMs[1])

		for _, actualBM := range actualBMs[2:] {
			bm.And(actualBM)
		}

		oTFR.iterators[i] = newUnadornedPostingsIteratorFromBitmap(bm)
	}

	atomic.AddUint64(&o.snapshot.parent.stats.TotTermSearchersStarted, uint64(1))
	return oTFR, nil
}

// ----------------------------------------------------------------

// An "unadorned" disjunction optimization is appropriate when
// additional or subsidiary information like freq-norm's and
// term-vectors are not required, and instead only the internal-id's
// are needed.
func (i *postingsIterator) optimizeDisjunctionUnadorned(
	octx segment.OptimizableContext) (segment.OptimizableContext, error) {
	if octx == nil {
		octx = &optimizeDisjunctionUnadorned{snapshot: i.snapshot}
	}

	o, ok := octx.(*optimizeDisjunctionUnadorned)
	if !ok {
		return nil, nil
	}

	if o.snapshot != i.snapshot {
		return nil, fmt.Errorf("tried to optimize unadorned disjunction across different snapshots")
	}

	o.tfrs = append(o.tfrs, i)

	return o, nil
}

type optimizeDisjunctionUnadorned struct {
	snapshot *Snapshot

	tfrs []*postingsIterator
}

var optimizeDisjunctionUnadornedTerm = []byte("<disjunction:unadorned>")

const optimizeDisjunctionUnadornedField = "*"

const preferHeapOr = 2

// Finish of an unadorned disjunction optimization will compute a
// termFieldReader with an "actual" bitmap that represents the
// constituent bitmaps OR'ed together.  This termFieldReader cannot
// provide any freq-norm or termVector associated information.
func (o *optimizeDisjunctionUnadorned) Finish() (rv segment.PostingsIterator, err error) {
	if len(o.tfrs) <= 1 {
		return nil, nil
	}

	for i := range o.snapshot.segment {
		var cMax uint64

		for _, tfr := range o.tfrs {
			itr, ok := tfr.iterators[i].(segment.OptimizablePostingsIterator)
			if !ok {
				return nil, nil
			}

			if itr.ActualBitmap() != nil {
				c := itr.ActualBitmap().GetCardinality()
				if cMax < c {
					cMax = c
				}
			}
		}
	}

	// We use an artificial term and field because the optimized
	// termFieldReader can represent multiple terms and fields.
	oTFR := o.snapshot.unadornedPostingsIterator(
		optimizeDisjunctionUnadornedTerm, optimizeDisjunctionUnadornedField)

	var docNums []uint32            // Collected docNum's from 1-hit posting lists.
	var actualBMs []*roaring.Bitmap // Collected from regular posting lists.

	for i := range o.snapshot.segment {
		docNums = docNums[:0]
		actualBMs = actualBMs[:0]

		for _, tfr := range o.tfrs {
			itr, ok := tfr.iterators[i].(segment.OptimizablePostingsIterator)
			if !ok {
				return nil, nil
			}

			docNum, ok := itr.DocNum1Hit()
			if ok {
				docNums = append(docNums, uint32(docNum))
				continue
			}

			if itr.ActualBitmap() != nil {
				actualBMs = append(actualBMs, itr.ActualBitmap())
			}
		}

		var bm *roaring.Bitmap
		if len(actualBMs) > preferHeapOr {
			bm = roaring.HeapOr(actualBMs...)
		} else if len(actualBMs) == preferHeapOr {
			bm = roaring.Or(actualBMs[0], actualBMs[1])
		} else if len(actualBMs) == 1 {
			bm = actualBMs[0].Clone()
		}

		if bm == nil {
			bm = roaring.New()
		}

		bm.AddMany(docNums)

		oTFR.iterators[i] = newUnadornedPostingsIteratorFromBitmap(bm)
	}

	atomic.AddUint64(&o.snapshot.parent.stats.TotTermSearchersStarted, uint64(1))
	return oTFR, nil
}
