//  Copyright (c) 2017 Couchbase, Inc.
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

package utf8

import (
	"fmt"
	"unicode/utf8"
)

// Sequences is a collection of Sequence
type Sequences []Sequence

// NewSequences constructs a collection of Sequence which describe the
// byte ranges covered between the start and end runes.
func NewSequences(start, end rune) (Sequences, error) {
	rv, _, err := NewSequencesPrealloc(start, end, nil, nil, nil, nil)
	return rv, err
}

func NewSequencesPrealloc(start, end rune,
	preallocSequences Sequences,
	preallocRangeStack RangeStack,
	preallocStartBytes, preallocEndBytes []byte) (Sequences, RangeStack, error) {
	rv := preallocSequences[:0]

	startBytes := preallocStartBytes
	if cap(startBytes) < utf8.UTFMax {
		startBytes = make([]byte, utf8.UTFMax)
	}
	startBytes = startBytes[:utf8.UTFMax]

	endBytes := preallocEndBytes
	if cap(endBytes) < utf8.UTFMax {
		endBytes = make([]byte, utf8.UTFMax)
	}
	endBytes = endBytes[:utf8.UTFMax]

	rangeStack := preallocRangeStack[:0]
	rangeStack = rangeStack.Push(scalarRange{start, end})

	rangeStack, r := rangeStack.Pop()
TOP:
	for r != nilScalarRange {
	INNER:
		for {
			r1, r2 := r.split()
			if r1 != nilScalarRange {
				rangeStack = rangeStack.Push(scalarRange{r2.start, r2.end})
				r.start = r1.start
				r.end = r1.end
				continue INNER
			}
			if !r.valid() {
				rangeStack, r = rangeStack.Pop()
				continue TOP
			}
			for i := 1; i < utf8.UTFMax; i++ {
				max := maxScalarValue(i)
				if r.start <= max && max < r.end {
					rangeStack = rangeStack.Push(scalarRange{max + 1, r.end})
					r.end = max
					continue INNER
				}
			}
			asciiRange := r.ascii()
			if asciiRange != nilRange {
				rv = append(rv, Sequence{
					asciiRange,
				})
				rangeStack, r = rangeStack.Pop()
				continue TOP
			}
			for i := uint(1); i < utf8.UTFMax; i++ {
				m := rune((1 << (6 * i)) - 1)
				if (r.start & ^m) != (r.end & ^m) {
					if (r.start & m) != 0 {
						rangeStack = rangeStack.Push(scalarRange{(r.start | m) + 1, r.end})
						r.end = r.start | m
						continue INNER
					}
					if (r.end & m) != m {
						rangeStack = rangeStack.Push(scalarRange{r.end & ^m, r.end})
						r.end = (r.end & ^m) - 1
						continue INNER
					}
				}
			}
			n, m := r.encode(startBytes, endBytes)
			seq, err := SequenceFromEncodedRange(startBytes[0:n], endBytes[0:m])
			if err != nil {
				return nil, nil, err
			}
			rv = append(rv, seq)
			rangeStack, r = rangeStack.Pop()
			continue TOP
		}
	}

	return rv, rangeStack, nil
}

// Sequence is a collection of Range
type Sequence []Range

// SequenceFromEncodedRange creates sequence from the encoded bytes
func SequenceFromEncodedRange(start, end []byte) (Sequence, error) {
	if len(start) != len(end) {
		return nil, fmt.Errorf("byte slices must be the same length")
	}
	switch len(start) {
	case 2:
		return Sequence{
			Range{start[0], end[0]},
			Range{start[1], end[1]},
		}, nil
	case 3:
		return Sequence{
			Range{start[0], end[0]},
			Range{start[1], end[1]},
			Range{start[2], end[2]},
		}, nil
	case 4:
		return Sequence{
			Range{start[0], end[0]},
			Range{start[1], end[1]},
			Range{start[2], end[2]},
			Range{start[3], end[3]},
		}, nil
	}

	return nil, fmt.Errorf("invalid encoded byte length")
}

// Matches checks to see if the provided byte slice matches the Sequence
func (u Sequence) Matches(bytes []byte) bool {
	if len(bytes) < len(u) {
		return false
	}
	for i := 0; i < len(u); i++ {
		if !u[i].matches(bytes[i]) {
			return false
		}
	}
	return true
}

func (u Sequence) String() string {
	switch len(u) {
	case 1:
		return fmt.Sprintf("%v", u[0])
	case 2:
		return fmt.Sprintf("%v%v", u[0], u[1])
	case 3:
		return fmt.Sprintf("%v%v%v", u[0], u[1], u[2])
	case 4:
		return fmt.Sprintf("%v%v%v%v", u[0], u[1], u[2], u[3])
	default:
		return fmt.Sprintf("invalid utf8 sequence")
	}
}

// Range describes a single range of byte values
type Range struct {
	Start byte
	End   byte
}

var nilRange = Range{0xff, 0}

func (u Range) matches(b byte) bool {
	if u.Start <= b && b <= u.End {
		return true
	}
	return false
}

func (u Range) String() string {
	if u.Start == u.End {
		return fmt.Sprintf("[%X]", u.Start)
	}
	return fmt.Sprintf("[%X-%X]", u.Start, u.End)
}

type scalarRange struct {
	start rune
	end   rune
}

var nilScalarRange = scalarRange{0xffff, 0}

func (s *scalarRange) String() string {
	return fmt.Sprintf("ScalarRange(%d,%d)", s.start, s.end)
}

// split this scalar range if it overlaps with a surrogate codepoint
func (s *scalarRange) split() (scalarRange, scalarRange) {
	if s.start < 0xe000 && s.end > 0xd7ff {
		return scalarRange{
				start: s.start,
				end:   0xd7ff,
			},
			scalarRange{
				start: 0xe000,
				end:   s.end,
			}
	}
	return nilScalarRange, nilScalarRange
}

func (s *scalarRange) valid() bool {
	return s.start <= s.end
}

func (s *scalarRange) ascii() Range {
	if s.valid() && s.end <= 0x7f {
		return Range{
			Start: byte(s.start),
			End:   byte(s.end),
		}
	}
	return nilRange
}

// start and end MUST have capacity for utf8.UTFMax bytes
func (s *scalarRange) encode(start, end []byte) (int, int) {
	n := utf8.EncodeRune(start, s.start)
	m := utf8.EncodeRune(end, s.end)
	return n, m
}

type RangeStack []scalarRange

func (s RangeStack) Push(v scalarRange) RangeStack {
	return append(s, v)
}

func (s RangeStack) Pop() (RangeStack, scalarRange) {
	l := len(s)
	if l < 1 {
		return s, nilScalarRange
	}
	return s[:l-1], s[l-1]
}

func maxScalarValue(nbytes int) rune {
	switch nbytes {
	case 1:
		return 0x007f
	case 2:
		return 0x07FF
	case 3:
		return 0xFFFF
	default:
		return 0x10FFFF
	}
}
