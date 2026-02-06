package xxh3

import "math/bits"

// Hash returns the hash of the byte slice.
func Hash(b []byte) uint64 {
	return hashAny(*(*str)(ptr(&b)))
}

// Hash returns the hash of the string slice.
func HashString(s string) uint64 {
	return hashAny(*(*str)(ptr(&s)))
}

func hashAny(s str) (acc u64) {
	p, l := s.p, s.l

	switch {
	case l <= 16:
		switch {
		case l > 8: // 9-16
			inputlo := readU64(p, 0) ^ (key64_024 ^ key64_032)
			inputhi := readU64(p, ui(l)-8) ^ (key64_040 ^ key64_048)
			folded := mulFold64(inputlo, inputhi)
			return xxh3Avalanche(u64(l) + bits.ReverseBytes64(inputlo) + inputhi + folded)

		case l > 3: // 4-8
			input1 := readU32(p, 0)
			input2 := readU32(p, ui(l)-4)
			input64 := u64(input2) + u64(input1)<<32
			keyed := input64 ^ (key64_008 ^ key64_016)
			return rrmxmx(keyed, u64(l))

		case l == 3: // 3
			c12 := u64(readU16(p, 0))
			c3 := u64(readU8(p, 2))
			acc = c12<<16 + c3 + 3<<8

		case l > 1: // 2
			c12 := u64(readU16(p, 0))
			acc = c12*(1<<24+1)>>8 + 2<<8

		case l == 1: // 1
			c1 := u64(readU8(p, 0))
			acc = c1*(1<<24+1<<16+1) + 1<<8

		default: // 0
			return 0x2d06800538d394c2 // xxh_avalanche(key64_056 ^ key64_064)
		}

		acc ^= u64(key32_000 ^ key32_004)
		return xxhAvalancheSmall(acc)

	case l <= 128:
		acc = u64(l) * prime64_1

		if l > 32 {
			if l > 64 {
				if l > 96 {
					acc += mulFold64(readU64(p, 6*8)^key64_096, readU64(p, 7*8)^key64_104)
					acc += mulFold64(readU64(p, ui(l)-8*8)^key64_112, readU64(p, ui(l)-7*8)^key64_120)
				} // 96
				acc += mulFold64(readU64(p, 4*8)^key64_064, readU64(p, 5*8)^key64_072)
				acc += mulFold64(readU64(p, ui(l)-6*8)^key64_080, readU64(p, ui(l)-5*8)^key64_088)
			} // 64
			acc += mulFold64(readU64(p, 2*8)^key64_032, readU64(p, 3*8)^key64_040)
			acc += mulFold64(readU64(p, ui(l)-4*8)^key64_048, readU64(p, ui(l)-3*8)^key64_056)
		} // 32
		acc += mulFold64(readU64(p, 0*8)^key64_000, readU64(p, 1*8)^key64_008)
		acc += mulFold64(readU64(p, ui(l)-2*8)^key64_016, readU64(p, ui(l)-1*8)^key64_024)

		return xxh3Avalanche(acc)

	case l <= 240:
		acc = u64(l) * prime64_1

		acc += mulFold64(readU64(p, 0*16+0)^key64_000, readU64(p, 0*16+8)^key64_008)
		acc += mulFold64(readU64(p, 1*16+0)^key64_016, readU64(p, 1*16+8)^key64_024)
		acc += mulFold64(readU64(p, 2*16+0)^key64_032, readU64(p, 2*16+8)^key64_040)
		acc += mulFold64(readU64(p, 3*16+0)^key64_048, readU64(p, 3*16+8)^key64_056)
		acc += mulFold64(readU64(p, 4*16+0)^key64_064, readU64(p, 4*16+8)^key64_072)
		acc += mulFold64(readU64(p, 5*16+0)^key64_080, readU64(p, 5*16+8)^key64_088)
		acc += mulFold64(readU64(p, 6*16+0)^key64_096, readU64(p, 6*16+8)^key64_104)
		acc += mulFold64(readU64(p, 7*16+0)^key64_112, readU64(p, 7*16+8)^key64_120)

		// avalanche
		acc = xxh3Avalanche(acc)

		// trailing groups after 128
		top := ui(l) &^ 15
		for i := ui(8 * 16); i < top; i += 16 {
			acc += mulFold64(readU64(p, i+0)^readU64(key, i-125), readU64(p, i+8)^readU64(key, i-117))
		}

		// last 16 bytes
		acc += mulFold64(readU64(p, ui(l)-16)^key64_119, readU64(p, ui(l)-8)^key64_127)

		return xxh3Avalanche(acc)

	default:
		acc = u64(l) * prime64_1

		accs := [8]u64{
			prime32_3, prime64_1, prime64_2, prime64_3,
			prime64_4, prime32_2, prime64_5, prime32_1,
		}

		if hasAVX512 && l >= avx512Switch {
			accumAVX512(&accs, p, key, u64(l))
		} else if hasAVX2 {
			accumAVX2(&accs, p, key, u64(l))
		} else if hasSSE2 {
			accumSSE(&accs, p, key, u64(l))
		} else {
			accumScalar(&accs, p, key, u64(l))
		}

		// merge accs
		acc += mulFold64(accs[0]^key64_011, accs[1]^key64_019)
		acc += mulFold64(accs[2]^key64_027, accs[3]^key64_035)
		acc += mulFold64(accs[4]^key64_043, accs[5]^key64_051)
		acc += mulFold64(accs[6]^key64_059, accs[7]^key64_067)

		return xxh3Avalanche(acc)
	}
}
