//  Copyright (c) 2019 Couchbase, Inc.
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
	"encoding/binary"
	"fmt"
)

type chunkedIntDecoder struct {
	startOffset     uint64
	dataStartOffset uint64
	chunkOffsets    []uint64
	curChunkBytes   []byte
	data            []byte
	r               *memUvarintReader
}

func newChunkedIntDecoder(buf []byte, offset uint64) *chunkedIntDecoder {
	rv := &chunkedIntDecoder{startOffset: offset, data: buf}
	var n, numChunks uint64
	var read int
	if offset == termNotEncoded {
		numChunks = 0
	} else {
		numChunks, read = binary.Uvarint(buf[offset+n : offset+n+binary.MaxVarintLen64])
	}

	n += uint64(read)
	if cap(rv.chunkOffsets) >= int(numChunks) {
		rv.chunkOffsets = rv.chunkOffsets[:int(numChunks)]
	} else {
		rv.chunkOffsets = make([]uint64, int(numChunks))
	}
	for i := 0; i < int(numChunks); i++ {
		rv.chunkOffsets[i], read = binary.Uvarint(buf[offset+n : offset+n+binary.MaxVarintLen64])
		n += uint64(read)
	}
	rv.dataStartOffset = offset + n
	return rv
}

func (d *chunkedIntDecoder) loadChunk(chunk int) error {
	if d.startOffset == termNotEncoded {
		d.r = newMemUvarintReader([]byte(nil))
		return nil
	}

	if chunk >= len(d.chunkOffsets) {
		return fmt.Errorf("tried to load freq chunk that doesn't exist %d/(%d)",
			chunk, len(d.chunkOffsets))
	}

	end, start := d.dataStartOffset, d.dataStartOffset
	s, e := readChunkBoundary(chunk, d.chunkOffsets)
	start += s
	end += e
	d.curChunkBytes = d.data[start:end]
	if d.r == nil {
		d.r = newMemUvarintReader(d.curChunkBytes)
	} else {
		d.r.Reset(d.curChunkBytes)
	}

	return nil
}

func (d *chunkedIntDecoder) reset() {
	d.startOffset = 0
	d.dataStartOffset = 0
	d.chunkOffsets = d.chunkOffsets[:0]
	d.curChunkBytes = d.curChunkBytes[:0]
	d.data = d.data[:0]
	if d.r != nil {
		d.r.Reset([]byte(nil))
	}
}

func (d *chunkedIntDecoder) isNil() bool {
	return d.curChunkBytes == nil
}

func (d *chunkedIntDecoder) readUvarint() (uint64, error) {
	return d.r.ReadUvarint()
}

func (d *chunkedIntDecoder) SkipUvarint() {
	d.r.SkipUvarint()
}

func (d *chunkedIntDecoder) SkipBytes(count int) {
	d.r.SkipBytes(count)
}

func (d *chunkedIntDecoder) Len() int {
	return d.r.Len()
}
