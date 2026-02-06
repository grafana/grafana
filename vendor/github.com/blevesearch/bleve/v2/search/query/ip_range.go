//  Copyright (c) 2021 Couchbase, Inc.
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
	"fmt"
	"net"

	"github.com/blevesearch/bleve/v2/mapping"
	"github.com/blevesearch/bleve/v2/search"
	"github.com/blevesearch/bleve/v2/search/searcher"
	index "github.com/blevesearch/bleve_index_api"
)

type IPRangeQuery struct {
	CIDR     string `json:"cidr,omitempty"`
	FieldVal string `json:"field,omitempty"`
	BoostVal *Boost `json:"boost,omitempty"`
}

func NewIPRangeQuery(cidr string) *IPRangeQuery {
	return &IPRangeQuery{
		CIDR: cidr,
	}
}

func (q *IPRangeQuery) SetBoost(b float64) {
	boost := Boost(b)
	q.BoostVal = &boost
}

func (q *IPRangeQuery) Boost() float64 {
	return q.BoostVal.Value()
}

func (q *IPRangeQuery) SetField(f string) {
	q.FieldVal = f
}

func (q *IPRangeQuery) Field() string {
	return q.FieldVal
}

func (q *IPRangeQuery) Searcher(ctx context.Context, i index.IndexReader, m mapping.IndexMapping, options search.SearcherOptions) (search.Searcher, error) {
	field := q.FieldVal
	if q.FieldVal == "" {
		field = m.DefaultSearchField()
	}
	_, ipNet, err := net.ParseCIDR(q.CIDR)
	if err != nil {
		ip := net.ParseIP(q.CIDR)
		if ip == nil {
			return nil, err
		}
		// If we are searching for a specific ip rather than members of a network, just use a term search.
		return searcher.NewTermSearcherBytes(ctx, i, ip.To16(), field, q.BoostVal.Value(), options)
	}
	return searcher.NewIPRangeSearcher(ctx, i, ipNet, field, q.BoostVal.Value(), options)
}

func (q *IPRangeQuery) Validate() error {
	_, _, err := net.ParseCIDR(q.CIDR)
	if err == nil {
		return nil
	}
	// We also allow search for a specific IP.
	ip := net.ParseIP(q.CIDR)
	if ip != nil {
		return nil // we have a valid ip
	}
	return fmt.Errorf("IPRangeQuery must be for a network or ip address, %q", q.CIDR)
}
