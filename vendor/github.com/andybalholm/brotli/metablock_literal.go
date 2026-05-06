package brotli

/* Copyright 2015 Google Inc. All Rights Reserved.

   Distributed under MIT license.
   See file LICENSE for detail or copy at https://opensource.org/licenses/MIT
*/

/* Greedy block splitter for one block category (literal, command or distance).
 */
type blockSplitterLiteral struct {
	alphabet_size_     uint
	min_block_size_    uint
	split_threshold_   float64
	num_blocks_        uint
	split_             *blockSplit
	histograms_        []histogramLiteral
	histograms_size_   *uint
	target_block_size_ uint
	block_size_        uint
	curr_histogram_ix_ uint
	last_histogram_ix_ [2]uint
	last_entropy_      [2]float64
	merge_last_count_  uint
}

func initBlockSplitterLiteral(self *blockSplitterLiteral, alphabet_size uint, min_block_size uint, split_threshold float64, num_symbols uint, split *blockSplit, histograms *[]histogramLiteral, histograms_size *uint) {
	var max_num_blocks uint = num_symbols/min_block_size + 1
	var max_num_types uint = brotli_min_size_t(max_num_blocks, maxNumberOfBlockTypes+1)
	/* We have to allocate one more histogram than the maximum number of block
	   types for the current histogram when the meta-block is too big. */
	self.alphabet_size_ = alphabet_size

	self.min_block_size_ = min_block_size
	self.split_threshold_ = split_threshold
	self.num_blocks_ = 0
	self.split_ = split
	self.histograms_size_ = histograms_size
	self.target_block_size_ = min_block_size
	self.block_size_ = 0
	self.curr_histogram_ix_ = 0
	self.merge_last_count_ = 0
	brotli_ensure_capacity_uint8_t(&split.types, &split.types_alloc_size, max_num_blocks)
	brotli_ensure_capacity_uint32_t(&split.lengths, &split.lengths_alloc_size, max_num_blocks)
	self.split_.num_blocks = max_num_blocks
	*histograms_size = max_num_types
	if histograms == nil || cap(*histograms) < int(*histograms_size) {
		*histograms = make([]histogramLiteral, *histograms_size)
	} else {
		*histograms = (*histograms)[:*histograms_size]
	}
	self.histograms_ = *histograms

	/* Clear only current histogram. */
	histogramClearLiteral(&self.histograms_[0])

	self.last_histogram_ix_[1] = 0
	self.last_histogram_ix_[0] = self.last_histogram_ix_[1]
}

/* Does either of three things:
   (1) emits the current block with a new block type;
   (2) emits the current block with the type of the second last block;
   (3) merges the current block with the last block. */
func blockSplitterFinishBlockLiteral(self *blockSplitterLiteral, is_final bool) {
	var split *blockSplit = self.split_
	var last_entropy []float64 = self.last_entropy_[:]
	var histograms []histogramLiteral = self.histograms_
	self.block_size_ = brotli_max_size_t(self.block_size_, self.min_block_size_)
	if self.num_blocks_ == 0 {
		/* Create first block. */
		split.lengths[0] = uint32(self.block_size_)

		split.types[0] = 0
		last_entropy[0] = bitsEntropy(histograms[0].data_[:], self.alphabet_size_)
		last_entropy[1] = last_entropy[0]
		self.num_blocks_++
		split.num_types++
		self.curr_histogram_ix_++
		if self.curr_histogram_ix_ < *self.histograms_size_ {
			histogramClearLiteral(&histograms[self.curr_histogram_ix_])
		}
		self.block_size_ = 0
	} else if self.block_size_ > 0 {
		var entropy float64 = bitsEntropy(histograms[self.curr_histogram_ix_].data_[:], self.alphabet_size_)
		var combined_histo [2]histogramLiteral
		var combined_entropy [2]float64
		var diff [2]float64
		var j uint
		for j = 0; j < 2; j++ {
			var last_histogram_ix uint = self.last_histogram_ix_[j]
			combined_histo[j] = histograms[self.curr_histogram_ix_]
			histogramAddHistogramLiteral(&combined_histo[j], &histograms[last_histogram_ix])
			combined_entropy[j] = bitsEntropy(combined_histo[j].data_[0:], self.alphabet_size_)
			diff[j] = combined_entropy[j] - entropy - last_entropy[j]
		}

		if split.num_types < maxNumberOfBlockTypes && diff[0] > self.split_threshold_ && diff[1] > self.split_threshold_ {
			/* Create new block. */
			split.lengths[self.num_blocks_] = uint32(self.block_size_)

			split.types[self.num_blocks_] = byte(split.num_types)
			self.last_histogram_ix_[1] = self.last_histogram_ix_[0]
			self.last_histogram_ix_[0] = uint(byte(split.num_types))
			last_entropy[1] = last_entropy[0]
			last_entropy[0] = entropy
			self.num_blocks_++
			split.num_types++
			self.curr_histogram_ix_++
			if self.curr_histogram_ix_ < *self.histograms_size_ {
				histogramClearLiteral(&histograms[self.curr_histogram_ix_])
			}
			self.block_size_ = 0
			self.merge_last_count_ = 0
			self.target_block_size_ = self.min_block_size_
		} else if diff[1] < diff[0]-20.0 {
			split.lengths[self.num_blocks_] = uint32(self.block_size_)
			split.types[self.num_blocks_] = split.types[self.num_blocks_-2]
			/* Combine this block with second last block. */

			var tmp uint = self.last_histogram_ix_[0]
			self.last_histogram_ix_[0] = self.last_histogram_ix_[1]
			self.last_histogram_ix_[1] = tmp
			histograms[self.last_histogram_ix_[0]] = combined_histo[1]
			last_entropy[1] = last_entropy[0]
			last_entropy[0] = combined_entropy[1]
			self.num_blocks_++
			self.block_size_ = 0
			histogramClearLiteral(&histograms[self.curr_histogram_ix_])
			self.merge_last_count_ = 0
			self.target_block_size_ = self.min_block_size_
		} else {
			/* Combine this block with last block. */
			split.lengths[self.num_blocks_-1] += uint32(self.block_size_)

			histograms[self.last_histogram_ix_[0]] = combined_histo[0]
			last_entropy[0] = combined_entropy[0]
			if split.num_types == 1 {
				last_entropy[1] = last_entropy[0]
			}

			self.block_size_ = 0
			histogramClearLiteral(&histograms[self.curr_histogram_ix_])
			self.merge_last_count_++
			if self.merge_last_count_ > 1 {
				self.target_block_size_ += self.min_block_size_
			}
		}
	}

	if is_final {
		*self.histograms_size_ = split.num_types
		split.num_blocks = self.num_blocks_
	}
}

/* Adds the next symbol to the current histogram. When the current histogram
   reaches the target size, decides on merging the block. */
func blockSplitterAddSymbolLiteral(self *blockSplitterLiteral, symbol uint) {
	histogramAddLiteral(&self.histograms_[self.curr_histogram_ix_], symbol)
	self.block_size_++
	if self.block_size_ == self.target_block_size_ {
		blockSplitterFinishBlockLiteral(self, false) /* is_final = */
	}
}
