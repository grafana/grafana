//  Copyright (c) 2024 Couchbase, Inc.
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
	"encoding/base64"
	"encoding/binary"
	"fmt"
	"math"
	"reflect"

	"github.com/blevesearch/bleve/v2/size"
	"github.com/blevesearch/bleve/v2/util"
	index "github.com/blevesearch/bleve_index_api"
)

var reflectStaticSizeVectorBase64Field int

func init() {
	var f VectorBase64Field
	reflectStaticSizeVectorBase64Field = int(reflect.TypeOf(f).Size())
}

type VectorBase64Field struct {
	vectorField    *VectorField
	base64Encoding string
}

func (n *VectorBase64Field) Size() int {
	var vecFieldSize int
	if n.vectorField != nil {
		vecFieldSize = n.vectorField.Size()
	}
	return reflectStaticSizeVectorBase64Field + size.SizeOfPtr +
		len(n.base64Encoding) +
		vecFieldSize
}

func (n *VectorBase64Field) Name() string {
	return n.vectorField.Name()
}

func (n *VectorBase64Field) ArrayPositions() []uint64 {
	return n.vectorField.ArrayPositions()
}

func (n *VectorBase64Field) Options() index.FieldIndexingOptions {
	return n.vectorField.Options()
}

func (n *VectorBase64Field) NumPlainTextBytes() uint64 {
	return n.vectorField.NumPlainTextBytes()
}

func (n *VectorBase64Field) AnalyzedLength() int {
	return n.vectorField.AnalyzedLength()
}

func (n *VectorBase64Field) EncodedFieldType() byte {
	return 'e'
}

func (n *VectorBase64Field) AnalyzedTokenFrequencies() index.TokenFrequencies {
	return n.vectorField.AnalyzedTokenFrequencies()
}

func (n *VectorBase64Field) Analyze() {
}

func (n *VectorBase64Field) Value() []byte {
	return n.vectorField.Value()
}

func (n *VectorBase64Field) GoString() string {
	return fmt.Sprintf("&document.vectorFieldBase64Field{Name:%s, Options: %s, "+
		"Value: %+v}", n.vectorField.Name(), n.vectorField.Options(), n.vectorField.Value())
}

// For the sake of not polluting the API, we are keeping arrayPositions as a
// parameter, but it is not used.
func NewVectorBase64Field(name string, arrayPositions []uint64, vectorBase64 string,
	dims int, similarity, vectorIndexOptimizedFor string) (*VectorBase64Field, error) {

	decodedVector, err := DecodeVector(vectorBase64)
	if err != nil {
		return nil, err
	}

	return &VectorBase64Field{
		vectorField: NewVectorFieldWithIndexingOptions(name, arrayPositions,
			decodedVector, dims, similarity,
			vectorIndexOptimizedFor, DefaultVectorIndexingOptions),

		base64Encoding: vectorBase64,
	}, nil
}

// This function takes a base64 encoded string and decodes it into
// a vector.
func DecodeVector(encodedValue string) ([]float32, error) {
	// We first decode the encoded string into a byte array.
	decodedString, err := base64.StdEncoding.DecodeString(encodedValue)
	if err != nil {
		return nil, err
	}

	// The array is expected to be divisible by 4 because each float32
	// should occupy 4 bytes
	if len(decodedString)%size.SizeOfFloat32 != 0 {
		return nil, fmt.Errorf("decoded byte array not divisible by %d", size.SizeOfFloat32)
	}
	dims := int(len(decodedString) / size.SizeOfFloat32)

	if dims <= 0 {
		return nil, fmt.Errorf("unable to decode encoded vector")
	}

	decodedVector := make([]float32, dims)

	// We iterate through the array 4 bytes at a time and convert each of
	// them to a float32 value by reading them in a little endian notation
	for i := 0; i < dims; i++ {
		bytes := decodedString[i*size.SizeOfFloat32 : (i+1)*size.SizeOfFloat32]
		entry := math.Float32frombits(binary.LittleEndian.Uint32(bytes))
		if !util.IsValidFloat32(float64(entry)) {
			return nil, fmt.Errorf("invalid float32 value: %f", entry)
		}
		decodedVector[i] = entry
	}

	return decodedVector, nil
}

func (n *VectorBase64Field) Vector() []float32 {
	return n.vectorField.Vector()
}

func (n *VectorBase64Field) Dims() int {
	return n.vectorField.Dims()
}

func (n *VectorBase64Field) Similarity() string {
	return n.vectorField.Similarity()
}

func (n *VectorBase64Field) IndexOptimizedFor() string {
	return n.vectorField.IndexOptimizedFor()
}
