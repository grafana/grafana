//  Copyright (c) 2014 Couchbase, Inc.
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

	"github.com/blevesearch/bleve/v2/search"
	"github.com/blevesearch/bleve/v2/search/scorer"
	"github.com/blevesearch/bleve/v2/size"
	index "github.com/blevesearch/bleve_index_api"
)

var reflectStaticSizeBooleanSearcher int

func init() {
	var bs BooleanSearcher
	reflectStaticSizeBooleanSearcher = int(reflect.TypeOf(bs).Size())
}

type BooleanSearcher struct {
	indexReader     index.IndexReader
	mustSearcher    search.Searcher
	shouldSearcher  search.Searcher
	mustNotSearcher search.Searcher
	queryNorm       float64
	currMust        *search.DocumentMatch
	currShould      *search.DocumentMatch
	currMustNot     *search.DocumentMatch
	currentID       index.IndexInternalID
	min             uint64
	scorer          *scorer.ConjunctionQueryScorer
	matches         []*search.DocumentMatch
	initialized     bool
	done            bool
}

func NewBooleanSearcher(ctx context.Context, indexReader index.IndexReader, mustSearcher search.Searcher, shouldSearcher search.Searcher, mustNotSearcher search.Searcher, options search.SearcherOptions) (*BooleanSearcher, error) {
	// build our searcher
	rv := BooleanSearcher{
		indexReader:     indexReader,
		mustSearcher:    mustSearcher,
		shouldSearcher:  shouldSearcher,
		mustNotSearcher: mustNotSearcher,
		scorer:          scorer.NewConjunctionQueryScorer(options),
		matches:         make([]*search.DocumentMatch, 2),
	}
	rv.computeQueryNorm()
	return &rv, nil
}

func (s *BooleanSearcher) Size() int {
	sizeInBytes := reflectStaticSizeBooleanSearcher + size.SizeOfPtr

	if s.mustSearcher != nil {
		sizeInBytes += s.mustSearcher.Size()
	}

	if s.shouldSearcher != nil {
		sizeInBytes += s.shouldSearcher.Size()
	}

	if s.mustNotSearcher != nil {
		sizeInBytes += s.mustNotSearcher.Size()
	}

	sizeInBytes += s.scorer.Size()

	for _, entry := range s.matches {
		if entry != nil {
			sizeInBytes += entry.Size()
		}
	}

	return sizeInBytes
}

func (s *BooleanSearcher) computeQueryNorm() {
	// first calculate sum of squared weights
	sumOfSquaredWeights := 0.0
	if s.mustSearcher != nil {
		sumOfSquaredWeights += s.mustSearcher.Weight()
	}
	if s.shouldSearcher != nil {
		sumOfSquaredWeights += s.shouldSearcher.Weight()
	}

	// now compute query norm from this
	s.queryNorm = 1.0 / math.Sqrt(sumOfSquaredWeights)
	// finally tell all the downstream searchers the norm
	if s.mustSearcher != nil {
		s.mustSearcher.SetQueryNorm(s.queryNorm)
	}
	if s.shouldSearcher != nil {
		s.shouldSearcher.SetQueryNorm(s.queryNorm)
	}
}

func (s *BooleanSearcher) initSearchers(ctx *search.SearchContext) error {
	var err error
	// get all searchers pointing at their first match
	if s.mustSearcher != nil {
		if s.currMust != nil {
			ctx.DocumentMatchPool.Put(s.currMust)
		}
		s.currMust, err = s.mustSearcher.Next(ctx)
		if err != nil {
			return err
		}
	}

	if s.shouldSearcher != nil {
		if s.currShould != nil {
			ctx.DocumentMatchPool.Put(s.currShould)
		}
		s.currShould, err = s.shouldSearcher.Next(ctx)
		if err != nil {
			return err
		}
	}

	if s.mustNotSearcher != nil {
		if s.currMustNot != nil {
			ctx.DocumentMatchPool.Put(s.currMustNot)
		}
		s.currMustNot, err = s.mustNotSearcher.Next(ctx)
		if err != nil {
			return err
		}
	}

	if s.mustSearcher != nil && s.currMust != nil {
		s.currentID = s.currMust.IndexInternalID
	} else if s.mustSearcher == nil && s.currShould != nil {
		s.currentID = s.currShould.IndexInternalID
	} else {
		s.currentID = nil
	}

	s.initialized = true
	return nil
}

func (s *BooleanSearcher) advanceNextMust(ctx *search.SearchContext, skipReturn *search.DocumentMatch) error {
	var err error

	if s.mustSearcher != nil {
		if s.currMust != skipReturn {
			ctx.DocumentMatchPool.Put(s.currMust)
		}
		s.currMust, err = s.mustSearcher.Next(ctx)
		if err != nil {
			return err
		}
	} else {
		if s.currShould != skipReturn {
			ctx.DocumentMatchPool.Put(s.currShould)
		}
		s.currShould, err = s.shouldSearcher.Next(ctx)
		if err != nil {
			return err
		}
	}

	if s.mustSearcher != nil && s.currMust != nil {
		s.currentID = s.currMust.IndexInternalID
	} else if s.mustSearcher == nil && s.currShould != nil {
		s.currentID = s.currShould.IndexInternalID
	} else {
		s.currentID = nil
	}
	return nil
}

func (s *BooleanSearcher) Weight() float64 {
	var rv float64
	if s.mustSearcher != nil {
		rv += s.mustSearcher.Weight()
	}
	if s.shouldSearcher != nil {
		rv += s.shouldSearcher.Weight()
	}

	return rv
}

func (s *BooleanSearcher) SetQueryNorm(qnorm float64) {
	if s.mustSearcher != nil {
		s.mustSearcher.SetQueryNorm(qnorm)
	}
	if s.shouldSearcher != nil {
		s.shouldSearcher.SetQueryNorm(qnorm)
	}
}

func (s *BooleanSearcher) Next(ctx *search.SearchContext) (*search.DocumentMatch, error) {

	if s.done {
		return nil, nil
	}

	if !s.initialized {
		err := s.initSearchers(ctx)
		if err != nil {
			return nil, err
		}
	}

	var err error
	var rv *search.DocumentMatch

	for s.currentID != nil {
		if s.currMustNot != nil {
			cmp := s.currMustNot.IndexInternalID.Compare(s.currentID)
			if cmp < 0 {
				ctx.DocumentMatchPool.Put(s.currMustNot)
				// advance must not searcher to our candidate entry
				s.currMustNot, err = s.mustNotSearcher.Advance(ctx, s.currentID)
				if err != nil {
					return nil, err
				}
				if s.currMustNot != nil && s.currMustNot.IndexInternalID.Equals(s.currentID) {
					// the candidate is excluded
					err = s.advanceNextMust(ctx, nil)
					if err != nil {
						return nil, err
					}
					continue
				}
			} else if cmp == 0 {
				// the candidate is excluded
				err = s.advanceNextMust(ctx, nil)
				if err != nil {
					return nil, err
				}
				continue
			}
		}

		shouldCmpOrNil := 1 // NOTE: shouldCmp will also be 1 when currShould == nil.
		if s.currShould != nil {
			shouldCmpOrNil = s.currShould.IndexInternalID.Compare(s.currentID)
		}

		if shouldCmpOrNil < 0 {
			ctx.DocumentMatchPool.Put(s.currShould)
			// advance should searcher to our candidate entry
			s.currShould, err = s.shouldSearcher.Advance(ctx, s.currentID)
			if err != nil {
				return nil, err
			}
			if s.currShould != nil && s.currShould.IndexInternalID.Equals(s.currentID) {
				// score bonus matches should
				var cons []*search.DocumentMatch
				if s.currMust != nil {
					cons = s.matches
					cons[0] = s.currMust
					cons[1] = s.currShould
				} else {
					cons = s.matches[0:1]
					cons[0] = s.currShould
				}
				rv = s.scorer.Score(ctx, cons)
				err = s.advanceNextMust(ctx, rv)
				if err != nil {
					return nil, err
				}
				break
			} else if s.shouldSearcher.Min() == 0 {
				// match is OK anyway
				cons := s.matches[0:1]
				cons[0] = s.currMust
				rv = s.scorer.Score(ctx, cons)
				err = s.advanceNextMust(ctx, rv)
				if err != nil {
					return nil, err
				}
				break
			}
		} else if shouldCmpOrNil == 0 {
			// score bonus matches should
			var cons []*search.DocumentMatch
			if s.currMust != nil {
				cons = s.matches
				cons[0] = s.currMust
				cons[1] = s.currShould
			} else {
				cons = s.matches[0:1]
				cons[0] = s.currShould
			}
			rv = s.scorer.Score(ctx, cons)
			err = s.advanceNextMust(ctx, rv)
			if err != nil {
				return nil, err
			}
			break
		} else if s.shouldSearcher == nil || s.shouldSearcher.Min() == 0 {
			// match is OK anyway
			cons := s.matches[0:1]
			cons[0] = s.currMust
			rv = s.scorer.Score(ctx, cons)
			err = s.advanceNextMust(ctx, rv)
			if err != nil {
				return nil, err
			}
			break
		}

		err = s.advanceNextMust(ctx, nil)
		if err != nil {
			return nil, err
		}
	}

	if rv == nil {
		s.done = true
	}

	return rv, nil
}

func (s *BooleanSearcher) Advance(ctx *search.SearchContext, ID index.IndexInternalID) (*search.DocumentMatch, error) {

	if s.done {
		return nil, nil
	}

	if !s.initialized {
		err := s.initSearchers(ctx)
		if err != nil {
			return nil, err
		}
	}

	// Advance the searcher only if the cursor is trailing the lookup ID
	if s.currentID == nil || s.currentID.Compare(ID) < 0 {
		var err error
		if s.mustSearcher != nil {
			if s.currMust != nil {
				ctx.DocumentMatchPool.Put(s.currMust)
			}
			s.currMust, err = s.mustSearcher.Advance(ctx, ID)
			if err != nil {
				return nil, err
			}
		}

		if s.shouldSearcher != nil {
			if s.currShould != nil {
				ctx.DocumentMatchPool.Put(s.currShould)
			}
			s.currShould, err = s.shouldSearcher.Advance(ctx, ID)
			if err != nil {
				return nil, err
			}
		}

		if s.mustNotSearcher != nil {
			// Additional check for mustNotSearcher, whose cursor isn't tracked by
			// currentID to prevent it from moving when the searcher's tracked
			// position is already ahead of or at the requested ID.
			if s.currMustNot == nil || s.currMustNot.IndexInternalID.Compare(ID) < 0 {
				if s.currMustNot != nil {
					ctx.DocumentMatchPool.Put(s.currMustNot)
				}
				s.currMustNot, err = s.mustNotSearcher.Advance(ctx, ID)
				if err != nil {
					return nil, err
				}
			}
		}

		if s.mustSearcher != nil && s.currMust != nil {
			s.currentID = s.currMust.IndexInternalID
		} else if s.mustSearcher == nil && s.currShould != nil {
			s.currentID = s.currShould.IndexInternalID
		} else {
			s.currentID = nil
		}
	}

	return s.Next(ctx)
}

func (s *BooleanSearcher) Count() uint64 {

	// for now return a worst case
	var sum uint64
	if s.mustSearcher != nil {
		sum += s.mustSearcher.Count()
	}
	if s.shouldSearcher != nil {
		sum += s.shouldSearcher.Count()
	}
	return sum
}

func (s *BooleanSearcher) Close() error {
	var err0, err1, err2 error
	if s.mustSearcher != nil {
		err0 = s.mustSearcher.Close()
	}
	if s.shouldSearcher != nil {
		err1 = s.shouldSearcher.Close()
	}
	if s.mustNotSearcher != nil {
		err2 = s.mustNotSearcher.Close()
	}
	if err0 != nil {
		return err0
	}
	if err1 != nil {
		return err1
	}
	if err2 != nil {
		return err2
	}
	return nil
}

func (s *BooleanSearcher) Min() int {
	return 0
}

func (s *BooleanSearcher) DocumentMatchPoolSize() int {
	rv := 3
	if s.mustSearcher != nil {
		rv += s.mustSearcher.DocumentMatchPoolSize()
	}
	if s.shouldSearcher != nil {
		rv += s.shouldSearcher.DocumentMatchPoolSize()
	}
	if s.mustNotSearcher != nil {
		rv += s.mustNotSearcher.DocumentMatchPoolSize()
	}
	return rv
}
