package brotli

import (
	"encoding/binary"
	"fmt"
)

type hasherCommon struct {
	params           hasherParams
	is_prepared_     bool
	dict_num_lookups uint
	dict_num_matches uint
}

func (h *hasherCommon) Common() *hasherCommon {
	return h
}

type hasherHandle interface {
	Common() *hasherCommon
	Initialize(params *encoderParams)
	Prepare(one_shot bool, input_size uint, data []byte)
	StitchToPreviousBlock(num_bytes uint, position uint, ringbuffer []byte, ringbuffer_mask uint)
	HashTypeLength() uint
	StoreLookahead() uint
	PrepareDistanceCache(distance_cache []int)
	FindLongestMatch(dictionary *encoderDictionary, data []byte, ring_buffer_mask uint, distance_cache []int, cur_ix uint, max_length uint, max_backward uint, gap uint, max_distance uint, out *hasherSearchResult)
	StoreRange(data []byte, mask uint, ix_start uint, ix_end uint)
	Store(data []byte, mask uint, ix uint)
}

const kCutoffTransformsCount uint32 = 10

/*   0,  12,   27,    23,    42,    63,    56,    48,    59,    64 */
/* 0+0, 4+8, 8+19, 12+11, 16+26, 20+43, 24+32, 28+20, 32+27, 36+28 */
const kCutoffTransforms uint64 = 0x071B520ADA2D3200

type hasherSearchResult struct {
	len            uint
	distance       uint
	score          uint
	len_code_delta int
}

/* kHashMul32 multiplier has these properties:
   * The multiplier must be odd. Otherwise we may lose the highest bit.
   * No long streaks of ones or zeros.
   * There is no effort to ensure that it is a prime, the oddity is enough
     for this use.
   * The number has been tuned heuristically against compression benchmarks. */
const kHashMul32 uint32 = 0x1E35A7BD

const kHashMul64 uint64 = 0x1E35A7BD1E35A7BD

const kHashMul64Long uint64 = 0x1FE35A7BD3579BD3

func hash14(data []byte) uint32 {
	var h uint32 = binary.LittleEndian.Uint32(data) * kHashMul32

	/* The higher bits contain more mixture from the multiplication,
	   so we take our results from there. */
	return h >> (32 - 14)
}

func prepareDistanceCache(distance_cache []int, num_distances int) {
	if num_distances > 4 {
		var last_distance int = distance_cache[0]
		distance_cache[4] = last_distance - 1
		distance_cache[5] = last_distance + 1
		distance_cache[6] = last_distance - 2
		distance_cache[7] = last_distance + 2
		distance_cache[8] = last_distance - 3
		distance_cache[9] = last_distance + 3
		if num_distances > 10 {
			var next_last_distance int = distance_cache[1]
			distance_cache[10] = next_last_distance - 1
			distance_cache[11] = next_last_distance + 1
			distance_cache[12] = next_last_distance - 2
			distance_cache[13] = next_last_distance + 2
			distance_cache[14] = next_last_distance - 3
			distance_cache[15] = next_last_distance + 3
		}
	}
}

const literalByteScore = 135

const distanceBitPenalty = 30

/* Score must be positive after applying maximal penalty. */
const scoreBase = (distanceBitPenalty * 8 * 8)

/* Usually, we always choose the longest backward reference. This function
   allows for the exception of that rule.

   If we choose a backward reference that is further away, it will
   usually be coded with more bits. We approximate this by assuming
   log2(distance). If the distance can be expressed in terms of the
   last four distances, we use some heuristic constants to estimate
   the bits cost. For the first up to four literals we use the bit
   cost of the literals from the literal cost model, after that we
   use the average bit cost of the cost model.

   This function is used to sometimes discard a longer backward reference
   when it is not much longer and the bit cost for encoding it is more
   than the saved literals.

   backward_reference_offset MUST be positive. */
func backwardReferenceScore(copy_length uint, backward_reference_offset uint) uint {
	return scoreBase + literalByteScore*uint(copy_length) - distanceBitPenalty*uint(log2FloorNonZero(backward_reference_offset))
}

func backwardReferenceScoreUsingLastDistance(copy_length uint) uint {
	return literalByteScore*uint(copy_length) + scoreBase + 15
}

func backwardReferencePenaltyUsingLastDistance(distance_short_code uint) uint {
	return uint(39) + ((0x1CA10 >> (distance_short_code & 0xE)) & 0xE)
}

func testStaticDictionaryItem(dictionary *encoderDictionary, item uint, data []byte, max_length uint, max_backward uint, max_distance uint, out *hasherSearchResult) bool {
	var len uint
	var word_idx uint
	var offset uint
	var matchlen uint
	var backward uint
	var score uint
	len = item & 0x1F
	word_idx = item >> 5
	offset = uint(dictionary.words.offsets_by_length[len]) + len*word_idx
	if len > max_length {
		return false
	}

	matchlen = findMatchLengthWithLimit(data, dictionary.words.data[offset:], uint(len))
	if matchlen+uint(dictionary.cutoffTransformsCount) <= len || matchlen == 0 {
		return false
	}
	{
		var cut uint = len - matchlen
		var transform_id uint = (cut << 2) + uint((dictionary.cutoffTransforms>>(cut*6))&0x3F)
		backward = max_backward + 1 + word_idx + (transform_id << dictionary.words.size_bits_by_length[len])
	}

	if backward > max_distance {
		return false
	}

	score = backwardReferenceScore(matchlen, backward)
	if score < out.score {
		return false
	}

	out.len = matchlen
	out.len_code_delta = int(len) - int(matchlen)
	out.distance = backward
	out.score = score
	return true
}

func searchInStaticDictionary(dictionary *encoderDictionary, handle hasherHandle, data []byte, max_length uint, max_backward uint, max_distance uint, out *hasherSearchResult, shallow bool) {
	var key uint
	var i uint
	var self *hasherCommon = handle.Common()
	if self.dict_num_matches < self.dict_num_lookups>>7 {
		return
	}

	key = uint(hash14(data) << 1)
	for i = 0; ; (func() { i++; key++ })() {
		var tmp uint
		if shallow {
			tmp = 1
		} else {
			tmp = 2
		}
		if i >= tmp {
			break
		}
		var item uint = uint(dictionary.hash_table[key])
		self.dict_num_lookups++
		if item != 0 {
			var item_matches bool = testStaticDictionaryItem(dictionary, item, data, max_length, max_backward, max_distance, out)
			if item_matches {
				self.dict_num_matches++
			}
		}
	}
}

type backwardMatch struct {
	distance        uint32
	length_and_code uint32
}

func initBackwardMatch(self *backwardMatch, dist uint, len uint) {
	self.distance = uint32(dist)
	self.length_and_code = uint32(len << 5)
}

func initDictionaryBackwardMatch(self *backwardMatch, dist uint, len uint, len_code uint) {
	self.distance = uint32(dist)
	var tmp uint
	if len == len_code {
		tmp = 0
	} else {
		tmp = len_code
	}
	self.length_and_code = uint32(len<<5 | tmp)
}

func backwardMatchLength(self *backwardMatch) uint {
	return uint(self.length_and_code >> 5)
}

func backwardMatchLengthCode(self *backwardMatch) uint {
	var code uint = uint(self.length_and_code) & 31
	if code != 0 {
		return code
	} else {
		return backwardMatchLength(self)
	}
}

func hasherReset(handle hasherHandle) {
	if handle == nil {
		return
	}
	handle.Common().is_prepared_ = false
}

func newHasher(typ int) hasherHandle {
	switch typ {
	case 2:
		return &hashLongestMatchQuickly{
			bucketBits:    16,
			bucketSweep:   1,
			hashLen:       5,
			useDictionary: true,
		}
	case 3:
		return &hashLongestMatchQuickly{
			bucketBits:    16,
			bucketSweep:   2,
			hashLen:       5,
			useDictionary: false,
		}
	case 4:
		return &hashLongestMatchQuickly{
			bucketBits:    17,
			bucketSweep:   4,
			hashLen:       5,
			useDictionary: true,
		}
	case 5:
		return new(h5)
	case 6:
		return new(h6)
	case 10:
		return new(h10)
	case 35:
		return &hashComposite{
			ha: newHasher(3),
			hb: &hashRolling{jump: 4},
		}
	case 40:
		return &hashForgetfulChain{
			bucketBits:              15,
			numBanks:                1,
			bankBits:                16,
			numLastDistancesToCheck: 4,
		}
	case 41:
		return &hashForgetfulChain{
			bucketBits:              15,
			numBanks:                1,
			bankBits:                16,
			numLastDistancesToCheck: 10,
		}
	case 42:
		return &hashForgetfulChain{
			bucketBits:              15,
			numBanks:                512,
			bankBits:                9,
			numLastDistancesToCheck: 16,
		}
	case 54:
		return &hashLongestMatchQuickly{
			bucketBits:    20,
			bucketSweep:   4,
			hashLen:       7,
			useDictionary: false,
		}
	case 55:
		return &hashComposite{
			ha: newHasher(54),
			hb: &hashRolling{jump: 4},
		}
	case 65:
		return &hashComposite{
			ha: newHasher(6),
			hb: &hashRolling{jump: 1},
		}
	}

	panic(fmt.Sprintf("unknown hasher type: %d", typ))
}

func hasherSetup(handle *hasherHandle, params *encoderParams, data []byte, position uint, input_size uint, is_last bool) {
	var self hasherHandle = nil
	var common *hasherCommon = nil
	var one_shot bool = (position == 0 && is_last)
	if *handle == nil {
		chooseHasher(params, &params.hasher)
		self = newHasher(params.hasher.type_)

		*handle = self
		common = self.Common()
		common.params = params.hasher
		self.Initialize(params)
	}

	self = *handle
	common = self.Common()
	if !common.is_prepared_ {
		self.Prepare(one_shot, input_size, data)

		if position == 0 {
			common.dict_num_lookups = 0
			common.dict_num_matches = 0
		}

		common.is_prepared_ = true
	}
}

func initOrStitchToPreviousBlock(handle *hasherHandle, data []byte, mask uint, params *encoderParams, position uint, input_size uint, is_last bool) {
	var self hasherHandle
	hasherSetup(handle, params, data, position, input_size, is_last)
	self = *handle
	self.StitchToPreviousBlock(input_size, position, data, mask)
}
