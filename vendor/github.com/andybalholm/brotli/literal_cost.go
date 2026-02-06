package brotli

func utf8Position(last uint, c uint, clamp uint) uint {
	if c < 128 {
		return 0 /* Next one is the 'Byte 1' again. */
	} else if c >= 192 { /* Next one is the 'Byte 2' of utf-8 encoding. */
		return brotli_min_size_t(1, clamp)
	} else {
		/* Let's decide over the last byte if this ends the sequence. */
		if last < 0xE0 {
			return 0 /* Completed two or three byte coding. */ /* Next one is the 'Byte 3' of utf-8 encoding. */
		} else {
			return brotli_min_size_t(2, clamp)
		}
	}
}

func decideMultiByteStatsLevel(pos uint, len uint, mask uint, data []byte) uint {
	var counts = [3]uint{0} /* should be 2, but 1 compresses better. */
	var max_utf8 uint = 1
	var last_c uint = 0
	var i uint
	for i = 0; i < len; i++ {
		var c uint = uint(data[(pos+i)&mask])
		counts[utf8Position(last_c, c, 2)]++
		last_c = c
	}

	if counts[2] < 500 {
		max_utf8 = 1
	}

	if counts[1]+counts[2] < 25 {
		max_utf8 = 0
	}

	return max_utf8
}

func estimateBitCostsForLiteralsUTF8(pos uint, len uint, mask uint, data []byte, cost []float32) {
	var max_utf8 uint = decideMultiByteStatsLevel(pos, uint(len), mask, data)
	/* Bootstrap histograms. */
	var histogram = [3][256]uint{[256]uint{0}}
	var window_half uint = 495
	var in_window uint = brotli_min_size_t(window_half, uint(len))
	var in_window_utf8 = [3]uint{0}
	/* max_utf8 is 0 (normal ASCII single byte modeling),
	   1 (for 2-byte UTF-8 modeling), or 2 (for 3-byte UTF-8 modeling). */

	var i uint
	{
		var last_c uint = 0
		var utf8_pos uint = 0
		for i = 0; i < in_window; i++ {
			var c uint = uint(data[(pos+i)&mask])
			histogram[utf8_pos][c]++
			in_window_utf8[utf8_pos]++
			utf8_pos = utf8Position(last_c, c, max_utf8)
			last_c = c
		}
	}

	/* Compute bit costs with sliding window. */
	for i = 0; i < len; i++ {
		if i >= window_half {
			var c uint
			var last_c uint
			if i < window_half+1 {
				c = 0
			} else {
				c = uint(data[(pos+i-window_half-1)&mask])
			}
			if i < window_half+2 {
				last_c = 0
			} else {
				last_c = uint(data[(pos+i-window_half-2)&mask])
			}
			/* Remove a byte in the past. */

			var utf8_pos2 uint = utf8Position(last_c, c, max_utf8)
			histogram[utf8_pos2][data[(pos+i-window_half)&mask]]--
			in_window_utf8[utf8_pos2]--
		}

		if i+window_half < len {
			var c uint = uint(data[(pos+i+window_half-1)&mask])
			var last_c uint = uint(data[(pos+i+window_half-2)&mask])
			/* Add a byte in the future. */

			var utf8_pos2 uint = utf8Position(last_c, c, max_utf8)
			histogram[utf8_pos2][data[(pos+i+window_half)&mask]]++
			in_window_utf8[utf8_pos2]++
		}
		{
			var c uint
			var last_c uint
			if i < 1 {
				c = 0
			} else {
				c = uint(data[(pos+i-1)&mask])
			}
			if i < 2 {
				last_c = 0
			} else {
				last_c = uint(data[(pos+i-2)&mask])
			}
			var utf8_pos uint = utf8Position(last_c, c, max_utf8)
			var masked_pos uint = (pos + i) & mask
			var histo uint = histogram[utf8_pos][data[masked_pos]]
			var lit_cost float64
			if histo == 0 {
				histo = 1
			}

			lit_cost = fastLog2(in_window_utf8[utf8_pos]) - fastLog2(histo)
			lit_cost += 0.02905
			if lit_cost < 1.0 {
				lit_cost *= 0.5
				lit_cost += 0.5
			}

			/* Make the first bytes more expensive -- seems to help, not sure why.
			   Perhaps because the entropy source is changing its properties
			   rapidly in the beginning of the file, perhaps because the beginning
			   of the data is a statistical "anomaly". */
			if i < 2000 {
				lit_cost += 0.7 - (float64(2000-i) / 2000.0 * 0.35)
			}

			cost[i] = float32(lit_cost)
		}
	}
}

func estimateBitCostsForLiterals(pos uint, len uint, mask uint, data []byte, cost []float32) {
	if isMostlyUTF8(data, pos, mask, uint(len), kMinUTF8Ratio) {
		estimateBitCostsForLiteralsUTF8(pos, uint(len), mask, data, cost)
		return
	} else {
		var histogram = [256]uint{0}
		var window_half uint = 2000
		var in_window uint = brotli_min_size_t(window_half, uint(len))
		var i uint
		/* Bootstrap histogram. */
		for i = 0; i < in_window; i++ {
			histogram[data[(pos+i)&mask]]++
		}

		/* Compute bit costs with sliding window. */
		for i = 0; i < len; i++ {
			var histo uint
			if i >= window_half {
				/* Remove a byte in the past. */
				histogram[data[(pos+i-window_half)&mask]]--

				in_window--
			}

			if i+window_half < len {
				/* Add a byte in the future. */
				histogram[data[(pos+i+window_half)&mask]]++

				in_window++
			}

			histo = histogram[data[(pos+i)&mask]]
			if histo == 0 {
				histo = 1
			}
			{
				var lit_cost float64 = fastLog2(in_window) - fastLog2(histo)
				lit_cost += 0.029
				if lit_cost < 1.0 {
					lit_cost *= 0.5
					lit_cost += 0.5
				}

				cost[i] = float32(lit_cost)
			}
		}
	}
}
