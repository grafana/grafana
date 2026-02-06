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

package analysis

import (
	"bytes"
	"unicode/utf8"
)

func DeleteRune(in []rune, pos int) []rune {
	if pos >= len(in) {
		return in
	}
	copy(in[pos:], in[pos+1:])
	return in[:len(in)-1]
}

func InsertRune(in []rune, pos int, r rune) []rune {
	// create a new slice 1 rune larger
	rv := make([]rune, len(in)+1)
	// copy the characters before the insert pos
	copy(rv[0:pos], in[0:pos])
	// set the inserted rune
	rv[pos] = r
	// copy the characters after the insert pos
	copy(rv[pos+1:], in[pos:])
	return rv
}

// BuildTermFromRunesOptimistic will build a term from the provided runes
// AND optimistically attempt to encode into the provided buffer
// if at any point it appears the buffer is too small, a new buffer is
// allocated and that is used instead
// this should be used in cases where frequently the new term is the same
// length or shorter than the original term (in number of bytes)
func BuildTermFromRunesOptimistic(buf []byte, runes []rune) []byte {
	rv := buf
	used := 0
	for _, r := range runes {
		nextLen := utf8.RuneLen(r)
		if used+nextLen > len(rv) {
			// alloc new buf
			buf = make([]byte, len(runes)*utf8.UTFMax)
			// copy work we've already done
			copy(buf, rv[:used])
			rv = buf
		}
		written := utf8.EncodeRune(rv[used:], r)
		used += written
	}
	return rv[:used]
}

func BuildTermFromRunes(runes []rune) []byte {
	return BuildTermFromRunesOptimistic(make([]byte, len(runes)*utf8.UTFMax), runes)
}

func TruncateRunes(input []byte, num int) []byte {
	runes := bytes.Runes(input)
	runes = runes[:len(runes)-num]
	out := BuildTermFromRunes(runes)
	return out
}

func RunesEndsWith(input []rune, suffix string) bool {
	inputLen := len(input)
	suffixRunes := []rune(suffix)
	suffixLen := len(suffixRunes)
	if suffixLen > inputLen {
		return false
	}

	for i := suffixLen - 1; i >= 0; i-- {
		if input[inputLen-(suffixLen-i)] != suffixRunes[i] {
			return false
		}
	}

	return true
}
