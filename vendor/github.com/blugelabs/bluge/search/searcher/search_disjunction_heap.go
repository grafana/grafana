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

package searcher

import (
	"container/heap"

	segment "github.com/blugelabs/bluge_segment_api"

	"github.com/blugelabs/bluge/search"
)

type searcherCurr struct {
	searcher search.Searcher
	curr     *search.DocumentMatch
}

type DisjunctionHeapSearcher struct {
	numSearchers int
	scorer       search.CompositeScorer
	min          int
	initialized  bool
	searchers    []search.Searcher
	heap         []*searcherCurr

	matching      []*search.DocumentMatch
	matchingCurrs []*searcherCurr
	options       search.SearcherOptions
}

func newDisjunctionHeapSearcher(searchers []search.Searcher, min int, scorer search.CompositeScorer, options search.SearcherOptions,
	limit bool) (
	*DisjunctionHeapSearcher, error) {
	if limit && tooManyClauses(len(searchers)) {
		return nil, tooManyClausesErr("", len(searchers))
	}

	// build our searcher
	rv := DisjunctionHeapSearcher{
		searchers:     searchers,
		numSearchers:  len(searchers),
		scorer:        scorer,
		min:           min,
		matching:      make([]*search.DocumentMatch, len(searchers)),
		matchingCurrs: make([]*searcherCurr, len(searchers)),
		heap:          make([]*searcherCurr, 0, len(searchers)),
		options:       options,
	}
	return &rv, nil
}

func (s *DisjunctionHeapSearcher) Size() int {
	sizeInBytes := reflectStaticSizeDisjunctionHeapSearcher + sizeOfPtr

	for _, entry := range s.searchers {
		sizeInBytes += entry.Size()
	}

	for _, entry := range s.matching {
		if entry != nil {
			sizeInBytes += entry.Size()
		}
	}

	// for matchingCurrs and heap, just use static size * len
	// since searchers and document matches already counted above
	sizeInBytes += len(s.matchingCurrs) * reflectStaticSizeSearcherCurr
	sizeInBytes += len(s.heap) * reflectStaticSizeSearcherCurr

	return sizeInBytes
}

func (s *DisjunctionHeapSearcher) initSearchers(ctx *search.Context) error {
	// alloc a single block of SearcherCurrs
	block := make([]searcherCurr, len(s.searchers))

	// get all searchers pointing at their first match
	for i, searcher := range s.searchers {
		curr, err := searcher.Next(ctx)
		if err != nil {
			return err
		}
		if curr != nil {
			block[i].searcher = searcher
			block[i].curr = curr
			heap.Push(s, &block[i])
		}
	}

	err := s.updateMatches()
	if err != nil {
		return err
	}
	s.initialized = true
	return nil
}

func (s *DisjunctionHeapSearcher) updateMatches() error {
	matching := s.matching[:0]
	matchingCurrs := s.matchingCurrs[:0]

	if len(s.heap) > 0 {
		// top of the heap is our next hit
		next := heap.Pop(s).(*searcherCurr)
		matching = append(matching, next.curr)
		matchingCurrs = append(matchingCurrs, next)

		// now as long as top of heap matches, keep popping
		for len(s.heap) > 0 && next.curr.Number == s.heap[0].curr.Number {
			next = heap.Pop(s).(*searcherCurr)
			matching = append(matching, next.curr)
			matchingCurrs = append(matchingCurrs, next)
		}
	}

	s.matching = matching
	s.matchingCurrs = matchingCurrs

	return nil
}

func (s *DisjunctionHeapSearcher) Next(ctx *search.Context) (
	*search.DocumentMatch, error) {
	if !s.initialized {
		err := s.initSearchers(ctx)
		if err != nil {
			return nil, err
		}
	}

	var rv *search.DocumentMatch
	found := false
	for !found && len(s.matching) > 0 {
		if len(s.matching) >= s.min {
			found = true
			// score this match
			rv = s.buildDocumentMatch(s.matching)
		}

		// invoke next on all the matching searchers
		for _, matchingCurr := range s.matchingCurrs {
			if matchingCurr.curr != rv {
				ctx.DocumentMatchPool.Put(matchingCurr.curr)
			}
			curr, err := matchingCurr.searcher.Next(ctx)
			if err != nil {
				return nil, err
			}
			if curr != nil {
				matchingCurr.curr = curr
				heap.Push(s, matchingCurr)
			}
		}

		err := s.updateMatches()
		if err != nil {
			return nil, err
		}
	}

	return rv, nil
}

func (s *DisjunctionHeapSearcher) Advance(ctx *search.Context,
	number uint64) (*search.DocumentMatch, error) {
	if !s.initialized {
		err := s.initSearchers(ctx)
		if err != nil {
			return nil, err
		}
	}

	// if there is anything in matching, toss it back onto the heap
	for _, matchingCurr := range s.matchingCurrs {
		heap.Push(s, matchingCurr)
	}
	s.matching = s.matching[:0]
	s.matchingCurrs = s.matchingCurrs[:0]

	// find all searchers that actually need to be advanced
	// advance them, using s.matchingCurrs as temp storage
	for len(s.heap) > 0 && docNumberCompare(s.heap[0].curr.Number, number) < 0 {
		searcherCurr := heap.Pop(s).(*searcherCurr)
		ctx.DocumentMatchPool.Put(searcherCurr.curr)
		curr, err := searcherCurr.searcher.Advance(ctx, number)
		if err != nil {
			return nil, err
		}
		if curr != nil {
			searcherCurr.curr = curr
			s.matchingCurrs = append(s.matchingCurrs, searcherCurr)
		}
	}
	// now all of the searchers that we advanced have to be pushed back
	for _, matchingCurr := range s.matchingCurrs {
		heap.Push(s, matchingCurr)
	}
	// reset our temp space
	s.matchingCurrs = s.matchingCurrs[:0]

	err := s.updateMatches()
	if err != nil {
		return nil, err
	}

	return s.Next(ctx)
}

func (s *DisjunctionHeapSearcher) Count() uint64 {
	// for now return a worst case
	var sum uint64
	for _, searcher := range s.searchers {
		sum += searcher.Count()
	}
	return sum
}

func (s *DisjunctionHeapSearcher) Close() (rv error) {
	for _, searcher := range s.searchers {
		err := searcher.Close()
		if err != nil && rv == nil {
			rv = err
		}
	}
	return rv
}

func (s *DisjunctionHeapSearcher) Min() int {
	return s.min
}

func (s *DisjunctionHeapSearcher) DocumentMatchPoolSize() int {
	rv := len(s.searchers)
	for _, s := range s.searchers {
		rv += s.DocumentMatchPoolSize()
	}
	return rv
}

// a disjunction searcher implements the index.Optimizable interface
// but only activates on an edge case where the disjunction is a
// wrapper around a single Optimizable child searcher
func (s *DisjunctionHeapSearcher) Optimize(kind string, octx segment.OptimizableContext) (
	segment.OptimizableContext, error) {
	if len(s.searchers) == 1 {
		o, ok := s.searchers[0].(segment.Optimizable)
		if ok {
			return o.Optimize(kind, octx)
		}
	}

	return nil, nil
}

// heap impl

func (s *DisjunctionHeapSearcher) Len() int { return len(s.heap) }

func (s *DisjunctionHeapSearcher) Less(i, j int) bool {
	if s.heap[i].curr == nil {
		return true
	} else if s.heap[j].curr == nil {
		return false
	}
	return docNumberCompare(s.heap[i].curr.Number, s.heap[j].curr.Number) < 0
}

func (s *DisjunctionHeapSearcher) Swap(i, j int) {
	s.heap[i], s.heap[j] = s.heap[j], s.heap[i]
}

func (s *DisjunctionHeapSearcher) Push(x interface{}) {
	s.heap = append(s.heap, x.(*searcherCurr))
}

func (s *DisjunctionHeapSearcher) Pop() interface{} {
	old := s.heap
	n := len(old)
	x := old[n-1]
	s.heap = old[0 : n-1]
	return x
}

func (s *DisjunctionHeapSearcher) buildDocumentMatch(constituents []*search.DocumentMatch) *search.DocumentMatch {
	rv := constituents[0]
	if s.options.Explain {
		rv.Explanation = s.scorer.ExplainComposite(constituents)
		rv.Score = rv.Explanation.Value
	} else {
		rv.Score = s.scorer.ScoreComposite(constituents)
	}

	rv.FieldTermLocations = search.MergeFieldTermLocations(
		rv.FieldTermLocations, constituents[1:])

	return rv
}
