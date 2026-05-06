package metro

import "encoding/binary"

func Hash64(buffer []byte, seed uint64) uint64 {

	const (
		k0 = 0xD6D018F5
		k1 = 0xA2AA033B
		k2 = 0x62992FC1
		k3 = 0x30BC5B29
	)

	ptr := buffer

	hash := (seed + k2) * k0

	if len(ptr) >= 32 {
		v := [4]uint64{hash, hash, hash, hash}

		for len(ptr) >= 32 {
			v[0] += binary.LittleEndian.Uint64(ptr[:8]) * k0
			v[0] = rotate_right(v[0], 29) + v[2]
			v[1] += binary.LittleEndian.Uint64(ptr[8:16]) * k1
			v[1] = rotate_right(v[1], 29) + v[3]
			v[2] += binary.LittleEndian.Uint64(ptr[16:24]) * k2
			v[2] = rotate_right(v[2], 29) + v[0]
			v[3] += binary.LittleEndian.Uint64(ptr[24:32]) * k3
			v[3] = rotate_right(v[3], 29) + v[1]
			ptr = ptr[32:]
		}

		v[2] ^= rotate_right(((v[0]+v[3])*k0)+v[1], 37) * k1
		v[3] ^= rotate_right(((v[1]+v[2])*k1)+v[0], 37) * k0
		v[0] ^= rotate_right(((v[0]+v[2])*k0)+v[3], 37) * k1
		v[1] ^= rotate_right(((v[1]+v[3])*k1)+v[2], 37) * k0
		hash += v[0] ^ v[1]
	}

	if len(ptr) >= 16 {
		v0 := hash + (binary.LittleEndian.Uint64(ptr[:8]) * k2)
		v0 = rotate_right(v0, 29) * k3
		v1 := hash + (binary.LittleEndian.Uint64(ptr[8:16]) * k2)
		v1 = rotate_right(v1, 29) * k3
		v0 ^= rotate_right(v0*k0, 21) + v1
		v1 ^= rotate_right(v1*k3, 21) + v0
		hash += v1
		ptr = ptr[16:]
	}

	if len(ptr) >= 8 {
		hash += binary.LittleEndian.Uint64(ptr[:8]) * k3
		ptr = ptr[8:]
		hash ^= rotate_right(hash, 55) * k1
	}

	if len(ptr) >= 4 {
		hash += uint64(binary.LittleEndian.Uint32(ptr[:4])) * k3
		hash ^= rotate_right(hash, 26) * k1
		ptr = ptr[4:]
	}

	if len(ptr) >= 2 {
		hash += uint64(binary.LittleEndian.Uint16(ptr[:2])) * k3
		ptr = ptr[2:]
		hash ^= rotate_right(hash, 48) * k1
	}

	if len(ptr) >= 1 {
		hash += uint64(ptr[0]) * k3
		hash ^= rotate_right(hash, 37) * k1
	}

	hash ^= rotate_right(hash, 28)
	hash *= k0
	hash ^= rotate_right(hash, 29)

	return hash
}

func Hash64Str(buffer string, seed uint64) uint64 {
	return Hash64([]byte(buffer), seed)
}

func rotate_right(v uint64, k uint) uint64 {
	return (v >> k) | (v << (64 - k))
}
