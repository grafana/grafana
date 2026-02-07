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

package document

import (
	"fmt"
	"reflect"

	"github.com/blevesearch/bleve/v2/size"
	index "github.com/blevesearch/bleve_index_api"
)

var reflectStaticSizeVectorField int

func init() {
	var f VectorField
	reflectStaticSizeVectorField = int(reflect.TypeOf(f).Size())
}

const DefaultVectorIndexingOptions = index.IndexField

type VectorField struct {
	name                    string
	dims                    int    // Dimensionality of the vector
	similarity              string // Similarity metric to use for scoring
	options                 index.FieldIndexingOptions
	value                   []float32
	numPlainTextBytes       uint64
	vectorIndexOptimizedFor string // Optimization applied to this index.
}

func (n *VectorField) Size() int {
	return reflectStaticSizeVectorField + size.SizeOfPtr +
		len(n.name) +
		len(n.similarity) +
		len(n.vectorIndexOptimizedFor) +
		int(numBytesFloat32s(n.value))
}

func (n *VectorField) Name() string {
	return n.name
}

func (n *VectorField) ArrayPositions() []uint64 {
	return nil
}

func (n *VectorField) Options() index.FieldIndexingOptions {
	return n.options
}

func (n *VectorField) NumPlainTextBytes() uint64 {
	return n.numPlainTextBytes
}

func (n *VectorField) AnalyzedLength() int {
	// vectors aren't analyzed
	return 0
}

func (n *VectorField) EncodedFieldType() byte {
	return 'v'
}

func (n *VectorField) AnalyzedTokenFrequencies() index.TokenFrequencies {
	// vectors aren't analyzed
	return nil
}

func (n *VectorField) Analyze() {
	// vectors aren't analyzed
}

func (n *VectorField) Value() []byte {
	return nil
}

func (n *VectorField) GoString() string {
	return fmt.Sprintf("&document.VectorField{Name:%s, Options: %s, "+
		"Value: %+v}", n.name, n.options, n.value)
}

// For the sake of not polluting the API, we are keeping arrayPositions as a
// parameter, but it is not used.
func NewVectorField(name string, arrayPositions []uint64,
	vector []float32, dims int, similarity, vectorIndexOptimizedFor string) *VectorField {
	return NewVectorFieldWithIndexingOptions(name, arrayPositions,
		vector, dims, similarity, vectorIndexOptimizedFor,
		DefaultVectorIndexingOptions)
}

// For the sake of not polluting the API, we are keeping arrayPositions as a
// parameter, but it is not used.
func NewVectorFieldWithIndexingOptions(name string, arrayPositions []uint64,
	vector []float32, dims int, similarity, vectorIndexOptimizedFor string,
	options index.FieldIndexingOptions) *VectorField {
	// ensure the options are set to not store/index term vectors/doc values
	options &^= index.StoreField | index.IncludeTermVectors | index.DocValues
	// skip freq/norms for vector field
	options |= index.SkipFreqNorm

	return &VectorField{
		name:                    name,
		dims:                    dims,
		similarity:              similarity,
		options:                 options,
		value:                   vector,
		numPlainTextBytes:       numBytesFloat32s(vector),
		vectorIndexOptimizedFor: vectorIndexOptimizedFor,
	}
}

func numBytesFloat32s(value []float32) uint64 {
	return uint64(len(value) * size.SizeOfFloat32)
}

// -----------------------------------------------------------------------------
// Following methods help in implementing the bleve_index_api's VectorField
// interface.

func (n *VectorField) Vector() []float32 {
	return n.value
}

func (n *VectorField) Dims() int {
	return n.dims
}

func (n *VectorField) Similarity() string {
	return n.similarity
}

func (n *VectorField) IndexOptimizedFor() string {
	return n.vectorIndexOptimizedFor
}
