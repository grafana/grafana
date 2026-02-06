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

package document

import (
	"fmt"
	"reflect"

	"github.com/blevesearch/bleve/v2/analysis"
	"github.com/blevesearch/bleve/v2/geo"
	"github.com/blevesearch/bleve/v2/size"
	index "github.com/blevesearch/bleve_index_api"
	"github.com/blevesearch/geo/geojson"
)

var reflectStaticSizeGeoShapeField int

func init() {
	var f GeoShapeField
	reflectStaticSizeGeoShapeField = int(reflect.TypeOf(f).Size())
}

const DefaultGeoShapeIndexingOptions = index.IndexField | index.DocValues

type GeoShapeField struct {
	name              string
	shape             index.GeoJSON
	arrayPositions    []uint64
	options           index.FieldIndexingOptions
	numPlainTextBytes uint64
	length            int
	encodedValue      []byte
	value             []byte

	frequencies index.TokenFrequencies
}

func (n *GeoShapeField) Size() int {
	var freqSize int
	if n.frequencies != nil {
		freqSize = n.frequencies.Size()
	}
	return reflectStaticSizeGeoShapeField + size.SizeOfPtr +
		len(n.name) +
		len(n.arrayPositions)*size.SizeOfUint64 +
		len(n.encodedValue) +
		len(n.value) +
		freqSize
}

func (n *GeoShapeField) Name() string {
	return n.name
}

func (n *GeoShapeField) ArrayPositions() []uint64 {
	return n.arrayPositions
}

func (n *GeoShapeField) Options() index.FieldIndexingOptions {
	return n.options
}

func (n *GeoShapeField) EncodedFieldType() byte {
	return 's'
}

func (n *GeoShapeField) AnalyzedLength() int {
	return n.length
}

func (n *GeoShapeField) AnalyzedTokenFrequencies() index.TokenFrequencies {
	return n.frequencies
}

func (n *GeoShapeField) Analyze() {
	// compute the bytes representation for the coordinates
	tokens := make(analysis.TokenStream, 0)

	rti := geo.GetSpatialAnalyzerPlugin("s2")
	terms := rti.GetIndexTokens(n.shape)

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

	n.length = len(tokens)
	n.frequencies = analysis.TokenFrequency(tokens, n.arrayPositions, n.options)
}

func (n *GeoShapeField) Value() []byte {
	return n.value
}

func (n *GeoShapeField) GoString() string {
	return fmt.Sprintf("&document.GeoShapeField{Name:%s, Options: %s, Value: %s}",
		n.name, n.options, n.value)
}

func (n *GeoShapeField) NumPlainTextBytes() uint64 {
	return n.numPlainTextBytes
}

func (n *GeoShapeField) EncodedShape() []byte {
	return n.encodedValue
}

func NewGeoShapeField(name string, arrayPositions []uint64,
	coordinates [][][][]float64, typ string) *GeoShapeField {
	return NewGeoShapeFieldWithIndexingOptions(name, arrayPositions,
		coordinates, typ, DefaultGeoShapeIndexingOptions)
}

func NewGeoShapeFieldFromBytes(name string, arrayPositions []uint64,
	value []byte) *GeoShapeField {
	return &GeoShapeField{
		name:              name,
		arrayPositions:    arrayPositions,
		value:             value,
		options:           DefaultGeoShapeIndexingOptions,
		numPlainTextBytes: uint64(len(value)),
	}
}

func NewGeoShapeFieldWithIndexingOptions(name string, arrayPositions []uint64,
	coordinates [][][][]float64, typ string,
	options index.FieldIndexingOptions) *GeoShapeField {
	shape := &geojson.GeoShape{
		Coordinates: coordinates,
		Type:        typ,
	}

	return NewGeoShapeFieldFromShapeWithIndexingOptions(name,
		arrayPositions, shape, options)
}

func NewGeoShapeFieldFromShapeWithIndexingOptions(name string, arrayPositions []uint64,
	geoShape *geojson.GeoShape, options index.FieldIndexingOptions) *GeoShapeField {

	var shape index.GeoJSON
	var encodedValue []byte
	var err error

	if geoShape.Type == geo.CircleType {
		shape, encodedValue, err = geo.NewGeoCircleShape(geoShape.Center, geoShape.Radius)
	} else {
		shape, encodedValue, err = geo.NewGeoJsonShape(geoShape.Coordinates, geoShape.Type)
	}
	if err != nil {
		return nil
	}

	// extra glue bytes to work around the term splitting logic from interfering
	// the custom encoding of the geoshape coordinates inside the docvalues.
	encodedValue = append(geo.GlueBytes, append(encodedValue, geo.GlueBytes...)...)

	// get the byte value for the geoshape.
	value, err := shape.Value()
	if err != nil {
		return nil
	}

	// docvalues are always enabled for geoshape fields, even if the
	// indexing options are set to not include docvalues.
	options |= index.DocValues

	return &GeoShapeField{
		shape:             shape,
		name:              name,
		arrayPositions:    arrayPositions,
		options:           options,
		encodedValue:      encodedValue,
		value:             value,
		numPlainTextBytes: uint64(len(value)),
	}
}

func NewGeometryCollectionFieldWithIndexingOptions(name string,
	arrayPositions []uint64, coordinates [][][][][]float64, types []string,
	options index.FieldIndexingOptions) *GeoShapeField {
	if len(coordinates) != len(types) {
		return nil
	}

	shapes := make([]*geojson.GeoShape, len(types))
	for i := range coordinates {
		shapes[i] = &geojson.GeoShape{
			Coordinates: coordinates[i],
			Type:        types[i],
		}
	}

	return NewGeometryCollectionFieldFromShapesWithIndexingOptions(name,
		arrayPositions, shapes, options)
}

func NewGeometryCollectionFieldFromShapesWithIndexingOptions(name string,
	arrayPositions []uint64, geoShapes []*geojson.GeoShape,
	options index.FieldIndexingOptions) *GeoShapeField {
	shape, encodedValue, err := geo.NewGeometryCollectionFromShapes(geoShapes)
	if err != nil {
		return nil
	}

	// extra glue bytes to work around the term splitting logic from interfering
	// the custom encoding of the geoshape coordinates inside the docvalues.
	encodedValue = append(geo.GlueBytes, append(encodedValue, geo.GlueBytes...)...)

	// get the byte value for the geometryCollection.
	value, err := shape.Value()
	if err != nil {
		return nil
	}

	// docvalues are always enabled for geoshape fields, even if the
	// indexing options are set to not include docvalues.
	options |= index.DocValues

	return &GeoShapeField{
		shape:             shape,
		name:              name,
		arrayPositions:    arrayPositions,
		options:           options,
		encodedValue:      encodedValue,
		value:             value,
		numPlainTextBytes: uint64(len(value)),
	}
}

func NewGeoCircleFieldWithIndexingOptions(name string, arrayPositions []uint64,
	centerPoint []float64, radius string,
	options index.FieldIndexingOptions) *GeoShapeField {

	shape := &geojson.GeoShape{
		Center: centerPoint,
		Radius: radius,
		Type:   geo.CircleType,
	}

	return NewGeoShapeFieldFromShapeWithIndexingOptions(name,
		arrayPositions, shape, options)
}

// GeoShape is an implementation of the index.GeoShapeField interface.
func (n *GeoShapeField) GeoShape() (index.GeoJSON, error) {
	return geojson.ParseGeoJSONShape(n.value)
}
