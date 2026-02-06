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

	"github.com/blevesearch/bleve/v2/mapping"
	"github.com/blevesearch/bleve/v2/search"
	"github.com/blevesearch/bleve/v2/search/searcher"
	index "github.com/blevesearch/bleve_index_api"
)

type MatchAllQuery struct {
	BoostVal *Boost `json:"boost,omitempty"`
}

// NewMatchAllQuery creates a Query which will
// match all documents in the index.
func NewMatchAllQuery() *MatchAllQuery {
	return &MatchAllQuery{}
}

func (q *MatchAllQuery) SetBoost(b float64) {
	boost := Boost(b)
	q.BoostVal = &boost
}

func (q *MatchAllQuery) Boost() float64 {
	return q.BoostVal.Value()
}

func (q *MatchAllQuery) Searcher(ctx context.Context, i index.IndexReader, m mapping.IndexMapping, options search.SearcherOptions) (search.Searcher, error) {
	return searcher.NewMatchAllSearcher(ctx, i, q.BoostVal.Value(), options)
}

func (q *MatchAllQuery) MarshalJSON() ([]byte, error) {
	tmp := map[string]interface{}{
		"boost":     q.BoostVal,
		"match_all": map[string]interface{}{},
	}
	return json.Marshal(tmp)
}
