package brotli

import "encoding/binary"

/* Copyright 2015 Google Inc. All Rights Reserved.

   Distributed under MIT license.
   See file LICENSE for detail or copy at https://opensource.org/licenses/MIT
*/

/* Function for fast encoding of an input fragment, independently from the input
   history. This function uses two-pass processing: in the first pass we save
   the found backward matches and literal bytes into a buffer, and in the
   second pass we emit them into the bit stream using prefix codes built based
   on the actual command and literal byte histograms. */

const kCompressFragmentTwoPassBlockSize uint = 1 << 17

func hash1(p []byte, shift uint, length uint) uint32 {
	var h uint64 = (binary.LittleEndian.Uint64(p) << ((8 - length) * 8)) * uint64(kHashMul32)
	return uint32(h >> shift)
}

func hashBytesAtOffset(v uint64, offset uint, shift uint, length uint) uint32 {
	assert(offset <= 8-length)
	{
		var h uint64 = ((v >> (8 * offset)) << ((8 - length) * 8)) * uint64(kHashMul32)
		return uint32(h >> shift)
	}
}

func isMatch1(p1 []byte, p2 []byte, length uint) bool {
	if binary.LittleEndian.Uint32(p1) != binary.LittleEndian.Uint32(p2) {
		return false
	}
	if length == 4 {
		return true
	}
	return p1[4] == p2[4] && p1[5] == p2[5]
}

/*
Builds a command and distance prefix code (each 64 symbols) into "depth" and

	"bits" based on "histogram" and stores it into the bit stream.
*/
func buildAndStoreCommandPrefixCode(histogram []uint32, depth []byte, bits []uint16, storage_ix *uint, storage []byte) {
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
	copy(cmd_depth[:], depth[24:][:24])

	copy(cmd_depth[24:][:], depth[:8])
	copy(cmd_depth[32:][:], depth[48:][:8])
	copy(cmd_depth[40:][:], depth[8:][:8])
	copy(cmd_depth[48:][:], depth[56:][:8])
	copy(cmd_depth[56:][:], depth[16:][:8])
	convertBitDepthsToSymbols(cmd_depth[:], 64, cmd_bits[:])
	copy(bits, cmd_bits[24:][:8])
	copy(bits[8:], cmd_bits[40:][:8])
	copy(bits[16:], cmd_bits[56:][:8])
	copy(bits[24:], cmd_bits[:24])
	copy(bits[48:], cmd_bits[32:][:8])
	copy(bits[56:], cmd_bits[48:][:8])
	convertBitDepthsToSymbols(depth[64:], 64, bits[64:])
	{
		/* Create the bit length array for the full command alphabet. */
		var i uint
		for i := 0; i < int(64); i++ {
			cmd_depth[i] = 0
		} /* only 64 first values were used */
		copy(cmd_depth[:], depth[24:][:8])
		copy(cmd_depth[64:][:], depth[32:][:8])
		copy(cmd_depth[128:][:], depth[40:][:8])
		copy(cmd_depth[192:][:], depth[48:][:8])
		copy(cmd_depth[384:][:], depth[56:][:8])
		for i = 0; i < 8; i++ {
			cmd_depth[128+8*i] = depth[i]
			cmd_depth[256+8*i] = depth[8+i]
			cmd_depth[448+8*i] = depth[16+i]
		}

		storeHuffmanTree(cmd_depth[:], numCommandSymbols, tree[:], storage_ix, storage)
	}

	storeHuffmanTree(depth[64:], 64, tree[:], storage_ix, storage)
}

func emitInsertLen(insertlen uint32, commands *[]uint32) {
	if insertlen < 6 {
		(*commands)[0] = insertlen
	} else if insertlen < 130 {
		var tail uint32 = insertlen - 2
		var nbits uint32 = log2FloorNonZero(uint(tail)) - 1
		var prefix uint32 = tail >> nbits
		var inscode uint32 = (nbits << 1) + prefix + 2
		var extra uint32 = tail - (prefix << nbits)
		(*commands)[0] = inscode | extra<<8
	} else if insertlen < 2114 {
		var tail uint32 = insertlen - 66
		var nbits uint32 = log2FloorNonZero(uint(tail))
		var code uint32 = nbits + 10
		var extra uint32 = tail - (1 << nbits)
		(*commands)[0] = code | extra<<8
	} else if insertlen < 6210 {
		var extra uint32 = insertlen - 2114
		(*commands)[0] = 21 | extra<<8
	} else if insertlen < 22594 {
		var extra uint32 = insertlen - 6210
		(*commands)[0] = 22 | extra<<8
	} else {
		var extra uint32 = insertlen - 22594
		(*commands)[0] = 23 | extra<<8
	}

	*commands = (*commands)[1:]
}

func emitCopyLen(copylen uint, commands *[]uint32) {
	if copylen < 10 {
		(*commands)[0] = uint32(copylen + 38)
	} else if copylen < 134 {
		var tail uint = copylen - 6
		var nbits uint = uint(log2FloorNonZero(tail) - 1)
		var prefix uint = tail >> nbits
		var code uint = (nbits << 1) + prefix + 44
		var extra uint = tail - (prefix << nbits)
		(*commands)[0] = uint32(code | extra<<8)
	} else if copylen < 2118 {
		var tail uint = copylen - 70
		var nbits uint = uint(log2FloorNonZero(tail))
		var code uint = nbits + 52
		var extra uint = tail - (uint(1) << nbits)
		(*commands)[0] = uint32(code | extra<<8)
	} else {
		var extra uint = copylen - 2118
		(*commands)[0] = uint32(63 | extra<<8)
	}

	*commands = (*commands)[1:]
}

func emitCopyLenLastDistance(copylen uint, commands *[]uint32) {
	if copylen < 12 {
		(*commands)[0] = uint32(copylen + 20)
		*commands = (*commands)[1:]
	} else if copylen < 72 {
		var tail uint = copylen - 8
		var nbits uint = uint(log2FloorNonZero(tail) - 1)
		var prefix uint = tail >> nbits
		var code uint = (nbits << 1) + prefix + 28
		var extra uint = tail - (prefix << nbits)
		(*commands)[0] = uint32(code | extra<<8)
		*commands = (*commands)[1:]
	} else if copylen < 136 {
		var tail uint = copylen - 8
		var code uint = (tail >> 5) + 54
		var extra uint = tail & 31
		(*commands)[0] = uint32(code | extra<<8)
		*commands = (*commands)[1:]
		(*commands)[0] = 64
		*commands = (*commands)[1:]
	} else if copylen < 2120 {
		var tail uint = copylen - 72
		var nbits uint = uint(log2FloorNonZero(tail))
		var code uint = nbits + 52
		var extra uint = tail - (uint(1) << nbits)
		(*commands)[0] = uint32(code | extra<<8)
		*commands = (*commands)[1:]
		(*commands)[0] = 64
		*commands = (*commands)[1:]
	} else {
		var extra uint = copylen - 2120
		(*commands)[0] = uint32(63 | extra<<8)
		*commands = (*commands)[1:]
		(*commands)[0] = 64
		*commands = (*commands)[1:]
	}
}

func emitDistance(distance uint32, commands *[]uint32) {
	var d uint32 = distance + 3
	var nbits uint32 = log2FloorNonZero(uint(d)) - 1
	var prefix uint32 = (d >> nbits) & 1
	var offset uint32 = (2 + prefix) << nbits
	var distcode uint32 = 2*(nbits-1) + prefix + 80
	var extra uint32 = d - offset
	(*commands)[0] = distcode | extra<<8
	*commands = (*commands)[1:]
}

/* REQUIRES: len <= 1 << 24. */
func storeMetaBlockHeader(len uint, is_uncompressed bool, storage_ix *uint, storage []byte) {
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

func storeMetaBlockHeaderBW(len uint, is_uncompressed bool, bw *bitWriter) {
	var nibbles uint = 6

	/* ISLAST */
	bw.writeBits(1, 0)

	if len <= 1<<16 {
		nibbles = 4
	} else if len <= 1<<20 {
		nibbles = 5
	} else if len > 1<<24 {
		panic("metablock too long")
	}

	bw.writeBits(2, uint64(nibbles)-4)
	bw.writeBits(nibbles*4, uint64(len)-1)

	/* ISUNCOMPRESSED */
	bw.writeSingleBit(is_uncompressed)
}

func createCommands(input []byte, block_size uint, input_size uint, base_ip_ptr []byte, table []int, table_bits uint, min_match uint, literals *[]byte, commands *[]uint32) {
	var ip int = 0
	var shift uint = 64 - table_bits
	var ip_end int = int(block_size)
	var base_ip int = -cap(base_ip_ptr) + cap(input)
	var next_emit int = 0
	var last_distance int = -1
	/* "ip" is the input pointer. */

	const kInputMarginBytes uint = windowGap

	/* "next_emit" is a pointer to the first byte that is not covered by a
	   previous copy. Bytes between "next_emit" and the start of the next copy or
	   the end of the input will be emitted as literal bytes. */
	if block_size >= kInputMarginBytes {
		var len_limit uint = brotli_min_size_t(block_size-min_match, input_size-kInputMarginBytes)
		var ip_limit int = int(len_limit)
		/* For the last block, we need to keep a 16 bytes margin so that we can be
		   sure that all distances are at most window size - 16.
		   For all other blocks, we only need to keep a margin of 5 bytes so that
		   we don't go over the block size with a copy. */

		var next_hash uint32
		ip++
		for next_hash = hash1(input[ip:], shift, min_match); ; {
			var skip uint32 = 32
			var next_ip int = ip
			/* Step 1: Scan forward in the input looking for a 6-byte-long match.
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
			   last match; dividing it by 32 (ie. right-shifting by five) gives the
			   number of bytes to move ahead for each iteration. */

			var candidate int

			assert(next_emit < ip)

		trawl:
			for {
				var hash uint32 = next_hash
				var bytes_between_hash_lookups uint32 = skip >> 5
				skip++
				ip = next_ip
				assert(hash == hash1(input[ip:], shift, min_match))
				next_ip = int(uint32(ip) + bytes_between_hash_lookups)
				if next_ip > ip_limit {
					goto emit_remainder
				}

				next_hash = hash1(input[next_ip:], shift, min_match)
				candidate = ip - last_distance
				if isMatch1(input[ip:], base_ip_ptr[candidate-base_ip:], min_match) {
					if candidate < ip {
						table[hash] = int(ip - base_ip)
						break
					}
				}

				candidate = base_ip + table[hash]
				assert(candidate >= base_ip)
				assert(candidate < ip)

				table[hash] = int(ip - base_ip)
				if isMatch1(input[ip:], base_ip_ptr[candidate-base_ip:], min_match) {
					break
				}
			}

			/* Check copy distance. If candidate is not feasible, continue search.
			   Checking is done outside of hot loop to reduce overhead. */
			if ip-candidate > maxDistance_compress_fragment {
				goto trawl
			}

			/* Step 2: Emit the found match together with the literal bytes from
			   "next_emit", and then see if we can find a next match immediately
			   afterwards. Repeat until we find no match for the input
			   without emitting some literal bytes. */
			{
				var base int = ip
				/* > 0 */
				var matched uint = min_match + findMatchLengthWithLimit(base_ip_ptr[uint(candidate-base_ip)+min_match:], input[uint(ip)+min_match:], uint(ip_end-ip)-min_match)
				var distance int = int(base - candidate)
				/* We have a 6-byte match at ip, and we need to emit bytes in
				   [next_emit, ip). */

				var insert int = int(base - next_emit)
				ip += int(matched)
				emitInsertLen(uint32(insert), commands)
				copy(*literals, input[next_emit:][:uint(insert)])
				*literals = (*literals)[insert:]
				if distance == last_distance {
					(*commands)[0] = 64
					*commands = (*commands)[1:]
				} else {
					emitDistance(uint32(distance), commands)
					last_distance = distance
				}

				emitCopyLenLastDistance(matched, commands)

				next_emit = ip
				if ip >= ip_limit {
					goto emit_remainder
				}
				{
					var input_bytes uint64
					var cur_hash uint32
					/* We could immediately start working at ip now, but to improve
					   compression we first update "table" with the hashes of some
					   positions within the last copy. */

					var prev_hash uint32
					if min_match == 4 {
						input_bytes = binary.LittleEndian.Uint64(input[ip-3:])
						cur_hash = hashBytesAtOffset(input_bytes, 3, shift, min_match)
						prev_hash = hashBytesAtOffset(input_bytes, 0, shift, min_match)
						table[prev_hash] = int(ip - base_ip - 3)
						prev_hash = hashBytesAtOffset(input_bytes, 1, shift, min_match)
						table[prev_hash] = int(ip - base_ip - 2)
						prev_hash = hashBytesAtOffset(input_bytes, 0, shift, min_match)
						table[prev_hash] = int(ip - base_ip - 1)
					} else {
						input_bytes = binary.LittleEndian.Uint64(input[ip-5:])
						prev_hash = hashBytesAtOffset(input_bytes, 0, shift, min_match)
						table[prev_hash] = int(ip - base_ip - 5)
						prev_hash = hashBytesAtOffset(input_bytes, 1, shift, min_match)
						table[prev_hash] = int(ip - base_ip - 4)
						prev_hash = hashBytesAtOffset(input_bytes, 2, shift, min_match)
						table[prev_hash] = int(ip - base_ip - 3)
						input_bytes = binary.LittleEndian.Uint64(input[ip-2:])
						cur_hash = hashBytesAtOffset(input_bytes, 2, shift, min_match)
						prev_hash = hashBytesAtOffset(input_bytes, 0, shift, min_match)
						table[prev_hash] = int(ip - base_ip - 2)
						prev_hash = hashBytesAtOffset(input_bytes, 1, shift, min_match)
						table[prev_hash] = int(ip - base_ip - 1)
					}

					candidate = base_ip + table[cur_hash]
					table[cur_hash] = int(ip - base_ip)
				}
			}

			for ip-candidate <= maxDistance_compress_fragment && isMatch1(input[ip:], base_ip_ptr[candidate-base_ip:], min_match) {
				var base int = ip
				/* We have a 6-byte match at ip, and no need to emit any
				   literal bytes prior to ip. */

				var matched uint = min_match + findMatchLengthWithLimit(base_ip_ptr[uint(candidate-base_ip)+min_match:], input[uint(ip)+min_match:], uint(ip_end-ip)-min_match)
				ip += int(matched)
				last_distance = int(base - candidate) /* > 0 */
				emitCopyLen(matched, commands)
				emitDistance(uint32(last_distance), commands)

				next_emit = ip
				if ip >= ip_limit {
					goto emit_remainder
				}
				{
					var input_bytes uint64
					var cur_hash uint32
					/* We could immediately start working at ip now, but to improve
					   compression we first update "table" with the hashes of some
					   positions within the last copy. */

					var prev_hash uint32
					if min_match == 4 {
						input_bytes = binary.LittleEndian.Uint64(input[ip-3:])
						cur_hash = hashBytesAtOffset(input_bytes, 3, shift, min_match)
						prev_hash = hashBytesAtOffset(input_bytes, 0, shift, min_match)
						table[prev_hash] = int(ip - base_ip - 3)
						prev_hash = hashBytesAtOffset(input_bytes, 1, shift, min_match)
						table[prev_hash] = int(ip - base_ip - 2)
						prev_hash = hashBytesAtOffset(input_bytes, 2, shift, min_match)
						table[prev_hash] = int(ip - base_ip - 1)
					} else {
						input_bytes = binary.LittleEndian.Uint64(input[ip-5:])
						prev_hash = hashBytesAtOffset(input_bytes, 0, shift, min_match)
						table[prev_hash] = int(ip - base_ip - 5)
						prev_hash = hashBytesAtOffset(input_bytes, 1, shift, min_match)
						table[prev_hash] = int(ip - base_ip - 4)
						prev_hash = hashBytesAtOffset(input_bytes, 2, shift, min_match)
						table[prev_hash] = int(ip - base_ip - 3)
						input_bytes = binary.LittleEndian.Uint64(input[ip-2:])
						cur_hash = hashBytesAtOffset(input_bytes, 2, shift, min_match)
						prev_hash = hashBytesAtOffset(input_bytes, 0, shift, min_match)
						table[prev_hash] = int(ip - base_ip - 2)
						prev_hash = hashBytesAtOffset(input_bytes, 1, shift, min_match)
						table[prev_hash] = int(ip - base_ip - 1)
					}

					candidate = base_ip + table[cur_hash]
					table[cur_hash] = int(ip - base_ip)
				}
			}

			ip++
			next_hash = hash1(input[ip:], shift, min_match)
		}
	}

emit_remainder:
	assert(next_emit <= ip_end)

	/* Emit the remaining bytes as literals. */
	if next_emit < ip_end {
		var insert uint32 = uint32(ip_end - next_emit)
		emitInsertLen(insert, commands)
		copy(*literals, input[next_emit:][:insert])
		*literals = (*literals)[insert:]
	}
}

var storeCommands_kNumExtraBits = [128]uint32{
	0,
	0,
	0,
	0,
	0,
	0,
	1,
	1,
	2,
	2,
	3,
	3,
	4,
	4,
	5,
	5,
	6,
	7,
	8,
	9,
	10,
	12,
	14,
	24,
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
	2,
	2,
	3,
	3,
	4,
	4,
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
	2,
	2,
	3,
	3,
	4,
	4,
	5,
	5,
	6,
	7,
	8,
	9,
	10,
	24,
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
	0,
	1,
	1,
	2,
	2,
	3,
	3,
	4,
	4,
	5,
	5,
	6,
	6,
	7,
	7,
	8,
	8,
	9,
	9,
	10,
	10,
	11,
	11,
	12,
	12,
	13,
	13,
	14,
	14,
	15,
	15,
	16,
	16,
	17,
	17,
	18,
	18,
	19,
	19,
	20,
	20,
	21,
	21,
	22,
	22,
	23,
	23,
	24,
	24,
}
var storeCommands_kInsertOffset = [24]uint32{
	0,
	1,
	2,
	3,
	4,
	5,
	6,
	8,
	10,
	14,
	18,
	26,
	34,
	50,
	66,
	98,
	130,
	194,
	322,
	578,
	1090,
	2114,
	6210,
	22594,
}

func storeCommands(literals []byte, num_literals uint, commands []uint32, num_commands uint, storage_ix *uint, storage []byte) {
	var lit_depths [256]byte
	var lit_bits [256]uint16
	var lit_histo = [256]uint32{0}
	var cmd_depths = [128]byte{0}
	var cmd_bits = [128]uint16{0}
	var cmd_histo = [128]uint32{0}
	var i uint
	for i = 0; i < num_literals; i++ {
		lit_histo[literals[i]]++
	}

	buildAndStoreHuffmanTreeFast(lit_histo[:], num_literals, /* max_bits = */
		8, lit_depths[:], lit_bits[:], storage_ix, storage)

	for i = 0; i < num_commands; i++ {
		var code uint32 = commands[i] & 0xFF
		assert(code < 128)
		cmd_histo[code]++
	}

	cmd_histo[1] += 1
	cmd_histo[2] += 1
	cmd_histo[64] += 1
	cmd_histo[84] += 1
	buildAndStoreCommandPrefixCode(cmd_histo[:], cmd_depths[:], cmd_bits[:], storage_ix, storage)

	for i = 0; i < num_commands; i++ {
		var cmd uint32 = commands[i]
		var code uint32 = cmd & 0xFF
		var extra uint32 = cmd >> 8
		assert(code < 128)
		writeBits(uint(cmd_depths[code]), uint64(cmd_bits[code]), storage_ix, storage)
		writeBits(uint(storeCommands_kNumExtraBits[code]), uint64(extra), storage_ix, storage)
		if code < 24 {
			var insert uint32 = storeCommands_kInsertOffset[code] + extra
			var j uint32
			for j = 0; j < insert; j++ {
				var lit byte = literals[0]
				writeBits(uint(lit_depths[lit]), uint64(lit_bits[lit]), storage_ix, storage)
				literals = literals[1:]
			}
		}
	}
}

/* Acceptable loss for uncompressible speedup is 2% */
const minRatio = 0.98

const sampleRate = 43

func shouldCompress(input []byte, input_size uint, num_literals uint) bool {
	var corpus_size float64 = float64(input_size)
	if float64(num_literals) < minRatio*corpus_size {
		return true
	} else {
		var literal_histo = [256]uint32{0}
		var max_total_bit_cost float64 = corpus_size * 8 * minRatio / sampleRate
		var i uint
		for i = 0; i < input_size; i += sampleRate {
			literal_histo[input[i]]++
		}

		return bitsEntropy(literal_histo[:], 256) < max_total_bit_cost
	}
}

func rewindBitPosition(new_storage_ix uint, storage_ix *uint, storage []byte) {
	var bitpos uint = new_storage_ix & 7
	var mask uint = (1 << bitpos) - 1
	storage[new_storage_ix>>3] &= byte(mask)
	*storage_ix = new_storage_ix
}

func emitUncompressedMetaBlock(input []byte, input_size uint, storage_ix *uint, storage []byte) {
	storeMetaBlockHeader(input_size, true, storage_ix, storage)
	*storage_ix = (*storage_ix + 7) &^ 7
	copy(storage[*storage_ix>>3:], input[:input_size])
	*storage_ix += input_size << 3
	storage[*storage_ix>>3] = 0
}

func compressFragmentTwoPassImpl(input []byte, input_size uint, is_last bool, command_buf []uint32, literal_buf []byte, table []int, table_bits uint, min_match uint, storage_ix *uint, storage []byte) {
	/* Save the start of the first block for position and distance computations.
	 */
	var base_ip []byte = input

	for input_size > 0 {
		var block_size uint = brotli_min_size_t(input_size, kCompressFragmentTwoPassBlockSize)
		var commands []uint32 = command_buf
		var literals []byte = literal_buf
		var num_literals uint
		createCommands(input, block_size, input_size, base_ip, table, table_bits, min_match, &literals, &commands)
		num_literals = uint(-cap(literals) + cap(literal_buf))
		if shouldCompress(input, block_size, num_literals) {
			var num_commands uint = uint(-cap(commands) + cap(command_buf))
			storeMetaBlockHeader(block_size, false, storage_ix, storage)

			/* No block splits, no contexts. */
			writeBits(13, 0, storage_ix, storage)

			storeCommands(literal_buf, num_literals, command_buf, num_commands, storage_ix, storage)
		} else {
			/* Since we did not find many backward references and the entropy of
			   the data is close to 8 bits, we can simply emit an uncompressed block.
			   This makes compression speed of uncompressible data about 3x faster. */
			emitUncompressedMetaBlock(input, block_size, storage_ix, storage)
		}

		input = input[block_size:]
		input_size -= block_size
	}
}

/*
Compresses "input" string to the "*storage" buffer as one or more complete

	meta-blocks, and updates the "*storage_ix" bit position.

	If "is_last" is 1, emits an additional empty last meta-block.

	REQUIRES: "input_size" is greater than zero, or "is_last" is 1.
	REQUIRES: "input_size" is less or equal to maximal metablock size (1 << 24).
	REQUIRES: "command_buf" and "literal_buf" point to at least
	           kCompressFragmentTwoPassBlockSize long arrays.
	REQUIRES: All elements in "table[0..table_size-1]" are initialized to zero.
	REQUIRES: "table_size" is a power of two
	OUTPUT: maximal copy distance <= |input_size|
	OUTPUT: maximal copy distance <= BROTLI_MAX_BACKWARD_LIMIT(18)
*/
func compressFragmentTwoPass(input []byte, input_size uint, is_last bool, command_buf []uint32, literal_buf []byte, table []int, table_size uint, storage_ix *uint, storage []byte) {
	var initial_storage_ix uint = *storage_ix
	var table_bits uint = uint(log2FloorNonZero(table_size))
	var min_match uint
	if table_bits <= 15 {
		min_match = 4
	} else {
		min_match = 6
	}
	compressFragmentTwoPassImpl(input, input_size, is_last, command_buf, literal_buf, table, table_bits, min_match, storage_ix, storage)

	/* If output is larger than single uncompressed block, rewrite it. */
	if *storage_ix-initial_storage_ix > 31+(input_size<<3) {
		rewindBitPosition(initial_storage_ix, storage_ix, storage)
		emitUncompressedMetaBlock(input, input_size, storage_ix, storage)
	}

	if is_last {
		writeBits(1, 1, storage_ix, storage) /* islast */
		writeBits(1, 1, storage_ix, storage) /* isempty */
		*storage_ix = (*storage_ix + 7) &^ 7
	}
}
