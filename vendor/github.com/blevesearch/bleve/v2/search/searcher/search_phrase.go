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
	"fmt"
	"math"
	"reflect"

	"github.com/blevesearch/bleve/v2/search"
	"github.com/blevesearch/bleve/v2/size"
	index "github.com/blevesearch/bleve_index_api"
)

var reflectStaticSizePhraseSearcher int

func init() {
	var ps PhraseSearcher
	reflectStaticSizePhraseSearcher = int(reflect.TypeOf(ps).Size())
}

type PhraseSearcher struct {
	mustSearcher search.Searcher
	queryNorm    float64
	currMust     *search.DocumentMatch
	terms        [][]string
	path         phrasePath
	paths        []phrasePath
	locations    []search.Location
	initialized  bool
	// map a term to a list of fuzzy terms that match it
	fuzzyTermMatches map[string][]string
}

func (s *PhraseSearcher) Size() int {
	sizeInBytes := reflectStaticSizePhraseSearcher + size.SizeOfPtr

	if s.mustSearcher != nil {
		sizeInBytes += s.mustSearcher.Size()
	}

	if s.currMust != nil {
		sizeInBytes += s.currMust.Size()
	}

	for _, entry := range s.terms {
		sizeInBytes += size.SizeOfSlice
		for _, entry1 := range entry {
			sizeInBytes += size.SizeOfString + len(entry1)
		}
	}

	return sizeInBytes
}

func NewPhraseSearcher(ctx context.Context, indexReader index.IndexReader, terms []string,
	fuzziness int, autoFuzzy bool, field string, boost float64, options search.SearcherOptions) (*PhraseSearcher, error) {

	// turn flat terms []string into [][]string
	mterms := make([][]string, len(terms))
	for i, term := range terms {
		mterms[i] = []string{term}
	}
	return NewMultiPhraseSearcher(ctx, indexReader, mterms, fuzziness, autoFuzzy, field, boost, options)
}

func NewMultiPhraseSearcher(ctx context.Context, indexReader index.IndexReader, terms [][]string,
	fuzziness int, autoFuzzy bool, field string, boost float64, options search.SearcherOptions) (*PhraseSearcher, error) {

	options.IncludeTermVectors = true
	var termPositionSearchers []search.Searcher
	var err error
	var ts search.Searcher
	// The following logic checks if fuzziness is enabled.
	// Fuzziness is considered enabled if either:
	//    a. `fuzziness` is greater than 0, or
	//    b. `autoFuzzy` is set to true.
	// if both conditions are true, `autoFuzzy` takes precedence.
	// If enabled, a map will be created to store the matches for fuzzy terms.
	fuzzinessEnabled := autoFuzzy || fuzziness > 0
	var fuzzyTermMatches map[string][]string
	if fuzzinessEnabled {
		fuzzyTermMatches = make(map[string][]string)
		ctx = context.WithValue(ctx, search.FuzzyMatchPhraseKey, fuzzyTermMatches)
	}
	// in case of fuzzy multi-phrase, phrase and match-phrase queries we hardcode the
	// prefix length to 0, as setting a per word matching prefix length would not
	// make sense from a user perspective.
	for _, termPos := range terms {
		if len(termPos) == 1 && termPos[0] != "" {
			// single term
			if fuzzinessEnabled {
				// fuzzy
				if autoFuzzy {
					// auto fuzzy
					ts, err = NewAutoFuzzySearcher(ctx, indexReader, termPos[0], 0, field, boost, options)
				} else {
					// non-auto fuzzy
					ts, err = NewFuzzySearcher(ctx, indexReader, termPos[0], 0, fuzziness, field, boost, options)
				}
			} else {
				// non-fuzzy
				ts, err = NewTermSearcher(ctx, indexReader, termPos[0], field, boost, options)
			}
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
				if fuzzinessEnabled {
					// fuzzy
					if autoFuzzy {
						// auto fuzzy
						ts, err = NewAutoFuzzySearcher(ctx, indexReader, term, 0, field, boost, options)
					} else {
						// non-auto fuzzy
						ts, err = NewFuzzySearcher(ctx, indexReader, term, 0, fuzziness, field, boost, options)
					}
				} else {
					// non-fuzzy
					ts, err = NewTermSearcher(ctx, indexReader, term, field, boost, options)
				}
				if err != nil {
					// close any searchers already opened
					for _, ts := range termPositionSearchers {
						_ = ts.Close()
					}
					return nil, fmt.Errorf("phrase searcher error building term searcher: %v", err)
				}
				termSearchers = append(termSearchers, ts)
			}
			disjunction, err := NewDisjunctionSearcher(ctx, indexReader, termSearchers, 1, options)
			if err != nil {
				// close any searchers already opened
				for _, ts := range termPositionSearchers {
					_ = ts.Close()
				}
				return nil, fmt.Errorf("phrase searcher error building term position disjunction searcher: %v", err)
			}
			termPositionSearchers = append(termPositionSearchers, disjunction)
		}
	}

	if ctx != nil {
		if fts, ok := ctx.Value(search.FieldTermSynonymMapKey).(search.FieldTermSynonymMap); ok {
			if ts, exists := fts[field]; exists {
				if fuzzinessEnabled {
					for term, fuzzyTerms := range fuzzyTermMatches {
						fuzzySynonymTerms := make([]string, 0, len(fuzzyTerms))
						if s, found := ts[term]; found {
							fuzzySynonymTerms = append(fuzzySynonymTerms, s...)
						}
						for _, fuzzyTerm := range fuzzyTerms {
							if fuzzyTerm == term {
								continue
							}
							if s, found := ts[fuzzyTerm]; found {
								fuzzySynonymTerms = append(fuzzySynonymTerms, s...)
							}
						}
						if len(fuzzySynonymTerms) > 0 {
							fuzzyTermMatches[term] = append(fuzzyTermMatches[term], fuzzySynonymTerms...)
						}
					}
				} else {
					for _, termPos := range terms {
						for _, term := range termPos {
							if s, found := ts[term]; found {
								if fuzzyTermMatches == nil {
									fuzzyTermMatches = make(map[string][]string)
								}
								fuzzyTermMatches[term] = s
							}
						}
					}
				}
			}
		}
	}
	mustSearcher, err := NewConjunctionSearcher(ctx, indexReader, termPositionSearchers, options)
	if err != nil {
		// close any searchers already opened
		for _, ts := range termPositionSearchers {
			_ = ts.Close()
		}
		return nil, fmt.Errorf("phrase searcher error building conjunction searcher: %v", err)
	}

	// build our searcher
	rv := PhraseSearcher{
		mustSearcher:     mustSearcher,
		terms:            terms,
		fuzzyTermMatches: fuzzyTermMatches,
	}
	rv.computeQueryNorm()
	return &rv, nil
}

func (s *PhraseSearcher) computeQueryNorm() {
	// first calculate sum of squared weights
	sumOfSquaredWeights := 0.0
	if s.mustSearcher != nil {
		sumOfSquaredWeights += s.mustSearcher.Weight()
	}

	// now compute query norm from this
	s.queryNorm = 1.0 / math.Sqrt(sumOfSquaredWeights)
	// finally tell all the downstream searchers the norm
	if s.mustSearcher != nil {
		s.mustSearcher.SetQueryNorm(s.queryNorm)
	}
}

func (s *PhraseSearcher) initSearchers(ctx *search.SearchContext) error {
	err := s.advanceNextMust(ctx)
	if err != nil {
		return err
	}

	s.initialized = true
	return nil
}

func (s *PhraseSearcher) advanceNextMust(ctx *search.SearchContext) error {
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

func (s *PhraseSearcher) Weight() float64 {
	return s.mustSearcher.Weight()
}

func (s *PhraseSearcher) SetQueryNorm(qnorm float64) {
	s.mustSearcher.SetQueryNorm(qnorm)
}

func (s *PhraseSearcher) Next(ctx *search.SearchContext) (*search.DocumentMatch, error) {
	if !s.initialized {
		err := s.initSearchers(ctx)
		if err != nil {
			return nil, err
		}
	}

	for s.currMust != nil {
		// check this match against phrase constraints
		rv := s.checkCurrMustMatch(ctx)

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
// pointed to by s.currMust (which satisfies the pre-condition searcher)
// also satisfies the phrase constraints.  if so, it returns a DocumentMatch
// for this document, otherwise nil
func (s *PhraseSearcher) checkCurrMustMatch(ctx *search.SearchContext) *search.DocumentMatch {
	s.locations = s.currMust.Complete(s.locations)

	locations := s.currMust.Locations
	s.currMust.Locations = nil

	ftls := s.currMust.FieldTermLocations

	// typically we would expect there to only actually be results in
	// one field, but we allow for this to not be the case
	// but, we note that phrase constraints can only be satisfied within
	// a single field, so we can check them each independently
	for field, tlm := range locations {
		ftls = s.checkCurrMustMatchField(ctx, field, tlm, ftls)
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
// satisfies the phrase constraints (possibly more than once).  if so,
// the matching field term locations are appended to the provided
// slice
func (s *PhraseSearcher) checkCurrMustMatchField(ctx *search.SearchContext,
	field string, tlm search.TermLocationMap,
	ftls []search.FieldTermLocation) []search.FieldTermLocation {
	if s.path == nil {
		s.path = make(phrasePath, 0, len(s.terms))
	}
	var tlmPtr *search.TermLocationMap = &tlm
	if s.fuzzyTermMatches != nil {
		// if fuzzy search, we need to expand the tlm to include all the fuzzy matches
		// Example - term is "foo" and fuzzy matches are "foo", "fool", "food"
		// the non expanded tlm will be:
		//	foo  -> Locations[foo]
		//	fool -> Locations[fool]
		//	food -> Locations[food]
		// the expanded tlm will be:
		//   foo -> [Locations[foo], Locations[fool], Locations[food]]
		expandedTlm := make(search.TermLocationMap)
		s.expandFuzzyMatches(tlm, expandedTlm)
		tlmPtr = &expandedTlm
	}
	s.paths = findPhrasePaths(0, nil, s.terms, *tlmPtr, s.path[:0], 0, s.paths[:0])
	for _, p := range s.paths {
		for _, pp := range p {
			ftls = append(ftls, search.FieldTermLocation{
				Field: field,
				Term:  pp.term,
				Location: search.Location{
					Pos:            pp.loc.Pos,
					Start:          pp.loc.Start,
					End:            pp.loc.End,
					ArrayPositions: pp.loc.ArrayPositions,
				},
			})
		}
	}
	return ftls
}

func (s *PhraseSearcher) expandFuzzyMatches(tlm search.TermLocationMap, expandedTlm search.TermLocationMap) {
	for term, fuzzyMatches := range s.fuzzyTermMatches {
		locations := tlm[term]
		for _, fuzzyMatch := range fuzzyMatches {
			if fuzzyMatch == term {
				continue
			}
			locations = append(locations, tlm[fuzzyMatch]...)
		}
		expandedTlm[term] = locations
	}
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

// findPhrasePaths is a function to identify phrase matches from a set
// of known term locations.  it recursive so care must be taken with
// arguments and return values.
//
// prevPos - the previous location, 0 on first invocation
//
// ap - array positions of the first candidate phrase part to
// which further recursive phrase parts must match,
// nil on initial invocation or when there are no array positions
//
// phraseTerms - slice containing the phrase terms,
// may contain empty string as placeholder (don't care)
//
// tlm - the Term Location Map containing all relevant term locations
//
// p - the current path being explored (appended to in recursive calls)
// this is the primary state being built during the traversal
//
// remainingSlop - amount of sloppiness that's allowed, which is the
// sum of the editDistances from each matching phrase part, where 0 means no
// sloppiness allowed (all editDistances must be 0), decremented during recursion
//
// rv - the final result being appended to by all the recursive calls
//
// returns slice of paths, or nil if invocation did not find any successful paths
func findPhrasePaths(prevPos uint64, ap search.ArrayPositions, phraseTerms [][]string,
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
			// if prevPos was 0, don't set it to 1 (as that's not a real abs pos)
			nextPos = 0 // don't advance nextPos if prevPos was 0
		}
		return findPhrasePaths(nextPos, ap, cdr, tlm, p, remainingSlop, rv)
	}

	// locations for this term
	for _, carTerm := range car {
		locations := tlm[carTerm]
	LOCATIONS_LOOP:
		for _, loc := range locations {
			if prevPos != 0 && !loc.ArrayPositions.Equals(ap) {
				// if the array positions are wrong, can't match, try next location
				continue
			}

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
				rv = findPhrasePaths(loc.Pos, loc.ArrayPositions, cdr, tlm, px, remainingSlop-dist, rv)
			}
		}
	}
	return rv
}

func editDistance(p1, p2 uint64) int {
	dist := int(p1 - p2)
	if dist < 0 {
		return -dist
	}
	return dist
}

func (s *PhraseSearcher) Advance(ctx *search.SearchContext, ID index.IndexInternalID) (*search.DocumentMatch, error) {
	if !s.initialized {
		err := s.initSearchers(ctx)
		if err != nil {
			return nil, err
		}
	}
	if s.currMust != nil {
		if s.currMust.IndexInternalID.Compare(ID) >= 0 {
			return s.Next(ctx)
		}
		ctx.DocumentMatchPool.Put(s.currMust)
	}
	if s.currMust == nil {
		return nil, nil
	}
	var err error
	s.currMust, err = s.mustSearcher.Advance(ctx, ID)
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
