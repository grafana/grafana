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

type GeoBoundingBoxQuery struct {
	TopLeft     []float64 `json:"top_left,omitempty"`
	BottomRight []float64 `json:"bottom_right,omitempty"`
	FieldVal    string    `json:"field,omitempty"`
	BoostVal    *Boost    `json:"boost,omitempty"`
}

func NewGeoBoundingBoxQuery(topLeftLon, topLeftLat, bottomRightLon, bottomRightLat float64) *GeoBoundingBoxQuery {
	return &GeoBoundingBoxQuery{
		TopLeft:     []float64{topLeftLon, topLeftLat},
		BottomRight: []float64{bottomRightLon, bottomRightLat},
	}
}

func (q *GeoBoundingBoxQuery) SetBoost(b float64) {
	boost := Boost(b)
	q.BoostVal = &boost
}

func (q *GeoBoundingBoxQuery) Boost() float64 {
	return q.BoostVal.Value()
}

func (q *GeoBoundingBoxQuery) SetField(f string) {
	q.FieldVal = f
}

func (q *GeoBoundingBoxQuery) Field() string {
	return q.FieldVal
}

func (q *GeoBoundingBoxQuery) Searcher(ctx context.Context, i index.IndexReader, m mapping.IndexMapping, options search.SearcherOptions) (search.Searcher, error) {
	field := q.FieldVal
	if q.FieldVal == "" {
		field = m.DefaultSearchField()
	}

	ctx = context.WithValue(ctx, search.QueryTypeKey, search.Geo)

	if q.BottomRight[0] < q.TopLeft[0] {
		// cross date line, rewrite as two parts

		leftSearcher, err := searcher.NewGeoBoundingBoxSearcher(ctx, i, -180, q.BottomRight[1], q.BottomRight[0], q.TopLeft[1], field, q.BoostVal.Value(), options, true)
		if err != nil {
			return nil, err
		}
		rightSearcher, err := searcher.NewGeoBoundingBoxSearcher(ctx, i, q.TopLeft[0], q.BottomRight[1], 180, q.TopLeft[1], field, q.BoostVal.Value(), options, true)
		if err != nil {
			_ = leftSearcher.Close()
			return nil, err
		}

		return searcher.NewDisjunctionSearcher(ctx, i, []search.Searcher{leftSearcher, rightSearcher}, 0, options)
	}

	return searcher.NewGeoBoundingBoxSearcher(ctx, i, q.TopLeft[0], q.BottomRight[1], q.BottomRight[0], q.TopLeft[1], field, q.BoostVal.Value(), options, true)
}

func (q *GeoBoundingBoxQuery) Validate() error {
	if q.TopLeft[1] < q.BottomRight[1] {
		return fmt.Errorf("geo bounding box top left should be higher than bottom right")
	}
	return nil
}

func (q *GeoBoundingBoxQuery) UnmarshalJSON(data []byte) error {
	tmp := struct {
		TopLeft     interface{} `json:"top_left,omitempty"`
		BottomRight interface{} `json:"bottom_right,omitempty"`
		FieldVal    string      `json:"field,omitempty"`
		BoostVal    *Boost      `json:"boost,omitempty"`
	}{}
	err := util.UnmarshalJSON(data, &tmp)
	if err != nil {
		return err
	}
	// now use our generic point parsing code from the geo package
	lon, lat, found := geo.ExtractGeoPoint(tmp.TopLeft)
	if !found {
		return fmt.Errorf("geo location top_left not in a valid format")
	}
	q.TopLeft = []float64{lon, lat}
	lon, lat, found = geo.ExtractGeoPoint(tmp.BottomRight)
	if !found {
		return fmt.Errorf("geo location bottom_right not in a valid format")
	}
	q.BottomRight = []float64{lon, lat}
	q.FieldVal = tmp.FieldVal
	q.BoostVal = tmp.BoostVal
	return nil
}
