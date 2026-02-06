package puddle

import "unsafe"

type ints interface {
	int | int8 | int16 | int32 | int64 | uint | uint8 | uint16 | uint32 | uint64
}

// log2Int returns log2 of an integer. This function panics if val < 0. For val
// == 0, returns 0.
func log2Int[T ints](val T) uint8 {
	if val <= 0 {
		panic("log2 of non-positive number does not exist")
	}

	return log2IntRange(val, 0, uint8(8*unsafe.Sizeof(val)))
}

func log2IntRange[T ints](val T, begin, end uint8) uint8 {
	length := end - begin
	if length == 1 {
		return begin
	}

	delim := begin + length/2
	mask := T(1) << delim
	if mask > val {
		return log2IntRange(val, begin, delim)
	} else {
		return log2IntRange(val, delim, end)
	}
}
