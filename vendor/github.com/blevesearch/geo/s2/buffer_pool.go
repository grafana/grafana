//  Copyright (c) 2023 Couchbase, Inc.
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

package s2

// GeoBufferPool represents a pool of buffers ranging from a given
// max size to a min size in steps of 2. It uses a lazy approach only allocating
// the buffers when it is needed.

type GeoBufferPool struct {
	buffers [][]byte
	maxSize int
	minSize int
}

func NewGeoBufferPool(maxSize int, minSize int) *GeoBufferPool {
	// Calculating the number of buffers required. Assuming that
	// the value of minSize is correct, the buffers will be of size
	// minSize, 2 * minSize, 4 * minSize and so on till it is less
	// than or equal to the maxSize. If it is not equal to maxSize,
	// then a suitable value less than maxSize will be set as maxSize
	length := 0
	temp := minSize
	for temp <= maxSize {
		length = length + 1
		temp = temp * 2
	}
	maxSize = temp / 2

	return &GeoBufferPool{
		buffers: make([][]byte, length),
		maxSize: maxSize,
		minSize: minSize,
	}
}

func (b *GeoBufferPool) Get(size int) ([]byte) {
	if b == nil {
		// GeoBufferPool not setup
		return make([]byte, size)
	}

	bufSize := b.minSize

	for i := range b.buffers {
		if size <= bufSize || i == len(b.buffers) - 1 {
			if b.buffers[i] == nil {
				b.buffers[i] = make([]byte, bufSize)
			}

			return b.buffers[i]
		}

		bufSize = bufSize * 2
	}

	return nil
}
