package brotli

import (
	"io"
	"math"
)

/* Copyright 2016 Google Inc. All Rights Reserved.

   Distributed under MIT license.
   See file LICENSE for detail or copy at https://opensource.org/licenses/MIT
*/

/** Minimal value for ::BROTLI_PARAM_LGWIN parameter. */
const minWindowBits = 10

/**
 * Maximal value for ::BROTLI_PARAM_LGWIN parameter.
 *
 * @note equal to @c BROTLI_MAX_DISTANCE_BITS constant.
 */
const maxWindowBits = 24

/**
 * Maximal value for ::BROTLI_PARAM_LGWIN parameter
 * in "Large Window Brotli" (32-bit).
 */
const largeMaxWindowBits = 30

/** Minimal value for ::BROTLI_PARAM_LGBLOCK parameter. */
const minInputBlockBits = 16

/** Maximal value for ::BROTLI_PARAM_LGBLOCK parameter. */
const maxInputBlockBits = 24

/** Minimal value for ::BROTLI_PARAM_QUALITY parameter. */
const minQuality = 0

/** Maximal value for ::BROTLI_PARAM_QUALITY parameter. */
const maxQuality = 11

/** Options for ::BROTLI_PARAM_MODE parameter. */
const (
	modeGeneric = 0
	modeText    = 1
	modeFont    = 2
)

/** Default value for ::BROTLI_PARAM_QUALITY parameter. */
const defaultQuality = 11

/** Default value for ::BROTLI_PARAM_LGWIN parameter. */
const defaultWindow = 22

/** Default value for ::BROTLI_PARAM_MODE parameter. */
const defaultMode = modeGeneric

/** Operations that can be performed by streaming encoder. */
const (
	operationProcess      = 0
	operationFlush        = 1
	operationFinish       = 2
	operationEmitMetadata = 3
)

const (
	streamProcessing     = 0
	streamFlushRequested = 1
	streamFinished       = 2
	streamMetadataHead   = 3
	streamMetadataBody   = 4
)

type Writer struct {
	dst     io.Writer
	options WriterOptions
	err     error

	params              encoderParams
	hasher_             hasherHandle
	input_pos_          uint64
	ringbuffer_         ringBuffer
	commands            []command
	num_literals_       uint
	last_insert_len_    uint
	last_flush_pos_     uint64
	last_processed_pos_ uint64
	dist_cache_         [numDistanceShortCodes]int
	saved_dist_cache_   [4]int
	last_bytes_         uint16
	last_bytes_bits_    byte
	prev_byte_          byte
	prev_byte2_         byte
	storage             []byte
	small_table_        [1 << 10]int
	large_table_        []int
	large_table_size_   uint
	cmd_depths_         [128]byte
	cmd_bits_           [128]uint16
	cmd_code_           [512]byte
	cmd_code_numbits_   uint
	command_buf_        []uint32
	literal_buf_        []byte
	tiny_buf_           struct {
		u64 [2]uint64
		u8  [16]byte
	}
	remaining_metadata_bytes_ uint32
	stream_state_             int
	is_last_block_emitted_    bool
	is_initialized_           bool
}

func inputBlockSize(s *Writer) uint {
	return uint(1) << uint(s.params.lgblock)
}

func unprocessedInputSize(s *Writer) uint64 {
	return s.input_pos_ - s.last_processed_pos_
}

func remainingInputBlockSize(s *Writer) uint {
	var delta uint64 = unprocessedInputSize(s)
	var block_size uint = inputBlockSize(s)
	if delta >= uint64(block_size) {
		return 0
	}
	return block_size - uint(delta)
}

/* Wraps 64-bit input position to 32-bit ring-buffer position preserving
   "not-a-first-lap" feature. */
func wrapPosition(position uint64) uint32 {
	var result uint32 = uint32(position)
	var gb uint64 = position >> 30
	if gb > 2 {
		/* Wrap every 2GiB; The first 3GB are continuous. */
		result = result&((1<<30)-1) | (uint32((gb-1)&1)+1)<<30
	}

	return result
}

func (s *Writer) getStorage(size int) []byte {
	if len(s.storage) < size {
		s.storage = make([]byte, size)
	}

	return s.storage
}

func hashTableSize(max_table_size uint, input_size uint) uint {
	var htsize uint = 256
	for htsize < max_table_size && htsize < input_size {
		htsize <<= 1
	}

	return htsize
}

func getHashTable(s *Writer, quality int, input_size uint, table_size *uint) []int {
	var max_table_size uint = maxHashTableSize(quality)
	var htsize uint = hashTableSize(max_table_size, input_size)
	/* Use smaller hash table when input.size() is smaller, since we
	   fill the table, incurring O(hash table size) overhead for
	   compression, and if the input is short, we won't need that
	   many hash table entries anyway. */

	var table []int
	assert(max_table_size >= 256)
	if quality == fastOnePassCompressionQuality {
		/* Only odd shifts are supported by fast-one-pass. */
		if htsize&0xAAAAA == 0 {
			htsize <<= 1
		}
	}

	if htsize <= uint(len(s.small_table_)) {
		table = s.small_table_[:]
	} else {
		if htsize > s.large_table_size_ {
			s.large_table_size_ = htsize
			s.large_table_ = nil
			s.large_table_ = make([]int, htsize)
		}

		table = s.large_table_
	}

	*table_size = htsize
	for i := 0; i < int(htsize); i++ {
		table[i] = 0
	}
	return table
}

func encodeWindowBits(lgwin int, large_window bool, last_bytes *uint16, last_bytes_bits *byte) {
	if large_window {
		*last_bytes = uint16((lgwin&0x3F)<<8 | 0x11)
		*last_bytes_bits = 14
	} else {
		if lgwin == 16 {
			*last_bytes = 0
			*last_bytes_bits = 1
		} else if lgwin == 17 {
			*last_bytes = 1
			*last_bytes_bits = 7
		} else if lgwin > 17 {
			*last_bytes = uint16((lgwin-17)<<1 | 0x01)
			*last_bytes_bits = 4
		} else {
			*last_bytes = uint16((lgwin-8)<<4 | 0x01)
			*last_bytes_bits = 7
		}
	}
}

/* Decide about the context map based on the ability of the prediction
   ability of the previous byte UTF8-prefix on the next byte. The
   prediction ability is calculated as Shannon entropy. Here we need
   Shannon entropy instead of 'BitsEntropy' since the prefix will be
   encoded with the remaining 6 bits of the following byte, and
   BitsEntropy will assume that symbol to be stored alone using Huffman
   coding. */

var kStaticContextMapContinuation = [64]uint32{
	1, 1, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
	0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
	0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
	0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
}
var kStaticContextMapSimpleUTF8 = [64]uint32{
	0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
	0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
	0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
	0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
}

func chooseContextMap(quality int, bigram_histo []uint32, num_literal_contexts *uint, literal_context_map *[]uint32) {
	var monogram_histo = [3]uint32{0}
	var two_prefix_histo = [6]uint32{0}
	var total uint
	var i uint
	var dummy uint
	var entropy [4]float64
	for i = 0; i < 9; i++ {
		monogram_histo[i%3] += bigram_histo[i]
		two_prefix_histo[i%6] += bigram_histo[i]
	}

	entropy[1] = shannonEntropy(monogram_histo[:], 3, &dummy)
	entropy[2] = (shannonEntropy(two_prefix_histo[:], 3, &dummy) + shannonEntropy(two_prefix_histo[3:], 3, &dummy))
	entropy[3] = 0
	for i = 0; i < 3; i++ {
		entropy[3] += shannonEntropy(bigram_histo[3*i:], 3, &dummy)
	}

	total = uint(monogram_histo[0] + monogram_histo[1] + monogram_histo[2])
	assert(total != 0)
	entropy[0] = 1.0 / float64(total)
	entropy[1] *= entropy[0]
	entropy[2] *= entropy[0]
	entropy[3] *= entropy[0]

	if quality < minQualityForHqContextModeling {
		/* 3 context models is a bit slower, don't use it at lower qualities. */
		entropy[3] = entropy[1] * 10
	}

	/* If expected savings by symbol are less than 0.2 bits, skip the
	   context modeling -- in exchange for faster decoding speed. */
	if entropy[1]-entropy[2] < 0.2 && entropy[1]-entropy[3] < 0.2 {
		*num_literal_contexts = 1
	} else if entropy[2]-entropy[3] < 0.02 {
		*num_literal_contexts = 2
		*literal_context_map = kStaticContextMapSimpleUTF8[:]
	} else {
		*num_literal_contexts = 3
		*literal_context_map = kStaticContextMapContinuation[:]
	}
}

/* Decide if we want to use a more complex static context map containing 13
   context values, based on the entropy reduction of histograms over the
   first 5 bits of literals. */

var kStaticContextMapComplexUTF8 = [64]uint32{
	11, 11, 12, 12, /* 0 special */
	0, 0, 0, 0, /* 4 lf */
	1, 1, 9, 9, /* 8 space */
	2, 2, 2, 2, /* !, first after space/lf and after something else. */
	1, 1, 1, 1, /* " */
	8, 3, 3, 3, /* % */
	1, 1, 1, 1, /* ({[ */
	2, 2, 2, 2, /* }]) */
	8, 4, 4, 4, /* :; */
	8, 7, 4, 4, /* . */
	8, 0, 0, 0, /* > */
	3, 3, 3, 3, /* [0..9] */
	5, 5, 10, 5, /* [A-Z] */
	5, 5, 10, 5,
	6, 6, 6, 6, /* [a-z] */
	6, 6, 6, 6,
}

func shouldUseComplexStaticContextMap(input []byte, start_pos uint, length uint, mask uint, quality int, size_hint uint, num_literal_contexts *uint, literal_context_map *[]uint32) bool {
	/* Try the more complex static context map only for long data. */
	if size_hint < 1<<20 {
		return false
	} else {
		var end_pos uint = start_pos + length
		var combined_histo = [32]uint32{0}
		var context_histo = [13][32]uint32{[32]uint32{0}}
		var total uint32 = 0
		var entropy [3]float64
		var dummy uint
		var i uint
		var utf8_lut contextLUT = getContextLUT(contextUTF8)
		/* To make entropy calculations faster and to fit on the stack, we collect
		   histograms over the 5 most significant bits of literals. One histogram
		   without context and 13 additional histograms for each context value. */
		for ; start_pos+64 <= end_pos; start_pos += 4096 {
			var stride_end_pos uint = start_pos + 64
			var prev2 byte = input[start_pos&mask]
			var prev1 byte = input[(start_pos+1)&mask]
			var pos uint

			/* To make the analysis of the data faster we only examine 64 byte long
			   strides at every 4kB intervals. */
			for pos = start_pos + 2; pos < stride_end_pos; pos++ {
				var literal byte = input[pos&mask]
				var context byte = byte(kStaticContextMapComplexUTF8[getContext(prev1, prev2, utf8_lut)])
				total++
				combined_histo[literal>>3]++
				context_histo[context][literal>>3]++
				prev2 = prev1
				prev1 = literal
			}
		}

		entropy[1] = shannonEntropy(combined_histo[:], 32, &dummy)
		entropy[2] = 0
		for i = 0; i < 13; i++ {
			entropy[2] += shannonEntropy(context_histo[i][0:], 32, &dummy)
		}

		entropy[0] = 1.0 / float64(total)
		entropy[1] *= entropy[0]
		entropy[2] *= entropy[0]

		/* The triggering heuristics below were tuned by compressing the individual
		   files of the silesia corpus. If we skip this kind of context modeling
		   for not very well compressible input (i.e. entropy using context modeling
		   is 60% of maximal entropy) or if expected savings by symbol are less
		   than 0.2 bits, then in every case when it triggers, the final compression
		   ratio is improved. Note however that this heuristics might be too strict
		   for some cases and could be tuned further. */
		if entropy[2] > 3.0 || entropy[1]-entropy[2] < 0.2 {
			return false
		} else {
			*num_literal_contexts = 13
			*literal_context_map = kStaticContextMapComplexUTF8[:]
			return true
		}
	}
}

func decideOverLiteralContextModeling(input []byte, start_pos uint, length uint, mask uint, quality int, size_hint uint, num_literal_contexts *uint, literal_context_map *[]uint32) {
	if quality < minQualityForContextModeling || length < 64 {
		return
	} else if shouldUseComplexStaticContextMap(input, start_pos, length, mask, quality, size_hint, num_literal_contexts, literal_context_map) {
	} else /* Context map was already set, nothing else to do. */
	{
		var end_pos uint = start_pos + length
		/* Gather bi-gram data of the UTF8 byte prefixes. To make the analysis of
		   UTF8 data faster we only examine 64 byte long strides at every 4kB
		   intervals. */

		var bigram_prefix_histo = [9]uint32{0}
		for ; start_pos+64 <= end_pos; start_pos += 4096 {
			var lut = [4]int{0, 0, 1, 2}
			var stride_end_pos uint = start_pos + 64
			var prev int = lut[input[start_pos&mask]>>6] * 3
			var pos uint
			for pos = start_pos + 1; pos < stride_end_pos; pos++ {
				var literal byte = input[pos&mask]
				bigram_prefix_histo[prev+lut[literal>>6]]++
				prev = lut[literal>>6] * 3
			}
		}

		chooseContextMap(quality, bigram_prefix_histo[0:], num_literal_contexts, literal_context_map)
	}
}

func shouldCompress_encode(data []byte, mask uint, last_flush_pos uint64, bytes uint, num_literals uint, num_commands uint) bool {
	/* TODO: find more precise minimal block overhead. */
	if bytes <= 2 {
		return false
	}
	if num_commands < (bytes>>8)+2 {
		if float64(num_literals) > 0.99*float64(bytes) {
			var literal_histo = [256]uint32{0}
			const kSampleRate uint32 = 13
			const kMinEntropy float64 = 7.92
			var bit_cost_threshold float64 = float64(bytes) * kMinEntropy / float64(kSampleRate)
			var t uint = uint((uint32(bytes) + kSampleRate - 1) / kSampleRate)
			var pos uint32 = uint32(last_flush_pos)
			var i uint
			for i = 0; i < t; i++ {
				literal_histo[data[pos&uint32(mask)]]++
				pos += kSampleRate
			}

			if bitsEntropy(literal_histo[:], 256) > bit_cost_threshold {
				return false
			}
		}
	}

	return true
}

/* Chooses the literal context mode for a metablock */
func chooseContextMode(params *encoderParams, data []byte, pos uint, mask uint, length uint) int {
	/* We only do the computation for the option of something else than
	   CONTEXT_UTF8 for the highest qualities */
	if params.quality >= minQualityForHqBlockSplitting && !isMostlyUTF8(data, pos, mask, length, kMinUTF8Ratio) {
		return contextSigned
	}

	return contextUTF8
}

func writeMetaBlockInternal(data []byte, mask uint, last_flush_pos uint64, bytes uint, is_last bool, literal_context_mode int, params *encoderParams, prev_byte byte, prev_byte2 byte, num_literals uint, commands []command, saved_dist_cache []int, dist_cache []int, storage_ix *uint, storage []byte) {
	var wrapped_last_flush_pos uint32 = wrapPosition(last_flush_pos)
	var last_bytes uint16
	var last_bytes_bits byte
	var literal_context_lut contextLUT = getContextLUT(literal_context_mode)
	var block_params encoderParams = *params

	if bytes == 0 {
		/* Write the ISLAST and ISEMPTY bits. */
		writeBits(2, 3, storage_ix, storage)

		*storage_ix = (*storage_ix + 7) &^ 7
		return
	}

	if !shouldCompress_encode(data, mask, last_flush_pos, bytes, num_literals, uint(len(commands))) {
		/* Restore the distance cache, as its last update by
		   CreateBackwardReferences is now unused. */
		copy(dist_cache, saved_dist_cache[:4])

		storeUncompressedMetaBlock(is_last, data, uint(wrapped_last_flush_pos), mask, bytes, storage_ix, storage)
		return
	}

	assert(*storage_ix <= 14)
	last_bytes = uint16(storage[1])<<8 | uint16(storage[0])
	last_bytes_bits = byte(*storage_ix)
	if params.quality <= maxQualityForStaticEntropyCodes {
		storeMetaBlockFast(data, uint(wrapped_last_flush_pos), bytes, mask, is_last, params, commands, storage_ix, storage)
	} else if params.quality < minQualityForBlockSplit {
		storeMetaBlockTrivial(data, uint(wrapped_last_flush_pos), bytes, mask, is_last, params, commands, storage_ix, storage)
	} else {
		mb := getMetaBlockSplit()
		if params.quality < minQualityForHqBlockSplitting {
			var num_literal_contexts uint = 1
			var literal_context_map []uint32 = nil
			if !params.disable_literal_context_modeling {
				decideOverLiteralContextModeling(data, uint(wrapped_last_flush_pos), bytes, mask, params.quality, params.size_hint, &num_literal_contexts, &literal_context_map)
			}

			buildMetaBlockGreedy(data, uint(wrapped_last_flush_pos), mask, prev_byte, prev_byte2, literal_context_lut, num_literal_contexts, literal_context_map, commands, mb)
		} else {
			buildMetaBlock(data, uint(wrapped_last_flush_pos), mask, &block_params, prev_byte, prev_byte2, commands, literal_context_mode, mb)
		}

		if params.quality >= minQualityForOptimizeHistograms {
			/* The number of distance symbols effectively used for distance
			   histograms. It might be less than distance alphabet size
			   for "Large Window Brotli" (32-bit). */
			var num_effective_dist_codes uint32 = block_params.dist.alphabet_size
			if num_effective_dist_codes > numHistogramDistanceSymbols {
				num_effective_dist_codes = numHistogramDistanceSymbols
			}

			optimizeHistograms(num_effective_dist_codes, mb)
		}

		storeMetaBlock(data, uint(wrapped_last_flush_pos), bytes, mask, prev_byte, prev_byte2, is_last, &block_params, literal_context_mode, commands, mb, storage_ix, storage)
		freeMetaBlockSplit(mb)
	}

	if bytes+4 < *storage_ix>>3 {
		/* Restore the distance cache and last byte. */
		copy(dist_cache, saved_dist_cache[:4])

		storage[0] = byte(last_bytes)
		storage[1] = byte(last_bytes >> 8)
		*storage_ix = uint(last_bytes_bits)
		storeUncompressedMetaBlock(is_last, data, uint(wrapped_last_flush_pos), mask, bytes, storage_ix, storage)
	}
}

func chooseDistanceParams(params *encoderParams) {
	var distance_postfix_bits uint32 = 0
	var num_direct_distance_codes uint32 = 0

	if params.quality >= minQualityForNonzeroDistanceParams {
		var ndirect_msb uint32
		if params.mode == modeFont {
			distance_postfix_bits = 1
			num_direct_distance_codes = 12
		} else {
			distance_postfix_bits = params.dist.distance_postfix_bits
			num_direct_distance_codes = params.dist.num_direct_distance_codes
		}

		ndirect_msb = (num_direct_distance_codes >> distance_postfix_bits) & 0x0F
		if distance_postfix_bits > maxNpostfix || num_direct_distance_codes > maxNdirect || ndirect_msb<<distance_postfix_bits != num_direct_distance_codes {
			distance_postfix_bits = 0
			num_direct_distance_codes = 0
		}
	}

	initDistanceParams(params, distance_postfix_bits, num_direct_distance_codes)
}

func ensureInitialized(s *Writer) bool {
	if s.is_initialized_ {
		return true
	}

	s.last_bytes_bits_ = 0
	s.last_bytes_ = 0
	s.remaining_metadata_bytes_ = math.MaxUint32

	sanitizeParams(&s.params)
	s.params.lgblock = computeLgBlock(&s.params)
	chooseDistanceParams(&s.params)

	ringBufferSetup(&s.params, &s.ringbuffer_)

	/* Initialize last byte with stream header. */
	{
		var lgwin int = int(s.params.lgwin)
		if s.params.quality == fastOnePassCompressionQuality || s.params.quality == fastTwoPassCompressionQuality {
			lgwin = brotli_max_int(lgwin, 18)
		}

		encodeWindowBits(lgwin, s.params.large_window, &s.last_bytes_, &s.last_bytes_bits_)
	}

	if s.params.quality == fastOnePassCompressionQuality {
		s.cmd_depths_ = [128]byte{
			0, 4, 4, 5, 6, 6, 7, 7, 7, 7, 7, 8, 8, 8, 8, 8,
			0, 0, 0, 4, 4, 4, 4, 4, 5, 5, 6, 6, 6, 6, 7, 7,
			7, 7, 10, 10, 10, 10, 10, 10, 0, 4, 4, 5, 5, 5, 6, 6,
			7, 8, 8, 9, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10,
			5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			6, 6, 6, 6, 6, 6, 5, 5, 5, 5, 5, 5, 4, 4, 4, 4,
			4, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 7, 7, 7, 8, 10,
			12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12,
		}
		s.cmd_bits_ = [128]uint16{
			0, 0, 8, 9, 3, 35, 7, 71,
			39, 103, 23, 47, 175, 111, 239, 31,
			0, 0, 0, 4, 12, 2, 10, 6,
			13, 29, 11, 43, 27, 59, 87, 55,
			15, 79, 319, 831, 191, 703, 447, 959,
			0, 14, 1, 25, 5, 21, 19, 51,
			119, 159, 95, 223, 479, 991, 63, 575,
			127, 639, 383, 895, 255, 767, 511, 1023,
			14, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			27, 59, 7, 39, 23, 55, 30, 1, 17, 9, 25, 5, 0, 8, 4, 12,
			2, 10, 6, 21, 13, 29, 3, 19, 11, 15, 47, 31, 95, 63, 127, 255,
			767, 2815, 1791, 3839, 511, 2559, 1535, 3583, 1023, 3071, 2047, 4095,
		}
		s.cmd_code_ = [512]byte{
			0xff, 0x77, 0xd5, 0xbf, 0xe7, 0xde, 0xea, 0x9e, 0x51, 0x5d, 0xde, 0xc6,
			0x70, 0x57, 0xbc, 0x58, 0x58, 0x58, 0xd8, 0xd8, 0x58, 0xd5, 0xcb, 0x8c,
			0xea, 0xe0, 0xc3, 0x87, 0x1f, 0x83, 0xc1, 0x60, 0x1c, 0x67, 0xb2, 0xaa,
			0x06, 0x83, 0xc1, 0x60, 0x30, 0x18, 0xcc, 0xa1, 0xce, 0x88, 0x54, 0x94,
			0x46, 0xe1, 0xb0, 0xd0, 0x4e, 0xb2, 0xf7, 0x04, 0x00,
		}
		s.cmd_code_numbits_ = 448
	}

	s.is_initialized_ = true
	return true
}

func encoderInitParams(params *encoderParams) {
	params.mode = defaultMode
	params.large_window = false
	params.quality = defaultQuality
	params.lgwin = defaultWindow
	params.lgblock = 0
	params.size_hint = 0
	params.disable_literal_context_modeling = false
	initEncoderDictionary(&params.dictionary)
	params.dist.distance_postfix_bits = 0
	params.dist.num_direct_distance_codes = 0
	params.dist.alphabet_size = uint32(distanceAlphabetSize(0, 0, maxDistanceBits))
	params.dist.max_distance = maxDistance
}

func encoderInitState(s *Writer) {
	encoderInitParams(&s.params)
	s.input_pos_ = 0
	s.commands = s.commands[:0]
	s.num_literals_ = 0
	s.last_insert_len_ = 0
	s.last_flush_pos_ = 0
	s.last_processed_pos_ = 0
	s.prev_byte_ = 0
	s.prev_byte2_ = 0
	if s.hasher_ != nil {
		s.hasher_.Common().is_prepared_ = false
	}
	s.cmd_code_numbits_ = 0
	s.stream_state_ = streamProcessing
	s.is_last_block_emitted_ = false
	s.is_initialized_ = false

	ringBufferInit(&s.ringbuffer_)

	/* Initialize distance cache. */
	s.dist_cache_[0] = 4

	s.dist_cache_[1] = 11
	s.dist_cache_[2] = 15
	s.dist_cache_[3] = 16

	/* Save the state of the distance cache in case we need to restore it for
	   emitting an uncompressed block. */
	copy(s.saved_dist_cache_[:], s.dist_cache_[:])
}

/*
   Copies the given input data to the internal ring buffer of the compressor.
   No processing of the data occurs at this time and this function can be
   called multiple times before calling WriteBrotliData() to process the
   accumulated input. At most input_block_size() bytes of input data can be
   copied to the ring buffer, otherwise the next WriteBrotliData() will fail.
*/
func copyInputToRingBuffer(s *Writer, input_size uint, input_buffer []byte) {
	var ringbuffer_ *ringBuffer = &s.ringbuffer_
	ringBufferWrite(input_buffer, input_size, ringbuffer_)
	s.input_pos_ += uint64(input_size)

	/* TL;DR: If needed, initialize 7 more bytes in the ring buffer to make the
	   hashing not depend on uninitialized data. This makes compression
	   deterministic and it prevents uninitialized memory warnings in Valgrind.
	   Even without erasing, the output would be valid (but nondeterministic).

	   Background information: The compressor stores short (at most 8 bytes)
	   substrings of the input already read in a hash table, and detects
	   repetitions by looking up such substrings in the hash table. If it
	   can find a substring, it checks whether the substring is really there
	   in the ring buffer (or it's just a hash collision). Should the hash
	   table become corrupt, this check makes sure that the output is
	   still valid, albeit the compression ratio would be bad.

	   The compressor populates the hash table from the ring buffer as it's
	   reading new bytes from the input. However, at the last few indexes of
	   the ring buffer, there are not enough bytes to build full-length
	   substrings from. Since the hash table always contains full-length
	   substrings, we erase with dummy zeros here to make sure that those
	   substrings will contain zeros at the end instead of uninitialized
	   data.

	   Please note that erasing is not necessary (because the
	   memory region is already initialized since he ring buffer
	   has a `tail' that holds a copy of the beginning,) so we
	   skip erasing if we have already gone around at least once in
	   the ring buffer.

	   Only clear during the first round of ring-buffer writes. On
	   subsequent rounds data in the ring-buffer would be affected. */
	if ringbuffer_.pos_ <= ringbuffer_.mask_ {
		/* This is the first time when the ring buffer is being written.
		   We clear 7 bytes just after the bytes that have been copied from
		   the input buffer.

		   The ring-buffer has a "tail" that holds a copy of the beginning,
		   but only once the ring buffer has been fully written once, i.e.,
		   pos <= mask. For the first time, we need to write values
		   in this tail (where index may be larger than mask), so that
		   we have exactly defined behavior and don't read uninitialized
		   memory. Due to performance reasons, hashing reads data using a
		   LOAD64, which can go 7 bytes beyond the bytes written in the
		   ring-buffer. */
		for i := 0; i < int(7); i++ {
			ringbuffer_.buffer_[ringbuffer_.pos_:][i] = 0
		}
	}
}

/* Marks all input as processed.
   Returns true if position wrapping occurs. */
func updateLastProcessedPos(s *Writer) bool {
	var wrapped_last_processed_pos uint32 = wrapPosition(s.last_processed_pos_)
	var wrapped_input_pos uint32 = wrapPosition(s.input_pos_)
	s.last_processed_pos_ = s.input_pos_
	return wrapped_input_pos < wrapped_last_processed_pos
}

func extendLastCommand(s *Writer, bytes *uint32, wrapped_last_processed_pos *uint32) {
	var last_command *command = &s.commands[len(s.commands)-1]
	var data []byte = s.ringbuffer_.buffer_
	var mask uint32 = s.ringbuffer_.mask_
	var max_backward_distance uint64 = ((uint64(1)) << s.params.lgwin) - windowGap
	var last_copy_len uint64 = uint64(last_command.copy_len_) & 0x1FFFFFF
	var last_processed_pos uint64 = s.last_processed_pos_ - last_copy_len
	var max_distance uint64
	if last_processed_pos < max_backward_distance {
		max_distance = last_processed_pos
	} else {
		max_distance = max_backward_distance
	}
	var cmd_dist uint64 = uint64(s.dist_cache_[0])
	var distance_code uint32 = commandRestoreDistanceCode(last_command, &s.params.dist)
	if distance_code < numDistanceShortCodes || uint64(distance_code-(numDistanceShortCodes-1)) == cmd_dist {
		if cmd_dist <= max_distance {
			for *bytes != 0 && data[*wrapped_last_processed_pos&mask] == data[(uint64(*wrapped_last_processed_pos)-cmd_dist)&uint64(mask)] {
				last_command.copy_len_++
				(*bytes)--
				(*wrapped_last_processed_pos)++
			}
		}

		/* The copy length is at most the metablock size, and thus expressible. */
		getLengthCode(uint(last_command.insert_len_), uint(int(last_command.copy_len_&0x1FFFFFF)+int(last_command.copy_len_>>25)), (last_command.dist_prefix_&0x3FF == 0), &last_command.cmd_prefix_)
	}
}

/*
   Processes the accumulated input data and writes
   the new output meta-block to s.dest, if one has been
   created (otherwise the processed input data is buffered internally).
   If |is_last| or |force_flush| is true, an output meta-block is
   always created. However, until |is_last| is true encoder may retain up
   to 7 bits of the last byte of output. To force encoder to dump the remaining
   bits use WriteMetadata() to append an empty meta-data block.
   Returns false if the size of the input data is larger than
   input_block_size().
*/
func encodeData(s *Writer, is_last bool, force_flush bool) bool {
	var delta uint64 = unprocessedInputSize(s)
	var bytes uint32 = uint32(delta)
	var wrapped_last_processed_pos uint32 = wrapPosition(s.last_processed_pos_)
	var data []byte
	var mask uint32
	var literal_context_mode int

	data = s.ringbuffer_.buffer_
	mask = s.ringbuffer_.mask_

	/* Adding more blocks after "last" block is forbidden. */
	if s.is_last_block_emitted_ {
		return false
	}
	if is_last {
		s.is_last_block_emitted_ = true
	}

	if delta > uint64(inputBlockSize(s)) {
		return false
	}

	if s.params.quality == fastTwoPassCompressionQuality {
		if s.command_buf_ == nil || cap(s.command_buf_) < int(kCompressFragmentTwoPassBlockSize) {
			s.command_buf_ = make([]uint32, kCompressFragmentTwoPassBlockSize)
			s.literal_buf_ = make([]byte, kCompressFragmentTwoPassBlockSize)
		} else {
			s.command_buf_ = s.command_buf_[:kCompressFragmentTwoPassBlockSize]
			s.literal_buf_ = s.literal_buf_[:kCompressFragmentTwoPassBlockSize]
		}
	}

	if s.params.quality == fastOnePassCompressionQuality || s.params.quality == fastTwoPassCompressionQuality {
		var storage []byte
		var storage_ix uint = uint(s.last_bytes_bits_)
		var table_size uint
		var table []int

		if delta == 0 && !is_last {
			/* We have no new input data and we don't have to finish the stream, so
			   nothing to do. */
			return true
		}

		storage = s.getStorage(int(2*bytes + 503))
		storage[0] = byte(s.last_bytes_)
		storage[1] = byte(s.last_bytes_ >> 8)
		table = getHashTable(s, s.params.quality, uint(bytes), &table_size)
		if s.params.quality == fastOnePassCompressionQuality {
			compressFragmentFast(data[wrapped_last_processed_pos&mask:], uint(bytes), is_last, table, table_size, s.cmd_depths_[:], s.cmd_bits_[:], &s.cmd_code_numbits_, s.cmd_code_[:], &storage_ix, storage)
		} else {
			compressFragmentTwoPass(data[wrapped_last_processed_pos&mask:], uint(bytes), is_last, s.command_buf_, s.literal_buf_, table, table_size, &storage_ix, storage)
		}

		s.last_bytes_ = uint16(storage[storage_ix>>3])
		s.last_bytes_bits_ = byte(storage_ix & 7)
		updateLastProcessedPos(s)
		s.writeOutput(storage[:storage_ix>>3])
		return true
	}
	{
		/* Theoretical max number of commands is 1 per 2 bytes. */
		newsize := len(s.commands) + int(bytes)/2 + 1
		if newsize > cap(s.commands) {
			/* Reserve a bit more memory to allow merging with a next block
			   without reallocation: that would impact speed. */
			newsize += int(bytes/4) + 16

			new_commands := make([]command, len(s.commands), newsize)
			if s.commands != nil {
				copy(new_commands, s.commands)
			}

			s.commands = new_commands
		}
	}

	initOrStitchToPreviousBlock(&s.hasher_, data, uint(mask), &s.params, uint(wrapped_last_processed_pos), uint(bytes), is_last)

	literal_context_mode = chooseContextMode(&s.params, data, uint(wrapPosition(s.last_flush_pos_)), uint(mask), uint(s.input_pos_-s.last_flush_pos_))

	if len(s.commands) != 0 && s.last_insert_len_ == 0 {
		extendLastCommand(s, &bytes, &wrapped_last_processed_pos)
	}

	if s.params.quality == zopflificationQuality {
		assert(s.params.hasher.type_ == 10)
		createZopfliBackwardReferences(uint(bytes), uint(wrapped_last_processed_pos), data, uint(mask), &s.params, s.hasher_.(*h10), s.dist_cache_[:], &s.last_insert_len_, &s.commands, &s.num_literals_)
	} else if s.params.quality == hqZopflificationQuality {
		assert(s.params.hasher.type_ == 10)
		createHqZopfliBackwardReferences(uint(bytes), uint(wrapped_last_processed_pos), data, uint(mask), &s.params, s.hasher_, s.dist_cache_[:], &s.last_insert_len_, &s.commands, &s.num_literals_)
	} else {
		createBackwardReferences(uint(bytes), uint(wrapped_last_processed_pos), data, uint(mask), &s.params, s.hasher_, s.dist_cache_[:], &s.last_insert_len_, &s.commands, &s.num_literals_)
	}
	{
		var max_length uint = maxMetablockSize(&s.params)
		var max_literals uint = max_length / 8
		max_commands := int(max_length / 8)
		var processed_bytes uint = uint(s.input_pos_ - s.last_flush_pos_)
		var next_input_fits_metablock bool = (processed_bytes+inputBlockSize(s) <= max_length)
		var should_flush bool = (s.params.quality < minQualityForBlockSplit && s.num_literals_+uint(len(s.commands)) >= maxNumDelayedSymbols)
		/* If maximal possible additional block doesn't fit metablock, flush now. */
		/* TODO: Postpone decision until next block arrives? */

		/* If block splitting is not used, then flush as soon as there is some
		   amount of commands / literals produced. */
		if !is_last && !force_flush && !should_flush && next_input_fits_metablock && s.num_literals_ < max_literals && len(s.commands) < max_commands {
			/* Merge with next input block. Everything will happen later. */
			if updateLastProcessedPos(s) {
				hasherReset(s.hasher_)
			}

			return true
		}
	}

	/* Create the last insert-only command. */
	if s.last_insert_len_ > 0 {
		s.commands = append(s.commands, makeInsertCommand(s.last_insert_len_))
		s.num_literals_ += s.last_insert_len_
		s.last_insert_len_ = 0
	}

	if !is_last && s.input_pos_ == s.last_flush_pos_ {
		/* We have no new input data and we don't have to finish the stream, so
		   nothing to do. */
		return true
	}

	assert(s.input_pos_ >= s.last_flush_pos_)
	assert(s.input_pos_ > s.last_flush_pos_ || is_last)
	assert(s.input_pos_-s.last_flush_pos_ <= 1<<24)
	{
		var metablock_size uint32 = uint32(s.input_pos_ - s.last_flush_pos_)
		var storage []byte = s.getStorage(int(2*metablock_size + 503))
		var storage_ix uint = uint(s.last_bytes_bits_)
		storage[0] = byte(s.last_bytes_)
		storage[1] = byte(s.last_bytes_ >> 8)
		writeMetaBlockInternal(data, uint(mask), s.last_flush_pos_, uint(metablock_size), is_last, literal_context_mode, &s.params, s.prev_byte_, s.prev_byte2_, s.num_literals_, s.commands, s.saved_dist_cache_[:], s.dist_cache_[:], &storage_ix, storage)
		s.last_bytes_ = uint16(storage[storage_ix>>3])
		s.last_bytes_bits_ = byte(storage_ix & 7)
		s.last_flush_pos_ = s.input_pos_
		if updateLastProcessedPos(s) {
			hasherReset(s.hasher_)
		}

		if s.last_flush_pos_ > 0 {
			s.prev_byte_ = data[(uint32(s.last_flush_pos_)-1)&mask]
		}

		if s.last_flush_pos_ > 1 {
			s.prev_byte2_ = data[uint32(s.last_flush_pos_-2)&mask]
		}

		s.commands = s.commands[:0]
		s.num_literals_ = 0

		/* Save the state of the distance cache in case we need to restore it for
		   emitting an uncompressed block. */
		copy(s.saved_dist_cache_[:], s.dist_cache_[:])

		s.writeOutput(storage[:storage_ix>>3])
		return true
	}
}

/* Dumps remaining output bits and metadata header to |header|.
   Returns number of produced bytes.
   REQUIRED: |header| should be 8-byte aligned and at least 16 bytes long.
   REQUIRED: |block_size| <= (1 << 24). */
func writeMetadataHeader(s *Writer, block_size uint, header []byte) uint {
	storage_ix := uint(s.last_bytes_bits_)
	header[0] = byte(s.last_bytes_)
	header[1] = byte(s.last_bytes_ >> 8)
	s.last_bytes_ = 0
	s.last_bytes_bits_ = 0

	writeBits(1, 0, &storage_ix, header)
	writeBits(2, 3, &storage_ix, header)
	writeBits(1, 0, &storage_ix, header)
	if block_size == 0 {
		writeBits(2, 0, &storage_ix, header)
	} else {
		var nbits uint32
		if block_size == 1 {
			nbits = 0
		} else {
			nbits = log2FloorNonZero(uint(uint32(block_size)-1)) + 1
		}
		var nbytes uint32 = (nbits + 7) / 8
		writeBits(2, uint64(nbytes), &storage_ix, header)
		writeBits(uint(8*nbytes), uint64(block_size)-1, &storage_ix, header)
	}

	return (storage_ix + 7) >> 3
}

func injectBytePaddingBlock(s *Writer) {
	var seal uint32 = uint32(s.last_bytes_)
	var seal_bits uint = uint(s.last_bytes_bits_)
	s.last_bytes_ = 0
	s.last_bytes_bits_ = 0

	/* is_last = 0, data_nibbles = 11, reserved = 0, meta_nibbles = 00 */
	seal |= 0x6 << seal_bits

	seal_bits += 6

	destination := s.tiny_buf_.u8[:]

	destination[0] = byte(seal)
	if seal_bits > 8 {
		destination[1] = byte(seal >> 8)
	}
	if seal_bits > 16 {
		destination[2] = byte(seal >> 16)
	}
	s.writeOutput(destination[:(seal_bits+7)>>3])
}

func checkFlushComplete(s *Writer) {
	if s.stream_state_ == streamFlushRequested && s.err == nil {
		s.stream_state_ = streamProcessing
	}
}

func encoderCompressStreamFast(s *Writer, op int, available_in *uint, next_in *[]byte) bool {
	var block_size_limit uint = uint(1) << s.params.lgwin
	var buf_size uint = brotli_min_size_t(kCompressFragmentTwoPassBlockSize, brotli_min_size_t(*available_in, block_size_limit))
	var command_buf []uint32 = nil
	var literal_buf []byte = nil
	if s.params.quality != fastOnePassCompressionQuality && s.params.quality != fastTwoPassCompressionQuality {
		return false
	}

	if s.params.quality == fastTwoPassCompressionQuality {
		if s.command_buf_ == nil || cap(s.command_buf_) < int(buf_size) {
			s.command_buf_ = make([]uint32, buf_size)
			s.literal_buf_ = make([]byte, buf_size)
		} else {
			s.command_buf_ = s.command_buf_[:buf_size]
			s.literal_buf_ = s.literal_buf_[:buf_size]
		}

		command_buf = s.command_buf_
		literal_buf = s.literal_buf_
	}

	for {
		if s.stream_state_ == streamFlushRequested && s.last_bytes_bits_ != 0 {
			injectBytePaddingBlock(s)
			continue
		}

		/* Compress block only when stream is not
		   finished, there is no pending flush request, and there is either
		   additional input or pending operation. */
		if s.stream_state_ == streamProcessing && (*available_in != 0 || op != int(operationProcess)) {
			var block_size uint = brotli_min_size_t(block_size_limit, *available_in)
			var is_last bool = (*available_in == block_size) && (op == int(operationFinish))
			var force_flush bool = (*available_in == block_size) && (op == int(operationFlush))
			var max_out_size uint = 2*block_size + 503
			var storage []byte = nil
			var storage_ix uint = uint(s.last_bytes_bits_)
			var table_size uint
			var table []int

			if force_flush && block_size == 0 {
				s.stream_state_ = streamFlushRequested
				continue
			}

			storage = s.getStorage(int(max_out_size))

			storage[0] = byte(s.last_bytes_)
			storage[1] = byte(s.last_bytes_ >> 8)
			table = getHashTable(s, s.params.quality, block_size, &table_size)

			if s.params.quality == fastOnePassCompressionQuality {
				compressFragmentFast(*next_in, block_size, is_last, table, table_size, s.cmd_depths_[:], s.cmd_bits_[:], &s.cmd_code_numbits_, s.cmd_code_[:], &storage_ix, storage)
			} else {
				compressFragmentTwoPass(*next_in, block_size, is_last, command_buf, literal_buf, table, table_size, &storage_ix, storage)
			}

			*next_in = (*next_in)[block_size:]
			*available_in -= block_size
			var out_bytes uint = storage_ix >> 3
			s.writeOutput(storage[:out_bytes])

			s.last_bytes_ = uint16(storage[storage_ix>>3])
			s.last_bytes_bits_ = byte(storage_ix & 7)

			if force_flush {
				s.stream_state_ = streamFlushRequested
			}
			if is_last {
				s.stream_state_ = streamFinished
			}
			continue
		}

		break
	}

	checkFlushComplete(s)
	return true
}

func processMetadata(s *Writer, available_in *uint, next_in *[]byte) bool {
	if *available_in > 1<<24 {
		return false
	}

	/* Switch to metadata block workflow, if required. */
	if s.stream_state_ == streamProcessing {
		s.remaining_metadata_bytes_ = uint32(*available_in)
		s.stream_state_ = streamMetadataHead
	}

	if s.stream_state_ != streamMetadataHead && s.stream_state_ != streamMetadataBody {
		return false
	}

	for {
		if s.stream_state_ == streamFlushRequested && s.last_bytes_bits_ != 0 {
			injectBytePaddingBlock(s)
			continue
		}

		if s.input_pos_ != s.last_flush_pos_ {
			var result bool = encodeData(s, false, true)
			if !result {
				return false
			}
			continue
		}

		if s.stream_state_ == streamMetadataHead {
			n := writeMetadataHeader(s, uint(s.remaining_metadata_bytes_), s.tiny_buf_.u8[:])
			s.writeOutput(s.tiny_buf_.u8[:n])
			s.stream_state_ = streamMetadataBody
			continue
		} else {
			/* Exit workflow only when there is no more input and no more output.
			   Otherwise client may continue producing empty metadata blocks. */
			if s.remaining_metadata_bytes_ == 0 {
				s.remaining_metadata_bytes_ = math.MaxUint32
				s.stream_state_ = streamProcessing
				break
			}

			/* This guarantees progress in "TakeOutput" workflow. */
			var c uint32 = brotli_min_uint32_t(s.remaining_metadata_bytes_, 16)
			copy(s.tiny_buf_.u8[:], (*next_in)[:c])
			*next_in = (*next_in)[c:]
			*available_in -= uint(c)
			s.remaining_metadata_bytes_ -= c
			s.writeOutput(s.tiny_buf_.u8[:c])

			continue
		}
	}

	return true
}

func updateSizeHint(s *Writer, available_in uint) {
	if s.params.size_hint == 0 {
		var delta uint64 = unprocessedInputSize(s)
		var tail uint64 = uint64(available_in)
		var limit uint32 = 1 << 30
		var total uint32
		if (delta >= uint64(limit)) || (tail >= uint64(limit)) || ((delta + tail) >= uint64(limit)) {
			total = limit
		} else {
			total = uint32(delta + tail)
		}

		s.params.size_hint = uint(total)
	}
}

func encoderCompressStream(s *Writer, op int, available_in *uint, next_in *[]byte) bool {
	if !ensureInitialized(s) {
		return false
	}

	/* Unfinished metadata block; check requirements. */
	if s.remaining_metadata_bytes_ != math.MaxUint32 {
		if uint32(*available_in) != s.remaining_metadata_bytes_ {
			return false
		}
		if op != int(operationEmitMetadata) {
			return false
		}
	}

	if op == int(operationEmitMetadata) {
		updateSizeHint(s, 0) /* First data metablock might be emitted here. */
		return processMetadata(s, available_in, next_in)
	}

	if s.stream_state_ == streamMetadataHead || s.stream_state_ == streamMetadataBody {
		return false
	}

	if s.stream_state_ != streamProcessing && *available_in != 0 {
		return false
	}

	if s.params.quality == fastOnePassCompressionQuality || s.params.quality == fastTwoPassCompressionQuality {
		return encoderCompressStreamFast(s, op, available_in, next_in)
	}

	for {
		var remaining_block_size uint = remainingInputBlockSize(s)

		if remaining_block_size != 0 && *available_in != 0 {
			var copy_input_size uint = brotli_min_size_t(remaining_block_size, *available_in)
			copyInputToRingBuffer(s, copy_input_size, *next_in)
			*next_in = (*next_in)[copy_input_size:]
			*available_in -= copy_input_size
			continue
		}

		if s.stream_state_ == streamFlushRequested && s.last_bytes_bits_ != 0 {
			injectBytePaddingBlock(s)
			continue
		}

		/* Compress data only when stream is not
		   finished and there is no pending flush request. */
		if s.stream_state_ == streamProcessing {
			if remaining_block_size == 0 || op != int(operationProcess) {
				var is_last bool = ((*available_in == 0) && op == int(operationFinish))
				var force_flush bool = ((*available_in == 0) && op == int(operationFlush))
				var result bool
				updateSizeHint(s, *available_in)
				result = encodeData(s, is_last, force_flush)
				if !result {
					return false
				}
				if force_flush {
					s.stream_state_ = streamFlushRequested
				}
				if is_last {
					s.stream_state_ = streamFinished
				}
				continue
			}
		}

		break
	}

	checkFlushComplete(s)
	return true
}

func (w *Writer) writeOutput(data []byte) {
	if w.err != nil {
		return
	}

	_, w.err = w.dst.Write(data)
	if w.err == nil {
		checkFlushComplete(w)
	}
}
