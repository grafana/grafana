//go:build !amd64 || appengine || !gc || noasm
// +build !amd64 appengine !gc noasm

package s2

import (
	"bytes"
	"math/bits"
)

const hasAmd64Asm = false

// encodeBlock encodes a non-empty src to a guaranteed-large-enough dst. It
// assumes that the varint-encoded length of the decompressed bytes has already
// been written.
//
// It also assumes that:
//
//	len(dst) >= MaxEncodedLen(len(src))
func encodeBlock(dst, src []byte) (d int) {
	if len(src) < minNonLiteralBlockSize {
		return 0
	}
	if len(src) <= 64<<10 {
		return encodeBlockGo64K(dst, src)
	}
	return encodeBlockGo(dst, src)
}

// encodeBlockBetter encodes a non-empty src to a guaranteed-large-enough dst. It
// assumes that the varint-encoded length of the decompressed bytes has already
// been written.
//
// It also assumes that:
//
//	len(dst) >= MaxEncodedLen(len(src))
func encodeBlockBetter(dst, src []byte) (d int) {
	if len(src) <= 64<<10 {
		return encodeBlockBetterGo64K(dst, src)
	}
	return encodeBlockBetterGo(dst, src)
}

// encodeBlockBetter encodes a non-empty src to a guaranteed-large-enough dst. It
// assumes that the varint-encoded length of the decompressed bytes has already
// been written.
//
// It also assumes that:
//
//	len(dst) >= MaxEncodedLen(len(src))
func encodeBlockBetterSnappy(dst, src []byte) (d int) {
	if len(src) <= 64<<10 {
		return encodeBlockBetterSnappyGo64K(dst, src)
	}
	return encodeBlockBetterSnappyGo(dst, src)
}

// encodeBlock encodes a non-empty src to a guaranteed-large-enough dst. It
// assumes that the varint-encoded length of the decompressed bytes has already
// been written.
//
// It also assumes that:
//
//	len(dst) >= MaxEncodedLen(len(src))
func encodeBlockSnappy(dst, src []byte) (d int) {
	if len(src) < minNonLiteralBlockSize {
		return 0
	}
	if len(src) <= 64<<10 {
		return encodeBlockSnappyGo64K(dst, src)
	}
	return encodeBlockSnappyGo(dst, src)
}

// emitLiteral writes a literal chunk and returns the number of bytes written.
//
// It assumes that:
//
//	dst is long enough to hold the encoded bytes
//	0 <= len(lit) && len(lit) <= math.MaxUint32
func emitLiteral(dst, lit []byte) int {
	if len(lit) == 0 {
		return 0
	}
	const num = 63<<2 | tagLiteral
	i, n := 0, uint(len(lit)-1)
	switch {
	case n < 60:
		dst[0] = uint8(n)<<2 | tagLiteral
		i = 1
	case n < 1<<8:
		dst[1] = uint8(n)
		dst[0] = 60<<2 | tagLiteral
		i = 2
	case n < 1<<16:
		dst[2] = uint8(n >> 8)
		dst[1] = uint8(n)
		dst[0] = 61<<2 | tagLiteral
		i = 3
	case n < 1<<24:
		dst[3] = uint8(n >> 16)
		dst[2] = uint8(n >> 8)
		dst[1] = uint8(n)
		dst[0] = 62<<2 | tagLiteral
		i = 4
	default:
		dst[4] = uint8(n >> 24)
		dst[3] = uint8(n >> 16)
		dst[2] = uint8(n >> 8)
		dst[1] = uint8(n)
		dst[0] = 63<<2 | tagLiteral
		i = 5
	}
	return i + copy(dst[i:], lit)
}

// emitRepeat writes a repeat chunk and returns the number of bytes written.
// Length must be at least 4 and < 1<<24
func emitRepeat(dst []byte, offset, length int) int {
	// Repeat offset, make length cheaper
	length -= 4
	if length <= 4 {
		dst[0] = uint8(length)<<2 | tagCopy1
		dst[1] = 0
		return 2
	}
	if length < 8 && offset < 2048 {
		// Encode WITH offset
		dst[1] = uint8(offset)
		dst[0] = uint8(offset>>8)<<5 | uint8(length)<<2 | tagCopy1
		return 2
	}
	if length < (1<<8)+4 {
		length -= 4
		dst[2] = uint8(length)
		dst[1] = 0
		dst[0] = 5<<2 | tagCopy1
		return 3
	}
	if length < (1<<16)+(1<<8) {
		length -= 1 << 8
		dst[3] = uint8(length >> 8)
		dst[2] = uint8(length >> 0)
		dst[1] = 0
		dst[0] = 6<<2 | tagCopy1
		return 4
	}
	const maxRepeat = (1 << 24) - 1
	length -= 1 << 16
	left := 0
	if length > maxRepeat {
		left = length - maxRepeat + 4
		length = maxRepeat - 4
	}
	dst[4] = uint8(length >> 16)
	dst[3] = uint8(length >> 8)
	dst[2] = uint8(length >> 0)
	dst[1] = 0
	dst[0] = 7<<2 | tagCopy1
	if left > 0 {
		return 5 + emitRepeat(dst[5:], offset, left)
	}
	return 5
}

// emitCopy writes a copy chunk and returns the number of bytes written.
//
// It assumes that:
//
//	dst is long enough to hold the encoded bytes
//	1 <= offset && offset <= math.MaxUint32
//	4 <= length && length <= 1 << 24
func emitCopy(dst []byte, offset, length int) int {
	if offset >= 65536 {
		i := 0
		if length > 64 {
			// Emit a length 64 copy, encoded as 5 bytes.
			dst[4] = uint8(offset >> 24)
			dst[3] = uint8(offset >> 16)
			dst[2] = uint8(offset >> 8)
			dst[1] = uint8(offset)
			dst[0] = 63<<2 | tagCopy4
			length -= 64
			if length >= 4 {
				// Emit remaining as repeats
				return 5 + emitRepeat(dst[5:], offset, length)
			}
			i = 5
		}
		if length == 0 {
			return i
		}
		// Emit a copy, offset encoded as 4 bytes.
		dst[i+0] = uint8(length-1)<<2 | tagCopy4
		dst[i+1] = uint8(offset)
		dst[i+2] = uint8(offset >> 8)
		dst[i+3] = uint8(offset >> 16)
		dst[i+4] = uint8(offset >> 24)
		return i + 5
	}

	// Offset no more than 2 bytes.
	if length > 64 {
		off := 3
		if offset < 2048 {
			// emit 8 bytes as tagCopy1, rest as repeats.
			dst[1] = uint8(offset)
			dst[0] = uint8(offset>>8)<<5 | uint8(8-4)<<2 | tagCopy1
			length -= 8
			off = 2
		} else {
			// Emit a length 60 copy, encoded as 3 bytes.
			// Emit remaining as repeat value (minimum 4 bytes).
			dst[2] = uint8(offset >> 8)
			dst[1] = uint8(offset)
			dst[0] = 59<<2 | tagCopy2
			length -= 60
		}
		// Emit remaining as repeats, at least 4 bytes remain.
		return off + emitRepeat(dst[off:], offset, length)
	}
	if length >= 12 || offset >= 2048 {
		// Emit the remaining copy, encoded as 3 bytes.
		dst[2] = uint8(offset >> 8)
		dst[1] = uint8(offset)
		dst[0] = uint8(length-1)<<2 | tagCopy2
		return 3
	}
	// Emit the remaining copy, encoded as 2 bytes.
	dst[1] = uint8(offset)
	dst[0] = uint8(offset>>8)<<5 | uint8(length-4)<<2 | tagCopy1
	return 2
}

// emitCopyNoRepeat writes a copy chunk and returns the number of bytes written.
//
// It assumes that:
//
//	dst is long enough to hold the encoded bytes
//	1 <= offset && offset <= math.MaxUint32
//	4 <= length && length <= 1 << 24
func emitCopyNoRepeat(dst []byte, offset, length int) int {
	if offset >= 65536 {
		i := 0
		if length > 64 {
			// Emit a length 64 copy, encoded as 5 bytes.
			dst[4] = uint8(offset >> 24)
			dst[3] = uint8(offset >> 16)
			dst[2] = uint8(offset >> 8)
			dst[1] = uint8(offset)
			dst[0] = 63<<2 | tagCopy4
			length -= 64
			if length >= 4 {
				// Emit remaining as repeats
				return 5 + emitCopyNoRepeat(dst[5:], offset, length)
			}
			i = 5
		}
		if length == 0 {
			return i
		}
		// Emit a copy, offset encoded as 4 bytes.
		dst[i+0] = uint8(length-1)<<2 | tagCopy4
		dst[i+1] = uint8(offset)
		dst[i+2] = uint8(offset >> 8)
		dst[i+3] = uint8(offset >> 16)
		dst[i+4] = uint8(offset >> 24)
		return i + 5
	}

	// Offset no more than 2 bytes.
	if length > 64 {
		// Emit a length 60 copy, encoded as 3 bytes.
		// Emit remaining as repeat value (minimum 4 bytes).
		dst[2] = uint8(offset >> 8)
		dst[1] = uint8(offset)
		dst[0] = 59<<2 | tagCopy2
		length -= 60
		// Emit remaining as repeats, at least 4 bytes remain.
		return 3 + emitCopyNoRepeat(dst[3:], offset, length)
	}
	if length >= 12 || offset >= 2048 {
		// Emit the remaining copy, encoded as 3 bytes.
		dst[2] = uint8(offset >> 8)
		dst[1] = uint8(offset)
		dst[0] = uint8(length-1)<<2 | tagCopy2
		return 3
	}
	// Emit the remaining copy, encoded as 2 bytes.
	dst[1] = uint8(offset)
	dst[0] = uint8(offset>>8)<<5 | uint8(length-4)<<2 | tagCopy1
	return 2
}

// matchLen returns how many bytes match in a and b
//
// It assumes that:
//
//	len(a) <= len(b)
func matchLen(a []byte, b []byte) int {
	b = b[:len(a)]
	var checked int
	if len(a) > 4 {
		// Try 4 bytes first
		if diff := load32(a, 0) ^ load32(b, 0); diff != 0 {
			return bits.TrailingZeros32(diff) >> 3
		}
		// Switch to 8 byte matching.
		checked = 4
		a = a[4:]
		b = b[4:]
		for len(a) >= 8 {
			b = b[:len(a)]
			if diff := load64(a, 0) ^ load64(b, 0); diff != 0 {
				return checked + (bits.TrailingZeros64(diff) >> 3)
			}
			checked += 8
			a = a[8:]
			b = b[8:]
		}
	}
	b = b[:len(a)]
	for i := range a {
		if a[i] != b[i] {
			return int(i) + checked
		}
	}
	return len(a) + checked
}

// input must be > inputMargin
func calcBlockSize(src []byte, _ *[32768]byte) (d int) {
	// Initialize the hash table.
	const (
		tableBits    = 13
		maxTableSize = 1 << tableBits
	)

	var table [maxTableSize]uint32

	// sLimit is when to stop looking for offset/length copies. The inputMargin
	// lets us use a fast path for emitLiteral in the main loop, while we are
	// looking for copies.
	sLimit := len(src) - inputMargin

	// Bail if we can't compress to at least this.
	dstLimit := len(src) - len(src)>>5 - 5

	// nextEmit is where in src the next emitLiteral should start from.
	nextEmit := 0

	// The encoded form must start with a literal, as there are no previous
	// bytes to copy, so we start looking for hash matches at s == 1.
	s := 1
	cv := load64(src, s)

	// We search for a repeat at -1, but don't output repeats when nextEmit == 0
	repeat := 1

	for {
		candidate := 0
		for {
			// Next src position to check
			nextS := s + (s-nextEmit)>>6 + 4
			if nextS > sLimit {
				goto emitRemainder
			}
			hash0 := hash6(cv, tableBits)
			hash1 := hash6(cv>>8, tableBits)
			candidate = int(table[hash0])
			candidate2 := int(table[hash1])
			table[hash0] = uint32(s)
			table[hash1] = uint32(s + 1)
			hash2 := hash6(cv>>16, tableBits)

			// Check repeat at offset checkRep.
			const checkRep = 1
			if uint32(cv>>(checkRep*8)) == load32(src, s-repeat+checkRep) {
				base := s + checkRep
				// Extend back
				for i := base - repeat; base > nextEmit && i > 0 && src[i-1] == src[base-1]; {
					i--
					base--
				}
				d += emitLiteralSize(src[nextEmit:base])

				// Extend forward
				candidate := s - repeat + 4 + checkRep
				s += 4 + checkRep
				for s <= sLimit {
					if diff := load64(src, s) ^ load64(src, candidate); diff != 0 {
						s += bits.TrailingZeros64(diff) >> 3
						break
					}
					s += 8
					candidate += 8
				}

				d += emitCopyNoRepeatSize(repeat, s-base)
				nextEmit = s
				if s >= sLimit {
					goto emitRemainder
				}

				cv = load64(src, s)
				continue
			}

			if uint32(cv) == load32(src, candidate) {
				break
			}
			candidate = int(table[hash2])
			if uint32(cv>>8) == load32(src, candidate2) {
				table[hash2] = uint32(s + 2)
				candidate = candidate2
				s++
				break
			}
			table[hash2] = uint32(s + 2)
			if uint32(cv>>16) == load32(src, candidate) {
				s += 2
				break
			}

			cv = load64(src, nextS)
			s = nextS
		}

		// Extend backwards
		for candidate > 0 && s > nextEmit && src[candidate-1] == src[s-1] {
			candidate--
			s--
		}

		// Bail if we exceed the maximum size.
		if d+(s-nextEmit) > dstLimit {
			return 0
		}

		// A 4-byte match has been found. We'll later see if more than 4 bytes
		// match. But, prior to the match, src[nextEmit:s] are unmatched. Emit
		// them as literal bytes.

		d += emitLiteralSize(src[nextEmit:s])

		// Call emitCopy, and then see if another emitCopy could be our next
		// move. Repeat until we find no match for the input immediately after
		// what was consumed by the last emitCopy call.
		//
		// If we exit this loop normally then we need to call emitLiteral next,
		// though we don't yet know how big the literal will be. We handle that
		// by proceeding to the next iteration of the main loop. We also can
		// exit this loop via goto if we get close to exhausting the input.
		for {
			// Invariant: we have a 4-byte match at s, and no need to emit any
			// literal bytes prior to s.
			base := s
			repeat = base - candidate

			// Extend the 4-byte match as long as possible.
			s += 4
			candidate += 4
			for s <= len(src)-8 {
				if diff := load64(src, s) ^ load64(src, candidate); diff != 0 {
					s += bits.TrailingZeros64(diff) >> 3
					break
				}
				s += 8
				candidate += 8
			}

			d += emitCopyNoRepeatSize(repeat, s-base)
			if false {
				// Validate match.
				a := src[base:s]
				b := src[base-repeat : base-repeat+(s-base)]
				if !bytes.Equal(a, b) {
					panic("mismatch")
				}
			}

			nextEmit = s
			if s >= sLimit {
				goto emitRemainder
			}

			if d > dstLimit {
				// Do we have space for more, if not bail.
				return 0
			}
			// Check for an immediate match, otherwise start search at s+1
			x := load64(src, s-2)
			m2Hash := hash6(x, tableBits)
			currHash := hash6(x>>16, tableBits)
			candidate = int(table[currHash])
			table[m2Hash] = uint32(s - 2)
			table[currHash] = uint32(s)
			if uint32(x>>16) != load32(src, candidate) {
				cv = load64(src, s+1)
				s++
				break
			}
		}
	}

emitRemainder:
	if nextEmit < len(src) {
		// Bail if we exceed the maximum size.
		if d+len(src)-nextEmit > dstLimit {
			return 0
		}
		d += emitLiteralSize(src[nextEmit:])
	}
	return d
}

// length must be > inputMargin.
func calcBlockSizeSmall(src []byte, _ *[2048]byte) (d int) {
	// Initialize the hash table.
	const (
		tableBits    = 9
		maxTableSize = 1 << tableBits
	)

	var table [maxTableSize]uint32

	// sLimit is when to stop looking for offset/length copies. The inputMargin
	// lets us use a fast path for emitLiteral in the main loop, while we are
	// looking for copies.
	sLimit := len(src) - inputMargin

	// Bail if we can't compress to at least this.
	dstLimit := len(src) - len(src)>>5 - 5

	// nextEmit is where in src the next emitLiteral should start from.
	nextEmit := 0

	// The encoded form must start with a literal, as there are no previous
	// bytes to copy, so we start looking for hash matches at s == 1.
	s := 1
	cv := load64(src, s)

	// We search for a repeat at -1, but don't output repeats when nextEmit == 0
	repeat := 1

	for {
		candidate := 0
		for {
			// Next src position to check
			nextS := s + (s-nextEmit)>>6 + 4
			if nextS > sLimit {
				goto emitRemainder
			}
			hash0 := hash6(cv, tableBits)
			hash1 := hash6(cv>>8, tableBits)
			candidate = int(table[hash0])
			candidate2 := int(table[hash1])
			table[hash0] = uint32(s)
			table[hash1] = uint32(s + 1)
			hash2 := hash6(cv>>16, tableBits)

			// Check repeat at offset checkRep.
			const checkRep = 1
			if uint32(cv>>(checkRep*8)) == load32(src, s-repeat+checkRep) {
				base := s + checkRep
				// Extend back
				for i := base - repeat; base > nextEmit && i > 0 && src[i-1] == src[base-1]; {
					i--
					base--
				}
				d += emitLiteralSize(src[nextEmit:base])

				// Extend forward
				candidate := s - repeat + 4 + checkRep
				s += 4 + checkRep
				for s <= sLimit {
					if diff := load64(src, s) ^ load64(src, candidate); diff != 0 {
						s += bits.TrailingZeros64(diff) >> 3
						break
					}
					s += 8
					candidate += 8
				}

				d += emitCopyNoRepeatSize(repeat, s-base)
				nextEmit = s
				if s >= sLimit {
					goto emitRemainder
				}

				cv = load64(src, s)
				continue
			}

			if uint32(cv) == load32(src, candidate) {
				break
			}
			candidate = int(table[hash2])
			if uint32(cv>>8) == load32(src, candidate2) {
				table[hash2] = uint32(s + 2)
				candidate = candidate2
				s++
				break
			}
			table[hash2] = uint32(s + 2)
			if uint32(cv>>16) == load32(src, candidate) {
				s += 2
				break
			}

			cv = load64(src, nextS)
			s = nextS
		}

		// Extend backwards
		for candidate > 0 && s > nextEmit && src[candidate-1] == src[s-1] {
			candidate--
			s--
		}

		// Bail if we exceed the maximum size.
		if d+(s-nextEmit) > dstLimit {
			return 0
		}

		// A 4-byte match has been found. We'll later see if more than 4 bytes
		// match. But, prior to the match, src[nextEmit:s] are unmatched. Emit
		// them as literal bytes.

		d += emitLiteralSize(src[nextEmit:s])

		// Call emitCopy, and then see if another emitCopy could be our next
		// move. Repeat until we find no match for the input immediately after
		// what was consumed by the last emitCopy call.
		//
		// If we exit this loop normally then we need to call emitLiteral next,
		// though we don't yet know how big the literal will be. We handle that
		// by proceeding to the next iteration of the main loop. We also can
		// exit this loop via goto if we get close to exhausting the input.
		for {
			// Invariant: we have a 4-byte match at s, and no need to emit any
			// literal bytes prior to s.
			base := s
			repeat = base - candidate

			// Extend the 4-byte match as long as possible.
			s += 4
			candidate += 4
			for s <= len(src)-8 {
				if diff := load64(src, s) ^ load64(src, candidate); diff != 0 {
					s += bits.TrailingZeros64(diff) >> 3
					break
				}
				s += 8
				candidate += 8
			}

			d += emitCopyNoRepeatSize(repeat, s-base)
			if false {
				// Validate match.
				a := src[base:s]
				b := src[base-repeat : base-repeat+(s-base)]
				if !bytes.Equal(a, b) {
					panic("mismatch")
				}
			}

			nextEmit = s
			if s >= sLimit {
				goto emitRemainder
			}

			if d > dstLimit {
				// Do we have space for more, if not bail.
				return 0
			}
			// Check for an immediate match, otherwise start search at s+1
			x := load64(src, s-2)
			m2Hash := hash6(x, tableBits)
			currHash := hash6(x>>16, tableBits)
			candidate = int(table[currHash])
			table[m2Hash] = uint32(s - 2)
			table[currHash] = uint32(s)
			if uint32(x>>16) != load32(src, candidate) {
				cv = load64(src, s+1)
				s++
				break
			}
		}
	}

emitRemainder:
	if nextEmit < len(src) {
		// Bail if we exceed the maximum size.
		if d+len(src)-nextEmit > dstLimit {
			return 0
		}
		d += emitLiteralSize(src[nextEmit:])
	}
	return d
}

// emitLiteral writes a literal chunk and returns the number of bytes written.
//
// It assumes that:
//
//	dst is long enough to hold the encoded bytes
//	0 <= len(lit) && len(lit) <= math.MaxUint32
func emitLiteralSize(lit []byte) int {
	if len(lit) == 0 {
		return 0
	}
	switch {
	case len(lit) <= 60:
		return len(lit) + 1
	case len(lit) <= 1<<8:
		return len(lit) + 2
	case len(lit) <= 1<<16:
		return len(lit) + 3
	case len(lit) <= 1<<24:
		return len(lit) + 4
	default:
		return len(lit) + 5
	}
}

func cvtLZ4BlockAsm(dst []byte, src []byte) (uncompressed int, dstUsed int) {
	panic("cvtLZ4BlockAsm should be unreachable")
}

func cvtLZ4BlockSnappyAsm(dst []byte, src []byte) (uncompressed int, dstUsed int) {
	panic("cvtLZ4BlockSnappyAsm should be unreachable")
}

func cvtLZ4sBlockAsm(dst []byte, src []byte) (uncompressed int, dstUsed int) {
	panic("cvtLZ4sBlockAsm should be unreachable")
}

func cvtLZ4sBlockSnappyAsm(dst []byte, src []byte) (uncompressed int, dstUsed int) {
	panic("cvtLZ4sBlockSnappyAsm should be unreachable")
}
