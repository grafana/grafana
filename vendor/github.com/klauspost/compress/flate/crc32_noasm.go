//+build !amd64 noasm appengine

// Copyright 2015, Klaus Post, see LICENSE for details.

package flate

func init() {
	useSSE42 = false
}

// crc32sse should never be called.
func crc32sse(a []byte) uint32 {
	panic("no assembler")
}

// crc32sseAll should never be called.
func crc32sseAll(a []byte, dst []uint32) {
	panic("no assembler")
}

// matchLenSSE4 should never be called.
func matchLenSSE4(a, b []byte, max int) int {
	panic("no assembler")
	return 0
}

// histogram accumulates a histogram of b in h.
//
// len(h) must be >= 256, and h's elements must be all zeroes.
func histogram(b []byte, h []int32) {
	h = h[:256]
	for _, t := range b {
		h[t]++
	}
}
