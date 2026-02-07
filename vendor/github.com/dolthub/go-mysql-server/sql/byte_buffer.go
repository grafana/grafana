// Copyright 2024 Dolthub, Inc.
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

package sql

import (
	"sync"
)

const defaultByteBuffCap = 4096

var ByteBufPool = sync.Pool{
	New: func() any {
		return NewByteBuffer(defaultByteBuffCap)
	},
}

type ByteBuffer struct {
	buf []byte
	i   int
}

func NewByteBuffer(initCap int) *ByteBuffer {
	buf := make([]byte, initCap)
	return &ByteBuffer{buf: buf}
}

// Grow records the latest used byte position. Callers
// are responsible for accurately reporting which bytes
// they expect to be protected.
func (b *ByteBuffer) Grow(n int) {
	newI := b.i
	if b.i+n <= len(b.buf) {
		// Increment |b.i| if no alloc
		newI += n
	}
	if b.i+n >= len(b.buf) {
		// No more space, double.
		// An external allocation doubled the cap using the size of
		// the override object, which if used could lead to overall
		// shrinking behavior.
		b.Double()
	}
	b.i = newI
}

// Double expands the backing array by 2x. We do this
// here because the runtime only doubles based on slice
// length.
func (b *ByteBuffer) Double() {
	buf := make([]byte, len(b.buf)*2)
	copy(buf, b.buf)
	b.buf = buf
}

// Get returns a zero length slice beginning at a safe
// write position.
func (b *ByteBuffer) Get() []byte {
	return b.buf[b.i:b.i]
}

func (b *ByteBuffer) Reset() {
	b.i = 0
}
