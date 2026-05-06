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
	"github.com/blevesearch/bleve/v2/util"
	index "github.com/blevesearch/bleve_index_api"
)

type FuzzyQuery struct {
	Term      string `json:"term"`
	Prefix    int    `json:"prefix_length"`
	Fuzziness int    `json:"fuzziness"`
	FieldVal  string `json:"field,omitempty"`
	BoostVal  *Boost `json:"boost,omitempty"`
	autoFuzzy bool
}

// NewFuzzyQuery creates a new Query which finds
// documents containing terms within a specific
// fuzziness of the specified term.
// The default fuzziness is 1.
//
// The current implementation uses Levenshtein edit
// distance as the fuzziness metric.
func NewFuzzyQuery(term string) *FuzzyQuery {
	return &FuzzyQuery{
		Term:      term,
		Fuzziness: 1,
	}
}

func (q *FuzzyQuery) SetBoost(b float64) {
	boost := Boost(b)
	q.BoostVal = &boost
}

func (q *FuzzyQuery) Boost() float64 {
	return q.BoostVal.Value()
}

func (q *FuzzyQuery) SetField(f string) {
	q.FieldVal = f
}

func (q *FuzzyQuery) Field() string {
	return q.FieldVal
}

func (q *FuzzyQuery) SetFuzziness(f int) {
	q.Fuzziness = f
}

func (q *FuzzyQuery) SetAutoFuzziness(a bool) {
	q.autoFuzzy = a
}

func (q *FuzzyQuery) SetPrefix(p int) {
	q.Prefix = p
}

func (q *FuzzyQuery) Searcher(ctx context.Context, i index.IndexReader, m mapping.IndexMapping, options search.SearcherOptions) (search.Searcher, error) {
	field := q.FieldVal
	if q.FieldVal == "" {
		field = m.DefaultSearchField()
	}
	if q.autoFuzzy {
		return searcher.NewAutoFuzzySearcher(ctx, i, q.Term, q.Prefix, field, q.BoostVal.Value(), options)
	}
	return searcher.NewFuzzySearcher(ctx, i, q.Term, q.Prefix, q.Fuzziness, field, q.BoostVal.Value(), options)
}

func (q *FuzzyQuery) UnmarshalJSON(data []byte) error {
	type Alias FuzzyQuery
	aux := &struct {
		Fuzziness interface{} `json:"fuzziness"`
		*Alias
	}{
		Alias: (*Alias)(q),
	}
	if err := util.UnmarshalJSON(data, &aux); err != nil {
		return err
	}
	switch v := aux.Fuzziness.(type) {
	case float64:
		q.Fuzziness = int(v)
	case string:
		if v == "auto" {
			q.autoFuzzy = true
		}
	}
	return nil
}

func (f *FuzzyQuery) MarshalJSON() ([]byte, error) {
	var fuzzyValue interface{}
	if f.autoFuzzy {
		fuzzyValue = "auto"
	} else {
		fuzzyValue = f.Fuzziness
	}
	type fuzzyQuery struct {
		Term      string      `json:"term"`
		Prefix    int         `json:"prefix_length"`
		Fuzziness interface{} `json:"fuzziness"`
		FieldVal  string      `json:"field,omitempty"`
		BoostVal  *Boost      `json:"boost,omitempty"`
	}
	aux := fuzzyQuery{
		Term:      f.Term,
		Prefix:    f.Prefix,
		Fuzziness: fuzzyValue,
		FieldVal:  f.FieldVal,
		BoostVal:  f.BoostVal,
	}
	return util.MarshalJSON(aux)
}
