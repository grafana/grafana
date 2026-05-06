package json

import (
	"math/bits"
	"unsafe"
)

const (
	lsb = 0x0101010101010101
	msb = 0x8080808080808080
)

// escapeIndex finds the index of the first char in `s` that requires escaping.
// A char requires escaping if it's outside of the range of [0x20, 0x7F] or if
// it includes a double quote or backslash. If the escapeHTML mode is enabled,
// the chars <, > and & also require escaping. If no chars in `s` require
// escaping, the return value is -1.
func escapeIndex(s string, escapeHTML bool) int {
	chunks := stringToUint64(s)
	for _, n := range chunks {
		// combine masks before checking for the MSB of each byte. We include
		// `n` in the mask to check whether any of the *input* byte MSBs were
		// set (i.e. the byte was outside the ASCII range).
		mask := n | below(n, 0x20) | contains(n, '"') | contains(n, '\\')
		if escapeHTML {
			mask |= contains(n, '<') | contains(n, '>') | contains(n, '&')
		}
		if (mask & msb) != 0 {
			return bits.TrailingZeros64(mask&msb) / 8
		}
	}

	for i := len(chunks) * 8; i < len(s); i++ {
		c := s[i]
		if c < 0x20 || c > 0x7f || c == '"' || c == '\\' || (escapeHTML && (c == '<' || c == '>' || c == '&')) {
			return i
		}
	}

	return -1
}

// below return a mask that can be used to determine if any of the bytes
// in `n` are below `b`. If a byte's MSB is set in the mask then that byte was
// below `b`. The result is only valid if `b`, and each byte in `n`, is below
// 0x80.
func below(n uint64, b byte) uint64 {
	return n - expand(b)
}

// contains returns a mask that can be used to determine if any of the
// bytes in `n` are equal to `b`. If a byte's MSB is set in the mask then
// that byte is equal to `b`. The result is only valid if `b`, and each
// byte in `n`, is below 0x80.
func contains(n uint64, b byte) uint64 {
	return (n ^ expand(b)) - lsb
}

// expand puts the specified byte into each of the 8 bytes of a uint64.
func expand(b byte) uint64 {
	return lsb * uint64(b)
}

func stringToUint64(s string) []uint64 {
	return *(*[]uint64)(unsafe.Pointer(&sliceHeader{
		Data: *(*unsafe.Pointer)(unsafe.Pointer(&s)),
		Len:  len(s) / 8,
		Cap:  len(s) / 8,
	}))
}
