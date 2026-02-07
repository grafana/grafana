package brotli

import (
	"sync"
)

/* Copyright 2013 Google Inc. All Rights Reserved.

   Distributed under MIT license.
   See file LICENSE for detail or copy at https://opensource.org/licenses/MIT
*/

/* Function to find backward reference copies. */

func computeDistanceCode(distance uint, max_distance uint, dist_cache []int) uint {
	if distance <= max_distance {
		var distance_plus_3 uint = distance + 3
		var offset0 uint = distance_plus_3 - uint(dist_cache[0])
		var offset1 uint = distance_plus_3 - uint(dist_cache[1])
		if distance == uint(dist_cache[0]) {
			return 0
		} else if distance == uint(dist_cache[1]) {
			return 1
		} else if offset0 < 7 {
			return (0x9750468 >> (4 * offset0)) & 0xF
		} else if offset1 < 7 {
			return (0xFDB1ACE >> (4 * offset1)) & 0xF
		} else if distance == uint(dist_cache[2]) {
			return 2
		} else if distance == uint(dist_cache[3]) {
			return 3
		}
	}

	return distance + numDistanceShortCodes - 1
}

var hasherSearchResultPool sync.Pool

func createBackwardReferences(num_bytes uint, position uint, ringbuffer []byte, ringbuffer_mask uint, params *encoderParams, hasher hasherHandle, dist_cache []int, last_insert_len *uint, commands *[]command, num_literals *uint) {
	var max_backward_limit uint = maxBackwardLimit(params.lgwin)
	var insert_length uint = *last_insert_len
	var pos_end uint = position + num_bytes
	var store_end uint
	if num_bytes >= hasher.StoreLookahead() {
		store_end = position + num_bytes - hasher.StoreLookahead() + 1
	} else {
		store_end = position
	}
	var random_heuristics_window_size uint = literalSpreeLengthForSparseSearch(params)
	var apply_random_heuristics uint = position + random_heuristics_window_size
	var gap uint = 0
	/* Set maximum distance, see section 9.1. of the spec. */

	const kMinScore uint = scoreBase + 100

	/* For speed up heuristics for random data. */

	/* Minimum score to accept a backward reference. */
	hasher.PrepareDistanceCache(dist_cache)
	sr2, _ := hasherSearchResultPool.Get().(*hasherSearchResult)
	if sr2 == nil {
		sr2 = &hasherSearchResult{}
	}
	sr, _ := hasherSearchResultPool.Get().(*hasherSearchResult)
	if sr == nil {
		sr = &hasherSearchResult{}
	}

	for position+hasher.HashTypeLength() < pos_end {
		var max_length uint = pos_end - position
		var max_distance uint = brotli_min_size_t(position, max_backward_limit)
		sr.len = 0
		sr.len_code_delta = 0
		sr.distance = 0
		sr.score = kMinScore
		hasher.FindLongestMatch(&params.dictionary, ringbuffer, ringbuffer_mask, dist_cache, position, max_length, max_distance, gap, params.dist.max_distance, sr)
		if sr.score > kMinScore {
			/* Found a match. Let's look for something even better ahead. */
			var delayed_backward_references_in_row int = 0
			max_length--
			for ; ; max_length-- {
				var cost_diff_lazy uint = 175
				if params.quality < minQualityForExtensiveReferenceSearch {
					sr2.len = brotli_min_size_t(sr.len-1, max_length)
				} else {
					sr2.len = 0
				}
				sr2.len_code_delta = 0
				sr2.distance = 0
				sr2.score = kMinScore
				max_distance = brotli_min_size_t(position+1, max_backward_limit)
				hasher.FindLongestMatch(&params.dictionary, ringbuffer, ringbuffer_mask, dist_cache, position+1, max_length, max_distance, gap, params.dist.max_distance, sr2)
				if sr2.score >= sr.score+cost_diff_lazy {
					/* Ok, let's just write one byte for now and start a match from the
					   next byte. */
					position++

					insert_length++
					*sr = *sr2
					delayed_backward_references_in_row++
					if delayed_backward_references_in_row < 4 && position+hasher.HashTypeLength() < pos_end {
						continue
					}
				}

				break
			}

			apply_random_heuristics = position + 2*sr.len + random_heuristics_window_size
			max_distance = brotli_min_size_t(position, max_backward_limit)
			{
				/* The first 16 codes are special short-codes,
				   and the minimum offset is 1. */
				var distance_code uint = computeDistanceCode(sr.distance, max_distance+gap, dist_cache)
				if (sr.distance <= (max_distance + gap)) && distance_code > 0 {
					dist_cache[3] = dist_cache[2]
					dist_cache[2] = dist_cache[1]
					dist_cache[1] = dist_cache[0]
					dist_cache[0] = int(sr.distance)
					hasher.PrepareDistanceCache(dist_cache)
				}

				*commands = append(*commands, makeCommand(&params.dist, insert_length, sr.len, sr.len_code_delta, distance_code))
			}

			*num_literals += insert_length
			insert_length = 0
			/* Put the hash keys into the table, if there are enough bytes left.
			   Depending on the hasher implementation, it can push all positions
			   in the given range or only a subset of them.
			   Avoid hash poisoning with RLE data. */
			{
				var range_start uint = position + 2
				var range_end uint = brotli_min_size_t(position+sr.len, store_end)
				if sr.distance < sr.len>>2 {
					range_start = brotli_min_size_t(range_end, brotli_max_size_t(range_start, position+sr.len-(sr.distance<<2)))
				}

				hasher.StoreRange(ringbuffer, ringbuffer_mask, range_start, range_end)
			}

			position += sr.len
		} else {
			insert_length++
			position++

			/* If we have not seen matches for a long time, we can skip some
			   match lookups. Unsuccessful match lookups are very very expensive
			   and this kind of a heuristic speeds up compression quite
			   a lot. */
			if position > apply_random_heuristics {
				/* Going through uncompressible data, jump. */
				if position > apply_random_heuristics+4*random_heuristics_window_size {
					var kMargin uint = brotli_max_size_t(hasher.StoreLookahead()-1, 4)
					/* It is quite a long time since we saw a copy, so we assume
					   that this data is not compressible, and store hashes less
					   often. Hashes of non compressible data are less likely to
					   turn out to be useful in the future, too, so we store less of
					   them to not to flood out the hash table of good compressible
					   data. */

					var pos_jump uint = brotli_min_size_t(position+16, pos_end-kMargin)
					for ; position < pos_jump; position += 4 {
						hasher.Store(ringbuffer, ringbuffer_mask, position)
						insert_length += 4
					}
				} else {
					var kMargin uint = brotli_max_size_t(hasher.StoreLookahead()-1, 2)
					var pos_jump uint = brotli_min_size_t(position+8, pos_end-kMargin)
					for ; position < pos_jump; position += 2 {
						hasher.Store(ringbuffer, ringbuffer_mask, position)
						insert_length += 2
					}
				}
			}
		}
	}

	insert_length += pos_end - position
	*last_insert_len = insert_length

	hasherSearchResultPool.Put(sr)
	hasherSearchResultPool.Put(sr2)
}
