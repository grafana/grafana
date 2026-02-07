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

package mapping

import (
	"encoding/json"
	"fmt"
	"net"
	"time"

	"github.com/blevesearch/bleve/v2/analysis"
	"github.com/blevesearch/bleve/v2/analysis/analyzer/keyword"
	"github.com/blevesearch/bleve/v2/document"
	"github.com/blevesearch/bleve/v2/geo"
	"github.com/blevesearch/bleve/v2/util"
	index "github.com/blevesearch/bleve_index_api"
	"github.com/blevesearch/geo/geojson"
)

// control the default behavior for dynamic fields (those not explicitly mapped)
var (
	IndexDynamic     = true
	StoreDynamic     = true
	DocValuesDynamic = true // TODO revisit default?
)

// A FieldMapping describes how a specific item
// should be put into the index.
type FieldMapping struct {
	Name string `json:"name,omitempty"`
	Type string `json:"type,omitempty"`

	// Analyzer specifies the name of the analyzer to use for this field.  If
	// Analyzer is empty, traverse the DocumentMapping tree toward the root and
	// pick the first non-empty DefaultAnalyzer found. If there is none, use
	// the IndexMapping.DefaultAnalyzer.
	Analyzer string `json:"analyzer,omitempty"`

	// Store indicates whether to store field values in the index. Stored
	// values can be retrieved from search results using SearchRequest.Fields.
	Store bool `json:"store,omitempty"`
	Index bool `json:"index,omitempty"`

	// IncludeTermVectors, if true, makes terms occurrences to be recorded for
	// this field. It includes the term position within the terms sequence and
	// the term offsets in the source document field. Term vectors are required
	// to perform phrase queries or terms highlighting in source documents.
	IncludeTermVectors bool   `json:"include_term_vectors,omitempty"`
	IncludeInAll       bool   `json:"include_in_all,omitempty"`
	DateFormat         string `json:"date_format,omitempty"`

	// DocValues, if true makes the index uninverting possible for this field
	// It is useful for faceting and sorting queries.
	DocValues bool `json:"docvalues,omitempty"`

	// SkipFreqNorm, if true, avoids the indexing of frequency and norm values
	// of the tokens for this field. This option would be useful for saving
	// the processing of freq/norm details when the default score based relevancy
	// isn't needed.
	SkipFreqNorm bool `json:"skip_freq_norm,omitempty"`

	// Dimensionality of the vector
	Dims int `json:"dims,omitempty"`

	// Similarity is the similarity algorithm used for scoring
	// field's content while performing search on it.
	// See: index.SimilarityModels
	Similarity string `json:"similarity,omitempty"`

	// Applicable to vector fields only - optimization string
	VectorIndexOptimizedFor string `json:"vector_index_optimized_for,omitempty"`

	SynonymSource string `json:"synonym_source,omitempty"`
}

// NewTextFieldMapping returns a default field mapping for text
func NewTextFieldMapping() *FieldMapping {
	return &FieldMapping{
		Type:               "text",
		Store:              true,
		Index:              true,
		IncludeTermVectors: true,
		IncludeInAll:       true,
		DocValues:          true,
	}
}

func newTextFieldMappingDynamic(im *IndexMappingImpl) *FieldMapping {
	rv := NewTextFieldMapping()
	rv.Store = im.StoreDynamic
	rv.Index = im.IndexDynamic
	rv.DocValues = im.DocValuesDynamic
	return rv
}

// NewKeywordFieldMapping returns a default field mapping for text with analyzer "keyword".
func NewKeywordFieldMapping() *FieldMapping {
	return &FieldMapping{
		Type:               "text",
		Analyzer:           keyword.Name,
		Store:              true,
		Index:              true,
		IncludeTermVectors: true,
		IncludeInAll:       true,
		DocValues:          true,
	}
}

// NewNumericFieldMapping returns a default field mapping for numbers
func NewNumericFieldMapping() *FieldMapping {
	return &FieldMapping{
		Type:         "number",
		Store:        true,
		Index:        true,
		IncludeInAll: true,
		DocValues:    true,
	}
}

func newNumericFieldMappingDynamic(im *IndexMappingImpl) *FieldMapping {
	rv := NewNumericFieldMapping()
	rv.Store = im.StoreDynamic
	rv.Index = im.IndexDynamic
	rv.DocValues = im.DocValuesDynamic
	return rv
}

// NewDateTimeFieldMapping returns a default field mapping for dates
func NewDateTimeFieldMapping() *FieldMapping {
	return &FieldMapping{
		Type:         "datetime",
		Store:        true,
		Index:        true,
		IncludeInAll: true,
		DocValues:    true,
	}
}

func newDateTimeFieldMappingDynamic(im *IndexMappingImpl) *FieldMapping {
	rv := NewDateTimeFieldMapping()
	rv.Store = im.StoreDynamic
	rv.Index = im.IndexDynamic
	rv.DocValues = im.DocValuesDynamic
	return rv
}

// NewBooleanFieldMapping returns a default field mapping for booleans
func NewBooleanFieldMapping() *FieldMapping {
	return &FieldMapping{
		Type:         "boolean",
		Store:        true,
		Index:        true,
		IncludeInAll: true,
		DocValues:    true,
	}
}

func newBooleanFieldMappingDynamic(im *IndexMappingImpl) *FieldMapping {
	rv := NewBooleanFieldMapping()
	rv.Store = im.StoreDynamic
	rv.Index = im.IndexDynamic
	rv.DocValues = im.DocValuesDynamic
	return rv
}

// NewGeoPointFieldMapping returns a default field mapping for geo points
func NewGeoPointFieldMapping() *FieldMapping {
	return &FieldMapping{
		Type:         "geopoint",
		Store:        true,
		Index:        true,
		IncludeInAll: true,
		DocValues:    true,
	}
}

// NewGeoShapeFieldMapping returns a default field mapping
// for geoshapes
func NewGeoShapeFieldMapping() *FieldMapping {
	return &FieldMapping{
		Type:         "geoshape",
		Store:        true,
		Index:        true,
		IncludeInAll: true,
		DocValues:    true,
	}
}

// NewIPFieldMapping returns a default field mapping for IP points
func NewIPFieldMapping() *FieldMapping {
	return &FieldMapping{
		Type:         "IP",
		Store:        true,
		Index:        true,
		IncludeInAll: true,
	}
}

// Options returns the indexing options for this field.
func (fm *FieldMapping) Options() index.FieldIndexingOptions {
	var rv index.FieldIndexingOptions
	if fm.Store {
		rv |= index.StoreField
	}
	if fm.Index {
		rv |= index.IndexField
	}
	if fm.IncludeTermVectors {
		rv |= index.IncludeTermVectors
	}
	if fm.DocValues {
		rv |= index.DocValues
	}
	if fm.SkipFreqNorm {
		rv |= index.SkipFreqNorm
	}
	return rv
}

func (fm *FieldMapping) processString(propertyValueString string, pathString string, path []string, indexes []uint64, context *walkContext) {
	fieldName := getFieldName(pathString, path, fm)
	options := fm.Options()

	switch fm.Type {
	case "text":
		analyzer := fm.analyzerForField(path, context)
		field := document.NewTextFieldCustom(fieldName, indexes, []byte(propertyValueString), options, analyzer)
		context.doc.AddField(field)

		if !fm.IncludeInAll {
			context.excludedFromAll = append(context.excludedFromAll, fieldName)
		}
	case "datetime":
		dateTimeFormat := context.im.DefaultDateTimeParser
		if fm.DateFormat != "" {
			dateTimeFormat = fm.DateFormat
		}
		dateTimeParser := context.im.DateTimeParserNamed(dateTimeFormat)
		if dateTimeParser != nil {
			parsedDateTime, layout, err := dateTimeParser.ParseDateTime(propertyValueString)
			if err == nil {
				fm.processTime(parsedDateTime, layout, pathString, path, indexes, context)
			}
		}
	case "IP":
		ip := net.ParseIP(propertyValueString)
		if ip != nil {
			fm.processIP(ip, pathString, path, indexes, context)
		}
	}
}

func (fm *FieldMapping) processFloat64(propertyValFloat float64, pathString string, path []string, indexes []uint64, context *walkContext) {
	fieldName := getFieldName(pathString, path, fm)
	if fm.Type == "number" {
		options := fm.Options()
		field := document.NewNumericFieldWithIndexingOptions(fieldName, indexes, propertyValFloat, options)
		context.doc.AddField(field)

		if !fm.IncludeInAll {
			context.excludedFromAll = append(context.excludedFromAll, fieldName)
		}
	}
}

func (fm *FieldMapping) processTime(propertyValueTime time.Time, layout string, pathString string, path []string, indexes []uint64, context *walkContext) {
	fieldName := getFieldName(pathString, path, fm)
	if fm.Type == "datetime" {
		options := fm.Options()
		field, err := document.NewDateTimeFieldWithIndexingOptions(fieldName, indexes, propertyValueTime, layout, options)
		if err == nil {
			context.doc.AddField(field)
		} else {
			logger.Printf("could not build date %v", err)
		}

		if !fm.IncludeInAll {
			context.excludedFromAll = append(context.excludedFromAll, fieldName)
		}
	}
}

func (fm *FieldMapping) processBoolean(propertyValueBool bool, pathString string, path []string, indexes []uint64, context *walkContext) {
	fieldName := getFieldName(pathString, path, fm)
	if fm.Type == "boolean" {
		options := fm.Options()
		field := document.NewBooleanFieldWithIndexingOptions(fieldName, indexes, propertyValueBool, options)
		context.doc.AddField(field)

		if !fm.IncludeInAll {
			context.excludedFromAll = append(context.excludedFromAll, fieldName)
		}
	}
}

func (fm *FieldMapping) processGeoPoint(propertyMightBeGeoPoint interface{}, pathString string, path []string, indexes []uint64, context *walkContext) {
	lon, lat, found := geo.ExtractGeoPoint(propertyMightBeGeoPoint)
	if found {
		fieldName := getFieldName(pathString, path, fm)
		options := fm.Options()
		field := document.NewGeoPointFieldWithIndexingOptions(fieldName, indexes, lon, lat, options)
		context.doc.AddField(field)

		if !fm.IncludeInAll {
			context.excludedFromAll = append(context.excludedFromAll, fieldName)
		}
	}
}

func (fm *FieldMapping) processIP(ip net.IP, pathString string, path []string, indexes []uint64, context *walkContext) {
	fieldName := getFieldName(pathString, path, fm)
	options := fm.Options()
	field := document.NewIPFieldWithIndexingOptions(fieldName, indexes, ip, options)
	context.doc.AddField(field)

	if !fm.IncludeInAll {
		context.excludedFromAll = append(context.excludedFromAll, fieldName)
	}
}

func (fm *FieldMapping) processGeoShape(propertyMightBeGeoShape interface{},
	pathString string, path []string, indexes []uint64, context *walkContext,
) {
	coordValue, shape, err := geo.ParseGeoShapeField(propertyMightBeGeoShape)
	if err != nil {
		return
	}

	if shape == geo.GeometryCollectionType {
		geoShapes, found := geo.ExtractGeometryCollection(propertyMightBeGeoShape)
		if found {
			fieldName := getFieldName(pathString, path, fm)
			options := fm.Options()
			field := document.NewGeometryCollectionFieldFromShapesWithIndexingOptions(fieldName,
				indexes, geoShapes, options)
			context.doc.AddField(field)

			if !fm.IncludeInAll {
				context.excludedFromAll = append(context.excludedFromAll, fieldName)
			}
		}
	} else {
		var geoShape *geojson.GeoShape
		var found bool

		if shape == geo.CircleType {
			geoShape, found = geo.ExtractCircle(propertyMightBeGeoShape)
		} else {
			geoShape, found = geo.ExtractGeoShapeCoordinates(coordValue, shape)
		}

		if found {
			fieldName := getFieldName(pathString, path, fm)
			options := fm.Options()
			field := document.NewGeoShapeFieldFromShapeWithIndexingOptions(fieldName,
				indexes, geoShape, options)
			context.doc.AddField(field)

			if !fm.IncludeInAll {
				context.excludedFromAll = append(context.excludedFromAll, fieldName)
			}
		}
	}
}

func (fm *FieldMapping) analyzerForField(path []string, context *walkContext) analysis.Analyzer {
	analyzerName := fm.Analyzer
	if analyzerName == "" {
		analyzerName = context.dm.defaultAnalyzerName(path)
		if analyzerName == "" {
			analyzerName = context.im.DefaultAnalyzer
		}
	}
	return context.im.AnalyzerNamed(analyzerName)
}

func getFieldName(pathString string, path []string, fieldMapping *FieldMapping) string {
	fieldName := pathString
	if fieldMapping.Name != "" {
		parentName := ""
		if len(path) > 1 {
			parentName = encodePath(path[:len(path)-1]) + pathSeparator
		}
		fieldName = parentName + fieldMapping.Name
	}
	return fieldName
}

// UnmarshalJSON offers custom unmarshaling with optional strict validation
func (fm *FieldMapping) UnmarshalJSON(data []byte) error {
	var tmp map[string]json.RawMessage
	err := util.UnmarshalJSON(data, &tmp)
	if err != nil {
		return err
	}

	var invalidKeys []string
	for k, v := range tmp {
		switch k {
		case "name":
			err := util.UnmarshalJSON(v, &fm.Name)
			if err != nil {
				return err
			}
		case "type":
			err := util.UnmarshalJSON(v, &fm.Type)
			if err != nil {
				return err
			}
		case "analyzer":
			err := util.UnmarshalJSON(v, &fm.Analyzer)
			if err != nil {
				return err
			}
		case "store":
			err := util.UnmarshalJSON(v, &fm.Store)
			if err != nil {
				return err
			}
		case "index":
			err := util.UnmarshalJSON(v, &fm.Index)
			if err != nil {
				return err
			}
		case "include_term_vectors":
			err := util.UnmarshalJSON(v, &fm.IncludeTermVectors)
			if err != nil {
				return err
			}
		case "include_in_all":
			err := util.UnmarshalJSON(v, &fm.IncludeInAll)
			if err != nil {
				return err
			}
		case "date_format":
			err := util.UnmarshalJSON(v, &fm.DateFormat)
			if err != nil {
				return err
			}
		case "docvalues":
			err := util.UnmarshalJSON(v, &fm.DocValues)
			if err != nil {
				return err
			}
		case "skip_freq_norm":
			err := util.UnmarshalJSON(v, &fm.SkipFreqNorm)
			if err != nil {
				return err
			}
		case "dims":
			err := util.UnmarshalJSON(v, &fm.Dims)
			if err != nil {
				return err
			}
		case "similarity":
			err := util.UnmarshalJSON(v, &fm.Similarity)
			if err != nil {
				return err
			}
		case "vector_index_optimized_for":
			err := util.UnmarshalJSON(v, &fm.VectorIndexOptimizedFor)
			if err != nil {
				return err
			}
		case "synonym_source":
			err := util.UnmarshalJSON(v, &fm.SynonymSource)
			if err != nil {
				return err
			}
		default:
			invalidKeys = append(invalidKeys, k)
		}
	}

	if MappingJSONStrict && len(invalidKeys) > 0 {
		return fmt.Errorf("field mapping contains invalid keys: %v", invalidKeys)
	}

	return nil
}
