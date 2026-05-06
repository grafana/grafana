//  Copyright (c) 2020 The Bluge Authors.
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

package aggregations

import (
	"time"

	"github.com/blugelabs/bluge/numeric/geo"

	"github.com/blugelabs/bluge/search"
)

type FilteringTextSource struct {
	source search.TextValuesSource
	filter func([]byte) bool
}

func FilterText(source search.TextValuesSource, filter func([]byte) bool) *FilteringTextSource {
	return &FilteringTextSource{
		source: source,
		filter: filter,
	}
}

func (f *FilteringTextSource) Fields() []string {
	return f.source.Fields()
}

func (f *FilteringTextSource) Values(match *search.DocumentMatch) [][]byte {
	var rv [][]byte
	values := f.source.Values(match)
	for _, val := range values {
		if f.filter(val) {
			rv = append(rv, val)
		}
	}
	return rv
}

type FilteringNumericSource struct {
	source search.NumericValuesSource
	filter func(float64) bool
}

func FilterNumeric(source search.NumericValuesSource, filter func(float64) bool) *FilteringNumericSource {
	return &FilteringNumericSource{
		source: source,
		filter: filter,
	}
}

func (f *FilteringNumericSource) Fields() []string {
	return f.source.Fields()
}

func (f *FilteringNumericSource) Numbers(match *search.DocumentMatch) []float64 {
	var rv []float64
	values := f.source.Numbers(match)
	for _, val := range values {
		if f.filter(val) {
			rv = append(rv, val)
		}
	}
	return rv
}

type FilteringDateSource struct {
	source search.DateValuesSource
	filter func(time.Time) bool
}

func FilterDate(source search.DateValuesSource, filter func(time.Time) bool) *FilteringDateSource {
	return &FilteringDateSource{
		source: source,
		filter: filter,
	}
}

func (f *FilteringDateSource) Fields() []string {
	return f.source.Fields()
}

func (f *FilteringDateSource) Dates(match *search.DocumentMatch) []time.Time {
	var rv []time.Time
	values := f.source.Dates(match)
	for _, val := range values {
		if f.filter(val) {
			rv = append(rv, val)
		}
	}
	return rv
}

type FilteringGeoPointSource struct {
	source search.GeoPointValuesSource
	filter func(*geo.Point) bool
}

func FilterGeoPoint(source search.GeoPointValuesSource, filter func(*geo.Point) bool) *FilteringGeoPointSource {
	return &FilteringGeoPointSource{
		source: source,
		filter: filter,
	}
}

func (f *FilteringGeoPointSource) Fields() []string {
	return f.source.Fields()
}

func (f *FilteringGeoPointSource) GeoPoints(match *search.DocumentMatch) []*geo.Point {
	var rv []*geo.Point
	values := f.source.GeoPoints(match)
	for _, val := range values {
		if f.filter(val) {
			rv = append(rv, val)
		}
	}
	return rv
}
