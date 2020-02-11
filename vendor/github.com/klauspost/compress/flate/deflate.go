// Copyright 2009 The Go Authors. All rights reserved.
// Copyright (c) 2015 Klaus Post
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package flate

import (
	"fmt"
	"io"
	"math"
)

const (
	NoCompression      = 0
	BestSpeed          = 1
	BestCompression    = 9
	DefaultCompression = -1

	// HuffmanOnly disables Lempel-Ziv match searching and only performs Huffman
	// entropy encoding. This mode is useful in compressing data that has
	// already been compressed with an LZ style algorithm (e.g. Snappy or LZ4)
	// that lacks an entropy encoder. Compression gains are achieved when
	// certain bytes in the input stream occur more frequently than others.
	//
	// Note that HuffmanOnly produces a compressed output that is
	// RFC 1951 compliant. That is, any valid DEFLATE decompressor will
	// continue to be able to decompress this output.
	HuffmanOnly         = -2
	ConstantCompression = HuffmanOnly // compatibility alias.

	logWindowSize    = 15
	windowSize       = 1 << logWindowSize
	windowMask       = windowSize - 1
	logMaxOffsetSize = 15  // Standard DEFLATE
	minMatchLength   = 4   // The smallest match that the compressor looks for
	maxMatchLength   = 258 // The longest match for the compressor
	minOffsetSize    = 1   // The shortest offset that makes any sense

	// The maximum number of tokens we put into a single flat block, just too
	// stop things from getting too large.
	maxFlateBlockTokens = 1 << 14
	maxStoreBlockSize   = 65535
	hashBits            = 17 // After 17 performance degrades
	hashSize            = 1 << hashBits
	hashMask            = (1 << hashBits) - 1
	hashShift           = (hashBits + minMatchLength - 1) / minMatchLength
	maxHashOffset       = 1 << 24

	skipNever = math.MaxInt32
)

var useSSE42 bool

type compressionLevel struct {
	good, lazy, nice, chain, fastSkipHashing, level int
}

// Compression levels have been rebalanced from zlib deflate defaults
// to give a bigger spread in speed and compression.
// See https://blog.klauspost.com/rebalancing-deflate-compression-levels/
var levels = []compressionLevel{
	{}, // 0
	// Level 1-4 uses specialized algorithm - values not used
	{0, 0, 0, 0, 0, 1},
	{0, 0, 0, 0, 0, 2},
	{0, 0, 0, 0, 0, 3},
	{0, 0, 0, 0, 0, 4},
	// For levels 5-6 we don't bother trying with lazy matches.
	// Lazy matching is at least 30% slower, with 1.5% increase.
	{6, 0, 12, 8, 12, 5},
	{8, 0, 24, 16, 16, 6},
	// Levels 7-9 use increasingly more lazy matching
	// and increasingly stringent conditions for "good enough".
	{8, 8, 24, 16, skipNever, 7},
	{10, 16, 24, 64, skipNever, 8},
	{32, 258, 258, 4096, skipNever, 9},
}

type compressor struct {
	compressionLevel

	w          *huffmanBitWriter
	bulkHasher func([]byte, []uint32)

	// compression algorithm
	fill func(*compressor, []byte) int // copy data to window
	step func(*compressor)             // process window
	sync bool                          // requesting flush

	// Input hash chains
	// hashHead[hashValue] contains the largest inputIndex with the specified hash value
	// If hashHead[hashValue] is within the current window, then
	// hashPrev[hashHead[hashValue] & windowMask] contains the previous index
	// with the same hash value.
	chainHead  int
	hashHead   [hashSize]uint32
	hashPrev   [windowSize]uint32
	hashOffset int

	// input window: unprocessed data is window[index:windowEnd]
	index         int
	window        []byte
	windowEnd     int
	blockStart    int  // window index where current tokens start
	byteAvailable bool // if true, still need to process window[index-1].

	// queued output tokens
	tokens tokens

	// deflate state
	length         int
	offset         int
	hash           uint32
	maxInsertIndex int
	err            error
	ii             uint16 // position of last match, intended to overflow to reset.

	snap      snappyEnc
	hashMatch [maxMatchLength + minMatchLength]uint32
}

func (d *compressor) fillDeflate(b []byte) int {
	if d.index >= 2*windowSize-(minMatchLength+maxMatchLength) {
		// shift the window by windowSize
		copy(d.window[:], d.window[windowSize:2*windowSize])
		d.index -= windowSize
		d.windowEnd -= windowSize
		if d.blockStart >= windowSize {
			d.blockStart -= windowSize
		} else {
			d.blockStart = math.MaxInt32
		}
		d.hashOffset += windowSize
		if d.hashOffset > maxHashOffset {
			delta := d.hashOffset - 1
			d.hashOffset -= delta
			d.chainHead -= delta
			// Iterate over slices instead of arrays to avoid copying
			// the entire table onto the stack (Issue #18625).
			for i, v := range d.hashPrev[:] {
				if int(v) > delta {
					d.hashPrev[i] = uint32(int(v) - delta)
				} else {
					d.hashPrev[i] = 0
				}
			}
			for i, v := range d.hashHead[:] {
				if int(v) > delta {
					d.hashHead[i] = uint32(int(v) - delta)
				} else {
					d.hashHead[i] = 0
				}
			}
		}
	}
	n := copy(d.window[d.windowEnd:], b)
	d.windowEnd += n
	return n
}

func (d *compressor) writeBlock(tok tokens, index int, eof bool) error {
	if index > 0 || eof {
		var window []byte
		if d.blockStart <= index {
			window = d.window[d.blockStart:index]
		}
		d.blockStart = index
		d.w.writeBlock(tok.tokens[:tok.n], eof, window)
		return d.w.err
	}
	return nil
}

// writeBlockSkip writes the current block and uses the number of tokens
// to determine if the block should be stored on no matches, or
// only huffman encoded.
func (d *compressor) writeBlockSkip(tok tokens, index int, eof bool) error {
	if index > 0 || eof {
		if d.blockStart <= index {
			window := d.window[d.blockStart:index]
			// If we removed less than a 64th of all literals
			// we huffman compress the block.
			if int(tok.n) > len(window)-int(tok.n>>6) {
				d.w.writeBlockHuff(eof, window)
			} else {
				// Write a dynamic huffman block.
				d.w.writeBlockDynamic(tok.tokens[:tok.n], eof, window)
			}
		} else {
			d.w.writeBlock(tok.tokens[:tok.n], eof, nil)
		}
		d.blockStart = index
		return d.w.err
	}
	return nil
}

// fillWindow will fill the current window with the supplied
// dictionary and calculate all hashes.
// This is much faster than doing a full encode.
// Should only be used after a start/reset.
func (d *compressor) fillWindow(b []byte) {
	// Do not fill window if we are in store-only mode,
	// use constant or Snappy compression.
	switch d.compressionLevel.level {
	case 0, 1, 2:
		return
	}
	// If we are given too much, cut it.
	if len(b) > windowSize {
		b = b[len(b)-windowSize:]
	}
	// Add all to window.
	n := copy(d.window[d.windowEnd:], b)

	// Calculate 256 hashes at the time (more L1 cache hits)
	loops := (n + 256 - minMatchLength) / 256
	for j := 0; j < loops; j++ {
		startindex := j * 256
		end := startindex + 256 + minMatchLength - 1
		if end > n {
			end = n
		}
		tocheck := d.window[startindex:end]
		dstSize := len(tocheck) - minMatchLength + 1

		if dstSize <= 0 {
			continue
		}

		dst := d.hashMatch[:dstSize]
		d.bulkHasher(tocheck, dst)
		var newH uint32
		for i, val := range dst {
			di := i + startindex
			newH = val & hashMask
			// Get previous value with the same hash.
			// Our chain should point to the previous value.
			d.hashPrev[di&windowMask] = d.hashHead[newH]
			// Set the head of the hash chain to us.
			d.hashHead[newH] = uint32(di + d.hashOffset)
		}
		d.hash = newH
	}
	// Update window information.
	d.windowEnd += n
	d.index = n
}

// Try to find a match starting at index whose length is greater than prevSize.
// We only look at chainCount possibilities before giving up.
// pos = d.index, prevHead = d.chainHead-d.hashOffset, prevLength=minMatchLength-1, lookahead
func (d *compressor) findMatch(pos int, prevHead int, prevLength int, lookahead int) (length, offset int, ok bool) {
	minMatchLook := maxMatchLength
	if lookahead < minMatchLook {
		minMatchLook = lookahead
	}

	win := d.window[0 : pos+minMatchLook]

	// We quit when we get a match that's at least nice long
	nice := len(win) - pos
	if d.nice < nice {
		nice = d.nice
	}

	// If we've got a match that's good enough, only look in 1/4 the chain.
	tries := d.chain
	length = prevLength
	if length >= d.good {
		tries >>= 2
	}

	wEnd := win[pos+length]
	wPos := win[pos:]
	minIndex := pos - windowSize

	for i := prevHead; tries > 0; tries-- {
		if wEnd == win[i+length] {
			n := matchLen(win[i:], wPos, minMatchLook)

			if n > length && (n > minMatchLength || pos-i <= 4096) {
				length = n
				offset = pos - i
				ok = true
				if n >= nice {
					// The match is good enough that we don't try to find a better one.
					break
				}
				wEnd = win[pos+n]
			}
		}
		if i == minIndex {
			// hashPrev[i & windowMask] has already been overwritten, so stop now.
			break
		}
		i = int(d.hashPrev[i&windowMask]) - d.hashOffset
		if i < minIndex || i < 0 {
			break
		}
	}
	return
}

// Try to find a match starting at index whose length is greater than prevSize.
// We only look at chainCount possibilities before giving up.
// pos = d.index, prevHead = d.chainHead-d.hashOffset, prevLength=minMatchLength-1, lookahead
func (d *compressor) findMatchSSE(pos int, prevHead int, prevLength int, lookahead int) (length, offset int, ok bool) {
	minMatchLook := maxMatchLength
	if lookahead < minMatchLook {
		minMatchLook = lookahead
	}

	win := d.window[0 : pos+minMatchLook]

	// We quit when we get a match that's at least nice long
	nice := len(win) - pos
	if d.nice < nice {
		nice = d.nice
	}

	// If we've got a match that's good enough, only look in 1/4 the chain.
	tries := d.chain
	length = prevLength
	if length >= d.good {
		tries >>= 2
	}

	wEnd := win[pos+length]
	wPos := win[pos:]
	minIndex := pos - windowSize

	for i := prevHead; tries > 0; tries-- {
		if wEnd == win[i+length] {
			n := matchLenSSE4(win[i:], wPos, minMatchLook)

			if n > length && (n > minMatchLength || pos-i <= 4096) {
				length = n
				offset = pos - i
				ok = true
				if n >= nice {
					// The match is good enough that we don't try to find a better one.
					break
				}
				wEnd = win[pos+n]
			}
		}
		if i == minIndex {
			// hashPrev[i & windowMask] has already been overwritten, so stop now.
			break
		}
		i = int(d.hashPrev[i&windowMask]) - d.hashOffset
		if i < minIndex || i < 0 {
			break
		}
	}
	return
}

func (d *compressor) writeStoredBlock(buf []byte) error {
	if d.w.writeStoredHeader(len(buf), false); d.w.err != nil {
		return d.w.err
	}
	d.w.writeBytes(buf)
	return d.w.err
}

const hashmul = 0x1e35a7bd

// hash4 returns a hash representation of the first 4 bytes
// of the supplied slice.
// The caller must ensure that len(b) >= 4.
func hash4(b []byte) uint32 {
	return ((uint32(b[3]) | uint32(b[2])<<8 | uint32(b[1])<<16 | uint32(b[0])<<24) * hashmul) >> (32 - hashBits)
}

// bulkHash4 will compute hashes using the same
// algorithm as hash4
func bulkHash4(b []byte, dst []uint32) {
	if len(b) < minMatchLength {
		return
	}
	hb := uint32(b[3]) | uint32(b[2])<<8 | uint32(b[1])<<16 | uint32(b[0])<<24
	dst[0] = (hb * hashmul) >> (32 - hashBits)
	end := len(b) - minMatchLength + 1
	for i := 1; i < end; i++ {
		hb = (hb << 8) | uint32(b[i+3])
		dst[i] = (hb * hashmul) >> (32 - hashBits)
	}
}

// matchLen returns the number of matching bytes in a and b
// up to length 'max'. Both slices must be at least 'max'
// bytes in size.
func matchLen(a, b []byte, max int) int {
	a = a[:max]
	b = b[:len(a)]
	for i, av := range a {
		if b[i] != av {
			return i
		}
	}
	return max
}

func (d *compressor) initDeflate() {
	d.window = make([]byte, 2*windowSize)
	d.hashOffset = 1
	d.length = minMatchLength - 1
	d.offset = 0
	d.byteAvailable = false
	d.index = 0
	d.hash = 0
	d.chainHead = -1
	d.bulkHasher = bulkHash4
	if useSSE42 {
		d.bulkHasher = crc32sseAll
	}
}

// Assumes that d.fastSkipHashing != skipNever,
// otherwise use deflateLazy
func (d *compressor) deflate() {

	// Sanity enables additional runtime tests.
	// It's intended to be used during development
	// to supplement the currently ad-hoc unit tests.
	const sanity = false

	if d.windowEnd-d.index < minMatchLength+maxMatchLength && !d.sync {
		return
	}

	d.maxInsertIndex = d.windowEnd - (minMatchLength - 1)
	if d.index < d.maxInsertIndex {
		d.hash = hash4(d.window[d.index : d.index+minMatchLength])
	}

	for {
		if sanity && d.index > d.windowEnd {
			panic("index > windowEnd")
		}
		lookahead := d.windowEnd - d.index
		if lookahead < minMatchLength+maxMatchLength {
			if !d.sync {
				return
			}
			if sanity && d.index > d.windowEnd {
				panic("index > windowEnd")
			}
			if lookahead == 0 {
				if d.tokens.n > 0 {
					if d.err = d.writeBlockSkip(d.tokens, d.index, false); d.err != nil {
						return
					}
					d.tokens.n = 0
				}
				return
			}
		}
		if d.index < d.maxInsertIndex {
			// Update the hash
			d.hash = hash4(d.window[d.index : d.index+minMatchLength])
			ch := d.hashHead[d.hash&hashMask]
			d.chainHead = int(ch)
			d.hashPrev[d.index&windowMask] = ch
			d.hashHead[d.hash&hashMask] = uint32(d.index + d.hashOffset)
		}
		d.length = minMatchLength - 1
		d.offset = 0
		minIndex := d.index - windowSize
		if minIndex < 0 {
			minIndex = 0
		}

		if d.chainHead-d.hashOffset >= minIndex && lookahead > minMatchLength-1 {
			if newLength, newOffset, ok := d.findMatch(d.index, d.chainHead-d.hashOffset, minMatchLength-1, lookahead); ok {
				d.length = newLength
				d.offset = newOffset
			}
		}
		if d.length >= minMatchLength {
			d.ii = 0
			// There was a match at the previous step, and the current match is
			// not better. Output the previous match.
			// "d.length-3" should NOT be "d.length-minMatchLength", since the format always assume 3
			d.tokens.tokens[d.tokens.n] = matchToken(uint32(d.length-3), uint32(d.offset-minOffsetSize))
			d.tokens.n++
			// Insert in the hash table all strings up to the end of the match.
			// index and index-1 are already inserted. If there is not enough
			// lookahead, the last two strings are not inserted into the hash
			// table.
			if d.length <= d.fastSkipHashing {
				var newIndex int
				newIndex = d.index + d.length
				// Calculate missing hashes
				end := newIndex
				if end > d.maxInsertIndex {
					end = d.maxInsertIndex
				}
				end += minMatchLength - 1
				startindex := d.index + 1
				if startindex > d.maxInsertIndex {
					startindex = d.maxInsertIndex
				}
				tocheck := d.window[startindex:end]
				dstSize := len(tocheck) - minMatchLength + 1
				if dstSize > 0 {
					dst := d.hashMatch[:dstSize]
					bulkHash4(tocheck, dst)
					var newH uint32
					for i, val := range dst {
						di := i + startindex
						newH = val & hashMask
						// Get previous value with the same hash.
						// Our chain should point to the previous value.
						d.hashPrev[di&windowMask] = d.hashHead[newH]
						// Set the head of the hash chain to us.
						d.hashHead[newH] = uint32(di + d.hashOffset)
					}
					d.hash = newH
				}
				d.index = newIndex
			} else {
				// For matches this long, we don't bother inserting each individual
				// item into the table.
				d.index += d.length
				if d.index < d.maxInsertIndex {
					d.hash = hash4(d.window[d.index : d.index+minMatchLength])
				}
			}
			if d.tokens.n == maxFlateBlockTokens {
				// The block includes the current character
				if d.err = d.writeBlockSkip(d.tokens, d.index, false); d.err != nil {
					return
				}
				d.tokens.n = 0
			}
		} else {
			d.ii++
			end := d.index + int(d.ii>>uint(d.fastSkipHashing)) + 1
			if end > d.windowEnd {
				end = d.windowEnd
			}
			for i := d.index; i < end; i++ {
				d.tokens.tokens[d.tokens.n] = literalToken(uint32(d.window[i]))
				d.tokens.n++
				if d.tokens.n == maxFlateBlockTokens {
					if d.err = d.writeBlockSkip(d.tokens, i+1, false); d.err != nil {
						return
					}
					d.tokens.n = 0
				}
			}
			d.index = end
		}
	}
}

// deflateLazy is the same as deflate, but with d.fastSkipHashing == skipNever,
// meaning it always has lazy matching on.
func (d *compressor) deflateLazy() {
	// Sanity enables additional runtime tests.
	// It's intended to be used during development
	// to supplement the currently ad-hoc unit tests.
	const sanity = false

	if d.windowEnd-d.index < minMatchLength+maxMatchLength && !d.sync {
		return
	}

	d.maxInsertIndex = d.windowEnd - (minMatchLength - 1)
	if d.index < d.maxInsertIndex {
		d.hash = hash4(d.window[d.index : d.index+minMatchLength])
	}

	for {
		if sanity && d.index > d.windowEnd {
			panic("index > windowEnd")
		}
		lookahead := d.windowEnd - d.index
		if lookahead < minMatchLength+maxMatchLength {
			if !d.sync {
				return
			}
			if sanity && d.index > d.windowEnd {
				panic("index > windowEnd")
			}
			if lookahead == 0 {
				// Flush current output block if any.
				if d.byteAvailable {
					// There is still one pending token that needs to be flushed
					d.tokens.tokens[d.tokens.n] = literalToken(uint32(d.window[d.index-1]))
					d.tokens.n++
					d.byteAvailable = false
				}
				if d.tokens.n > 0 {
					if d.err = d.writeBlock(d.tokens, d.index, false); d.err != nil {
						return
					}
					d.tokens.n = 0
				}
				return
			}
		}
		if d.index < d.maxInsertIndex {
			// Update the hash
			d.hash = hash4(d.window[d.index : d.index+minMatchLength])
			ch := d.hashHead[d.hash&hashMask]
			d.chainHead = int(ch)
			d.hashPrev[d.index&windowMask] = ch
			d.hashHead[d.hash&hashMask] = uint32(d.index + d.hashOffset)
		}
		prevLength := d.length
		prevOffset := d.offset
		d.length = minMatchLength - 1
		d.offset = 0
		minIndex := d.index - windowSize
		if minIndex < 0 {
			minIndex = 0
		}

		if d.chainHead-d.hashOffset >= minIndex && lookahead > prevLength && prevLength < d.lazy {
			if newLength, newOffset, ok := d.findMatch(d.index, d.chainHead-d.hashOffset, minMatchLength-1, lookahead); ok {
				d.length = newLength
				d.offset = newOffset
			}
		}
		if prevLength >= minMatchLength && d.length <= prevLength {
			// There was a match at the previous step, and the current match is
			// not better. Output the previous match.
			d.tokens.tokens[d.tokens.n] = matchToken(uint32(prevLength-3), uint32(prevOffset-minOffsetSize))
			d.tokens.n++

			// Insert in the hash table all strings up to the end of the match.
			// index and index-1 are already inserted. If there is not enough
			// lookahead, the last two strings are not inserted into the hash
			// table.
			var newIndex int
			newIndex = d.index + prevLength - 1
			// Calculate missing hashes
			end := newIndex
			if end > d.maxInsertIndex {
				end = d.maxInsertIndex
			}
			end += minMatchLength - 1
			startindex := d.index + 1
			if startindex > d.maxInsertIndex {
				startindex = d.maxInsertIndex
			}
			tocheck := d.window[startindex:end]
			dstSize := len(tocheck) - minMatchLength + 1
			if dstSize > 0 {
				dst := d.hashMatch[:dstSize]
				bulkHash4(tocheck, dst)
				var newH uint32
				for i, val := range dst {
					di := i + startindex
					newH = val & hashMask
					// Get previous value with the same hash.
					// Our chain should point to the previous value.
					d.hashPrev[di&windowMask] = d.hashHead[newH]
					// Set the head of the hash chain to us.
					d.hashHead[newH] = uint32(di + d.hashOffset)
				}
				d.hash = newH
			}

			d.index = newIndex
			d.byteAvailable = false
			d.length = minMatchLength - 1
			if d.tokens.n == maxFlateBlockTokens {
				// The block includes the current character
				if d.err = d.writeBlock(d.tokens, d.index, false); d.err != nil {
					return
				}
				d.tokens.n = 0
			}
		} else {
			// Reset, if we got a match this run.
			if d.length >= minMatchLength {
				d.ii = 0
			}
			// We have a byte waiting. Emit it.
			if d.byteAvailable {
				d.ii++
				d.tokens.tokens[d.tokens.n] = literalToken(uint32(d.window[d.index-1]))
				d.tokens.n++
				if d.tokens.n == maxFlateBlockTokens {
					if d.err = d.writeBlock(d.tokens, d.index, false); d.err != nil {
						return
					}
					d.tokens.n = 0
				}
				d.index++

				// If we have a long run of no matches, skip additional bytes
				// Resets when d.ii overflows after 64KB.
				if d.ii > 31 {
					n := int(d.ii >> 5)
					for j := 0; j < n; j++ {
						if d.index >= d.windowEnd-1 {
							break
						}

						d.tokens.tokens[d.tokens.n] = literalToken(uint32(d.window[d.index-1]))
						d.tokens.n++
						if d.tokens.n == maxFlateBlockTokens {
							if d.err = d.writeBlock(d.tokens, d.index, false); d.err != nil {
								return
							}
							d.tokens.n = 0
						}
						d.index++
					}
					// Flush last byte
					d.tokens.tokens[d.tokens.n] = literalToken(uint32(d.window[d.index-1]))
					d.tokens.n++
					d.byteAvailable = false
					// d.length = minMatchLength - 1 // not needed, since d.ii is reset above, so it should never be > minMatchLength
					if d.tokens.n == maxFlateBlockTokens {
						if d.err = d.writeBlock(d.tokens, d.index, false); d.err != nil {
							return
						}
						d.tokens.n = 0
					}
				}
			} else {
				d.index++
				d.byteAvailable = true
			}
		}
	}
}

// Assumes that d.fastSkipHashing != skipNever,
// otherwise use deflateLazySSE
func (d *compressor) deflateSSE() {

	// Sanity enables additional runtime tests.
	// It's intended to be used during development
	// to supplement the currently ad-hoc unit tests.
	const sanity = false

	if d.windowEnd-d.index < minMatchLength+maxMatchLength && !d.sync {
		return
	}

	d.maxInsertIndex = d.windowEnd - (minMatchLength - 1)
	if d.index < d.maxInsertIndex {
		d.hash = crc32sse(d.window[d.index:d.index+minMatchLength]) & hashMask
	}

	for {
		if sanity && d.index > d.windowEnd {
			panic("index > windowEnd")
		}
		lookahead := d.windowEnd - d.index
		if lookahead < minMatchLength+maxMatchLength {
			if !d.sync {
				return
			}
			if sanity && d.index > d.windowEnd {
				panic("index > windowEnd")
			}
			if lookahead == 0 {
				if d.tokens.n > 0 {
					if d.err = d.writeBlockSkip(d.tokens, d.index, false); d.err != nil {
						return
					}
					d.tokens.n = 0
				}
				return
			}
		}
		if d.index < d.maxInsertIndex {
			// Update the hash
			d.hash = crc32sse(d.window[d.index:d.index+minMatchLength]) & hashMask
			ch := d.hashHead[d.hash]
			d.chainHead = int(ch)
			d.hashPrev[d.index&windowMask] = ch
			d.hashHead[d.hash] = uint32(d.index + d.hashOffset)
		}
		d.length = minMatchLength - 1
		d.offset = 0
		minIndex := d.index - windowSize
		if minIndex < 0 {
			minIndex = 0
		}

		if d.chainHead-d.hashOffset >= minIndex && lookahead > minMatchLength-1 {
			if newLength, newOffset, ok := d.findMatchSSE(d.index, d.chainHead-d.hashOffset, minMatchLength-1, lookahead); ok {
				d.length = newLength
				d.offset = newOffset
			}
		}
		if d.length >= minMatchLength {
			d.ii = 0
			// There was a match at the previous step, and the current match is
			// not better. Output the previous match.
			// "d.length-3" should NOT be "d.length-minMatchLength", since the format always assume 3
			d.tokens.tokens[d.tokens.n] = matchToken(uint32(d.length-3), uint32(d.offset-minOffsetSize))
			d.tokens.n++
			// Insert in the hash table all strings up to the end of the match.
			// index and index-1 are already inserted. If there is not enough
			// lookahead, the last two strings are not inserted into the hash
			// table.
			if d.length <= d.fastSkipHashing {
				var newIndex int
				newIndex = d.index + d.length
				// Calculate missing hashes
				end := newIndex
				if end > d.maxInsertIndex {
					end = d.maxInsertIndex
				}
				end += minMatchLength - 1
				startindex := d.index + 1
				if startindex > d.maxInsertIndex {
					startindex = d.maxInsertIndex
				}
				tocheck := d.window[startindex:end]
				dstSize := len(tocheck) - minMatchLength + 1
				if dstSize > 0 {
					dst := d.hashMatch[:dstSize]

					crc32sseAll(tocheck, dst)
					var newH uint32
					for i, val := range dst {
						di := i + startindex
						newH = val & hashMask
						// Get previous value with the same hash.
						// Our chain should point to the previous value.
						d.hashPrev[di&windowMask] = d.hashHead[newH]
						// Set the head of the hash chain to us.
						d.hashHead[newH] = uint32(di + d.hashOffset)
					}
					d.hash = newH
				}
				d.index = newIndex
			} else {
				// For matches this long, we don't bother inserting each individual
				// item into the table.
				d.index += d.length
				if d.index < d.maxInsertIndex {
					d.hash = crc32sse(d.window[d.index:d.index+minMatchLength]) & hashMask
				}
			}
			if d.tokens.n == maxFlateBlockTokens {
				// The block includes the current character
				if d.err = d.writeBlockSkip(d.tokens, d.index, false); d.err != nil {
					return
				}
				d.tokens.n = 0
			}
		} else {
			d.ii++
			end := d.index + int(d.ii>>5) + 1
			if end > d.windowEnd {
				end = d.windowEnd
			}
			for i := d.index; i < end; i++ {
				d.tokens.tokens[d.tokens.n] = literalToken(uint32(d.window[i]))
				d.tokens.n++
				if d.tokens.n == maxFlateBlockTokens {
					if d.err = d.writeBlockSkip(d.tokens, i+1, false); d.err != nil {
						return
					}
					d.tokens.n = 0
				}
			}
			d.index = end
		}
	}
}

// deflateLazy is the same as deflate, but with d.fastSkipHashing == skipNever,
// meaning it always has lazy matching on.
func (d *compressor) deflateLazySSE() {
	// Sanity enables additional runtime tests.
	// It's intended to be used during development
	// to supplement the currently ad-hoc unit tests.
	const sanity = false

	if d.windowEnd-d.index < minMatchLength+maxMatchLength && !d.sync {
		return
	}

	d.maxInsertIndex = d.windowEnd - (minMatchLength - 1)
	if d.index < d.maxInsertIndex {
		d.hash = crc32sse(d.window[d.index:d.index+minMatchLength]) & hashMask
	}

	for {
		if sanity && d.index > d.windowEnd {
			panic("index > windowEnd")
		}
		lookahead := d.windowEnd - d.index
		if lookahead < minMatchLength+maxMatchLength {
			if !d.sync {
				return
			}
			if sanity && d.index > d.windowEnd {
				panic("index > windowEnd")
			}
			if lookahead == 0 {
				// Flush current output block if any.
				if d.byteAvailable {
					// There is still one pending token that needs to be flushed
					d.tokens.tokens[d.tokens.n] = literalToken(uint32(d.window[d.index-1]))
					d.tokens.n++
					d.byteAvailable = false
				}
				if d.tokens.n > 0 {
					if d.err = d.writeBlock(d.tokens, d.index, false); d.err != nil {
						return
					}
					d.tokens.n = 0
				}
				return
			}
		}
		if d.index < d.maxInsertIndex {
			// Update the hash
			d.hash = crc32sse(d.window[d.index:d.index+minMatchLength]) & hashMask
			ch := d.hashHead[d.hash]
			d.chainHead = int(ch)
			d.hashPrev[d.index&windowMask] = ch
			d.hashHead[d.hash] = uint32(d.index + d.hashOffset)
		}
		prevLength := d.length
		prevOffset := d.offset
		d.length = minMatchLength - 1
		d.offset = 0
		minIndex := d.index - windowSize
		if minIndex < 0 {
			minIndex = 0
		}

		if d.chainHead-d.hashOffset >= minIndex && lookahead > prevLength && prevLength < d.lazy {
			if newLength, newOffset, ok := d.findMatchSSE(d.index, d.chainHead-d.hashOffset, minMatchLength-1, lookahead); ok {
				d.length = newLength
				d.offset = newOffset
			}
		}
		if prevLength >= minMatchLength && d.length <= prevLength {
			// There was a match at the previous step, and the current match is
			// not better. Output the previous match.
			d.tokens.tokens[d.tokens.n] = matchToken(uint32(prevLength-3), uint32(prevOffset-minOffsetSize))
			d.tokens.n++

			// Insert in the hash table all strings up to the end of the match.
			// index and index-1 are already inserted. If there is not enough
			// lookahead, the last two strings are not inserted into the hash
			// table.
			var newIndex int
			newIndex = d.index + prevLength - 1
			// Calculate missing hashes
			end := newIndex
			if end > d.maxInsertIndex {
				end = d.maxInsertIndex
			}
			end += minMatchLength - 1
			startindex := d.index + 1
			if startindex > d.maxInsertIndex {
				startindex = d.maxInsertIndex
			}
			tocheck := d.window[startindex:end]
			dstSize := len(tocheck) - minMatchLength + 1
			if dstSize > 0 {
				dst := d.hashMatch[:dstSize]
				crc32sseAll(tocheck, dst)
				var newH uint32
				for i, val := range dst {
					di := i + startindex
					newH = val & hashMask
					// Get previous value with the same hash.
					// Our chain should point to the previous value.
					d.hashPrev[di&windowMask] = d.hashHead[newH]
					// Set the head of the hash chain to us.
					d.hashHead[newH] = uint32(di + d.hashOffset)
				}
				d.hash = newH
			}

			d.index = newIndex
			d.byteAvailable = false
			d.length = minMatchLength - 1
			if d.tokens.n == maxFlateBlockTokens {
				// The block includes the current character
				if d.err = d.writeBlock(d.tokens, d.index, false); d.err != nil {
					return
				}
				d.tokens.n = 0
			}
		} else {
			// Reset, if we got a match this run.
			if d.length >= minMatchLength {
				d.ii = 0
			}
			// We have a byte waiting. Emit it.
			if d.byteAvailable {
				d.ii++
				d.tokens.tokens[d.tokens.n] = literalToken(uint32(d.window[d.index-1]))
				d.tokens.n++
				if d.tokens.n == maxFlateBlockTokens {
					if d.err = d.writeBlock(d.tokens, d.index, false); d.err != nil {
						return
					}
					d.tokens.n = 0
				}
				d.index++

				// If we have a long run of no matches, skip additional bytes
				// Resets when d.ii overflows after 64KB.
				if d.ii > 31 {
					n := int(d.ii >> 6)
					for j := 0; j < n; j++ {
						if d.index >= d.windowEnd-1 {
							break
						}

						d.tokens.tokens[d.tokens.n] = literalToken(uint32(d.window[d.index-1]))
						d.tokens.n++
						if d.tokens.n == maxFlateBlockTokens {
							if d.err = d.writeBlock(d.tokens, d.index, false); d.err != nil {
								return
							}
							d.tokens.n = 0
						}
						d.index++
					}
					// Flush last byte
					d.tokens.tokens[d.tokens.n] = literalToken(uint32(d.window[d.index-1]))
					d.tokens.n++
					d.byteAvailable = false
					// d.length = minMatchLength - 1 // not needed, since d.ii is reset above, so it should never be > minMatchLength
					if d.tokens.n == maxFlateBlockTokens {
						if d.err = d.writeBlock(d.tokens, d.index, false); d.err != nil {
							return
						}
						d.tokens.n = 0
					}
				}
			} else {
				d.index++
				d.byteAvailable = true
			}
		}
	}
}

func (d *compressor) store() {
	if d.windowEnd > 0 && (d.windowEnd == maxStoreBlockSize || d.sync) {
		d.err = d.writeStoredBlock(d.window[:d.windowEnd])
		d.windowEnd = 0
	}
}

// fillWindow will fill the buffer with data for huffman-only compression.
// The number of bytes copied is returned.
func (d *compressor) fillBlock(b []byte) int {
	n := copy(d.window[d.windowEnd:], b)
	d.windowEnd += n
	return n
}

// storeHuff will compress and store the currently added data,
// if enough has been accumulated or we at the end of the stream.
// Any error that occurred will be in d.err
func (d *compressor) storeHuff() {
	if d.windowEnd < len(d.window) && !d.sync || d.windowEnd == 0 {
		return
	}
	d.w.writeBlockHuff(false, d.window[:d.windowEnd])
	d.err = d.w.err
	d.windowEnd = 0
}

// storeHuff will compress and store the currently added data,
// if enough has been accumulated or we at the end of the stream.
// Any error that occurred will be in d.err
func (d *compressor) storeSnappy() {
	// We only compress if we have maxStoreBlockSize.
	if d.windowEnd < maxStoreBlockSize {
		if !d.sync {
			return
		}
		// Handle extremely small sizes.
		if d.windowEnd < 128 {
			if d.windowEnd == 0 {
				return
			}
			if d.windowEnd <= 32 {
				d.err = d.writeStoredBlock(d.window[:d.windowEnd])
				d.tokens.n = 0
				d.windowEnd = 0
			} else {
				d.w.writeBlockHuff(false, d.window[:d.windowEnd])
				d.err = d.w.err
			}
			d.tokens.n = 0
			d.windowEnd = 0
			d.snap.Reset()
			return
		}
	}

	d.snap.Encode(&d.tokens, d.window[:d.windowEnd])
	// If we made zero matches, store the block as is.
	if int(d.tokens.n) == d.windowEnd {
		d.err = d.writeStoredBlock(d.window[:d.windowEnd])
		// If we removed less than 1/16th, huffman compress the block.
	} else if int(d.tokens.n) > d.windowEnd-(d.windowEnd>>4) {
		d.w.writeBlockHuff(false, d.window[:d.windowEnd])
		d.err = d.w.err
	} else {
		d.w.writeBlockDynamic(d.tokens.tokens[:d.tokens.n], false, d.window[:d.windowEnd])
		d.err = d.w.err
	}
	d.tokens.n = 0
	d.windowEnd = 0
}

// write will add input byte to the stream.
// Unless an error occurs all bytes will be consumed.
func (d *compressor) write(b []byte) (n int, err error) {
	if d.err != nil {
		return 0, d.err
	}
	n = len(b)
	for len(b) > 0 {
		d.step(d)
		b = b[d.fill(d, b):]
		if d.err != nil {
			return 0, d.err
		}
	}
	return n, d.err
}

func (d *compressor) syncFlush() error {
	d.sync = true
	if d.err != nil {
		return d.err
	}
	d.step(d)
	if d.err == nil {
		d.w.writeStoredHeader(0, false)
		d.w.flush()
		d.err = d.w.err
	}
	d.sync = false
	return d.err
}

func (d *compressor) init(w io.Writer, level int) (err error) {
	d.w = newHuffmanBitWriter(w)

	switch {
	case level == NoCompression:
		d.window = make([]byte, maxStoreBlockSize)
		d.fill = (*compressor).fillBlock
		d.step = (*compressor).store
	case level == ConstantCompression:
		d.window = make([]byte, maxStoreBlockSize)
		d.fill = (*compressor).fillBlock
		d.step = (*compressor).storeHuff
	case level >= 1 && level <= 4:
		d.snap = newSnappy(level)
		d.window = make([]byte, maxStoreBlockSize)
		d.fill = (*compressor).fillBlock
		d.step = (*compressor).storeSnappy
	case level == DefaultCompression:
		level = 5
		fallthrough
	case 5 <= level && level <= 9:
		d.compressionLevel = levels[level]
		d.initDeflate()
		d.fill = (*compressor).fillDeflate
		if d.fastSkipHashing == skipNever {
			if useSSE42 {
				d.step = (*compressor).deflateLazySSE
			} else {
				d.step = (*compressor).deflateLazy
			}
		} else {
			if useSSE42 {
				d.step = (*compressor).deflateSSE
			} else {
				d.step = (*compressor).deflate

			}
		}
	default:
		return fmt.Errorf("flate: invalid compression level %d: want value in range [-2, 9]", level)
	}
	return nil
}

// reset the state of the compressor.
func (d *compressor) reset(w io.Writer) {
	d.w.reset(w)
	d.sync = false
	d.err = nil
	// We only need to reset a few things for Snappy.
	if d.snap != nil {
		d.snap.Reset()
		d.windowEnd = 0
		d.tokens.n = 0
		return
	}
	switch d.compressionLevel.chain {
	case 0:
		// level was NoCompression or ConstantCompresssion.
		d.windowEnd = 0
	default:
		d.chainHead = -1
		for i := range d.hashHead {
			d.hashHead[i] = 0
		}
		for i := range d.hashPrev {
			d.hashPrev[i] = 0
		}
		d.hashOffset = 1
		d.index, d.windowEnd = 0, 0
		d.blockStart, d.byteAvailable = 0, false
		d.tokens.n = 0
		d.length = minMatchLength - 1
		d.offset = 0
		d.hash = 0
		d.ii = 0
		d.maxInsertIndex = 0
	}
}

func (d *compressor) close() error {
	if d.err != nil {
		return d.err
	}
	d.sync = true
	d.step(d)
	if d.err != nil {
		return d.err
	}
	if d.w.writeStoredHeader(0, true); d.w.err != nil {
		return d.w.err
	}
	d.w.flush()
	return d.w.err
}

// NewWriter returns a new Writer compressing data at the given level.
// Following zlib, levels range from 1 (BestSpeed) to 9 (BestCompression);
// higher levels typically run slower but compress more.
// Level 0 (NoCompression) does not attempt any compression; it only adds the
// necessary DEFLATE framing.
// Level -1 (DefaultCompression) uses the default compression level.
// Level -2 (ConstantCompression) will use Huffman compression only, giving
// a very fast compression for all types of input, but sacrificing considerable
// compression efficiency.
//
// If level is in the range [-2, 9] then the error returned will be nil.
// Otherwise the error returned will be non-nil.
func NewWriter(w io.Writer, level int) (*Writer, error) {
	var dw Writer
	if err := dw.d.init(w, level); err != nil {
		return nil, err
	}
	return &dw, nil
}

// NewWriterDict is like NewWriter but initializes the new
// Writer with a preset dictionary.  The returned Writer behaves
// as if the dictionary had been written to it without producing
// any compressed output.  The compressed data written to w
// can only be decompressed by a Reader initialized with the
// same dictionary.
func NewWriterDict(w io.Writer, level int, dict []byte) (*Writer, error) {
	dw := &dictWriter{w}
	zw, err := NewWriter(dw, level)
	if err != nil {
		return nil, err
	}
	zw.d.fillWindow(dict)
	zw.dict = append(zw.dict, dict...) // duplicate dictionary for Reset method.
	return zw, err
}

type dictWriter struct {
	w io.Writer
}

func (w *dictWriter) Write(b []byte) (n int, err error) {
	return w.w.Write(b)
}

// A Writer takes data written to it and writes the compressed
// form of that data to an underlying writer (see NewWriter).
type Writer struct {
	d    compressor
	dict []byte
}

// Write writes data to w, which will eventually write the
// compressed form of data to its underlying writer.
func (w *Writer) Write(data []byte) (n int, err error) {
	return w.d.write(data)
}

// Flush flushes any pending data to the underlying writer.
// It is useful mainly in compressed network protocols, to ensure that
// a remote reader has enough data to reconstruct a packet.
// Flush does not return until the data has been written.
// Calling Flush when there is no pending data still causes the Writer
// to emit a sync marker of at least 4 bytes.
// If the underlying writer returns an error, Flush returns that error.
//
// In the terminology of the zlib library, Flush is equivalent to Z_SYNC_FLUSH.
func (w *Writer) Flush() error {
	// For more about flushing:
	// http://www.bolet.org/~pornin/deflate-flush.html
	return w.d.syncFlush()
}

// Close flushes and closes the writer.
func (w *Writer) Close() error {
	return w.d.close()
}

// Reset discards the writer's state and makes it equivalent to
// the result of NewWriter or NewWriterDict called with dst
// and w's level and dictionary.
func (w *Writer) Reset(dst io.Writer) {
	if dw, ok := w.d.w.writer.(*dictWriter); ok {
		// w was created with NewWriterDict
		dw.w = dst
		w.d.reset(dw)
		w.d.fillWindow(w.dict)
	} else {
		// w was created with NewWriter
		w.d.reset(dst)
	}
}

// ResetDict discards the writer's state and makes it equivalent to
// the result of NewWriter or NewWriterDict called with dst
// and w's level, but sets a specific dictionary.
func (w *Writer) ResetDict(dst io.Writer, dict []byte) {
	w.dict = dict
	w.d.reset(dst)
	w.d.fillWindow(w.dict)
}
