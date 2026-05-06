package brotli

/* Copyright 2013 Google Inc. All Rights Reserved.

   Distributed under MIT license.
   See file LICENSE for detail or copy at https://opensource.org/licenses/MIT
*/

/* Utilities for building Huffman decoding tables. */

const huffmanMaxCodeLength = 15

/* Maximum possible Huffman table size for an alphabet size of (index * 32),
   max code length 15 and root table bits 8. */
var kMaxHuffmanTableSize = []uint16{
	256,
	402,
	436,
	468,
	500,
	534,
	566,
	598,
	630,
	662,
	694,
	726,
	758,
	790,
	822,
	854,
	886,
	920,
	952,
	984,
	1016,
	1048,
	1080,
	1112,
	1144,
	1176,
	1208,
	1240,
	1272,
	1304,
	1336,
	1368,
	1400,
	1432,
	1464,
	1496,
	1528,
}

/* BROTLI_NUM_BLOCK_LEN_SYMBOLS == 26 */
const huffmanMaxSize26 = 396

/* BROTLI_MAX_BLOCK_TYPE_SYMBOLS == 258 */
const huffmanMaxSize258 = 632

/* BROTLI_MAX_CONTEXT_MAP_SYMBOLS == 272 */
const huffmanMaxSize272 = 646

const huffmanMaxCodeLengthCodeLength = 5

/* Do not create this struct directly - use the ConstructHuffmanCode
 * constructor below! */
type huffmanCode struct {
	bits  byte
	value uint16
}

func constructHuffmanCode(bits byte, value uint16) huffmanCode {
	var h huffmanCode
	h.bits = bits
	h.value = value
	return h
}

/* Builds Huffman lookup table assuming code lengths are in symbol order. */

/* Builds Huffman lookup table assuming code lengths are in symbol order.
   Returns size of resulting table. */

/* Builds a simple Huffman table. The |num_symbols| parameter is to be
   interpreted as follows: 0 means 1 symbol, 1 means 2 symbols,
   2 means 3 symbols, 3 means 4 symbols with lengths [2, 2, 2, 2],
   4 means 4 symbols with lengths [1, 2, 3, 3]. */

/* Contains a collection of Huffman trees with the same alphabet size. */
/* max_symbol is needed due to simple codes since log2(alphabet_size) could be
   greater than log2(max_symbol). */
type huffmanTreeGroup struct {
	htrees        [][]huffmanCode
	codes         []huffmanCode
	alphabet_size uint16
	max_symbol    uint16
	num_htrees    uint16
}

const reverseBitsMax = 8

const reverseBitsBase = 0

var kReverseBits = [1 << reverseBitsMax]byte{
	0x00,
	0x80,
	0x40,
	0xC0,
	0x20,
	0xA0,
	0x60,
	0xE0,
	0x10,
	0x90,
	0x50,
	0xD0,
	0x30,
	0xB0,
	0x70,
	0xF0,
	0x08,
	0x88,
	0x48,
	0xC8,
	0x28,
	0xA8,
	0x68,
	0xE8,
	0x18,
	0x98,
	0x58,
	0xD8,
	0x38,
	0xB8,
	0x78,
	0xF8,
	0x04,
	0x84,
	0x44,
	0xC4,
	0x24,
	0xA4,
	0x64,
	0xE4,
	0x14,
	0x94,
	0x54,
	0xD4,
	0x34,
	0xB4,
	0x74,
	0xF4,
	0x0C,
	0x8C,
	0x4C,
	0xCC,
	0x2C,
	0xAC,
	0x6C,
	0xEC,
	0x1C,
	0x9C,
	0x5C,
	0xDC,
	0x3C,
	0xBC,
	0x7C,
	0xFC,
	0x02,
	0x82,
	0x42,
	0xC2,
	0x22,
	0xA2,
	0x62,
	0xE2,
	0x12,
	0x92,
	0x52,
	0xD2,
	0x32,
	0xB2,
	0x72,
	0xF2,
	0x0A,
	0x8A,
	0x4A,
	0xCA,
	0x2A,
	0xAA,
	0x6A,
	0xEA,
	0x1A,
	0x9A,
	0x5A,
	0xDA,
	0x3A,
	0xBA,
	0x7A,
	0xFA,
	0x06,
	0x86,
	0x46,
	0xC6,
	0x26,
	0xA6,
	0x66,
	0xE6,
	0x16,
	0x96,
	0x56,
	0xD6,
	0x36,
	0xB6,
	0x76,
	0xF6,
	0x0E,
	0x8E,
	0x4E,
	0xCE,
	0x2E,
	0xAE,
	0x6E,
	0xEE,
	0x1E,
	0x9E,
	0x5E,
	0xDE,
	0x3E,
	0xBE,
	0x7E,
	0xFE,
	0x01,
	0x81,
	0x41,
	0xC1,
	0x21,
	0xA1,
	0x61,
	0xE1,
	0x11,
	0x91,
	0x51,
	0xD1,
	0x31,
	0xB1,
	0x71,
	0xF1,
	0x09,
	0x89,
	0x49,
	0xC9,
	0x29,
	0xA9,
	0x69,
	0xE9,
	0x19,
	0x99,
	0x59,
	0xD9,
	0x39,
	0xB9,
	0x79,
	0xF9,
	0x05,
	0x85,
	0x45,
	0xC5,
	0x25,
	0xA5,
	0x65,
	0xE5,
	0x15,
	0x95,
	0x55,
	0xD5,
	0x35,
	0xB5,
	0x75,
	0xF5,
	0x0D,
	0x8D,
	0x4D,
	0xCD,
	0x2D,
	0xAD,
	0x6D,
	0xED,
	0x1D,
	0x9D,
	0x5D,
	0xDD,
	0x3D,
	0xBD,
	0x7D,
	0xFD,
	0x03,
	0x83,
	0x43,
	0xC3,
	0x23,
	0xA3,
	0x63,
	0xE3,
	0x13,
	0x93,
	0x53,
	0xD3,
	0x33,
	0xB3,
	0x73,
	0xF3,
	0x0B,
	0x8B,
	0x4B,
	0xCB,
	0x2B,
	0xAB,
	0x6B,
	0xEB,
	0x1B,
	0x9B,
	0x5B,
	0xDB,
	0x3B,
	0xBB,
	0x7B,
	0xFB,
	0x07,
	0x87,
	0x47,
	0xC7,
	0x27,
	0xA7,
	0x67,
	0xE7,
	0x17,
	0x97,
	0x57,
	0xD7,
	0x37,
	0xB7,
	0x77,
	0xF7,
	0x0F,
	0x8F,
	0x4F,
	0xCF,
	0x2F,
	0xAF,
	0x6F,
	0xEF,
	0x1F,
	0x9F,
	0x5F,
	0xDF,
	0x3F,
	0xBF,
	0x7F,
	0xFF,
}

const reverseBitsLowest = (uint64(1) << (reverseBitsMax - 1 + reverseBitsBase))

/* Returns reverse(num >> BROTLI_REVERSE_BITS_BASE, BROTLI_REVERSE_BITS_MAX),
   where reverse(value, len) is the bit-wise reversal of the len least
   significant bits of value. */
func reverseBits8(num uint64) uint64 {
	return uint64(kReverseBits[num])
}

/* Stores code in table[0], table[step], table[2*step], ..., table[end] */
/* Assumes that end is an integer multiple of step */
func replicateValue(table []huffmanCode, step int, end int, code huffmanCode) {
	for {
		end -= step
		table[end] = code
		if end <= 0 {
			break
		}
	}
}

/* Returns the table width of the next 2nd level table. |count| is the histogram
   of bit lengths for the remaining symbols, |len| is the code length of the
   next processed symbol. */
func nextTableBitSize(count []uint16, len int, root_bits int) int {
	var left int = 1 << uint(len-root_bits)
	for len < huffmanMaxCodeLength {
		left -= int(count[len])
		if left <= 0 {
			break
		}
		len++
		left <<= 1
	}

	return len - root_bits
}

func buildCodeLengthsHuffmanTable(table []huffmanCode, code_lengths []byte, count []uint16) {
	var code huffmanCode /* current table entry */ /* symbol index in original or sorted table */ /* prefix code */ /* prefix code addend */ /* step size to replicate values in current table */ /* size of current table */ /* symbols sorted by code length */
	var symbol int
	var key uint64
	var key_step uint64
	var step int
	var table_size int
	var sorted [codeLengthCodes]int
	var offset [huffmanMaxCodeLengthCodeLength + 1]int
	var bits int
	var bits_count int
	/* offsets in sorted table for each length */
	assert(huffmanMaxCodeLengthCodeLength <= reverseBitsMax)

	/* Generate offsets into sorted symbol table by code length. */
	symbol = -1

	bits = 1
	var i int
	for i = 0; i < huffmanMaxCodeLengthCodeLength; i++ {
		symbol += int(count[bits])
		offset[bits] = symbol
		bits++
	}

	/* Symbols with code length 0 are placed after all other symbols. */
	offset[0] = codeLengthCodes - 1

	/* Sort symbols by length, by symbol order within each length. */
	symbol = codeLengthCodes

	for {
		var i int
		for i = 0; i < 6; i++ {
			symbol--
			sorted[offset[code_lengths[symbol]]] = symbol
			offset[code_lengths[symbol]]--
		}
		if symbol == 0 {
			break
		}
	}

	table_size = 1 << huffmanMaxCodeLengthCodeLength

	/* Special case: all symbols but one have 0 code length. */
	if offset[0] == 0 {
		code = constructHuffmanCode(0, uint16(sorted[0]))
		for key = 0; key < uint64(table_size); key++ {
			table[key] = code
		}

		return
	}

	/* Fill in table. */
	key = 0

	key_step = reverseBitsLowest
	symbol = 0
	bits = 1
	step = 2
	for {
		for bits_count = int(count[bits]); bits_count != 0; bits_count-- {
			code = constructHuffmanCode(byte(bits), uint16(sorted[symbol]))
			symbol++
			replicateValue(table[reverseBits8(key):], step, table_size, code)
			key += key_step
		}

		step <<= 1
		key_step >>= 1
		bits++
		if bits > huffmanMaxCodeLengthCodeLength {
			break
		}
	}
}

func buildHuffmanTable(root_table []huffmanCode, root_bits int, symbol_lists symbolList, count []uint16) uint32 {
	var code huffmanCode /* current table entry */ /* next available space in table */ /* current code length */ /* symbol index in original or sorted table */ /* prefix code */ /* prefix code addend */ /* 2nd level table prefix code */ /* 2nd level table prefix code addend */ /* step size to replicate values in current table */ /* key length of current table */ /* size of current table */ /* sum of root table size and 2nd level table sizes */
	var table []huffmanCode
	var len int
	var symbol int
	var key uint64
	var key_step uint64
	var sub_key uint64
	var sub_key_step uint64
	var step int
	var table_bits int
	var table_size int
	var total_size int
	var max_length int = -1
	var bits int
	var bits_count int

	assert(root_bits <= reverseBitsMax)
	assert(huffmanMaxCodeLength-root_bits <= reverseBitsMax)

	for symbolListGet(symbol_lists, max_length) == 0xFFFF {
		max_length--
	}
	max_length += huffmanMaxCodeLength + 1

	table = root_table
	table_bits = root_bits
	table_size = 1 << uint(table_bits)
	total_size = table_size

	/* Fill in the root table. Reduce the table size to if possible,
	   and create the repetitions by memcpy. */
	if table_bits > max_length {
		table_bits = max_length
		table_size = 1 << uint(table_bits)
	}

	key = 0
	key_step = reverseBitsLowest
	bits = 1
	step = 2
	for {
		symbol = bits - (huffmanMaxCodeLength + 1)
		for bits_count = int(count[bits]); bits_count != 0; bits_count-- {
			symbol = int(symbolListGet(symbol_lists, symbol))
			code = constructHuffmanCode(byte(bits), uint16(symbol))
			replicateValue(table[reverseBits8(key):], step, table_size, code)
			key += key_step
		}

		step <<= 1
		key_step >>= 1
		bits++
		if bits > table_bits {
			break
		}
	}

	/* If root_bits != table_bits then replicate to fill the remaining slots. */
	for total_size != table_size {
		copy(table[table_size:], table[:uint(table_size)])
		table_size <<= 1
	}

	/* Fill in 2nd level tables and add pointers to root table. */
	key_step = reverseBitsLowest >> uint(root_bits-1)

	sub_key = reverseBitsLowest << 1
	sub_key_step = reverseBitsLowest
	len = root_bits + 1
	step = 2
	for ; len <= max_length; len++ {
		symbol = len - (huffmanMaxCodeLength + 1)
		for ; count[len] != 0; count[len]-- {
			if sub_key == reverseBitsLowest<<1 {
				table = table[table_size:]
				table_bits = nextTableBitSize(count, int(len), root_bits)
				table_size = 1 << uint(table_bits)
				total_size += table_size
				sub_key = reverseBits8(key)
				key += key_step
				root_table[sub_key] = constructHuffmanCode(byte(table_bits+root_bits), uint16(uint64(uint(-cap(table)+cap(root_table)))-sub_key))
				sub_key = 0
			}

			symbol = int(symbolListGet(symbol_lists, symbol))
			code = constructHuffmanCode(byte(len-root_bits), uint16(symbol))
			replicateValue(table[reverseBits8(sub_key):], step, table_size, code)
			sub_key += sub_key_step
		}

		step <<= 1
		sub_key_step >>= 1
	}

	return uint32(total_size)
}

func buildSimpleHuffmanTable(table []huffmanCode, root_bits int, val []uint16, num_symbols uint32) uint32 {
	var table_size uint32 = 1
	var goal_size uint32 = 1 << uint(root_bits)
	switch num_symbols {
	case 0:
		table[0] = constructHuffmanCode(0, val[0])

	case 1:
		if val[1] > val[0] {
			table[0] = constructHuffmanCode(1, val[0])
			table[1] = constructHuffmanCode(1, val[1])
		} else {
			table[0] = constructHuffmanCode(1, val[1])
			table[1] = constructHuffmanCode(1, val[0])
		}

		table_size = 2

	case 2:
		table[0] = constructHuffmanCode(1, val[0])
		table[2] = constructHuffmanCode(1, val[0])
		if val[2] > val[1] {
			table[1] = constructHuffmanCode(2, val[1])
			table[3] = constructHuffmanCode(2, val[2])
		} else {
			table[1] = constructHuffmanCode(2, val[2])
			table[3] = constructHuffmanCode(2, val[1])
		}

		table_size = 4

	case 3:
		var i int
		var k int
		for i = 0; i < 3; i++ {
			for k = i + 1; k < 4; k++ {
				if val[k] < val[i] {
					var t uint16 = val[k]
					val[k] = val[i]
					val[i] = t
				}
			}
		}

		table[0] = constructHuffmanCode(2, val[0])
		table[2] = constructHuffmanCode(2, val[1])
		table[1] = constructHuffmanCode(2, val[2])
		table[3] = constructHuffmanCode(2, val[3])
		table_size = 4

	case 4:
		if val[3] < val[2] {
			var t uint16 = val[3]
			val[3] = val[2]
			val[2] = t
		}

		table[0] = constructHuffmanCode(1, val[0])
		table[1] = constructHuffmanCode(2, val[1])
		table[2] = constructHuffmanCode(1, val[0])
		table[3] = constructHuffmanCode(3, val[2])
		table[4] = constructHuffmanCode(1, val[0])
		table[5] = constructHuffmanCode(2, val[1])
		table[6] = constructHuffmanCode(1, val[0])
		table[7] = constructHuffmanCode(3, val[3])
		table_size = 8
	}

	for table_size != goal_size {
		copy(table[table_size:], table[:uint(table_size)])
		table_size <<= 1
	}

	return goal_size
}
