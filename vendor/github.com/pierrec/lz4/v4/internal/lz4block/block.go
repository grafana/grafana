package lz4block

import (
	"encoding/binary"
	"math/bits"
	"sync"

	"github.com/pierrec/lz4/v4/internal/lz4errors"
)

const (
	// The following constants are used to setup the compression algorithm.
	minMatch   = 4  // the minimum size of the match sequence size (4 bytes)
	winSizeLog = 16 // LZ4 64Kb window size limit
	winSize    = 1 << winSizeLog
	winMask    = winSize - 1 // 64Kb window of previous data for dependent blocks

	// hashLog determines the size of the hash table used to quickly find a previous match position.
	// Its value influences the compression speed and memory usage, the lower the faster,
	// but at the expense of the compression ratio.
	// 16 seems to be the best compromise for fast compression.
	hashLog = 16
	htSize  = 1 << hashLog

	mfLimit = 10 + minMatch // The last match cannot start within the last 14 bytes.
)

func recoverBlock(e *error) {
	if r := recover(); r != nil && *e == nil {
		*e = lz4errors.ErrInvalidSourceShortBuffer
	}
}

// blockHash hashes the lower 6 bytes into a value < htSize.
func blockHash(x uint64) uint32 {
	const prime6bytes = 227718039650203
	return uint32(((x << (64 - 48)) * prime6bytes) >> (64 - hashLog))
}

func CompressBlockBound(n int) int {
	return n + n/255 + 16
}

func UncompressBlock(src, dst, dict []byte) (int, error) {
	if len(src) == 0 {
		return 0, nil
	}
	if di := decodeBlock(dst, src, dict); di >= 0 {
		return di, nil
	}
	return 0, lz4errors.ErrInvalidSourceShortBuffer
}

type Compressor struct {
	// Offsets are at most 64kiB, so we can store only the lower 16 bits of
	// match positions: effectively, an offset from some 64kiB block boundary.
	//
	// When we retrieve such an offset, we interpret it as relative to the last
	// block boundary si &^ 0xffff, or the one before, (si &^ 0xffff) - 0x10000,
	// depending on which of these is inside the current window. If a table
	// entry was generated more than 64kiB back in the input, we find out by
	// inspecting the input stream.
	table [htSize]uint16

	// Bitmap indicating which positions in the table are in use.
	// This allows us to quickly reset the table for reuse,
	// without having to zero everything.
	inUse [htSize / 32]uint32
}

// Get returns the position of a presumptive match for the hash h.
// The match may be a false positive due to a hash collision or an old entry.
// If si < winSize, the return value may be negative.
func (c *Compressor) get(h uint32, si int) int {
	h &= htSize - 1
	i := 0
	if c.inUse[h/32]&(1<<(h%32)) != 0 {
		i = int(c.table[h])
	}
	i += si &^ winMask
	if i >= si {
		// Try previous 64kiB block (negative when in first block).
		i -= winSize
	}
	return i
}

func (c *Compressor) put(h uint32, si int) {
	h &= htSize - 1
	c.table[h] = uint16(si)
	c.inUse[h/32] |= 1 << (h % 32)
}

func (c *Compressor) reset() { c.inUse = [htSize / 32]uint32{} }

var compressorPool = sync.Pool{New: func() interface{} { return new(Compressor) }}

func CompressBlock(src, dst []byte) (int, error) {
	c := compressorPool.Get().(*Compressor)
	n, err := c.CompressBlock(src, dst)
	compressorPool.Put(c)
	return n, err
}

func (c *Compressor) CompressBlock(src, dst []byte) (int, error) {
	// Zero out reused table to avoid non-deterministic output (issue #65).
	c.reset()

	// Return 0, nil only if the destination buffer size is < CompressBlockBound.
	isNotCompressible := len(dst) < CompressBlockBound(len(src))

	// adaptSkipLog sets how quickly the compressor begins skipping blocks when data is incompressible.
	// This significantly speeds up incompressible data and usually has very small impact on compression.
	// bytes to skip =  1 + (bytes since last match >> adaptSkipLog)
	const adaptSkipLog = 7

	// si: Current position of the search.
	// anchor: Position of the current literals.
	var si, di, anchor int
	sn := len(src) - mfLimit
	if sn <= 0 {
		goto lastLiterals
	}

	// Fast scan strategy: the hash table only stores the last 4 bytes sequences.
	for si < sn {
		// Hash the next 6 bytes (sequence)...
		match := binary.LittleEndian.Uint64(src[si:])
		h := blockHash(match)
		h2 := blockHash(match >> 8)

		// We check a match at s, s+1 and s+2 and pick the first one we get.
		// Checking 3 only requires us to load the source one.
		ref := c.get(h, si)
		ref2 := c.get(h2, si+1)
		c.put(h, si)
		c.put(h2, si+1)

		offset := si - ref

		if offset <= 0 || offset >= winSize || uint32(match) != binary.LittleEndian.Uint32(src[ref:]) {
			// No match. Start calculating another hash.
			// The processor can usually do this out-of-order.
			h = blockHash(match >> 16)
			ref3 := c.get(h, si+2)

			// Check the second match at si+1
			si += 1
			offset = si - ref2

			if offset <= 0 || offset >= winSize || uint32(match>>8) != binary.LittleEndian.Uint32(src[ref2:]) {
				// No match. Check the third match at si+2
				si += 1
				offset = si - ref3
				c.put(h, si)

				if offset <= 0 || offset >= winSize || uint32(match>>16) != binary.LittleEndian.Uint32(src[ref3:]) {
					// Skip one extra byte (at si+3) before we check 3 matches again.
					si += 2 + (si-anchor)>>adaptSkipLog
					continue
				}
			}
		}

		// Match found.
		lLen := si - anchor // Literal length.
		// We already matched 4 bytes.
		mLen := 4

		// Extend backwards if we can, reducing literals.
		tOff := si - offset - 1
		for lLen > 0 && tOff >= 0 && src[si-1] == src[tOff] {
			si--
			tOff--
			lLen--
			mLen++
		}

		// Add the match length, so we continue search at the end.
		// Use mLen to store the offset base.
		si, mLen = si+mLen, si+minMatch

		// Find the longest match by looking by batches of 8 bytes.
		for si+8 <= sn {
			x := binary.LittleEndian.Uint64(src[si:]) ^ binary.LittleEndian.Uint64(src[si-offset:])
			if x == 0 {
				si += 8
			} else {
				// Stop is first non-zero byte.
				si += bits.TrailingZeros64(x) >> 3
				break
			}
		}

		mLen = si - mLen
		if di >= len(dst) {
			return 0, lz4errors.ErrInvalidSourceShortBuffer
		}
		if mLen < 0xF {
			dst[di] = byte(mLen)
		} else {
			dst[di] = 0xF
		}

		// Encode literals length.
		if lLen < 0xF {
			dst[di] |= byte(lLen << 4)
		} else {
			dst[di] |= 0xF0
			di++
			l := lLen - 0xF
			for ; l >= 0xFF && di < len(dst); l -= 0xFF {
				dst[di] = 0xFF
				di++
			}
			if di >= len(dst) {
				return 0, lz4errors.ErrInvalidSourceShortBuffer
			}
			dst[di] = byte(l)
		}
		di++

		// Literals.
		if di+lLen > len(dst) {
			return 0, lz4errors.ErrInvalidSourceShortBuffer
		}
		copy(dst[di:di+lLen], src[anchor:anchor+lLen])
		di += lLen + 2
		anchor = si

		// Encode offset.
		if di > len(dst) {
			return 0, lz4errors.ErrInvalidSourceShortBuffer
		}
		dst[di-2], dst[di-1] = byte(offset), byte(offset>>8)

		// Encode match length part 2.
		if mLen >= 0xF {
			for mLen -= 0xF; mLen >= 0xFF && di < len(dst); mLen -= 0xFF {
				dst[di] = 0xFF
				di++
			}
			if di >= len(dst) {
				return 0, lz4errors.ErrInvalidSourceShortBuffer
			}
			dst[di] = byte(mLen)
			di++
		}
		// Check if we can load next values.
		if si >= sn {
			break
		}
		// Hash match end-2
		h = blockHash(binary.LittleEndian.Uint64(src[si-2:]))
		c.put(h, si-2)
	}

lastLiterals:
	if isNotCompressible && anchor == 0 {
		// Incompressible.
		return 0, nil
	}

	// Last literals.
	if di >= len(dst) {
		return 0, lz4errors.ErrInvalidSourceShortBuffer
	}
	lLen := len(src) - anchor
	if lLen < 0xF {
		dst[di] = byte(lLen << 4)
	} else {
		dst[di] = 0xF0
		di++
		for lLen -= 0xF; lLen >= 0xFF && di < len(dst); lLen -= 0xFF {
			dst[di] = 0xFF
			di++
		}
		if di >= len(dst) {
			return 0, lz4errors.ErrInvalidSourceShortBuffer
		}
		dst[di] = byte(lLen)
	}
	di++

	// Write the last literals.
	if isNotCompressible && di >= anchor {
		// Incompressible.
		return 0, nil
	}
	if di+len(src)-anchor > len(dst) {
		return 0, lz4errors.ErrInvalidSourceShortBuffer
	}
	di += copy(dst[di:di+len(src)-anchor], src[anchor:])
	return di, nil
}

// blockHash hashes 4 bytes into a value < winSize.
func blockHashHC(x uint32) uint32 {
	const hasher uint32 = 2654435761 // Knuth multiplicative hash.
	return x * hasher >> (32 - winSizeLog)
}

type CompressorHC struct {
	// hashTable: stores the last position found for a given hash
	// chainTable: stores previous positions for a given hash
	hashTable, chainTable [htSize]int
	needsReset            bool
}

var compressorHCPool = sync.Pool{New: func() interface{} { return new(CompressorHC) }}

func CompressBlockHC(src, dst []byte, depth CompressionLevel) (int, error) {
	c := compressorHCPool.Get().(*CompressorHC)
	n, err := c.CompressBlock(src, dst, depth)
	compressorHCPool.Put(c)
	return n, err
}

func (c *CompressorHC) CompressBlock(src, dst []byte, depth CompressionLevel) (_ int, err error) {
	if c.needsReset {
		// Zero out reused table to avoid non-deterministic output (issue #65).
		c.hashTable = [htSize]int{}
		c.chainTable = [htSize]int{}
	}
	c.needsReset = true // Only false on first call.

	defer recoverBlock(&err)

	// Return 0, nil only if the destination buffer size is < CompressBlockBound.
	isNotCompressible := len(dst) < CompressBlockBound(len(src))

	// adaptSkipLog sets how quickly the compressor begins skipping blocks when data is incompressible.
	// This significantly speeds up incompressible data and usually has very small impact on compression.
	// bytes to skip =  1 + (bytes since last match >> adaptSkipLog)
	const adaptSkipLog = 7

	var si, di, anchor int
	sn := len(src) - mfLimit
	if sn <= 0 {
		goto lastLiterals
	}

	if depth == 0 {
		depth = winSize
	}

	for si < sn {
		// Hash the next 4 bytes (sequence).
		match := binary.LittleEndian.Uint32(src[si:])
		h := blockHashHC(match)

		// Follow the chain until out of window and give the longest match.
		mLen := 0
		offset := 0
		for next, try := c.hashTable[h], depth; try > 0 && next > 0 && si-next < winSize; next, try = c.chainTable[next&winMask], try-1 {
			// The first (mLen==0) or next byte (mLen>=minMatch) at current match length
			// must match to improve on the match length.
			if src[next+mLen] != src[si+mLen] {
				continue
			}
			ml := 0
			// Compare the current position with a previous with the same hash.
			for ml < sn-si {
				x := binary.LittleEndian.Uint64(src[next+ml:]) ^ binary.LittleEndian.Uint64(src[si+ml:])
				if x == 0 {
					ml += 8
				} else {
					// Stop is first non-zero byte.
					ml += bits.TrailingZeros64(x) >> 3
					break
				}
			}
			if ml < minMatch || ml <= mLen {
				// Match too small (<minMath) or smaller than the current match.
				continue
			}
			// Found a longer match, keep its position and length.
			mLen = ml
			offset = si - next
			// Try another previous position with the same hash.
		}
		c.chainTable[si&winMask] = c.hashTable[h]
		c.hashTable[h] = si

		// No match found.
		if mLen == 0 {
			si += 1 + (si-anchor)>>adaptSkipLog
			continue
		}

		// Match found.
		// Update hash/chain tables with overlapping bytes:
		// si already hashed, add everything from si+1 up to the match length.
		winStart := si + 1
		if ws := si + mLen - winSize; ws > winStart {
			winStart = ws
		}
		for si, ml := winStart, si+mLen; si < ml; {
			match >>= 8
			match |= uint32(src[si+3]) << 24
			h := blockHashHC(match)
			c.chainTable[si&winMask] = c.hashTable[h]
			c.hashTable[h] = si
			si++
		}

		lLen := si - anchor
		si += mLen
		mLen -= minMatch // Match length does not include minMatch.

		if mLen < 0xF {
			dst[di] = byte(mLen)
		} else {
			dst[di] = 0xF
		}

		// Encode literals length.
		if lLen < 0xF {
			dst[di] |= byte(lLen << 4)
		} else {
			dst[di] |= 0xF0
			di++
			l := lLen - 0xF
			for ; l >= 0xFF; l -= 0xFF {
				dst[di] = 0xFF
				di++
			}
			dst[di] = byte(l)
		}
		di++

		// Literals.
		copy(dst[di:di+lLen], src[anchor:anchor+lLen])
		di += lLen
		anchor = si

		// Encode offset.
		di += 2
		dst[di-2], dst[di-1] = byte(offset), byte(offset>>8)

		// Encode match length part 2.
		if mLen >= 0xF {
			for mLen -= 0xF; mLen >= 0xFF; mLen -= 0xFF {
				dst[di] = 0xFF
				di++
			}
			dst[di] = byte(mLen)
			di++
		}
	}

	if isNotCompressible && anchor == 0 {
		// Incompressible.
		return 0, nil
	}

	// Last literals.
lastLiterals:
	lLen := len(src) - anchor
	if lLen < 0xF {
		dst[di] = byte(lLen << 4)
	} else {
		dst[di] = 0xF0
		di++
		lLen -= 0xF
		for ; lLen >= 0xFF; lLen -= 0xFF {
			dst[di] = 0xFF
			di++
		}
		dst[di] = byte(lLen)
	}
	di++

	// Write the last literals.
	if isNotCompressible && di >= anchor {
		// Incompressible.
		return 0, nil
	}
	di += copy(dst[di:di+len(src)-anchor], src[anchor:])
	return di, nil
}
