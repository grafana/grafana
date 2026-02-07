//  Copyright (c) 2017 Couchbase, Inc.
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

	"github.com/blevesearch/bleve/v2/search"
	index "github.com/blevesearch/bleve_index_api"
)

func NewMultiTermSearcher(ctx context.Context, indexReader index.IndexReader, terms []string,
	field string, boost float64, options search.SearcherOptions, limit bool) (
	search.Searcher, error) {

	if tooManyClauses(len(terms)) {
		if optionsDisjunctionOptimizable(options) {
			return optimizeMultiTermSearcher(ctx, indexReader, terms, field, boost, options)
		}
		if limit {
			return nil, tooManyClausesErr(field, len(terms))
		}
	}

	qsearchers, err := makeBatchSearchers(ctx, indexReader, terms, field, boost, options)
	if err != nil {
		return nil, err
	}

	// build disjunction searcher of these ranges
	return newMultiTermSearcherInternal(ctx, indexReader, qsearchers, field, boost,
		options, limit)
}

// Works similarly to the multi term searcher but additionally boosts individual terms based on
// their edit distance from the query terms
func NewMultiTermSearcherBoosted(ctx context.Context, indexReader index.IndexReader, terms []string,
	field string, boost float64, editDistances []uint8, options search.SearcherOptions, limit bool) (
	search.Searcher, error) {

	if tooManyClauses(len(terms)) {
		if optionsDisjunctionOptimizable(options) {
			return optimizeMultiTermSearcher(ctx, indexReader, terms, field, boost, options)
		}
		if limit {
			return nil, tooManyClausesErr(field, len(terms))
		}
	}

	qsearchers, err := makeBatchSearchersBoosted(ctx, indexReader, terms, field, boost, editDistances, options)
	if err != nil {
		return nil, err
	}

	// build disjunction searcher of these ranges
	return newMultiTermSearcherInternal(ctx, indexReader, qsearchers, field, boost,
		options, limit)
}

func NewMultiTermSearcherBytes(ctx context.Context, indexReader index.IndexReader, terms [][]byte,
	field string, boost float64, options search.SearcherOptions, limit bool) (
	search.Searcher, error) {

	if tooManyClauses(len(terms)) {
		if optionsDisjunctionOptimizable(options) {
			return optimizeMultiTermSearcherBytes(ctx, indexReader, terms, field, boost, options)
		}

		if limit {
			return nil, tooManyClausesErr(field, len(terms))
		}
	}

	qsearchers, err := makeBatchSearchersBytes(ctx, indexReader, terms, field, boost, options)
	if err != nil {
		return nil, err
	}

	// build disjunction searcher of these ranges
	return newMultiTermSearcherInternal(ctx, indexReader, qsearchers, field, boost,
		options, limit)
}

func newMultiTermSearcherInternal(ctx context.Context, indexReader index.IndexReader,
	searchers []search.Searcher, field string, boost float64,
	options search.SearcherOptions, limit bool) (
	search.Searcher, error) {

	// build disjunction searcher of these ranges
	searcher, err := newDisjunctionSearcher(ctx, indexReader, searchers, 0, options,
		limit)
	if err != nil {
		for _, s := range searchers {
			_ = s.Close()
		}
		return nil, err
	}

	return searcher, nil
}

func optimizeMultiTermSearcher(ctx context.Context, indexReader index.IndexReader, terms []string,
	field string, boost float64, options search.SearcherOptions) (
	search.Searcher, error) {
	var finalSearcher search.Searcher
	for len(terms) > 0 {
		var batchTerms []string
		if len(terms) > DisjunctionMaxClauseCount {
			batchTerms = terms[:DisjunctionMaxClauseCount]
			terms = terms[DisjunctionMaxClauseCount:]
		} else {
			batchTerms = terms
			terms = nil
		}
		batch, err := makeBatchSearchers(ctx, indexReader, batchTerms, field, boost, options)
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
		finalSearcher, err = optimizeCompositeSearcher(ctx, "disjunction:unadorned",
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

func makeBatchSearchers(ctx context.Context, indexReader index.IndexReader, terms []string, field string,
	boost float64, options search.SearcherOptions) ([]search.Searcher, error) {

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
		qsearchers[i], err = NewTermSearcher(ctx, indexReader, term, field, boost, options)
		if err != nil {
			qsearchersClose()
			return nil, err
		}
	}
	return qsearchers, nil
}

func makeBatchSearchersBoosted(ctx context.Context, indexReader index.IndexReader, terms []string, field string,
	boost float64, editDistances []uint8, options search.SearcherOptions) ([]search.Searcher, error) {

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
		var editMultiplier float64
		if editDistances != nil {
			editMultiplier = 1 / float64(editDistances[i]+1)
		}
		qsearchers[i], err = NewTermSearcher(ctx, indexReader, term, field, boost*editMultiplier, options)
		if err != nil {
			qsearchersClose()
			return nil, err
		}
	}
	return qsearchers, nil
}

func optimizeMultiTermSearcherBytes(ctx context.Context, indexReader index.IndexReader, terms [][]byte,
	field string, boost float64, options search.SearcherOptions) (
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
		batch, err := makeBatchSearchersBytes(ctx, indexReader, batchTerms, field, boost, options)
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
		finalSearcher, err = optimizeCompositeSearcher(ctx, "disjunction:unadorned",
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

func makeBatchSearchersBytes(ctx context.Context, indexReader index.IndexReader, terms [][]byte, field string,
	boost float64, options search.SearcherOptions) ([]search.Searcher, error) {

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
		qsearchers[i], err = NewTermSearcherBytes(ctx, indexReader, term, field, boost, options)
		if err != nil {
			qsearchersClose()
			return nil, err
		}
	}
	return qsearchers, nil
}
