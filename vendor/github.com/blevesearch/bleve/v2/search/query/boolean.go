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

	// if all 3 are nil, return MatchNone
	if mustSearcher == nil && shouldSearcher == nil && mustNotSearcher == nil {
		return searcher.NewMatchNoneSearcher(i)
	}

	// if only mustNotSearcher, start with MatchAll
	if mustSearcher == nil && shouldSearcher == nil && mustNotSearcher != nil {
		mustSearcher, err = searcher.NewMatchAllSearcher(ctx, i, 1.0, options)
		if err != nil {
			return nil, err
		}
	}

	// optimization, if only should searcher, just return it instead
	if mustSearcher == nil && shouldSearcher != nil && mustNotSearcher == nil {
		return shouldSearcher, nil
	}

	return searcher.NewBooleanSearcher(ctx, i, mustSearcher, shouldSearcher, mustNotSearcher, options)
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
	if q.Must == nil && q.Should == nil && q.MustNot == nil {
		return fmt.Errorf("boolean query must contain at least one must or should or not must clause")
	}
	return nil
}

func (q *BooleanQuery) UnmarshalJSON(data []byte) error {
	tmp := struct {
		Must    json.RawMessage `json:"must,omitempty"`
		Should  json.RawMessage `json:"should,omitempty"`
		MustNot json.RawMessage `json:"must_not,omitempty"`
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

	q.BoostVal = tmp.Boost

	return nil
}
