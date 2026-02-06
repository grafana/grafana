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

package zap

import (
	"bytes"
	"encoding/binary"
	"io"
	"math"
)

const termNotEncoded = math.MaxUint64

type chunkedIntCoder struct {
	final     []byte
	chunkSize uint64
	chunkBuf  bytes.Buffer
	chunkLens []uint64
	currChunk uint64

	buf []byte
}

// newChunkedIntCoder returns a new chunk int coder which packs data into
// chunks based on the provided chunkSize and supports up to the specified
// maxDocNum
func newChunkedIntCoder(chunkSize uint64, maxDocNum uint64) *chunkedIntCoder {
	total := maxDocNum/chunkSize + 1
	rv := &chunkedIntCoder{
		chunkSize: chunkSize,
		chunkLens: make([]uint64, total),
		final:     make([]byte, 0, 64),
	}

	return rv
}

// Reset lets you reuse this chunked int coder.  buffers are reset and reused
// from previous use.  you cannot change the chunk size or max doc num.
func (c *chunkedIntCoder) Reset() {
	c.final = c.final[:0]
	c.chunkBuf.Reset()
	c.currChunk = 0
	for i := range c.chunkLens {
		c.chunkLens[i] = 0
	}
}

// SetChunkSize changes the chunk size.  It is only valid to do so
// with a new chunkedIntCoder, or immediately after calling Reset()
func (c *chunkedIntCoder) SetChunkSize(chunkSize uint64, maxDocNum uint64) {
	total := int(maxDocNum/chunkSize + 1)
	c.chunkSize = chunkSize
	if cap(c.chunkLens) < total {
		c.chunkLens = make([]uint64, total)
	} else {
		c.chunkLens = c.chunkLens[:total]
	}
}

// Add encodes the provided integers into the correct chunk for the provided
// doc num.  You MUST call Add() with increasing docNums.
func (c *chunkedIntCoder) Add(docNum uint64, vals ...uint64) error {
	chunk := docNum / c.chunkSize
	if chunk != c.currChunk {
		// starting a new chunk
		c.Close()
		c.chunkBuf.Reset()
		c.currChunk = chunk
	}

	if len(c.buf) < binary.MaxVarintLen64 {
		c.buf = make([]byte, binary.MaxVarintLen64)
	}

	for _, val := range vals {
		wb := binary.PutUvarint(c.buf, val)
		_, err := c.chunkBuf.Write(c.buf[:wb])
		if err != nil {
			return err
		}
	}

	return nil
}

func (c *chunkedIntCoder) AddBytes(docNum uint64, buf []byte) error {
	chunk := docNum / c.chunkSize
	if chunk != c.currChunk {
		// starting a new chunk
		c.Close()
		c.chunkBuf.Reset()
		c.currChunk = chunk
	}

	_, err := c.chunkBuf.Write(buf)
	return err
}

// Close indicates you are done calling Add() this allows the final chunk
// to be encoded.
func (c *chunkedIntCoder) Close() {
	encodingBytes := c.chunkBuf.Bytes()
	c.chunkLens[c.currChunk] = uint64(len(encodingBytes))
	c.final = append(c.final, encodingBytes...)
	c.currChunk = uint64(cap(c.chunkLens)) // sentinel to detect double close
}

// Write commits all the encoded chunked integers to the provided writer.
func (c *chunkedIntCoder) Write(w io.Writer) (int, error) {
	bufNeeded := binary.MaxVarintLen64 * (1 + len(c.chunkLens))
	if len(c.buf) < bufNeeded {
		c.buf = make([]byte, bufNeeded)
	}
	buf := c.buf

	// convert the chunk lengths into chunk offsets
	chunkOffsets := modifyLengthsToEndOffsets(c.chunkLens)

	// write out the number of chunks & each chunk offsets
	n := binary.PutUvarint(buf, uint64(len(chunkOffsets)))
	for _, chunkOffset := range chunkOffsets {
		n += binary.PutUvarint(buf[n:], chunkOffset)
	}

	tw, err := w.Write(buf[:n])
	if err != nil {
		return tw, err
	}

	// write out the data
	nw, err := w.Write(c.final)
	tw += nw
	if err != nil {
		return tw, err
	}
	return tw, nil
}

// writeAt commits all the encoded chunked integers to the provided writer
// and returns the starting offset, total bytes written and an error
func (c *chunkedIntCoder) writeAt(w io.Writer) (uint64, int, error) {
	startOffset := uint64(termNotEncoded)
	if len(c.final) <= 0 {
		return startOffset, 0, nil
	}

	if chw := w.(*CountHashWriter); chw != nil {
		startOffset = uint64(chw.Count())
	}

	tw, err := c.Write(w)
	return startOffset, tw, err
}

func (c *chunkedIntCoder) FinalSize() int {
	return len(c.final)
}

// modifyLengthsToEndOffsets converts the chunk length array
// to a chunk offset array. The readChunkBoundary
// will figure out the start and end of every chunk from
// these offsets. Starting offset of i'th index is stored
// in i-1'th position except for 0'th index and ending offset
// is stored at i'th index position.
// For 0'th element, starting position is always zero.
// eg:
// Lens ->  5 5 5 5 => 5 10 15 20
// Lens ->  0 5 0 5 => 0 5 5 10
// Lens ->  0 0 0 5 => 0 0 0 5
// Lens ->  5 0 0 0 => 5 5 5 5
// Lens ->  0 5 0 0 => 0 5 5 5
// Lens ->  0 0 5 0 => 0 0 5 5
func modifyLengthsToEndOffsets(lengths []uint64) []uint64 {
	var runningOffset uint64
	var index, i int
	for i = 1; i <= len(lengths); i++ {
		runningOffset += lengths[i-1]
		lengths[index] = runningOffset
		index++
	}
	return lengths
}

func readChunkBoundary(chunk int, offsets []uint64) (uint64, uint64) {
	var start uint64
	if chunk > 0 {
		start = offsets[chunk-1]
	}
	return start, offsets[chunk]
}
