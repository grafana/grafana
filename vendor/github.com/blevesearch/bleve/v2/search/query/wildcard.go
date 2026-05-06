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
	"strings"

	"github.com/blevesearch/bleve/v2/mapping"
	"github.com/blevesearch/bleve/v2/search"
	"github.com/blevesearch/bleve/v2/search/searcher"
	index "github.com/blevesearch/bleve_index_api"
)

var wildcardRegexpReplacer = strings.NewReplacer(
	// characters in the wildcard that must
	// be escaped in the regexp
	"+", `\+`,
	"(", `\(`,
	")", `\)`,
	"^", `\^`,
	"$", `\$`,
	".", `\.`,
	"{", `\{`,
	"}", `\}`,
	"[", `\[`,
	"]", `\]`,
	`|`, `\|`,
	`\`, `\\`,
	// wildcard characters
	"*", ".*",
	"?", ".")

type WildcardQuery struct {
	Wildcard string `json:"wildcard"`
	FieldVal string `json:"field,omitempty"`
	BoostVal *Boost `json:"boost,omitempty"`
}

// NewWildcardQuery creates a new Query which finds
// documents containing terms that match the
// specified wildcard.  In the wildcard pattern '*'
// will match any sequence of 0 or more characters,
// and '?' will match any single character.
func NewWildcardQuery(wildcard string) *WildcardQuery {
	return &WildcardQuery{
		Wildcard: wildcard,
	}
}

func (q *WildcardQuery) SetBoost(b float64) {
	boost := Boost(b)
	q.BoostVal = &boost
}

func (q *WildcardQuery) Boost() float64 {
	return q.BoostVal.Value()
}

func (q *WildcardQuery) SetField(f string) {
	q.FieldVal = f
}

func (q *WildcardQuery) Field() string {
	return q.FieldVal
}

func (q *WildcardQuery) Searcher(ctx context.Context, i index.IndexReader, m mapping.IndexMapping, options search.SearcherOptions) (search.Searcher, error) {
	field := q.FieldVal
	if q.FieldVal == "" {
		field = m.DefaultSearchField()
	}

	regexpString := wildcardRegexpReplacer.Replace(q.Wildcard)

	return searcher.NewRegexpStringSearcher(ctx, i, regexpString, field,
		q.BoostVal.Value(), options)
}

func (q *WildcardQuery) Validate() error {
	return nil // real validation delayed until searcher constructor
}
