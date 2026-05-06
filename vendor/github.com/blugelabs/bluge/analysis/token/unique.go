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
	"github.com/blugelabs/bluge/analysis"
)

const initialMapFactor = 4

// UniqueTermFilter retains only the tokens which mark the first occurrence of
// a term. Tokens whose term appears in a preceding token are dropped.
type UniqueTermFilter struct{}

func NewUniqueTermFilter() *UniqueTermFilter {
	return &UniqueTermFilter{}
}

func (f *UniqueTermFilter) Filter(input analysis.TokenStream) analysis.TokenStream {
	encounteredTerms := make(map[string]struct{}, len(input)/initialMapFactor)
	var j, skipped int
	for _, token := range input {
		term := string(token.Term)
		if _, ok := encounteredTerms[term]; ok {
			skipped += token.PositionIncr
			continue
		}
		token.PositionIncr += skipped
		skipped = 0
		encounteredTerms[term] = struct{}{}
		input[j] = token
		j++
	}
	return input[:j]
}
