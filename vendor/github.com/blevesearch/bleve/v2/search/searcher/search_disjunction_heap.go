//  Copyright (c) 2018 Couchbase, Inc.
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
	"bytes"
	"container/heap"
	"context"
	"math"
	"reflect"

	"github.com/blevesearch/bleve/v2/search"
	"github.com/blevesearch/bleve/v2/search/scorer"
	"github.com/blevesearch/bleve/v2/size"
	index "github.com/blevesearch/bleve_index_api"
)

var reflectStaticSizeDisjunctionHeapSearcher int
var reflectStaticSizeSearcherCurr int

func init() {
	var dhs DisjunctionHeapSearcher
	reflectStaticSizeDisjunctionHeapSearcher = int(reflect.TypeOf(dhs).Size())

	var sc SearcherCurr
	reflectStaticSizeSearcherCurr = int(reflect.TypeOf(sc).Size())
}

type SearcherCurr struct {
	searcher    search.Searcher
	curr        *search.DocumentMatch
	matchingIdx int
}

type DisjunctionHeapSearcher struct {
	indexReader index.IndexReader

	numSearchers           int
	scorer                 *scorer.DisjunctionQueryScorer
	min                    int
	queryNorm              float64
	retrieveScoreBreakdown bool
	initialized            bool
	searchers              []search.Searcher
	heap                   []*SearcherCurr

	matching      []*search.DocumentMatch
	matchingIdxs  []int
	matchingCurrs []*SearcherCurr

	bytesRead uint64
}

func newDisjunctionHeapSearcher(ctx context.Context, indexReader index.IndexReader,
	searchers []search.Searcher, min float64, options search.SearcherOptions,
	limit bool) (
	*DisjunctionHeapSearcher, error) {
	if limit && tooManyClauses(len(searchers)) {
		return nil, tooManyClausesErr("", len(searchers))
	}
	var retrieveScoreBreakdown bool
	if ctx != nil {
		retrieveScoreBreakdown, _ = ctx.Value(search.IncludeScoreBreakdownKey).(bool)
	}

	// build our searcher
	rv := DisjunctionHeapSearcher{
		indexReader:            indexReader,
		searchers:              searchers,
		numSearchers:           len(searchers),
		scorer:                 scorer.NewDisjunctionQueryScorer(options),
		min:                    int(min),
		matching:               make([]*search.DocumentMatch, len(searchers)),
		matchingCurrs:          make([]*SearcherCurr, len(searchers)),
		matchingIdxs:           make([]int, len(searchers)),
		retrieveScoreBreakdown: retrieveScoreBreakdown,
		heap:                   make([]*SearcherCurr, 0, len(searchers)),
	}
	rv.computeQueryNorm()
	return &rv, nil
}

func (s *DisjunctionHeapSearcher) computeQueryNorm() {
	// first calculate sum of squared weights
	sumOfSquaredWeights := 0.0
	for _, searcher := range s.searchers {
		sumOfSquaredWeights += searcher.Weight()
	}
	// now compute query norm from this
	s.queryNorm = 1.0 / math.Sqrt(sumOfSquaredWeights)
	// finally tell all the downstream searchers the norm
	for _, searcher := range s.searchers {
		searcher.SetQueryNorm(s.queryNorm)
	}
}

func (s *DisjunctionHeapSearcher) Size() int {
	sizeInBytes := reflectStaticSizeDisjunctionHeapSearcher + size.SizeOfPtr +
		s.scorer.Size()

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
	sizeInBytes += len(s.matchingIdxs) * size.SizeOfInt

	return sizeInBytes
}

func (s *DisjunctionHeapSearcher) initSearchers(ctx *search.SearchContext) error {
	// alloc a single block of SearcherCurrs
	block := make([]SearcherCurr, len(s.searchers))

	// get all searchers pointing at their first match
	for i, searcher := range s.searchers {
		curr, err := searcher.Next(ctx)
		if err != nil {
			return err
		}
		if curr != nil {
			block[i].searcher = searcher
			block[i].curr = curr
			block[i].matchingIdx = i
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
	matchingIdxs := s.matchingIdxs[:0]

	if len(s.heap) > 0 {

		// top of the heap is our next hit
		next := heap.Pop(s).(*SearcherCurr)
		matching = append(matching, next.curr)
		matchingCurrs = append(matchingCurrs, next)
		matchingIdxs = append(matchingIdxs, next.matchingIdx)

		// now as long as top of heap matches, keep popping
		for len(s.heap) > 0 && bytes.Compare(next.curr.IndexInternalID, s.heap[0].curr.IndexInternalID) == 0 {
			next = heap.Pop(s).(*SearcherCurr)
			matching = append(matching, next.curr)
			matchingCurrs = append(matchingCurrs, next)
			matchingIdxs = append(matchingIdxs, next.matchingIdx)
		}
	}

	s.matching = matching
	s.matchingCurrs = matchingCurrs
	s.matchingIdxs = matchingIdxs

	return nil
}

func (s *DisjunctionHeapSearcher) Weight() float64 {
	var rv float64
	for _, searcher := range s.searchers {
		rv += searcher.Weight()
	}
	return rv
}

func (s *DisjunctionHeapSearcher) SetQueryNorm(qnorm float64) {
	for _, searcher := range s.searchers {
		searcher.SetQueryNorm(qnorm)
	}
}

func (s *DisjunctionHeapSearcher) Next(ctx *search.SearchContext) (
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
			if s.retrieveScoreBreakdown {
				// just return score and expl breakdown here, since it is a disjunction over knn searchers,
				// and the final score and expl is calculated in the knn collector
				rv = s.scorer.ScoreAndExplBreakdown(ctx, s.matching, s.matchingIdxs, nil, s.numSearchers)
			} else {
				// score this match
				rv = s.scorer.Score(ctx, s.matching, len(s.matching), s.numSearchers)
			}
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

func (s *DisjunctionHeapSearcher) Advance(ctx *search.SearchContext,
	ID index.IndexInternalID) (*search.DocumentMatch, error) {
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
	for len(s.heap) > 0 && bytes.Compare(s.heap[0].curr.IndexInternalID, ID) < 0 {
		searcherCurr := heap.Pop(s).(*SearcherCurr)
		ctx.DocumentMatchPool.Put(searcherCurr.curr)
		curr, err := searcherCurr.searcher.Advance(ctx, ID)
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
func (s *DisjunctionHeapSearcher) Optimize(kind string, octx index.OptimizableContext) (
	index.OptimizableContext, error) {
	if len(s.searchers) == 1 {
		o, ok := s.searchers[0].(index.Optimizable)
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
	return bytes.Compare(s.heap[i].curr.IndexInternalID, s.heap[j].curr.IndexInternalID) < 0
}

func (s *DisjunctionHeapSearcher) Swap(i, j int) {
	s.heap[i], s.heap[j] = s.heap[j], s.heap[i]
}

func (s *DisjunctionHeapSearcher) Push(x interface{}) {
	s.heap = append(s.heap, x.(*SearcherCurr))
}

func (s *DisjunctionHeapSearcher) Pop() interface{} {
	old := s.heap
	n := len(old)
	x := old[n-1]
	s.heap = old[0 : n-1]
	return x
}
