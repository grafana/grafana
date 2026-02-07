package brotli

var kInsBase = []uint32{
	0,
	1,
	2,
	3,
	4,
	5,
	6,
	8,
	10,
	14,
	18,
	26,
	34,
	50,
	66,
	98,
	130,
	194,
	322,
	578,
	1090,
	2114,
	6210,
	22594,
}

var kInsExtra = []uint32{
	0,
	0,
	0,
	0,
	0,
	0,
	1,
	1,
	2,
	2,
	3,
	3,
	4,
	4,
	5,
	5,
	6,
	7,
	8,
	9,
	10,
	12,
	14,
	24,
}

var kCopyBase = []uint32{
	2,
	3,
	4,
	5,
	6,
	7,
	8,
	9,
	10,
	12,
	14,
	18,
	22,
	30,
	38,
	54,
	70,
	102,
	134,
	198,
	326,
	582,
	1094,
	2118,
}

var kCopyExtra = []uint32{
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	1,
	1,
	2,
	2,
	3,
	3,
	4,
	4,
	5,
	5,
	6,
	7,
	8,
	9,
	10,
	24,
}

func getInsertLengthCode(insertlen uint) uint16 {
	if insertlen < 6 {
		return uint16(insertlen)
	} else if insertlen < 130 {
		var nbits uint32 = log2FloorNonZero(insertlen-2) - 1
		return uint16((nbits << 1) + uint32((insertlen-2)>>nbits) + 2)
	} else if insertlen < 2114 {
		return uint16(log2FloorNonZero(insertlen-66) + 10)
	} else if insertlen < 6210 {
		return 21
	} else if insertlen < 22594 {
		return 22
	} else {
		return 23
	}
}

func getCopyLengthCode(copylen uint) uint16 {
	if copylen < 10 {
		return uint16(copylen - 2)
	} else if copylen < 134 {
		var nbits uint32 = log2FloorNonZero(copylen-6) - 1
		return uint16((nbits << 1) + uint32((copylen-6)>>nbits) + 4)
	} else if copylen < 2118 {
		return uint16(log2FloorNonZero(copylen-70) + 12)
	} else {
		return 23
	}
}

func combineLengthCodes(inscode uint16, copycode uint16, use_last_distance bool) uint16 {
	var bits64 uint16 = uint16(copycode&0x7 | (inscode&0x7)<<3)
	if use_last_distance && inscode < 8 && copycode < 16 {
		if copycode < 8 {
			return bits64
		} else {
			return bits64 | 64
		}
	} else {
		/* Specification: 5 Encoding of ... (last table) */
		/* offset = 2 * index, where index is in range [0..8] */
		var offset uint32 = 2 * ((uint32(copycode) >> 3) + 3*(uint32(inscode)>>3))

		/* All values in specification are K * 64,
		   where   K = [2, 3, 6, 4, 5, 8, 7, 9, 10],
		       i + 1 = [1, 2, 3, 4, 5, 6, 7, 8,  9],
		   K - i - 1 = [1, 1, 3, 0, 0, 2, 0, 1,  2] = D.
		   All values in D require only 2 bits to encode.
		   Magic constant is shifted 6 bits left, to avoid final multiplication. */
		offset = (offset << 5) + 0x40 + ((0x520D40 >> offset) & 0xC0)

		return uint16(offset | uint32(bits64))
	}
}

func getLengthCode(insertlen uint, copylen uint, use_last_distance bool, code *uint16) {
	var inscode uint16 = getInsertLengthCode(insertlen)
	var copycode uint16 = getCopyLengthCode(copylen)
	*code = combineLengthCodes(inscode, copycode, use_last_distance)
}

func getInsertBase(inscode uint16) uint32 {
	return kInsBase[inscode]
}

func getInsertExtra(inscode uint16) uint32 {
	return kInsExtra[inscode]
}

func getCopyBase(copycode uint16) uint32 {
	return kCopyBase[copycode]
}

func getCopyExtra(copycode uint16) uint32 {
	return kCopyExtra[copycode]
}

type command struct {
	insert_len_  uint32
	copy_len_    uint32
	dist_extra_  uint32
	cmd_prefix_  uint16
	dist_prefix_ uint16
}

/* distance_code is e.g. 0 for same-as-last short code, or 16 for offset 1. */
func makeCommand(dist *distanceParams, insertlen uint, copylen uint, copylen_code_delta int, distance_code uint) (cmd command) {
	/* Don't rely on signed int representation, use honest casts. */
	var delta uint32 = uint32(byte(int8(copylen_code_delta)))
	cmd.insert_len_ = uint32(insertlen)
	cmd.copy_len_ = uint32(uint32(copylen) | delta<<25)

	/* The distance prefix and extra bits are stored in this Command as if
	   npostfix and ndirect were 0, they are only recomputed later after the
	   clustering if needed. */
	prefixEncodeCopyDistance(distance_code, uint(dist.num_direct_distance_codes), uint(dist.distance_postfix_bits), &cmd.dist_prefix_, &cmd.dist_extra_)
	getLengthCode(insertlen, uint(int(copylen)+copylen_code_delta), (cmd.dist_prefix_&0x3FF == 0), &cmd.cmd_prefix_)

	return cmd
}

func makeInsertCommand(insertlen uint) (cmd command) {
	cmd.insert_len_ = uint32(insertlen)
	cmd.copy_len_ = 4 << 25
	cmd.dist_extra_ = 0
	cmd.dist_prefix_ = numDistanceShortCodes
	getLengthCode(insertlen, 4, false, &cmd.cmd_prefix_)
	return cmd
}

func commandRestoreDistanceCode(self *command, dist *distanceParams) uint32 {
	if uint32(self.dist_prefix_&0x3FF) < numDistanceShortCodes+dist.num_direct_distance_codes {
		return uint32(self.dist_prefix_) & 0x3FF
	} else {
		var dcode uint32 = uint32(self.dist_prefix_) & 0x3FF
		var nbits uint32 = uint32(self.dist_prefix_) >> 10
		var extra uint32 = self.dist_extra_
		var postfix_mask uint32 = (1 << dist.distance_postfix_bits) - 1
		var hcode uint32 = (dcode - dist.num_direct_distance_codes - numDistanceShortCodes) >> dist.distance_postfix_bits
		var lcode uint32 = (dcode - dist.num_direct_distance_codes - numDistanceShortCodes) & postfix_mask
		var offset uint32 = ((2 + (hcode & 1)) << nbits) - 4
		return ((offset + extra) << dist.distance_postfix_bits) + lcode + dist.num_direct_distance_codes + numDistanceShortCodes
	}
}

func commandDistanceContext(self *command) uint32 {
	var r uint32 = uint32(self.cmd_prefix_) >> 6
	var c uint32 = uint32(self.cmd_prefix_) & 7
	if (r == 0 || r == 2 || r == 4 || r == 7) && (c <= 2) {
		return c
	}

	return 3
}

func commandCopyLen(self *command) uint32 {
	return self.copy_len_ & 0x1FFFFFF
}

func commandCopyLenCode(self *command) uint32 {
	var modifier uint32 = self.copy_len_ >> 25
	var delta int32 = int32(int8(byte(modifier | (modifier&0x40)<<1)))
	return uint32(int32(self.copy_len_&0x1FFFFFF) + delta)
}
