package brotli

/* Copyright 2013 Google Inc. All Rights Reserved.

   Distributed under MIT license.
   See file LICENSE for detail or copy at https://opensource.org/licenses/MIT
*/

/* Block split point selection utilities. */

type blockSplit struct {
	num_types          uint
	num_blocks         uint
	types              []byte
	lengths            []uint32
	types_alloc_size   uint
	lengths_alloc_size uint
}

const (
	kMaxLiteralHistograms        uint    = 100
	kMaxCommandHistograms        uint    = 50
	kLiteralBlockSwitchCost      float64 = 28.1
	kCommandBlockSwitchCost      float64 = 13.5
	kDistanceBlockSwitchCost     float64 = 14.6
	kLiteralStrideLength         uint    = 70
	kCommandStrideLength         uint    = 40
	kSymbolsPerLiteralHistogram  uint    = 544
	kSymbolsPerCommandHistogram  uint    = 530
	kSymbolsPerDistanceHistogram uint    = 544
	kMinLengthForBlockSplitting  uint    = 128
	kIterMulForRefining          uint    = 2
	kMinItersForRefining         uint    = 100
)

func countLiterals(cmds []command) uint {
	var total_length uint = 0
	/* Count how many we have. */

	for i := range cmds {
		total_length += uint(cmds[i].insert_len_)
	}

	return total_length
}

func copyLiteralsToByteArray(cmds []command, data []byte, offset uint, mask uint, literals []byte) {
	var pos uint = 0
	var from_pos uint = offset & mask
	for i := range cmds {
		var insert_len uint = uint(cmds[i].insert_len_)
		if from_pos+insert_len > mask {
			var head_size uint = mask + 1 - from_pos
			copy(literals[pos:], data[from_pos:][:head_size])
			from_pos = 0
			pos += head_size
			insert_len -= head_size
		}

		if insert_len > 0 {
			copy(literals[pos:], data[from_pos:][:insert_len])
			pos += insert_len
		}

		from_pos = uint((uint32(from_pos+insert_len) + commandCopyLen(&cmds[i])) & uint32(mask))
	}
}

func myRand(seed *uint32) uint32 {
	/* Initial seed should be 7. In this case, loop length is (1 << 29). */
	*seed *= 16807

	return *seed
}

func bitCost(count uint) float64 {
	if count == 0 {
		return -2.0
	} else {
		return fastLog2(count)
	}
}

const histogramsPerBatch = 64

const clustersPerBatch = 16

func initBlockSplit(self *blockSplit) {
	self.num_types = 0
	self.num_blocks = 0
	self.types = self.types[:0]
	self.lengths = self.lengths[:0]
	self.types_alloc_size = 0
	self.lengths_alloc_size = 0
}

func splitBlock(cmds []command, data []byte, pos uint, mask uint, params *encoderParams, literal_split *blockSplit, insert_and_copy_split *blockSplit, dist_split *blockSplit) {
	{
		var literals_count uint = countLiterals(cmds)
		var literals []byte = make([]byte, literals_count)

		/* Create a continuous array of literals. */
		copyLiteralsToByteArray(cmds, data, pos, mask, literals)

		/* Create the block split on the array of literals.
		   Literal histograms have alphabet size 256. */
		splitByteVectorLiteral(literals, literals_count, kSymbolsPerLiteralHistogram, kMaxLiteralHistograms, kLiteralStrideLength, kLiteralBlockSwitchCost, params, literal_split)

		literals = nil
	}
	{
		var insert_and_copy_codes []uint16 = make([]uint16, len(cmds))
		/* Compute prefix codes for commands. */

		for i := range cmds {
			insert_and_copy_codes[i] = cmds[i].cmd_prefix_
		}

		/* Create the block split on the array of command prefixes. */
		splitByteVectorCommand(insert_and_copy_codes, kSymbolsPerCommandHistogram, kMaxCommandHistograms, kCommandStrideLength, kCommandBlockSwitchCost, params, insert_and_copy_split)

		/* TODO: reuse for distances? */

		insert_and_copy_codes = nil
	}
	{
		var distance_prefixes []uint16 = make([]uint16, len(cmds))
		var j uint = 0
		/* Create a continuous array of distance prefixes. */

		for i := range cmds {
			var cmd *command = &cmds[i]
			if commandCopyLen(cmd) != 0 && cmd.cmd_prefix_ >= 128 {
				distance_prefixes[j] = cmd.dist_prefix_ & 0x3FF
				j++
			}
		}

		/* Create the block split on the array of distance prefixes. */
		splitByteVectorDistance(distance_prefixes, j, kSymbolsPerDistanceHistogram, kMaxCommandHistograms, kCommandStrideLength, kDistanceBlockSwitchCost, params, dist_split)

		distance_prefixes = nil
	}
}
