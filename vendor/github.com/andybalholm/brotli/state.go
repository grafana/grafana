package brotli

import "io"

/* Copyright 2015 Google Inc. All Rights Reserved.

   Distributed under MIT license.
   See file LICENSE for detail or copy at https://opensource.org/licenses/MIT
*/

/* Brotli state for partial streaming decoding. */
const (
	stateUninited = iota
	stateLargeWindowBits
	stateInitialize
	stateMetablockBegin
	stateMetablockHeader
	stateMetablockHeader2
	stateContextModes
	stateCommandBegin
	stateCommandInner
	stateCommandPostDecodeLiterals
	stateCommandPostWrapCopy
	stateUncompressed
	stateMetadata
	stateCommandInnerWrite
	stateMetablockDone
	stateCommandPostWrite1
	stateCommandPostWrite2
	stateHuffmanCode0
	stateHuffmanCode1
	stateHuffmanCode2
	stateHuffmanCode3
	stateContextMap1
	stateContextMap2
	stateTreeGroup
	stateDone
)

const (
	stateMetablockHeaderNone = iota
	stateMetablockHeaderEmpty
	stateMetablockHeaderNibbles
	stateMetablockHeaderSize
	stateMetablockHeaderUncompressed
	stateMetablockHeaderReserved
	stateMetablockHeaderBytes
	stateMetablockHeaderMetadata
)

const (
	stateUncompressedNone = iota
	stateUncompressedWrite
)

const (
	stateTreeGroupNone = iota
	stateTreeGroupLoop
)

const (
	stateContextMapNone = iota
	stateContextMapReadPrefix
	stateContextMapHuffman
	stateContextMapDecode
	stateContextMapTransform
)

const (
	stateHuffmanNone = iota
	stateHuffmanSimpleSize
	stateHuffmanSimpleRead
	stateHuffmanSimpleBuild
	stateHuffmanComplex
	stateHuffmanLengthSymbols
)

const (
	stateDecodeUint8None = iota
	stateDecodeUint8Short
	stateDecodeUint8Long
)

const (
	stateReadBlockLengthNone = iota
	stateReadBlockLengthSuffix
)

type Reader struct {
	src io.Reader
	buf []byte // scratch space for reading from src
	in  []byte // current chunk to decode; usually aliases buf

	state        int
	loop_counter int
	br           bitReader
	buffer       struct {
		u64 uint64
		u8  [8]byte
	}
	buffer_length               uint32
	pos                         int
	max_backward_distance       int
	max_distance                int
	ringbuffer_size             int
	ringbuffer_mask             int
	dist_rb_idx                 int
	dist_rb                     [4]int
	error_code                  int
	sub_loop_counter            uint32
	ringbuffer                  []byte
	ringbuffer_end              []byte
	htree_command               []huffmanCode
	context_lookup              []byte
	context_map_slice           []byte
	dist_context_map_slice      []byte
	literal_hgroup              huffmanTreeGroup
	insert_copy_hgroup          huffmanTreeGroup
	distance_hgroup             huffmanTreeGroup
	block_type_trees            []huffmanCode
	block_len_trees             []huffmanCode
	trivial_literal_context     int
	distance_context            int
	meta_block_remaining_len    int
	block_length_index          uint32
	block_length                [3]uint32
	num_block_types             [3]uint32
	block_type_rb               [6]uint32
	distance_postfix_bits       uint32
	num_direct_distance_codes   uint32
	distance_postfix_mask       int
	num_dist_htrees             uint32
	dist_context_map            []byte
	literal_htree               []huffmanCode
	dist_htree_index            byte
	repeat_code_len             uint32
	prev_code_len               uint32
	copy_length                 int
	distance_code               int
	rb_roundtrips               uint
	partial_pos_out             uint
	symbol                      uint32
	repeat                      uint32
	space                       uint32
	table                       [32]huffmanCode
	symbol_lists                symbolList
	symbols_lists_array         [huffmanMaxCodeLength + 1 + numCommandSymbols]uint16
	next_symbol                 [32]int
	code_length_code_lengths    [codeLengthCodes]byte
	code_length_histo           [16]uint16
	htree_index                 int
	next                        []huffmanCode
	context_index               uint32
	max_run_length_prefix       uint32
	code                        uint32
	context_map_table           [huffmanMaxSize272]huffmanCode
	substate_metablock_header   int
	substate_tree_group         int
	substate_context_map        int
	substate_uncompressed       int
	substate_huffman            int
	substate_decode_uint8       int
	substate_read_block_length  int
	is_last_metablock           uint
	is_uncompressed             uint
	is_metadata                 uint
	should_wrap_ringbuffer      uint
	canny_ringbuffer_allocation uint
	large_window                bool
	size_nibbles                uint
	window_bits                 uint32
	new_ringbuffer_size         int
	num_literal_htrees          uint32
	context_map                 []byte
	context_modes               []byte
	dictionary                  *dictionary
	transforms                  *transforms
	trivial_literal_contexts    [8]uint32
}

func decoderStateInit(s *Reader) bool {
	s.error_code = 0 /* BROTLI_DECODER_NO_ERROR */

	initBitReader(&s.br)
	s.state = stateUninited
	s.large_window = false
	s.substate_metablock_header = stateMetablockHeaderNone
	s.substate_tree_group = stateTreeGroupNone
	s.substate_context_map = stateContextMapNone
	s.substate_uncompressed = stateUncompressedNone
	s.substate_huffman = stateHuffmanNone
	s.substate_decode_uint8 = stateDecodeUint8None
	s.substate_read_block_length = stateReadBlockLengthNone

	s.buffer_length = 0
	s.loop_counter = 0
	s.pos = 0
	s.rb_roundtrips = 0
	s.partial_pos_out = 0

	s.block_type_trees = nil
	s.block_len_trees = nil
	s.ringbuffer_size = 0
	s.new_ringbuffer_size = 0
	s.ringbuffer_mask = 0

	s.context_map = nil
	s.context_modes = nil
	s.dist_context_map = nil
	s.context_map_slice = nil
	s.dist_context_map_slice = nil

	s.sub_loop_counter = 0

	s.literal_hgroup.codes = nil
	s.literal_hgroup.htrees = nil
	s.insert_copy_hgroup.codes = nil
	s.insert_copy_hgroup.htrees = nil
	s.distance_hgroup.codes = nil
	s.distance_hgroup.htrees = nil

	s.is_last_metablock = 0
	s.is_uncompressed = 0
	s.is_metadata = 0
	s.should_wrap_ringbuffer = 0
	s.canny_ringbuffer_allocation = 1

	s.window_bits = 0
	s.max_distance = 0
	s.dist_rb[0] = 16
	s.dist_rb[1] = 15
	s.dist_rb[2] = 11
	s.dist_rb[3] = 4
	s.dist_rb_idx = 0
	s.block_type_trees = nil
	s.block_len_trees = nil

	s.symbol_lists.storage = s.symbols_lists_array[:]
	s.symbol_lists.offset = huffmanMaxCodeLength + 1

	s.dictionary = getDictionary()
	s.transforms = getTransforms()

	return true
}

func decoderStateMetablockBegin(s *Reader) {
	s.meta_block_remaining_len = 0
	s.block_length[0] = 1 << 24
	s.block_length[1] = 1 << 24
	s.block_length[2] = 1 << 24
	s.num_block_types[0] = 1
	s.num_block_types[1] = 1
	s.num_block_types[2] = 1
	s.block_type_rb[0] = 1
	s.block_type_rb[1] = 0
	s.block_type_rb[2] = 1
	s.block_type_rb[3] = 0
	s.block_type_rb[4] = 1
	s.block_type_rb[5] = 0
	s.context_map = nil
	s.context_modes = nil
	s.dist_context_map = nil
	s.context_map_slice = nil
	s.literal_htree = nil
	s.dist_context_map_slice = nil
	s.dist_htree_index = 0
	s.context_lookup = nil
	s.literal_hgroup.codes = nil
	s.literal_hgroup.htrees = nil
	s.insert_copy_hgroup.codes = nil
	s.insert_copy_hgroup.htrees = nil
	s.distance_hgroup.codes = nil
	s.distance_hgroup.htrees = nil
}

func decoderStateCleanupAfterMetablock(s *Reader) {
	s.context_modes = nil
	s.context_map = nil
	s.dist_context_map = nil
	s.literal_hgroup.htrees = nil
	s.insert_copy_hgroup.htrees = nil
	s.distance_hgroup.htrees = nil
}

func decoderHuffmanTreeGroupInit(s *Reader, group *huffmanTreeGroup, alphabet_size uint32, max_symbol uint32, ntrees uint32) bool {
	var max_table_size uint = uint(kMaxHuffmanTableSize[(alphabet_size+31)>>5])
	group.alphabet_size = uint16(alphabet_size)
	group.max_symbol = uint16(max_symbol)
	group.num_htrees = uint16(ntrees)
	group.htrees = make([][]huffmanCode, ntrees)
	group.codes = make([]huffmanCode, (uint(ntrees) * max_table_size))
	return !(group.codes == nil)
}
