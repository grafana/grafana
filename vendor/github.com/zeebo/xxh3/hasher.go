package xxh3

import (
	"encoding/binary"
	"hash"
)

// Hasher implements the hash.Hash interface
type Hasher struct {
	acc  [8]u64
	blk  u64
	len  u64
	key  ptr
	buf  [_block + _stripe]byte
	seed u64
}

var (
	_ hash.Hash   = (*Hasher)(nil)
	_ hash.Hash64 = (*Hasher)(nil)
)

// New returns a new Hasher that implements the hash.Hash interface.
func New() *Hasher {
	return new(Hasher)
}

// NewSeed returns a new Hasher that implements the hash.Hash interface.
func NewSeed(seed uint64) *Hasher {
	var h Hasher
	h.Reset()
	h.seed = seed
	h.key = key

	// Only initiate once, not on reset.
	if seed != 0 {
		h.key = ptr(&[secretSize]byte{})
		initSecret(h.key, seed)
	}
	return &h
}

// Reset resets the Hash to its initial state.
func (h *Hasher) Reset() {
	h.acc = [8]u64{
		prime32_3, prime64_1, prime64_2, prime64_3,
		prime64_4, prime32_2, prime64_5, prime32_1,
	}
	h.blk = 0
	h.len = 0
}

// BlockSize returns the hash's underlying block size.
// The Write method will accept any amount of data, but
// it may operate more efficiently if all writes are a
// multiple of the block size.
func (h *Hasher) BlockSize() int { return _stripe }

// Size returns the number of bytes Sum will return.
func (h *Hasher) Size() int { return 8 }

// Sum appends the current hash to b and returns the resulting slice.
// It does not change the underlying hash state.
func (h *Hasher) Sum(b []byte) []byte {
	var tmp [8]byte
	binary.BigEndian.PutUint64(tmp[:], h.Sum64())
	return append(b, tmp[:]...)
}

// Write adds more data to the running hash.
// It never returns an error.
func (h *Hasher) Write(buf []byte) (int, error) {
	h.update(buf)
	return len(buf), nil
}

// WriteString adds more data to the running hash.
// It never returns an error.
func (h *Hasher) WriteString(buf string) (int, error) {
	h.updateString(buf)
	return len(buf), nil
}

func (h *Hasher) update(buf []byte) {
	// relies on the data pointer being the first word in the string header
	h.updateString(*(*string)(ptr(&buf)))
}

func (h *Hasher) updateString(buf string) {
	if h.key == nil {
		h.key = key
		h.Reset()
	}

	// On first write, if more than 1 block, process without copy.
	for h.len == 0 && len(buf) > len(h.buf) {
		if hasAVX2 {
			accumBlockAVX2(&h.acc, *(*ptr)(ptr(&buf)), h.key)
		} else if hasSSE2 {
			accumBlockSSE(&h.acc, *(*ptr)(ptr(&buf)), h.key)
		} else {
			accumBlockScalar(&h.acc, *(*ptr)(ptr(&buf)), h.key)
		}
		buf = buf[_block:]
		h.blk++
	}

	for len(buf) > 0 {
		if h.len < u64(len(h.buf)) {
			n := copy(h.buf[h.len:], buf)
			h.len += u64(n)
			buf = buf[n:]
			continue
		}

		if hasAVX2 {
			accumBlockAVX2(&h.acc, ptr(&h.buf), h.key)
		} else if hasSSE2 {
			accumBlockSSE(&h.acc, ptr(&h.buf), h.key)
		} else {
			accumBlockScalar(&h.acc, ptr(&h.buf), h.key)
		}

		h.blk++
		h.len = _stripe
		copy(h.buf[:_stripe], h.buf[_block:])
	}
}

// Sum64 returns the 64-bit hash of the written data.
func (h *Hasher) Sum64() uint64 {
	if h.key == nil {
		h.key = key
		h.Reset()
	}

	if h.blk == 0 {
		if h.seed == 0 {
			return Hash(h.buf[:h.len])
		}
		return HashSeed(h.buf[:h.len], h.seed)
	}

	l := h.blk*_block + h.len
	acc := l * prime64_1
	accs := h.acc

	if h.len > 0 {
		// We are only ever doing 1 block here, so no avx512.
		if hasAVX2 {
			accumAVX2(&accs, ptr(&h.buf[0]), h.key, h.len)
		} else if hasSSE2 {
			accumSSE(&accs, ptr(&h.buf[0]), h.key, h.len)
		} else {
			accumScalar(&accs, ptr(&h.buf[0]), h.key, h.len)
		}
	}

	if h.seed == 0 {
		acc += mulFold64(accs[0]^key64_011, accs[1]^key64_019)
		acc += mulFold64(accs[2]^key64_027, accs[3]^key64_035)
		acc += mulFold64(accs[4]^key64_043, accs[5]^key64_051)
		acc += mulFold64(accs[6]^key64_059, accs[7]^key64_067)
	} else {
		secret := h.key
		acc += mulFold64(accs[0]^readU64(secret, 11), accs[1]^readU64(secret, 19))
		acc += mulFold64(accs[2]^readU64(secret, 27), accs[3]^readU64(secret, 35))
		acc += mulFold64(accs[4]^readU64(secret, 43), accs[5]^readU64(secret, 51))
		acc += mulFold64(accs[6]^readU64(secret, 59), accs[7]^readU64(secret, 67))
	}

	acc = xxh3Avalanche(acc)

	return acc
}

// Sum128 returns the 128-bit hash of the written data.
func (h *Hasher) Sum128() Uint128 {
	if h.key == nil {
		h.key = key
		h.Reset()
	}

	if h.blk == 0 {
		if h.seed == 0 {
			return Hash128(h.buf[:h.len])
		}
		return Hash128Seed(h.buf[:h.len], h.seed)
	}

	l := h.blk*_block + h.len
	acc := Uint128{Lo: l * prime64_1, Hi: ^(l * prime64_2)}
	accs := h.acc

	if h.len > 0 {
		// We are only ever doing 1 block here, so no avx512.
		if hasAVX2 {
			accumAVX2(&accs, ptr(&h.buf[0]), h.key, h.len)
		} else if hasSSE2 {
			accumSSE(&accs, ptr(&h.buf[0]), h.key, h.len)
		} else {
			accumScalar(&accs, ptr(&h.buf[0]), h.key, h.len)
		}
	}

	if h.seed == 0 {
		acc.Lo += mulFold64(accs[0]^key64_011, accs[1]^key64_019)
		acc.Hi += mulFold64(accs[0]^key64_117, accs[1]^key64_125)

		acc.Lo += mulFold64(accs[2]^key64_027, accs[3]^key64_035)
		acc.Hi += mulFold64(accs[2]^key64_133, accs[3]^key64_141)

		acc.Lo += mulFold64(accs[4]^key64_043, accs[5]^key64_051)
		acc.Hi += mulFold64(accs[4]^key64_149, accs[5]^key64_157)

		acc.Lo += mulFold64(accs[6]^key64_059, accs[7]^key64_067)
		acc.Hi += mulFold64(accs[6]^key64_165, accs[7]^key64_173)
	} else {
		secret := h.key
		const hi_off = 117 - 11

		acc.Lo += mulFold64(accs[0]^readU64(secret, 11), accs[1]^readU64(secret, 19))
		acc.Hi += mulFold64(accs[0]^readU64(secret, 11+hi_off), accs[1]^readU64(secret, 19+hi_off))

		acc.Lo += mulFold64(accs[2]^readU64(secret, 27), accs[3]^readU64(secret, 35))
		acc.Hi += mulFold64(accs[2]^readU64(secret, 27+hi_off), accs[3]^readU64(secret, 35+hi_off))

		acc.Lo += mulFold64(accs[4]^readU64(secret, 43), accs[5]^readU64(secret, 51))
		acc.Hi += mulFold64(accs[4]^readU64(secret, 43+hi_off), accs[5]^readU64(secret, 51+hi_off))

		acc.Lo += mulFold64(accs[6]^readU64(secret, 59), accs[7]^readU64(secret, 67))
		acc.Hi += mulFold64(accs[6]^readU64(secret, 59+hi_off), accs[7]^readU64(secret, 67+hi_off))
	}

	acc.Lo = xxh3Avalanche(acc.Lo)
	acc.Hi = xxh3Avalanche(acc.Hi)

	return acc
}
