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

package token

import (
	"bytes"
	"unicode/utf8"

	"github.com/blugelabs/bluge/analysis"
)

type DictionaryCompoundFilter struct {
	dict             analysis.TokenMap
	minWordSize      int
	minSubWordSize   int
	maxSubWordSize   int
	onlyLongestMatch bool
}

func NewDictionaryCompoundFilter(dict analysis.TokenMap, minWordSize, minSubWordSize, maxSubWordSize int,
	onlyLongestMatch bool) *DictionaryCompoundFilter {
	return &DictionaryCompoundFilter{
		dict:             dict,
		minWordSize:      minWordSize,
		minSubWordSize:   minSubWordSize,
		maxSubWordSize:   maxSubWordSize,
		onlyLongestMatch: onlyLongestMatch,
	}
}

func (f *DictionaryCompoundFilter) Filter(input analysis.TokenStream) analysis.TokenStream {
	rv := make(analysis.TokenStream, 0, len(input))

	for _, token := range input {
		rv = append(rv, token)
		tokenLen := utf8.RuneCount(token.Term)
		if tokenLen >= f.minWordSize {
			newtokens := f.decompose(token)
			for _, newtoken := range newtokens {
				rv = append(rv, newtoken)
			}
		}
	}

	return rv
}

func (f *DictionaryCompoundFilter) decompose(token *analysis.Token) []*analysis.Token {
	runes := bytes.Runes(token.Term)
	rv := make([]*analysis.Token, 0)
	rlen := len(runes)
	for i := 0; i <= (rlen - f.minSubWordSize); i++ {
		var longestMatchToken *analysis.Token
		for j := f.minSubWordSize; j <= f.maxSubWordSize; j++ {
			if i+j > rlen {
				break
			}
			_, inDict := f.dict[string(runes[i:i+j])]
			if inDict {
				newtoken := analysis.Token{
					Term:         []byte(string(runes[i : i+j])),
					PositionIncr: 0,
					Start:        token.Start + i,
					End:          token.Start + i + j,
					Type:         token.Type,
					KeyWord:      token.KeyWord,
				}
				if f.onlyLongestMatch {
					if longestMatchToken == nil || utf8.RuneCount(longestMatchToken.Term) < j {
						longestMatchToken = &newtoken
					}
				} else {
					rv = append(rv, &newtoken)
				}
			}
		}
		if f.onlyLongestMatch && longestMatchToken != nil {
			rv = append(rv, longestMatchToken)
		}
	}
	return rv
}
