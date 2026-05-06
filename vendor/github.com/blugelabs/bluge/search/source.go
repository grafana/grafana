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

package search

import (
	"math"
	"time"

	"github.com/blugelabs/bluge/numeric"
	"github.com/blugelabs/bluge/numeric/geo"
)

type TextValueSource interface {
	Fields() []string
	Value(match *DocumentMatch) []byte
}

type TextValuesSource interface {
	Fields() []string
	Values(match *DocumentMatch) [][]byte
}

type NumericValueSource interface {
	Fields() []string
	Number(match *DocumentMatch) float64
}

type NumericValuesSource interface {
	Fields() []string
	Numbers(match *DocumentMatch) []float64
}

type DateValueSource interface {
	Fields() []string
	Date(match *DocumentMatch) time.Time
}

type DateValuesSource interface {
	Fields() []string
	Dates(match *DocumentMatch) []time.Time
}

type GeoPointValueSource interface {
	Fields() []string
	GeoPoint(match *DocumentMatch) *geo.Point
}

type GeoPointValuesSource interface {
	Fields() []string
	GeoPoints(match *DocumentMatch) []*geo.Point
}

type FieldSource string

func Field(field string) FieldSource {
	return FieldSource(field)
}

func (f FieldSource) Fields() []string {
	return []string{string(f)}
}

func (f FieldSource) Value(match *DocumentMatch) []byte {
	return firstTerm(RemoveNumericPaddedTerms(f.Values(match)))
}

func (f FieldSource) Values(match *DocumentMatch) [][]byte {
	return match.DocValues(string(f))
}

func (f FieldSource) Number(match *DocumentMatch) float64 {
	return firstNumber(f.Numbers(match))
}

func (f FieldSource) Numbers(match *DocumentMatch) []float64 {
	var rv []float64
	for _, term := range f.Values(match) {
		prefixCoded := numeric.PrefixCoded(term)
		shift, err := prefixCoded.Shift()
		if err == nil && shift == 0 {
			i64, err := prefixCoded.Int64()
			if err == nil {
				f64 := numeric.Int64ToFloat64(i64)
				rv = append(rv, f64)
			}
		}
	}
	return rv
}

func (f FieldSource) Date(match *DocumentMatch) time.Time {
	return firstDate(f.Dates(match))
}

func (f FieldSource) Dates(match *DocumentMatch) []time.Time {
	var rv []time.Time
	for _, term := range f.Values(match) {
		prefixCoded := numeric.PrefixCoded(term)
		shift, err := prefixCoded.Shift()
		if err == nil && shift == 0 {
			i64, err := prefixCoded.Int64()
			if err == nil {
				t := time.Unix(0, i64)
				rv = append(rv, t)
			}
		}
	}
	return rv
}

func (f FieldSource) GeoPoint(match *DocumentMatch) *geo.Point {
	return firstGeoPoint(f.GeoPoints(match))
}

func (f FieldSource) GeoPoints(match *DocumentMatch) []*geo.Point {
	var rv []*geo.Point
	for _, term := range f.Values(match) {
		prefixCoded := numeric.PrefixCoded(term)
		shift, err := prefixCoded.Shift()
		if err == nil && shift == 0 {
			i64, err := prefixCoded.Int64()
			if err == nil {
				rv = append(rv, &geo.Point{
					Lon: geo.MortonUnhashLon(uint64(i64)),
					Lat: geo.MortonUnhashLat(uint64(i64)),
				})
			}
		}
	}
	return rv
}

type ScoreSource struct{}

func DocumentScore() *ScoreSource {
	return &ScoreSource{}
}

func (n *ScoreSource) Fields() []string {
	return []string{}
}

func (n *ScoreSource) Value(d *DocumentMatch) []byte {
	return numeric.MustNewPrefixCodedInt64(numeric.Float64ToInt64(d.Score), 0)
}

func (n *ScoreSource) Values(d *DocumentMatch) [][]byte {
	return [][]byte{numeric.MustNewPrefixCodedInt64(numeric.Float64ToInt64(d.Score), 0)}
}

func (n *ScoreSource) Number(d *DocumentMatch) float64 {
	return d.Score
}

func (n *ScoreSource) Numbers(d *DocumentMatch) []float64 {
	return []float64{d.Score}
}

type MissingTextValueSource struct {
	primary, replacement TextValueSource
}

func MissingTextValue(primary, replacement TextValueSource) *MissingTextValueSource {
	return &MissingTextValueSource{
		primary:     primary,
		replacement: replacement,
	}
}

func (f *MissingTextValueSource) Fields() []string {
	return append(f.primary.Fields(), f.replacement.Fields()...)
}

func (f *MissingTextValueSource) Value(match *DocumentMatch) []byte {
	primaryValue := f.primary.Value(match)
	if primaryValue == nil {
		return f.replacement.Value(match)
	}
	return primaryValue
}

type MissingNumericSource struct {
	primary, replacement NumericValuesSource
}

func MissingNumeric(primary, replacement NumericValuesSource) *MissingNumericSource {
	return &MissingNumericSource{
		primary:     primary,
		replacement: replacement,
	}
}

func (f *MissingNumericSource) Fields() []string {
	var rv []string
	rv = append(rv, f.primary.Fields()...)
	rv = append(rv, f.replacement.Fields()...)
	return rv
}

func (f *MissingNumericSource) Numbers(match *DocumentMatch) []float64 {
	primaryValues := f.primary.Numbers(match)
	if len(primaryValues) == 0 {
		return f.replacement.Numbers(match)
	}
	return primaryValues
}

type MissingDateSource struct {
	primary, replacement DateValuesSource
}

func MissingDate(primary, replacement DateValuesSource) *MissingDateSource {
	return &MissingDateSource{
		primary:     primary,
		replacement: replacement,
	}
}

func (f *MissingDateSource) Fields() []string {
	var rv []string
	rv = append(rv, f.primary.Fields()...)
	rv = append(rv, f.replacement.Fields()...)
	return rv
}

func (f *MissingDateSource) Numbers(match *DocumentMatch) []time.Time {
	primaryValues := f.primary.Dates(match)
	if len(primaryValues) == 0 {
		return f.replacement.Dates(match)
	}
	return primaryValues
}

type MissingGeoPointSource struct {
	primary, replacement GeoPointValuesSource
}

func MissingGeoPoints(primary, replacement GeoPointValuesSource) *MissingGeoPointSource {
	return &MissingGeoPointSource{
		primary:     primary,
		replacement: replacement,
	}
}

func (f *MissingGeoPointSource) Fields() []string {
	var rv []string
	rv = append(rv, f.primary.Fields()...)
	rv = append(rv, f.replacement.Fields()...)
	return rv
}

func (f *MissingGeoPointSource) GeoPoints(match *DocumentMatch) []*geo.Point {
	primaryValues := f.primary.GeoPoints(match)
	if len(primaryValues) == 0 {
		return f.replacement.GeoPoints(match)
	}
	return primaryValues
}

type FilteringTextSource struct {
	source TextValuesSource
	filter func([]byte) bool
}

func FilterText(source TextValuesSource, filter func([]byte) bool) *FilteringTextSource {
	return &FilteringTextSource{
		source: source,
		filter: filter,
	}
}

func (f *FilteringTextSource) Fields() []string {
	return f.source.Fields()
}

func (f *FilteringTextSource) Values(match *DocumentMatch) [][]byte {
	var rv [][]byte
	values := f.source.Values(match)
	for _, val := range values {
		if f.filter(val) {
			rv = append(rv, val)
		}
	}
	return rv
}

func firstTerm(sourceValues [][]byte) []byte {
	if len(sourceValues) > 0 {
		return sourceValues[0]
	}
	return nil
}

func firstNumber(sourceValues []float64) float64 {
	if len(sourceValues) > 0 {
		return sourceValues[0]
	}
	return math.NaN()
}

func firstDate(sourceValues []time.Time) time.Time {
	if len(sourceValues) > 0 {
		return sourceValues[0]
	}
	return time.Time{}
}

func firstGeoPoint(sourceValues []*geo.Point) *geo.Point {
	if len(sourceValues) > 0 {
		return sourceValues[0]
	}
	return nil
}

func RemoveNumericPaddedTerms(sourceValues [][]byte) [][]byte {
	var allValidNumeric = true
	var zeroPaddedNumeric [][]byte
	for _, term := range sourceValues {
		prefixCoded := numeric.PrefixCoded(term)
		shift, err := prefixCoded.Shift()
		if err == nil && shift == 0 {
			zeroPaddedNumeric = append(zeroPaddedNumeric, term)
		} else {
			allValidNumeric = false
			break
		}
	}
	// if all terms we saw looked like valid numeric encoded terms
	// AND there was at least one zero padded numeric term
	// return only the zero padded numeric terms
	if allValidNumeric && len(zeroPaddedNumeric) > 0 {
		return zeroPaddedNumeric
	}
	// otherwise return all the terms
	return sourceValues
}

type PointDistanceSource struct {
	a, b GeoPointValueSource
	unit geo.DistanceUnit
}

func NewGeoPointDistanceSource(a, b GeoPointValueSource, unit geo.DistanceUnit) *PointDistanceSource {
	return &PointDistanceSource{
		a:    a,
		b:    b,
		unit: unit,
	}
}

func (p PointDistanceSource) Fields() []string {
	return append(p.a.Fields(), p.b.Fields()...)
}

func (p PointDistanceSource) Value(match *DocumentMatch) []byte {
	distInt64 := numeric.Float64ToInt64(p.Number(match))
	return numeric.MustNewPrefixCodedInt64(distInt64, 0)
}

func (p PointDistanceSource) Values(match *DocumentMatch) [][]byte {
	return [][]byte{p.Value(match)}
}

func (p PointDistanceSource) Number(match *DocumentMatch) float64 {
	pointA := p.a.GeoPoint(match)
	pointB := p.b.GeoPoint(match)
	dist := geo.Haversin(pointA.Lon, pointA.Lat, pointB.Lon, pointB.Lat)
	// dist is returned in km, convert to desired unit
	return geo.Convert(dist, geo.Kilometer, p.unit)
}

func (p PointDistanceSource) Numbers(match *DocumentMatch) []float64 {
	return []float64{p.Number(match)}
}

type ConstantGeoPointSource geo.Point

func NewConstantGeoPointSource(p geo.Point) *ConstantGeoPointSource {
	rv := ConstantGeoPointSource(p)
	return &rv
}

func (p *ConstantGeoPointSource) Fields() []string {
	return nil
}

func (p *ConstantGeoPointSource) GeoPoint(_ *DocumentMatch) *geo.Point {
	var gp = geo.Point(*p)
	return &gp
}

type ConstantTextValueSource []byte

func (c ConstantTextValueSource) Fields() []string {
	return nil
}

func (c ConstantTextValueSource) Value(_ *DocumentMatch) []byte {
	return c
}
