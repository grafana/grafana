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

// Package lowercase implements a TokenFilter which converts
// tokens to lower case according to unicode rules.
package lowercase

import (
	"bytes"
	"unicode"
	"unicode/utf8"

	"github.com/blevesearch/bleve/v2/analysis"
	"github.com/blevesearch/bleve/v2/registry"
)

// Name is the name used to register LowerCaseFilter in the bleve registry
const Name = "to_lower"

type LowerCaseFilter struct {
}

func NewLowerCaseFilter() *LowerCaseFilter {
	return &LowerCaseFilter{}
}

func (f *LowerCaseFilter) Filter(input analysis.TokenStream) analysis.TokenStream {
	for _, token := range input {
		token.Term = toLowerDeferredCopy(token.Term)
	}
	return input
}

func LowerCaseFilterConstructor(config map[string]interface{}, cache *registry.Cache) (analysis.TokenFilter, error) {
	return NewLowerCaseFilter(), nil
}

func init() {
	err := registry.RegisterTokenFilter(Name, LowerCaseFilterConstructor)
	if err != nil {
		panic(err)
	}
}

// toLowerDeferredCopy will function exactly like
// bytes.ToLower() only it will reuse (overwrite)
// the original byte array when possible
// NOTE: because its possible that the lower-case
// form of a rune has a different utf-8 encoded
// length, in these cases a new byte array is allocated
func toLowerDeferredCopy(s []byte) []byte {
	j := 0
	for i := 0; i < len(s); {
		wid := 1
		r := rune(s[i])
		if r >= utf8.RuneSelf {
			r, wid = utf8.DecodeRune(s[i:])
		}

		l := unicode.ToLower(r)

		// If the rune is already lowercased, just move to the
		// next rune.
		if l == r {
			i += wid
			j += wid
			continue
		}

		// Handles the Unicode edge-case where the last
		// rune in a word on the greek Σ needs to be converted
		// differently.
		if l == 'σ' && i+2 == len(s) {
			l = 'ς'
		}

		lwid := utf8.RuneLen(l)
		if lwid > wid {
			// utf-8 encoded replacement is wider
			// for now, punt and defer
			// to bytes.ToLower() for the remainder
			// only known to happen with chars
			//   Rune Ⱥ(570) width 2 - Lower ⱥ(11365) width 3
			//   Rune Ⱦ(574) width 2 - Lower ⱦ(11366) width 3
			rest := bytes.ToLower(s[i:])
			rv := make([]byte, j+len(rest))
			copy(rv[:j], s[:j])
			copy(rv[j:], rest)
			return rv
		} else {
			utf8.EncodeRune(s[j:], l)
		}
		i += wid
		j += lwid
	}
	return s[:j]
}
