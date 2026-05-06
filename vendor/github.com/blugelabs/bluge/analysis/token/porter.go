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

	"github.com/blevesearch/go-porterstemmer"
	"github.com/blugelabs/bluge/analysis"
)

type PorterStemmer struct{}

func NewPorterStemmer() *PorterStemmer {
	return &PorterStemmer{}
}

func (s *PorterStemmer) Filter(input analysis.TokenStream) analysis.TokenStream {
	for _, token := range input {
		// if it is not a protected keyword, stem it
		if !token.KeyWord {
			termRunes := bytes.Runes(token.Term)
			stemmedRunes := porterstemmer.StemWithoutLowerCasing(termRunes)
			token.Term = analysis.BuildTermFromRunes(stemmedRunes)
		}
	}
	return input
}
