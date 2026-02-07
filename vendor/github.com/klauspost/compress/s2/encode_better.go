// Copyright 2016 The Snappy-Go Authors. All rights reserved.
// Copyright (c) 2019 Klaus Post. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package s2

import (
	"bytes"
	"fmt"
	"math/bits"
)

// hash4 returns the hash of the lowest 4 bytes of u to fit in a hash table with h bits.
// Preferably h should be a constant and should always be <32.
func hash4(u uint64, h uint8) uint32 {
	const prime4bytes = 2654435761
	return (uint32(u) * prime4bytes) >> ((32 - h) & 31)
}

// hash5 returns the hash of the lowest 5 bytes of u to fit in a hash table with h bits.
// Preferably h should be a constant and should always be <64.
func hash5(u uint64, h uint8) uint32 {
	const prime5bytes = 889523592379
	return uint32(((u << (64 - 40)) * prime5bytes) >> ((64 - h) & 63))
}

// hash7 returns the hash of the lowest 7 bytes of u to fit in a hash table with h bits.
// Preferably h should be a constant and should always be <64.
func hash7(u uint64, h uint8) uint32 {
	const prime7bytes = 58295818150454627
	return uint32(((u << (64 - 56)) * prime7bytes) >> ((64 - h) & 63))
}

// hash8 returns the hash of u to fit in a hash table with h bits.
// Preferably h should be a constant and should always be <64.
func hash8(u uint64, h uint8) uint32 {
	const prime8bytes = 0xcf1bbcdcb7a56463
	return uint32((u * prime8bytes) >> ((64 - h) & 63))
}

// encodeBlockBetter encodes a non-empty src to a guaranteed-large-enough dst. It
// assumes that the varint-encoded length of the decompressed bytes has already
// been written.
//
// It also assumes that:
//
//	len(dst) >= MaxEncodedLen(len(src)) &&
//	minNonLiteralBlockSize <= len(src) && len(src) <= maxBlockSize
func encodeBlockBetterGo(dst, src []byte) (d int) {
	// sLimit is when to stop looking for offset/length copies. The inputMargin
	// lets us use a fast path for emitLiteral in the main loop, while we are
	// looking for copies.
	sLimit := len(src) - inputMargin
	if len(src) < minNonLiteralBlockSize {
		return 0
	}

	// Initialize the hash tables.
	const (
		// Long hash matches.
		lTableBits    = 17
		maxLTableSize = 1 << lTableBits

		// Short hash matches.
		sTableBits    = 14
		maxSTableSize = 1 << sTableBits
	)

	var lTable [maxLTableSize]uint32
	var sTable [maxSTableSize]uint32

	// Bail if we can't compress to at least this.
	dstLimit := len(src) - len(src)>>5 - 6

	// nextEmit is where in src the next emitLiteral should start from.
	nextEmit := 0

	// The encoded form must start with a literal, as there are no previous
	// bytes to copy, so we start looking for hash matches at s == 1.
	s := 1
	cv := load64(src, s)

	// We initialize repeat to 0, so we never match on first attempt
	repeat := 0

	for {
		candidateL := 0
		nextS := 0
		for {
			// Next src position to check
			nextS = s + (s-nextEmit)>>7 + 1
			if nextS > sLimit {
				goto emitRemainder
			}
			hashL := hash7(cv, lTableBits)
			hashS := hash4(cv, sTableBits)
			candidateL = int(lTable[hashL])
			candidateS := int(sTable[hashS])
			lTable[hashL] = uint32(s)
			sTable[hashS] = uint32(s)

			valLong := load64(src, candidateL)
			valShort := load64(src, candidateS)

			// If long matches at least 8 bytes, use that.
			if cv == valLong {
				break
			}
			if cv == valShort {
				candidateL = candidateS
				break
			}

			// Check repeat at offset checkRep.
			const checkRep = 1
			// Minimum length of a repeat. Tested with various values.
			// While 4-5 offers improvements in some, 6 reduces
			// regressions significantly.
			const wantRepeatBytes = 6
			const repeatMask = ((1 << (wantRepeatBytes * 8)) - 1) << (8 * checkRep)
			if false && repeat > 0 && cv&repeatMask == load64(src, s-repeat)&repeatMask {
				base := s + checkRep
				// Extend back
				for i := base - repeat; base > nextEmit && i > 0 && src[i-1] == src[base-1]; {
					i--
					base--
				}
				d += emitLiteral(dst[d:], src[nextEmit:base])

				// Extend forward
				candidate := s - repeat + wantRepeatBytes + checkRep
				s += wantRepeatBytes + checkRep
				for s < len(src) {
					if len(src)-s < 8 {
						if src[s] == src[candidate] {
							s++
							candidate++
							continue
						}
						break
					}
					if diff := load64(src, s) ^ load64(src, candidate); diff != 0 {
						s += bits.TrailingZeros64(diff) >> 3
						break
					}
					s += 8
					candidate += 8
				}
				// same as `add := emitCopy(dst[d:], repeat, s-base)` but skips storing offset.
				d += emitRepeat(dst[d:], repeat, s-base)
				nextEmit = s
				if s >= sLimit {
					goto emitRemainder
				}
				// Index in-between
				index0 := base + 1
				index1 := s - 2

				for index0 < index1 {
					cv0 := load64(src, index0)
					cv1 := load64(src, index1)
					lTable[hash7(cv0, lTableBits)] = uint32(index0)
					sTable[hash4(cv0>>8, sTableBits)] = uint32(index0 + 1)

					lTable[hash7(cv1, lTableBits)] = uint32(index1)
					sTable[hash4(cv1>>8, sTableBits)] = uint32(index1 + 1)
					index0 += 2
					index1 -= 2
				}

				cv = load64(src, s)
				continue
			}

			// Long likely matches 7, so take that.
			if uint32(cv) == uint32(valLong) {
				break
			}

			// Check our short candidate
			if uint32(cv) == uint32(valShort) {
				// Try a long candidate at s+1
				hashL = hash7(cv>>8, lTableBits)
				candidateL = int(lTable[hashL])
				lTable[hashL] = uint32(s + 1)
				if uint32(cv>>8) == load32(src, candidateL) {
					s++
					break
				}
				// Use our short candidate.
				candidateL = candidateS
				break
			}

			cv = load64(src, nextS)
			s = nextS
		}

		// Extend backwards
		for candidateL > 0 && s > nextEmit && src[candidateL-1] == src[s-1] {
			candidateL--
			s--
		}

		// Bail if we exceed the maximum size.
		if d+(s-nextEmit) > dstLimit {
			return 0
		}

		base := s
		offset := base - candidateL

		// Extend the 4-byte match as long as possible.
		s += 4
		candidateL += 4
		for s < len(src) {
			if len(src)-s < 8 {
				if src[s] == src[candidateL] {
					s++
					candidateL++
					continue
				}
				break
			}
			if diff := load64(src, s) ^ load64(src, candidateL); diff != 0 {
				s += bits.TrailingZeros64(diff) >> 3
				break
			}
			s += 8
			candidateL += 8
		}

		if offset > 65535 && s-base <= 5 && repeat != offset {
			// Bail if the match is equal or worse to the encoding.
			s = nextS + 1
			if s >= sLimit {
				goto emitRemainder
			}
			cv = load64(src, s)
			continue
		}

		d += emitLiteral(dst[d:], src[nextEmit:base])
		if repeat == offset {
			d += emitRepeat(dst[d:], offset, s-base)
		} else {
			d += emitCopy(dst[d:], offset, s-base)
			repeat = offset
		}

		nextEmit = s
		if s >= sLimit {
			goto emitRemainder
		}

		if d > dstLimit {
			// Do we have space for more, if not bail.
			return 0
		}

		// Index short & long
		index0 := base + 1
		index1 := s - 2

		cv0 := load64(src, index0)
		cv1 := load64(src, index1)
		lTable[hash7(cv0, lTableBits)] = uint32(index0)
		sTable[hash4(cv0>>8, sTableBits)] = uint32(index0 + 1)

		// lTable could be postponed, but very minor difference.
		lTable[hash7(cv1, lTableBits)] = uint32(index1)
		sTable[hash4(cv1>>8, sTableBits)] = uint32(index1 + 1)
		index0 += 1
		index1 -= 1
		cv = load64(src, s)

		// Index large values sparsely in between.
		// We do two starting from different offsets for speed.
		index2 := (index0 + index1 + 1) >> 1
		for index2 < index1 {
			lTable[hash7(load64(src, index0), lTableBits)] = uint32(index0)
			lTable[hash7(load64(src, index2), lTableBits)] = uint32(index2)
			index0 += 2
			index2 += 2
		}
	}

emitRemainder:
	if nextEmit < len(src) {
		// Bail if we exceed the maximum size.
		if d+len(src)-nextEmit > dstLimit {
			return 0
		}
		d += emitLiteral(dst[d:], src[nextEmit:])
	}
	return d
}

// encodeBlockBetterSnappyGo encodes a non-empty src to a guaranteed-large-enough dst. It
// assumes that the varint-encoded length of the decompressed bytes has already
// been written.
//
// It also assumes that:
//
//	len(dst) >= MaxEncodedLen(len(src)) &&
//	minNonLiteralBlockSize <= len(src) && len(src) <= maxBlockSize
func encodeBlockBetterSnappyGo(dst, src []byte) (d int) {
	// sLimit is when to stop looking for offset/length copies. The inputMargin
	// lets us use a fast path for emitLiteral in the main loop, while we are
	// looking for copies.
	sLimit := len(src) - inputMargin
	if len(src) < minNonLiteralBlockSize {
		return 0
	}

	// Initialize the hash tables.
	const (
		// Long hash matches.
		lTableBits    = 16
		maxLTableSize = 1 << lTableBits

		// Short hash matches.
		sTableBits    = 14
		maxSTableSize = 1 << sTableBits
	)

	var lTable [maxLTableSize]uint32
	var sTable [maxSTableSize]uint32

	// Bail if we can't compress to at least this.
	dstLimit := len(src) - len(src)>>5 - 6

	// nextEmit is where in src the next emitLiteral should start from.
	nextEmit := 0

	// The encoded form must start with a literal, as there are no previous
	// bytes to copy, so we start looking for hash matches at s == 1.
	s := 1
	cv := load64(src, s)

	// We initialize repeat to 0, so we never match on first attempt
	repeat := 0
	const maxSkip = 100

	for {
		candidateL := 0
		nextS := 0
		for {
			// Next src position to check
			nextS = min(s+(s-nextEmit)>>7+1, s+maxSkip)

			if nextS > sLimit {
				goto emitRemainder
			}
			hashL := hash7(cv, lTableBits)
			hashS := hash4(cv, sTableBits)
			candidateL = int(lTable[hashL])
			candidateS := int(sTable[hashS])
			lTable[hashL] = uint32(s)
			sTable[hashS] = uint32(s)

			if uint32(cv) == load32(src, candidateL) {
				break
			}

			// Check our short candidate
			if uint32(cv) == load32(src, candidateS) {
				// Try a long candidate at s+1
				hashL = hash7(cv>>8, lTableBits)
				candidateL = int(lTable[hashL])
				lTable[hashL] = uint32(s + 1)
				if uint32(cv>>8) == load32(src, candidateL) {
					s++
					break
				}
				// Use our short candidate.
				candidateL = candidateS
				break
			}

			cv = load64(src, nextS)
			s = nextS
		}

		// Extend backwards
		for candidateL > 0 && s > nextEmit && src[candidateL-1] == src[s-1] {
			candidateL--
			s--
		}

		// Bail if we exceed the maximum size.
		if d+(s-nextEmit) > dstLimit {
			return 0
		}

		base := s
		offset := base - candidateL

		// Extend the 4-byte match as long as possible.
		s += 4
		candidateL += 4
		for s < len(src) {
			if len(src)-s < 8 {
				if src[s] == src[candidateL] {
					s++
					candidateL++
					continue
				}
				break
			}
			if diff := load64(src, s) ^ load64(src, candidateL); diff != 0 {
				s += bits.TrailingZeros64(diff) >> 3
				break
			}
			s += 8
			candidateL += 8
		}

		if offset > 65535 && s-base <= 5 && repeat != offset {
			// Bail if the match is equal or worse to the encoding.
			s = nextS + 1
			if s >= sLimit {
				goto emitRemainder
			}
			cv = load64(src, s)
			continue
		}

		d += emitLiteral(dst[d:], src[nextEmit:base])
		d += emitCopyNoRepeat(dst[d:], offset, s-base)
		repeat = offset

		nextEmit = s
		if s >= sLimit {
			goto emitRemainder
		}

		if d > dstLimit {
			// Do we have space for more, if not bail.
			return 0
		}

		// Index short & long
		index0 := base + 1
		index1 := s - 2

		cv0 := load64(src, index0)
		cv1 := load64(src, index1)
		lTable[hash7(cv0, lTableBits)] = uint32(index0)
		sTable[hash4(cv0>>8, sTableBits)] = uint32(index0 + 1)

		lTable[hash7(cv1, lTableBits)] = uint32(index1)
		sTable[hash4(cv1>>8, sTableBits)] = uint32(index1 + 1)
		index0 += 1
		index1 -= 1
		cv = load64(src, s)

		// Index large values sparsely in between.
		// We do two starting from different offsets for speed.
		index2 := (index0 + index1 + 1) >> 1
		for index2 < index1 {
			lTable[hash7(load64(src, index0), lTableBits)] = uint32(index0)
			lTable[hash7(load64(src, index2), lTableBits)] = uint32(index2)
			index0 += 2
			index2 += 2
		}
	}

emitRemainder:
	if nextEmit < len(src) {
		// Bail if we exceed the maximum size.
		if d+len(src)-nextEmit > dstLimit {
			return 0
		}
		d += emitLiteral(dst[d:], src[nextEmit:])
	}
	return d
}

func encodeBlockBetterGo64K(dst, src []byte) (d int) {
	// sLimit is when to stop looking for offset/length copies. The inputMargin
	// lets us use a fast path for emitLiteral in the main loop, while we are
	// looking for copies.
	sLimit := len(src) - inputMargin
	if len(src) < minNonLiteralBlockSize {
		return 0
	}
	// Initialize the hash tables.
	// Use smaller tables for smaller blocks
	const (
		// Long hash matches.
		lTableBits    = 16
		maxLTableSize = 1 << lTableBits

		// Short hash matches.
		sTableBits    = 13
		maxSTableSize = 1 << sTableBits
	)

	var lTable [maxLTableSize]uint16
	var sTable [maxSTableSize]uint16

	// Bail if we can't compress to at least this.
	dstLimit := len(src) - len(src)>>5 - 6

	// nextEmit is where in src the next emitLiteral should start from.
	nextEmit := 0

	// The encoded form must start with a literal, as there are no previous
	// bytes to copy, so we start looking for hash matches at s == 1.
	s := 1
	cv := load64(src, s)

	// We initialize repeat to 0, so we never match on first attempt
	repeat := 0

	for {
		candidateL := 0
		nextS := 0
		for {
			// Next src position to check
			nextS = s + (s-nextEmit)>>6 + 1
			if nextS > sLimit {
				goto emitRemainder
			}
			hashL := hash7(cv, lTableBits)
			hashS := hash4(cv, sTableBits)
			candidateL = int(lTable[hashL])
			candidateS := int(sTable[hashS])
			lTable[hashL] = uint16(s)
			sTable[hashS] = uint16(s)

			valLong := load64(src, candidateL)
			valShort := load64(src, candidateS)

			// If long matches at least 8 bytes, use that.
			if cv == valLong {
				break
			}
			if cv == valShort {
				candidateL = candidateS
				break
			}

			// Check repeat at offset checkRep.
			const checkRep = 1
			// Minimum length of a repeat. Tested with various values.
			// While 4-5 offers improvements in some, 6 reduces
			// regressions significantly.
			const wantRepeatBytes = 6
			const repeatMask = ((1 << (wantRepeatBytes * 8)) - 1) << (8 * checkRep)
			if false && repeat > 0 && cv&repeatMask == load64(src, s-repeat)&repeatMask {
				base := s + checkRep
				// Extend back
				for i := base - repeat; base > nextEmit && i > 0 && src[i-1] == src[base-1]; {
					i--
					base--
				}
				d += emitLiteral(dst[d:], src[nextEmit:base])

				// Extend forward
				candidate := s - repeat + wantRepeatBytes + checkRep
				s += wantRepeatBytes + checkRep
				for s < len(src) {
					if len(src)-s < 8 {
						if src[s] == src[candidate] {
							s++
							candidate++
							continue
						}
						break
					}
					if diff := load64(src, s) ^ load64(src, candidate); diff != 0 {
						s += bits.TrailingZeros64(diff) >> 3
						break
					}
					s += 8
					candidate += 8
				}
				// same as `add := emitCopy(dst[d:], repeat, s-base)` but skips storing offset.
				d += emitRepeat(dst[d:], repeat, s-base)
				nextEmit = s
				if s >= sLimit {
					goto emitRemainder
				}
				// Index in-between
				index0 := base + 1
				index1 := s - 2

				for index0 < index1 {
					cv0 := load64(src, index0)
					cv1 := load64(src, index1)
					lTable[hash7(cv0, lTableBits)] = uint16(index0)
					sTable[hash4(cv0>>8, sTableBits)] = uint16(index0 + 1)

					lTable[hash7(cv1, lTableBits)] = uint16(index1)
					sTable[hash4(cv1>>8, sTableBits)] = uint16(index1 + 1)
					index0 += 2
					index1 -= 2
				}

				cv = load64(src, s)
				continue
			}

			// Long likely matches 7, so take that.
			if uint32(cv) == uint32(valLong) {
				break
			}

			// Check our short candidate
			if uint32(cv) == uint32(valShort) {
				// Try a long candidate at s+1
				hashL = hash7(cv>>8, lTableBits)
				candidateL = int(lTable[hashL])
				lTable[hashL] = uint16(s + 1)
				if uint32(cv>>8) == load32(src, candidateL) {
					s++
					break
				}
				// Use our short candidate.
				candidateL = candidateS
				break
			}

			cv = load64(src, nextS)
			s = nextS
		}

		// Extend backwards
		for candidateL > 0 && s > nextEmit && src[candidateL-1] == src[s-1] {
			candidateL--
			s--
		}

		// Bail if we exceed the maximum size.
		if d+(s-nextEmit) > dstLimit {
			return 0
		}

		base := s
		offset := base - candidateL

		// Extend the 4-byte match as long as possible.
		s += 4
		candidateL += 4
		for s < len(src) {
			if len(src)-s < 8 {
				if src[s] == src[candidateL] {
					s++
					candidateL++
					continue
				}
				break
			}
			if diff := load64(src, s) ^ load64(src, candidateL); diff != 0 {
				s += bits.TrailingZeros64(diff) >> 3
				break
			}
			s += 8
			candidateL += 8
		}

		d += emitLiteral(dst[d:], src[nextEmit:base])
		if repeat == offset {
			d += emitRepeat(dst[d:], offset, s-base)
		} else {
			d += emitCopy(dst[d:], offset, s-base)
			repeat = offset
		}

		nextEmit = s
		if s >= sLimit {
			goto emitRemainder
		}

		if d > dstLimit {
			// Do we have space for more, if not bail.
			return 0
		}

		// Index short & long
		index0 := base + 1
		index1 := s - 2

		cv0 := load64(src, index0)
		cv1 := load64(src, index1)
		lTable[hash7(cv0, lTableBits)] = uint16(index0)
		sTable[hash4(cv0>>8, sTableBits)] = uint16(index0 + 1)

		// lTable could be postponed, but very minor difference.
		lTable[hash7(cv1, lTableBits)] = uint16(index1)
		sTable[hash4(cv1>>8, sTableBits)] = uint16(index1 + 1)
		index0 += 1
		index1 -= 1
		cv = load64(src, s)

		// Index large values sparsely in between.
		// We do two starting from different offsets for speed.
		index2 := (index0 + index1 + 1) >> 1
		for index2 < index1 {
			lTable[hash7(load64(src, index0), lTableBits)] = uint16(index0)
			lTable[hash7(load64(src, index2), lTableBits)] = uint16(index2)
			index0 += 2
			index2 += 2
		}
	}

emitRemainder:
	if nextEmit < len(src) {
		// Bail if we exceed the maximum size.
		if d+len(src)-nextEmit > dstLimit {
			return 0
		}
		d += emitLiteral(dst[d:], src[nextEmit:])
	}
	return d
}

// encodeBlockBetterSnappyGo encodes a non-empty src to a guaranteed-large-enough dst. It
// assumes that the varint-encoded length of the decompressed bytes has already
// been written.
//
// It also assumes that:
//
//	len(dst) >= MaxEncodedLen(len(src)) &&
//	minNonLiteralBlockSize <= len(src) && len(src) <= maxBlockSize
func encodeBlockBetterSnappyGo64K(dst, src []byte) (d int) {
	// sLimit is when to stop looking for offset/length copies. The inputMargin
	// lets us use a fast path for emitLiteral in the main loop, while we are
	// looking for copies.
	sLimit := len(src) - inputMargin
	if len(src) < minNonLiteralBlockSize {
		return 0
	}

	// Initialize the hash tables.
	// Use smaller tables for smaller blocks
	const (
		// Long hash matches.
		lTableBits    = 15
		maxLTableSize = 1 << lTableBits

		// Short hash matches.
		sTableBits    = 13
		maxSTableSize = 1 << sTableBits
	)

	var lTable [maxLTableSize]uint16
	var sTable [maxSTableSize]uint16

	// Bail if we can't compress to at least this.
	dstLimit := len(src) - len(src)>>5 - 6

	// nextEmit is where in src the next emitLiteral should start from.
	nextEmit := 0

	// The encoded form must start with a literal, as there are no previous
	// bytes to copy, so we start looking for hash matches at s == 1.
	s := 1
	cv := load64(src, s)

	const maxSkip = 100

	for {
		candidateL := 0
		nextS := 0
		for {
			// Next src position to check
			nextS = min(s+(s-nextEmit)>>6+1, s+maxSkip)

			if nextS > sLimit {
				goto emitRemainder
			}
			hashL := hash7(cv, lTableBits)
			hashS := hash4(cv, sTableBits)
			candidateL = int(lTable[hashL])
			candidateS := int(sTable[hashS])
			lTable[hashL] = uint16(s)
			sTable[hashS] = uint16(s)

			if uint32(cv) == load32(src, candidateL) {
				break
			}

			// Check our short candidate
			if uint32(cv) == load32(src, candidateS) {
				// Try a long candidate at s+1
				hashL = hash7(cv>>8, lTableBits)
				candidateL = int(lTable[hashL])
				lTable[hashL] = uint16(s + 1)
				if uint32(cv>>8) == load32(src, candidateL) {
					s++
					break
				}
				// Use our short candidate.
				candidateL = candidateS
				break
			}

			cv = load64(src, nextS)
			s = nextS
		}

		// Extend backwards
		for candidateL > 0 && s > nextEmit && src[candidateL-1] == src[s-1] {
			candidateL--
			s--
		}

		// Bail if we exceed the maximum size.
		if d+(s-nextEmit) > dstLimit {
			return 0
		}

		base := s
		offset := base - candidateL

		// Extend the 4-byte match as long as possible.
		s += 4
		candidateL += 4
		for s < len(src) {
			if len(src)-s < 8 {
				if src[s] == src[candidateL] {
					s++
					candidateL++
					continue
				}
				break
			}
			if diff := load64(src, s) ^ load64(src, candidateL); diff != 0 {
				s += bits.TrailingZeros64(diff) >> 3
				break
			}
			s += 8
			candidateL += 8
		}

		d += emitLiteral(dst[d:], src[nextEmit:base])
		d += emitCopyNoRepeat(dst[d:], offset, s-base)

		nextEmit = s
		if s >= sLimit {
			goto emitRemainder
		}

		if d > dstLimit {
			// Do we have space for more, if not bail.
			return 0
		}

		// Index short & long
		index0 := base + 1
		index1 := s - 2

		cv0 := load64(src, index0)
		cv1 := load64(src, index1)
		lTable[hash7(cv0, lTableBits)] = uint16(index0)
		sTable[hash4(cv0>>8, sTableBits)] = uint16(index0 + 1)

		lTable[hash7(cv1, lTableBits)] = uint16(index1)
		sTable[hash4(cv1>>8, sTableBits)] = uint16(index1 + 1)
		index0 += 1
		index1 -= 1
		cv = load64(src, s)

		// Index large values sparsely in between.
		// We do two starting from different offsets for speed.
		index2 := (index0 + index1 + 1) >> 1
		for index2 < index1 {
			lTable[hash7(load64(src, index0), lTableBits)] = uint16(index0)
			lTable[hash7(load64(src, index2), lTableBits)] = uint16(index2)
			index0 += 2
			index2 += 2
		}
	}

emitRemainder:
	if nextEmit < len(src) {
		// Bail if we exceed the maximum size.
		if d+len(src)-nextEmit > dstLimit {
			return 0
		}
		d += emitLiteral(dst[d:], src[nextEmit:])
	}
	return d
}

// encodeBlockBetterDict encodes a non-empty src to a guaranteed-large-enough dst. It
// assumes that the varint-encoded length of the decompressed bytes has already
// been written.
//
// It also assumes that:
//
//	len(dst) >= MaxEncodedLen(len(src)) &&
//	minNonLiteralBlockSize <= len(src) && len(src) <= maxBlockSize
func encodeBlockBetterDict(dst, src []byte, dict *Dict) (d int) {
	// sLimit is when to stop looking for offset/length copies. The inputMargin
	// lets us use a fast path for emitLiteral in the main loop, while we are
	// looking for copies.
	// Initialize the hash tables.
	const (
		// Long hash matches.
		lTableBits    = 17
		maxLTableSize = 1 << lTableBits

		// Short hash matches.
		sTableBits    = 14
		maxSTableSize = 1 << sTableBits

		maxAhead = 8 // maximum bytes ahead without checking sLimit

		debug = false
	)

	sLimit := min(len(src)-inputMargin, MaxDictSrcOffset-maxAhead)
	if len(src) < minNonLiteralBlockSize {
		return 0
	}

	dict.initBetter()

	var lTable [maxLTableSize]uint32
	var sTable [maxSTableSize]uint32

	// Bail if we can't compress to at least this.
	dstLimit := len(src) - len(src)>>5 - 6

	// nextEmit is where in src the next emitLiteral should start from.
	nextEmit := 0

	// The encoded form must start with a literal, as there are no previous
	// bytes to copy, so we start looking for hash matches at s == 1.
	s := 0
	cv := load64(src, s)

	// We initialize repeat to 0, so we never match on first attempt
	repeat := len(dict.dict) - dict.repeat

	// While in dict
searchDict:
	for {
		candidateL := 0
		nextS := 0
		for {
			// Next src position to check
			nextS = s + (s-nextEmit)>>7 + 1
			if nextS > sLimit {
				break searchDict
			}
			hashL := hash7(cv, lTableBits)
			hashS := hash4(cv, sTableBits)
			candidateL = int(lTable[hashL])
			candidateS := int(sTable[hashS])
			dictL := int(dict.betterTableLong[hashL])
			dictS := int(dict.betterTableShort[hashS])
			lTable[hashL] = uint32(s)
			sTable[hashS] = uint32(s)

			valLong := load64(src, candidateL)
			valShort := load64(src, candidateS)

			// If long matches at least 8 bytes, use that.
			if s != 0 {
				if cv == valLong {
					goto emitMatch
				}
				if cv == valShort {
					candidateL = candidateS
					goto emitMatch
				}
			}

			// Check dict repeat.
			if repeat >= s+4 {
				candidate := len(dict.dict) - repeat + s
				if candidate > 0 && uint32(cv) == load32(dict.dict, candidate) {
					// Extend back
					base := s
					for i := candidate; base > nextEmit && i > 0 && dict.dict[i-1] == src[base-1]; {
						i--
						base--
					}
					d += emitLiteral(dst[d:], src[nextEmit:base])
					if debug && nextEmit != base {
						fmt.Println("emitted ", base-nextEmit, "literals")
					}
					s += 4
					candidate += 4
					for candidate < len(dict.dict)-8 && s <= len(src)-8 {
						if diff := load64(src, s) ^ load64(dict.dict, candidate); diff != 0 {
							s += bits.TrailingZeros64(diff) >> 3
							break
						}
						s += 8
						candidate += 8
					}
					d += emitRepeat(dst[d:], repeat, s-base)
					if debug {
						fmt.Println("emitted dict repeat length", s-base, "offset:", repeat, "s:", s)
					}
					nextEmit = s
					if s >= sLimit {
						break searchDict
					}
					// Index in-between
					index0 := base + 1
					index1 := s - 2

					cv = load64(src, s)
					for index0 < index1 {
						cv0 := load64(src, index0)
						cv1 := load64(src, index1)
						lTable[hash7(cv0, lTableBits)] = uint32(index0)
						sTable[hash4(cv0>>8, sTableBits)] = uint32(index0 + 1)

						lTable[hash7(cv1, lTableBits)] = uint32(index1)
						sTable[hash4(cv1>>8, sTableBits)] = uint32(index1 + 1)
						index0 += 2
						index1 -= 2
					}
					continue
				}
			}
			// Don't try to find match at s==0
			if s == 0 {
				cv = load64(src, nextS)
				s = nextS
				continue
			}

			// Long likely matches 7, so take that.
			if uint32(cv) == uint32(valLong) {
				goto emitMatch
			}

			// Long dict...
			if uint32(cv) == load32(dict.dict, dictL) {
				candidateL = dictL
				goto emitDict
			}

			// Check our short candidate
			if uint32(cv) == uint32(valShort) {
				// Try a long candidate at s+1
				hashL = hash7(cv>>8, lTableBits)
				candidateL = int(lTable[hashL])
				lTable[hashL] = uint32(s + 1)
				if uint32(cv>>8) == load32(src, candidateL) {
					s++
					goto emitMatch
				}
				// Use our short candidate.
				candidateL = candidateS
				goto emitMatch
			}
			if uint32(cv) == load32(dict.dict, dictS) {
				// Try a long candidate at s+1
				hashL = hash7(cv>>8, lTableBits)
				candidateL = int(lTable[hashL])
				lTable[hashL] = uint32(s + 1)
				if uint32(cv>>8) == load32(src, candidateL) {
					s++
					goto emitMatch
				}
				candidateL = dictS
				goto emitDict
			}
			cv = load64(src, nextS)
			s = nextS
		}
	emitDict:
		{
			if debug {
				if load32(dict.dict, candidateL) != load32(src, s) {
					panic("dict emit mismatch")
				}
			}
			// Extend backwards.
			// The top bytes will be rechecked to get the full match.
			for candidateL > 0 && s > nextEmit && dict.dict[candidateL-1] == src[s-1] {
				candidateL--
				s--
			}

			// Bail if we exceed the maximum size.
			if d+(s-nextEmit) > dstLimit {
				return 0
			}

			// A 4-byte match has been found. We'll later see if more than 4 bytes
			// match. But, prior to the match, src[nextEmit:s] are unmatched. Emit
			// them as literal bytes.

			d += emitLiteral(dst[d:], src[nextEmit:s])
			if debug && nextEmit != s {
				fmt.Println("emitted ", s-nextEmit, "literals")
			}
			{
				// Invariant: we have a 4-byte match at s, and no need to emit any
				// literal bytes prior to s.
				base := s
				offset := s + (len(dict.dict)) - candidateL

				// Extend the 4-byte match as long as possible.
				s += 4
				candidateL += 4
				for s <= len(src)-8 && len(dict.dict)-candidateL >= 8 {
					if diff := load64(src, s) ^ load64(dict.dict, candidateL); diff != 0 {
						s += bits.TrailingZeros64(diff) >> 3
						break
					}
					s += 8
					candidateL += 8
				}

				if repeat == offset {
					if debug {
						fmt.Println("emitted dict repeat, length", s-base, "offset:", offset, "s:", s, "dict offset:", candidateL)
					}
					d += emitRepeat(dst[d:], offset, s-base)
				} else {
					if debug {
						fmt.Println("emitted dict copy, length", s-base, "offset:", offset, "s:", s, "dict offset:", candidateL)
					}
					// Matches longer than 64 are split.
					if s <= sLimit || s-base < 8 {
						d += emitCopy(dst[d:], offset, s-base)
					} else {
						// Split to ensure we don't start a copy within next block.
						d += emitCopy(dst[d:], offset, 4)
						d += emitRepeat(dst[d:], offset, s-base-4)
					}
					repeat = offset
				}
				if false {
					// Validate match.
					if s <= candidateL {
						panic("s <= candidate")
					}
					a := src[base:s]
					b := dict.dict[base-repeat : base-repeat+(s-base)]
					if !bytes.Equal(a, b) {
						panic("mismatch")
					}
				}

				nextEmit = s
				if s >= sLimit {
					break searchDict
				}

				if d > dstLimit {
					// Do we have space for more, if not bail.
					return 0
				}

				// Index short & long
				index0 := base + 1
				index1 := s - 2

				cv0 := load64(src, index0)
				cv1 := load64(src, index1)
				lTable[hash7(cv0, lTableBits)] = uint32(index0)
				sTable[hash4(cv0>>8, sTableBits)] = uint32(index0 + 1)

				lTable[hash7(cv1, lTableBits)] = uint32(index1)
				sTable[hash4(cv1>>8, sTableBits)] = uint32(index1 + 1)
				index0 += 1
				index1 -= 1
				cv = load64(src, s)

				// index every second long in between.
				for index0 < index1 {
					lTable[hash7(load64(src, index0), lTableBits)] = uint32(index0)
					lTable[hash7(load64(src, index1), lTableBits)] = uint32(index1)
					index0 += 2
					index1 -= 2
				}
			}
			continue
		}
	emitMatch:

		// Extend backwards
		for candidateL > 0 && s > nextEmit && src[candidateL-1] == src[s-1] {
			candidateL--
			s--
		}

		// Bail if we exceed the maximum size.
		if d+(s-nextEmit) > dstLimit {
			return 0
		}

		base := s
		offset := base - candidateL

		// Extend the 4-byte match as long as possible.
		s += 4
		candidateL += 4
		for s < len(src) {
			if len(src)-s < 8 {
				if src[s] == src[candidateL] {
					s++
					candidateL++
					continue
				}
				break
			}
			if diff := load64(src, s) ^ load64(src, candidateL); diff != 0 {
				s += bits.TrailingZeros64(diff) >> 3
				break
			}
			s += 8
			candidateL += 8
		}

		if offset > 65535 && s-base <= 5 && repeat != offset {
			// Bail if the match is equal or worse to the encoding.
			s = nextS + 1
			if s >= sLimit {
				goto emitRemainder
			}
			cv = load64(src, s)
			continue
		}

		d += emitLiteral(dst[d:], src[nextEmit:base])
		if debug && nextEmit != s {
			fmt.Println("emitted ", s-nextEmit, "literals")
		}
		if repeat == offset {
			if debug {
				fmt.Println("emitted match repeat, length", s-base, "offset:", offset, "s:", s)
			}
			d += emitRepeat(dst[d:], offset, s-base)
		} else {
			if debug {
				fmt.Println("emitted match copy, length", s-base, "offset:", offset, "s:", s)
			}
			d += emitCopy(dst[d:], offset, s-base)
			repeat = offset
		}

		nextEmit = s
		if s >= sLimit {
			goto emitRemainder
		}

		if d > dstLimit {
			// Do we have space for more, if not bail.
			return 0
		}

		// Index short & long
		index0 := base + 1
		index1 := s - 2

		cv0 := load64(src, index0)
		cv1 := load64(src, index1)
		lTable[hash7(cv0, lTableBits)] = uint32(index0)
		sTable[hash4(cv0>>8, sTableBits)] = uint32(index0 + 1)

		lTable[hash7(cv1, lTableBits)] = uint32(index1)
		sTable[hash4(cv1>>8, sTableBits)] = uint32(index1 + 1)
		index0 += 1
		index1 -= 1
		cv = load64(src, s)

		// Index large values sparsely in between.
		// We do two starting from different offsets for speed.
		index2 := (index0 + index1 + 1) >> 1
		for index2 < index1 {
			lTable[hash7(load64(src, index0), lTableBits)] = uint32(index0)
			lTable[hash7(load64(src, index2), lTableBits)] = uint32(index2)
			index0 += 2
			index2 += 2
		}
	}

	// Search without dict:
	if repeat > s {
		repeat = 0
	}

	// No more dict
	sLimit = len(src) - inputMargin
	if s >= sLimit {
		goto emitRemainder
	}
	cv = load64(src, s)
	if debug {
		fmt.Println("now", s, "->", sLimit, "out:", d, "left:", len(src)-s, "nextemit:", nextEmit, "dstLimit:", dstLimit, "s:", s)
	}
	for {
		candidateL := 0
		nextS := 0
		for {
			// Next src position to check
			nextS = s + (s-nextEmit)>>7 + 1
			if nextS > sLimit {
				goto emitRemainder
			}
			hashL := hash7(cv, lTableBits)
			hashS := hash4(cv, sTableBits)
			candidateL = int(lTable[hashL])
			candidateS := int(sTable[hashS])
			lTable[hashL] = uint32(s)
			sTable[hashS] = uint32(s)

			valLong := load64(src, candidateL)
			valShort := load64(src, candidateS)

			// If long matches at least 8 bytes, use that.
			if cv == valLong {
				break
			}
			if cv == valShort {
				candidateL = candidateS
				break
			}

			// Check repeat at offset checkRep.
			const checkRep = 1
			// Minimum length of a repeat. Tested with various values.
			// While 4-5 offers improvements in some, 6 reduces
			// regressions significantly.
			const wantRepeatBytes = 6
			const repeatMask = ((1 << (wantRepeatBytes * 8)) - 1) << (8 * checkRep)
			if false && repeat > 0 && cv&repeatMask == load64(src, s-repeat)&repeatMask {
				base := s + checkRep
				// Extend back
				for i := base - repeat; base > nextEmit && i > 0 && src[i-1] == src[base-1]; {
					i--
					base--
				}
				d += emitLiteral(dst[d:], src[nextEmit:base])

				// Extend forward
				candidate := s - repeat + wantRepeatBytes + checkRep
				s += wantRepeatBytes + checkRep
				for s < len(src) {
					if len(src)-s < 8 {
						if src[s] == src[candidate] {
							s++
							candidate++
							continue
						}
						break
					}
					if diff := load64(src, s) ^ load64(src, candidate); diff != 0 {
						s += bits.TrailingZeros64(diff) >> 3
						break
					}
					s += 8
					candidate += 8
				}
				// same as `add := emitCopy(dst[d:], repeat, s-base)` but skips storing offset.
				d += emitRepeat(dst[d:], repeat, s-base)
				nextEmit = s
				if s >= sLimit {
					goto emitRemainder
				}
				// Index in-between
				index0 := base + 1
				index1 := s - 2

				for index0 < index1 {
					cv0 := load64(src, index0)
					cv1 := load64(src, index1)
					lTable[hash7(cv0, lTableBits)] = uint32(index0)
					sTable[hash4(cv0>>8, sTableBits)] = uint32(index0 + 1)

					lTable[hash7(cv1, lTableBits)] = uint32(index1)
					sTable[hash4(cv1>>8, sTableBits)] = uint32(index1 + 1)
					index0 += 2
					index1 -= 2
				}

				cv = load64(src, s)
				continue
			}

			// Long likely matches 7, so take that.
			if uint32(cv) == uint32(valLong) {
				break
			}

			// Check our short candidate
			if uint32(cv) == uint32(valShort) {
				// Try a long candidate at s+1
				hashL = hash7(cv>>8, lTableBits)
				candidateL = int(lTable[hashL])
				lTable[hashL] = uint32(s + 1)
				if uint32(cv>>8) == load32(src, candidateL) {
					s++
					break
				}
				// Use our short candidate.
				candidateL = candidateS
				break
			}

			cv = load64(src, nextS)
			s = nextS
		}

		// Extend backwards
		for candidateL > 0 && s > nextEmit && src[candidateL-1] == src[s-1] {
			candidateL--
			s--
		}

		// Bail if we exceed the maximum size.
		if d+(s-nextEmit) > dstLimit {
			return 0
		}

		base := s
		offset := base - candidateL

		// Extend the 4-byte match as long as possible.
		s += 4
		candidateL += 4
		for s < len(src) {
			if len(src)-s < 8 {
				if src[s] == src[candidateL] {
					s++
					candidateL++
					continue
				}
				break
			}
			if diff := load64(src, s) ^ load64(src, candidateL); diff != 0 {
				s += bits.TrailingZeros64(diff) >> 3
				break
			}
			s += 8
			candidateL += 8
		}

		if offset > 65535 && s-base <= 5 && repeat != offset {
			// Bail if the match is equal or worse to the encoding.
			s = nextS + 1
			if s >= sLimit {
				goto emitRemainder
			}
			cv = load64(src, s)
			continue
		}

		d += emitLiteral(dst[d:], src[nextEmit:base])
		if repeat == offset {
			d += emitRepeat(dst[d:], offset, s-base)
		} else {
			d += emitCopy(dst[d:], offset, s-base)
			repeat = offset
		}

		nextEmit = s
		if s >= sLimit {
			goto emitRemainder
		}

		if d > dstLimit {
			// Do we have space for more, if not bail.
			return 0
		}

		// Index short & long
		index0 := base + 1
		index1 := s - 2

		cv0 := load64(src, index0)
		cv1 := load64(src, index1)
		lTable[hash7(cv0, lTableBits)] = uint32(index0)
		sTable[hash4(cv0>>8, sTableBits)] = uint32(index0 + 1)

		lTable[hash7(cv1, lTableBits)] = uint32(index1)
		sTable[hash4(cv1>>8, sTableBits)] = uint32(index1 + 1)
		index0 += 1
		index1 -= 1
		cv = load64(src, s)

		// Index large values sparsely in between.
		// We do two starting from different offsets for speed.
		index2 := (index0 + index1 + 1) >> 1
		for index2 < index1 {
			lTable[hash7(load64(src, index0), lTableBits)] = uint32(index0)
			lTable[hash7(load64(src, index2), lTableBits)] = uint32(index2)
			index0 += 2
			index2 += 2
		}
	}

emitRemainder:
	if nextEmit < len(src) {
		// Bail if we exceed the maximum size.
		if d+len(src)-nextEmit > dstLimit {
			return 0
		}
		d += emitLiteral(dst[d:], src[nextEmit:])
	}
	return d
}
