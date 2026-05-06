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
	"unicode"
)

// States codify the classes that the parser recognizes.
type State interface {
	// is _sym_ the start character
	StartSym(sym rune) bool

	// is _sym_ a member of a class.
	// peek, the next sym on the tape, can also be used to determine a class.
	Member(sym rune, peek *rune) bool
}

type LowerCaseState struct{}

func (s *LowerCaseState) Member(sym rune, peek *rune) bool {
	return unicode.IsLower(sym)
}

func (s *LowerCaseState) StartSym(sym rune) bool {
	return s.Member(sym, nil)
}

type UpperCaseState struct {
	startedCollecting bool // denotes that the start character has been read
	collectingUpper   bool // denotes if this is a class of all upper case letters
}

func (s *UpperCaseState) Member(sym rune, peek *rune) bool {
	if !(unicode.IsLower(sym) || unicode.IsUpper(sym)) {
		return false
	}

	if peek != nil && unicode.IsUpper(sym) && unicode.IsLower(*peek) {
		return false
	}

	if !s.startedCollecting {
		// now we have to determine if upper-case letters are collected.
		s.startedCollecting = true
		s.collectingUpper = unicode.IsUpper(sym)
		return true
	}

	return s.collectingUpper == unicode.IsUpper(sym)
}

func (s *UpperCaseState) StartSym(sym rune) bool {
	return unicode.IsUpper(sym)
}

type NumberCaseState struct{}

func (s *NumberCaseState) Member(sym rune, peek *rune) bool {
	return unicode.IsNumber(sym)
}

func (s *NumberCaseState) StartSym(sym rune) bool {
	return s.Member(sym, nil)
}

type NonAlphaNumericCaseState struct{}

func (s *NonAlphaNumericCaseState) Member(sym rune, peek *rune) bool {
	return !unicode.IsLower(sym) && !unicode.IsUpper(sym) && !unicode.IsNumber(sym)
}

func (s *NonAlphaNumericCaseState) StartSym(sym rune) bool {
	return s.Member(sym, nil)
}
