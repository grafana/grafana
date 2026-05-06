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
	"container/ring"

	"github.com/blugelabs/bluge/analysis"
)

type ShingleFilter struct {
	min            int
	max            int
	outputOriginal bool
	tokenSeparator string
	fill           string
}

func NewShingleFilter(min, max int, outputOriginal bool, sep, fill string) *ShingleFilter {
	return &ShingleFilter{
		min:            min,
		max:            max,
		outputOriginal: outputOriginal,
		tokenSeparator: sep,
		fill:           fill,
	}
}

func (s *ShingleFilter) Filter(input analysis.TokenStream) analysis.TokenStream {
	rv := make(analysis.TokenStream, 0, len(input))

	aRing := ring.New(s.max)
	itemsInRing := 0
	for _, token := range input {
		if s.outputOriginal {
			rv = append(rv, token)
		}

		// if there are gaps, insert filler tokens
		offset := token.PositionIncr - 1
		for offset > 0 {
			fillerToken := analysis.Token{
				PositionIncr: 1,
				Start:        -1,
				End:          -1,
				Type:         analysis.AlphaNumeric,
				Term:         []byte(s.fill),
			}
			aRing.Value = &fillerToken
			if itemsInRing < s.max {
				itemsInRing++
			}
			rv = append(rv, s.shingleCurrentRingState(aRing, itemsInRing)...)
			aRing = aRing.Next()
			offset--
		}

		aRing.Value = token
		if itemsInRing < s.max {
			itemsInRing++
		}
		rv = append(rv, s.shingleCurrentRingState(aRing, itemsInRing)...)
		aRing = aRing.Next()
	}

	return rv
}

func (s *ShingleFilter) shingleCurrentRingState(aRing *ring.Ring, itemsInRing int) analysis.TokenStream {
	rv := make(analysis.TokenStream, 0)
	for shingleN := s.min; shingleN <= s.max; shingleN++ {
		if itemsInRing < shingleN {
			continue
		}
		// if there are enough items in the ring
		// to produce a shingle of this size
		thisShingleRing := aRing.Move(-(shingleN - 1))
		shingledBytes := make([]byte, 0)
		start := -1
		end := 0
		for i := 0; i < shingleN; i++ {
			if i != 0 {
				shingledBytes = append(shingledBytes, []byte(s.tokenSeparator)...)
			}
			curr := thisShingleRing.Value.(*analysis.Token)
			if start == -1 && curr.Start != -1 {
				start = curr.Start
			}
			if curr.End != -1 {
				end = curr.End
			}
			shingledBytes = append(shingledBytes, curr.Term...)
			thisShingleRing = thisShingleRing.Next()
		}
		token := analysis.Token{
			Type:         analysis.Shingle,
			Term:         shingledBytes,
			PositionIncr: 1,
		}
		if start != -1 {
			token.Start = start
		}
		if end != -1 {
			token.End = end
		}
		if len(rv) > 0 || s.outputOriginal {
			token.PositionIncr = 0
		}
		rv = append(rv, &token)
	}
	return rv
}
