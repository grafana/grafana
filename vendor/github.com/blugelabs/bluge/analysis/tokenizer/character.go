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

package tokenizer

import (
	"unicode/utf8"

	"github.com/blugelabs/bluge/analysis"
)

type IsTokenRune func(r rune) bool

type CharacterTokenizer struct {
	isTokenRun IsTokenRune
}

func NewCharacterTokenizer(f IsTokenRune) *CharacterTokenizer {
	return &CharacterTokenizer{
		isTokenRun: f,
	}
}

func (c *CharacterTokenizer) Tokenize(input []byte) analysis.TokenStream {
	rv := make(analysis.TokenStream, 0, 1024)

	offset := 0
	start := 0
	end := 0
	for currRune, size := utf8.DecodeRune(input[offset:]); currRune != utf8.RuneError; currRune, size = utf8.DecodeRune(input[offset:]) {
		isToken := c.isTokenRun(currRune)
		if isToken {
			end = offset + size
		} else {
			if end-start > 0 {
				// build token
				rv = append(rv, &analysis.Token{
					Term:         input[start:end],
					Start:        start,
					End:          end,
					PositionIncr: 1,
					Type:         analysis.AlphaNumeric,
				})
			}
			start = offset + size
			end = start
		}
		offset += size
	}
	// if we ended in the middle of a token, finish it
	if end-start > 0 {
		// build token
		rv = append(rv, &analysis.Token{
			Term:         input[start:end],
			Start:        start,
			End:          end,
			PositionIncr: 1,
			Type:         analysis.AlphaNumeric,
		})
	}
	return rv
}
