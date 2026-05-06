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
	"unicode/utf8"

	"github.com/blugelabs/bluge/analysis"
)

const RightSingleQuotationMark = '’'
const Apostrophe = '\''

type ElisionFilter struct {
	articles analysis.TokenMap
}

func NewElisionFilter(articles analysis.TokenMap) *ElisionFilter {
	return &ElisionFilter{
		articles: articles,
	}
}

func (s *ElisionFilter) Filter(input analysis.TokenStream) analysis.TokenStream {
	for _, token := range input {
		term := token.Term
		for i := 0; i < len(term); {
			r, size := utf8.DecodeRune(term[i:])
			if r == Apostrophe || r == RightSingleQuotationMark {
				// see if the prefix matches one of the articles
				prefix := term[0:i]
				_, articleMatch := s.articles[string(prefix)]
				if articleMatch {
					token.Term = term[i+size:]
					break
				}
			}
			i += size
		}
	}
	return input
}
