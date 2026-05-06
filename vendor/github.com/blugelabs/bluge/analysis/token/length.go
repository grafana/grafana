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

type LengthFilter struct {
	min int
	max int
}

func NewLengthFilter(min, max int) *LengthFilter {
	return &LengthFilter{
		min: min,
		max: max,
	}
}

func (f *LengthFilter) Filter(input analysis.TokenStream) analysis.TokenStream {
	rv := make(analysis.TokenStream, 0, len(input))

	var skipped int
	for _, token := range input {
		wordLen := utf8.RuneCount(token.Term)
		if f.min > 0 && f.min > wordLen {
			skipped += token.PositionIncr
			continue
		}
		if f.max > 0 && f.max < wordLen {
			skipped += token.PositionIncr
			continue
		}
		if skipped > 0 {
			token.PositionIncr += skipped
			skipped = 0
		}
		rv = append(rv, token)
	}

	return rv
}
