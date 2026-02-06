//  Copyright (c) 2023 Couchbase, Inc.
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

//go:build vectors
// +build vectors

package mapping

import (
	"fmt"
	"reflect"
	"slices"

	"github.com/blevesearch/bleve/v2/document"
	"github.com/blevesearch/bleve/v2/util"
	index "github.com/blevesearch/bleve_index_api"
	faiss "github.com/blevesearch/go-faiss"
)

// Min and Max allowed dimensions for a vector field;
// p.s must be set/updated at process init() _only_
var (
	MinVectorDims = 1
	MaxVectorDims = 4096
)

func NewVectorFieldMapping() *FieldMapping {
	return &FieldMapping{
		Type:         "vector",
		Store:        false,
		Index:        true,
		IncludeInAll: false,
		DocValues:    false,
		SkipFreqNorm: true,
	}
}

func NewVectorBase64FieldMapping() *FieldMapping {
	return &FieldMapping{
		Type:         "vector_base64",
		Store:        false,
		Index:        true,
		IncludeInAll: false,
		DocValues:    false,
		SkipFreqNorm: true,
	}
}

// validate and process a flat vector
func processFlatVector(vecV reflect.Value, dims int) ([]float32, bool) {
	if vecV.Len() != dims {
		return nil, false
	}

	rv := make([]float32, dims)
	for i := 0; i < vecV.Len(); i++ {
		item := vecV.Index(i)
		if !item.CanInterface() {
			return nil, false
		}
		itemI := item.Interface()
		itemFloat, ok := util.ExtractNumericValFloat32(itemI)
		if !ok {
			return nil, false
		}
		rv[i] = itemFloat
	}

	return rv, true
}

// validate and process a vector
// max supported depth of nesting is 2 ([][]float32)
func processVector(vecI interface{}, dims int) ([]float32, bool) {
	vecV := reflect.ValueOf(vecI)
	if !vecV.IsValid() || vecV.Kind() != reflect.Slice || vecV.Len() == 0 {
		return nil, false
	}

	// Let's examine the first element (head) of the vector.
	// If head is a slice, then vector is nested, otherwise flat.
	head := vecV.Index(0)
	if !head.CanInterface() {
		return nil, false
	}
	headI := head.Interface()
	headV := reflect.ValueOf(headI)
	if !headV.IsValid() {
		return nil, false
	}
	if headV.Kind() != reflect.Slice { // vector is flat
		return processFlatVector(vecV, dims)
	}

	// # process nested vector

	// pre-allocate memory for the flattened vector
	// so that we can use copy() later
	rv := make([]float32, dims*vecV.Len())

	for i := 0; i < vecV.Len(); i++ {
		subVec := vecV.Index(i)
		if !subVec.CanInterface() {
			return nil, false
		}
		subVecI := subVec.Interface()
		subVecV := reflect.ValueOf(subVecI)
		if !subVecV.IsValid() {
			return nil, false
		}

		if subVecV.Kind() != reflect.Slice {
			return nil, false
		}

		flatVector, ok := processFlatVector(subVecV, dims)
		if !ok {
			return nil, false
		}

		copy(rv[i*dims:(i+1)*dims], flatVector)
	}

	return rv, true
}

func (fm *FieldMapping) processVector(propertyMightBeVector interface{},
	pathString string, path []string, indexes []uint64, context *walkContext) bool {
	vector, ok := processVector(propertyMightBeVector, fm.Dims)
	// Don't add field to document if vector is invalid
	if !ok {
		return false
	}
	// Apply defaults for similarity and optimization if not set
	similarity := fm.Similarity
	if similarity == "" {
		similarity = index.DefaultVectorSimilarityMetric
	}
	vectorIndexOptimizedFor := fm.VectorIndexOptimizedFor
	if vectorIndexOptimizedFor == "" {
		vectorIndexOptimizedFor = index.DefaultIndexOptimization
	}
	// normalize raw vector if similarity is cosine
	// Since the vector can be multi-vector (flattened array of multiple vectors),
	// we use NormalizeMultiVector to normalize each sub-vector independently.
	if similarity == index.CosineSimilarity {
		vector = NormalizeMultiVector(vector, fm.Dims)
	}

	fieldName := getFieldName(pathString, path, fm)

	options := fm.Options()
	field := document.NewVectorFieldWithIndexingOptions(fieldName, indexes, vector,
		fm.Dims, similarity, vectorIndexOptimizedFor, options)
	context.doc.AddField(field)

	// "_all" composite field is not applicable for vector field
	context.excludedFromAll = append(context.excludedFromAll, fieldName)
	return true
}

func (fm *FieldMapping) processVectorBase64(propertyMightBeVectorBase64 interface{},
	pathString string, path []string, indexes []uint64, context *walkContext) {
	encodedString, ok := propertyMightBeVectorBase64.(string)
	if !ok {
		return
	}
	// Apply defaults for similarity and optimization if not set
	similarity := fm.Similarity
	if similarity == "" {
		similarity = index.DefaultVectorSimilarityMetric
	}
	vectorIndexOptimizedFor := fm.VectorIndexOptimizedFor
	if vectorIndexOptimizedFor == "" {
		vectorIndexOptimizedFor = index.DefaultIndexOptimization
	}
	decodedVector, err := document.DecodeVector(encodedString)
	if err != nil || len(decodedVector) != fm.Dims {
		return
	}
	// normalize raw vector if similarity is cosine, multi-vector is not supported
	// for base64 encoded vectors, so we use NormalizeVector directly.
	if similarity == index.CosineSimilarity {
		decodedVector = NormalizeVector(decodedVector)
	}

	fieldName := getFieldName(pathString, path, fm)
	options := fm.Options()
	field := document.NewVectorFieldWithIndexingOptions(fieldName, indexes, decodedVector,
		fm.Dims, similarity, vectorIndexOptimizedFor, options)
	context.doc.AddField(field)

	// "_all" composite field is not applicable for vector_base64 field
	context.excludedFromAll = append(context.excludedFromAll, fieldName)
}

// -----------------------------------------------------------------------------
// document validation functions

func validateFieldMapping(field *FieldMapping, path []string,
	fieldAliasCtx map[string]*FieldMapping) error {
	switch field.Type {
	case "vector", "vector_base64":
		return validateVectorFieldAlias(field, path, fieldAliasCtx)
	default: // non-vector field
		return validateFieldType(field)
	}
}

func validateVectorFieldAlias(field *FieldMapping, path []string,
	fieldAliasCtx map[string]*FieldMapping) error {
	// fully qualified field name
	pathString := encodePath(path)
	// check if field has a name set, else use path to compute effective name
	effectiveFieldName := getFieldName(pathString, path, field)
	// Compute effective values for validation
	effectiveSimilarity := field.Similarity
	if effectiveSimilarity == "" {
		effectiveSimilarity = index.DefaultVectorSimilarityMetric
	}
	effectiveOptimizedFor := field.VectorIndexOptimizedFor
	if effectiveOptimizedFor == "" {
		effectiveOptimizedFor = index.DefaultIndexOptimization
	}

	// # If alias is present, validate the field options as per the alias.
	// note: reading from a nil map is safe
	if fieldAlias, ok := fieldAliasCtx[effectiveFieldName]; ok {
		if field.Dims != fieldAlias.Dims {
			return fmt.Errorf("field: '%s', invalid alias "+
				"(different dimensions %d and %d)", effectiveFieldName, field.Dims,
				fieldAlias.Dims)
		}

		// Compare effective similarity values
		aliasSimilarity := fieldAlias.Similarity
		if aliasSimilarity == "" {
			aliasSimilarity = index.DefaultVectorSimilarityMetric
		}
		if effectiveSimilarity != aliasSimilarity {
			return fmt.Errorf("field: '%s', invalid alias "+
				"(different similarity values %s and %s)", effectiveFieldName,
				effectiveSimilarity, aliasSimilarity)
		}

		// Compare effective vector index optimization values
		aliasOptimizedFor := fieldAlias.VectorIndexOptimizedFor
		if aliasOptimizedFor == "" {
			aliasOptimizedFor = index.DefaultIndexOptimization
		}
		if effectiveOptimizedFor != aliasOptimizedFor {
			return fmt.Errorf("field: '%s', invalid alias "+
				"(different vector index optimization values %s and %s)", effectiveFieldName,
				effectiveOptimizedFor, aliasOptimizedFor)
		}

		return nil
	}

	// # Validate field options
	// Vector dimensions must be within allowed range
	if field.Dims < MinVectorDims || field.Dims > MaxVectorDims {
		return fmt.Errorf("field: '%s', invalid vector dimension: %d,"+
			" value should be in range [%d, %d]", effectiveFieldName, field.Dims,
			MinVectorDims, MaxVectorDims)
	}
	// Similarity metric must be supported
	if _, ok := index.SupportedVectorSimilarityMetrics[effectiveSimilarity]; !ok {
		return fmt.Errorf("field: '%s', invalid similarity "+
			"metric: '%s', valid metrics are: %+v", effectiveFieldName, effectiveSimilarity,
			reflect.ValueOf(index.SupportedVectorSimilarityMetrics).MapKeys())
	}
	// Vector index optimization must be supported
	if _, ok := index.SupportedVectorIndexOptimizations[effectiveOptimizedFor]; !ok {
		return fmt.Errorf("field: '%s', invalid vector index "+
			"optimization: '%s', valid optimizations are: %+v", effectiveFieldName,
			effectiveOptimizedFor,
			reflect.ValueOf(index.SupportedVectorIndexOptimizations).MapKeys())
	}

	if fieldAliasCtx != nil { // writing to a nil map is unsafe
		fieldAliasCtx[effectiveFieldName] = field
	}

	return nil
}

// NormalizeVector normalizes a single vector to unit length.
// It makes a copy of the input vector to avoid modifying it in-place.
func NormalizeVector(vec []float32) []float32 {
	// make a copy of the vector to avoid modifying the original
	// vector in-place
	vecCopy := slices.Clone(vec)
	// normalize the vector copy using in-place normalization provided by faiss
	return faiss.NormalizeVector(vecCopy)
}

// NormalizeMultiVector normalizes each sub-vector of size `dims` independently.
// For a flattened array containing multiple vectors, each sub-vector is
// normalized separately to unit length.
// It makes a copy of the input vector to avoid modifying it in-place.
func NormalizeMultiVector(vec []float32, dims int) []float32 {
	if len(vec) == 0 || dims <= 0 || len(vec)%dims != 0 {
		return vec
	}
	// Single vector - delegate to NormalizeVector
	if len(vec) == dims {
		return NormalizeVector(vec)
	}
	// Multi-vector - make a copy to avoid modifying the original
	result := slices.Clone(vec)
	// Normalize each sub-vector in-place
	for i := 0; i < len(result); i += dims {
		faiss.NormalizeVector(result[i : i+dims])
	}
	return result
}
