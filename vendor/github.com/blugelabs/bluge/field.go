//  Copyright (c) 2020 Couchbase, Inc.
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

package bluge

import (
	"time"

	segment "github.com/blugelabs/bluge_segment_api"

	"github.com/blugelabs/bluge/analysis/analyzer"

	"github.com/blugelabs/bluge/analysis"
	"github.com/blugelabs/bluge/numeric"
	"github.com/blugelabs/bluge/numeric/geo"
)

type FieldOptions int

const (
	Index FieldOptions = 1 << iota
	Store
	SearchTermPositions
	HighlightMatches
	Sortable
	Aggregatable
)

func (o FieldOptions) Index() bool {
	return o&Index != 0
}

func (o FieldOptions) Store() bool {
	return o&Store != 0
}

func (o FieldOptions) IncludeLocations() bool {
	return o&SearchTermPositions != 0 || o&HighlightMatches != 0
}

func (o FieldOptions) IndexDocValues() bool {
	return o&Sortable != 0 || o&Aggregatable != 0
}

type Field interface {
	segment.Field

	Analyze(int) int
	AnalyzedTokenFrequencies() analysis.TokenFrequencies

	PositionIncrementGap() int

	Size() int
}

type TermField struct {
	FieldOptions
	name                 string
	value                []byte
	numPlainTextBytes    int
	analyzedLength       int
	analyzedTokenFreqs   analysis.TokenFrequencies
	analyzer             Analyzer
	positionIncrementGap int
}

func (b *TermField) PositionIncrementGap() int {
	return b.positionIncrementGap
}

func (b *TermField) SetPositionIncrementGap(positionIncrementGap int) *TermField {
	b.positionIncrementGap = positionIncrementGap
	return b
}

func (b *TermField) Name() string {
	return b.name
}

func (b *TermField) Size() int {
	return reflectStaticSizeBaseField + sizeOfPtr +
		len(b.name) +
		len(b.value)
}

func (b *TermField) AnalyzedLength() int {
	return b.analyzedLength
}

func (b *TermField) AnalyzedTokenFrequencies() analysis.TokenFrequencies {
	return b.analyzedTokenFreqs
}

func (b *TermField) Value() []byte {
	return b.value
}

func (b *TermField) NumPlainTextBytes() int {
	return b.numPlainTextBytes
}

func (b *TermField) StoreValue() *TermField {
	b.FieldOptions |= Store
	return b
}

func (b *TermField) Sortable() *TermField {
	b.FieldOptions |= Sortable
	return b
}

func (b *TermField) Aggregatable() *TermField {
	b.FieldOptions |= Aggregatable
	return b
}

func (b *TermField) SearchTermPositions() *TermField {
	b.FieldOptions |= SearchTermPositions
	return b
}

func (b *TermField) HighlightMatches() *TermField {
	b.FieldOptions |= HighlightMatches
	return b
}

func (b *TermField) EachTerm(vt segment.VisitTerm) {
	for _, v := range b.analyzedTokenFreqs {
		vt(v)
	}
}

func (b *TermField) Length() int {
	return b.analyzedLength
}

func (b *TermField) baseAnalayze(typ analysis.TokenType) analysis.TokenStream {
	var tokens analysis.TokenStream
	tokens = append(tokens, &analysis.Token{
		Start:        0,
		End:          len(b.value),
		Term:         b.value,
		PositionIncr: 1,
		Type:         typ,
	})
	return tokens
}

func (b *TermField) WithAnalyzer(fieldAnalyzer Analyzer) *TermField {
	b.analyzer = fieldAnalyzer
	return b
}

func (b *TermField) Analyze(startOffset int) (lastPos int) {
	var tokens analysis.TokenStream
	if b.analyzer != nil {
		bytesToAnalyze := b.Value()
		if b.Store() {
			// need to copy
			bytesCopied := make([]byte, len(bytesToAnalyze))
			copy(bytesCopied, bytesToAnalyze)
			bytesToAnalyze = bytesCopied
		}
		tokens = b.analyzer.Analyze(bytesToAnalyze)
	} else {
		tokens = b.baseAnalayze(analysis.AlphaNumeric)
	}
	b.analyzedLength = len(tokens) // number of tokens in this doc field
	b.analyzedTokenFreqs, lastPos = analysis.TokenFrequency(tokens, b.IncludeLocations(), startOffset)
	return lastPos
}

const defaultTextIndexingOptions = Index

type Analyzer interface {
	Analyze(input []byte) analysis.TokenStream
}

var standardAnalyzer = analyzer.NewStandardAnalyzer()

func NewKeywordField(name, value string) *TermField {
	return newTextField(name, []byte(value), nil)
}

func NewKeywordFieldBytes(name string, value []byte) *TermField {
	return newTextField(name, value, nil)
}

func NewTextField(name, value string) *TermField {
	return newTextField(name, []byte(value), standardAnalyzer)
}

func NewTextFieldBytes(name string, value []byte) *TermField {
	return newTextField(name, value, standardAnalyzer)
}

func newTextField(name string, value []byte, fieldAnalyzer Analyzer) *TermField {
	return &TermField{
		FieldOptions:         defaultTextIndexingOptions,
		name:                 name,
		value:                value,
		numPlainTextBytes:    len(value),
		analyzer:             fieldAnalyzer,
		positionIncrementGap: 100,
	}
}

const defaultNumericIndexingOptions = Index | Sortable | Aggregatable

const defaultNumericPrecisionStep uint = 4

func addShiftTokens(tokens analysis.TokenStream, original int64, shiftBy uint, typ analysis.TokenType) analysis.TokenStream {
	shift := shiftBy
	for shift < 64 {
		shiftEncoded, err := numeric.NewPrefixCodedInt64(original, shift)
		if err != nil {
			break
		}
		token := analysis.Token{
			Start:        0,
			End:          len(shiftEncoded),
			Term:         shiftEncoded,
			PositionIncr: 0,
			Type:         typ,
		}
		tokens = append(tokens, &token)
		shift += shiftBy
	}
	return tokens
}

type numericAnalyzer struct {
	tokenType analysis.TokenType
	shiftBy   uint
}

func (n *numericAnalyzer) Analyze(input []byte) analysis.TokenStream {
	tokens := analysis.TokenStream{
		&analysis.Token{
			Start:        0,
			End:          len(input),
			Term:         input,
			PositionIncr: 1,
			Type:         n.tokenType,
		},
	}
	original, err := numeric.PrefixCoded(input).Int64()
	if err == nil {
		tokens = addShiftTokens(tokens, original, n.shiftBy, n.tokenType)
	}
	return tokens
}

func NewNumericField(name string, number float64) *TermField {
	return newNumericFieldWithIndexingOptions(name, number, defaultNumericIndexingOptions)
}

func newNumericFieldWithIndexingOptions(name string, number float64, options FieldOptions) *TermField {
	numberInt64 := numeric.Float64ToInt64(number)
	prefixCoded := numeric.MustNewPrefixCodedInt64(numberInt64, 0)
	return &TermField{
		FieldOptions:      options,
		name:              name,
		value:             prefixCoded,
		numPlainTextBytes: 8,
		analyzer: &numericAnalyzer{
			tokenType: analysis.Numeric,
			shiftBy:   defaultNumericPrecisionStep,
		},
		positionIncrementGap: 100,
	}
}

func DecodeNumericFloat64(value []byte) (float64, error) {
	i64, err := numeric.PrefixCoded(value).Int64()
	if err != nil {
		return 0, err
	}
	return numeric.Int64ToFloat64(i64), nil
}

const defaultDateTimeIndexingOptions = Index | Sortable | Aggregatable

const defaultDateTimePrecisionStep uint = 4

func NewDateTimeField(name string, dt time.Time) *TermField {
	dtInt64 := dt.UnixNano()
	prefixCoded := numeric.MustNewPrefixCodedInt64(dtInt64, 0)
	return &TermField{
		FieldOptions:      defaultDateTimeIndexingOptions,
		name:              name,
		value:             prefixCoded,
		numPlainTextBytes: 8,
		analyzer: &numericAnalyzer{
			tokenType: analysis.DateTime,
			shiftBy:   defaultDateTimePrecisionStep,
		},
		positionIncrementGap: 100,
	}
}

func DecodeDateTime(value []byte) (time.Time, error) {
	i64, err := numeric.PrefixCoded(value).Int64()
	if err != nil {
		return time.Time{}, err
	}
	return time.Unix(0, i64).UTC(), nil
}

var geoPrecisionStep uint = 9

func NewGeoPointField(name string, lon, lat float64) *TermField {
	mHash := geo.MortonHash(lon, lat)
	prefixCoded := numeric.MustNewPrefixCodedInt64(int64(mHash), 0)
	return &TermField{
		FieldOptions:      defaultNumericIndexingOptions,
		name:              name,
		value:             prefixCoded,
		numPlainTextBytes: 8,
		analyzer: &numericAnalyzer{
			tokenType: analysis.Numeric,
			shiftBy:   geoPrecisionStep,
		},
		positionIncrementGap: 100,
	}
}

func DecodeGeoLonLat(value []byte) (lon, lat float64, err error) {
	i64, err := numeric.PrefixCoded(value).Int64()
	if err != nil {
		return 0, 0, err
	}
	return geo.MortonUnhashLon(uint64(i64)), geo.MortonUnhashLat(uint64(i64)), nil
}

const defaultCompositeIndexingOptions = Index

type CompositeField struct {
	*TermField
	includedFields map[string]bool
	excludedFields map[string]bool
	defaultInclude bool
}

func NewCompositeFieldIncluding(name string, including []string) *CompositeField {
	return newCompositeFieldWithIndexingOptions(name, false, including,
		nil, defaultCompositeIndexingOptions)
}

func NewCompositeFieldExcluding(name string, excluding []string) *CompositeField {
	return newCompositeFieldWithIndexingOptions(name, true, nil,
		excluding, defaultCompositeIndexingOptions)
}

func NewCompositeField(name string, defaultInclude bool, include, exclude []string) *CompositeField {
	return newCompositeFieldWithIndexingOptions(name, defaultInclude, include, exclude, defaultCompositeIndexingOptions)
}

func newCompositeFieldWithIndexingOptions(name string, defaultInclude bool, include, exclude []string,
	options FieldOptions) *CompositeField {
	rv := &CompositeField{
		TermField: &TermField{
			FieldOptions:       options,
			name:               name,
			analyzedTokenFreqs: make(analysis.TokenFrequencies),
		},
		defaultInclude: defaultInclude,
		includedFields: make(map[string]bool, len(include)),
		excludedFields: make(map[string]bool, len(exclude)),
	}

	for _, i := range include {
		rv.includedFields[i] = true
	}
	for _, e := range exclude {
		rv.excludedFields[e] = true
	}

	return rv
}

func (c *CompositeField) Size() int {
	sizeInBytes := c.TermField.Size()

	for k := range c.includedFields {
		sizeInBytes += sizeOfString + len(k) + sizeOfBool
	}

	for k := range c.excludedFields {
		sizeInBytes += sizeOfString + len(k) + sizeOfBool
	}

	return sizeInBytes
}

func (c *CompositeField) Analyze(int) int {
	return 0
}

func (c *CompositeField) PositionIncrementGap() int {
	return 0
}

func (c *CompositeField) includesField(field string) bool {
	shouldInclude := c.defaultInclude
	_, fieldShouldBeIncluded := c.includedFields[field]
	if fieldShouldBeIncluded {
		shouldInclude = true
	}
	_, fieldShouldBeExcluded := c.excludedFields[field]
	if fieldShouldBeExcluded {
		shouldInclude = false
	}
	return shouldInclude
}

func (c *CompositeField) Consume(field Field) {
	if c.includesField(field.Name()) {
		c.analyzedLength += field.Length()
		c.analyzedTokenFreqs.MergeAll(field.Name(), field.AnalyzedTokenFrequencies())
	}
}

func (c *CompositeField) EachTerm(vt segment.VisitTerm) {
	for _, v := range c.analyzedTokenFreqs {
		vt(v)
	}
}

func (c *CompositeField) Length() int {
	return c.analyzedLength
}

func NewStoredOnlyField(name string, value []byte) *TermField {
	return &TermField{
		FieldOptions:      Store,
		name:              name,
		value:             value,
		numPlainTextBytes: len(value),
	}
}
