// Package xxh32 implements the very fast XXH hashing algorithm (32 bits version).
// (ported from the reference implementation https://github.com/Cyan4973/xxHash/)
package xxh32

import (
	"encoding/binary"
)

const (
	prime1 uint32 = 2654435761
	prime2 uint32 = 2246822519
	prime3 uint32 = 3266489917
	prime4 uint32 = 668265263
	prime5 uint32 = 374761393

	primeMask   = 0xFFFFFFFF
	prime1plus2 = uint32((uint64(prime1) + uint64(prime2)) & primeMask) // 606290984
	prime1minus = uint32((-int64(prime1)) & primeMask)                  // 1640531535
)

// XXHZero represents an xxhash32 object with seed 0.
type XXHZero struct {
	v        [4]uint32
	totalLen uint64
	buf      [16]byte
	bufused  int
}

// Sum appends the current hash to b and returns the resulting slice.
// It does not change the underlying hash state.
func (xxh XXHZero) Sum(b []byte) []byte {
	h32 := xxh.Sum32()
	return append(b, byte(h32), byte(h32>>8), byte(h32>>16), byte(h32>>24))
}

// Reset resets the Hash to its initial state.
func (xxh *XXHZero) Reset() {
	xxh.v[0] = prime1plus2
	xxh.v[1] = prime2
	xxh.v[2] = 0
	xxh.v[3] = prime1minus
	xxh.totalLen = 0
	xxh.bufused = 0
}

// Size returns the number of bytes returned by Sum().
func (xxh *XXHZero) Size() int {
	return 4
}

// BlockSizeIndex gives the minimum number of bytes accepted by Write().
func (xxh *XXHZero) BlockSize() int {
	return 1
}

// Write adds input bytes to the Hash.
// It never returns an error.
func (xxh *XXHZero) Write(input []byte) (int, error) {
	if xxh.totalLen == 0 {
		xxh.Reset()
	}
	n := len(input)
	m := xxh.bufused

	xxh.totalLen += uint64(n)

	r := len(xxh.buf) - m
	if n < r {
		copy(xxh.buf[m:], input)
		xxh.bufused += len(input)
		return n, nil
	}

	var buf *[16]byte
	if m != 0 {
		// some data left from previous update
		buf = &xxh.buf
		c := copy(buf[m:], input)
		n -= c
		input = input[c:]
	}
	update(&xxh.v, buf, input)
	xxh.bufused = copy(xxh.buf[:], input[n-n%16:])

	return n, nil
}

// Portable version of update. This updates v by processing all of buf
// (if not nil) and all full 16-byte blocks of input.
func updateGo(v *[4]uint32, buf *[16]byte, input []byte) {
	// Causes compiler to work directly from registers instead of stack:
	v1, v2, v3, v4 := v[0], v[1], v[2], v[3]

	if buf != nil {
		v1 = rol13(v1+binary.LittleEndian.Uint32(buf[:])*prime2) * prime1
		v2 = rol13(v2+binary.LittleEndian.Uint32(buf[4:])*prime2) * prime1
		v3 = rol13(v3+binary.LittleEndian.Uint32(buf[8:])*prime2) * prime1
		v4 = rol13(v4+binary.LittleEndian.Uint32(buf[12:])*prime2) * prime1
	}

	for ; len(input) >= 16; input = input[16:] {
		sub := input[:16] //BCE hint for compiler
		v1 = rol13(v1+binary.LittleEndian.Uint32(sub[:])*prime2) * prime1
		v2 = rol13(v2+binary.LittleEndian.Uint32(sub[4:])*prime2) * prime1
		v3 = rol13(v3+binary.LittleEndian.Uint32(sub[8:])*prime2) * prime1
		v4 = rol13(v4+binary.LittleEndian.Uint32(sub[12:])*prime2) * prime1
	}
	v[0], v[1], v[2], v[3] = v1, v2, v3, v4
}

// Sum32 returns the 32 bits Hash value.
func (xxh *XXHZero) Sum32() uint32 {
	h32 := uint32(xxh.totalLen)
	if h32 >= 16 {
		h32 += rol1(xxh.v[0]) + rol7(xxh.v[1]) + rol12(xxh.v[2]) + rol18(xxh.v[3])
	} else {
		h32 += prime5
	}

	p := 0
	n := xxh.bufused
	buf := xxh.buf
	for n := n - 4; p <= n; p += 4 {
		h32 += binary.LittleEndian.Uint32(buf[p:p+4]) * prime3
		h32 = rol17(h32) * prime4
	}
	for ; p < n; p++ {
		h32 += uint32(buf[p]) * prime5
		h32 = rol11(h32) * prime1
	}

	h32 ^= h32 >> 15
	h32 *= prime2
	h32 ^= h32 >> 13
	h32 *= prime3
	h32 ^= h32 >> 16

	return h32
}

// Portable version of ChecksumZero.
func checksumZeroGo(input []byte) uint32 {
	n := len(input)
	h32 := uint32(n)

	if n < 16 {
		h32 += prime5
	} else {
		v1 := prime1plus2
		v2 := prime2
		v3 := uint32(0)
		v4 := prime1minus
		p := 0
		for n := n - 16; p <= n; p += 16 {
			sub := input[p:][:16] //BCE hint for compiler
			v1 = rol13(v1+binary.LittleEndian.Uint32(sub[:])*prime2) * prime1
			v2 = rol13(v2+binary.LittleEndian.Uint32(sub[4:])*prime2) * prime1
			v3 = rol13(v3+binary.LittleEndian.Uint32(sub[8:])*prime2) * prime1
			v4 = rol13(v4+binary.LittleEndian.Uint32(sub[12:])*prime2) * prime1
		}
		input = input[p:]
		n -= p
		h32 += rol1(v1) + rol7(v2) + rol12(v3) + rol18(v4)
	}

	p := 0
	for n := n - 4; p <= n; p += 4 {
		h32 += binary.LittleEndian.Uint32(input[p:p+4]) * prime3
		h32 = rol17(h32) * prime4
	}
	for p < n {
		h32 += uint32(input[p]) * prime5
		h32 = rol11(h32) * prime1
		p++
	}

	h32 ^= h32 >> 15
	h32 *= prime2
	h32 ^= h32 >> 13
	h32 *= prime3
	h32 ^= h32 >> 16

	return h32
}

func rol1(u uint32) uint32 {
	return u<<1 | u>>31
}

func rol7(u uint32) uint32 {
	return u<<7 | u>>25
}

func rol11(u uint32) uint32 {
	return u<<11 | u>>21
}

func rol12(u uint32) uint32 {
	return u<<12 | u>>20
}

func rol13(u uint32) uint32 {
	return u<<13 | u>>19
}

func rol17(u uint32) uint32 {
	return u<<17 | u>>15
}

func rol18(u uint32) uint32 {
	return u<<18 | u>>14
}
