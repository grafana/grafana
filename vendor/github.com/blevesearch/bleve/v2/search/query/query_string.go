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

	"github.com/blevesearch/bleve/v2/mapping"
	"github.com/blevesearch/bleve/v2/search"
	index "github.com/blevesearch/bleve_index_api"
)

type QueryStringQuery struct {
	Query    string `json:"query"`
	BoostVal *Boost `json:"boost,omitempty"`
}

// NewQueryStringQuery creates a new Query used for
// finding documents that satisfy a query string.  The
// query string is a small query language for humans.
func NewQueryStringQuery(query string) *QueryStringQuery {
	return &QueryStringQuery{
		Query: query,
	}
}

func (q *QueryStringQuery) SetBoost(b float64) {
	boost := Boost(b)
	q.BoostVal = &boost
}

func (q *QueryStringQuery) Boost() float64 {
	return q.BoostVal.Value()
}

func (q *QueryStringQuery) Parse() (Query, error) {
	return parseQuerySyntax(q.Query)
}

func (q *QueryStringQuery) Searcher(ctx context.Context, i index.IndexReader, m mapping.IndexMapping, options search.SearcherOptions) (search.Searcher, error) {
	newQuery, err := parseQuerySyntax(q.Query)
	if err != nil {
		return nil, err
	}
	return newQuery.Searcher(ctx, i, m, options)
}

func (q *QueryStringQuery) Validate() error {
	newQuery, err := parseQuerySyntax(q.Query)
	if err != nil {
		return err
	}
	if newQuery, ok := newQuery.(ValidatableQuery); ok {
		return newQuery.Validate()
	}
	return nil
}
