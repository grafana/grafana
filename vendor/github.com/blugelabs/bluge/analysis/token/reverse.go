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
	"unicode"
	"unicode/utf8"

	"github.com/blugelabs/bluge/analysis"
)

type ReverseFilter struct{}

func NewReverseFilter() *ReverseFilter {
	return &ReverseFilter{}
}

func (f *ReverseFilter) Filter(input analysis.TokenStream) analysis.TokenStream {
	for _, token := range input {
		token.Term = reverse(token.Term)
	}
	return input
}

// reverse(..) will generate a reversed version of the provided
// unicode array and return it back to its caller.
func reverse(s []byte) []byte {
	cursorIn := 0
	inputRunes := []rune(string(s))
	cursorOut := len(s)
	output := make([]byte, len(s))
	for i := 0; i < len(inputRunes); {
		wid := utf8.RuneLen(inputRunes[i])
		i++
		for i < len(inputRunes) {
			r := inputRunes[i]
			if unicode.Is(unicode.Mn, r) || unicode.Is(unicode.Me, r) || unicode.Is(unicode.Mc, r) {
				wid += utf8.RuneLen(r)
				i++
			} else {
				break
			}
		}
		copy(output[cursorOut-wid:cursorOut], s[cursorIn:cursorIn+wid])
		cursorIn += wid
		cursorOut -= wid
	}

	return output
}
