package brotli

import "math"

/* The distance symbols effectively used by "Large Window Brotli" (32-bit). */
const numHistogramDistanceSymbols = 544

type histogramLiteral struct {
	data_        [numLiteralSymbols]uint32
	total_count_ uint
	bit_cost_    float64
}

func histogramClearLiteral(self *histogramLiteral) {
	self.data_ = [numLiteralSymbols]uint32{}
	self.total_count_ = 0
	self.bit_cost_ = math.MaxFloat64
}

func clearHistogramsLiteral(array []histogramLiteral, length uint) {
	var i uint
	for i = 0; i < length; i++ {
		histogramClearLiteral(&array[i:][0])
	}
}

func histogramAddLiteral(self *histogramLiteral, val uint) {
	self.data_[val]++
	self.total_count_++
}

func histogramAddVectorLiteral(self *histogramLiteral, p []byte, n uint) {
	self.total_count_ += n
	n += 1
	for {
		n--
		if n == 0 {
			break
		}
		self.data_[p[0]]++
		p = p[1:]
	}
}

func histogramAddHistogramLiteral(self *histogramLiteral, v *histogramLiteral) {
	var i uint
	self.total_count_ += v.total_count_
	for i = 0; i < numLiteralSymbols; i++ {
		self.data_[i] += v.data_[i]
	}
}

func histogramDataSizeLiteral() uint {
	return numLiteralSymbols
}

type histogramCommand struct {
	data_        [numCommandSymbols]uint32
	total_count_ uint
	bit_cost_    float64
}

func histogramClearCommand(self *histogramCommand) {
	self.data_ = [numCommandSymbols]uint32{}
	self.total_count_ = 0
	self.bit_cost_ = math.MaxFloat64
}

func clearHistogramsCommand(array []histogramCommand, length uint) {
	var i uint
	for i = 0; i < length; i++ {
		histogramClearCommand(&array[i:][0])
	}
}

func histogramAddCommand(self *histogramCommand, val uint) {
	self.data_[val]++
	self.total_count_++
}

func histogramAddVectorCommand(self *histogramCommand, p []uint16, n uint) {
	self.total_count_ += n
	n += 1
	for {
		n--
		if n == 0 {
			break
		}
		self.data_[p[0]]++
		p = p[1:]
	}
}

func histogramAddHistogramCommand(self *histogramCommand, v *histogramCommand) {
	var i uint
	self.total_count_ += v.total_count_
	for i = 0; i < numCommandSymbols; i++ {
		self.data_[i] += v.data_[i]
	}
}

func histogramDataSizeCommand() uint {
	return numCommandSymbols
}

type histogramDistance struct {
	data_        [numDistanceSymbols]uint32
	total_count_ uint
	bit_cost_    float64
}

func histogramClearDistance(self *histogramDistance) {
	self.data_ = [numDistanceSymbols]uint32{}
	self.total_count_ = 0
	self.bit_cost_ = math.MaxFloat64
}

func clearHistogramsDistance(array []histogramDistance, length uint) {
	var i uint
	for i = 0; i < length; i++ {
		histogramClearDistance(&array[i:][0])
	}
}

func histogramAddDistance(self *histogramDistance, val uint) {
	self.data_[val]++
	self.total_count_++
}

func histogramAddVectorDistance(self *histogramDistance, p []uint16, n uint) {
	self.total_count_ += n
	n += 1
	for {
		n--
		if n == 0 {
			break
		}
		self.data_[p[0]]++
		p = p[1:]
	}
}

func histogramAddHistogramDistance(self *histogramDistance, v *histogramDistance) {
	var i uint
	self.total_count_ += v.total_count_
	for i = 0; i < numDistanceSymbols; i++ {
		self.data_[i] += v.data_[i]
	}
}

func histogramDataSizeDistance() uint {
	return numDistanceSymbols
}

type blockSplitIterator struct {
	split_  *blockSplit
	idx_    uint
	type_   uint
	length_ uint
}

func initBlockSplitIterator(self *blockSplitIterator, split *blockSplit) {
	self.split_ = split
	self.idx_ = 0
	self.type_ = 0
	if len(split.lengths) > 0 {
		self.length_ = uint(split.lengths[0])
	} else {
		self.length_ = 0
	}
}

func blockSplitIteratorNext(self *blockSplitIterator) {
	if self.length_ == 0 {
		self.idx_++
		self.type_ = uint(self.split_.types[self.idx_])
		self.length_ = uint(self.split_.lengths[self.idx_])
	}

	self.length_--
}

func buildHistogramsWithContext(cmds []command, literal_split *blockSplit, insert_and_copy_split *blockSplit, dist_split *blockSplit, ringbuffer []byte, start_pos uint, mask uint, prev_byte byte, prev_byte2 byte, context_modes []int, literal_histograms []histogramLiteral, insert_and_copy_histograms []histogramCommand, copy_dist_histograms []histogramDistance) {
	var pos uint = start_pos
	var literal_it blockSplitIterator
	var insert_and_copy_it blockSplitIterator
	var dist_it blockSplitIterator

	initBlockSplitIterator(&literal_it, literal_split)
	initBlockSplitIterator(&insert_and_copy_it, insert_and_copy_split)
	initBlockSplitIterator(&dist_it, dist_split)
	for i := range cmds {
		var cmd *command = &cmds[i]
		var j uint
		blockSplitIteratorNext(&insert_and_copy_it)
		histogramAddCommand(&insert_and_copy_histograms[insert_and_copy_it.type_], uint(cmd.cmd_prefix_))

		/* TODO: unwrap iterator blocks. */
		for j = uint(cmd.insert_len_); j != 0; j-- {
			var context uint
			blockSplitIteratorNext(&literal_it)
			context = literal_it.type_
			if context_modes != nil {
				var lut contextLUT = getContextLUT(context_modes[context])
				context = (context << literalContextBits) + uint(getContext(prev_byte, prev_byte2, lut))
			}

			histogramAddLiteral(&literal_histograms[context], uint(ringbuffer[pos&mask]))
			prev_byte2 = prev_byte
			prev_byte = ringbuffer[pos&mask]
			pos++
		}

		pos += uint(commandCopyLen(cmd))
		if commandCopyLen(cmd) != 0 {
			prev_byte2 = ringbuffer[(pos-2)&mask]
			prev_byte = ringbuffer[(pos-1)&mask]
			if cmd.cmd_prefix_ >= 128 {
				var context uint
				blockSplitIteratorNext(&dist_it)
				context = uint(uint32(dist_it.type_<<distanceContextBits) + commandDistanceContext(cmd))
				histogramAddDistance(&copy_dist_histograms[context], uint(cmd.dist_prefix_)&0x3FF)
			}
		}
	}
}
