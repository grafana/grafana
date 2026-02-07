//  Copyright (c) 2019 Couchbase, Inc.
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

type GeoBoundingPolygonQuery struct {
	Points   []geo.Point `json:"polygon_points"`
	FieldVal string      `json:"field,omitempty"`
	BoostVal *Boost      `json:"boost,omitempty"`
}

func NewGeoBoundingPolygonQuery(points []geo.Point) *GeoBoundingPolygonQuery {
	return &GeoBoundingPolygonQuery{
		Points: points}
}

func (q *GeoBoundingPolygonQuery) SetBoost(b float64) {
	boost := Boost(b)
	q.BoostVal = &boost
}

func (q *GeoBoundingPolygonQuery) Boost() float64 {
	return q.BoostVal.Value()
}

func (q *GeoBoundingPolygonQuery) SetField(f string) {
	q.FieldVal = f
}

func (q *GeoBoundingPolygonQuery) Field() string {
	return q.FieldVal
}

func (q *GeoBoundingPolygonQuery) Searcher(ctx context.Context, i index.IndexReader,
	m mapping.IndexMapping, options search.SearcherOptions) (search.Searcher, error) {
	field := q.FieldVal
	if q.FieldVal == "" {
		field = m.DefaultSearchField()
	}

	ctx = context.WithValue(ctx, search.QueryTypeKey, search.Geo)

	return searcher.NewGeoBoundedPolygonSearcher(ctx, i, q.Points, field, q.BoostVal.Value(), options)
}

func (q *GeoBoundingPolygonQuery) Validate() error {
	return nil
}

func (q *GeoBoundingPolygonQuery) UnmarshalJSON(data []byte) error {
	tmp := struct {
		Points   []interface{} `json:"polygon_points"`
		FieldVal string        `json:"field,omitempty"`
		BoostVal *Boost        `json:"boost,omitempty"`
	}{}
	err := util.UnmarshalJSON(data, &tmp)
	if err != nil {
		return err
	}

	q.Points = make([]geo.Point, 0, len(tmp.Points))
	for _, i := range tmp.Points {
		// now use our generic point parsing code from the geo package
		lon, lat, found := geo.ExtractGeoPoint(i)
		if !found {
			return fmt.Errorf("geo polygon point: %v is not in a valid format", i)
		}
		q.Points = append(q.Points, geo.Point{Lon: lon, Lat: lat})
	}

	q.FieldVal = tmp.FieldVal
	q.BoostVal = tmp.BoostVal
	return nil
}
