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
	"bytes"
	"context"
	"math"
	"sort"

	"github.com/blevesearch/bleve/v2/numeric"
	"github.com/blevesearch/bleve/v2/search"
	index "github.com/blevesearch/bleve_index_api"
)

func NewNumericRangeSearcher(ctx context.Context, indexReader index.IndexReader,
	min *float64, max *float64, inclusiveMin, inclusiveMax *bool, field string,
	boost float64, options search.SearcherOptions) (search.Searcher, error) {
	// account for unbounded edges
	if min == nil {
		negInf := math.Inf(-1)
		min = &negInf
	}
	if max == nil {
		Inf := math.Inf(1)
		max = &Inf
	}
	if inclusiveMin == nil {
		defaultInclusiveMin := true
		inclusiveMin = &defaultInclusiveMin
	}
	if inclusiveMax == nil {
		defaultInclusiveMax := false
		inclusiveMax = &defaultInclusiveMax
	}
	// find all the ranges
	minInt64 := numeric.Float64ToInt64(*min)
	if !*inclusiveMin && minInt64 != math.MaxInt64 {
		minInt64++
	}
	maxInt64 := numeric.Float64ToInt64(*max)
	if !*inclusiveMax && maxInt64 != math.MinInt64 {
		maxInt64--
	}

	var fieldDict index.FieldDictContains
	var dictBytesRead uint64
	var isIndexed filterFunc
	var err error
	if irr, ok := indexReader.(index.IndexReaderContains); ok {
		fieldDict, err = irr.FieldDictContains(field)
		if err != nil {
			return nil, err
		}

		isIndexed = func(term []byte) bool {
			found, err := fieldDict.Contains(term)
			return err == nil && found
		}

		dictBytesRead = fieldDict.BytesRead()
	}

	// FIXME hard-coded precision, should match field declaration
	termRanges := splitInt64Range(minInt64, maxInt64, 4)
	terms := termRanges.Enumerate(isIndexed)
	if fieldDict != nil {
		if fd, ok := fieldDict.(index.FieldDict); ok {
			if err = fd.Close(); err != nil {
				return nil, err
			}
		}
	}

	if len(terms) < 1 {
		// reporting back the IO stats with respect to the dictionary
		// loaded, using the context
		if ctx != nil {
			reportIOStats(ctx, dictBytesRead)
			search.RecordSearchCost(ctx, search.AddM, dictBytesRead)
		}

		// cannot return MatchNoneSearcher because of interaction with
		// commit f391b991c20f02681bacd197afc6d8aed444e132
		return NewMultiTermSearcherBytes(ctx, indexReader, terms, field,
			boost, options, true)
	}

	// for upside_down
	if isIndexed == nil {
		terms, err = filterCandidateTerms(indexReader, terms, field)
		if err != nil {
			return nil, err
		}
	}

	if tooManyClauses(len(terms)) {
		return nil, tooManyClausesErr(field, len(terms))
	}

	if ctx != nil {
		reportIOStats(ctx, dictBytesRead)
		search.RecordSearchCost(ctx, search.AddM, dictBytesRead)
	}

	return NewMultiTermSearcherBytes(ctx, indexReader, terms, field,
		boost, options, true)
}

func filterCandidateTerms(indexReader index.IndexReader,
	terms [][]byte, field string) (rv [][]byte, err error) {

	fieldDict, err := indexReader.FieldDictRange(field, terms[0], terms[len(terms)-1])
	if err != nil {
		return nil, err
	}

	// enumerate the terms and check against list of terms
	tfd, err := fieldDict.Next()
	for err == nil && tfd != nil {
		termBytes := []byte(tfd.Term)
		i := sort.Search(len(terms), func(i int) bool { return bytes.Compare(terms[i], termBytes) >= 0 })
		if i < len(terms) && bytes.Compare(terms[i], termBytes) == 0 {
			rv = append(rv, terms[i])
		}
		terms = terms[i:]
		tfd, err = fieldDict.Next()
	}

	if cerr := fieldDict.Close(); cerr != nil && err == nil {
		err = cerr
	}

	return rv, err
}

type termRange struct {
	startTerm []byte
	endTerm   []byte
}

func (t *termRange) Enumerate(filter filterFunc) [][]byte {
	var rv [][]byte
	next := t.startTerm
	for bytes.Compare(next, t.endTerm) <= 0 {
		if filter != nil {
			if filter(next) {
				rv = append(rv, next)
			}
		} else {
			rv = append(rv, next)
		}
		next = incrementBytes(next)
	}
	return rv
}

func incrementBytes(in []byte) []byte {
	rv := make([]byte, len(in))
	copy(rv, in)
	for i := len(rv) - 1; i >= 0; i-- {
		rv[i] = rv[i] + 1
		if rv[i] != 0 {
			// didn't overflow, so stop
			break
		}
	}
	return rv
}

type termRanges []*termRange

func (tr termRanges) Enumerate(filter filterFunc) [][]byte {
	var rv [][]byte
	for _, tri := range tr {
		trie := tri.Enumerate(filter)
		rv = append(rv, trie...)
	}
	return rv
}

func splitInt64Range(minBound, maxBound int64, precisionStep uint) termRanges {
	rv := make(termRanges, 0)
	if minBound > maxBound {
		return rv
	}

	for shift := uint(0); ; shift += precisionStep {

		diff := int64(1) << (shift + precisionStep)
		mask := ((int64(1) << precisionStep) - int64(1)) << shift
		hasLower := (minBound & mask) != int64(0)
		hasUpper := (maxBound & mask) != mask

		var nextMinBound int64
		if hasLower {
			nextMinBound = (minBound + diff) &^ mask
		} else {
			nextMinBound = minBound &^ mask
		}
		var nextMaxBound int64
		if hasUpper {
			nextMaxBound = (maxBound - diff) &^ mask
		} else {
			nextMaxBound = maxBound &^ mask
		}

		lowerWrapped := nextMinBound < minBound
		upperWrapped := nextMaxBound > maxBound

		if shift+precisionStep >= 64 || nextMinBound > nextMaxBound ||
			lowerWrapped || upperWrapped {
			// We are in the lowest precision or the next precision is not available.
			rv = append(rv, newRange(minBound, maxBound, shift))
			// exit the split recursion loop
			break
		}

		if hasLower {
			rv = append(rv, newRange(minBound, minBound|mask, shift))
		}
		if hasUpper {
			rv = append(rv, newRange(maxBound&^mask, maxBound, shift))
		}

		// recurse to next precision
		minBound = nextMinBound
		maxBound = nextMaxBound
	}

	return rv
}

func newRange(minBound, maxBound int64, shift uint) *termRange {
	maxBound |= (int64(1) << shift) - int64(1)
	minBytes := numeric.MustNewPrefixCodedInt64(minBound, shift)
	maxBytes := numeric.MustNewPrefixCodedInt64(maxBound, shift)
	return newRangeBytes(minBytes, maxBytes)
}

func newRangeBytes(minBytes, maxBytes []byte) *termRange {
	return &termRange{
		startTerm: minBytes,
		endTerm:   maxBytes,
	}
}
