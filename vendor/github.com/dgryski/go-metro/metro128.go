package metro

import "encoding/binary"

func rotate_right(v uint64, k uint) uint64 {
	return (v >> k) | (v << (64 - k))
}

func Hash128(buffer []byte, seed uint64) (uint64, uint64) {

	const (
		k0 = 0xC83A91E1
		k1 = 0x8648DBDB
		k2 = 0x7BDEC03B
		k3 = 0x2F5870A5
	)

	ptr := buffer

	var v [4]uint64

	v[0] = (seed - k0) * k3
	v[1] = (seed + k1) * k2

	if len(ptr) >= 32 {
		v[2] = (seed + k0) * k2
		v[3] = (seed - k1) * k3

		for len(ptr) >= 32 {
			v[0] += binary.LittleEndian.Uint64(ptr) * k0
			ptr = ptr[8:]
			v[0] = rotate_right(v[0], 29) + v[2]
			v[1] += binary.LittleEndian.Uint64(ptr) * k1
			ptr = ptr[8:]
			v[1] = rotate_right(v[1], 29) + v[3]
			v[2] += binary.LittleEndian.Uint64(ptr) * k2
			ptr = ptr[8:]
			v[2] = rotate_right(v[2], 29) + v[0]
			v[3] += binary.LittleEndian.Uint64(ptr) * k3
			ptr = ptr[8:]
			v[3] = rotate_right(v[3], 29) + v[1]
		}

		v[2] ^= rotate_right(((v[0]+v[3])*k0)+v[1], 21) * k1
		v[3] ^= rotate_right(((v[1]+v[2])*k1)+v[0], 21) * k0
		v[0] ^= rotate_right(((v[0]+v[2])*k0)+v[3], 21) * k1
		v[1] ^= rotate_right(((v[1]+v[3])*k1)+v[2], 21) * k0
	}

	if len(ptr) >= 16 {
		v[0] += binary.LittleEndian.Uint64(ptr) * k2
		ptr = ptr[8:]
		v[0] = rotate_right(v[0], 33) * k3
		v[1] += binary.LittleEndian.Uint64(ptr) * k2
		ptr = ptr[8:]
		v[1] = rotate_right(v[1], 33) * k3
		v[0] ^= rotate_right((v[0]*k2)+v[1], 45) * k1
		v[1] ^= rotate_right((v[1]*k3)+v[0], 45) * k0
	}

	if len(ptr) >= 8 {
		v[0] += binary.LittleEndian.Uint64(ptr) * k2
		ptr = ptr[8:]
		v[0] = rotate_right(v[0], 33) * k3
		v[0] ^= rotate_right((v[0]*k2)+v[1], 27) * k1
	}

	if len(ptr) >= 4 {
		v[1] += uint64(binary.LittleEndian.Uint32(ptr)) * k2
		ptr = ptr[4:]
		v[1] = rotate_right(v[1], 33) * k3
		v[1] ^= rotate_right((v[1]*k3)+v[0], 46) * k0
	}

	if len(ptr) >= 2 {
		v[0] += uint64(binary.LittleEndian.Uint16(ptr)) * k2
		ptr = ptr[2:]
		v[0] = rotate_right(v[0], 33) * k3
		v[0] ^= rotate_right((v[0]*k2)+v[1], 22) * k1
	}

	if len(ptr) >= 1 {
		v[1] += uint64(ptr[0]) * k2
		v[1] = rotate_right(v[1], 33) * k3
		v[1] ^= rotate_right((v[1]*k3)+v[0], 58) * k0
	}

	v[0] += rotate_right((v[0]*k0)+v[1], 13)
	v[1] += rotate_right((v[1]*k1)+v[0], 37)
	v[0] += rotate_right((v[0]*k2)+v[1], 13)
	v[1] += rotate_right((v[1]*k3)+v[0], 37)

	return v[0], v[1]
}
