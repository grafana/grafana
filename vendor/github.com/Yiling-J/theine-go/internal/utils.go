package internal

// RoundUpPowerOf2 is based on https://graphics.stanford.edu/~seander/bithacks.html#RoundUpPowerOf2.
func RoundUpPowerOf2(v uint32) uint32 {
	if v == 0 {
		return 1
	}
	v--
	v |= v >> 1
	v |= v >> 2
	v |= v >> 4
	v |= v >> 8
	v |= v >> 16
	v++
	return v
}
