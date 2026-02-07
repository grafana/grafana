//go:build !appengine && !noasm && gc
// +build !appengine,!noasm,gc

package s2

import (
	"sync"

	"github.com/klauspost/compress/internal/race"
)

const hasAmd64Asm = true

var encPools [4]sync.Pool

// encodeBlock encodes a non-empty src to a guaranteed-large-enough dst. It
// assumes that the varint-encoded length of the decompressed bytes has already
// been written.
//
// It also assumes that:
//
//	len(dst) >= MaxEncodedLen(len(src)) &&
//	minNonLiteralBlockSize <= len(src) && len(src) <= maxBlockSize
func encodeBlock(dst, src []byte) (d int) {
	race.ReadSlice(src)
	race.WriteSlice(dst)

	const (
		// Use 12 bit table when less than...
		limit12B = 16 << 10
		// Use 10 bit table when less than...
		limit10B = 4 << 10
		// Use 8 bit table when less than...
		limit8B = 512
	)

	if len(src) >= 4<<20 {
		const sz, pool = 65536, 0
		tmp, ok := encPools[pool].Get().(*[sz]byte)
		if !ok {
			tmp = &[sz]byte{}
		}
		race.WriteSlice(tmp[:])
		defer encPools[pool].Put(tmp)
		return encodeBlockAsm(dst, src, tmp)
	}
	if len(src) >= limit12B {
		const sz, pool = 65536, 0
		tmp, ok := encPools[pool].Get().(*[sz]byte)
		if !ok {
			tmp = &[sz]byte{}
		}
		race.WriteSlice(tmp[:])
		defer encPools[pool].Put(tmp)
		return encodeBlockAsm4MB(dst, src, tmp)
	}
	if len(src) >= limit10B {
		const sz, pool = 16384, 1
		tmp, ok := encPools[pool].Get().(*[sz]byte)
		if !ok {
			tmp = &[sz]byte{}
		}
		race.WriteSlice(tmp[:])
		defer encPools[pool].Put(tmp)
		return encodeBlockAsm12B(dst, src, tmp)
	}
	if len(src) >= limit8B {
		const sz, pool = 4096, 2
		tmp, ok := encPools[pool].Get().(*[sz]byte)
		if !ok {
			tmp = &[sz]byte{}
		}
		race.WriteSlice(tmp[:])
		defer encPools[pool].Put(tmp)
		return encodeBlockAsm10B(dst, src, tmp)
	}
	if len(src) < minNonLiteralBlockSize {
		return 0
	}
	const sz, pool = 1024, 3
	tmp, ok := encPools[pool].Get().(*[sz]byte)
	if !ok {
		tmp = &[sz]byte{}
	}
	race.WriteSlice(tmp[:])
	defer encPools[pool].Put(tmp)
	return encodeBlockAsm8B(dst, src, tmp)
}

var encBetterPools [5]sync.Pool

// encodeBlockBetter encodes a non-empty src to a guaranteed-large-enough dst. It
// assumes that the varint-encoded length of the decompressed bytes has already
// been written.
//
// It also assumes that:
//
//	len(dst) >= MaxEncodedLen(len(src)) &&
//	minNonLiteralBlockSize <= len(src) && len(src) <= maxBlockSize
func encodeBlockBetter(dst, src []byte) (d int) {
	race.ReadSlice(src)
	race.WriteSlice(dst)

	const (
		// Use 12 bit table when less than...
		limit12B = 16 << 10
		// Use 10 bit table when less than...
		limit10B = 4 << 10
		// Use 8 bit table when less than...
		limit8B = 512
	)

	if len(src) > 4<<20 {
		const sz, pool = 589824, 0
		tmp, ok := encBetterPools[pool].Get().(*[sz]byte)
		if !ok {
			tmp = &[sz]byte{}
		}
		race.WriteSlice(tmp[:])
		defer encBetterPools[pool].Put(tmp)
		return encodeBetterBlockAsm(dst, src, tmp)
	}
	if len(src) >= limit12B {
		const sz, pool = 589824, 0
		tmp, ok := encBetterPools[pool].Get().(*[sz]byte)
		if !ok {
			tmp = &[sz]byte{}
		}
		race.WriteSlice(tmp[:])
		defer encBetterPools[pool].Put(tmp)

		return encodeBetterBlockAsm4MB(dst, src, tmp)
	}
	if len(src) >= limit10B {
		const sz, pool = 81920, 0
		tmp, ok := encBetterPools[pool].Get().(*[sz]byte)
		if !ok {
			tmp = &[sz]byte{}
		}
		race.WriteSlice(tmp[:])
		defer encBetterPools[pool].Put(tmp)

		return encodeBetterBlockAsm12B(dst, src, tmp)
	}
	if len(src) >= limit8B {
		const sz, pool = 20480, 1
		tmp, ok := encBetterPools[pool].Get().(*[sz]byte)
		if !ok {
			tmp = &[sz]byte{}
		}
		race.WriteSlice(tmp[:])
		defer encBetterPools[pool].Put(tmp)
		return encodeBetterBlockAsm10B(dst, src, tmp)
	}
	if len(src) < minNonLiteralBlockSize {
		return 0
	}

	const sz, pool = 5120, 2
	tmp, ok := encBetterPools[pool].Get().(*[sz]byte)
	if !ok {
		tmp = &[sz]byte{}
	}
	race.WriteSlice(tmp[:])
	defer encBetterPools[pool].Put(tmp)
	return encodeBetterBlockAsm8B(dst, src, tmp)
}

// encodeBlockSnappy encodes a non-empty src to a guaranteed-large-enough dst. It
// assumes that the varint-encoded length of the decompressed bytes has already
// been written.
//
// It also assumes that:
//
//	len(dst) >= MaxEncodedLen(len(src)) &&
//	minNonLiteralBlockSize <= len(src) && len(src) <= maxBlockSize
func encodeBlockSnappy(dst, src []byte) (d int) {
	race.ReadSlice(src)
	race.WriteSlice(dst)

	const (
		// Use 12 bit table when less than...
		limit12B = 16 << 10
		// Use 10 bit table when less than...
		limit10B = 4 << 10
		// Use 8 bit table when less than...
		limit8B = 512
	)
	if len(src) > 65536 {
		const sz, pool = 65536, 0
		tmp, ok := encPools[pool].Get().(*[sz]byte)
		if !ok {
			tmp = &[sz]byte{}
		}
		race.WriteSlice(tmp[:])
		defer encPools[pool].Put(tmp)
		return encodeSnappyBlockAsm(dst, src, tmp)
	}
	if len(src) >= limit12B {
		const sz, pool = 65536, 0
		tmp, ok := encPools[pool].Get().(*[sz]byte)
		if !ok {
			tmp = &[sz]byte{}
		}
		race.WriteSlice(tmp[:])
		defer encPools[pool].Put(tmp)
		return encodeSnappyBlockAsm64K(dst, src, tmp)
	}
	if len(src) >= limit10B {
		const sz, pool = 16384, 1
		tmp, ok := encPools[pool].Get().(*[sz]byte)
		if !ok {
			tmp = &[sz]byte{}
		}
		race.WriteSlice(tmp[:])
		defer encPools[pool].Put(tmp)
		return encodeSnappyBlockAsm12B(dst, src, tmp)
	}
	if len(src) >= limit8B {
		const sz, pool = 4096, 2
		tmp, ok := encPools[pool].Get().(*[sz]byte)
		if !ok {
			tmp = &[sz]byte{}
		}
		race.WriteSlice(tmp[:])
		defer encPools[pool].Put(tmp)
		return encodeSnappyBlockAsm10B(dst, src, tmp)
	}
	if len(src) < minNonLiteralBlockSize {
		return 0
	}
	const sz, pool = 1024, 3
	tmp, ok := encPools[pool].Get().(*[sz]byte)
	if !ok {
		tmp = &[sz]byte{}
	}
	race.WriteSlice(tmp[:])
	defer encPools[pool].Put(tmp)
	return encodeSnappyBlockAsm8B(dst, src, tmp)
}

// encodeBlockSnappy encodes a non-empty src to a guaranteed-large-enough dst. It
// assumes that the varint-encoded length of the decompressed bytes has already
// been written.
//
// It also assumes that:
//
//	len(dst) >= MaxEncodedLen(len(src)) &&
//	minNonLiteralBlockSize <= len(src) && len(src) <= maxBlockSize
func encodeBlockBetterSnappy(dst, src []byte) (d int) {
	race.ReadSlice(src)
	race.WriteSlice(dst)

	const (
		// Use 12 bit table when less than...
		limit12B = 16 << 10
		// Use 10 bit table when less than...
		limit10B = 4 << 10
		// Use 8 bit table when less than...
		limit8B = 512
	)
	if len(src) > 65536 {
		const sz, pool = 589824, 0
		tmp, ok := encBetterPools[pool].Get().(*[sz]byte)
		if !ok {
			tmp = &[sz]byte{}
		}
		race.WriteSlice(tmp[:])
		defer encBetterPools[pool].Put(tmp)
		return encodeSnappyBetterBlockAsm(dst, src, tmp)
	}

	if len(src) >= limit12B {
		const sz, pool = 294912, 4
		tmp, ok := encBetterPools[pool].Get().(*[sz]byte)
		if !ok {
			tmp = &[sz]byte{}
		}
		race.WriteSlice(tmp[:])
		defer encBetterPools[pool].Put(tmp)

		return encodeSnappyBetterBlockAsm64K(dst, src, tmp)
	}
	if len(src) >= limit10B {
		const sz, pool = 81920, 0
		tmp, ok := encBetterPools[pool].Get().(*[sz]byte)
		if !ok {
			tmp = &[sz]byte{}
		}
		race.WriteSlice(tmp[:])
		defer encBetterPools[pool].Put(tmp)

		return encodeSnappyBetterBlockAsm12B(dst, src, tmp)
	}
	if len(src) >= limit8B {
		const sz, pool = 20480, 1
		tmp, ok := encBetterPools[pool].Get().(*[sz]byte)
		if !ok {
			tmp = &[sz]byte{}
		}
		race.WriteSlice(tmp[:])
		defer encBetterPools[pool].Put(tmp)
		return encodeSnappyBetterBlockAsm10B(dst, src, tmp)
	}
	if len(src) < minNonLiteralBlockSize {
		return 0
	}

	const sz, pool = 5120, 2
	tmp, ok := encBetterPools[pool].Get().(*[sz]byte)
	if !ok {
		tmp = &[sz]byte{}
	}
	race.WriteSlice(tmp[:])
	defer encBetterPools[pool].Put(tmp)
	return encodeSnappyBetterBlockAsm8B(dst, src, tmp)
}
