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
	"sort"

	"github.com/blugelabs/bluge/search"
)

type ConjunctionSearcher struct {
	searchers   OrderedSearcherList
	currs       []*search.DocumentMatch
	maxIDIdx    int
	initialized bool
	options     search.SearcherOptions
	scorer      search.CompositeScorer
}

func NewConjunctionSearcher(indexReader search.Reader,
	qsearchers []search.Searcher, scorer search.CompositeScorer, options search.SearcherOptions) (
	search.Searcher, error) {
	// build the sorted downstream searchers
	searchers := make(OrderedSearcherList, len(qsearchers))
	for i, searcher := range qsearchers {
		searchers[i] = searcher
	}
	sort.Sort(searchers)

	// attempt the "unadorned" conjunction optimization only when we
	// do not need extra information like freq-norm's or term vectors
	if len(searchers) > 1 &&
		options.Score == optionScoringNone && !options.IncludeTermVectors {
		rv, err := optimizeCompositeSearcher("conjunction:unadorned",
			indexReader, searchers, options)
		if err != nil || rv != nil {
			return rv, err
		}
	}

	// build our searcher
	rv := ConjunctionSearcher{
		options:   options,
		searchers: searchers,
		currs:     make([]*search.DocumentMatch, len(searchers)),
		scorer:    scorer,
	}

	// attempt push-down conjunction optimization when there's >1 searchers
	if len(searchers) > 1 {
		rv, err := optimizeCompositeSearcher("conjunction",
			indexReader, searchers, options)
		if err != nil || rv != nil {
			return rv, err
		}
	}

	return &rv, nil
}

func (s *ConjunctionSearcher) Size() int {
	sizeInBytes := reflectStaticSizeConjunctionSearcher + sizeOfPtr

	for _, entry := range s.searchers {
		sizeInBytes += entry.Size()
	}

	for _, entry := range s.currs {
		if entry != nil {
			sizeInBytes += entry.Size()
		}
	}

	return sizeInBytes
}

func (s *ConjunctionSearcher) initSearchers(ctx *search.Context) error {
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
	s.initialized = true
	return nil
}

func (s *ConjunctionSearcher) Next(ctx *search.Context) (*search.DocumentMatch, error) {
	if !s.initialized {
		err := s.initSearchers(ctx)
		if err != nil {
			return nil, err
		}
	}
	var rv *search.DocumentMatch
	var err error
OUTER:
	for s.maxIDIdx < len(s.currs) && s.currs[s.maxIDIdx] != nil {
		maxID := s.currs[s.maxIDIdx].Number

		i := 0
		for i < len(s.currs) {
			if s.currs[i] == nil {
				return nil, nil
			}

			if i == s.maxIDIdx {
				i++
				continue
			}

			cmp := docNumberCompare(maxID, s.currs[i].Number)
			if cmp == 0 {
				i++
				continue
			}

			if cmp < 0 {
				// maxID < currs[i], so we found a new maxIDIdx
				s.maxIDIdx = i

				// advance the positions where [0 <= x < i], since we
				// know they were equal to the former max entry
				maxID = s.currs[s.maxIDIdx].Number
				for x := 0; x < i; x++ {
					err = s.advanceChild(ctx, x, maxID)
					if err != nil {
						return nil, err
					}
				}

				continue OUTER
			}

			// maxID > currs[i], so need to advance searchers[i]
			err = s.advanceChild(ctx, i, maxID)
			if err != nil {
				return nil, err
			}

			// don't bump i, so that we'll examine the just-advanced
			// currs[i] again
		}

		// if we get here, a doc matched all readers, so score and add it
		rv = s.buildDocumentMatch(s.currs)

		// we know all the searchers are pointing at the same thing
		// so they all need to be bumped
		for i, searcher := range s.searchers {
			if s.currs[i] != rv {
				ctx.DocumentMatchPool.Put(s.currs[i])
			}
			s.currs[i], err = searcher.Next(ctx)
			if err != nil {
				return nil, err
			}
		}

		// don't continue now, wait for the next call to Next()
		break
	}

	return rv, nil
}

func (s *ConjunctionSearcher) Advance(ctx *search.Context, number uint64) (*search.DocumentMatch, error) {
	if !s.initialized {
		err := s.initSearchers(ctx)
		if err != nil {
			return nil, err
		}
	}
	for i := range s.searchers {
		if s.currs[i] != nil && s.currs[i].Number >= number {
			continue
		}
		err := s.advanceChild(ctx, i, number)
		if err != nil {
			return nil, err
		}
	}
	return s.Next(ctx)
}

func (s *ConjunctionSearcher) advanceChild(ctx *search.Context, i int, number uint64) (err error) {
	if s.currs[i] != nil {
		ctx.DocumentMatchPool.Put(s.currs[i])
	}
	s.currs[i], err = s.searchers[i].Advance(ctx, number)
	return err
}

func (s *ConjunctionSearcher) Count() uint64 {
	// for now return a worst case
	var sum uint64
	for _, searcher := range s.searchers {
		sum += searcher.Count()
	}
	return sum
}

func (s *ConjunctionSearcher) Close() (rv error) {
	for _, searcher := range s.searchers {
		err := searcher.Close()
		if err != nil && rv == nil {
			rv = err
		}
	}
	return rv
}

func (s *ConjunctionSearcher) Min() int {
	return 0
}

func (s *ConjunctionSearcher) DocumentMatchPoolSize() int {
	rv := len(s.currs)
	for _, s := range s.searchers {
		rv += s.DocumentMatchPoolSize()
	}
	return rv
}

func (s *ConjunctionSearcher) buildDocumentMatch(constituents []*search.DocumentMatch) *search.DocumentMatch {
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
