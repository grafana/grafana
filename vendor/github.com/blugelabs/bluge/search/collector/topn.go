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

package collector

import (
	"context"

	"github.com/blugelabs/bluge/search"
)

type collectorStore interface {
	// Add the document, and if the new store size exceeds the provided size
	// the last element is removed and returned.  If the size has not been
	// exceeded, nil is returned.
	AddNotExceedingSize(doc *search.DocumentMatch, size int) *search.DocumentMatch

	Final(skip int, fixup collectorFixup) (search.DocumentMatchCollection, error)
}

// PreAllocSizeSkipCap will cap preallocation to this amount when
// size+skip exceeds this value
var PreAllocSizeSkipCap = 1000

type collectorCompare func(i, j *search.DocumentMatch) int

type collectorFixup func(d *search.DocumentMatch) error

// TopNCollector collects the top N hits, optionally skipping some results
type TopNCollector struct {
	size        int
	skip        int
	sort        search.SortOrder
	results     search.DocumentMatchCollection
	reverse     bool
	backingSize int

	store collectorStore

	neededFields []string

	lowestMatchOutsideResults *search.DocumentMatch
	searchAfter               *search.DocumentMatch
}

// CheckDoneEvery controls how frequently we check the context deadline
const CheckDoneEvery = 1024

// NewTopNCollector builds a collector to find the top 'size' hits
// skipping over the first 'skip' hits
// ordering hits by the provided sort order
func NewTopNCollector(size, skip int, sort search.SortOrder) *TopNCollector {
	return newTopNCollector(size, skip, sort, false)
}

// NewTopNCollector builds a collector to find the top 'size' hits
// skipping over the first 'skip' hits
// ordering hits by the provided sort order
func NewTopNCollectorAfter(size int, sort search.SortOrder, after [][]byte, reverse bool) *TopNCollector {
	rv := newTopNCollector(size, 0, sort, reverse)
	rv.searchAfter = &search.DocumentMatch{
		SortValue: after,
	}

	return rv
}

const switchFromSliceToHeap = 10

func newTopNCollector(size, skip int, sort search.SortOrder, reverse bool) *TopNCollector {
	hc := &TopNCollector{
		size:    size,
		skip:    skip,
		sort:    sort,
		reverse: reverse,
	}

	// pre-allocate space on the store to avoid reslicing
	// unless the size + skip is too large, then cap it
	// everything should still work, just reslices as necessary
	hc.backingSize = size + skip + 1
	if size+skip > PreAllocSizeSkipCap {
		hc.backingSize = PreAllocSizeSkipCap + 1
	}

	if size+skip > switchFromSliceToHeap {
		hc.store = newStoreHeap(hc.backingSize, func(i, j *search.DocumentMatch) int {
			return hc.sort.Compare(i, j)
		})
	} else {
		hc.store = newStoreSlice(hc.backingSize, func(i, j *search.DocumentMatch) int {
			return hc.sort.Compare(i, j)
		})
	}

	// these lookups traverse an interface, so do once up-front
	hc.neededFields = sort.Fields()

	return hc
}

func (hc *TopNCollector) Size() int {
	sizeInBytes := reflectStaticSizeTopNCollector + sizeOfPtr

	for _, entry := range hc.neededFields {
		sizeInBytes += len(entry) + sizeOfString
	}

	return sizeInBytes
}

func (hc *TopNCollector) BackingSize() int {
	return hc.backingSize
}

// Collect goes to the index to find the matching documents
func (hc *TopNCollector) Collect(ctx context.Context, aggs search.Aggregations,
	searcher search.Collectible) (search.DocumentMatchIterator, error) {
	var err error
	var next *search.DocumentMatch

	// ensure that we always close the searcher
	defer func() {
		_ = searcher.Close()
	}()

	searchContext := search.NewSearchContext(hc.backingSize+searcher.DocumentMatchPoolSize(), len(hc.sort))

	// add fields needed by aggregations
	hc.neededFields = append(hc.neededFields, aggs.Fields()...)
	bucket := search.NewBucket("", aggs)

	var hitNumber int
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
		next, err = searcher.Next(searchContext)
	}
	for err == nil && next != nil {
		if hitNumber%CheckDoneEvery == 0 {
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			default:
			}
		}

		hitNumber++
		next.HitNumber = hitNumber

		err = hc.collectSingle(searchContext, next, bucket)
		if err != nil {
			return nil, err
		}

		next, err = searcher.Next(searchContext)
	}
	if err != nil {
		return nil, err
	}

	bucket.Finish()

	// finalize actual results
	err = hc.finalizeResults()
	if err != nil {
		return nil, err
	}

	rv := &TopNIterator{
		results: hc.results,
		bucket:  bucket,
		index:   0,
		err:     nil,
	}
	return rv, nil
}

func (hc *TopNCollector) collectSingle(ctx *search.Context, d *search.DocumentMatch, bucket *search.Bucket) error {
	var err error

	if len(hc.neededFields) > 0 {
		err = d.LoadDocumentValues(ctx, hc.neededFields)
		if err != nil {
			return err
		}
	}

	// compute this hits sort value
	hc.sort.Compute(d)

	// calculate aggregations
	bucket.Consume(d)

	// support search after based pagination,
	// if this hit is <= the search after sort key
	// we should skip it
	if hc.searchAfter != nil {
		// exact sort order matches use hit number to break tie
		// but we want to allow for exact match, so we pretend
		hc.searchAfter.HitNumber = d.HitNumber
		if hc.sort.Compare(d, hc.searchAfter) <= 0 {
			return nil
		}
	}

	// optimization, we track lowest sorting hit already removed from heap
	// with this one comparison, we can avoid all heap operations if
	// this hit would have been added and then immediately removed
	if hc.lowestMatchOutsideResults != nil {
		cmp := hc.sort.Compare(d, hc.lowestMatchOutsideResults)
		if cmp >= 0 {
			// this hit can't possibly be in the result set, so avoid heap ops
			ctx.DocumentMatchPool.Put(d)
			return nil
		}
	}

	removed := hc.store.AddNotExceedingSize(d, hc.size+hc.skip)
	if removed != nil {
		if hc.lowestMatchOutsideResults == nil {
			hc.lowestMatchOutsideResults = removed
		} else {
			cmp := hc.sort.Compare(removed, hc.lowestMatchOutsideResults)
			if cmp < 0 {
				tmp := hc.lowestMatchOutsideResults
				hc.lowestMatchOutsideResults = removed
				ctx.DocumentMatchPool.Put(tmp)
			}
		}
	}
	return nil
}

// finalizeResults starts with the heap containing the final top size+skip
// it now throws away the results to be skipped
// and does final doc id lookup (if necessary)
func (hc *TopNCollector) finalizeResults() error {
	var err error
	hc.results, err = hc.store.Final(hc.skip, func(doc *search.DocumentMatch) error {
		doc.Complete(nil)
		return nil
	})

	if hc.reverse {
		for i, j := 0, len(hc.results)-1; i < j; i, j = i+1, j-1 {
			hc.results[i], hc.results[j] = hc.results[j], hc.results[i]
		}
	}

	return err
}
