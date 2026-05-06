// Copyright 2023 Dolthub, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package fulltext

import (
	"fmt"
	"strings"
	"unicode"

	"github.com/dolthub/go-mysql-server/sql"
)

// parserState represents the state of the parser as it iterates over runes.
type parserState byte

const (
	parserState_Whitespace parserState = iota
	parserState_Word
	parserState_Apostrophe
)

// DefaultParser is the default text parser that is used when parsing Full-Text documents. Its intention is the match the
// expected behavior of MySQL's default Full-Text parser. This provides normalization, as well as statistics regarding
// the input document, such as the occurrence of any given word. Such statistics may later be used when calculating the
// relevancy within a MatchAgainst expression.
type DefaultParser struct {
	uniqueMap map[uint64]uint32
	document  string
	words     []parserWord
	unique    []string
	wordsIdx  int
	uniqueIdx int
	collation sql.CollationID
}

// parserWord contains the word and its starting position.
type parserWord struct {
	Word     string
	Position uint64
}

// NewDefaultParser creates a new DefaultParser.
func NewDefaultParser(ctx *sql.Context, collation sql.CollationID, colVals ...interface{}) (parser DefaultParser, err error) {
	//TODO: implement exact matching using double quotes
	sb := strings.Builder{}
	for i, colVal := range colVals {
		colVal, err = sql.UnwrapAny(ctx, colVal)
		if err != nil {
			return DefaultParser{}, err
		}
		switch v := colVal.(type) {
		case string:
			if i > 0 {
				sb.WriteString(" ")
			}
			sb.WriteString(v)
		case []byte:
			if i > 0 {
				sb.WriteString(" ")
			}
			sb.Write(v)
		case nil:
			continue
		default:
			panic(fmt.Errorf("Full-Text parser has encountered an unexpected type: %T", colVal))
		}
	}
	document := sb.String()

	// We preprocess the document so that it's easier to calculate counts
	var words []parserWord
	var buildingWord []rune
	state := parserState_Whitespace
	position := uint64(0)
	for i, r := range document {
		isCharacter := ((unicode.IsLetter(r) || unicode.IsNumber(r) || unicode.IsDigit(r)) && !unicode.IsPunct(r)) || r == '_'
		isApostrophe := r == '\''

		switch state {
		case parserState_Whitespace:
			if isCharacter {
				buildingWord = append(buildingWord, r)
				state = parserState_Word
			} else {
				position++
			}
		case parserState_Word:
			if !isCharacter {
				if isApostrophe {
					buildingWord = append(buildingWord, r)
					state = parserState_Apostrophe
				} else {
					word := newParserWord(string(buildingWord), position)
					if len(word.Word) >= 3 {
						words = append(words, word)
					}
					buildingWord = buildingWord[:0]
					position = uint64(i)
					state = parserState_Whitespace
				}
			} else {
				buildingWord = append(buildingWord, r)
			}
		case parserState_Apostrophe:
			if !isCharacter {
				word := newParserWord(string(buildingWord), position)
				if len(word.Word) >= 3 {
					words = append(words, word)
				}
				buildingWord = buildingWord[:0]
				position = uint64(i)
				state = parserState_Whitespace
			} else {
				buildingWord = append(buildingWord, r)
				state = parserState_Word
			}
		}
	}
	{ // Grab the last word if there is one
		word := newParserWord(string(buildingWord), position)
		if len(word.Word) >= 3 {
			words = append(words, word)
		}
	}

	var unique []string
	uniqueMap := make(map[uint64]uint32)
	for _, word := range words {
		hash, err := collation.HashToUint(word.Word)
		if err != nil {
			return DefaultParser{}, err
		}
		if count, ok := uniqueMap[hash]; ok {
			uniqueMap[hash] = count + 1
		} else {
			unique = append(unique, word.Word)
			uniqueMap[hash] = 1
		}
	}
	return DefaultParser{
		document:  document,
		words:     words,
		wordsIdx:  0,
		unique:    unique,
		uniqueIdx: 0,
		uniqueMap: uniqueMap,
		collation: collation,
	}, nil
}

// Next returns the next word and its position. Once no more words can be returned, then we've reached the end.
// This iterates through its list separately from NextUnique.
func (dp *DefaultParser) Next(ctx *sql.Context) (word string, wordPosition uint64, reachedTheEnd bool, err error) {
	if dp.wordsIdx >= len(dp.words) {
		return "", 0, true, nil
	}
	pWord := dp.words[dp.wordsIdx]
	dp.wordsIdx++
	return pWord.Word, pWord.Position, false, nil
}

// NextUnique returns the next unique word. Once no more words can be returned, then we've reached the end. This
// iterates through its list separately from Next.
func (dp *DefaultParser) NextUnique(ctx *sql.Context) (uniqueWord string, reachedTheEnd bool, err error) {
	if dp.uniqueIdx >= len(dp.unique) {
		return "", true, nil
	}
	uniqueWord = dp.unique[dp.uniqueIdx]
	dp.uniqueIdx++
	return uniqueWord, false, nil
}

// DocumentCount returns the count of the given word within the document.
func (dp *DefaultParser) DocumentCount(ctx *sql.Context, word string) (count uint64, err error) {
	hash, err := dp.collation.HashToUint(word)
	if err != nil {
		return 0, err
	}
	if count, ok := dp.uniqueMap[hash]; ok {
		return uint64(count), nil
	}
	return 0, nil
}

// UniqueWordCount returns the number of unique words within the document.
func (dp *DefaultParser) UniqueWordCount(ctx *sql.Context) (count uint64) {
	return uint64(len(dp.unique))
}

// Reset will set the progress on both Next and NextUnique to the beginning, allowing the parser to be reused.
func (dp *DefaultParser) Reset() {
	dp.wordsIdx = 0
	dp.uniqueIdx = 0
}

// newParserWord creates a new parserWord from the given string. This also takes care of trimming.
func newParserWord(word string, position uint64) parserWord {
	originalWord := word
	word = strings.TrimLeft(word, "'")
	position += uint64(len(originalWord) - len(word))
	return parserWord{
		Word:     strings.TrimRight(word, "'"),
		Position: position,
	}
}
