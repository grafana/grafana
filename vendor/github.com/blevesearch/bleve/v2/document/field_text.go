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

package document

import (
	"fmt"
	"reflect"

	"github.com/blevesearch/bleve/v2/analysis"
	"github.com/blevesearch/bleve/v2/size"
	index "github.com/blevesearch/bleve_index_api"
)

var reflectStaticSizeTextField int

func init() {
	var f TextField
	reflectStaticSizeTextField = int(reflect.TypeOf(f).Size())
}

const DefaultTextIndexingOptions = index.IndexField | index.DocValues

type TextField struct {
	name              string
	arrayPositions    []uint64
	options           index.FieldIndexingOptions
	analyzer          analysis.Analyzer
	value             []byte
	numPlainTextBytes uint64
	length            int
	frequencies       index.TokenFrequencies
}

func (t *TextField) Size() int {
	var freqSize int
	if t.frequencies != nil {
		freqSize = t.frequencies.Size()
	}
	return reflectStaticSizeTextField + size.SizeOfPtr +
		len(t.name) +
		len(t.arrayPositions)*size.SizeOfUint64 +
		len(t.value) +
		freqSize
}

func (t *TextField) Name() string {
	return t.name
}

func (t *TextField) ArrayPositions() []uint64 {
	return t.arrayPositions
}

func (t *TextField) Options() index.FieldIndexingOptions {
	return t.options
}

func (t *TextField) EncodedFieldType() byte {
	return 't'
}

func (t *TextField) AnalyzedLength() int {
	return t.length
}

func (t *TextField) AnalyzedTokenFrequencies() index.TokenFrequencies {
	return t.frequencies
}

func (t *TextField) Analyze() {
	var tokens analysis.TokenStream
	if t.analyzer != nil {
		bytesToAnalyze := t.Value()
		if t.options.IsStored() {
			// need to copy
			bytesCopied := make([]byte, len(bytesToAnalyze))
			copy(bytesCopied, bytesToAnalyze)
			bytesToAnalyze = bytesCopied
		}
		tokens = t.analyzer.Analyze(bytesToAnalyze)
	} else {
		tokens = analysis.TokenStream{
			&analysis.Token{
				Start:    0,
				End:      len(t.value),
				Term:     t.value,
				Position: 1,
				Type:     analysis.AlphaNumeric,
			},
		}
	}
	t.length = len(tokens) // number of tokens in this doc field
	t.frequencies = analysis.TokenFrequency(tokens, t.arrayPositions, t.options)
}

func (t *TextField) Analyzer() analysis.Analyzer {
	return t.analyzer
}

func (t *TextField) Value() []byte {
	return t.value
}

func (t *TextField) Text() string {
	return string(t.value)
}

func (t *TextField) GoString() string {
	return fmt.Sprintf("&document.TextField{Name:%s, Options: %s, Analyzer: %v, Value: %s, ArrayPositions: %v}", t.name, t.options, t.analyzer, t.value, t.arrayPositions)
}

func (t *TextField) NumPlainTextBytes() uint64 {
	return t.numPlainTextBytes
}

func NewTextField(name string, arrayPositions []uint64, value []byte) *TextField {
	return NewTextFieldWithIndexingOptions(name, arrayPositions, value, DefaultTextIndexingOptions)
}

func NewTextFieldWithIndexingOptions(name string, arrayPositions []uint64, value []byte, options index.FieldIndexingOptions) *TextField {
	return &TextField{
		name:              name,
		arrayPositions:    arrayPositions,
		options:           options,
		value:             value,
		numPlainTextBytes: uint64(len(value)),
	}
}

func NewTextFieldWithAnalyzer(name string, arrayPositions []uint64, value []byte, analyzer analysis.Analyzer) *TextField {
	return &TextField{
		name:              name,
		arrayPositions:    arrayPositions,
		options:           DefaultTextIndexingOptions,
		analyzer:          analyzer,
		value:             value,
		numPlainTextBytes: uint64(len(value)),
	}
}

func NewTextFieldCustom(name string, arrayPositions []uint64, value []byte, options index.FieldIndexingOptions, analyzer analysis.Analyzer) *TextField {
	return &TextField{
		name:              name,
		arrayPositions:    arrayPositions,
		options:           options,
		analyzer:          analyzer,
		value:             value,
		numPlainTextBytes: uint64(len(value)),
	}
}
