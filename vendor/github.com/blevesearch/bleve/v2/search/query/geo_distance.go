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

package query

import (
	"context"
	"fmt"

	"github.com/blevesearch/bleve/v2/geo"
	"github.com/blevesearch/bleve/v2/mapping"
	"github.com/blevesearch/bleve/v2/search"
	"github.com/blevesearch/bleve/v2/search/searcher"
	"github.com/blevesearch/bleve/v2/util"
	index "github.com/blevesearch/bleve_index_api"
)

type GeoDistanceQuery struct {
	Location []float64 `json:"location,omitempty"`
	Distance string    `json:"distance,omitempty"`
	FieldVal string    `json:"field,omitempty"`
	BoostVal *Boost    `json:"boost,omitempty"`
}

func NewGeoDistanceQuery(lon, lat float64, distance string) *GeoDistanceQuery {
	return &GeoDistanceQuery{
		Location: []float64{lon, lat},
		Distance: distance,
	}
}

func (q *GeoDistanceQuery) SetBoost(b float64) {
	boost := Boost(b)
	q.BoostVal = &boost
}

func (q *GeoDistanceQuery) Boost() float64 {
	return q.BoostVal.Value()
}

func (q *GeoDistanceQuery) SetField(f string) {
	q.FieldVal = f
}

func (q *GeoDistanceQuery) Field() string {
	return q.FieldVal
}

func (q *GeoDistanceQuery) Searcher(ctx context.Context, i index.IndexReader, m mapping.IndexMapping,
	options search.SearcherOptions) (search.Searcher, error) {
	field := q.FieldVal
	if q.FieldVal == "" {
		field = m.DefaultSearchField()
	}

	ctx = context.WithValue(ctx, search.QueryTypeKey, search.Geo)

	dist, err := geo.ParseDistance(q.Distance)
	if err != nil {
		return nil, err
	}

	return searcher.NewGeoPointDistanceSearcher(ctx, i, q.Location[0], q.Location[1],
		dist, field, q.BoostVal.Value(), options)
}

func (q *GeoDistanceQuery) Validate() error {
	return nil
}

func (q *GeoDistanceQuery) UnmarshalJSON(data []byte) error {
	tmp := struct {
		Location interface{} `json:"location,omitempty"`
		Distance string      `json:"distance,omitempty"`
		FieldVal string      `json:"field,omitempty"`
		BoostVal *Boost      `json:"boost,omitempty"`
	}{}
	err := util.UnmarshalJSON(data, &tmp)
	if err != nil {
		return err
	}
	// now use our generic point parsing code from the geo package
	lon, lat, found := geo.ExtractGeoPoint(tmp.Location)
	if !found {
		return fmt.Errorf("geo location not in a valid format")
	}
	q.Location = []float64{lon, lat}
	q.Distance = tmp.Distance
	q.FieldVal = tmp.FieldVal
	q.BoostVal = tmp.BoostVal
	return nil
}
