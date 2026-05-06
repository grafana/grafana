//  Copyright (c) 2020 The Bluge Authors.
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

package ice

import "fmt"

// ------------------------------------------------------------

type memUvarintReader struct {
	C int // index of next byte to read from S
	S []byte
}

func newMemUvarintReader(s []byte) *memUvarintReader {
	return &memUvarintReader{S: s}
}

// Len returns the number of unread bytes.
func (r *memUvarintReader) Len() int {
	n := len(r.S) - r.C
	if n < 0 {
		return 0
	}
	return n
}

// why 63?  The original code had an 'i += 1' loop var and
// checked for i > 9 || i == 9 ...; but, we no longer
// check for the i var, but instead check here for s,
// which is incremented by 7.  So, 7*9 == 63.
const sevenTimesNine = 63

// lastByte has the most significant bit set
// indicating there are more bytes in the stream
// any value less than this is a terminal byte
const lastByte = 0x80

// significantBits masks the significant bits
// the highest order bit is used to indicate
// the presence of more data
const significantBits = 0x7f

// ReadUvarint reads an encoded uint64.  The original code this was
// based on is at encoding/binary/ReadUvarint().
func (r *memUvarintReader) ReadUvarint() (uint64, error) {
	var x uint64
	var s uint
	var C = r.C
	var S = r.S

	for {
		b := S[C]
		C++

		if b < lastByte {
			r.C = C

			// why the "extra" >= check?  The normal case is that s <
			// 63, so we check this single >= guard first so that we
			// hit the normal, nil-error return pathway sooner.
			if s >= sevenTimesNine && (s > sevenTimesNine || s == sevenTimesNine && b > 1) {
				return 0, fmt.Errorf("memUvarintReader overflow")
			}

			return x | uint64(b)<<s, nil
		}

		x |= uint64(b&significantBits) << s
		s += 7
	}
}

// SkipUvarint skips ahead one encoded uint64.
func (r *memUvarintReader) SkipUvarint() {
	for {
		b := r.S[r.C]
		r.C++

		if b < lastByte {
			return
		}
	}
}

// SkipBytes skips a count number of bytes.
func (r *memUvarintReader) SkipBytes(count int) {
	r.C += count
}

func (r *memUvarintReader) Reset(s []byte) {
	r.C = 0
	r.S = s
}
