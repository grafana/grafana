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

package analysis

import (
	"fmt"
)

type CharFilter interface {
	Filter([]byte) []byte
}

type TokenType int

const (
	AlphaNumeric TokenType = iota
	Ideographic
	Numeric
	DateTime
	Shingle
	Single
	Double
	Boolean
)

// Token represents one occurrence of a term at a particular location in a
// field.
type Token struct {
	// Start specifies the byte offset of the beginning of the term in the
	// field.
	Start int

	// End specifies the byte offset of the end of the term in the field.
	End  int
	Term []byte

	// PositionIncr specifies the position of this token relative to the previous.
	PositionIncr int
	Type         TokenType
	KeyWord      bool
}

func (t *Token) String() string {
	return fmt.Sprintf("Start: %d  End: %d  PositionIncr: %d  Token: %s  Type: %d", t.Start, t.End, t.PositionIncr, string(t.Term), t.Type)
}

type TokenStream []*Token

// A Tokenizer splits an input string into tokens, the usual behavior being to
// map words to tokens.
type Tokenizer interface {
	Tokenize([]byte) TokenStream
}

// A TokenFilter adds, transforms or removes tokens from a token stream.
type TokenFilter interface {
	Filter(TokenStream) TokenStream
}

type Analyzer struct {
	CharFilters  []CharFilter
	Tokenizer    Tokenizer
	TokenFilters []TokenFilter
}

func (a *Analyzer) Analyze(input []byte) TokenStream {
	if a.CharFilters != nil {
		for _, cf := range a.CharFilters {
			input = cf.Filter(input)
		}
	}
	tokens := a.Tokenizer.Tokenize(input)
	if a.TokenFilters != nil {
		for _, tf := range a.TokenFilters {
			tokens = tf.Filter(tokens)
		}
	}
	return tokens
}
