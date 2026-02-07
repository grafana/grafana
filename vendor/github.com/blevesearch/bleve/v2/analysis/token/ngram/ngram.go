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

package ngram

import (
	"bytes"
	"fmt"
	"unicode/utf8"

	"github.com/blevesearch/bleve/v2/analysis"
	"github.com/blevesearch/bleve/v2/registry"
)

const Name = "ngram"

type NgramFilter struct {
	minLength int
	maxLength int
}

func NewNgramFilter(minLength, maxLength int) *NgramFilter {
	return &NgramFilter{
		minLength: minLength,
		maxLength: maxLength,
	}
}

func (s *NgramFilter) Filter(input analysis.TokenStream) analysis.TokenStream {
	rv := make(analysis.TokenStream, 0, len(input))

	for _, token := range input {
		runeCount := utf8.RuneCount(token.Term)
		runes := bytes.Runes(token.Term)
		for i := 0; i < runeCount; i++ {
			// index of the starting rune for this token
			for ngramSize := s.minLength; ngramSize <= s.maxLength; ngramSize++ {
				// build an ngram of this size starting at i
				if i+ngramSize <= runeCount {
					ngramTerm := analysis.BuildTermFromRunes(runes[i : i+ngramSize])
					token := analysis.Token{
						Position: token.Position,
						Start:    token.Start,
						End:      token.End,
						Type:     token.Type,
						Term:     ngramTerm,
					}
					rv = append(rv, &token)
				}
			}
		}
	}

	return rv
}

func NgramFilterConstructor(config map[string]interface{}, cache *registry.Cache) (analysis.TokenFilter, error) {
	minVal, ok := config["min"]
	if !ok {
		return nil, fmt.Errorf("must specify min")
	}

	min, err := convertToInt(minVal)
	if err != nil {
		return nil, err
	}

	maxVal, ok := config["max"]
	if !ok {
		return nil, fmt.Errorf("must specify max")
	}

	max, err := convertToInt(maxVal)
	if err != nil {
		return nil, err
	}

	return NewNgramFilter(min, max), nil
}

func init() {
	err := registry.RegisterTokenFilter(Name, NgramFilterConstructor)
	if err != nil {
		panic(err)
	}
}

// Expects either an int or a flaot64 value
func convertToInt(val interface{}) (int, error) {
	var intVal int
	var floatVal float64
	var ok bool

	intVal, ok = val.(int)
	if ok {
		return intVal, nil
	}

	floatVal, ok = val.(float64)
	if ok {
		return int(floatVal), nil
	}

	return 0, fmt.Errorf("failed to convert to int value")
}
