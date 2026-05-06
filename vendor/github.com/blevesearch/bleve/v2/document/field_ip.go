//  Copyright (c) 2021 Couchbase, Inc.
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
	"net"
	"reflect"

	"github.com/blevesearch/bleve/v2/analysis"
	"github.com/blevesearch/bleve/v2/size"
	index "github.com/blevesearch/bleve_index_api"
)

var reflectStaticSizeIPField int

func init() {
	var f IPField
	reflectStaticSizeIPField = int(reflect.TypeOf(f).Size())
}

const DefaultIPIndexingOptions = index.StoreField | index.IndexField | index.DocValues

type IPField struct {
	name              string
	arrayPositions    []uint64
	options           index.FieldIndexingOptions
	value             net.IP
	numPlainTextBytes uint64
	length            int
	frequencies       index.TokenFrequencies
}

func (b *IPField) Size() int {
	var freqSize int
	if b.frequencies != nil {
		freqSize = b.frequencies.Size()
	}
	return reflectStaticSizeIPField + size.SizeOfPtr +
		len(b.name) +
		len(b.arrayPositions)*size.SizeOfUint64 +
		len(b.value) +
		freqSize
}

func (b *IPField) Name() string {
	return b.name
}

func (b *IPField) ArrayPositions() []uint64 {
	return b.arrayPositions
}

func (b *IPField) Options() index.FieldIndexingOptions {
	return b.options
}

func (n *IPField) EncodedFieldType() byte {
	return 'i'
}

func (n *IPField) AnalyzedLength() int {
	return n.length
}

func (n *IPField) AnalyzedTokenFrequencies() index.TokenFrequencies {
	return n.frequencies
}

func (b *IPField) Analyze() {

	tokens := analysis.TokenStream{
		&analysis.Token{
			Start:    0,
			End:      len(b.value),
			Term:     b.value,
			Position: 1,
			Type:     analysis.IP,
		},
	}
	b.length = 1
	b.frequencies = analysis.TokenFrequency(tokens, b.arrayPositions, b.options)
}

func (b *IPField) Value() []byte {
	return b.value
}

func (b *IPField) IP() (net.IP, error) {
	return net.IP(b.value), nil
}

func (b *IPField) GoString() string {
	return fmt.Sprintf("&document.IPField{Name:%s, Options: %s, Value: %s}", b.name, b.options, net.IP(b.value))
}

func (b *IPField) NumPlainTextBytes() uint64 {
	return b.numPlainTextBytes
}

func NewIPFieldFromBytes(name string, arrayPositions []uint64, value []byte) *IPField {
	return &IPField{
		name:              name,
		arrayPositions:    arrayPositions,
		value:             value,
		options:           DefaultIPIndexingOptions,
		numPlainTextBytes: uint64(len(value)),
	}
}

func NewIPField(name string, arrayPositions []uint64, v net.IP) *IPField {
	return NewIPFieldWithIndexingOptions(name, arrayPositions, v, DefaultIPIndexingOptions)
}

func NewIPFieldWithIndexingOptions(name string, arrayPositions []uint64, b net.IP, options index.FieldIndexingOptions) *IPField {
	v := b.To16()

	return &IPField{
		name:              name,
		arrayPositions:    arrayPositions,
		value:             v,
		options:           options,
		numPlainTextBytes: net.IPv6len,
	}
}
