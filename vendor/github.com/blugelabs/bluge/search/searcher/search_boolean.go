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
	"github.com/blugelabs/bluge/search"
)

type BooleanSearcher struct {
	mustSearcher    search.Searcher
	shouldSearcher  search.Searcher
	mustNotSearcher search.Searcher
	currMust        *search.DocumentMatch
	currShould      *search.DocumentMatch
	currMustNot     *search.DocumentMatch
	currentMatch    *search.DocumentMatch
	scorer          search.CompositeScorer
	matches         []*search.DocumentMatch
	initialized     bool
	done            bool
	options         search.SearcherOptions
}

func NewBooleanSearcher(mustSearcher, shouldSearcher, mustNotSearcher search.Searcher,
	scorer search.CompositeScorer, options search.SearcherOptions) (*BooleanSearcher, error) {
	// build our searcher
	rv := BooleanSearcher{
		mustSearcher:    mustSearcher,
		shouldSearcher:  shouldSearcher,
		mustNotSearcher: mustNotSearcher,
		scorer:          scorer,
		matches:         make([]*search.DocumentMatch, 2),
		options:         options,
	}
	return &rv, nil
}

func (s *BooleanSearcher) Size() int {
	sizeInBytes := reflectStaticSizeBooleanSearcher + sizeOfPtr

	if s.mustSearcher != nil {
		sizeInBytes += s.mustSearcher.Size()
	}

	if s.shouldSearcher != nil {
		sizeInBytes += s.shouldSearcher.Size()
	}

	if s.mustNotSearcher != nil {
		sizeInBytes += s.mustNotSearcher.Size()
	}

	for _, entry := range s.matches {
		if entry != nil {
			sizeInBytes += entry.Size()
		}
	}

	return sizeInBytes
}

func (s *BooleanSearcher) initSearchers(ctx *search.Context) error {
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
		s.currentMatch = s.currMust
	} else if s.mustSearcher == nil && s.currShould != nil {
		s.currentMatch = s.currShould
	} else {
		s.currentMatch = nil
	}

	s.initialized = true
	return nil
}

func (s *BooleanSearcher) advanceNextMust(ctx *search.Context, skipReturn *search.DocumentMatch) error {
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
		s.currentMatch = s.currMust
	} else if s.mustSearcher == nil && s.currShould != nil {
		s.currentMatch = s.currShould
	} else {
		s.currentMatch = nil
	}
	return nil
}

func (s *BooleanSearcher) Next(ctx *search.Context) (*search.DocumentMatch, error) {
	if s.done {
		return nil, nil
	}

	if !s.initialized {
		err := s.initSearchers(ctx)
		if err != nil {
			return nil, err
		}
	}

	rv, err := s.nextInternal(ctx)
	if err != nil {
		return nil, err
	}

	if rv == nil {
		s.done = true
	}

	return rv, nil
}

func (s *BooleanSearcher) nextInternal(ctx *search.Context) (rv *search.DocumentMatch, err error) {
	for s.currentMatch != nil {
		if s.currMustNot != nil {
			var mustNotExcludesCandidate bool
			mustNotExcludesCandidate, err = s.doesMustNotExcludeCandidate(ctx)
			if err != nil {
				return nil, err
			}
			if mustNotExcludesCandidate {
				continue
			}
		}

		shouldCmpOrNil := 1 // NOTE: shouldCmp will also be 1 when currShould == nil.
		if s.currShould != nil {
			shouldCmpOrNil = docNumberCompare(s.currShould.Number, s.currentMatch.Number)
		}

		if shouldCmpOrNil < 0 {
			ctx.DocumentMatchPool.Put(s.currShould)
			// advance should searcher to our candidate entry
			s.currShould, err = s.shouldSearcher.Advance(ctx, s.currentMatch.Number)
			if err != nil {
				return nil, err
			}
			if s.currShould != nil && s.currShould.Number == s.currentMatch.Number {
				// score bonus matches should
				rv = s.buildDocumentMatch(s.buildConstituents())
				err = s.advanceNextMust(ctx, rv)
				if err != nil {
					return nil, err
				}
				break
			} else if s.shouldSearcher.Min() == 0 {
				// match is OK anyway
				cons := s.matches[0:1]
				cons[0] = s.currMust
				rv = s.buildDocumentMatch(cons)
				err = s.advanceNextMust(ctx, rv)
				if err != nil {
					return nil, err
				}
				break
			}
		} else if shouldCmpOrNil == 0 {
			// score bonus matches should
			rv = s.buildDocumentMatch(s.buildConstituents())
			err = s.advanceNextMust(ctx, rv)
			if err != nil {
				return nil, err
			}
			break
		} else if s.shouldSearcher == nil || s.shouldSearcher.Min() == 0 {
			// match is OK anyway
			cons := s.matches[0:1]
			cons[0] = s.currMust
			rv = s.buildDocumentMatch(cons)
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
	return rv, nil
}

func (s *BooleanSearcher) doesMustNotExcludeCandidate(ctx *search.Context) (excluded bool, err error) {
	cmp := docNumberCompare(s.currMustNot.Number, s.currentMatch.Number)
	if cmp < 0 {
		ctx.DocumentMatchPool.Put(s.currMustNot)
		// advance must not searcher to our candidate entry
		s.currMustNot, err = s.mustNotSearcher.Advance(ctx, s.currentMatch.Number)
		if err != nil {
			return false, err
		}
		if s.currMustNot != nil && s.currMustNot.Number == s.currentMatch.Number {
			// the candidate is excluded
			err = s.advanceNextMust(ctx, nil)
			if err != nil {
				return false, err
			}
			return true, nil
		}
	} else if cmp == 0 {
		// the candidate is excluded
		err = s.advanceNextMust(ctx, nil)
		if err != nil {
			return false, err
		}
		return true, nil
	}
	return false, nil
}

func (s *BooleanSearcher) buildConstituents() []*search.DocumentMatch {
	var cons []*search.DocumentMatch
	if s.currMust != nil {
		cons = s.matches
		cons[0] = s.currMust
		cons[1] = s.currShould
	} else {
		cons = s.matches[0:1]
		cons[0] = s.currShould
	}
	return cons
}

func (s *BooleanSearcher) Advance(ctx *search.Context, number uint64) (*search.DocumentMatch, error) {
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
	if s.currentMatch == nil || docNumberCompare(s.currentMatch.Number, number) < 0 {
		err := s.advanceIfTrailing(ctx, number)
		if err != nil {
			return nil, err
		}
	}

	return s.Next(ctx)
}

func (s *BooleanSearcher) advanceIfTrailing(ctx *search.Context, number uint64) error {
	var err error
	if s.mustSearcher != nil {
		if s.currMust != nil {
			ctx.DocumentMatchPool.Put(s.currMust)
		}
		s.currMust, err = s.mustSearcher.Advance(ctx, number)
		if err != nil {
			return err
		}
	}

	if s.shouldSearcher != nil {
		if s.currShould != nil {
			ctx.DocumentMatchPool.Put(s.currShould)
		}
		s.currShould, err = s.shouldSearcher.Advance(ctx, number)
		if err != nil {
			return err
		}
	}

	if s.mustNotSearcher != nil {
		// Additional check for mustNotSearcher, whose cursor isn't tracked by
		// currentID to prevent it from moving when the searcher's tracked
		// position is already ahead of or at the requested ID.
		if s.currMustNot == nil || s.currMustNot.Number < number {
			if s.currMustNot != nil {
				ctx.DocumentMatchPool.Put(s.currMustNot)
			}
			s.currMustNot, err = s.mustNotSearcher.Advance(ctx, number)
			if err != nil {
				return err
			}
		}
	}

	if s.mustSearcher != nil && s.currMust != nil {
		s.currentMatch = s.currMust
	} else if s.mustSearcher == nil && s.currShould != nil {
		s.currentMatch = s.currShould
	} else {
		s.currentMatch = nil
	}
	return nil
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

func (s *BooleanSearcher) buildDocumentMatch(constituents []*search.DocumentMatch) *search.DocumentMatch {
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
