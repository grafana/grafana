//  Copyright (c) 2014 Couchbase, Inc.
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

package porter

import (
	"bytes"

	"github.com/blevesearch/bleve/v2/analysis"
	"github.com/blevesearch/bleve/v2/registry"

	"github.com/blevesearch/go-porterstemmer"
)

const Name = "stemmer_porter"

type PorterStemmer struct {
}

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

func PorterStemmerConstructor(config map[string]interface{}, cache *registry.Cache) (analysis.TokenFilter, error) {
	return NewPorterStemmer(), nil
}

func init() {
	err := registry.RegisterTokenFilter(Name, PorterStemmerConstructor)
	if err != nil {
		panic(err)
	}
}
