package brotli

import "encoding/binary"

/* Copyright 2010 Google Inc. All Rights Reserved.

   Distributed under MIT license.
   See file LICENSE for detail or copy at https://opensource.org/licenses/MIT
*/

/* A (forgetful) hash table to the data seen by the compressor, to
   help create backward references to previous data.

   This is a hash map of fixed size (bucket_size_) to a ring buffer of
   fixed size (block_size_). The ring buffer contains the last block_size_
   index positions of the given hash key in the compressed data. */
func (*h6) HashTypeLength() uint {
	return 8
}

func (*h6) StoreLookahead() uint {
	return 8
}

/* HashBytes is the function that chooses the bucket to place the address in. */
func hashBytesH6(data []byte, mask uint64, shift int) uint32 {
	var h uint64 = (binary.LittleEndian.Uint64(data) & mask) * kHashMul64Long

	/* The higher bits contain more mixture from the multiplication,
	   so we take our results from there. */
	return uint32(h >> uint(shift))
}

type h6 struct {
	hasherCommon
	bucket_size_ uint
	block_size_  uint
	hash_shift_  int
	hash_mask_   uint64
	block_mask_  uint32
	num          []uint16
	buckets      []uint32
}

func (h *h6) Initialize(params *encoderParams) {
	h.hash_shift_ = 64 - h.params.bucket_bits
	h.hash_mask_ = (^(uint64(0))) >> uint(64-8*h.params.hash_len)
	h.bucket_size_ = uint(1) << uint(h.params.bucket_bits)
	h.block_size_ = uint(1) << uint(h.params.block_bits)
	h.block_mask_ = uint32(h.block_size_ - 1)
	h.num = make([]uint16, h.bucket_size_)
	h.buckets = make([]uint32, h.block_size_*h.bucket_size_)
}

func (h *h6) Prepare(one_shot bool, input_size uint, data []byte) {
	var num []uint16 = h.num
	var partial_prepare_threshold uint = h.bucket_size_ >> 6
	/* Partial preparation is 100 times slower (per socket). */
	if one_shot && input_size <= partial_prepare_threshold {
		var i uint
		for i = 0; i < input_size; i++ {
			var key uint32 = hashBytesH6(data[i:], h.hash_mask_, h.hash_shift_)
			num[key] = 0
		}
	} else {
		for i := 0; i < int(h.bucket_size_); i++ {
			num[i] = 0
		}
	}
}

/* Look at 4 bytes at &data[ix & mask].
   Compute a hash from these, and store the value of ix at that position. */
func (h *h6) Store(data []byte, mask uint, ix uint) {
	var num []uint16 = h.num
	var key uint32 = hashBytesH6(data[ix&mask:], h.hash_mask_, h.hash_shift_)
	var minor_ix uint = uint(num[key]) & uint(h.block_mask_)
	var offset uint = minor_ix + uint(key<<uint(h.params.block_bits))
	h.buckets[offset] = uint32(ix)
	num[key]++
}

func (h *h6) StoreRange(data []byte, mask uint, ix_start uint, ix_end uint) {
	var i uint
	for i = ix_start; i < ix_end; i++ {
		h.Store(data, mask, i)
	}
}

func (h *h6) StitchToPreviousBlock(num_bytes uint, position uint, ringbuffer []byte, ringbuffer_mask uint) {
	if num_bytes >= h.HashTypeLength()-1 && position >= 3 {
		/* Prepare the hashes for three last bytes of the last write.
		   These could not be calculated before, since they require knowledge
		   of both the previous and the current block. */
		h.Store(ringbuffer, ringbuffer_mask, position-3)
		h.Store(ringbuffer, ringbuffer_mask, position-2)
		h.Store(ringbuffer, ringbuffer_mask, position-1)
	}
}

func (h *h6) PrepareDistanceCache(distance_cache []int) {
	prepareDistanceCache(distance_cache, h.params.num_last_distances_to_check)
}

/* Find a longest backward match of &data[cur_ix] up to the length of
   max_length and stores the position cur_ix in the hash table.

   REQUIRES: PrepareDistanceCacheH6 must be invoked for current distance cache
             values; if this method is invoked repeatedly with the same distance
             cache values, it is enough to invoke PrepareDistanceCacheH6 once.

   Does not look for matches longer than max_length.
   Does not look for matches further away than max_backward.
   Writes the best match into |out|.
   |out|->score is updated only if a better match is found. */
func (h *h6) FindLongestMatch(dictionary *encoderDictionary, data []byte, ring_buffer_mask uint, distance_cache []int, cur_ix uint, max_length uint, max_backward uint, gap uint, max_distance uint, out *hasherSearchResult) {
	var num []uint16 = h.num
	var buckets []uint32 = h.buckets
	var cur_ix_masked uint = cur_ix & ring_buffer_mask
	var min_score uint = out.score
	var best_score uint = out.score
	var best_len uint = out.len
	var i uint
	var bucket []uint32
	/* Don't accept a short copy from far away. */
	out.len = 0

	out.len_code_delta = 0

	/* Try last distance first. */
	for i = 0; i < uint(h.params.num_last_distances_to_check); i++ {
		var backward uint = uint(distance_cache[i])
		var prev_ix uint = uint(cur_ix - backward)
		if prev_ix >= cur_ix {
			continue
		}

		if backward > max_backward {
			continue
		}

		prev_ix &= ring_buffer_mask

		if cur_ix_masked+best_len > ring_buffer_mask || prev_ix+best_len > ring_buffer_mask || data[cur_ix_masked+best_len] != data[prev_ix+best_len] {
			continue
		}
		{
			var len uint = findMatchLengthWithLimit(data[prev_ix:], data[cur_ix_masked:], max_length)
			if len >= 3 || (len == 2 && i < 2) {
				/* Comparing for >= 2 does not change the semantics, but just saves for
				   a few unnecessary binary logarithms in backward reference score,
				   since we are not interested in such short matches. */
				var score uint = backwardReferenceScoreUsingLastDistance(uint(len))
				if best_score < score {
					if i != 0 {
						score -= backwardReferencePenaltyUsingLastDistance(i)
					}
					if best_score < score {
						best_score = score
						best_len = uint(len)
						out.len = best_len
						out.distance = backward
						out.score = best_score
					}
				}
			}
		}
	}
	{
		var key uint32 = hashBytesH6(data[cur_ix_masked:], h.hash_mask_, h.hash_shift_)
		bucket = buckets[key<<uint(h.params.block_bits):]
		var down uint
		if uint(num[key]) > h.block_size_ {
			down = uint(num[key]) - h.block_size_
		} else {
			down = 0
		}
		for i = uint(num[key]); i > down; {
			var prev_ix uint
			i--
			prev_ix = uint(bucket[uint32(i)&h.block_mask_])
			var backward uint = cur_ix - prev_ix
			if backward > max_backward {
				break
			}

			prev_ix &= ring_buffer_mask
			if cur_ix_masked+best_len > ring_buffer_mask || prev_ix+best_len > ring_buffer_mask || data[cur_ix_masked+best_len] != data[prev_ix+best_len] {
				continue
			}
			{
				var len uint = findMatchLengthWithLimit(data[prev_ix:], data[cur_ix_masked:], max_length)
				if len >= 4 {
					/* Comparing for >= 3 does not change the semantics, but just saves
					   for a few unnecessary binary logarithms in backward reference
					   score, since we are not interested in such short matches. */
					var score uint = backwardReferenceScore(uint(len), backward)
					if best_score < score {
						best_score = score
						best_len = uint(len)
						out.len = best_len
						out.distance = backward
						out.score = best_score
					}
				}
			}
		}

		bucket[uint32(num[key])&h.block_mask_] = uint32(cur_ix)
		num[key]++
	}

	if min_score == out.score {
		searchInStaticDictionary(dictionary, h, data[cur_ix_masked:], max_length, max_backward+gap, max_distance, out, false)
	}
}
