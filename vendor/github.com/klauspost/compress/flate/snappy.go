// Copyright 2011 The Snappy-Go Authors. All rights reserved.
// Modified for deflate by Klaus Post (c) 2015.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package flate

// We limit how far copy back-references can go, the same as the C++ code.
const maxOffset = 1 << 15

// emitLiteral writes a literal chunk and returns the number of bytes written.
func emitLiteral(dst *tokens, lit []byte) {
	ol := dst.n
	for i, v := range lit {
		dst.tokens[i+ol] = token(v)
	}
	dst.n += len(lit)
}

// emitCopy writes a copy chunk and returns the number of bytes written.
func emitCopy(dst *tokens, offset, length int) {
	dst.tokens[dst.n] = matchToken(uint32(length-3), uint32(offset-minOffsetSize))
	dst.n++
}

// snappyEncode uses Snappy-like compression, but stores as Huffman
// blocks.
func snappyEncode(dst *tokens, src []byte) {
	// Return early if src is short.
	if len(src) <= 4 {
		if len(src) != 0 {
			emitLiteral(dst, src)
		}
		return
	}

	// Initialize the hash table. Its size ranges from 1<<8 to 1<<14 inclusive.
	const maxTableSize = 1 << 14
	shift, tableSize := uint(32-8), 1<<8
	for tableSize < maxTableSize && tableSize < len(src) {
		shift--
		tableSize *= 2
	}
	var table [maxTableSize]int
	var misses int
	// Iterate over the source bytes.
	var (
		s   int // The iterator position.
		t   int // The last position with the same hash as s.
		lit int // The start position of any pending literal bytes.
	)
	for s+3 < len(src) {
		// Update the hash table.
		b0, b1, b2, b3 := src[s], src[s+1], src[s+2], src[s+3]
		h := uint32(b0) | uint32(b1)<<8 | uint32(b2)<<16 | uint32(b3)<<24
		p := &table[(h*0x1e35a7bd)>>shift]
		// We need to to store values in [-1, inf) in table. To save
		// some initialization time, (re)use the table's zero value
		// and shift the values against this zero: add 1 on writes,
		// subtract 1 on reads.
		t, *p = *p-1, s+1
		// If t is invalid or src[s:s+4] differs from src[t:t+4], accumulate a literal byte.
		if t < 0 || s-t >= maxOffset || b0 != src[t] || b1 != src[t+1] || b2 != src[t+2] || b3 != src[t+3] {
			misses++
			// Skip 1 byte for 16 consecutive missed.
			s += 1 + (misses >> 4)
			continue
		}
		// Otherwise, we have a match. First, emit any pending literal bytes.
		if lit != s {
			emitLiteral(dst, src[lit:s])
		}
		// Extend the match to be as long as possible.
		s0 := s
		s1 := s + maxMatchLength
		if s1 > len(src) {
			s1 = len(src)
		}
		s, t = s+4, t+4
		for s < s1 && src[s] == src[t] {
			s++
			t++
		}
		misses = 0
		// Emit the copied bytes.
		// inlined: emitCopy(dst, s-t, s-s0)

		dst.tokens[dst.n] = matchToken(uint32(s-s0-3), uint32(s-t-minOffsetSize))
		dst.n++
		lit = s
	}

	// Emit any final pending literal bytes and return.
	if lit != len(src) {
		emitLiteral(dst, src[lit:])
	}
}
