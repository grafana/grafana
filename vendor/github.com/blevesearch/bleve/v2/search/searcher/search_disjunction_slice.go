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
	"context"
	"math"
	"reflect"
	"sort"

	"github.com/blevesearch/bleve/v2/search"
	"github.com/blevesearch/bleve/v2/search/scorer"
	"github.com/blevesearch/bleve/v2/size"
	index "github.com/blevesearch/bleve_index_api"
)

var reflectStaticSizeDisjunctionSliceSearcher int

func init() {
	var ds DisjunctionSliceSearcher
	reflectStaticSizeDisjunctionSliceSearcher = int(reflect.TypeOf(ds).Size())
}

type DisjunctionSliceSearcher struct {
	indexReader            index.IndexReader
	searchers              []search.Searcher
	originalPos            []int
	numSearchers           int
	queryNorm              float64
	retrieveScoreBreakdown bool
	currs                  []*search.DocumentMatch
	scorer                 *scorer.DisjunctionQueryScorer
	min                    int
	matching               []*search.DocumentMatch
	matchingIdxs           []int
	initialized            bool
	bytesRead              uint64
}

func newDisjunctionSliceSearcher(ctx context.Context, indexReader index.IndexReader,
	qsearchers []search.Searcher, min float64, options search.SearcherOptions,
	limit bool) (
	*DisjunctionSliceSearcher, error,
) {
	if limit && tooManyClauses(len(qsearchers)) {
		return nil, tooManyClausesErr("", len(qsearchers))
	}

	var searchers OrderedSearcherList
	var originalPos []int
	var retrieveScoreBreakdown bool
	if ctx != nil {
		retrieveScoreBreakdown, _ = ctx.Value(search.IncludeScoreBreakdownKey).(bool)
	}

	if retrieveScoreBreakdown {
		// needed only when kNN is in picture
		sortedSearchers := &OrderedPositionalSearcherList{
			searchers: make([]search.Searcher, len(qsearchers)),
			index:     make([]int, len(qsearchers)),
		}
		for i, searcher := range qsearchers {
			sortedSearchers.searchers[i] = searcher
			sortedSearchers.index[i] = i
		}
		sort.Sort(sortedSearchers)
		searchers = sortedSearchers.searchers
		originalPos = sortedSearchers.index
	} else {
		searchers = make(OrderedSearcherList, len(qsearchers))
		copy(searchers, qsearchers)
		sort.Sort(searchers)
	}

	rv := DisjunctionSliceSearcher{
		indexReader:            indexReader,
		searchers:              searchers,
		originalPos:            originalPos,
		numSearchers:           len(searchers),
		currs:                  make([]*search.DocumentMatch, len(searchers)),
		scorer:                 scorer.NewDisjunctionQueryScorer(options),
		min:                    int(min),
		retrieveScoreBreakdown: retrieveScoreBreakdown,

		matching:     make([]*search.DocumentMatch, len(searchers)),
		matchingIdxs: make([]int, len(searchers)),
	}
	rv.computeQueryNorm()
	return &rv, nil
}

func (s *DisjunctionSliceSearcher) computeQueryNorm() {
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

func (s *DisjunctionSliceSearcher) Size() int {
	sizeInBytes := reflectStaticSizeDisjunctionSliceSearcher + size.SizeOfPtr +
		s.scorer.Size()

	for _, entry := range s.searchers {
		sizeInBytes += entry.Size()
	}

	for _, entry := range s.currs {
		if entry != nil {
			sizeInBytes += entry.Size()
		}
	}

	for _, entry := range s.matching {
		if entry != nil {
			sizeInBytes += entry.Size()
		}
	}

	sizeInBytes += len(s.matchingIdxs) * size.SizeOfInt
	sizeInBytes += len(s.originalPos) * size.SizeOfInt

	return sizeInBytes
}

func (s *DisjunctionSliceSearcher) initSearchers(ctx *search.SearchContext) error {
	var err error
	// get all searchers pointing at their first match
	for i, searcher := range s.searchers {
		if s.currs[i] != nil {
			ctx.DocumentMatchPool.Put(s.currs[i])
		}
		s.currs[i], err = searcher.Next(ctx)
		if err != nil {
			return err
		}
	}

	err = s.updateMatches()
	if err != nil {
		return err
	}

	s.initialized = true
	return nil
}

func (s *DisjunctionSliceSearcher) updateMatches() error {
	matching := s.matching[:0]
	matchingIdxs := s.matchingIdxs[:0]

	for i := 0; i < len(s.currs); i++ {
		curr := s.currs[i]
		if curr == nil {
			continue
		}

		if len(matching) > 0 {
			cmp := curr.IndexInternalID.Compare(matching[0].IndexInternalID)
			if cmp > 0 {
				continue
			}

			if cmp < 0 {
				matching = matching[:0]
				matchingIdxs = matchingIdxs[:0]
			}
		}
		matching = append(matching, curr)
		matchingIdxs = append(matchingIdxs, i)
	}

	s.matching = matching
	s.matchingIdxs = matchingIdxs

	return nil
}

func (s *DisjunctionSliceSearcher) Weight() float64 {
	var rv float64
	for _, searcher := range s.searchers {
		rv += searcher.Weight()
	}
	return rv
}

func (s *DisjunctionSliceSearcher) SetQueryNorm(qnorm float64) {
	for _, searcher := range s.searchers {
		searcher.SetQueryNorm(qnorm)
	}
}

func (s *DisjunctionSliceSearcher) Next(ctx *search.SearchContext) (
	*search.DocumentMatch, error,
) {
	if !s.initialized {
		err := s.initSearchers(ctx)
		if err != nil {
			return nil, err
		}
	}
	var err error
	var rv *search.DocumentMatch

	found := false
	for !found && len(s.matching) > 0 {
		if len(s.matching) >= s.min {
			found = true
			if s.retrieveScoreBreakdown {
				// just return score and expl breakdown here, since it is a disjunction over knn searchers,
				// and the final score and expl is calculated in the knn collector
				rv = s.scorer.ScoreAndExplBreakdown(ctx, s.matching, s.matchingIdxs, s.originalPos, s.numSearchers)
			} else {
				// score this match
				rv = s.scorer.Score(ctx, s.matching, len(s.matching), s.numSearchers)
			}
		}

		// invoke next on all the matching searchers
		for _, i := range s.matchingIdxs {
			searcher := s.searchers[i]
			if s.currs[i] != rv {
				ctx.DocumentMatchPool.Put(s.currs[i])
			}
			s.currs[i], err = searcher.Next(ctx)
			if err != nil {
				return nil, err
			}
		}

		err = s.updateMatches()
		if err != nil {
			return nil, err
		}
	}
	return rv, nil
}

func (s *DisjunctionSliceSearcher) Advance(ctx *search.SearchContext,
	ID index.IndexInternalID,
) (*search.DocumentMatch, error) {
	if !s.initialized {
		err := s.initSearchers(ctx)
		if err != nil {
			return nil, err
		}
	}
	// get all searchers pointing at their first match
	var err error
	for i, searcher := range s.searchers {
		if s.currs[i] != nil {
			if s.currs[i].IndexInternalID.Compare(ID) >= 0 {
				continue
			}
			ctx.DocumentMatchPool.Put(s.currs[i])
		}
		s.currs[i], err = searcher.Advance(ctx, ID)
		if err != nil {
			return nil, err
		}
	}

	err = s.updateMatches()
	if err != nil {
		return nil, err
	}

	return s.Next(ctx)
}

func (s *DisjunctionSliceSearcher) Count() uint64 {
	// for now return a worst case
	var sum uint64
	for _, searcher := range s.searchers {
		sum += searcher.Count()
	}
	return sum
}

func (s *DisjunctionSliceSearcher) Close() (rv error) {
	for _, searcher := range s.searchers {
		err := searcher.Close()
		if err != nil && rv == nil {
			rv = err
		}
	}
	return rv
}

func (s *DisjunctionSliceSearcher) Min() int {
	return s.min
}

func (s *DisjunctionSliceSearcher) DocumentMatchPoolSize() int {
	rv := len(s.currs)
	for _, s := range s.searchers {
		rv += s.DocumentMatchPoolSize()
	}
	return rv
}

// a disjunction searcher implements the index.Optimizable interface
// but only activates on an edge case where the disjunction is a
// wrapper around a single Optimizable child searcher
func (s *DisjunctionSliceSearcher) Optimize(kind string, octx index.OptimizableContext) (
	index.OptimizableContext, error,
) {
	if len(s.searchers) == 1 {
		o, ok := s.searchers[0].(index.Optimizable)
		if ok {
			return o.Optimize(kind, octx)
		}
	}

	return nil, nil
}
