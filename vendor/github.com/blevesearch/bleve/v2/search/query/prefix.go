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
	"github.com/blevesearch/bleve/v2/search/searcher"
	index "github.com/blevesearch/bleve_index_api"
)

type PrefixQuery struct {
	Prefix   string `json:"prefix"`
	FieldVal string `json:"field,omitempty"`
	BoostVal *Boost `json:"boost,omitempty"`
}

// NewPrefixQuery creates a new Query which finds
// documents containing terms that start with the
// specified prefix.
func NewPrefixQuery(prefix string) *PrefixQuery {
	return &PrefixQuery{
		Prefix: prefix,
	}
}

func (q *PrefixQuery) SetBoost(b float64) {
	boost := Boost(b)
	q.BoostVal = &boost
}

func (q *PrefixQuery) Boost() float64 {
	return q.BoostVal.Value()
}

func (q *PrefixQuery) SetField(f string) {
	q.FieldVal = f
}

func (q *PrefixQuery) Field() string {
	return q.FieldVal
}

func (q *PrefixQuery) Searcher(ctx context.Context, i index.IndexReader, m mapping.IndexMapping, options search.SearcherOptions) (search.Searcher, error) {
	field := q.FieldVal
	if q.FieldVal == "" {
		field = m.DefaultSearchField()
	}
	return searcher.NewTermPrefixSearcher(ctx, i, q.Prefix, field, q.BoostVal.Value(), options)
}
