//  Copyright (c) 2022 Couchbase, Inc.
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

	"github.com/blevesearch/bleve/v2/geo"
	"github.com/blevesearch/bleve/v2/mapping"
	"github.com/blevesearch/bleve/v2/search"
	"github.com/blevesearch/bleve/v2/search/searcher"
	"github.com/blevesearch/bleve/v2/util"
	index "github.com/blevesearch/bleve_index_api"
)

type Geometry struct {
	Shape    index.GeoJSON `json:"shape"`
	Relation string        `json:"relation"`
}

type GeoShapeQuery struct {
	Geometry Geometry `json:"geometry"`
	FieldVal string   `json:"field,omitempty"`
	BoostVal *Boost   `json:"boost,omitempty"`
}

// NewGeoShapeQuery creates a geoshape query for the
// given shape type. This method can be used for
// creating geoshape queries for shape types like: point,
// linestring, polygon, multipoint, multilinestring,
// multipolygon and envelope.
func NewGeoShapeQuery(coordinates [][][][]float64, typ,
	relation string) (*GeoShapeQuery, error) {
	s, _, err := geo.NewGeoJsonShape(coordinates, typ)
	if err != nil {
		return nil, err
	}

	return &GeoShapeQuery{Geometry: Geometry{Shape: s,
		Relation: relation}}, nil
}

// NewGeoShapeCircleQuery creates a geoshape query for the
// given center point and the radius. Radius formats supported:
// "5in" "5inch" "7yd" "7yards" "9ft" "9feet" "11km" "11kilometers"
// "3nm" "3nauticalmiles" "13mm" "13millimeters" "15cm" "15centimeters"
// "17mi" "17miles" "19m" "19meters" If the unit cannot be determined,
// the entire string is parsed and the unit of meters is assumed.
func NewGeoShapeCircleQuery(coordinates []float64, radius,
	relation string) (*GeoShapeQuery, error) {

	s, _, err := geo.NewGeoCircleShape(coordinates, radius)
	if err != nil {
		return nil, err
	}

	return &GeoShapeQuery{Geometry: Geometry{Shape: s,
		Relation: relation}}, nil
}

// NewGeometryCollectionQuery creates a geoshape query for the
// given geometrycollection coordinates and types.
func NewGeometryCollectionQuery(coordinates [][][][][]float64, types []string,
	relation string) (*GeoShapeQuery, error) {
	s, _, err := geo.NewGeometryCollection(coordinates, types)
	if err != nil {
		return nil, err
	}

	return &GeoShapeQuery{Geometry: Geometry{Shape: s,
		Relation: relation}}, nil
}

func (q *GeoShapeQuery) SetBoost(b float64) {
	boost := Boost(b)
	q.BoostVal = &boost
}

func (q *GeoShapeQuery) Boost() float64 {
	return q.BoostVal.Value()
}

func (q *GeoShapeQuery) SetField(f string) {
	q.FieldVal = f
}

func (q *GeoShapeQuery) Field() string {
	return q.FieldVal
}

func (q *GeoShapeQuery) Searcher(ctx context.Context, i index.IndexReader,
	m mapping.IndexMapping, options search.SearcherOptions) (search.Searcher, error) {
	field := q.FieldVal
	if q.FieldVal == "" {
		field = m.DefaultSearchField()
	}

	ctx = context.WithValue(ctx, search.QueryTypeKey, search.Geo)

	return searcher.NewGeoShapeSearcher(ctx, i, q.Geometry.Shape, q.Geometry.Relation, field,
		q.BoostVal.Value(), options)
}

func (q *GeoShapeQuery) Validate() error {
	return nil
}

func (q *Geometry) UnmarshalJSON(data []byte) error {
	tmp := struct {
		Shape    json.RawMessage `json:"shape"`
		Relation string          `json:"relation"`
	}{}

	err := util.UnmarshalJSON(data, &tmp)
	if err != nil {
		return err
	}

	q.Shape, err = geo.ParseGeoJSONShape(tmp.Shape)
	if err != nil {
		return err
	}
	q.Relation = tmp.Relation
	return nil
}
