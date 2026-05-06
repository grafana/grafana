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
	"github.com/blugelabs/bluge/analysis"
)

type SingleTokenTokenizer struct{}

func NewSingleTokenTokenizer() *SingleTokenTokenizer {
	return &SingleTokenTokenizer{}
}

func (t *SingleTokenTokenizer) Tokenize(input []byte) analysis.TokenStream {
	return MakeTokenStream(input)
}

func MakeToken(input []byte) *analysis.Token {
	return &analysis.Token{
		Term:         input,
		PositionIncr: 1,
		Start:        0,
		End:          len(input),
		Type:         analysis.AlphaNumeric,
	}
}

func MakeTokenStream(input []byte) analysis.TokenStream {
	return analysis.TokenStream{
		MakeToken(input),
	}
}
