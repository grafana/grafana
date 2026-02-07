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

package numeric

import "fmt"

const ShiftStartInt64 byte = 0x20

// PrefixCoded is a byte array encoding of
// 64-bit numeric values shifted by 0-63 bits
type PrefixCoded []byte

func NewPrefixCodedInt64(in int64, shift uint) (PrefixCoded, error) {
	rv, _, err := NewPrefixCodedInt64Prealloc(in, shift, nil)
	return rv, err
}

func NewPrefixCodedInt64Prealloc(in int64, shift uint, prealloc []byte) (
	rv PrefixCoded, preallocRest []byte, err error) {
	if shift > 63 {
		return nil, prealloc, fmt.Errorf("cannot shift %d, must be between 0 and 63", shift)
	}

	nChars := ((63 - shift) / 7) + 1

	size := int(nChars + 1)
	if len(prealloc) >= size {
		rv = PrefixCoded(prealloc[0:size])
		preallocRest = prealloc[size:]
	} else {
		rv = make(PrefixCoded, size)
	}

	rv[0] = ShiftStartInt64 + byte(shift)

	sortableBits := int64(uint64(in) ^ 0x8000000000000000)
	sortableBits = int64(uint64(sortableBits) >> shift)
	for nChars > 0 {
		// Store 7 bits per byte for compatibility
		// with UTF-8 encoding of terms
		rv[nChars] = byte(sortableBits & 0x7f)
		nChars--
		sortableBits = int64(uint64(sortableBits) >> 7)
	}

	return rv, preallocRest, nil
}

func MustNewPrefixCodedInt64(in int64, shift uint) PrefixCoded {
	rv, err := NewPrefixCodedInt64(in, shift)
	if err != nil {
		panic(err)
	}
	return rv
}

// Shift returns the number of bits shifted
// returns 0 if in uninitialized state
func (p PrefixCoded) Shift() (uint, error) {
	if len(p) > 0 {
		shift := p[0] - ShiftStartInt64
		if shift < 0 || shift < 63 {
			return uint(shift), nil
		}
	}
	return 0, fmt.Errorf("invalid prefix coded value")
}

func (p PrefixCoded) Int64() (int64, error) {
	shift, err := p.Shift()
	if err != nil {
		return 0, err
	}
	var sortableBits int64
	for _, inbyte := range p[1:] {
		sortableBits <<= 7
		sortableBits |= int64(inbyte)
	}
	return int64(uint64((sortableBits << shift)) ^ 0x8000000000000000), nil
}

func ValidPrefixCodedTerm(p string) (bool, int) {
	return ValidPrefixCodedTermBytes([]byte(p))
}

func ValidPrefixCodedTermBytes(p []byte) (bool, int) {
	if len(p) > 0 {
		if p[0] < ShiftStartInt64 || p[0] > ShiftStartInt64+63 {
			return false, 0
		}
		shift := p[0] - ShiftStartInt64
		nChars := ((63 - int(shift)) / 7) + 1
		if len(p) != nChars+1 {
			return false, 0
		}
		return true, int(shift)
	}
	return false, 0
}
