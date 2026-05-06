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

// CamelCaseFilter splits a given token into a set of tokens where each resulting token
// falls into one the following classes:
// 1) Upper case followed by lower case letters.
//		Terminated by a number, an upper case letter, and a non alpha-numeric symbol.
// 2) Upper case followed by upper case letters.
//		Terminated by a number, an upper case followed by a lower case letter, and a non alpha-numeric symbol.
// 3) Lower case followed by lower case letters.
//		Terminated by a number, an upper case letter, and a non alpha-numeric symbol.
// 4) Number followed by numbers.
//		Terminated by a letter, and a non alpha-numeric symbol.
// 5) Non alpha-numeric symbol followed by non alpha-numeric symbols.
//		Terminated by a number, and a letter.
//
// It does a one-time sequential pass over an input token, from left to right.
// The scan is greedy and generates the longest substring that fits into one of the classes.
//
// See the test file for examples of classes and their parsings.
type CamelCaseFilter struct{}

func NewCamelCaseFilter() *CamelCaseFilter {
	return &CamelCaseFilter{}
}

func (f *CamelCaseFilter) Filter(input analysis.TokenStream) analysis.TokenStream {
	rv := make(analysis.TokenStream, 0, len(input))

	for _, token := range input {
		runeCount := utf8.RuneCount(token.Term)
		runes := bytes.Runes(token.Term)

		p := NewParser(runeCount, token.Start)
		for i := 0; i < runeCount; i++ {
			if i+1 >= runeCount {
				p.Push(runes[i], nil)
			} else {
				p.Push(runes[i], &runes[i+1])
			}
		}
		rv = append(rv, p.FlushTokens()...)
	}
	return rv
}
