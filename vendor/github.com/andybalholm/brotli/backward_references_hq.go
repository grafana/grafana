package brotli

import "math"

type zopfliNode struct {
	length              uint32
	distance            uint32
	dcode_insert_length uint32
	u                   struct {
		cost     float32
		next     uint32
		shortcut uint32
	}
}

const maxEffectiveDistanceAlphabetSize = 544

const kInfinity float32 = 1.7e38 /* ~= 2 ^ 127 */

var kDistanceCacheIndex = []uint32{0, 1, 2, 3, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1}

var kDistanceCacheOffset = []int{0, 0, 0, 0, -1, 1, -2, 2, -3, 3, -1, 1, -2, 2, -3, 3}

func initZopfliNodes(array []zopfliNode, length uint) {
	var stub zopfliNode
	var i uint
	stub.length = 1
	stub.distance = 0
	stub.dcode_insert_length = 0
	stub.u.cost = kInfinity
	for i = 0; i < length; i++ {
		array[i] = stub
	}
}

func zopfliNodeCopyLength(self *zopfliNode) uint32 {
	return self.length & 0x1FFFFFF
}

func zopfliNodeLengthCode(self *zopfliNode) uint32 {
	var modifier uint32 = self.length >> 25
	return zopfliNodeCopyLength(self) + 9 - modifier
}

func zopfliNodeCopyDistance(self *zopfliNode) uint32 {
	return self.distance
}

func zopfliNodeDistanceCode(self *zopfliNode) uint32 {
	var short_code uint32 = self.dcode_insert_length >> 27
	if short_code == 0 {
		return zopfliNodeCopyDistance(self) + numDistanceShortCodes - 1
	} else {
		return short_code - 1
	}
}

func zopfliNodeCommandLength(self *zopfliNode) uint32 {
	return zopfliNodeCopyLength(self) + (self.dcode_insert_length & 0x7FFFFFF)
}

/* Histogram based cost model for zopflification. */
type zopfliCostModel struct {
	cost_cmd_               [numCommandSymbols]float32
	cost_dist_              []float32
	distance_histogram_size uint32
	literal_costs_          []float32
	min_cost_cmd_           float32
	num_bytes_              uint
}

func initZopfliCostModel(self *zopfliCostModel, dist *distanceParams, num_bytes uint) {
	var distance_histogram_size uint32 = dist.alphabet_size
	if distance_histogram_size > maxEffectiveDistanceAlphabetSize {
		distance_histogram_size = maxEffectiveDistanceAlphabetSize
	}

	self.num_bytes_ = num_bytes
	self.literal_costs_ = make([]float32, (num_bytes + 2))
	self.cost_dist_ = make([]float32, (dist.alphabet_size))
	self.distance_histogram_size = distance_histogram_size
}

func cleanupZopfliCostModel(self *zopfliCostModel) {
	self.literal_costs_ = nil
	self.cost_dist_ = nil
}

func setCost(histogram []uint32, histogram_size uint, literal_histogram bool, cost []float32) {
	var sum uint = 0
	var missing_symbol_sum uint
	var log2sum float32
	var missing_symbol_cost float32
	var i uint
	for i = 0; i < histogram_size; i++ {
		sum += uint(histogram[i])
	}

	log2sum = float32(fastLog2(sum))
	missing_symbol_sum = sum
	if !literal_histogram {
		for i = 0; i < histogram_size; i++ {
			if histogram[i] == 0 {
				missing_symbol_sum++
			}
		}
	}

	missing_symbol_cost = float32(fastLog2(missing_symbol_sum)) + 2
	for i = 0; i < histogram_size; i++ {
		if histogram[i] == 0 {
			cost[i] = missing_symbol_cost
			continue
		}

		/* Shannon bits for this symbol. */
		cost[i] = log2sum - float32(fastLog2(uint(histogram[i])))

		/* Cannot be coded with less than 1 bit */
		if cost[i] < 1 {
			cost[i] = 1
		}
	}
}

func zopfliCostModelSetFromCommands(self *zopfliCostModel, position uint, ringbuffer []byte, ringbuffer_mask uint, commands []command, last_insert_len uint) {
	var histogram_literal [numLiteralSymbols]uint32
	var histogram_cmd [numCommandSymbols]uint32
	var histogram_dist [maxEffectiveDistanceAlphabetSize]uint32
	var cost_literal [numLiteralSymbols]float32
	var pos uint = position - last_insert_len
	var min_cost_cmd float32 = kInfinity
	var cost_cmd []float32 = self.cost_cmd_[:]
	var literal_costs []float32

	histogram_literal = [numLiteralSymbols]uint32{}
	histogram_cmd = [numCommandSymbols]uint32{}
	histogram_dist = [maxEffectiveDistanceAlphabetSize]uint32{}

	for i := range commands {
		var inslength uint = uint(commands[i].insert_len_)
		var copylength uint = uint(commandCopyLen(&commands[i]))
		var distcode uint = uint(commands[i].dist_prefix_) & 0x3FF
		var cmdcode uint = uint(commands[i].cmd_prefix_)
		var j uint

		histogram_cmd[cmdcode]++
		if cmdcode >= 128 {
			histogram_dist[distcode]++
		}

		for j = 0; j < inslength; j++ {
			histogram_literal[ringbuffer[(pos+j)&ringbuffer_mask]]++
		}

		pos += inslength + copylength
	}

	setCost(histogram_literal[:], numLiteralSymbols, true, cost_literal[:])
	setCost(histogram_cmd[:], numCommandSymbols, false, cost_cmd)
	setCost(histogram_dist[:], uint(self.distance_histogram_size), false, self.cost_dist_)

	for i := 0; i < numCommandSymbols; i++ {
		min_cost_cmd = brotli_min_float(min_cost_cmd, cost_cmd[i])
	}

	self.min_cost_cmd_ = min_cost_cmd
	{
		literal_costs = self.literal_costs_
		var literal_carry float32 = 0.0
		num_bytes := int(self.num_bytes_)
		literal_costs[0] = 0.0
		for i := 0; i < num_bytes; i++ {
			literal_carry += cost_literal[ringbuffer[(position+uint(i))&ringbuffer_mask]]
			literal_costs[i+1] = literal_costs[i] + literal_carry
			literal_carry -= literal_costs[i+1] - literal_costs[i]
		}
	}
}

func zopfliCostModelSetFromLiteralCosts(self *zopfliCostModel, position uint, ringbuffer []byte, ringbuffer_mask uint) {
	var literal_costs []float32 = self.literal_costs_
	var literal_carry float32 = 0.0
	var cost_dist []float32 = self.cost_dist_
	var cost_cmd []float32 = self.cost_cmd_[:]
	var num_bytes uint = self.num_bytes_
	var i uint
	estimateBitCostsForLiterals(position, num_bytes, ringbuffer_mask, ringbuffer, literal_costs[1:])
	literal_costs[0] = 0.0
	for i = 0; i < num_bytes; i++ {
		literal_carry += literal_costs[i+1]
		literal_costs[i+1] = literal_costs[i] + literal_carry
		literal_carry -= literal_costs[i+1] - literal_costs[i]
	}

	for i = 0; i < numCommandSymbols; i++ {
		cost_cmd[i] = float32(fastLog2(uint(11 + uint32(i))))
	}

	for i = 0; uint32(i) < self.distance_histogram_size; i++ {
		cost_dist[i] = float32(fastLog2(uint(20 + uint32(i))))
	}

	self.min_cost_cmd_ = float32(fastLog2(11))
}

func zopfliCostModelGetCommandCost(self *zopfliCostModel, cmdcode uint16) float32 {
	return self.cost_cmd_[cmdcode]
}

func zopfliCostModelGetDistanceCost(self *zopfliCostModel, distcode uint) float32 {
	return self.cost_dist_[distcode]
}

func zopfliCostModelGetLiteralCosts(self *zopfliCostModel, from uint, to uint) float32 {
	return self.literal_costs_[to] - self.literal_costs_[from]
}

func zopfliCostModelGetMinCostCmd(self *zopfliCostModel) float32 {
	return self.min_cost_cmd_
}

/* REQUIRES: len >= 2, start_pos <= pos */
/* REQUIRES: cost < kInfinity, nodes[start_pos].cost < kInfinity */
/* Maintains the "ZopfliNode array invariant". */
func updateZopfliNode(nodes []zopfliNode, pos uint, start_pos uint, len uint, len_code uint, dist uint, short_code uint, cost float32) {
	var next *zopfliNode = &nodes[pos+len]
	next.length = uint32(len | (len+9-len_code)<<25)
	next.distance = uint32(dist)
	next.dcode_insert_length = uint32(short_code<<27 | (pos - start_pos))
	next.u.cost = cost
}

type posData struct {
	pos            uint
	distance_cache [4]int
	costdiff       float32
	cost           float32
}

/* Maintains the smallest 8 cost difference together with their positions */
type startPosQueue struct {
	q_   [8]posData
	idx_ uint
}

func initStartPosQueue(self *startPosQueue) {
	self.idx_ = 0
}

func startPosQueueSize(self *startPosQueue) uint {
	return brotli_min_size_t(self.idx_, 8)
}

func startPosQueuePush(self *startPosQueue, posdata *posData) {
	var offset uint = ^(self.idx_) & 7
	self.idx_++
	var len uint = startPosQueueSize(self)
	var i uint
	var q []posData = self.q_[:]
	q[offset] = *posdata

	/* Restore the sorted order. In the list of |len| items at most |len - 1|
	   adjacent element comparisons / swaps are required. */
	for i = 1; i < len; i++ {
		if q[offset&7].costdiff > q[(offset+1)&7].costdiff {
			var tmp posData = q[offset&7]
			q[offset&7] = q[(offset+1)&7]
			q[(offset+1)&7] = tmp
		}

		offset++
	}
}

func startPosQueueAt(self *startPosQueue, k uint) *posData {
	return &self.q_[(k-self.idx_)&7]
}

/* Returns the minimum possible copy length that can improve the cost of any */
/* future position. */
func computeMinimumCopyLength(start_cost float32, nodes []zopfliNode, num_bytes uint, pos uint) uint {
	var min_cost float32 = start_cost
	var len uint = 2
	var next_len_bucket uint = 4
	/* Compute the minimum possible cost of reaching any future position. */

	var next_len_offset uint = 10
	for pos+len <= num_bytes && nodes[pos+len].u.cost <= min_cost {
		/* We already reached (pos + len) with no more cost than the minimum
		   possible cost of reaching anything from this pos, so there is no point in
		   looking for lengths <= len. */
		len++

		if len == next_len_offset {
			/* We reached the next copy length code bucket, so we add one more
			   extra bit to the minimum cost. */
			min_cost += 1.0

			next_len_offset += next_len_bucket
			next_len_bucket *= 2
		}
	}

	return uint(len)
}

/* REQUIRES: nodes[pos].cost < kInfinity
   REQUIRES: nodes[0..pos] satisfies that "ZopfliNode array invariant". */
func computeDistanceShortcut(block_start uint, pos uint, max_backward_limit uint, gap uint, nodes []zopfliNode) uint32 {
	var clen uint = uint(zopfliNodeCopyLength(&nodes[pos]))
	var ilen uint = uint(nodes[pos].dcode_insert_length & 0x7FFFFFF)
	var dist uint = uint(zopfliNodeCopyDistance(&nodes[pos]))

	/* Since |block_start + pos| is the end position of the command, the copy part
	   starts from |block_start + pos - clen|. Distances that are greater than
	   this or greater than |max_backward_limit| + |gap| are static dictionary
	   references, and do not update the last distances.
	   Also distance code 0 (last distance) does not update the last distances. */
	if pos == 0 {
		return 0
	} else if dist+clen <= block_start+pos+gap && dist <= max_backward_limit+gap && zopfliNodeDistanceCode(&nodes[pos]) > 0 {
		return uint32(pos)
	} else {
		return nodes[pos-clen-ilen].u.shortcut
	}
}

/* Fills in dist_cache[0..3] with the last four distances (as defined by
   Section 4. of the Spec) that would be used at (block_start + pos) if we
   used the shortest path of commands from block_start, computed from
   nodes[0..pos]. The last four distances at block_start are in
   starting_dist_cache[0..3].
   REQUIRES: nodes[pos].cost < kInfinity
   REQUIRES: nodes[0..pos] satisfies that "ZopfliNode array invariant". */
func computeDistanceCache(pos uint, starting_dist_cache []int, nodes []zopfliNode, dist_cache []int) {
	var idx int = 0
	var p uint = uint(nodes[pos].u.shortcut)
	for idx < 4 && p > 0 {
		var ilen uint = uint(nodes[p].dcode_insert_length & 0x7FFFFFF)
		var clen uint = uint(zopfliNodeCopyLength(&nodes[p]))
		var dist uint = uint(zopfliNodeCopyDistance(&nodes[p]))
		dist_cache[idx] = int(dist)
		idx++

		/* Because of prerequisite, p >= clen + ilen >= 2. */
		p = uint(nodes[p-clen-ilen].u.shortcut)
	}

	for ; idx < 4; idx++ {
		dist_cache[idx] = starting_dist_cache[0]
		starting_dist_cache = starting_dist_cache[1:]
	}
}

/* Maintains "ZopfliNode array invariant" and pushes node to the queue, if it
   is eligible. */
func evaluateNode(block_start uint, pos uint, max_backward_limit uint, gap uint, starting_dist_cache []int, model *zopfliCostModel, queue *startPosQueue, nodes []zopfliNode) {
	/* Save cost, because ComputeDistanceCache invalidates it. */
	var node_cost float32 = nodes[pos].u.cost
	nodes[pos].u.shortcut = computeDistanceShortcut(block_start, pos, max_backward_limit, gap, nodes)
	if node_cost <= zopfliCostModelGetLiteralCosts(model, 0, pos) {
		var posdata posData
		posdata.pos = pos
		posdata.cost = node_cost
		posdata.costdiff = node_cost - zopfliCostModelGetLiteralCosts(model, 0, pos)
		computeDistanceCache(pos, starting_dist_cache, nodes, posdata.distance_cache[:])
		startPosQueuePush(queue, &posdata)
	}
}

/* Returns longest copy length. */
func updateNodes(num_bytes uint, block_start uint, pos uint, ringbuffer []byte, ringbuffer_mask uint, params *encoderParams, max_backward_limit uint, starting_dist_cache []int, num_matches uint, matches []backwardMatch, model *zopfliCostModel, queue *startPosQueue, nodes []zopfliNode) uint {
	var cur_ix uint = block_start + pos
	var cur_ix_masked uint = cur_ix & ringbuffer_mask
	var max_distance uint = brotli_min_size_t(cur_ix, max_backward_limit)
	var max_len uint = num_bytes - pos
	var max_zopfli_len uint = maxZopfliLen(params)
	var max_iters uint = maxZopfliCandidates(params)
	var min_len uint
	var result uint = 0
	var k uint
	var gap uint = 0

	evaluateNode(block_start, pos, max_backward_limit, gap, starting_dist_cache, model, queue, nodes)
	{
		var posdata *posData = startPosQueueAt(queue, 0)
		var min_cost float32 = (posdata.cost + zopfliCostModelGetMinCostCmd(model) + zopfliCostModelGetLiteralCosts(model, posdata.pos, pos))
		min_len = computeMinimumCopyLength(min_cost, nodes, num_bytes, pos)
	}

	/* Go over the command starting positions in order of increasing cost
	   difference. */
	for k = 0; k < max_iters && k < startPosQueueSize(queue); k++ {
		var posdata *posData = startPosQueueAt(queue, k)
		var start uint = posdata.pos
		var inscode uint16 = getInsertLengthCode(pos - start)
		var start_costdiff float32 = posdata.costdiff
		var base_cost float32 = start_costdiff + float32(getInsertExtra(inscode)) + zopfliCostModelGetLiteralCosts(model, 0, pos)
		var best_len uint = min_len - 1
		var j uint = 0
		/* Look for last distance matches using the distance cache from this
		   starting position. */
		for ; j < numDistanceShortCodes && best_len < max_len; j++ {
			var idx uint = uint(kDistanceCacheIndex[j])
			var backward uint = uint(posdata.distance_cache[idx] + kDistanceCacheOffset[j])
			var prev_ix uint = cur_ix - backward
			var len uint = 0
			var continuation byte = ringbuffer[cur_ix_masked+best_len]
			if cur_ix_masked+best_len > ringbuffer_mask {
				break
			}

			if backward > max_distance+gap {
				/* Word dictionary -> ignore. */
				continue
			}

			if backward <= max_distance {
				/* Regular backward reference. */
				if prev_ix >= cur_ix {
					continue
				}

				prev_ix &= ringbuffer_mask
				if prev_ix+best_len > ringbuffer_mask || continuation != ringbuffer[prev_ix+best_len] {
					continue
				}

				len = findMatchLengthWithLimit(ringbuffer[prev_ix:], ringbuffer[cur_ix_masked:], max_len)
			} else {
				continue
			}
			{
				var dist_cost float32 = base_cost + zopfliCostModelGetDistanceCost(model, j)
				var l uint
				for l = best_len + 1; l <= len; l++ {
					var copycode uint16 = getCopyLengthCode(l)
					var cmdcode uint16 = combineLengthCodes(inscode, copycode, j == 0)
					var tmp float32
					if cmdcode < 128 {
						tmp = base_cost
					} else {
						tmp = dist_cost
					}
					var cost float32 = tmp + float32(getCopyExtra(copycode)) + zopfliCostModelGetCommandCost(model, cmdcode)
					if cost < nodes[pos+l].u.cost {
						updateZopfliNode(nodes, pos, start, l, l, backward, j+1, cost)
						result = brotli_max_size_t(result, l)
					}

					best_len = l
				}
			}
		}

		/* At higher iterations look only for new last distance matches, since
		   looking only for new command start positions with the same distances
		   does not help much. */
		if k >= 2 {
			continue
		}
		{
			/* Loop through all possible copy lengths at this position. */
			var len uint = min_len
			for j = 0; j < num_matches; j++ {
				var match backwardMatch = matches[j]
				var dist uint = uint(match.distance)
				var is_dictionary_match bool = (dist > max_distance+gap)
				var dist_code uint = dist + numDistanceShortCodes - 1
				var dist_symbol uint16
				var distextra uint32
				var distnumextra uint32
				var dist_cost float32
				var max_match_len uint
				/* We already tried all possible last distance matches, so we can use
				   normal distance code here. */
				prefixEncodeCopyDistance(dist_code, uint(params.dist.num_direct_distance_codes), uint(params.dist.distance_postfix_bits), &dist_symbol, &distextra)

				distnumextra = uint32(dist_symbol) >> 10
				dist_cost = base_cost + float32(distnumextra) + zopfliCostModelGetDistanceCost(model, uint(dist_symbol)&0x3FF)

				/* Try all copy lengths up until the maximum copy length corresponding
				   to this distance. If the distance refers to the static dictionary, or
				   the maximum length is long enough, try only one maximum length. */
				max_match_len = backwardMatchLength(&match)

				if len < max_match_len && (is_dictionary_match || max_match_len > max_zopfli_len) {
					len = max_match_len
				}

				for ; len <= max_match_len; len++ {
					var len_code uint
					if is_dictionary_match {
						len_code = backwardMatchLengthCode(&match)
					} else {
						len_code = len
					}
					var copycode uint16 = getCopyLengthCode(len_code)
					var cmdcode uint16 = combineLengthCodes(inscode, copycode, false)
					var cost float32 = dist_cost + float32(getCopyExtra(copycode)) + zopfliCostModelGetCommandCost(model, cmdcode)
					if cost < nodes[pos+len].u.cost {
						updateZopfliNode(nodes, pos, start, uint(len), len_code, dist, 0, cost)
						if len > result {
							result = len
						}
					}
				}
			}
		}
	}

	return result
}

func computeShortestPathFromNodes(num_bytes uint, nodes []zopfliNode) uint {
	var index uint = num_bytes
	var num_commands uint = 0
	for nodes[index].dcode_insert_length&0x7FFFFFF == 0 && nodes[index].length == 1 {
		index--
	}
	nodes[index].u.next = math.MaxUint32
	for index != 0 {
		var len uint = uint(zopfliNodeCommandLength(&nodes[index]))
		index -= uint(len)
		nodes[index].u.next = uint32(len)
		num_commands++
	}

	return num_commands
}

/* REQUIRES: nodes != NULL and len(nodes) >= num_bytes + 1 */
func zopfliCreateCommands(num_bytes uint, block_start uint, nodes []zopfliNode, dist_cache []int, last_insert_len *uint, params *encoderParams, commands *[]command, num_literals *uint) {
	var max_backward_limit uint = maxBackwardLimit(params.lgwin)
	var pos uint = 0
	var offset uint32 = nodes[0].u.next
	var i uint
	var gap uint = 0
	for i = 0; offset != math.MaxUint32; i++ {
		var next *zopfliNode = &nodes[uint32(pos)+offset]
		var copy_length uint = uint(zopfliNodeCopyLength(next))
		var insert_length uint = uint(next.dcode_insert_length & 0x7FFFFFF)
		pos += insert_length
		offset = next.u.next
		if i == 0 {
			insert_length += *last_insert_len
			*last_insert_len = 0
		}
		{
			var distance uint = uint(zopfliNodeCopyDistance(next))
			var len_code uint = uint(zopfliNodeLengthCode(next))
			var max_distance uint = brotli_min_size_t(block_start+pos, max_backward_limit)
			var is_dictionary bool = (distance > max_distance+gap)
			var dist_code uint = uint(zopfliNodeDistanceCode(next))
			*commands = append(*commands, makeCommand(&params.dist, insert_length, copy_length, int(len_code)-int(copy_length), dist_code))

			if !is_dictionary && dist_code > 0 {
				dist_cache[3] = dist_cache[2]
				dist_cache[2] = dist_cache[1]
				dist_cache[1] = dist_cache[0]
				dist_cache[0] = int(distance)
			}
		}

		*num_literals += insert_length
		pos += copy_length
	}

	*last_insert_len += num_bytes - pos
}

func zopfliIterate(num_bytes uint, position uint, ringbuffer []byte, ringbuffer_mask uint, params *encoderParams, gap uint, dist_cache []int, model *zopfliCostModel, num_matches []uint32, matches []backwardMatch, nodes []zopfliNode) uint {
	var max_backward_limit uint = maxBackwardLimit(params.lgwin)
	var max_zopfli_len uint = maxZopfliLen(params)
	var queue startPosQueue
	var cur_match_pos uint = 0
	var i uint
	nodes[0].length = 0
	nodes[0].u.cost = 0
	initStartPosQueue(&queue)
	for i = 0; i+3 < num_bytes; i++ {
		var skip uint = updateNodes(num_bytes, position, i, ringbuffer, ringbuffer_mask, params, max_backward_limit, dist_cache, uint(num_matches[i]), matches[cur_match_pos:], model, &queue, nodes)
		if skip < longCopyQuickStep {
			skip = 0
		}
		cur_match_pos += uint(num_matches[i])
		if num_matches[i] == 1 && backwardMatchLength(&matches[cur_match_pos-1]) > max_zopfli_len {
			skip = brotli_max_size_t(backwardMatchLength(&matches[cur_match_pos-1]), skip)
		}

		if skip > 1 {
			skip--
			for skip != 0 {
				i++
				if i+3 >= num_bytes {
					break
				}
				evaluateNode(position, i, max_backward_limit, gap, dist_cache, model, &queue, nodes)
				cur_match_pos += uint(num_matches[i])
				skip--
			}
		}
	}

	return computeShortestPathFromNodes(num_bytes, nodes)
}

/* Computes the shortest path of commands from position to at most
   position + num_bytes.

   On return, path->size() is the number of commands found and path[i] is the
   length of the i-th command (copy length plus insert length).
   Note that the sum of the lengths of all commands can be less than num_bytes.

   On return, the nodes[0..num_bytes] array will have the following
   "ZopfliNode array invariant":
   For each i in [1..num_bytes], if nodes[i].cost < kInfinity, then
     (1) nodes[i].copy_length() >= 2
     (2) nodes[i].command_length() <= i and
     (3) nodes[i - nodes[i].command_length()].cost < kInfinity

 REQUIRES: nodes != nil and len(nodes) >= num_bytes + 1 */
func zopfliComputeShortestPath(num_bytes uint, position uint, ringbuffer []byte, ringbuffer_mask uint, params *encoderParams, dist_cache []int, hasher *h10, nodes []zopfliNode) uint {
	var max_backward_limit uint = maxBackwardLimit(params.lgwin)
	var max_zopfli_len uint = maxZopfliLen(params)
	var model zopfliCostModel
	var queue startPosQueue
	var matches [2 * (maxNumMatchesH10 + 64)]backwardMatch
	var store_end uint
	if num_bytes >= hasher.StoreLookahead() {
		store_end = position + num_bytes - hasher.StoreLookahead() + 1
	} else {
		store_end = position
	}
	var i uint
	var gap uint = 0
	var lz_matches_offset uint = 0
	nodes[0].length = 0
	nodes[0].u.cost = 0
	initZopfliCostModel(&model, &params.dist, num_bytes)
	zopfliCostModelSetFromLiteralCosts(&model, position, ringbuffer, ringbuffer_mask)
	initStartPosQueue(&queue)
	for i = 0; i+hasher.HashTypeLength()-1 < num_bytes; i++ {
		var pos uint = position + i
		var max_distance uint = brotli_min_size_t(pos, max_backward_limit)
		var skip uint
		var num_matches uint
		num_matches = findAllMatchesH10(hasher, &params.dictionary, ringbuffer, ringbuffer_mask, pos, num_bytes-i, max_distance, gap, params, matches[lz_matches_offset:])
		if num_matches > 0 && backwardMatchLength(&matches[num_matches-1]) > max_zopfli_len {
			matches[0] = matches[num_matches-1]
			num_matches = 1
		}

		skip = updateNodes(num_bytes, position, i, ringbuffer, ringbuffer_mask, params, max_backward_limit, dist_cache, num_matches, matches[:], &model, &queue, nodes)
		if skip < longCopyQuickStep {
			skip = 0
		}
		if num_matches == 1 && backwardMatchLength(&matches[0]) > max_zopfli_len {
			skip = brotli_max_size_t(backwardMatchLength(&matches[0]), skip)
		}

		if skip > 1 {
			/* Add the tail of the copy to the hasher. */
			hasher.StoreRange(ringbuffer, ringbuffer_mask, pos+1, brotli_min_size_t(pos+skip, store_end))

			skip--
			for skip != 0 {
				i++
				if i+hasher.HashTypeLength()-1 >= num_bytes {
					break
				}
				evaluateNode(position, i, max_backward_limit, gap, dist_cache, &model, &queue, nodes)
				skip--
			}
		}
	}

	cleanupZopfliCostModel(&model)
	return computeShortestPathFromNodes(num_bytes, nodes)
}

func createZopfliBackwardReferences(num_bytes uint, position uint, ringbuffer []byte, ringbuffer_mask uint, params *encoderParams, hasher *h10, dist_cache []int, last_insert_len *uint, commands *[]command, num_literals *uint) {
	var nodes []zopfliNode
	nodes = make([]zopfliNode, (num_bytes + 1))
	initZopfliNodes(nodes, num_bytes+1)
	zopfliComputeShortestPath(num_bytes, position, ringbuffer, ringbuffer_mask, params, dist_cache, hasher, nodes)
	zopfliCreateCommands(num_bytes, position, nodes, dist_cache, last_insert_len, params, commands, num_literals)
	nodes = nil
}

func createHqZopfliBackwardReferences(num_bytes uint, position uint, ringbuffer []byte, ringbuffer_mask uint, params *encoderParams, hasher hasherHandle, dist_cache []int, last_insert_len *uint, commands *[]command, num_literals *uint) {
	var max_backward_limit uint = maxBackwardLimit(params.lgwin)
	var num_matches []uint32 = make([]uint32, num_bytes)
	var matches_size uint = 4 * num_bytes
	var store_end uint
	if num_bytes >= hasher.StoreLookahead() {
		store_end = position + num_bytes - hasher.StoreLookahead() + 1
	} else {
		store_end = position
	}
	var cur_match_pos uint = 0
	var i uint
	var orig_num_literals uint
	var orig_last_insert_len uint
	var orig_dist_cache [4]int
	var orig_num_commands int
	var model zopfliCostModel
	var nodes []zopfliNode
	var matches []backwardMatch = make([]backwardMatch, matches_size)
	var gap uint = 0
	var shadow_matches uint = 0
	var new_array []backwardMatch
	for i = 0; i+hasher.HashTypeLength()-1 < num_bytes; i++ {
		var pos uint = position + i
		var max_distance uint = brotli_min_size_t(pos, max_backward_limit)
		var max_length uint = num_bytes - i
		var num_found_matches uint
		var cur_match_end uint
		var j uint

		/* Ensure that we have enough free slots. */
		if matches_size < cur_match_pos+maxNumMatchesH10+shadow_matches {
			var new_size uint = matches_size
			if new_size == 0 {
				new_size = cur_match_pos + maxNumMatchesH10 + shadow_matches
			}

			for new_size < cur_match_pos+maxNumMatchesH10+shadow_matches {
				new_size *= 2
			}

			new_array = make([]backwardMatch, new_size)
			if matches_size != 0 {
				copy(new_array, matches[:matches_size])
			}

			matches = new_array
			matches_size = new_size
		}

		num_found_matches = findAllMatchesH10(hasher.(*h10), &params.dictionary, ringbuffer, ringbuffer_mask, pos, max_length, max_distance, gap, params, matches[cur_match_pos+shadow_matches:])
		cur_match_end = cur_match_pos + num_found_matches
		for j = cur_match_pos; j+1 < cur_match_end; j++ {
			assert(backwardMatchLength(&matches[j]) <= backwardMatchLength(&matches[j+1]))
		}

		num_matches[i] = uint32(num_found_matches)
		if num_found_matches > 0 {
			var match_len uint = backwardMatchLength(&matches[cur_match_end-1])
			if match_len > maxZopfliLenQuality11 {
				var skip uint = match_len - 1
				matches[cur_match_pos] = matches[cur_match_end-1]
				cur_match_pos++
				num_matches[i] = 1

				/* Add the tail of the copy to the hasher. */
				hasher.StoreRange(ringbuffer, ringbuffer_mask, pos+1, brotli_min_size_t(pos+match_len, store_end))
				var pos uint = i
				for i := 0; i < int(skip); i++ {
					num_matches[pos+1:][i] = 0
				}
				i += skip
			} else {
				cur_match_pos = cur_match_end
			}
		}
	}

	orig_num_literals = *num_literals
	orig_last_insert_len = *last_insert_len
	copy(orig_dist_cache[:], dist_cache[:4])
	orig_num_commands = len(*commands)
	nodes = make([]zopfliNode, (num_bytes + 1))
	initZopfliCostModel(&model, &params.dist, num_bytes)
	for i = 0; i < 2; i++ {
		initZopfliNodes(nodes, num_bytes+1)
		if i == 0 {
			zopfliCostModelSetFromLiteralCosts(&model, position, ringbuffer, ringbuffer_mask)
		} else {
			zopfliCostModelSetFromCommands(&model, position, ringbuffer, ringbuffer_mask, (*commands)[orig_num_commands:], orig_last_insert_len)
		}

		*commands = (*commands)[:orig_num_commands]
		*num_literals = orig_num_literals
		*last_insert_len = orig_last_insert_len
		copy(dist_cache, orig_dist_cache[:4])
		zopfliIterate(num_bytes, position, ringbuffer, ringbuffer_mask, params, gap, dist_cache, &model, num_matches, matches, nodes)
		zopfliCreateCommands(num_bytes, position, nodes, dist_cache, last_insert_len, params, commands, num_literals)
	}

	cleanupZopfliCostModel(&model)
	nodes = nil
	matches = nil
	num_matches = nil
}
