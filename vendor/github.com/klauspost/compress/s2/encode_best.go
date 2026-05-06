// Copyright 2016 The Snappy-Go Authors. All rights reserved.
// Copyright (c) 2019 Klaus Post. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package s2

import (
	"fmt"
	"math"
	"math/bits"
)

// encodeBlockBest encodes a non-empty src to a guaranteed-large-enough dst. It
// assumes that the varint-encoded length of the decompressed bytes has already
// been written.
//
// It also assumes that:
//
//	len(dst) >= MaxEncodedLen(len(src)) &&
//	minNonLiteralBlockSize <= len(src) && len(src) <= maxBlockSize
func encodeBlockBest(dst, src []byte, dict *Dict) (d int) {
	// Initialize the hash tables.
	const (
		// Long hash matches.
		lTableBits    = 19
		maxLTableSize = 1 << lTableBits

		// Short hash matches.
		sTableBits    = 16
		maxSTableSize = 1 << sTableBits

		inputMargin = 8 + 2

		debug = false
	)

	// sLimit is when to stop looking for offset/length copies. The inputMargin
	// lets us use a fast path for emitLiteral in the main loop, while we are
	// looking for copies.
	sLimit := len(src) - inputMargin
	if len(src) < minNonLiteralBlockSize {
		return 0
	}
	sLimitDict := len(src) - inputMargin
	if sLimitDict > MaxDictSrcOffset-inputMargin {
		sLimitDict = MaxDictSrcOffset - inputMargin
	}

	var lTable [maxLTableSize]uint64
	var sTable [maxSTableSize]uint64

	// Bail if we can't compress to at least this.
	dstLimit := len(src) - 5

	// nextEmit is where in src the next emitLiteral should start from.
	nextEmit := 0

	// The encoded form must start with a literal, as there are no previous
	// bytes to copy, so we start looking for hash matches at s == 1.
	s := 1
	repeat := 1
	if dict != nil {
		dict.initBest()
		s = 0
		repeat = len(dict.dict) - dict.repeat
	}
	cv := load64(src, s)

	// We search for a repeat at -1, but don't output repeats when nextEmit == 0
	const lowbitMask = 0xffffffff
	getCur := func(x uint64) int {
		return int(x & lowbitMask)
	}
	getPrev := func(x uint64) int {
		return int(x >> 32)
	}
	const maxSkip = 64

	for {
		type match struct {
			offset    int
			s         int
			length    int
			score     int
			rep, dict bool
		}
		var best match
		for {
			// Next src position to check
			nextS := (s-nextEmit)>>8 + 1
			if nextS > maxSkip {
				nextS = s + maxSkip
			} else {
				nextS += s
			}
			if nextS > sLimit {
				goto emitRemainder
			}
			if dict != nil && s >= MaxDictSrcOffset {
				dict = nil
				if repeat > s {
					repeat = math.MinInt32
				}
			}
			hashL := hash8(cv, lTableBits)
			hashS := hash4(cv, sTableBits)
			candidateL := lTable[hashL]
			candidateS := sTable[hashS]

			score := func(m match) int {
				// Matches that are longer forward are penalized since we must emit it as a literal.
				score := m.length - m.s
				if nextEmit == m.s {
					// If we do not have to emit literals, we save 1 byte
					score++
				}
				offset := m.s - m.offset
				if m.rep {
					return score - emitRepeatSize(offset, m.length)
				}
				return score - emitCopySize(offset, m.length)
			}

			matchAt := func(offset, s int, first uint32, rep bool) match {
				if best.length != 0 && best.s-best.offset == s-offset {
					// Don't retest if we have the same offset.
					return match{offset: offset, s: s}
				}
				if load32(src, offset) != first {
					return match{offset: offset, s: s}
				}
				m := match{offset: offset, s: s, length: 4 + offset, rep: rep}
				s += 4
				for s < len(src) {
					if len(src)-s < 8 {
						if src[s] == src[m.length] {
							m.length++
							s++
							continue
						}
						break
					}
					if diff := load64(src, s) ^ load64(src, m.length); diff != 0 {
						m.length += bits.TrailingZeros64(diff) >> 3
						break
					}
					s += 8
					m.length += 8
				}
				m.length -= offset
				m.score = score(m)
				if m.score <= -m.s {
					// Eliminate if no savings, we might find a better one.
					m.length = 0
				}
				return m
			}
			matchDict := func(candidate, s int, first uint32, rep bool) match {
				if s >= MaxDictSrcOffset {
					return match{offset: candidate, s: s}
				}
				// Calculate offset as if in continuous array with s
				offset := -len(dict.dict) + candidate
				if best.length != 0 && best.s-best.offset == s-offset && !rep {
					// Don't retest if we have the same offset.
					return match{offset: offset, s: s}
				}

				if load32(dict.dict, candidate) != first {
					return match{offset: offset, s: s}
				}
				m := match{offset: offset, s: s, length: 4 + candidate, rep: rep, dict: true}
				s += 4
				if !rep {
					for s < sLimitDict && m.length < len(dict.dict) {
						if len(src)-s < 8 || len(dict.dict)-m.length < 8 {
							if src[s] == dict.dict[m.length] {
								m.length++
								s++
								continue
							}
							break
						}
						if diff := load64(src, s) ^ load64(dict.dict, m.length); diff != 0 {
							m.length += bits.TrailingZeros64(diff) >> 3
							break
						}
						s += 8
						m.length += 8
					}
				} else {
					for s < len(src) && m.length < len(dict.dict) {
						if len(src)-s < 8 || len(dict.dict)-m.length < 8 {
							if src[s] == dict.dict[m.length] {
								m.length++
								s++
								continue
							}
							break
						}
						if diff := load64(src, s) ^ load64(dict.dict, m.length); diff != 0 {
							m.length += bits.TrailingZeros64(diff) >> 3
							break
						}
						s += 8
						m.length += 8
					}
				}
				m.length -= candidate
				m.score = score(m)
				if m.score <= -m.s {
					// Eliminate if no savings, we might find a better one.
					m.length = 0
				}
				return m
			}

			bestOf := func(a, b match) match {
				if b.length == 0 {
					return a
				}
				if a.length == 0 {
					return b
				}
				as := a.score + b.s
				bs := b.score + a.s
				if as >= bs {
					return a
				}
				return b
			}

			if s > 0 {
				best = bestOf(matchAt(getCur(candidateL), s, uint32(cv), false), matchAt(getPrev(candidateL), s, uint32(cv), false))
				best = bestOf(best, matchAt(getCur(candidateS), s, uint32(cv), false))
				best = bestOf(best, matchAt(getPrev(candidateS), s, uint32(cv), false))
			}
			if dict != nil {
				candidateL := dict.bestTableLong[hashL]
				candidateS := dict.bestTableShort[hashS]
				best = bestOf(best, matchDict(int(candidateL&0xffff), s, uint32(cv), false))
				best = bestOf(best, matchDict(int(candidateL>>16), s, uint32(cv), false))
				best = bestOf(best, matchDict(int(candidateS&0xffff), s, uint32(cv), false))
				best = bestOf(best, matchDict(int(candidateS>>16), s, uint32(cv), false))
			}
			{
				if (dict == nil || repeat <= s) && repeat > 0 {
					best = bestOf(best, matchAt(s-repeat+1, s+1, uint32(cv>>8), true))
				} else if s-repeat < -4 && dict != nil {
					candidate := len(dict.dict) - (repeat - s)
					best = bestOf(best, matchDict(candidate, s, uint32(cv), true))
					candidate++
					best = bestOf(best, matchDict(candidate, s+1, uint32(cv>>8), true))
				}

				if best.length > 0 {
					hashS := hash4(cv>>8, sTableBits)
					// s+1
					nextShort := sTable[hashS]
					s := s + 1
					cv := load64(src, s)
					hashL := hash8(cv, lTableBits)
					nextLong := lTable[hashL]
					best = bestOf(best, matchAt(getCur(nextShort), s, uint32(cv), false))
					best = bestOf(best, matchAt(getPrev(nextShort), s, uint32(cv), false))
					best = bestOf(best, matchAt(getCur(nextLong), s, uint32(cv), false))
					best = bestOf(best, matchAt(getPrev(nextLong), s, uint32(cv), false))

					// Dict at + 1
					if dict != nil {
						candidateL := dict.bestTableLong[hashL]
						candidateS := dict.bestTableShort[hashS]

						best = bestOf(best, matchDict(int(candidateL&0xffff), s, uint32(cv), false))
						best = bestOf(best, matchDict(int(candidateS&0xffff), s, uint32(cv), false))
					}

					// s+2
					if true {
						hashS := hash4(cv>>8, sTableBits)

						nextShort = sTable[hashS]
						s++
						cv = load64(src, s)
						hashL := hash8(cv, lTableBits)
						nextLong = lTable[hashL]

						if (dict == nil || repeat <= s) && repeat > 0 {
							// Repeat at + 2
							best = bestOf(best, matchAt(s-repeat, s, uint32(cv), true))
						} else if repeat-s > 4 && dict != nil {
							candidate := len(dict.dict) - (repeat - s)
							best = bestOf(best, matchDict(candidate, s, uint32(cv), true))
						}
						best = bestOf(best, matchAt(getCur(nextShort), s, uint32(cv), false))
						best = bestOf(best, matchAt(getPrev(nextShort), s, uint32(cv), false))
						best = bestOf(best, matchAt(getCur(nextLong), s, uint32(cv), false))
						best = bestOf(best, matchAt(getPrev(nextLong), s, uint32(cv), false))

						// Dict at +2
						// Very small gain
						if dict != nil {
							candidateL := dict.bestTableLong[hashL]
							candidateS := dict.bestTableShort[hashS]

							best = bestOf(best, matchDict(int(candidateL&0xffff), s, uint32(cv), false))
							best = bestOf(best, matchDict(int(candidateS&0xffff), s, uint32(cv), false))
						}
					}
					// Search for a match at best match end, see if that is better.
					// Allow some bytes at the beginning to mismatch.
					// Sweet spot is around 1-2 bytes, but depends on input.
					// The skipped bytes are tested in Extend backwards,
					// and still picked up as part of the match if they do.
					const skipBeginning = 2
					const skipEnd = 1
					if sAt := best.s + best.length - skipEnd; sAt < sLimit {

						sBack := best.s + skipBeginning - skipEnd
						backL := best.length - skipBeginning
						// Load initial values
						cv = load64(src, sBack)

						// Grab candidates...
						next := lTable[hash8(load64(src, sAt), lTableBits)]

						if checkAt := getCur(next) - backL; checkAt > 0 {
							best = bestOf(best, matchAt(checkAt, sBack, uint32(cv), false))
						}
						if checkAt := getPrev(next) - backL; checkAt > 0 {
							best = bestOf(best, matchAt(checkAt, sBack, uint32(cv), false))
						}
						// Disabled: Extremely small gain
						if false {
							next = sTable[hash4(load64(src, sAt), sTableBits)]
							if checkAt := getCur(next) - backL; checkAt > 0 {
								best = bestOf(best, matchAt(checkAt, sBack, uint32(cv), false))
							}
							if checkAt := getPrev(next) - backL; checkAt > 0 {
								best = bestOf(best, matchAt(checkAt, sBack, uint32(cv), false))
							}
						}
					}
				}
			}

			// Update table
			lTable[hashL] = uint64(s) | candidateL<<32
			sTable[hashS] = uint64(s) | candidateS<<32

			if best.length > 0 {
				break
			}

			cv = load64(src, nextS)
			s = nextS
		}

		// Extend backwards, not needed for repeats...
		s = best.s
		if !best.rep && !best.dict {
			for best.offset > 0 && s > nextEmit && src[best.offset-1] == src[s-1] {
				best.offset--
				best.length++
				s--
			}
		}
		if false && best.offset >= s {
			panic(fmt.Errorf("t %d >= s %d", best.offset, s))
		}
		// Bail if we exceed the maximum size.
		if d+(s-nextEmit) > dstLimit {
			return 0
		}

		base := s
		offset := s - best.offset
		s += best.length

		if offset > 65535 && s-base <= 5 && !best.rep {
			// Bail if the match is equal or worse to the encoding.
			s = best.s + 1
			if s >= sLimit {
				goto emitRemainder
			}
			cv = load64(src, s)
			continue
		}
		if debug && nextEmit != base {
			fmt.Println("EMIT", base-nextEmit, "literals. base-after:", base)
		}
		d += emitLiteral(dst[d:], src[nextEmit:base])
		if best.rep {
			if nextEmit > 0 || best.dict {
				if debug {
					fmt.Println("REPEAT, length", best.length, "offset:", offset, "s-after:", s, "dict:", best.dict, "best:", best)
				}
				// same as `add := emitCopy(dst[d:], repeat, s-base)` but skips storing offset.
				d += emitRepeat(dst[d:], offset, best.length)
			} else {
				// First match without dict cannot be a repeat.
				if debug {
					fmt.Println("COPY, length", best.length, "offset:", offset, "s-after:", s, "dict:", best.dict, "best:", best)
				}
				d += emitCopy(dst[d:], offset, best.length)
			}
		} else {
			if debug {
				fmt.Println("COPY, length", best.length, "offset:", offset, "s-after:", s, "dict:", best.dict, "best:", best)
			}
			d += emitCopy(dst[d:], offset, best.length)
		}
		repeat = offset

		nextEmit = s
		if s >= sLimit {
			goto emitRemainder
		}

		if d > dstLimit {
			// Do we have space for more, if not bail.
			return 0
		}
		// Fill tables...
		for i := best.s + 1; i < s; i++ {
			cv0 := load64(src, i)
			long0 := hash8(cv0, lTableBits)
			short0 := hash4(cv0, sTableBits)
			lTable[long0] = uint64(i) | lTable[long0]<<32
			sTable[short0] = uint64(i) | sTable[short0]<<32
		}
		cv = load64(src, s)
	}

emitRemainder:
	if nextEmit < len(src) {
		// Bail if we exceed the maximum size.
		if d+len(src)-nextEmit > dstLimit {
			return 0
		}
		if debug && nextEmit != s {
			fmt.Println("emitted ", len(src)-nextEmit, "literals")
		}
		d += emitLiteral(dst[d:], src[nextEmit:])
	}
	return d
}

// encodeBlockBestSnappy encodes a non-empty src to a guaranteed-large-enough dst. It
// assumes that the varint-encoded length of the decompressed bytes has already
// been written.
//
// It also assumes that:
//
//	len(dst) >= MaxEncodedLen(len(src)) &&
//	minNonLiteralBlockSize <= len(src) && len(src) <= maxBlockSize
func encodeBlockBestSnappy(dst, src []byte) (d int) {
	// Initialize the hash tables.
	const (
		// Long hash matches.
		lTableBits    = 19
		maxLTableSize = 1 << lTableBits

		// Short hash matches.
		sTableBits    = 16
		maxSTableSize = 1 << sTableBits

		inputMargin = 8 + 2
	)

	// sLimit is when to stop looking for offset/length copies. The inputMargin
	// lets us use a fast path for emitLiteral in the main loop, while we are
	// looking for copies.
	sLimit := len(src) - inputMargin
	if len(src) < minNonLiteralBlockSize {
		return 0
	}

	var lTable [maxLTableSize]uint64
	var sTable [maxSTableSize]uint64

	// Bail if we can't compress to at least this.
	dstLimit := len(src) - 5

	// nextEmit is where in src the next emitLiteral should start from.
	nextEmit := 0

	// The encoded form must start with a literal, as there are no previous
	// bytes to copy, so we start looking for hash matches at s == 1.
	s := 1
	cv := load64(src, s)

	// We search for a repeat at -1, but don't output repeats when nextEmit == 0
	repeat := 1
	const lowbitMask = 0xffffffff
	getCur := func(x uint64) int {
		return int(x & lowbitMask)
	}
	getPrev := func(x uint64) int {
		return int(x >> 32)
	}
	const maxSkip = 64

	for {
		type match struct {
			offset int
			s      int
			length int
			score  int
		}
		var best match
		for {
			// Next src position to check
			nextS := (s-nextEmit)>>8 + 1
			if nextS > maxSkip {
				nextS = s + maxSkip
			} else {
				nextS += s
			}
			if nextS > sLimit {
				goto emitRemainder
			}
			hashL := hash8(cv, lTableBits)
			hashS := hash4(cv, sTableBits)
			candidateL := lTable[hashL]
			candidateS := sTable[hashS]

			score := func(m match) int {
				// Matches that are longer forward are penalized since we must emit it as a literal.
				score := m.length - m.s
				if nextEmit == m.s {
					// If we do not have to emit literals, we save 1 byte
					score++
				}
				offset := m.s - m.offset

				return score - emitCopyNoRepeatSize(offset, m.length)
			}

			matchAt := func(offset, s int, first uint32) match {
				if best.length != 0 && best.s-best.offset == s-offset {
					// Don't retest if we have the same offset.
					return match{offset: offset, s: s}
				}
				if load32(src, offset) != first {
					return match{offset: offset, s: s}
				}
				m := match{offset: offset, s: s, length: 4 + offset}
				s += 4
				for s <= sLimit {
					if diff := load64(src, s) ^ load64(src, m.length); diff != 0 {
						m.length += bits.TrailingZeros64(diff) >> 3
						break
					}
					s += 8
					m.length += 8
				}
				m.length -= offset
				m.score = score(m)
				if m.score <= -m.s {
					// Eliminate if no savings, we might find a better one.
					m.length = 0
				}
				return m
			}

			bestOf := func(a, b match) match {
				if b.length == 0 {
					return a
				}
				if a.length == 0 {
					return b
				}
				as := a.score + b.s
				bs := b.score + a.s
				if as >= bs {
					return a
				}
				return b
			}

			best = bestOf(matchAt(getCur(candidateL), s, uint32(cv)), matchAt(getPrev(candidateL), s, uint32(cv)))
			best = bestOf(best, matchAt(getCur(candidateS), s, uint32(cv)))
			best = bestOf(best, matchAt(getPrev(candidateS), s, uint32(cv)))

			{
				best = bestOf(best, matchAt(s-repeat+1, s+1, uint32(cv>>8)))
				if best.length > 0 {
					// s+1
					nextShort := sTable[hash4(cv>>8, sTableBits)]
					s := s + 1
					cv := load64(src, s)
					nextLong := lTable[hash8(cv, lTableBits)]
					best = bestOf(best, matchAt(getCur(nextShort), s, uint32(cv)))
					best = bestOf(best, matchAt(getPrev(nextShort), s, uint32(cv)))
					best = bestOf(best, matchAt(getCur(nextLong), s, uint32(cv)))
					best = bestOf(best, matchAt(getPrev(nextLong), s, uint32(cv)))
					// Repeat at + 2
					best = bestOf(best, matchAt(s-repeat+1, s+1, uint32(cv>>8)))

					// s+2
					if true {
						nextShort = sTable[hash4(cv>>8, sTableBits)]
						s++
						cv = load64(src, s)
						nextLong = lTable[hash8(cv, lTableBits)]
						best = bestOf(best, matchAt(getCur(nextShort), s, uint32(cv)))
						best = bestOf(best, matchAt(getPrev(nextShort), s, uint32(cv)))
						best = bestOf(best, matchAt(getCur(nextLong), s, uint32(cv)))
						best = bestOf(best, matchAt(getPrev(nextLong), s, uint32(cv)))
					}
					// Search for a match at best match end, see if that is better.
					if sAt := best.s + best.length; sAt < sLimit {
						sBack := best.s
						backL := best.length
						// Load initial values
						cv = load64(src, sBack)
						// Search for mismatch
						next := lTable[hash8(load64(src, sAt), lTableBits)]
						//next := sTable[hash4(load64(src, sAt), sTableBits)]

						if checkAt := getCur(next) - backL; checkAt > 0 {
							best = bestOf(best, matchAt(checkAt, sBack, uint32(cv)))
						}
						if checkAt := getPrev(next) - backL; checkAt > 0 {
							best = bestOf(best, matchAt(checkAt, sBack, uint32(cv)))
						}
					}
				}
			}

			// Update table
			lTable[hashL] = uint64(s) | candidateL<<32
			sTable[hashS] = uint64(s) | candidateS<<32

			if best.length > 0 {
				break
			}

			cv = load64(src, nextS)
			s = nextS
		}

		// Extend backwards, not needed for repeats...
		s = best.s
		if true {
			for best.offset > 0 && s > nextEmit && src[best.offset-1] == src[s-1] {
				best.offset--
				best.length++
				s--
			}
		}
		if false && best.offset >= s {
			panic(fmt.Errorf("t %d >= s %d", best.offset, s))
		}
		// Bail if we exceed the maximum size.
		if d+(s-nextEmit) > dstLimit {
			return 0
		}

		base := s
		offset := s - best.offset

		s += best.length

		if offset > 65535 && s-base <= 5 {
			// Bail if the match is equal or worse to the encoding.
			s = best.s + 1
			if s >= sLimit {
				goto emitRemainder
			}
			cv = load64(src, s)
			continue
		}
		d += emitLiteral(dst[d:], src[nextEmit:base])
		d += emitCopyNoRepeat(dst[d:], offset, best.length)
		repeat = offset

		nextEmit = s
		if s >= sLimit {
			goto emitRemainder
		}

		if d > dstLimit {
			// Do we have space for more, if not bail.
			return 0
		}
		// Fill tables...
		for i := best.s + 1; i < s; i++ {
			cv0 := load64(src, i)
			long0 := hash8(cv0, lTableBits)
			short0 := hash4(cv0, sTableBits)
			lTable[long0] = uint64(i) | lTable[long0]<<32
			sTable[short0] = uint64(i) | sTable[short0]<<32
		}
		cv = load64(src, s)
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

// emitCopySize returns the size to encode the offset+length
//
// It assumes that:
//
//	1 <= offset && offset <= math.MaxUint32
//	4 <= length && length <= 1 << 24
func emitCopySize(offset, length int) int {
	if offset >= 65536 {
		i := 0
		if length > 64 {
			length -= 64
			if length >= 4 {
				// Emit remaining as repeats
				return 5 + emitRepeatSize(offset, length)
			}
			i = 5
		}
		if length == 0 {
			return i
		}
		return i + 5
	}

	// Offset no more than 2 bytes.
	if length > 64 {
		if offset < 2048 {
			// Emit 8 bytes, then rest as repeats...
			return 2 + emitRepeatSize(offset, length-8)
		}
		// Emit remaining as repeats, at least 4 bytes remain.
		return 3 + emitRepeatSize(offset, length-60)
	}
	if length >= 12 || offset >= 2048 {
		return 3
	}
	// Emit the remaining copy, encoded as 2 bytes.
	return 2
}

// emitCopyNoRepeatSize returns the size to encode the offset+length
//
// It assumes that:
//
//	1 <= offset && offset <= math.MaxUint32
//	4 <= length && length <= 1 << 24
func emitCopyNoRepeatSize(offset, length int) int {
	if offset >= 65536 {
		return 5 + 5*(length/64)
	}

	// Offset no more than 2 bytes.
	if length > 64 {
		// Emit remaining as repeats, at least 4 bytes remain.
		return 3 + 3*(length/60)
	}
	if length >= 12 || offset >= 2048 {
		return 3
	}
	// Emit the remaining copy, encoded as 2 bytes.
	return 2
}

// emitRepeatSize returns the number of bytes required to encode a repeat.
// Length must be at least 4 and < 1<<24
func emitRepeatSize(offset, length int) int {
	// Repeat offset, make length cheaper
	if length <= 4+4 || (length < 8+4 && offset < 2048) {
		return 2
	}
	if length < (1<<8)+4+4 {
		return 3
	}
	if length < (1<<16)+(1<<8)+4 {
		return 4
	}
	const maxRepeat = (1 << 24) - 1
	length -= (1 << 16) - 4
	left := 0
	if length > maxRepeat {
		left = length - maxRepeat + 4
	}
	if left > 0 {
		return 5 + emitRepeatSize(offset, left)
	}
	return 5
}
