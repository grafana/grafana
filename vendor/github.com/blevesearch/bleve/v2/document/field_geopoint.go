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

package document

import (
	"fmt"
	"reflect"

	"github.com/blevesearch/bleve/v2/analysis"
	"github.com/blevesearch/bleve/v2/geo"
	"github.com/blevesearch/bleve/v2/numeric"
	"github.com/blevesearch/bleve/v2/size"
	index "github.com/blevesearch/bleve_index_api"
)

var reflectStaticSizeGeoPointField int

func init() {
	var f GeoPointField
	reflectStaticSizeGeoPointField = int(reflect.TypeOf(f).Size())
}

var GeoPrecisionStep uint = 9

type GeoPointField struct {
	name              string
	arrayPositions    []uint64
	options           index.FieldIndexingOptions
	value             numeric.PrefixCoded
	numPlainTextBytes uint64
	length            int
	frequencies       index.TokenFrequencies

	spatialplugin index.SpatialAnalyzerPlugin
}

func (n *GeoPointField) Size() int {
	var freqSize int
	if n.frequencies != nil {
		freqSize = n.frequencies.Size()
	}
	return reflectStaticSizeGeoPointField + size.SizeOfPtr +
		len(n.name) +
		len(n.arrayPositions)*size.SizeOfUint64 +
		len(n.value) +
		freqSize
}

func (n *GeoPointField) Name() string {
	return n.name
}

func (n *GeoPointField) ArrayPositions() []uint64 {
	return n.arrayPositions
}

func (n *GeoPointField) Options() index.FieldIndexingOptions {
	return n.options
}

func (n *GeoPointField) EncodedFieldType() byte {
	return 'g'
}

func (n *GeoPointField) AnalyzedLength() int {
	return n.length
}

func (n *GeoPointField) AnalyzedTokenFrequencies() index.TokenFrequencies {
	return n.frequencies
}

func (n *GeoPointField) Analyze() {
	tokens := make(analysis.TokenStream, 0, 8)
	tokens = append(tokens, &analysis.Token{
		Start:    0,
		End:      len(n.value),
		Term:     n.value,
		Position: 1,
		Type:     analysis.Numeric,
	})

	if n.spatialplugin != nil {
		lat, _ := n.Lat()
		lon, _ := n.Lon()
		p := &geo.Point{Lat: lat, Lon: lon}
		terms := n.spatialplugin.GetIndexTokens(p)

		for _, term := range terms {
			token := analysis.Token{
				Start:    0,
				End:      len(term),
				Term:     []byte(term),
				Position: 1,
				Type:     analysis.AlphaNumeric,
			}
			tokens = append(tokens, &token)
		}
	} else {
		original, err := n.value.Int64()
		if err == nil {

			shift := GeoPrecisionStep
			for shift < 64 {
				shiftEncoded, err := numeric.NewPrefixCodedInt64(original, shift)
				if err != nil {
					break
				}
				token := analysis.Token{
					Start:    0,
					End:      len(shiftEncoded),
					Term:     shiftEncoded,
					Position: 1,
					Type:     analysis.Numeric,
				}
				tokens = append(tokens, &token)
				shift += GeoPrecisionStep
			}
		}
	}

	n.length = len(tokens)
	n.frequencies = analysis.TokenFrequency(tokens, n.arrayPositions, n.options)
}

func (n *GeoPointField) Value() []byte {
	return n.value
}

func (n *GeoPointField) Lon() (float64, error) {
	i64, err := n.value.Int64()
	if err != nil {
		return 0.0, err
	}
	return geo.MortonUnhashLon(uint64(i64)), nil
}

func (n *GeoPointField) Lat() (float64, error) {
	i64, err := n.value.Int64()
	if err != nil {
		return 0.0, err
	}
	return geo.MortonUnhashLat(uint64(i64)), nil
}

func (n *GeoPointField) GoString() string {
	return fmt.Sprintf("&document.GeoPointField{Name:%s, Options: %s, Value: %s}", n.name, n.options, n.value)
}

func (n *GeoPointField) NumPlainTextBytes() uint64 {
	return n.numPlainTextBytes
}

func NewGeoPointFieldFromBytes(name string, arrayPositions []uint64, value []byte) *GeoPointField {
	return &GeoPointField{
		name:              name,
		arrayPositions:    arrayPositions,
		value:             value,
		options:           DefaultNumericIndexingOptions,
		numPlainTextBytes: uint64(len(value)),
	}
}

func NewGeoPointField(name string, arrayPositions []uint64, lon, lat float64) *GeoPointField {
	return NewGeoPointFieldWithIndexingOptions(name, arrayPositions, lon, lat, DefaultNumericIndexingOptions)
}

func NewGeoPointFieldWithIndexingOptions(name string, arrayPositions []uint64, lon, lat float64, options index.FieldIndexingOptions) *GeoPointField {
	mhash := geo.MortonHash(lon, lat)
	prefixCoded := numeric.MustNewPrefixCodedInt64(int64(mhash), 0)
	return &GeoPointField{
		name:           name,
		arrayPositions: arrayPositions,
		value:          prefixCoded,
		options:        options,
		// not correct, just a place holder until we revisit how fields are
		// represented and can fix this better
		numPlainTextBytes: uint64(8),
	}
}

// SetSpatialAnalyzerPlugin implements the
// index.TokenisableSpatialField interface.
func (n *GeoPointField) SetSpatialAnalyzerPlugin(
	plugin index.SpatialAnalyzerPlugin) {
	n.spatialplugin = plugin
}
