package bitset

import "math/bits"

func select64(w uint64, j uint) uint {
	seen := 0
	// Divide 64bit
	part := w & 0xFFFFFFFF
	n := uint(bits.OnesCount64(part))
	if n <= j {
		part = w >> 32
		seen += 32
		j -= n
	}
	ww := part

	// Divide 32bit
	part = ww & 0xFFFF

	n = uint(bits.OnesCount64(part))
	if n <= j {
		part = ww >> 16
		seen += 16
		j -= n
	}
	ww = part

	// Divide 16bit
	part = ww & 0xFF
	n = uint(bits.OnesCount64(part))
	if n <= j {
		part = ww >> 8
		seen += 8
		j -= n
	}
	ww = part

	// Lookup in final byte
	counter := 0
	for ; counter < 8; counter++ {
		j -= uint((ww >> counter) & 1)
		if j+1 == 0 {
			break
		}
	}
	return uint(seen + counter)
}
