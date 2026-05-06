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
	"fmt"

	"github.com/blugelabs/bluge/search/similarity"

	"github.com/blugelabs/bluge/search"
)

type PhraseSearcher struct {
	mustSearcher search.Searcher
	currMust     *search.DocumentMatch
	terms        [][]string
	path         phrasePath
	paths        []phrasePath
	locations    []search.Location
	initialized  bool
	slop         int
}

func (s *PhraseSearcher) Size() int {
	sizeInBytes := reflectStaticSizePhraseSearcher + sizeOfPtr

	if s.mustSearcher != nil {
		sizeInBytes += s.mustSearcher.Size()
	}

	if s.currMust != nil {
		sizeInBytes += s.currMust.Size()
	}

	for _, entry := range s.terms {
		sizeInBytes += sizeOfSlice
		for _, entry1 := range entry {
			sizeInBytes += sizeOfString + len(entry1)
		}
	}

	return sizeInBytes
}

func NewMultiPhraseSearcher(indexReader search.Reader, terms [][]string, field string, scorer search.Scorer,
	options search.SearcherOptions) (*PhraseSearcher, error) {
	return NewSloppyMultiPhraseSearcher(indexReader, terms, field, 0, scorer, options)
}

// NewSloppyMultiPhraseSearcher create a multi-phrase searcher which tolerates a specified "sloppyness"
// the value of the slop parameter restricts the distance between the terms
func NewSloppyMultiPhraseSearcher(indexReader search.Reader, terms [][]string, field string, slop int,
	scorer search.Scorer, options search.SearcherOptions) (*PhraseSearcher, error) {
	options.IncludeTermVectors = true
	var termPositionSearchers []search.Searcher
	for _, termPos := range terms {
		if len(termPos) == 1 && termPos[0] != "" {
			// single term
			ts, err := NewTermSearcher(indexReader, termPos[0], field, 1.0, scorer, options)
			if err != nil {
				// close any searchers already opened
				for _, ts := range termPositionSearchers {
					_ = ts.Close()
				}
				return nil, fmt.Errorf("phrase searcher error building term searcher: %v", err)
			}
			termPositionSearchers = append(termPositionSearchers, ts)
		} else if len(termPos) > 1 {
			// multiple terms
			var termSearchers []search.Searcher
			for _, term := range termPos {
				if term == "" {
					continue
				}
				ts, err := NewTermSearcher(indexReader, term, field, 1.0, scorer, options)
				if err != nil {
					// close any searchers already opened
					for _, ts := range termPositionSearchers {
						_ = ts.Close()
					}
					return nil, fmt.Errorf("phrase searcher error building term searcher: %v", err)
				}
				termSearchers = append(termSearchers, ts)
			}
			disjunction, err := NewDisjunctionSearcher(indexReader, termSearchers, 1,
				similarity.NewCompositeSumScorer(), options)
			if err != nil {
				// close any searchers already opened
				for _, ts := range termPositionSearchers {
					_ = ts.Close()
				}
				return nil, fmt.Errorf("phrase searcher error building term position disjunction searcher: %v",
					err)
			}
			termPositionSearchers = append(termPositionSearchers, disjunction)
		}
	}

	mustSearcher, err := NewConjunctionSearcher(indexReader, termPositionSearchers,
		similarity.NewCompositeSumScorer(), options)
	if err != nil {
		// close any searchers already opened
		for _, ts := range termPositionSearchers {
			_ = ts.Close()
		}
		return nil, fmt.Errorf("phrase searcher error building conjunction searcher: %v", err)
	}

	// build our searcher
	rv := PhraseSearcher{
		mustSearcher: mustSearcher,
		terms:        terms,
		slop:         slop,
	}

	return &rv, nil
}

func (s *PhraseSearcher) initSearchers(ctx *search.Context) error {
	err := s.advanceNextMust(ctx)
	if err != nil {
		return err
	}

	s.initialized = true
	return nil
}

func (s *PhraseSearcher) advanceNextMust(ctx *search.Context) error {
	var err error

	if s.mustSearcher != nil {
		if s.currMust != nil {
			ctx.DocumentMatchPool.Put(s.currMust)
		}
		s.currMust, err = s.mustSearcher.Next(ctx)
		if err != nil {
			return err
		}
	}

	return nil
}

func (s *PhraseSearcher) Next(ctx *search.Context) (*search.DocumentMatch, error) {
	if !s.initialized {
		err := s.initSearchers(ctx)
		if err != nil {
			return nil, err
		}
	}

	for s.currMust != nil {
		// check this match against phrase constraints
		rv := s.checkCurrMustMatch()

		// prepare for next iteration (either loop or subsequent call to Next())
		err := s.advanceNextMust(ctx)
		if err != nil {
			return nil, err
		}

		// if match satisfied phrase constraints return it as a hit
		if rv != nil {
			return rv, nil
		}
	}

	return nil, nil
}

// checkCurrMustMatch is solely concerned with determining if the DocumentMatch
// pointed to by s.currMust (which satisifies the pre-condition searcher)
// also satisfies the phase constraints.  if so, it returns a DocumentMatch
// for this document, otherwise nil
func (s *PhraseSearcher) checkCurrMustMatch() *search.DocumentMatch {
	s.locations = s.currMust.Complete(s.locations)

	locations := s.currMust.Locations
	s.currMust.Locations = nil

	ftls := s.currMust.FieldTermLocations

	// typically we would expect there to only actually be results in
	// one field, but we allow for this to not be the case
	// but, we note that phrase constraints can only be satisfied within
	// a single field, so we can check them each independently
	for field, tlm := range locations {
		ftls = s.checkCurrMustMatchField(field, tlm, ftls)
	}

	if len(ftls) > 0 {
		// return match
		rv := s.currMust
		s.currMust = nil
		rv.FieldTermLocations = ftls
		return rv
	}

	return nil
}

// checkCurrMustMatchField is solely concerned with determining if one
// particular field within the currMust DocumentMatch Locations
// satisfies the phase constraints (possibly more than once).  if so,
// the matching field term locations are appended to the provided
// slice
func (s *PhraseSearcher) checkCurrMustMatchField(field string, tlm search.TermLocationMap,
	ftls []search.FieldTermLocation) []search.FieldTermLocation {
	if s.path == nil {
		s.path = make(phrasePath, 0, len(s.terms))
	}
	s.paths = findPhrasePaths(0, s.terms, tlm, s.path[:0], s.slop, s.paths[:0])
	for _, p := range s.paths {
		for _, pp := range p {
			ftls = append(ftls, search.FieldTermLocation{
				Field: field,
				Term:  pp.term,
				Location: search.Location{
					Pos:   pp.loc.Pos,
					Start: pp.loc.Start,
					End:   pp.loc.End,
				},
			})
		}
	}
	return ftls
}

type phrasePart struct {
	term string
	loc  *search.Location
}

func (p *phrasePart) String() string {
	return fmt.Sprintf("[%s %v]", p.term, p.loc)
}

type phrasePath []phrasePart

func (p phrasePath) MergeInto(in search.TermLocationMap) {
	for _, pp := range p {
		in[pp.term] = append(in[pp.term], pp.loc)
	}
}

func (p phrasePath) String() string {
	rv := "["
	for i, pp := range p {
		if i > 0 {
			rv += ", "
		}
		rv += pp.String()
	}
	rv += "]"
	return rv
}

// findPhrasePaths is a function to identify phase matches from a set
// of known term locations.  it recursive so care must be taken with
// arguments and return values.
//
// prevPos - the previous location, 0 on first invocation
// phraseTerms - slice containing the phrase terms,
//               may contain empty string as placeholder (don't care)
// tlm - the Term Location Map containing all relevant term locations
// p - the current path being explored (appended to in recursive calls)
//     this is the primary state being built during the traversal
// remainingSlop - amount of sloppiness that's allowed, which is the
//        sum of the editDistances from each matching phrase part,
//        where 0 means no sloppiness allowed (all editDistances must be 0),
//        decremented during recursion
// rv - the final result being appended to by all the recursive calls
//
// returns slice of paths, or nil if invocation did not find any successul paths
func findPhrasePaths(prevPos int, phraseTerms [][]string,
	tlm search.TermLocationMap, p phrasePath, remainingSlop int, rv []phrasePath) []phrasePath {
	// no more terms
	if len(phraseTerms) < 1 {
		// snapshot or copy the recursively built phrasePath p and
		// append it to the rv, also optimizing by checking if next
		// phrasePath item in the rv (which we're about to overwrite)
		// is available for reuse
		var pcopy phrasePath
		if len(rv) < cap(rv) {
			pcopy = rv[:len(rv)+1][len(rv)][:0]
		}
		return append(rv, append(pcopy, p...))
	}

	car := phraseTerms[0]
	cdr := phraseTerms[1:]

	// empty term is treated as match (continue)
	if len(car) == 0 || (len(car) == 1 && car[0] == "") {
		nextPos := prevPos + 1
		if prevPos == 0 {
			// if prevPos was 0, don't set it to 1 (as thats not a real abs pos)
			nextPos = 0 // don't advance nextPos if prevPos was 0
		}
		return findPhrasePaths(nextPos, cdr, tlm, p, remainingSlop, rv)
	}

	// locations for this term
	for _, carTerm := range car {
		locations := tlm[carTerm]
	LOCATIONS_LOOP:
		for _, loc := range locations {
			// compute distance from previous phrase term
			dist := 0
			if prevPos != 0 {
				dist = editDistance(prevPos+1, loc.Pos)
			}

			// if enough slop remaining, continue recursively
			if prevPos == 0 || (remainingSlop-dist) >= 0 {
				// skip if we've already used this term+loc already
				for _, ppart := range p {
					if ppart.term == carTerm && ppart.loc == loc {
						continue LOCATIONS_LOOP
					}
				}

				// this location works, add it to the path (but not for empty term)
				px := append(p, phrasePart{term: carTerm, loc: loc})
				rv = findPhrasePaths(loc.Pos, cdr, tlm, px, remainingSlop-dist, rv)
			}
		}
	}
	return rv
}

func editDistance(p1, p2 int) int {
	dist := p1 - p2
	if dist < 0 {
		return -dist
	}
	return dist
}

func (s *PhraseSearcher) Advance(ctx *search.Context, number uint64) (*search.DocumentMatch, error) {
	if !s.initialized {
		err := s.initSearchers(ctx)
		if err != nil {
			return nil, err
		}
	}
	if s.currMust != nil {
		if s.currMust.Number >= number {
			return s.Next(ctx)
		}
		ctx.DocumentMatchPool.Put(s.currMust)
	}
	if s.currMust == nil {
		return nil, nil
	}
	var err error
	s.currMust, err = s.mustSearcher.Advance(ctx, number)
	if err != nil {
		return nil, err
	}
	return s.Next(ctx)
}

func (s *PhraseSearcher) Count() uint64 {
	// for now return a worst case
	return s.mustSearcher.Count()
}

func (s *PhraseSearcher) Close() error {
	if s.mustSearcher != nil {
		err := s.mustSearcher.Close()
		if err != nil {
			return err
		}
	}
	return nil
}

func (s *PhraseSearcher) Min() int {
	return 0
}

func (s *PhraseSearcher) DocumentMatchPoolSize() int {
	return s.mustSearcher.DocumentMatchPoolSize() + 1
}
