package varint

// ProtoTag decodes a protobuf's field number and wire type pair
// from buf and returns that value and the number of bytes read (> 0).
// If an error occurred, n = 0 is returned.
func ProtoTag(buf []byte) (num int, typ byte, n int) {
	// Same unrolled implementation as in Uvarint.
	//
	// But this time we can check if the wire type and field num
	// are valid when reading the first byte.
	//
	// Also, the swifts are now different, because first 3 bits
	// are for the wire type.
	//
	// The implementation will stop at 9 bytes, returning an error.
	sz := len(buf)
	if sz == 0 {
		return 0, 0, 0
	}
	const (
		bit  = 1 << 7
		mask = bit - 1
		step = 7

		// protobuf
		typBits = 3
		typMask = 1<<3 - 1
	)
	if sz >= 9 { // no bound checks
		// i == 0
		b := buf[0]
		if b == 0 {
			return 0, 0, 0
		}
		typ = b & typMask
		if typ > 5 {
			return 0, 0, 0
		}
		if b < bit {
			num = int(b >> typBits)
			if num == 0 {
				return 0, 0, 0
			}
			n = 1
			return
		}
		num = int((b & mask) >> typBits)
		var s uint = step - typBits

		// i == 1
		b = buf[1]
		if b < bit {
			num |= int(b) << s
			n = 2
			return
		}
		num |= int(b&mask) << s
		s += step

		// i == 2
		b = buf[2]
		if b < bit {
			num |= int(b) << s
			n = 3
			return
		}
		num |= int(b&mask) << s
		s += step

		// i == 3
		b = buf[3]
		if b < bit {
			num |= int(b) << s
			n = 4
			return
		}
		num |= int(b&mask) << s
		s += step

		// i == 4
		b = buf[4]
		if b < bit {
			num |= int(b) << s
			n = 5
			return
		}
		num |= int(b&mask) << s
		s += step

		// i == 5
		b = buf[5]
		if b < bit {
			num |= int(b) << s
			n = 6
			return
		}
		num |= int(b&mask) << s
		s += step

		// i == 6
		b = buf[6]
		if b < bit {
			num |= int(b) << s
			n = 7
			return
		}
		num |= int(b&mask) << s
		s += step

		// i == 7
		b = buf[7]
		if b < bit {
			num |= int(b) << s
			n = 8
			return
		}
		num |= int(b&mask) << s
		s += step

		// i == 8
		b = buf[8]
		if b < bit {
			num |= int(b) << s
			n = 9
			return
		}
		return 0, 0, 0 // too much
	}

	// i == 0
	b := buf[0]
	if b == 0 {
		return 0, 0, 0
	}
	typ = b & typMask
	if typ > 5 {
		return 0, 0, 0
	}
	if b < bit {
		num = int(b >> typBits)
		if num == 0 {
			return 0, 0, 0
		}
		n = 1
		return
	} else if sz == 1 {
		return 0, 0, 0
	}
	num = int((b & mask) >> typBits)
	var s uint = step - typBits

	// i == 1
	b = buf[1]
	if b < bit {
		num |= int(b) << s
		n = 2
		return
	} else if sz == 2 {
		return 0, 0, 0
	}
	num |= int(b&mask) << s
	s += step

	// i == 2
	b = buf[2]
	if b < bit {
		num |= int(b) << s
		n = 3
		return
	} else if sz == 3 {
		return 0, 0, 0
	}
	num |= int(b&mask) << s
	s += step

	// i == 3
	b = buf[3]
	if b < bit {
		num |= int(b) << s
		n = 4
		return
	} else if sz == 4 {
		return 0, 0, 0
	}
	num |= int(b&mask) << s
	s += step

	// i == 4
	b = buf[4]
	if b < bit {
		num |= int(b) << s
		n = 5
		return
	} else if sz == 5 {
		return 0, 0, 0
	}
	num |= int(b&mask) << s
	s += step

	// i == 5
	b = buf[5]
	if b < bit {
		num |= int(b) << s
		n = 6
		return
	} else if sz == 6 {
		return 0, 0, 0
	}
	num |= int(b&mask) << s
	s += step

	// i == 6
	b = buf[6]
	if b < bit {
		num |= int(b) << s
		n = 7
		return
	} else if sz == 7 {
		return 0, 0, 0
	}
	num |= int(b&mask) << s
	s += step

	// i == 7
	b = buf[7]
	if b < bit {
		num |= int(b) << s
		n = 8
		return
	} else if sz == 8 {
		return 0, 0, 0
	}
	num |= int(b&mask) << s
	s += step

	// i == 8
	b = buf[8]
	if b < bit {
		num |= int(b) << s
		n = 9
		return
	}
	return 0, 0, 0 // too much
}
