package varint

const maxUint64 = uint64(1<<64 - 1)

// MaxLenN is the maximum length of a varint-encoded N-bit integer.
const (
	MaxLen8  = 2
	MaxLen16 = 3
	MaxLen32 = 5
	MaxLen64 = 10
)

// MaxValN is the maximum varint-encoded integer that fits in N bytes.
const (
	MaxVal9 = maxUint64 >> (1 + iota*7)
	MaxVal8
	MaxVal7
	MaxVal6
	MaxVal5
	MaxVal4
	MaxVal3
	MaxVal2
	MaxVal1
)

// UvarintSize returns the number of bytes necessary to encode a given uint.
func UvarintSize(x uint64) int {
	if x <= MaxVal4 {
		if x <= MaxVal1 {
			return 1
		} else if x <= MaxVal2 {
			return 2
		} else if x <= MaxVal3 {
			return 3
		}
		return 4
	}
	if x <= MaxVal5 {
		return 5
	} else if x <= MaxVal6 {
		return 6
	} else if x <= MaxVal7 {
		return 7
	} else if x <= MaxVal8 {
		return 8
	} else if x <= MaxVal9 {
		return 9
	}
	return 10
}

// Uvarint decodes a uint64 from buf and returns that value and the
// number of bytes read (> 0). If an error occurred, the value is 0
// and the number of bytes n is <= 0 meaning:
//
// 	n == 0: buf too small
// 	n  < 0: value larger than 64 bits (overflow)
// 	        and -n is the number of bytes read
//
func Uvarint(buf []byte) (uint64, int) {
	// Fully unrolled implementation of binary.Uvarint.
	//
	// It will also eliminate bound checks for buffers larger than 9 bytes.
	sz := len(buf)
	if sz == 0 {
		return 0, 0
	}
	const (
		step = 7
		bit  = 1 << 7
		mask = bit - 1
	)
	if sz >= 10 { // no bound checks
		// i == 0
		b := buf[0]
		if b < bit {
			return uint64(b), 1
		}
		x := uint64(b & mask)
		var s uint = step

		// i == 1
		b = buf[1]
		if b < bit {
			return x | uint64(b)<<s, 2
		}
		x |= uint64(b&mask) << s
		s += step

		// i == 2
		b = buf[2]
		if b < bit {
			return x | uint64(b)<<s, 3
		}
		x |= uint64(b&mask) << s
		s += step

		// i == 3
		b = buf[3]
		if b < bit {
			return x | uint64(b)<<s, 4
		}
		x |= uint64(b&mask) << s
		s += step

		// i == 4
		b = buf[4]
		if b < bit {
			return x | uint64(b)<<s, 5
		}
		x |= uint64(b&mask) << s
		s += step

		// i == 5
		b = buf[5]
		if b < bit {
			return x | uint64(b)<<s, 6
		}
		x |= uint64(b&mask) << s
		s += step

		// i == 6
		b = buf[6]
		if b < bit {
			return x | uint64(b)<<s, 7
		}
		x |= uint64(b&mask) << s
		s += step

		// i == 7
		b = buf[7]
		if b < bit {
			return x | uint64(b)<<s, 8
		}
		x |= uint64(b&mask) << s
		s += step

		// i == 8
		b = buf[8]
		if b < bit {
			return x | uint64(b)<<s, 9
		}
		x |= uint64(b&mask) << s
		s += step

		// i == 9
		b = buf[9]
		if b < bit {
			if b > 1 {
				return 0, -10 // overflow
			}
			return x | uint64(b)<<s, 10
		} else if sz == 10 {
			return 0, 0
		}
		for j, b := range buf[10:] {
			if b < bit {
				return 0, -(11 + j)
			}
		}
		return 0, 0
	}

	// i == 0
	b := buf[0]
	if b < bit {
		return uint64(b), 1
	} else if sz == 1 {
		return 0, 0
	}
	x := uint64(b & mask)
	var s uint = step

	// i == 1
	b = buf[1]
	if b < bit {
		return x | uint64(b)<<s, 2
	} else if sz == 2 {
		return 0, 0
	}
	x |= uint64(b&mask) << s
	s += step

	// i == 2
	b = buf[2]
	if b < bit {
		return x | uint64(b)<<s, 3
	} else if sz == 3 {
		return 0, 0
	}
	x |= uint64(b&mask) << s
	s += step

	// i == 3
	b = buf[3]
	if b < bit {
		return x | uint64(b)<<s, 4
	} else if sz == 4 {
		return 0, 0
	}
	x |= uint64(b&mask) << s
	s += step

	// i == 4
	b = buf[4]
	if b < bit {
		return x | uint64(b)<<s, 5
	} else if sz == 5 {
		return 0, 0
	}
	x |= uint64(b&mask) << s
	s += step

	// i == 5
	b = buf[5]
	if b < bit {
		return x | uint64(b)<<s, 6
	} else if sz == 6 {
		return 0, 0
	}
	x |= uint64(b&mask) << s
	s += step

	// i == 6
	b = buf[6]
	if b < bit {
		return x | uint64(b)<<s, 7
	} else if sz == 7 {
		return 0, 0
	}
	x |= uint64(b&mask) << s
	s += step

	// i == 7
	b = buf[7]
	if b < bit {
		return x | uint64(b)<<s, 8
	} else if sz == 8 {
		return 0, 0
	}
	x |= uint64(b&mask) << s
	s += step

	// i == 8
	b = buf[8]
	if b < bit {
		return x | uint64(b)<<s, 9
	} else if sz == 9 {
		return 0, 0
	}
	x |= uint64(b&mask) << s
	s += step

	// i == 9
	b = buf[9]
	if b < bit {
		if b > 1 {
			return 0, -10 // overflow
		}
		return x | uint64(b)<<s, 10
	} else if sz == 10 {
		return 0, 0
	}
	for j, b := range buf[10:] {
		if b < bit {
			return 0, -(11 + j)
		}
	}
	return 0, 0
}
