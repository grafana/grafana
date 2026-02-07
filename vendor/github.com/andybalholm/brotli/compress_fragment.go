package brotli

import "encoding/binary"

/* Copyright 2015 Google Inc. All Rights Reserved.

   Distributed under MIT license.
   See file LICENSE for detail or copy at https://opensource.org/licenses/MIT
*/

/* Function for fast encoding of an input fragment, independently from the input
   history. This function uses one-pass processing: when we find a backward
   match, we immediately emit the corresponding command and literal codes to
   the bit stream.

   Adapted from the CompressFragment() function in
   https://github.com/google/snappy/blob/master/snappy.cc */

const maxDistance_compress_fragment = 262128

func hash5(p []byte, shift uint) uint32 {
	var h uint64 = (binary.LittleEndian.Uint64(p) << 24) * uint64(kHashMul32)
	return uint32(h >> shift)
}

func hashBytesAtOffset5(v uint64, offset int, shift uint) uint32 {
	assert(offset >= 0)
	assert(offset <= 3)
	{
		var h uint64 = ((v >> uint(8*offset)) << 24) * uint64(kHashMul32)
		return uint32(h >> shift)
	}
}

func isMatch5(p1 []byte, p2 []byte) bool {
	return binary.LittleEndian.Uint32(p1) == binary.LittleEndian.Uint32(p2) &&
		p1[4] == p2[4]
}

/* Builds a literal prefix code into "depths" and "bits" based on the statistics
   of the "input" string and stores it into the bit stream.
   Note that the prefix code here is built from the pre-LZ77 input, therefore
   we can only approximate the statistics of the actual literal stream.
   Moreover, for long inputs we build a histogram from a sample of the input
   and thus have to assign a non-zero depth for each literal.
   Returns estimated compression ratio millibytes/char for encoding given input
   with generated code. */
func buildAndStoreLiteralPrefixCode(input []byte, input_size uint, depths []byte, bits []uint16, storage_ix *uint, storage []byte) uint {
	var histogram = [256]uint32{0}
	var histogram_total uint
	var i uint
	if input_size < 1<<15 {
		for i = 0; i < input_size; i++ {
			histogram[input[i]]++
		}

		histogram_total = input_size
		for i = 0; i < 256; i++ {
			/* We weigh the first 11 samples with weight 3 to account for the
			   balancing effect of the LZ77 phase on the histogram. */
			var adjust uint32 = 2 * brotli_min_uint32_t(histogram[i], 11)
			histogram[i] += adjust
			histogram_total += uint(adjust)
		}
	} else {
		const kSampleRate uint = 29
		for i = 0; i < input_size; i += kSampleRate {
			histogram[input[i]]++
		}

		histogram_total = (input_size + kSampleRate - 1) / kSampleRate
		for i = 0; i < 256; i++ {
			/* We add 1 to each population count to avoid 0 bit depths (since this is
			   only a sample and we don't know if the symbol appears or not), and we
			   weigh the first 11 samples with weight 3 to account for the balancing
			   effect of the LZ77 phase on the histogram (more frequent symbols are
			   more likely to be in backward references instead as literals). */
			var adjust uint32 = 1 + 2*brotli_min_uint32_t(histogram[i], 11)
			histogram[i] += adjust
			histogram_total += uint(adjust)
		}
	}

	buildAndStoreHuffmanTreeFast(histogram[:], histogram_total, /* max_bits = */
		8, depths, bits, storage_ix, storage)
	{
		var literal_ratio uint = 0
		for i = 0; i < 256; i++ {
			if histogram[i] != 0 {
				literal_ratio += uint(histogram[i] * uint32(depths[i]))
			}
		}

		/* Estimated encoding ratio, millibytes per symbol. */
		return (literal_ratio * 125) / histogram_total
	}
}

/* Builds a command and distance prefix code (each 64 symbols) into "depth" and
   "bits" based on "histogram" and stores it into the bit stream. */
func buildAndStoreCommandPrefixCode1(histogram []uint32, depth []byte, bits []uint16, storage_ix *uint, storage []byte) {
	var tree [129]huffmanTree
	var cmd_depth = [numCommandSymbols]byte{0}
	/* Tree size for building a tree over 64 symbols is 2 * 64 + 1. */

	var cmd_bits [64]uint16

	createHuffmanTree(histogram, 64, 15, tree[:], depth)
	createHuffmanTree(histogram[64:], 64, 14, tree[:], depth[64:])

	/* We have to jump through a few hoops here in order to compute
	   the command bits because the symbols are in a different order than in
	   the full alphabet. This looks complicated, but having the symbols
	   in this order in the command bits saves a few branches in the Emit*
	   functions. */
	copy(cmd_depth[:], depth[:24])

	copy(cmd_depth[24:][:], depth[40:][:8])
	copy(cmd_depth[32:][:], depth[24:][:8])
	copy(cmd_depth[40:][:], depth[48:][:8])
	copy(cmd_depth[48:][:], depth[32:][:8])
	copy(cmd_depth[56:][:], depth[56:][:8])
	convertBitDepthsToSymbols(cmd_depth[:], 64, cmd_bits[:])
	copy(bits, cmd_bits[:24])
	copy(bits[24:], cmd_bits[32:][:8])
	copy(bits[32:], cmd_bits[48:][:8])
	copy(bits[40:], cmd_bits[24:][:8])
	copy(bits[48:], cmd_bits[40:][:8])
	copy(bits[56:], cmd_bits[56:][:8])
	convertBitDepthsToSymbols(depth[64:], 64, bits[64:])
	{
		/* Create the bit length array for the full command alphabet. */
		var i uint
		for i := 0; i < int(64); i++ {
			cmd_depth[i] = 0
		} /* only 64 first values were used */
		copy(cmd_depth[:], depth[:8])
		copy(cmd_depth[64:][:], depth[8:][:8])
		copy(cmd_depth[128:][:], depth[16:][:8])
		copy(cmd_depth[192:][:], depth[24:][:8])
		copy(cmd_depth[384:][:], depth[32:][:8])
		for i = 0; i < 8; i++ {
			cmd_depth[128+8*i] = depth[40+i]
			cmd_depth[256+8*i] = depth[48+i]
			cmd_depth[448+8*i] = depth[56+i]
		}

		storeHuffmanTree(cmd_depth[:], numCommandSymbols, tree[:], storage_ix, storage)
	}

	storeHuffmanTree(depth[64:], 64, tree[:], storage_ix, storage)
}

/* REQUIRES: insertlen < 6210 */
func emitInsertLen1(insertlen uint, depth []byte, bits []uint16, histo []uint32, storage_ix *uint, storage []byte) {
	if insertlen < 6 {
		var code uint = insertlen + 40
		writeBits(uint(depth[code]), uint64(bits[code]), storage_ix, storage)
		histo[code]++
	} else if insertlen < 130 {
		var tail uint = insertlen - 2
		var nbits uint32 = log2FloorNonZero(tail) - 1
		var prefix uint = tail >> nbits
		var inscode uint = uint((nbits << 1) + uint32(prefix) + 42)
		writeBits(uint(depth[inscode]), uint64(bits[inscode]), storage_ix, storage)
		writeBits(uint(nbits), uint64(tail)-(uint64(prefix)<<nbits), storage_ix, storage)
		histo[inscode]++
	} else if insertlen < 2114 {
		var tail uint = insertlen - 66
		var nbits uint32 = log2FloorNonZero(tail)
		var code uint = uint(nbits + 50)
		writeBits(uint(depth[code]), uint64(bits[code]), storage_ix, storage)
		writeBits(uint(nbits), uint64(tail)-(uint64(uint(1))<<nbits), storage_ix, storage)
		histo[code]++
	} else {
		writeBits(uint(depth[61]), uint64(bits[61]), storage_ix, storage)
		writeBits(12, uint64(insertlen)-2114, storage_ix, storage)
		histo[61]++
	}
}

func emitLongInsertLen(insertlen uint, depth []byte, bits []uint16, histo []uint32, storage_ix *uint, storage []byte) {
	if insertlen < 22594 {
		writeBits(uint(depth[62]), uint64(bits[62]), storage_ix, storage)
		writeBits(14, uint64(insertlen)-6210, storage_ix, storage)
		histo[62]++
	} else {
		writeBits(uint(depth[63]), uint64(bits[63]), storage_ix, storage)
		writeBits(24, uint64(insertlen)-22594, storage_ix, storage)
		histo[63]++
	}
}

func emitCopyLen1(copylen uint, depth []byte, bits []uint16, histo []uint32, storage_ix *uint, storage []byte) {
	if copylen < 10 {
		writeBits(uint(depth[copylen+14]), uint64(bits[copylen+14]), storage_ix, storage)
		histo[copylen+14]++
	} else if copylen < 134 {
		var tail uint = copylen - 6
		var nbits uint32 = log2FloorNonZero(tail) - 1
		var prefix uint = tail >> nbits
		var code uint = uint((nbits << 1) + uint32(prefix) + 20)
		writeBits(uint(depth[code]), uint64(bits[code]), storage_ix, storage)
		writeBits(uint(nbits), uint64(tail)-(uint64(prefix)<<nbits), storage_ix, storage)
		histo[code]++
	} else if copylen < 2118 {
		var tail uint = copylen - 70
		var nbits uint32 = log2FloorNonZero(tail)
		var code uint = uint(nbits + 28)
		writeBits(uint(depth[code]), uint64(bits[code]), storage_ix, storage)
		writeBits(uint(nbits), uint64(tail)-(uint64(uint(1))<<nbits), storage_ix, storage)
		histo[code]++
	} else {
		writeBits(uint(depth[39]), uint64(bits[39]), storage_ix, storage)
		writeBits(24, uint64(copylen)-2118, storage_ix, storage)
		histo[39]++
	}
}

func emitCopyLenLastDistance1(copylen uint, depth []byte, bits []uint16, histo []uint32, storage_ix *uint, storage []byte) {
	if copylen < 12 {
		writeBits(uint(depth[copylen-4]), uint64(bits[copylen-4]), storage_ix, storage)
		histo[copylen-4]++
	} else if copylen < 72 {
		var tail uint = copylen - 8
		var nbits uint32 = log2FloorNonZero(tail) - 1
		var prefix uint = tail >> nbits
		var code uint = uint((nbits << 1) + uint32(prefix) + 4)
		writeBits(uint(depth[code]), uint64(bits[code]), storage_ix, storage)
		writeBits(uint(nbits), uint64(tail)-(uint64(prefix)<<nbits), storage_ix, storage)
		histo[code]++
	} else if copylen < 136 {
		var tail uint = copylen - 8
		var code uint = (tail >> 5) + 30
		writeBits(uint(depth[code]), uint64(bits[code]), storage_ix, storage)
		writeBits(5, uint64(tail)&31, storage_ix, storage)
		writeBits(uint(depth[64]), uint64(bits[64]), storage_ix, storage)
		histo[code]++
		histo[64]++
	} else if copylen < 2120 {
		var tail uint = copylen - 72
		var nbits uint32 = log2FloorNonZero(tail)
		var code uint = uint(nbits + 28)
		writeBits(uint(depth[code]), uint64(bits[code]), storage_ix, storage)
		writeBits(uint(nbits), uint64(tail)-(uint64(uint(1))<<nbits), storage_ix, storage)
		writeBits(uint(depth[64]), uint64(bits[64]), storage_ix, storage)
		histo[code]++
		histo[64]++
	} else {
		writeBits(uint(depth[39]), uint64(bits[39]), storage_ix, storage)
		writeBits(24, uint64(copylen)-2120, storage_ix, storage)
		writeBits(uint(depth[64]), uint64(bits[64]), storage_ix, storage)
		histo[39]++
		histo[64]++
	}
}

func emitDistance1(distance uint, depth []byte, bits []uint16, histo []uint32, storage_ix *uint, storage []byte) {
	var d uint = distance + 3
	var nbits uint32 = log2FloorNonZero(d) - 1
	var prefix uint = (d >> nbits) & 1
	var offset uint = (2 + prefix) << nbits
	var distcode uint = uint(2*(nbits-1) + uint32(prefix) + 80)
	writeBits(uint(depth[distcode]), uint64(bits[distcode]), storage_ix, storage)
	writeBits(uint(nbits), uint64(d)-uint64(offset), storage_ix, storage)
	histo[distcode]++
}

func emitLiterals(input []byte, len uint, depth []byte, bits []uint16, storage_ix *uint, storage []byte) {
	var j uint
	for j = 0; j < len; j++ {
		var lit byte = input[j]
		writeBits(uint(depth[lit]), uint64(bits[lit]), storage_ix, storage)
	}
}

/* REQUIRES: len <= 1 << 24. */
func storeMetaBlockHeader1(len uint, is_uncompressed bool, storage_ix *uint, storage []byte) {
	var nibbles uint = 6

	/* ISLAST */
	writeBits(1, 0, storage_ix, storage)

	if len <= 1<<16 {
		nibbles = 4
	} else if len <= 1<<20 {
		nibbles = 5
	}

	writeBits(2, uint64(nibbles)-4, storage_ix, storage)
	writeBits(nibbles*4, uint64(len)-1, storage_ix, storage)

	/* ISUNCOMPRESSED */
	writeSingleBit(is_uncompressed, storage_ix, storage)
}

func updateBits(n_bits uint, bits uint32, pos uint, array []byte) {
	for n_bits > 0 {
		var byte_pos uint = pos >> 3
		var n_unchanged_bits uint = pos & 7
		var n_changed_bits uint = brotli_min_size_t(n_bits, 8-n_unchanged_bits)
		var total_bits uint = n_unchanged_bits + n_changed_bits
		var mask uint32 = (^((1 << total_bits) - 1)) | ((1 << n_unchanged_bits) - 1)
		var unchanged_bits uint32 = uint32(array[byte_pos]) & mask
		var changed_bits uint32 = bits & ((1 << n_changed_bits) - 1)
		array[byte_pos] = byte(changed_bits<<n_unchanged_bits | unchanged_bits)
		n_bits -= n_changed_bits
		bits >>= n_changed_bits
		pos += n_changed_bits
	}
}

func rewindBitPosition1(new_storage_ix uint, storage_ix *uint, storage []byte) {
	var bitpos uint = new_storage_ix & 7
	var mask uint = (1 << bitpos) - 1
	storage[new_storage_ix>>3] &= byte(mask)
	*storage_ix = new_storage_ix
}

var shouldMergeBlock_kSampleRate uint = 43

func shouldMergeBlock(data []byte, len uint, depths []byte) bool {
	var histo = [256]uint{0}
	var i uint
	for i = 0; i < len; i += shouldMergeBlock_kSampleRate {
		histo[data[i]]++
	}
	{
		var total uint = (len + shouldMergeBlock_kSampleRate - 1) / shouldMergeBlock_kSampleRate
		var r float64 = (fastLog2(total)+0.5)*float64(total) + 200
		for i = 0; i < 256; i++ {
			r -= float64(histo[i]) * (float64(depths[i]) + fastLog2(histo[i]))
		}

		return r >= 0.0
	}
}

func shouldUseUncompressedMode(metablock_start []byte, next_emit []byte, insertlen uint, literal_ratio uint) bool {
	var compressed uint = uint(-cap(next_emit) + cap(metablock_start))
	if compressed*50 > insertlen {
		return false
	} else {
		return literal_ratio > 980
	}
}

func emitUncompressedMetaBlock1(begin []byte, end []byte, storage_ix_start uint, storage_ix *uint, storage []byte) {
	var len uint = uint(-cap(end) + cap(begin))
	rewindBitPosition1(storage_ix_start, storage_ix, storage)
	storeMetaBlockHeader1(uint(len), true, storage_ix, storage)
	*storage_ix = (*storage_ix + 7) &^ 7
	copy(storage[*storage_ix>>3:], begin[:len])
	*storage_ix += uint(len << 3)
	storage[*storage_ix>>3] = 0
}

var kCmdHistoSeed = [128]uint32{
	0,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	0,
	0,
	0,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	0,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	0,
	0,
	0,
	0,
}

var compressFragmentFastImpl_kFirstBlockSize uint = 3 << 15
var compressFragmentFastImpl_kMergeBlockSize uint = 1 << 16

func compressFragmentFastImpl(in []byte, input_size uint, is_last bool, table []int, table_bits uint, cmd_depth []byte, cmd_bits []uint16, cmd_code_numbits *uint, cmd_code []byte, storage_ix *uint, storage []byte) {
	var cmd_histo [128]uint32
	var ip_end int
	var next_emit int = 0
	var base_ip int = 0
	var input int = 0
	const kInputMarginBytes uint = windowGap
	const kMinMatchLen uint = 5
	var metablock_start int = input
	var block_size uint = brotli_min_size_t(input_size, compressFragmentFastImpl_kFirstBlockSize)
	var total_block_size uint = block_size
	var mlen_storage_ix uint = *storage_ix + 3
	var lit_depth [256]byte
	var lit_bits [256]uint16
	var literal_ratio uint
	var ip int
	var last_distance int
	var shift uint = 64 - table_bits

	/* "next_emit" is a pointer to the first byte that is not covered by a
	   previous copy. Bytes between "next_emit" and the start of the next copy or
	   the end of the input will be emitted as literal bytes. */

	/* Save the start of the first block for position and distance computations.
	 */

	/* Save the bit position of the MLEN field of the meta-block header, so that
	   we can update it later if we decide to extend this meta-block. */
	storeMetaBlockHeader1(block_size, false, storage_ix, storage)

	/* No block splits, no contexts. */
	writeBits(13, 0, storage_ix, storage)

	literal_ratio = buildAndStoreLiteralPrefixCode(in[input:], block_size, lit_depth[:], lit_bits[:], storage_ix, storage)
	{
		/* Store the pre-compressed command and distance prefix codes. */
		var i uint
		for i = 0; i+7 < *cmd_code_numbits; i += 8 {
			writeBits(8, uint64(cmd_code[i>>3]), storage_ix, storage)
		}
	}

	writeBits(*cmd_code_numbits&7, uint64(cmd_code[*cmd_code_numbits>>3]), storage_ix, storage)

	/* Initialize the command and distance histograms. We will gather
	   statistics of command and distance codes during the processing
	   of this block and use it to update the command and distance
	   prefix codes for the next block. */
emit_commands:
	copy(cmd_histo[:], kCmdHistoSeed[:])

	/* "ip" is the input pointer. */
	ip = input

	last_distance = -1
	ip_end = int(uint(input) + block_size)

	if block_size >= kInputMarginBytes {
		var len_limit uint = brotli_min_size_t(block_size-kMinMatchLen, input_size-kInputMarginBytes)
		var ip_limit int = int(uint(input) + len_limit)
		/* For the last block, we need to keep a 16 bytes margin so that we can be
		   sure that all distances are at most window size - 16.
		   For all other blocks, we only need to keep a margin of 5 bytes so that
		   we don't go over the block size with a copy. */

		var next_hash uint32
		ip++
		for next_hash = hash5(in[ip:], shift); ; {
			var skip uint32 = 32
			var next_ip int = ip
			/* Step 1: Scan forward in the input looking for a 5-byte-long match.
			   If we get close to exhausting the input then goto emit_remainder.

			   Heuristic match skipping: If 32 bytes are scanned with no matches
			   found, start looking only at every other byte. If 32 more bytes are
			   scanned, look at every third byte, etc.. When a match is found,
			   immediately go back to looking at every byte. This is a small loss
			   (~5% performance, ~0.1% density) for compressible data due to more
			   bookkeeping, but for non-compressible data (such as JPEG) it's a huge
			   win since the compressor quickly "realizes" the data is incompressible
			   and doesn't bother looking for matches everywhere.

			   The "skip" variable keeps track of how many bytes there are since the
			   last match; dividing it by 32 (i.e. right-shifting by five) gives the
			   number of bytes to move ahead for each iteration. */

			var candidate int
			assert(next_emit < ip)

		trawl:
			for {
				var hash uint32 = next_hash
				var bytes_between_hash_lookups uint32 = skip >> 5
				skip++
				assert(hash == hash5(in[next_ip:], shift))
				ip = next_ip
				next_ip = int(uint32(ip) + bytes_between_hash_lookups)
				if next_ip > ip_limit {
					goto emit_remainder
				}

				next_hash = hash5(in[next_ip:], shift)
				candidate = ip - last_distance
				if isMatch5(in[ip:], in[candidate:]) {
					if candidate < ip {
						table[hash] = int(ip - base_ip)
						break
					}
				}

				candidate = base_ip + table[hash]
				assert(candidate >= base_ip)
				assert(candidate < ip)

				table[hash] = int(ip - base_ip)
				if isMatch5(in[ip:], in[candidate:]) {
					break
				}
			}

			/* Check copy distance. If candidate is not feasible, continue search.
			   Checking is done outside of hot loop to reduce overhead. */
			if ip-candidate > maxDistance_compress_fragment {
				goto trawl
			}

			/* Step 2: Emit the found match together with the literal bytes from
			   "next_emit" to the bit stream, and then see if we can find a next match
			   immediately afterwards. Repeat until we find no match for the input
			   without emitting some literal bytes. */
			{
				var base int = ip
				/* > 0 */
				var matched uint = 5 + findMatchLengthWithLimit(in[candidate+5:], in[ip+5:], uint(ip_end-ip)-5)
				var distance int = int(base - candidate)
				/* We have a 5-byte match at ip, and we need to emit bytes in
				   [next_emit, ip). */

				var insert uint = uint(base - next_emit)
				ip += int(matched)
				if insert < 6210 {
					emitInsertLen1(insert, cmd_depth, cmd_bits, cmd_histo[:], storage_ix, storage)
				} else if shouldUseUncompressedMode(in[metablock_start:], in[next_emit:], insert, literal_ratio) {
					emitUncompressedMetaBlock1(in[metablock_start:], in[base:], mlen_storage_ix-3, storage_ix, storage)
					input_size -= uint(base - input)
					input = base
					next_emit = input
					goto next_block
				} else {
					emitLongInsertLen(insert, cmd_depth, cmd_bits, cmd_histo[:], storage_ix, storage)
				}

				emitLiterals(in[next_emit:], insert, lit_depth[:], lit_bits[:], storage_ix, storage)
				if distance == last_distance {
					writeBits(uint(cmd_depth[64]), uint64(cmd_bits[64]), storage_ix, storage)
					cmd_histo[64]++
				} else {
					emitDistance1(uint(distance), cmd_depth, cmd_bits, cmd_histo[:], storage_ix, storage)
					last_distance = distance
				}

				emitCopyLenLastDistance1(matched, cmd_depth, cmd_bits, cmd_histo[:], storage_ix, storage)

				next_emit = ip
				if ip >= ip_limit {
					goto emit_remainder
				}

				/* We could immediately start working at ip now, but to improve
				   compression we first update "table" with the hashes of some positions
				   within the last copy. */
				{
					var input_bytes uint64 = binary.LittleEndian.Uint64(in[ip-3:])
					var prev_hash uint32 = hashBytesAtOffset5(input_bytes, 0, shift)
					var cur_hash uint32 = hashBytesAtOffset5(input_bytes, 3, shift)
					table[prev_hash] = int(ip - base_ip - 3)
					prev_hash = hashBytesAtOffset5(input_bytes, 1, shift)
					table[prev_hash] = int(ip - base_ip - 2)
					prev_hash = hashBytesAtOffset5(input_bytes, 2, shift)
					table[prev_hash] = int(ip - base_ip - 1)

					candidate = base_ip + table[cur_hash]
					table[cur_hash] = int(ip - base_ip)
				}
			}

			for isMatch5(in[ip:], in[candidate:]) {
				var base int = ip
				/* We have a 5-byte match at ip, and no need to emit any literal bytes
				   prior to ip. */

				var matched uint = 5 + findMatchLengthWithLimit(in[candidate+5:], in[ip+5:], uint(ip_end-ip)-5)
				if ip-candidate > maxDistance_compress_fragment {
					break
				}
				ip += int(matched)
				last_distance = int(base - candidate) /* > 0 */
				emitCopyLen1(matched, cmd_depth, cmd_bits, cmd_histo[:], storage_ix, storage)
				emitDistance1(uint(last_distance), cmd_depth, cmd_bits, cmd_histo[:], storage_ix, storage)

				next_emit = ip
				if ip >= ip_limit {
					goto emit_remainder
				}

				/* We could immediately start working at ip now, but to improve
				   compression we first update "table" with the hashes of some positions
				   within the last copy. */
				{
					var input_bytes uint64 = binary.LittleEndian.Uint64(in[ip-3:])
					var prev_hash uint32 = hashBytesAtOffset5(input_bytes, 0, shift)
					var cur_hash uint32 = hashBytesAtOffset5(input_bytes, 3, shift)
					table[prev_hash] = int(ip - base_ip - 3)
					prev_hash = hashBytesAtOffset5(input_bytes, 1, shift)
					table[prev_hash] = int(ip - base_ip - 2)
					prev_hash = hashBytesAtOffset5(input_bytes, 2, shift)
					table[prev_hash] = int(ip - base_ip - 1)

					candidate = base_ip + table[cur_hash]
					table[cur_hash] = int(ip - base_ip)
				}
			}

			ip++
			next_hash = hash5(in[ip:], shift)
		}
	}

emit_remainder:
	assert(next_emit <= ip_end)
	input += int(block_size)
	input_size -= block_size
	block_size = brotli_min_size_t(input_size, compressFragmentFastImpl_kMergeBlockSize)

	/* Decide if we want to continue this meta-block instead of emitting the
	   last insert-only command. */
	if input_size > 0 && total_block_size+block_size <= 1<<20 && shouldMergeBlock(in[input:], block_size, lit_depth[:]) {
		assert(total_block_size > 1<<16)

		/* Update the size of the current meta-block and continue emitting commands.
		   We can do this because the current size and the new size both have 5
		   nibbles. */
		total_block_size += block_size

		updateBits(20, uint32(total_block_size-1), mlen_storage_ix, storage)
		goto emit_commands
	}

	/* Emit the remaining bytes as literals. */
	if next_emit < ip_end {
		var insert uint = uint(ip_end - next_emit)
		if insert < 6210 {
			emitInsertLen1(insert, cmd_depth, cmd_bits, cmd_histo[:], storage_ix, storage)
			emitLiterals(in[next_emit:], insert, lit_depth[:], lit_bits[:], storage_ix, storage)
		} else if shouldUseUncompressedMode(in[metablock_start:], in[next_emit:], insert, literal_ratio) {
			emitUncompressedMetaBlock1(in[metablock_start:], in[ip_end:], mlen_storage_ix-3, storage_ix, storage)
		} else {
			emitLongInsertLen(insert, cmd_depth, cmd_bits, cmd_histo[:], storage_ix, storage)
			emitLiterals(in[next_emit:], insert, lit_depth[:], lit_bits[:], storage_ix, storage)
		}
	}

	next_emit = ip_end

	/* If we have more data, write a new meta-block header and prefix codes and
	   then continue emitting commands. */
next_block:
	if input_size > 0 {
		metablock_start = input
		block_size = brotli_min_size_t(input_size, compressFragmentFastImpl_kFirstBlockSize)
		total_block_size = block_size

		/* Save the bit position of the MLEN field of the meta-block header, so that
		   we can update it later if we decide to extend this meta-block. */
		mlen_storage_ix = *storage_ix + 3

		storeMetaBlockHeader1(block_size, false, storage_ix, storage)

		/* No block splits, no contexts. */
		writeBits(13, 0, storage_ix, storage)

		literal_ratio = buildAndStoreLiteralPrefixCode(in[input:], block_size, lit_depth[:], lit_bits[:], storage_ix, storage)
		buildAndStoreCommandPrefixCode1(cmd_histo[:], cmd_depth, cmd_bits, storage_ix, storage)
		goto emit_commands
	}

	if !is_last {
		/* If this is not the last block, update the command and distance prefix
		   codes for the next block and store the compressed forms. */
		cmd_code[0] = 0

		*cmd_code_numbits = 0
		buildAndStoreCommandPrefixCode1(cmd_histo[:], cmd_depth, cmd_bits, cmd_code_numbits, cmd_code)
	}
}

/* Compresses "input" string to the "*storage" buffer as one or more complete
   meta-blocks, and updates the "*storage_ix" bit position.

   If "is_last" is 1, emits an additional empty last meta-block.

   "cmd_depth" and "cmd_bits" contain the command and distance prefix codes
   (see comment in encode.h) used for the encoding of this input fragment.
   If "is_last" is 0, they are updated to reflect the statistics
   of this input fragment, to be used for the encoding of the next fragment.

   "*cmd_code_numbits" is the number of bits of the compressed representation
   of the command and distance prefix codes, and "cmd_code" is an array of
   at least "(*cmd_code_numbits + 7) >> 3" size that contains the compressed
   command and distance prefix codes. If "is_last" is 0, these are also
   updated to represent the updated "cmd_depth" and "cmd_bits".

   REQUIRES: "input_size" is greater than zero, or "is_last" is 1.
   REQUIRES: "input_size" is less or equal to maximal metablock size (1 << 24).
   REQUIRES: All elements in "table[0..table_size-1]" are initialized to zero.
   REQUIRES: "table_size" is an odd (9, 11, 13, 15) power of two
   OUTPUT: maximal copy distance <= |input_size|
   OUTPUT: maximal copy distance <= BROTLI_MAX_BACKWARD_LIMIT(18) */
func compressFragmentFast(input []byte, input_size uint, is_last bool, table []int, table_size uint, cmd_depth []byte, cmd_bits []uint16, cmd_code_numbits *uint, cmd_code []byte, storage_ix *uint, storage []byte) {
	var initial_storage_ix uint = *storage_ix
	var table_bits uint = uint(log2FloorNonZero(table_size))

	if input_size == 0 {
		assert(is_last)
		writeBits(1, 1, storage_ix, storage) /* islast */
		writeBits(1, 1, storage_ix, storage) /* isempty */
		*storage_ix = (*storage_ix + 7) &^ 7
		return
	}

	compressFragmentFastImpl(input, input_size, is_last, table, table_bits, cmd_depth, cmd_bits, cmd_code_numbits, cmd_code, storage_ix, storage)

	/* If output is larger than single uncompressed block, rewrite it. */
	if *storage_ix-initial_storage_ix > 31+(input_size<<3) {
		emitUncompressedMetaBlock1(input, input[input_size:], initial_storage_ix, storage_ix, storage)
	}

	if is_last {
		writeBits(1, 1, storage_ix, storage) /* islast */
		writeBits(1, 1, storage_ix, storage) /* isempty */
		*storage_ix = (*storage_ix + 7) &^ 7
	}
}
