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

package query

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/blevesearch/bleve/v2/mapping"
	"github.com/blevesearch/bleve/v2/search"
	"github.com/blevesearch/bleve/v2/search/searcher"
	"github.com/blevesearch/bleve/v2/util"
	index "github.com/blevesearch/bleve_index_api"
)

type BooleanQuery struct {
	Must            Query  `json:"must,omitempty"`
	Should          Query  `json:"should,omitempty"`
	MustNot         Query  `json:"must_not,omitempty"`
	Filter          Query  `json:"filter,omitempty"`
	BoostVal        *Boost `json:"boost,omitempty"`
	queryStringMode bool
}

// NewBooleanQuery creates a compound Query composed
// of several other Query objects.
// Result documents must satisfy ALL of the
// must Queries.
// Result documents must satisfy NONE of the must not
// Queries.
// Result documents that ALSO satisfy any of the should
// Queries will score higher.
func NewBooleanQuery(must []Query, should []Query, mustNot []Query) *BooleanQuery {

	rv := BooleanQuery{}
	if len(must) > 0 {
		rv.Must = NewConjunctionQuery(must)
	}
	if len(should) > 0 {
		rv.Should = NewDisjunctionQuery(should)
	}
	if len(mustNot) > 0 {
		rv.MustNot = NewDisjunctionQuery(mustNot)
	}

	return &rv
}

func NewBooleanQueryForQueryString(must []Query, should []Query, mustNot []Query) *BooleanQuery {
	rv := NewBooleanQuery(nil, nil, nil)
	rv.queryStringMode = true
	rv.AddMust(must...)
	rv.AddShould(should...)
	rv.AddMustNot(mustNot...)
	return rv
}

// SetMinShould requires that at least minShould of the
// should Queries must be satisfied.
func (q *BooleanQuery) SetMinShould(minShould float64) {
	q.Should.(*DisjunctionQuery).SetMin(minShould)
}

func (q *BooleanQuery) AddMust(m ...Query) {
	if m == nil {
		return
	}
	if q.Must == nil {
		tmp := NewConjunctionQuery([]Query{})
		tmp.queryStringMode = q.queryStringMode
		q.Must = tmp
	}
	for _, mq := range m {
		q.Must.(*ConjunctionQuery).AddQuery(mq)
	}
}

func (q *BooleanQuery) AddShould(m ...Query) {
	if m == nil {
		return
	}
	if q.Should == nil {
		tmp := NewDisjunctionQuery([]Query{})
		tmp.queryStringMode = q.queryStringMode
		q.Should = tmp
	}
	for _, mq := range m {
		q.Should.(*DisjunctionQuery).AddQuery(mq)
	}
}

func (q *BooleanQuery) AddMustNot(m ...Query) {
	if m == nil {
		return
	}
	if q.MustNot == nil {
		tmp := NewDisjunctionQuery([]Query{})
		tmp.queryStringMode = q.queryStringMode
		q.MustNot = tmp
	}
	for _, mq := range m {
		q.MustNot.(*DisjunctionQuery).AddQuery(mq)
	}
}

func (q *BooleanQuery) AddFilter(m Query) {
	if m == nil {
		return
	}
	q.Filter = m
}

func (q *BooleanQuery) SetBoost(b float64) {
	boost := Boost(b)
	q.BoostVal = &boost
}

func (q *BooleanQuery) Boost() float64 {
	return q.BoostVal.Value()
}

func (q *BooleanQuery) Searcher(ctx context.Context, i index.IndexReader, m mapping.IndexMapping, options search.SearcherOptions) (search.Searcher, error) {
	var err error
	var mustNotSearcher search.Searcher
	if q.MustNot != nil {
		mustNotSearcher, err = q.MustNot.Searcher(ctx, i, m, options)
		if err != nil {
			return nil, err
		}
		// if must not is MatchNone, reset it to nil
		if _, ok := mustNotSearcher.(*searcher.MatchNoneSearcher); ok {
			mustNotSearcher = nil
		}
	}

	var mustSearcher search.Searcher
	if q.Must != nil {
		mustSearcher, err = q.Must.Searcher(ctx, i, m, options)
		if err != nil {
			return nil, err
		}
		// if must searcher is MatchNone, reset it to nil
		if _, ok := mustSearcher.(*searcher.MatchNoneSearcher); ok {
			mustSearcher = nil
		}
	}

	var shouldSearcher search.Searcher
	if q.Should != nil {
		shouldSearcher, err = q.Should.Searcher(ctx, i, m, options)
		if err != nil {
			return nil, err
		}
		// if should searcher is MatchNone, reset it to nil
		if _, ok := shouldSearcher.(*searcher.MatchNoneSearcher); ok {
			shouldSearcher = nil
		}
	}

	var filterFunc searcher.FilterFunc
	if q.Filter != nil {
		// create a new searcher options with disabled scoring, since filter should not affect scoring
		// and we don't want to pay the cost of scoring if we don't need it, also disable term vectors
		// and explain, since we don't need them for filters
		filterOptions := search.SearcherOptions{
			Explain:            false,
			IncludeTermVectors: false,
			Score:              "none",
		}
		filterSearcher, err := q.Filter.Searcher(ctx, i, m, filterOptions)
		if err != nil {
			return nil, err
		}
		var init bool
		var refDoc *search.DocumentMatch
		filterFunc = func(sctx *search.SearchContext, d *search.DocumentMatch) bool {
			// Initialize the reference document to point
			// to the first document in the filterSearcher
			var err error
			if !init {
				refDoc, err = filterSearcher.Next(sctx)
				if err != nil {
					return false
				}
				init = true
			}
			if refDoc == nil {
				// filterSearcher is exhausted, d is not in filter
				return false
			}
			// Compare document IDs
			cmp := refDoc.IndexInternalID.Compare(d.IndexInternalID)
			if cmp < 0 {
				// filterSearcher is behind the current document, Advance() it
				refDoc, err = filterSearcher.Advance(sctx, d.IndexInternalID)
				if err != nil || refDoc == nil {
					return false
				}
				// After advance, check if they're now equal
				cmp = refDoc.IndexInternalID.Compare(d.IndexInternalID)
			}
			// cmp >= 0: either equal (match) or filterSearcher is ahead (no match)
			return cmp == 0
		}
	}

	// if all 4 are nil, return MatchNone
	if mustSearcher == nil && shouldSearcher == nil && mustNotSearcher == nil && filterFunc == nil {
		return searcher.NewMatchNoneSearcher(i)
	}

	// optimization, if only must searcher, just return it instead
	if mustSearcher != nil && shouldSearcher == nil && mustNotSearcher == nil && filterFunc == nil {
		return mustSearcher, nil
	}

	// optimization, if only should searcher, just return it instead
	if mustSearcher == nil && shouldSearcher != nil && mustNotSearcher == nil && filterFunc == nil {
		return shouldSearcher, nil
	}

	// optimization, if only filter searcher, wrap around a MatchAllSearcher
	if mustSearcher == nil && shouldSearcher == nil && mustNotSearcher == nil && filterFunc != nil {
		mustSearcher, err = searcher.NewMatchAllSearcher(ctx, i, 1.0, options)
		if err != nil {
			return nil, err
		}
		return searcher.NewFilteringSearcher(ctx,
			mustSearcher,
			filterFunc,
		), nil
	}

	// if only mustNotSearcher, start with MatchAll
	if mustSearcher == nil && shouldSearcher == nil && mustNotSearcher != nil {
		mustSearcher, err = searcher.NewMatchAllSearcher(ctx, i, 1.0, options)
		if err != nil {
			return nil, err
		}
	}

	bs, err := searcher.NewBooleanSearcher(ctx, i, mustSearcher, shouldSearcher, mustNotSearcher, options)
	if err != nil {
		return nil, err
	}

	if filterFunc != nil {
		return searcher.NewFilteringSearcher(ctx, bs, filterFunc), nil
	}
	return bs, nil
}

func (q *BooleanQuery) Validate() error {
	if qm, ok := q.Must.(ValidatableQuery); ok {
		err := qm.Validate()
		if err != nil {
			return err
		}
	}
	if qs, ok := q.Should.(ValidatableQuery); ok {
		err := qs.Validate()
		if err != nil {
			return err
		}
	}
	if qmn, ok := q.MustNot.(ValidatableQuery); ok {
		err := qmn.Validate()
		if err != nil {
			return err
		}
	}
	if qf, ok := q.Filter.(ValidatableQuery); ok {
		err := qf.Validate()
		if err != nil {
			return err
		}
	}
	if q.Must == nil && q.Should == nil && q.MustNot == nil && q.Filter == nil {
		return fmt.Errorf("boolean query must contain at least one must or should or not must or filter clause")
	}
	return nil
}

func (q *BooleanQuery) UnmarshalJSON(data []byte) error {
	tmp := struct {
		Must    json.RawMessage `json:"must,omitempty"`
		Should  json.RawMessage `json:"should,omitempty"`
		MustNot json.RawMessage `json:"must_not,omitempty"`
		Filter  json.RawMessage `json:"filter,omitempty"`
		Boost   *Boost          `json:"boost,omitempty"`
	}{}
	err := util.UnmarshalJSON(data, &tmp)
	if err != nil {
		return err
	}

	if tmp.Must != nil {
		q.Must, err = ParseQuery(tmp.Must)
		if err != nil {
			return err
		}
		_, isConjunctionQuery := q.Must.(*ConjunctionQuery)
		if !isConjunctionQuery {
			return fmt.Errorf("must clause must be conjunction")
		}
	}

	if tmp.Should != nil {
		q.Should, err = ParseQuery(tmp.Should)
		if err != nil {
			return err
		}
		_, isDisjunctionQuery := q.Should.(*DisjunctionQuery)
		if !isDisjunctionQuery {
			return fmt.Errorf("should clause must be disjunction")
		}
	}

	if tmp.MustNot != nil {
		q.MustNot, err = ParseQuery(tmp.MustNot)
		if err != nil {
			return err
		}
		_, isDisjunctionQuery := q.MustNot.(*DisjunctionQuery)
		if !isDisjunctionQuery {
			return fmt.Errorf("must not clause must be disjunction")
		}
	}

	if tmp.Filter != nil {
		q.Filter, err = ParseQuery(tmp.Filter)
		if err != nil {
			return err
		}
	}

	q.BoostVal = tmp.Boost

	return nil
}
