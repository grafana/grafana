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

	"github.com/blugelabs/bluge/search"
)

func NewMultiTermSearcher(indexReader search.Reader, terms []string,
	field string, boost float64, scorer search.Scorer, compScorer search.CompositeScorer,
	options search.SearcherOptions, limit bool) (
	search.Searcher, error) {
	if tooManyClauses(len(terms)) {
		if optionsDisjunctionOptimizable(options) {
			return optimizeMultiTermSearcher(indexReader, terms, nil, field, boost, scorer, options)
		}
		if limit {
			return nil, tooManyClausesErr(field, len(terms))
		}
	}

	qsearchers, err := makeBatchSearchers(indexReader, terms, nil, field, boost, scorer, options)
	if err != nil {
		return nil, err
	}

	// build disjunction searcher of these ranges
	return newMultiTermSearcherInternal(indexReader, qsearchers, compScorer, options, limit)
}

func NewMultiTermSearcherIndividualBoost(indexReader search.Reader, terms []string, termBoosts []float64,
	field string, boost float64, scorer search.Scorer, compScorer search.CompositeScorer,
	options search.SearcherOptions, limit bool) (search.Searcher, error) {
	if tooManyClauses(len(terms)) {
		if optionsDisjunctionOptimizable(options) {
			return optimizeMultiTermSearcher(indexReader, terms, termBoosts, field, boost, scorer, options)
		}
		if limit {
			return nil, tooManyClausesErr(field, len(terms))
		}
	}

	qsearchers, err := makeBatchSearchers(indexReader, terms, termBoosts, field, boost, scorer, options)
	if err != nil {
		return nil, err
	}

	// build disjunction searcher of these ranges
	return newMultiTermSearcherInternal(indexReader, qsearchers, compScorer, options, limit)
}

func NewMultiTermSearcherBytes(indexReader search.Reader, terms [][]byte,
	field string, boost float64, scorer search.Scorer, compScorer search.CompositeScorer,
	options search.SearcherOptions, limit bool) (search.Searcher, error) {
	if tooManyClauses(len(terms)) {
		if optionsDisjunctionOptimizable(options) {
			return optimizeMultiTermSearcherBytes(indexReader, terms, field, boost, scorer, options)
		}

		if limit {
			return nil, tooManyClausesErr(field, len(terms))
		}
	}

	qsearchers, err := makeBatchSearchersBytes(indexReader, terms, field, boost, scorer, options)
	if err != nil {
		return nil, err
	}

	// build disjunction searcher of these ranges
	return newMultiTermSearcherInternal(indexReader, qsearchers, compScorer, options, limit)
}

func newMultiTermSearcherInternal(indexReader search.Reader,
	searchers []search.Searcher, compScorer search.CompositeScorer,
	options search.SearcherOptions, limit bool) (
	search.Searcher, error) {
	// build disjunction searcher of these ranges
	searcher, err := newDisjunctionSearcher(indexReader, searchers, 0, compScorer, options,
		limit)
	if err != nil {
		for _, s := range searchers {
			_ = s.Close()
		}
		return nil, err
	}

	return searcher, nil
}

func optimizeMultiTermSearcher(indexReader search.Reader, terms []string, termBoosts []float64,
	field string, boost float64, scorer search.Scorer, options search.SearcherOptions) (
	search.Searcher, error) {
	var finalSearcher search.Searcher
	for len(terms) > 0 {
		var batchTerms []string
		var batchBoosts []float64
		if len(terms) > DisjunctionMaxClauseCount {
			batchTerms = terms[:DisjunctionMaxClauseCount]
			terms = terms[DisjunctionMaxClauseCount:]
			if termBoosts != nil {
				batchBoosts = termBoosts[:DisjunctionMaxClauseCount]
				termBoosts = termBoosts[DisjunctionMaxClauseCount:]
			}
		} else {
			batchTerms = terms
			terms = nil
			batchBoosts = termBoosts
			termBoosts = nil
		}
		batch, err := makeBatchSearchers(indexReader, batchTerms, batchBoosts, field, boost, scorer, options)
		if err != nil {
			return nil, err
		}
		if finalSearcher != nil {
			batch = append(batch, finalSearcher)
		}
		cleanup := func() {
			for _, searcher := range batch {
				if searcher != nil {
					_ = searcher.Close()
				}
			}
		}
		finalSearcher, err = optimizeCompositeSearcher("disjunction:unadorned",
			indexReader, batch, options)
		// all searchers in batch should be closed, regardless of error or optimization failure
		// either we're returning, or continuing and only finalSearcher is needed for next loop
		cleanup()
		if err != nil {
			return nil, err
		}
		if finalSearcher == nil {
			return nil, fmt.Errorf("unable to optimize")
		}
	}
	return finalSearcher, nil
}

func makeBatchSearchers(indexReader search.Reader, terms []string, termBoosts []float64, field string,
	boost float64, scorer search.Scorer, options search.SearcherOptions) ([]search.Searcher, error) {
	qsearchers := make([]search.Searcher, len(terms))
	qsearchersClose := func() {
		for _, searcher := range qsearchers {
			if searcher != nil {
				_ = searcher.Close()
			}
		}
	}
	for i, term := range terms {
		var err error
		if termBoosts != nil {
			qsearchers[i], err = NewTermSearcher(indexReader, term, field, boost*termBoosts[i], scorer, options)
		} else {
			qsearchers[i], err = NewTermSearcher(indexReader, term, field, boost, scorer, options)
		}
		if err != nil {
			qsearchersClose()
			return nil, err
		}
	}
	return qsearchers, nil
}

func optimizeMultiTermSearcherBytes(indexReader search.Reader, terms [][]byte,
	field string, boost float64, scorer search.Scorer, options search.SearcherOptions) (
	search.Searcher, error) {
	var finalSearcher search.Searcher
	for len(terms) > 0 {
		var batchTerms [][]byte
		if len(terms) > DisjunctionMaxClauseCount {
			batchTerms = terms[:DisjunctionMaxClauseCount]
			terms = terms[DisjunctionMaxClauseCount:]
		} else {
			batchTerms = terms
			terms = nil
		}
		batch, err := makeBatchSearchersBytes(indexReader, batchTerms, field, boost, scorer, options)
		if err != nil {
			return nil, err
		}
		if finalSearcher != nil {
			batch = append(batch, finalSearcher)
		}
		cleanup := func() {
			for _, searcher := range batch {
				if searcher != nil {
					_ = searcher.Close()
				}
			}
		}
		finalSearcher, err = optimizeCompositeSearcher("disjunction:unadorned",
			indexReader, batch, options)
		// all searchers in batch should be closed, regardless of error or optimization failure
		// either we're returning, or continuing and only finalSearcher is needed for next loop
		cleanup()
		if err != nil {
			return nil, err
		}
		if finalSearcher == nil {
			return nil, fmt.Errorf("unable to optimize")
		}
	}
	return finalSearcher, nil
}

func makeBatchSearchersBytes(indexReader search.Reader, terms [][]byte, field string,
	boost float64, scorer search.Scorer, options search.SearcherOptions) ([]search.Searcher, error) {
	qsearchers := make([]search.Searcher, len(terms))
	qsearchersClose := func() {
		for _, searcher := range qsearchers {
			if searcher != nil {
				_ = searcher.Close()
			}
		}
	}
	for i, term := range terms {
		var err error
		qsearchers[i], err = NewTermSearcherBytes(indexReader, term, field, boost, scorer, options)
		if err != nil {
			qsearchersClose()
			return nil, err
		}
	}
	return qsearchers, nil
}
