package xxh3

// avx512Switch is the size at which the avx512 code is used.
// Bigger blocks benefit more.
const avx512Switch = 1 << 10

func accumScalar(accs *[8]u64, p, secret ptr, l u64) {
	if secret != key {
		accumScalarSeed(accs, p, secret, l)
		return
	}
	for l > _block {
		k := secret

		// accs
		for i := 0; i < 16; i++ {
			dv0 := readU64(p, 8*0)
			dk0 := dv0 ^ readU64(k, 8*0)
			accs[1] += dv0
			accs[0] += (dk0 & 0xffffffff) * (dk0 >> 32)

			dv1 := readU64(p, 8*1)
			dk1 := dv1 ^ readU64(k, 8*1)
			accs[0] += dv1
			accs[1] += (dk1 & 0xffffffff) * (dk1 >> 32)

			dv2 := readU64(p, 8*2)
			dk2 := dv2 ^ readU64(k, 8*2)
			accs[3] += dv2
			accs[2] += (dk2 & 0xffffffff) * (dk2 >> 32)

			dv3 := readU64(p, 8*3)
			dk3 := dv3 ^ readU64(k, 8*3)
			accs[2] += dv3
			accs[3] += (dk3 & 0xffffffff) * (dk3 >> 32)

			dv4 := readU64(p, 8*4)
			dk4 := dv4 ^ readU64(k, 8*4)
			accs[5] += dv4
			accs[4] += (dk4 & 0xffffffff) * (dk4 >> 32)

			dv5 := readU64(p, 8*5)
			dk5 := dv5 ^ readU64(k, 8*5)
			accs[4] += dv5
			accs[5] += (dk5 & 0xffffffff) * (dk5 >> 32)

			dv6 := readU64(p, 8*6)
			dk6 := dv6 ^ readU64(k, 8*6)
			accs[7] += dv6
			accs[6] += (dk6 & 0xffffffff) * (dk6 >> 32)

			dv7 := readU64(p, 8*7)
			dk7 := dv7 ^ readU64(k, 8*7)
			accs[6] += dv7
			accs[7] += (dk7 & 0xffffffff) * (dk7 >> 32)

			l -= _stripe
			if l > 0 {
				p, k = ptr(ui(p)+_stripe), ptr(ui(k)+8)
			}
		}

		// scramble accs
		accs[0] ^= accs[0] >> 47
		accs[0] ^= key64_128
		accs[0] *= prime32_1

		accs[1] ^= accs[1] >> 47
		accs[1] ^= key64_136
		accs[1] *= prime32_1

		accs[2] ^= accs[2] >> 47
		accs[2] ^= key64_144
		accs[2] *= prime32_1

		accs[3] ^= accs[3] >> 47
		accs[3] ^= key64_152
		accs[3] *= prime32_1

		accs[4] ^= accs[4] >> 47
		accs[4] ^= key64_160
		accs[4] *= prime32_1

		accs[5] ^= accs[5] >> 47
		accs[5] ^= key64_168
		accs[5] *= prime32_1

		accs[6] ^= accs[6] >> 47
		accs[6] ^= key64_176
		accs[6] *= prime32_1

		accs[7] ^= accs[7] >> 47
		accs[7] ^= key64_184
		accs[7] *= prime32_1
	}

	if l > 0 {
		t, k := (l-1)/_stripe, secret

		for i := u64(0); i < t; i++ {
			dv0 := readU64(p, 8*0)
			dk0 := dv0 ^ readU64(k, 8*0)
			accs[1] += dv0
			accs[0] += (dk0 & 0xffffffff) * (dk0 >> 32)

			dv1 := readU64(p, 8*1)
			dk1 := dv1 ^ readU64(k, 8*1)
			accs[0] += dv1
			accs[1] += (dk1 & 0xffffffff) * (dk1 >> 32)

			dv2 := readU64(p, 8*2)
			dk2 := dv2 ^ readU64(k, 8*2)
			accs[3] += dv2
			accs[2] += (dk2 & 0xffffffff) * (dk2 >> 32)

			dv3 := readU64(p, 8*3)
			dk3 := dv3 ^ readU64(k, 8*3)
			accs[2] += dv3
			accs[3] += (dk3 & 0xffffffff) * (dk3 >> 32)

			dv4 := readU64(p, 8*4)
			dk4 := dv4 ^ readU64(k, 8*4)
			accs[5] += dv4
			accs[4] += (dk4 & 0xffffffff) * (dk4 >> 32)

			dv5 := readU64(p, 8*5)
			dk5 := dv5 ^ readU64(k, 8*5)
			accs[4] += dv5
			accs[5] += (dk5 & 0xffffffff) * (dk5 >> 32)

			dv6 := readU64(p, 8*6)
			dk6 := dv6 ^ readU64(k, 8*6)
			accs[7] += dv6
			accs[6] += (dk6 & 0xffffffff) * (dk6 >> 32)

			dv7 := readU64(p, 8*7)
			dk7 := dv7 ^ readU64(k, 8*7)
			accs[6] += dv7
			accs[7] += (dk7 & 0xffffffff) * (dk7 >> 32)

			l -= _stripe
			if l > 0 {
				p, k = ptr(ui(p)+_stripe), ptr(ui(k)+8)
			}
		}

		if l > 0 {
			p = ptr(ui(p) - uintptr(_stripe-l))

			dv0 := readU64(p, 8*0)
			dk0 := dv0 ^ key64_121
			accs[1] += dv0
			accs[0] += (dk0 & 0xffffffff) * (dk0 >> 32)

			dv1 := readU64(p, 8*1)
			dk1 := dv1 ^ key64_129
			accs[0] += dv1
			accs[1] += (dk1 & 0xffffffff) * (dk1 >> 32)

			dv2 := readU64(p, 8*2)
			dk2 := dv2 ^ key64_137
			accs[3] += dv2
			accs[2] += (dk2 & 0xffffffff) * (dk2 >> 32)

			dv3 := readU64(p, 8*3)
			dk3 := dv3 ^ key64_145
			accs[2] += dv3
			accs[3] += (dk3 & 0xffffffff) * (dk3 >> 32)

			dv4 := readU64(p, 8*4)
			dk4 := dv4 ^ key64_153
			accs[5] += dv4
			accs[4] += (dk4 & 0xffffffff) * (dk4 >> 32)

			dv5 := readU64(p, 8*5)
			dk5 := dv5 ^ key64_161
			accs[4] += dv5
			accs[5] += (dk5 & 0xffffffff) * (dk5 >> 32)

			dv6 := readU64(p, 8*6)
			dk6 := dv6 ^ key64_169
			accs[7] += dv6
			accs[6] += (dk6 & 0xffffffff) * (dk6 >> 32)

			dv7 := readU64(p, 8*7)
			dk7 := dv7 ^ key64_177
			accs[6] += dv7
			accs[7] += (dk7 & 0xffffffff) * (dk7 >> 32)
		}
	}
}

func accumBlockScalar(accs *[8]u64, p, secret ptr) {
	if secret != key {
		accumBlockScalarSeed(accs, p, secret)
		return
	}
	// accs
	for i := 0; i < 16; i++ {
		dv0 := readU64(p, 8*0)
		dk0 := dv0 ^ readU64(secret, 8*0)
		accs[1] += dv0
		accs[0] += (dk0 & 0xffffffff) * (dk0 >> 32)

		dv1 := readU64(p, 8*1)
		dk1 := dv1 ^ readU64(secret, 8*1)
		accs[0] += dv1
		accs[1] += (dk1 & 0xffffffff) * (dk1 >> 32)

		dv2 := readU64(p, 8*2)
		dk2 := dv2 ^ readU64(secret, 8*2)
		accs[3] += dv2
		accs[2] += (dk2 & 0xffffffff) * (dk2 >> 32)

		dv3 := readU64(p, 8*3)
		dk3 := dv3 ^ readU64(secret, 8*3)
		accs[2] += dv3
		accs[3] += (dk3 & 0xffffffff) * (dk3 >> 32)

		dv4 := readU64(p, 8*4)
		dk4 := dv4 ^ readU64(secret, 8*4)
		accs[5] += dv4
		accs[4] += (dk4 & 0xffffffff) * (dk4 >> 32)

		dv5 := readU64(p, 8*5)
		dk5 := dv5 ^ readU64(secret, 8*5)
		accs[4] += dv5
		accs[5] += (dk5 & 0xffffffff) * (dk5 >> 32)

		dv6 := readU64(p, 8*6)
		dk6 := dv6 ^ readU64(secret, 8*6)
		accs[7] += dv6
		accs[6] += (dk6 & 0xffffffff) * (dk6 >> 32)

		dv7 := readU64(p, 8*7)
		dk7 := dv7 ^ readU64(secret, 8*7)
		accs[6] += dv7
		accs[7] += (dk7 & 0xffffffff) * (dk7 >> 32)

		p, secret = ptr(ui(p)+_stripe), ptr(ui(secret)+8)
	}

	// scramble accs
	accs[0] ^= accs[0] >> 47
	accs[0] ^= key64_128
	accs[0] *= prime32_1

	accs[1] ^= accs[1] >> 47
	accs[1] ^= key64_136
	accs[1] *= prime32_1

	accs[2] ^= accs[2] >> 47
	accs[2] ^= key64_144
	accs[2] *= prime32_1

	accs[3] ^= accs[3] >> 47
	accs[3] ^= key64_152
	accs[3] *= prime32_1

	accs[4] ^= accs[4] >> 47
	accs[4] ^= key64_160
	accs[4] *= prime32_1

	accs[5] ^= accs[5] >> 47
	accs[5] ^= key64_168
	accs[5] *= prime32_1

	accs[6] ^= accs[6] >> 47
	accs[6] ^= key64_176
	accs[6] *= prime32_1

	accs[7] ^= accs[7] >> 47
	accs[7] ^= key64_184
	accs[7] *= prime32_1
}

// accumScalarSeed should be used with custom key.
func accumScalarSeed(accs *[8]u64, p, secret ptr, l u64) {
	for l > _block {
		k := secret

		// accs
		for i := 0; i < 16; i++ {
			dv0 := readU64(p, 8*0)
			dk0 := dv0 ^ readU64(k, 8*0)
			accs[1] += dv0
			accs[0] += (dk0 & 0xffffffff) * (dk0 >> 32)

			dv1 := readU64(p, 8*1)
			dk1 := dv1 ^ readU64(k, 8*1)
			accs[0] += dv1
			accs[1] += (dk1 & 0xffffffff) * (dk1 >> 32)

			dv2 := readU64(p, 8*2)
			dk2 := dv2 ^ readU64(k, 8*2)
			accs[3] += dv2
			accs[2] += (dk2 & 0xffffffff) * (dk2 >> 32)

			dv3 := readU64(p, 8*3)
			dk3 := dv3 ^ readU64(k, 8*3)
			accs[2] += dv3
			accs[3] += (dk3 & 0xffffffff) * (dk3 >> 32)

			dv4 := readU64(p, 8*4)
			dk4 := dv4 ^ readU64(k, 8*4)
			accs[5] += dv4
			accs[4] += (dk4 & 0xffffffff) * (dk4 >> 32)

			dv5 := readU64(p, 8*5)
			dk5 := dv5 ^ readU64(k, 8*5)
			accs[4] += dv5
			accs[5] += (dk5 & 0xffffffff) * (dk5 >> 32)

			dv6 := readU64(p, 8*6)
			dk6 := dv6 ^ readU64(k, 8*6)
			accs[7] += dv6
			accs[6] += (dk6 & 0xffffffff) * (dk6 >> 32)

			dv7 := readU64(p, 8*7)
			dk7 := dv7 ^ readU64(k, 8*7)
			accs[6] += dv7
			accs[7] += (dk7 & 0xffffffff) * (dk7 >> 32)

			l -= _stripe
			if l > 0 {
				p, k = ptr(ui(p)+_stripe), ptr(ui(k)+8)
			}
		}

		// scramble accs
		accs[0] ^= accs[0] >> 47
		accs[0] ^= readU64(secret, 128)
		accs[0] *= prime32_1

		accs[1] ^= accs[1] >> 47
		accs[1] ^= readU64(secret, 136)
		accs[1] *= prime32_1

		accs[2] ^= accs[2] >> 47
		accs[2] ^= readU64(secret, 144)
		accs[2] *= prime32_1

		accs[3] ^= accs[3] >> 47
		accs[3] ^= readU64(secret, 152)
		accs[3] *= prime32_1

		accs[4] ^= accs[4] >> 47
		accs[4] ^= readU64(secret, 160)
		accs[4] *= prime32_1

		accs[5] ^= accs[5] >> 47
		accs[5] ^= readU64(secret, 168)
		accs[5] *= prime32_1

		accs[6] ^= accs[6] >> 47
		accs[6] ^= readU64(secret, 176)
		accs[6] *= prime32_1

		accs[7] ^= accs[7] >> 47
		accs[7] ^= readU64(secret, 184)
		accs[7] *= prime32_1
	}

	if l > 0 {
		t, k := (l-1)/_stripe, secret

		for i := u64(0); i < t; i++ {
			dv0 := readU64(p, 8*0)
			dk0 := dv0 ^ readU64(k, 8*0)
			accs[1] += dv0
			accs[0] += (dk0 & 0xffffffff) * (dk0 >> 32)

			dv1 := readU64(p, 8*1)
			dk1 := dv1 ^ readU64(k, 8*1)
			accs[0] += dv1
			accs[1] += (dk1 & 0xffffffff) * (dk1 >> 32)

			dv2 := readU64(p, 8*2)
			dk2 := dv2 ^ readU64(k, 8*2)
			accs[3] += dv2
			accs[2] += (dk2 & 0xffffffff) * (dk2 >> 32)

			dv3 := readU64(p, 8*3)
			dk3 := dv3 ^ readU64(k, 8*3)
			accs[2] += dv3
			accs[3] += (dk3 & 0xffffffff) * (dk3 >> 32)

			dv4 := readU64(p, 8*4)
			dk4 := dv4 ^ readU64(k, 8*4)
			accs[5] += dv4
			accs[4] += (dk4 & 0xffffffff) * (dk4 >> 32)

			dv5 := readU64(p, 8*5)
			dk5 := dv5 ^ readU64(k, 8*5)
			accs[4] += dv5
			accs[5] += (dk5 & 0xffffffff) * (dk5 >> 32)

			dv6 := readU64(p, 8*6)
			dk6 := dv6 ^ readU64(k, 8*6)
			accs[7] += dv6
			accs[6] += (dk6 & 0xffffffff) * (dk6 >> 32)

			dv7 := readU64(p, 8*7)
			dk7 := dv7 ^ readU64(k, 8*7)
			accs[6] += dv7
			accs[7] += (dk7 & 0xffffffff) * (dk7 >> 32)

			l -= _stripe
			if l > 0 {
				p, k = ptr(ui(p)+_stripe), ptr(ui(k)+8)
			}
		}

		if l > 0 {
			p = ptr(ui(p) - uintptr(_stripe-l))

			dv0 := readU64(p, 8*0)
			dk0 := dv0 ^ readU64(secret, 121)
			accs[1] += dv0
			accs[0] += (dk0 & 0xffffffff) * (dk0 >> 32)

			dv1 := readU64(p, 8*1)
			dk1 := dv1 ^ readU64(secret, 129)
			accs[0] += dv1
			accs[1] += (dk1 & 0xffffffff) * (dk1 >> 32)

			dv2 := readU64(p, 8*2)
			dk2 := dv2 ^ readU64(secret, 137)
			accs[3] += dv2
			accs[2] += (dk2 & 0xffffffff) * (dk2 >> 32)

			dv3 := readU64(p, 8*3)
			dk3 := dv3 ^ readU64(secret, 145)
			accs[2] += dv3
			accs[3] += (dk3 & 0xffffffff) * (dk3 >> 32)

			dv4 := readU64(p, 8*4)
			dk4 := dv4 ^ readU64(secret, 153)
			accs[5] += dv4
			accs[4] += (dk4 & 0xffffffff) * (dk4 >> 32)

			dv5 := readU64(p, 8*5)
			dk5 := dv5 ^ readU64(secret, 161)
			accs[4] += dv5
			accs[5] += (dk5 & 0xffffffff) * (dk5 >> 32)

			dv6 := readU64(p, 8*6)
			dk6 := dv6 ^ readU64(secret, 169)
			accs[7] += dv6
			accs[6] += (dk6 & 0xffffffff) * (dk6 >> 32)

			dv7 := readU64(p, 8*7)
			dk7 := dv7 ^ readU64(secret, 177)
			accs[6] += dv7
			accs[7] += (dk7 & 0xffffffff) * (dk7 >> 32)
		}
	}
}

// accumBlockScalarSeed should be used with custom key.
func accumBlockScalarSeed(accs *[8]u64, p, secret ptr) {
	// accs
	{
		secret := secret
		for i := 0; i < 16; i++ {
			dv0 := readU64(p, 8*0)
			dk0 := dv0 ^ readU64(secret, 8*0)
			accs[1] += dv0
			accs[0] += (dk0 & 0xffffffff) * (dk0 >> 32)

			dv1 := readU64(p, 8*1)
			dk1 := dv1 ^ readU64(secret, 8*1)
			accs[0] += dv1
			accs[1] += (dk1 & 0xffffffff) * (dk1 >> 32)

			dv2 := readU64(p, 8*2)
			dk2 := dv2 ^ readU64(secret, 8*2)
			accs[3] += dv2
			accs[2] += (dk2 & 0xffffffff) * (dk2 >> 32)

			dv3 := readU64(p, 8*3)
			dk3 := dv3 ^ readU64(secret, 8*3)
			accs[2] += dv3
			accs[3] += (dk3 & 0xffffffff) * (dk3 >> 32)

			dv4 := readU64(p, 8*4)
			dk4 := dv4 ^ readU64(secret, 8*4)
			accs[5] += dv4
			accs[4] += (dk4 & 0xffffffff) * (dk4 >> 32)

			dv5 := readU64(p, 8*5)
			dk5 := dv5 ^ readU64(secret, 8*5)
			accs[4] += dv5
			accs[5] += (dk5 & 0xffffffff) * (dk5 >> 32)

			dv6 := readU64(p, 8*6)
			dk6 := dv6 ^ readU64(secret, 8*6)
			accs[7] += dv6
			accs[6] += (dk6 & 0xffffffff) * (dk6 >> 32)

			dv7 := readU64(p, 8*7)
			dk7 := dv7 ^ readU64(secret, 8*7)
			accs[6] += dv7
			accs[7] += (dk7 & 0xffffffff) * (dk7 >> 32)

			p, secret = ptr(ui(p)+_stripe), ptr(ui(secret)+8)
		}
	}

	// scramble accs
	accs[0] ^= accs[0] >> 47
	accs[0] ^= readU64(secret, 128)
	accs[0] *= prime32_1

	accs[1] ^= accs[1] >> 47
	accs[1] ^= readU64(secret, 136)
	accs[1] *= prime32_1

	accs[2] ^= accs[2] >> 47
	accs[2] ^= readU64(secret, 144)
	accs[2] *= prime32_1

	accs[3] ^= accs[3] >> 47
	accs[3] ^= readU64(secret, 152)
	accs[3] *= prime32_1

	accs[4] ^= accs[4] >> 47
	accs[4] ^= readU64(secret, 160)
	accs[4] *= prime32_1

	accs[5] ^= accs[5] >> 47
	accs[5] ^= readU64(secret, 168)
	accs[5] *= prime32_1

	accs[6] ^= accs[6] >> 47
	accs[6] ^= readU64(secret, 176)
	accs[6] *= prime32_1

	accs[7] ^= accs[7] >> 47
	accs[7] ^= readU64(secret, 184)
	accs[7] *= prime32_1
}
