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

package ice

import (
	"encoding/binary"
	"fmt"

	segment "github.com/blugelabs/bluge_segment_api"
)

type chunkedIntDecoder struct {
	startOffset     uint64
	dataStartOffset uint64
	chunkOffsets    []uint64
	curChunkBytes   []byte
	uncompressed    []byte // temp buf for decompression
	data            *segment.Data
	r               *memUvarintReader
}

func newChunkedIntDecoder(data *segment.Data, offset uint64, rv *chunkedIntDecoder) (*chunkedIntDecoder, error) {
	if rv == nil {
		rv = &chunkedIntDecoder{startOffset: offset, data: data}
	} else {
		rv.startOffset = offset
		rv.data = data
	}
	var n, numChunks uint64
	var read int
	if offset == termNotEncoded {
		numChunks = 0
	} else {
		numChunksData, err := data.Read(int(offset+n), int(offset+n+binary.MaxVarintLen64))
		if err != nil {
			return nil, err
		}
		numChunks, read = binary.Uvarint(numChunksData)
	}

	n += uint64(read)
	if cap(rv.chunkOffsets) >= int(numChunks) {
		rv.chunkOffsets = rv.chunkOffsets[:int(numChunks)]
	} else {
		rv.chunkOffsets = make([]uint64, int(numChunks))
	}
	for i := 0; i < int(numChunks); i++ {
		chunkOffsetData, err := data.Read(int(offset+n), int(offset+n+binary.MaxVarintLen64))
		if err != nil {
			return nil, err
		}
		rv.chunkOffsets[i], read = binary.Uvarint(chunkOffsetData)
		n += uint64(read)
	}
	rv.dataStartOffset = offset + n
	return rv, nil
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
	curChunkBytesData, err := d.data.Read(int(start), int(end))
	if err != nil {
		return err
	}
	d.uncompressed, err = ZSTDDecompress(d.uncompressed[:cap(d.uncompressed)], curChunkBytesData)
	if err != nil {
		return err
	}
	d.curChunkBytes = d.uncompressed
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
	d.uncompressed = d.uncompressed[:0]

	// FIXME what?
	// d.data = d.data[:0]
	d.data = nil
	if d.r != nil {
		d.r.Reset([]byte(nil))
	}
}

func (d *chunkedIntDecoder) isNil() bool {
	return d.curChunkBytes == nil || len(d.curChunkBytes) == 0
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
