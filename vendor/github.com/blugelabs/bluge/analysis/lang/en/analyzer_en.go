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

// Package en implements an analyzer with reasonable defaults for processing
// English text.
//
// It strips possessive suffixes ('s), transforms tokens to lower case,
// removes stopwords from a built-in list, and applies porter stemming.
//
// The built-in stopwords list is defined in EnglishStopWords.
package en

import (
	"github.com/blugelabs/bluge/analysis"
	"github.com/blugelabs/bluge/analysis/token"
	"github.com/blugelabs/bluge/analysis/tokenizer"
)

const AnalyzerName = "en"

func NewAnalyzer() *analysis.Analyzer {
	return &analysis.Analyzer{
		Tokenizer: tokenizer.NewUnicodeTokenizer(),
		TokenFilters: []analysis.TokenFilter{
			NewPossessiveFilter(),
			token.NewLowerCaseFilter(),
			StopWordsFilter(),
			StemmerFilter(),
		},
	}
}
