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

package unicode

import (
	"github.com/blevesearch/segment"

	"github.com/blevesearch/bleve/v2/analysis"
	"github.com/blevesearch/bleve/v2/registry"
)

const Name = "unicode"

type UnicodeTokenizer struct {
}

func NewUnicodeTokenizer() *UnicodeTokenizer {
	return &UnicodeTokenizer{}
}

func (rt *UnicodeTokenizer) Tokenize(input []byte) analysis.TokenStream {
	rvx := make([]analysis.TokenStream, 0, 10) // When rv gets full, append to rvx.
	rv := make(analysis.TokenStream, 0, 1)

	ta := []analysis.Token(nil)
	taNext := 0

	segmenter := segment.NewWordSegmenterDirect(input)
	start := 0
	pos := 1

	guessRemaining := func(end int) int {
		avgSegmentLen := end / (len(rv) + 1)
		if avgSegmentLen < 1 {
			avgSegmentLen = 1
		}

		remainingLen := len(input) - end

		return remainingLen / avgSegmentLen
	}

	for segmenter.Segment() {
		segmentBytes := segmenter.Bytes()
		end := start + len(segmentBytes)
		if segmenter.Type() != segment.None {
			if taNext >= len(ta) {
				remainingSegments := guessRemaining(end)
				if remainingSegments > 1000 {
					remainingSegments = 1000
				}
				if remainingSegments < 1 {
					remainingSegments = 1
				}

				ta = make([]analysis.Token, remainingSegments)
				taNext = 0
			}

			token := &ta[taNext]
			taNext++

			token.Term = segmentBytes
			token.Start = start
			token.End = end
			token.Position = pos
			token.Type = convertType(segmenter.Type())

			if len(rv) >= cap(rv) { // When rv is full, save it into rvx.
				rvx = append(rvx, rv)

				rvCap := cap(rv) * 2
				if rvCap > 256 {
					rvCap = 256
				}

				rv = make(analysis.TokenStream, 0, rvCap) // Next rv cap is bigger.
			}

			rv = append(rv, token)
			pos++
		}
		start = end
	}

	if len(rvx) > 0 {
		n := len(rv)
		for _, r := range rvx {
			n += len(r)
		}
		rall := make(analysis.TokenStream, 0, n)
		for _, r := range rvx {
			rall = append(rall, r...)
		}
		return append(rall, rv...)
	}

	return rv
}

func UnicodeTokenizerConstructor(config map[string]interface{}, cache *registry.Cache) (analysis.Tokenizer, error) {
	return NewUnicodeTokenizer(), nil
}

func init() {
	err := registry.RegisterTokenizer(Name, UnicodeTokenizerConstructor)
	if err != nil {
		panic(err)
	}
}

func convertType(segmentWordType int) analysis.TokenType {
	switch segmentWordType {
	case segment.Ideo:
		return analysis.Ideographic
	case segment.Kana:
		return analysis.Ideographic
	case segment.Number:
		return analysis.Numeric
	}
	return analysis.AlphaNumeric
}
