/*
	This code was ported from the Open Search Project
	https://github.com/opensearch-project/OpenSearch/blob/main/modules/analysis-common/src/main/java/org/opensearch/analysis/common/EnglishPluralStemFilter.java
	The algorithm itself was created by Mark Harwood
	https://github.com/markharwood
*/

/*
 * SPDX-License-Identifier: Apache-2.0
 *
 * The OpenSearch Contributors require contributions made to
 * this file be licensed under the Apache-2.0 license or a
 * compatible open source license.
 */

/*
 * Licensed to Elasticsearch under one or more contributor
 * license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

package en

import (
	"strings"

	"github.com/blevesearch/bleve/v2/analysis"
	"github.com/blevesearch/bleve/v2/registry"
)

const PluralStemmerName = "stemmer_en_plural"

type EnglishPluralStemmerFilter struct {
}

func NewEnglishPluralStemmerFilter() *EnglishPluralStemmerFilter {
	return &EnglishPluralStemmerFilter{}
}

func (s *EnglishPluralStemmerFilter) Filter(input analysis.TokenStream) analysis.TokenStream {
	for _, token := range input {
		token.Term = []byte(stem(string(token.Term)))
	}

	return input
}

func EnglishPluralStemmerFilterConstructor(config map[string]interface{}, cache *registry.Cache) (analysis.TokenFilter, error) {
	return NewEnglishPluralStemmerFilter(), nil
}

func init() {
	err := registry.RegisterTokenFilter(PluralStemmerName, EnglishPluralStemmerFilterConstructor)
	if err != nil {
		panic(err)
	}
}

// ----------------------------------------------------------------------------

// Words ending in oes that retain the e when stemmed
var oesExceptions = []string{"shoes", "canoes", "oboes"}

// Words ending in ches that retain the e when stemmed
var chesExceptions = []string{
	"cliches",
	"avalanches",
	"mustaches",
	"moustaches",
	"quiches",
	"headaches",
	"heartaches",
	"porsches",
	"tranches",
	"caches",
}

func stem(word string) string {
	runes := []rune(strings.ToLower(word))

	if len(runes) < 3 || runes[len(runes)-1] != 's' {
		return string(runes)
	}

	switch runes[len(runes)-2] {
	case 'u':
		fallthrough
	case 's':
		return string(runes)
	case 'e':
		// Modified ies->y logic from original s-stemmer - only work on strings > 4
		// so spies -> spy still but pies->pie.
		// The original code also special-cased aies and eies for no good reason as far as I can tell.
		// ( no words of consequence - eg http://www.thefreedictionary.com/words-that-end-in-aies )
		if len(runes) > 4 && runes[len(runes)-3] == 'i' {
			runes[len(runes)-3] = 'y'
			return string(runes[0 : len(runes)-2])
		}

		// Suffix rules to remove any dangling "e"
		if len(runes) > 3 {
			// xes (but >1 prefix so we can stem "boxes->box" but keep "axes->axe")
			if len(runes) > 4 && runes[len(runes)-3] == 'x' {
				return string(runes[0 : len(runes)-2])
			}

			// oes
			if len(runes) > 3 && runes[len(runes)-3] == 'o' {
				if isException(runes, oesExceptions) {
					// Only remove the S
					return string(runes[0 : len(runes)-1])
				}
				// Remove the es
				return string(runes[0 : len(runes)-2])
			}

			if len(runes) > 4 {
				// shes/sses
				if runes[len(runes)-4] == 's' && (runes[len(runes)-3] == 'h' || runes[len(runes)-3] == 's') {
					return string(runes[0 : len(runes)-2])
				}

				// ches
				if len(runes) > 4 {
					if runes[len(runes)-4] == 'c' && runes[len(runes)-3] == 'h' {
						if isException(runes, chesExceptions) {
							// Only remove the S
							return string(runes[0 : len(runes)-1])
						}
						// Remove the es
						return string(runes[0 : len(runes)-2])
					}
				}
			}
		}
		fallthrough
	default:
		return string(runes[0 : len(runes)-1])
	}
}

func isException(word []rune, exceptions []string) bool {
	for _, exception := range exceptions {

		exceptionRunes := []rune(exception)

		exceptionPos := len(exceptionRunes) - 1
		wordPos := len(word) - 1

		matched := true
		for exceptionPos >= 0 && wordPos >= 0 {
			if exceptionRunes[exceptionPos] != word[wordPos] {
				matched = false
				break
			}
			exceptionPos--
			wordPos--
		}
		if matched {
			return true
		}
	}
	return false
}
