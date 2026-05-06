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

type DisjunctionQuery struct {
	Disjuncts              []Query `json:"disjuncts"`
	BoostVal               *Boost  `json:"boost,omitempty"`
	Min                    float64 `json:"min"`
	retrieveScoreBreakdown bool
	queryStringMode        bool
}

func (q *DisjunctionQuery) RetrieveScoreBreakdown(b bool) {
	q.retrieveScoreBreakdown = b
}

// NewDisjunctionQuery creates a new compound Query.
// Result documents satisfy at least one Query.
func NewDisjunctionQuery(disjuncts []Query) *DisjunctionQuery {
	return &DisjunctionQuery{
		Disjuncts: disjuncts,
	}
}

func (q *DisjunctionQuery) SetBoost(b float64) {
	boost := Boost(b)
	q.BoostVal = &boost
}

func (q *DisjunctionQuery) Boost() float64 {
	return q.BoostVal.Value()
}

func (q *DisjunctionQuery) AddQuery(aq ...Query) {
	q.Disjuncts = append(q.Disjuncts, aq...)
}

func (q *DisjunctionQuery) SetMin(m float64) {
	q.Min = m
}

func (q *DisjunctionQuery) Searcher(ctx context.Context, i index.IndexReader, m mapping.IndexMapping,
	options search.SearcherOptions,
) (search.Searcher, error) {
	ss := make([]search.Searcher, 0, len(q.Disjuncts))
	for _, disjunct := range q.Disjuncts {
		sr, err := disjunct.Searcher(ctx, i, m, options)
		if err != nil {
			for _, searcher := range ss {
				if searcher != nil {
					_ = searcher.Close()
				}
			}
			return nil, err
		}
		if sr != nil {
			if _, ok := sr.(*searcher.MatchNoneSearcher); ok && q.queryStringMode {
				// in query string mode, skip match none
				continue
			}
			ss = append(ss, sr)
		}
	}

	if len(ss) < 1 {
		return searcher.NewMatchNoneSearcher(i)
	}

	nctx := context.WithValue(ctx, search.IncludeScoreBreakdownKey, q.retrieveScoreBreakdown)

	return searcher.NewDisjunctionSearcher(nctx, i, ss, q.Min, options)
}

func (q *DisjunctionQuery) Validate() error {
	if int(q.Min) > len(q.Disjuncts) {
		return fmt.Errorf("disjunction query has fewer than the minimum number of clauses to satisfy")
	}
	for _, q := range q.Disjuncts {
		if q, ok := q.(ValidatableQuery); ok {
			err := q.Validate()
			if err != nil {
				return err
			}
		}
	}
	return nil
}

func (q *DisjunctionQuery) UnmarshalJSON(data []byte) error {
	tmp := struct {
		Disjuncts []json.RawMessage `json:"disjuncts"`
		Boost     *Boost            `json:"boost,omitempty"`
		Min       float64           `json:"min"`
	}{}
	err := util.UnmarshalJSON(data, &tmp)
	if err != nil {
		return err
	}
	q.Disjuncts = make([]Query, len(tmp.Disjuncts))
	for i, term := range tmp.Disjuncts {
		query, err := ParseQuery(term)
		if err != nil {
			return err
		}
		q.Disjuncts[i] = query
	}
	q.BoostVal = tmp.Boost
	q.Min = tmp.Min
	return nil
}
