package xxh3

import (
	"math/bits"
)

// Hash128Seed returns the 128-bit hash of the byte slice.
func Hash128Seed(b []byte, seed uint64) Uint128 {
	return hashAny128Seed(*(*str)(ptr(&b)), seed)
}

// HashString128Seed returns the 128-bit hash of the string slice.
func HashString128Seed(s string, seed uint64) Uint128 {
	return hashAny128Seed(*(*str)(ptr(&s)), seed)
}

func hashAny128Seed(s str, seed uint64) (acc u128) {
	p, l := s.p, s.l

	switch {
	case l <= 16:
		switch {
		case l > 8: // 9-16
			bitflipl := (key64_032 ^ key64_040) - seed
			bitfliph := (key64_048 ^ key64_056) + seed

			input_lo := readU64(p, 0)
			input_hi := readU64(p, ui(l)-8)

			m128_h, m128_l := bits.Mul64(input_lo^input_hi^bitflipl, prime64_1)

			m128_l += uint64(l-1) << 54
			input_hi ^= bitfliph

			m128_h += input_hi + uint64(uint32(input_hi))*(prime32_2-1)

			m128_l ^= bits.ReverseBytes64(m128_h)

			acc.Hi, acc.Lo = bits.Mul64(m128_l, prime64_2)
			acc.Hi += m128_h * prime64_2

			acc.Lo = xxh3Avalanche(acc.Lo)
			acc.Hi = xxh3Avalanche(acc.Hi)

			return acc

		case l > 3: // 4-8
			seed ^= u64(bits.ReverseBytes32(u32(seed))) << 32
			bitflip := (key64_016 ^ key64_024) + seed
			input_lo := readU32(p, 0)
			input_hi := readU32(p, ui(l)-4)
			input_64 := u64(input_lo) + u64(input_hi)<<32
			keyed := input_64 ^ bitflip

			acc.Hi, acc.Lo = bits.Mul64(keyed, prime64_1+(uint64(l)<<2))

			acc.Hi += acc.Lo << 1
			acc.Lo ^= acc.Hi >> 3

			acc.Lo ^= acc.Lo >> 35
			acc.Lo *= 0x9fb21c651e98df25
			acc.Lo ^= acc.Lo >> 28
			acc.Hi = xxh3Avalanche(acc.Hi)

			return acc

		case l == 3: // 3
			c12 := u64(readU16(p, 0))
			c3 := u64(readU8(p, 2))
			acc.Lo = c12<<16 + c3 + 3<<8

		case l > 1: // 2
			c12 := u64(readU16(p, 0))
			acc.Lo = c12*(1<<24+1)>>8 + 2<<8

		case l == 1: // 1
			c1 := u64(readU8(p, 0))
			acc.Lo = c1*(1<<24+1<<16+1) + 1<<8

		default: // 0
			bitflipl := key64_064 ^ key64_072 ^ seed
			bitfliph := key64_080 ^ key64_088 ^ seed
			return u128{Lo: xxh64AvalancheFull(bitflipl), Hi: xxh64AvalancheFull(bitfliph)}
		}

		acc.Hi = uint64(bits.RotateLeft32(bits.ReverseBytes32(uint32(acc.Lo)), 13))
		acc.Lo ^= uint64(key32_000^key32_004) + seed
		acc.Hi ^= uint64(key32_008^key32_012) - seed

		acc.Lo = xxh64AvalancheFull(acc.Lo)
		acc.Hi = xxh64AvalancheFull(acc.Hi)

		return acc

	case l <= 128:
		acc.Lo = u64(l) * prime64_1

		if l > 32 {
			if l > 64 {
				if l > 96 {
					in8, in7 := readU64(p, ui(l)-8*8), readU64(p, ui(l)-7*8)
					i6, i7 := readU64(p, 6*8), readU64(p, 7*8)

					acc.Hi += mulFold64(in8^(key64_112+seed), in7^(key64_120-seed))
					acc.Hi ^= i6 + i7
					acc.Lo += mulFold64(i6^(key64_096+seed), i7^(key64_104-seed))
					acc.Lo ^= in8 + in7

				} // 96

				in6, in5 := readU64(p, ui(l)-6*8), readU64(p, ui(l)-5*8)
				i4, i5 := readU64(p, 4*8), readU64(p, 5*8)

				acc.Hi += mulFold64(in6^(key64_080+seed), in5^(key64_088-seed))
				acc.Hi ^= i4 + i5
				acc.Lo += mulFold64(i4^(key64_064+seed), i5^(key64_072-seed))
				acc.Lo ^= in6 + in5

			} // 64

			in4, in3 := readU64(p, ui(l)-4*8), readU64(p, ui(l)-3*8)
			i2, i3 := readU64(p, 2*8), readU64(p, 3*8)

			acc.Hi += mulFold64(in4^(key64_048+seed), in3^(key64_056-seed))
			acc.Hi ^= i2 + i3
			acc.Lo += mulFold64(i2^(key64_032+seed), i3^(key64_040-seed))
			acc.Lo ^= in4 + in3

		} // 32

		in2, in1 := readU64(p, ui(l)-2*8), readU64(p, ui(l)-1*8)
		i0, i1 := readU64(p, 0*8), readU64(p, 1*8)

		acc.Hi += mulFold64(in2^(key64_016+seed), in1^(key64_024-seed))
		acc.Hi ^= i0 + i1
		acc.Lo += mulFold64(i0^(key64_000+seed), i1^(key64_008-seed))
		acc.Lo ^= in2 + in1

		acc.Hi, acc.Lo = (acc.Lo*prime64_1)+(acc.Hi*prime64_4)+((u64(l)-seed)*prime64_2), acc.Hi+acc.Lo

		acc.Hi = -xxh3Avalanche(acc.Hi)
		acc.Lo = xxh3Avalanche(acc.Lo)

		return acc

	case l <= 240:
		acc.Lo = u64(l) * prime64_1

		{
			i0, i1, i2, i3 := readU64(p, 0*8), readU64(p, 1*8), readU64(p, 2*8), readU64(p, 3*8)

			acc.Hi += mulFold64(i2^(key64_016+seed), i3^(key64_024-seed))
			acc.Hi ^= i0 + i1
			acc.Lo += mulFold64(i0^(key64_000+seed), i1^(key64_008-seed))
			acc.Lo ^= i2 + i3
		}

		{
			i0, i1, i2, i3 := readU64(p, 4*8), readU64(p, 5*8), readU64(p, 6*8), readU64(p, 7*8)

			acc.Hi += mulFold64(i2^(key64_048+seed), i3^(key64_056-seed))
			acc.Hi ^= i0 + i1
			acc.Lo += mulFold64(i0^(key64_032+seed), i1^(key64_040-seed))
			acc.Lo ^= i2 + i3
		}

		{
			i0, i1, i2, i3 := readU64(p, 8*8), readU64(p, 9*8), readU64(p, 10*8), readU64(p, 11*8)

			acc.Hi += mulFold64(i2^(key64_080+seed), i3^(key64_088-seed))
			acc.Hi ^= i0 + i1
			acc.Lo += mulFold64(i0^(key64_064+seed), i1^(key64_072-seed))
			acc.Lo ^= i2 + i3
		}

		{
			i0, i1, i2, i3 := readU64(p, 12*8), readU64(p, 13*8), readU64(p, 14*8), readU64(p, 15*8)

			acc.Hi += mulFold64(i2^(key64_112+seed), i3^(key64_120-seed))
			acc.Hi ^= i0 + i1
			acc.Lo += mulFold64(i0^(key64_096+seed), i1^(key64_104-seed))
			acc.Lo ^= i2 + i3
		}

		// avalanche
		acc.Hi = xxh3Avalanche(acc.Hi)
		acc.Lo = xxh3Avalanche(acc.Lo)

		// trailing groups after 128
		top := ui(l) &^ 31
		for i := ui(4 * 32); i < top; i += 32 {
			i0, i1, i2, i3 := readU64(p, i+0), readU64(p, i+8), readU64(p, i+16), readU64(p, i+24)
			k0, k1, k2, k3 := readU64(key, i-125)+seed, readU64(key, i-117)-seed, readU64(key, i-109)+seed, readU64(key, i-101)-seed

			acc.Hi += mulFold64(i2^k2, i3^k3)
			acc.Hi ^= i0 + i1
			acc.Lo += mulFold64(i0^k0, i1^k1)
			acc.Lo ^= i2 + i3
		}

		// last 32 bytes
		{
			i0, i1, i2, i3 := readU64(p, ui(l)-32), readU64(p, ui(l)-24), readU64(p, ui(l)-16), readU64(p, ui(l)-8)

			seed := 0 - seed
			acc.Hi += mulFold64(i0^(key64_119+seed), i1^(key64_127-seed))
			acc.Hi ^= i2 + i3
			acc.Lo += mulFold64(i2^(key64_103+seed), i3^(key64_111-seed))
			acc.Lo ^= i0 + i1
		}

		acc.Hi, acc.Lo = (acc.Lo*prime64_1)+(acc.Hi*prime64_4)+((u64(l)-seed)*prime64_2), acc.Hi+acc.Lo

		acc.Hi = -xxh3Avalanche(acc.Hi)
		acc.Lo = xxh3Avalanche(acc.Lo)

		return acc

	default:
		acc.Lo = u64(l) * prime64_1
		acc.Hi = ^(u64(l) * prime64_2)

		secret := key
		if seed != 0 {
			secret = ptr(&[secretSize]byte{})
			initSecret(secret, seed)
		}

		accs := [8]u64{
			prime32_3, prime64_1, prime64_2, prime64_3,
			prime64_4, prime32_2, prime64_5, prime32_1,
		}

		if hasAVX512 && l >= avx512Switch {
			accumAVX512(&accs, p, secret, u64(l))
		} else if hasAVX2 {
			accumAVX2(&accs, p, secret, u64(l))
		} else if hasSSE2 {
			accumSSE(&accs, p, secret, u64(l))
		} else {
			accumScalar(&accs, p, secret, u64(l))
		}

		// merge accs
		const hi_off = 117 - 11

		acc.Lo += mulFold64(accs[0]^readU64(secret, 11), accs[1]^readU64(secret, 19))
		acc.Hi += mulFold64(accs[0]^readU64(secret, 11+hi_off), accs[1]^readU64(secret, 19+hi_off))

		acc.Lo += mulFold64(accs[2]^readU64(secret, 27), accs[3]^readU64(secret, 35))
		acc.Hi += mulFold64(accs[2]^readU64(secret, 27+hi_off), accs[3]^readU64(secret, 35+hi_off))

		acc.Lo += mulFold64(accs[4]^readU64(secret, 43), accs[5]^readU64(secret, 51))
		acc.Hi += mulFold64(accs[4]^readU64(secret, 43+hi_off), accs[5]^readU64(secret, 51+hi_off))

		acc.Lo += mulFold64(accs[6]^readU64(secret, 59), accs[7]^readU64(secret, 67))
		acc.Hi += mulFold64(accs[6]^readU64(secret, 59+hi_off), accs[7]^readU64(secret, 67+hi_off))

		acc.Lo = xxh3Avalanche(acc.Lo)
		acc.Hi = xxh3Avalanche(acc.Hi)

		return acc
	}
}
