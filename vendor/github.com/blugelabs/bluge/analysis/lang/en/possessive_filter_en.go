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

package en

import (
	"unicode/utf8"

	"github.com/blugelabs/bluge/analysis"
)

const rightSingleQuotationMark = '’'
const apostrophe = '\''
const fullWidthApostrophe = '＇'

// PossessiveFilter implements a TokenFilter which
// strips the English possessive suffix ('s) from tokens.
// It handle a variety of apostrophe types, is case-insensitive
// and doesn't distinguish between possessive and contraction.
// (ie "She's So Rad" becomes "She So Rad")
type PossessiveFilter struct {
}

func NewPossessiveFilter() *PossessiveFilter {
	return &PossessiveFilter{}
}

func (s *PossessiveFilter) Filter(input analysis.TokenStream) analysis.TokenStream {
	for _, token := range input {
		lastRune, lastRuneSize := utf8.DecodeLastRune(token.Term)
		if lastRune == 's' || lastRune == 'S' {
			nextLastRune, nextLastRuneSize := utf8.DecodeLastRune(token.Term[:len(token.Term)-lastRuneSize])
			if nextLastRune == rightSingleQuotationMark ||
				nextLastRune == apostrophe ||
				nextLastRune == fullWidthApostrophe {
				token.Term = token.Term[:len(token.Term)-lastRuneSize-nextLastRuneSize]
			}
		}
	}
	return input
}
