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

package zap

import (
	"fmt"
)

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

// ReadUvarint reads an encoded uint64.  The original code this was
// based on is at encoding/binary/ReadUvarint().
func (r *memUvarintReader) ReadUvarint() (uint64, error) {
	if r.C >= len(r.S) {
		// nothing else to read
		return 0, nil
	}

	var x uint64
	var s uint
	var C = r.C
	var S = r.S

	for {
		b := S[C]
		C++

		if b < 0x80 {
			r.C = C

			// why 63?  The original code had an 'i += 1' loop var and
			// checked for i > 9 || i == 9 ...; but, we no longer
			// check for the i var, but instead check here for s,
			// which is incremented by 7.  So, 7*9 == 63.
			//
			// why the "extra" >= check?  The normal case is that s <
			// 63, so we check this single >= guard first so that we
			// hit the normal, nil-error return pathway sooner.
			if s >= 63 && (s > 63 || b > 1) {
				return 0, fmt.Errorf("memUvarintReader overflow")
			}

			return x | uint64(b)<<s, nil
		}

		x |= uint64(b&0x7f) << s
		s += 7
	}
}

// SkipUvarint skips ahead one encoded uint64.
func (r *memUvarintReader) SkipUvarint() {
	for {
		if r.C >= len(r.S) {
			return
		}

		b := r.S[r.C]
		r.C++

		if b < 0x80 {
			return
		}
	}
}

// SkipBytes skips a count number of bytes.
func (r *memUvarintReader) SkipBytes(count int) {
	r.C = r.C + count
}

func (r *memUvarintReader) Reset(s []byte) {
	r.C = 0
	r.S = s
}
