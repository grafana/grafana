// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package metadata

import (
	"io"
	"slices"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/bitutil"
	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/parquet/internal/encryption"
	format "github.com/apache/arrow-go/v18/parquet/internal/gen-go/parquet"
	"github.com/apache/arrow-go/v18/parquet/schema"
)

type bloomFilterCandidate struct {
	bloomFilter *blockSplitBloomFilter
	expectedNDV uint32
}

func newBloomFilterCandidate(expectedNDV, numBytes, minBytes, maxBytes uint32, h Hasher, mem memory.Allocator) *bloomFilterCandidate {
	if numBytes < minBytes {
		numBytes = minBytes
	}

	if numBytes > maxBytes {
		numBytes = maxBytes
	}

	// get next power of 2 if it's not a power of 2
	if (numBytes & (numBytes - 1)) != 0 {
		numBytes = uint32(bitutil.NextPowerOf2(int(numBytes)))
	}

	buf := memory.NewResizableBuffer(mem)
	buf.ResizeNoShrink(int(numBytes))
	bf := blockSplitBloomFilter{
		data:         buf,
		bitset32:     arrow.Uint32Traits.CastFromBytes(buf.Bytes()),
		hasher:       h,
		algorithm:    defaultAlgorithm,
		hashStrategy: defaultHashStrategy,
		compression:  defaultCompression,
	}
	addCleanup(&bf, nil)
	return &bloomFilterCandidate{bloomFilter: &bf, expectedNDV: expectedNDV}
}

type adaptiveBlockSplitBloomFilter struct {
	mem              memory.Allocator
	candidates       []*bloomFilterCandidate
	largestCandidate *bloomFilterCandidate
	numDistinct      int64
	finalized        bool

	maxBytes, minBytes uint32
	minCandidateNDV    int
	hasher             Hasher
	hashStrategy       format.BloomFilterHash
	algorithm          format.BloomFilterAlgorithm
	compression        format.BloomFilterCompression

	column *schema.Column
}

func NewAdaptiveBlockSplitBloomFilter(maxBytes uint32, numCandidates int, fpp float64, column *schema.Column, mem memory.Allocator) BloomFilterBuilder {
	ret := &adaptiveBlockSplitBloomFilter{
		mem:             mem,
		maxBytes:        min(maximumBloomFilterBytes, maxBytes),
		minBytes:        minimumBloomFilterBytes,
		minCandidateNDV: 16,
		hasher:          xxhasher{},
		column:          column,
		hashStrategy:    defaultHashStrategy,
		algorithm:       defaultAlgorithm,
		compression:     defaultCompression,
	}

	ret.initCandidates(maxBytes, numCandidates, fpp)
	return ret
}

func (b *adaptiveBlockSplitBloomFilter) getAlg() *format.BloomFilterAlgorithm {
	return &b.algorithm
}

func (b *adaptiveBlockSplitBloomFilter) getHashStrategy() *format.BloomFilterHash {
	return &b.hashStrategy
}

func (b *adaptiveBlockSplitBloomFilter) getCompression() *format.BloomFilterCompression {
	return &b.compression
}

func (b *adaptiveBlockSplitBloomFilter) optimalCandidate() *bloomFilterCandidate {
	return slices.MinFunc(b.candidates, func(a, b *bloomFilterCandidate) int {
		return int(a.bloomFilter.Size() - b.bloomFilter.Size())
	})
}

func (b *adaptiveBlockSplitBloomFilter) Hasher() Hasher { return b.hasher }

func (b *adaptiveBlockSplitBloomFilter) InsertHash(hash uint64) {
	if b.finalized {
		panic("adaptive bloom filter has been marked finalized, no more data allowed")
	}

	if !b.largestCandidate.bloomFilter.CheckHash(hash) {
		b.numDistinct++
	}

	b.candidates = slices.DeleteFunc(b.candidates, func(c *bloomFilterCandidate) bool {
		return c.expectedNDV < uint32(b.numDistinct) && c != b.largestCandidate
	})

	for _, c := range b.candidates {
		c.bloomFilter.InsertHash(hash)
	}
}

func (b *adaptiveBlockSplitBloomFilter) InsertBulk(hashes []uint64) {
	if b.finalized {
		panic("adaptive bloom filter has been marked finalized, no more data allowed")
	}

	// Use a set to track unique hashes that are not already in the largest candidate
	uniqueNewHashes := make(map[uint64]struct{})
	for _, h := range hashes {
		if !b.largestCandidate.bloomFilter.CheckHash(h) {
			uniqueNewHashes[h] = struct{}{}
		}
	}

	// Only increment numDistinct by the number of unique new hashes
	b.numDistinct += int64(len(uniqueNewHashes))

	b.candidates = slices.DeleteFunc(b.candidates, func(c *bloomFilterCandidate) bool {
		return c.expectedNDV < uint32(b.numDistinct) && c != b.largestCandidate
	})

	for _, c := range b.candidates {
		c.bloomFilter.InsertBulk(hashes)
	}
}

func (b *adaptiveBlockSplitBloomFilter) Size() int64 {
	return b.optimalCandidate().bloomFilter.Size()
}

func (b *adaptiveBlockSplitBloomFilter) CheckHash(hash uint64) bool {
	return b.largestCandidate.bloomFilter.CheckHash(hash)
}

func (b *adaptiveBlockSplitBloomFilter) WriteTo(w io.Writer, enc encryption.Encryptor) (int, error) {
	b.finalized = true

	return b.optimalCandidate().bloomFilter.WriteTo(w, enc)
}

func (b *adaptiveBlockSplitBloomFilter) initCandidates(maxBytes uint32, numCandidates int, fpp float64) {
	b.candidates = make([]*bloomFilterCandidate, 0, numCandidates)
	candidateByteSize := b.calcBoundedPowerOf2(maxBytes)
	for range numCandidates {
		candidateExpectedNDV := b.expectedNDV(candidateByteSize, fpp)
		if candidateExpectedNDV <= 0 {
			break
		}

		b.candidates = append(b.candidates, newBloomFilterCandidate(uint32(candidateExpectedNDV),
			candidateByteSize, b.minBytes, b.maxBytes, b.hasher, b.mem))
		candidateByteSize = b.calcBoundedPowerOf2(candidateByteSize / 2)
	}

	if len(b.candidates) == 0 {
		// maxBytes is too small, but at least one candidate will be generated
		b.candidates = append(b.candidates, newBloomFilterCandidate(uint32(b.minCandidateNDV),
			b.minBytes, b.minBytes, b.maxBytes, b.hasher, b.mem))
	}

	b.largestCandidate = slices.MaxFunc(b.candidates, func(a, b *bloomFilterCandidate) int {
		return int(a.bloomFilter.Size() - b.bloomFilter.Size())
	})
}

func (b *adaptiveBlockSplitBloomFilter) expectedNDV(numBytes uint32, fpp float64) int {
	var (
		expectedNDV, optimalBytes uint32
	)

	const ndvStep = 500
	for optimalBytes < numBytes {
		expectedNDV += ndvStep
		optimalBytes = optimalNumBytes(expectedNDV, fpp)
	}

	// make sure it is slightly smaller than what numBytes supports
	expectedNDV -= ndvStep
	return int(max(0, expectedNDV))
}

func (b *adaptiveBlockSplitBloomFilter) calcBoundedPowerOf2(numBytes uint32) uint32 {
	if numBytes < b.minBytes {
		numBytes = b.minBytes
	}

	if numBytes&(numBytes-1) != 0 {
		numBytes = uint32(bitutil.NextPowerOf2(int(numBytes)))
	}

	return max(min(numBytes, b.maxBytes), b.minBytes)
}
