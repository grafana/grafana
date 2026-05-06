//  Copyright (c) 2018 Couchbase, Inc.
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

package levenshtein

import (
	"fmt"
	"sort"
	"unicode/utf8"
)

type FullCharacteristicVector []uint32

func (fcv FullCharacteristicVector) shiftAndMask(offset, mask uint32) uint32 {
	bucketID := offset / 32
	align := offset - bucketID*32
	if align == 0 {
		return fcv[bucketID] & mask
	}
	left := fcv[bucketID] >> align
	right := fcv[bucketID+1] << (32 - align)
	return (left | right) & mask
}

type tuple struct {
	char rune
	fcv  FullCharacteristicVector
}

type sortRunes []rune

func (s sortRunes) Less(i, j int) bool {
	return s[i] < s[j]
}

func (s sortRunes) Swap(i, j int) {
	s[i], s[j] = s[j], s[i]
}

func (s sortRunes) Len() int {
	return len(s)
}

func sortRune(r []rune) []rune {
	sort.Sort(sortRunes(r))
	return r
}

type Alphabet struct {
	charset []tuple
	index   uint32
}

func (a *Alphabet) resetNext() {
	a.index = 0
}

func (a *Alphabet) next() (rune, FullCharacteristicVector, error) {
	if int(a.index) >= len(a.charset) {
		return 0, nil, fmt.Errorf("eof")
	}

	rv := a.charset[a.index]
	a.index++
	return rv.char, rv.fcv, nil
}

func dedupe(in string) string {
	lookUp := make(map[rune]struct{}, len(in))
	var rv string
	for len(in) > 0 {
		r, size := utf8.DecodeRuneInString(in)
		in = in[size:]
		if _, ok := lookUp[r]; !ok {
			rv += string(r)
			lookUp[r] = struct{}{}
		}
	}
	return rv
}

func queryChars(qChars string) Alphabet {
	chars := dedupe(qChars)
	inChars := sortRune([]rune(chars))
	charsets := make([]tuple, 0, len(inChars))

	for _, c := range inChars {
		tempChars := qChars
		var bits []uint32
		for len(tempChars) > 0 {
			var chunk string
			if len(tempChars) > 32 {
				chunk = tempChars[0:32]
				tempChars = tempChars[32:]
			} else {
				chunk = tempChars
				tempChars = tempChars[:0]
			}

			chunkBits := uint32(0)
			bit := uint32(1)
			for _, chr := range chunk {
				if chr == c {
					chunkBits |= bit
				}
				bit <<= 1
			}
			bits = append(bits, chunkBits)
		}
		bits = append(bits, 0)
		charsets = append(charsets, tuple{char: c, fcv: FullCharacteristicVector(bits)})
	}
	return Alphabet{charset: charsets}
}
