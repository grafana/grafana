package decimal128

import (
	"math"
	"math/bits"
)

var (
	uint128PowersOf10 = [...]uint128{
		{0x0000_0000_0000_0001, 0x0000_0000_0000_0000},
		{0x0000_0000_0000_000a, 0x0000_0000_0000_0000},
		{0x0000_0000_0000_0064, 0x0000_0000_0000_0000},
		{0x0000_0000_0000_03e8, 0x0000_0000_0000_0000},
		{0x0000_0000_0000_2710, 0x0000_0000_0000_0000},
		{0x0000_0000_0001_86a0, 0x0000_0000_0000_0000},
		{0x0000_0000_000f_4240, 0x0000_0000_0000_0000},
		{0x0000_0000_0098_9680, 0x0000_0000_0000_0000},
		{0x0000_0000_05f5_e100, 0x0000_0000_0000_0000},
		{0x0000_0000_3b9a_ca00, 0x0000_0000_0000_0000},
		{0x0000_0002_540b_e400, 0x0000_0000_0000_0000},
		{0x0000_0017_4876_e800, 0x0000_0000_0000_0000},
		{0x0000_00e8_d4a5_1000, 0x0000_0000_0000_0000},
		{0x0000_0918_4e72_a000, 0x0000_0000_0000_0000},
		{0x0000_5af3_107a_4000, 0x0000_0000_0000_0000},
		{0x0003_8d7e_a4c6_8000, 0x0000_0000_0000_0000},
		{0x0023_86f2_6fc1_0000, 0x0000_0000_0000_0000},
		{0x0163_4578_5d8a_0000, 0x0000_0000_0000_0000},
		{0x0de0_b6b3_a764_0000, 0x0000_0000_0000_0000},
		{0x8ac7_2304_89e8_0000, 0x0000_0000_0000_0000},
		{0x6bc7_5e2d_6310_0000, 0x0000_0000_0000_0005},
		{0x35c9_adc5_dea0_0000, 0x0000_0000_0000_0036},
		{0x19e0_c9ba_b240_0000, 0x0000_0000_0000_021e},
		{0x02c7_e14a_f680_0000, 0x0000_0000_0000_152d},
		{0x1bce_cced_a100_0000, 0x0000_0000_0000_d3c2},
		{0x1614_0148_4a00_0000, 0x0000_0000_0008_4595},
		{0xdcc8_0cd2_e400_0000, 0x0000_0000_0052_b7d2},
		{0x9fd0_803c_e800_0000, 0x0000_0000_033b_2e3c},
		{0x3e25_0261_1000_0000, 0x0000_0000_204f_ce5e},
		{0x6d72_17ca_a000_0000, 0x0000_0001_431e_0fae},
		{0x4674_edea_4000_0000, 0x0000_000c_9f2c_9cd0},
		{0xc091_4b26_8000_0000, 0x0000_007e_37be_2022},
		{0x85ac_ef81_0000_0000, 0x0000_04ee_2d6d_415b},
		{0x38c1_5b0a_0000_0000, 0x0000_314d_c644_8d93},
		{0x378d_8e64_0000_0000, 0x0001_ed09_bead_87c0},
		{0x2b87_8fe8_0000_0000, 0x0013_4261_72c7_4d82},
		{0xb34b_9f10_0000_0000, 0x00c0_97ce_7bc9_0715},
		{0x00f4_36a0_0000_0000, 0x0785_ee10_d5da_46d9},
		{0x098a_2240_0000_0000, 0x4b3b_4ca8_5a86_c47a},
	}

	uint192PowersOf10 = [...]uint192{
		{0x0000_0000_0000_0001, 0x0000_0000_0000_0000, 0x0000_0000_0000_0000},
		{0x0000_0000_0000_000a, 0x0000_0000_0000_0000, 0x0000_0000_0000_0000},
		{0x0000_0000_0000_0064, 0x0000_0000_0000_0000, 0x0000_0000_0000_0000},
		{0x0000_0000_0000_03e8, 0x0000_0000_0000_0000, 0x0000_0000_0000_0000},
		{0x0000_0000_0000_2710, 0x0000_0000_0000_0000, 0x0000_0000_0000_0000},
		{0x0000_0000_0001_86a0, 0x0000_0000_0000_0000, 0x0000_0000_0000_0000},
		{0x0000_0000_000f_4240, 0x0000_0000_0000_0000, 0x0000_0000_0000_0000},
		{0x0000_0000_0098_9680, 0x0000_0000_0000_0000, 0x0000_0000_0000_0000},
		{0x0000_0000_05f5_e100, 0x0000_0000_0000_0000, 0x0000_0000_0000_0000},
		{0x0000_0000_3b9a_ca00, 0x0000_0000_0000_0000, 0x0000_0000_0000_0000},
		{0x0000_0002_540b_e400, 0x0000_0000_0000_0000, 0x0000_0000_0000_0000},
		{0x0000_0017_4876_e800, 0x0000_0000_0000_0000, 0x0000_0000_0000_0000},
		{0x0000_00e8_d4a5_1000, 0x0000_0000_0000_0000, 0x0000_0000_0000_0000},
		{0x0000_0918_4e72_a000, 0x0000_0000_0000_0000, 0x0000_0000_0000_0000},
		{0x0000_5af3_107a_4000, 0x0000_0000_0000_0000, 0x0000_0000_0000_0000},
		{0x0003_8d7e_a4c6_8000, 0x0000_0000_0000_0000, 0x0000_0000_0000_0000},
		{0x0023_86f2_6fc1_0000, 0x0000_0000_0000_0000, 0x0000_0000_0000_0000},
		{0x0163_4578_5d8a_0000, 0x0000_0000_0000_0000, 0x0000_0000_0000_0000},
		{0x0de0_b6b3_a764_0000, 0x0000_0000_0000_0000, 0x0000_0000_0000_0000},
		{0x8ac7_2304_89e8_0000, 0x0000_0000_0000_0000, 0x0000_0000_0000_0000},
		{0x6bc7_5e2d_6310_0000, 0x0000_0000_0000_0005, 0x0000_0000_0000_0000},
		{0x35c9_adc5_dea0_0000, 0x0000_0000_0000_0036, 0x0000_0000_0000_0000},
		{0x19e0_c9ba_b240_0000, 0x0000_0000_0000_021e, 0x0000_0000_0000_0000},
		{0x02c7_e14a_f680_0000, 0x0000_0000_0000_152d, 0x0000_0000_0000_0000},
		{0x1bce_cced_a100_0000, 0x0000_0000_0000_d3c2, 0x0000_0000_0000_0000},
		{0x1614_0148_4a00_0000, 0x0000_0000_0008_4595, 0x0000_0000_0000_0000},
		{0xdcc8_0cd2_e400_0000, 0x0000_0000_0052_b7d2, 0x0000_0000_0000_0000},
		{0x9fd0_803c_e800_0000, 0x0000_0000_033b_2e3c, 0x0000_0000_0000_0000},
		{0x3e25_0261_1000_0000, 0x0000_0000_204f_ce5e, 0x0000_0000_0000_0000},
		{0x6d72_17ca_a000_0000, 0x0000_0001_431e_0fae, 0x0000_0000_0000_0000},
		{0x4674_edea_4000_0000, 0x0000_000c_9f2c_9cd0, 0x0000_0000_0000_0000},
		{0xc091_4b26_8000_0000, 0x0000_007e_37be_2022, 0x0000_0000_0000_0000},
		{0x85ac_ef81_0000_0000, 0x0000_04ee_2d6d_415b, 0x0000_0000_0000_0000},
		{0x38c1_5b0a_0000_0000, 0x0000_314d_c644_8d93, 0x0000_0000_0000_0000},
		{0x378d_8e64_0000_0000, 0x0001_ed09_bead_87c0, 0x0000_0000_0000_0000},
		{0x2b87_8fe8_0000_0000, 0x0013_4261_72c7_4d82, 0x0000_0000_0000_0000},
		{0xb34b_9f10_0000_0000, 0x00c0_97ce_7bc9_0715, 0x0000_0000_0000_0000},
		{0x00f4_36a0_0000_0000, 0x0785_ee10_d5da_46d9, 0x0000_0000_0000_0000},
		{0x098a_2240_0000_0000, 0x4b3b_4ca8_5a86_c47a, 0x0000_0000_0000_0000},
		{0x5f65_5680_0000_0000, 0xf050_fe93_8943_acc4, 0x0000_0000_0000_0002},
		{0xb9f5_6100_0000_0000, 0x6329_f1c3_5ca4_bfab, 0x0000_0000_0000_001d},
		{0x4395_ca00_0000_0000, 0xdfa3_71a1_9e6f_7cb5, 0x0000_0000_0000_0125},
		{0xa3d9_e400_0000_0000, 0xbc62_7050_305a_df14, 0x0000_0000_0000_0b7a},
		{0x6682_e800_0000_0000, 0x5bd8_6321_e38c_b6ce, 0x0000_0000_0000_72cb},
		{0x011d_1000_0000_0000, 0x9673_df52_e37f_2410, 0x0000_0000_0004_7bf1},
		{0x0b22_a000_0000_0000, 0xe086_b93c_e2f7_68a0, 0x0000_0000_002c_d76f},
		{0x6f5a_4000_0000_0000, 0xc543_3c60_ddaa_1640, 0x0000_0000_01c0_6a5e},
		{0x5986_8000_0000_0000, 0xb4a0_5bc8_a8a4_de84, 0x0000_0000_1184_27b3},
		{0x7f41_0000_0000_0000, 0x0e43_95d6_9670_b12b, 0x0000_0000_af29_8d05},
		{0xf88a_0000_0000_0000, 0x8ea3_da61_e066_ebb2, 0x0000_0006_d79f_8232},
		{0xb564_0000_0000_0000, 0x9266_87d2_c405_34fd, 0x0000_0044_6c3b_15f9},
		{0x15e8_0000_0000_0000, 0xb801_4e3b_a834_11e9, 0x0000_02ac_3a4e_dbbf},
		{0xdb10_0000_0000_0000, 0x300d_0e54_9208_b31a, 0x0000_1aba_4714_957d},
		{0x8ea0_0000_0000_0000, 0xe082_8f4d_b456_ff0c, 0x0001_0b46_c6cd_d6e3},
		{0x9240_0000_0000_0000, 0xc519_9909_0b65_f67d, 0x000a_70c3_c40a_64e6},
		{0xb680_0000_0000_0000, 0xb2ff_fa5a_71fb_a0e7, 0x0068_67a5_a867_f103},
		{0x2100_0000_0000_0000, 0xfdff_c788_73d4_490d, 0x0414_0c78_940f_6a24},
		{0x4a00_0000_0000_0000, 0xebfd_cb54_864a_da83, 0x28c8_7cb5_c89a_2571},
	}
)

type uint128 [2]uint64

func (n uint128) String() string {
	if n[0]|n[1] == 0 {
		return "0"
	}

	var buf [39]byte

	i := 39
	for n[0]|n[1] != 0 {
		var d uint64
		n, d = n.div10()
		i--
		buf[i] = '0' + byte(d)
	}

	return string(buf[i:])
}

func (n uint128) add(o uint128) uint192 {
	r0, carry := bits.Add64(n[0], o[0], 0)
	r1, r2 := bits.Add64(n[1], o[1], carry)

	return uint192{r0, r1, r2}
}

func (n uint128) add64(o uint64) uint128 {
	r0, carry := bits.Add64(n[0], o, 0)
	r1 := n[1] + carry

	return uint128{r0, r1}
}

func (n uint128) cmp(o uint128) int {
	if n[1] == o[1] {
		if n[0] == o[0] {
			return 0
		}

		if n[0] < o[0] {
			return -1
		}

		return 1
	}

	if n[1] < o[1] {
		return -1
	}

	return 1
}

func (n uint128) div(o uint128) (uint128, uint128) {
	if o[1] == 0 {
		var r0, r1, rem uint64
		if n[1] < o[0] {
			r0, rem = bits.Div64(n[1], n[0], o[0])
		} else {
			r1, rem = bits.Div64(0, n[1], o[0])
			r0, rem = bits.Div64(rem, n[0], o[0])
		}

		return uint128{r0, r1}, uint128{rem, 0}
	}

	i := uint(bits.LeadingZeros64(o[1]))
	u := o.lsh(i)
	v := n.rsh(1)
	r0, _ := bits.Div64(v[1], v[0], u[1])
	r0 >>= 63 - i
	if r0 != 0 {
		r0--
	}

	r := uint128{r0, 0}
	rem, _ := n.sub(o.mul64(r0))

	if rem.cmp(o) >= 0 {
		r = r.add64(1)
		rem, _ = rem.sub(o)
	}

	return r, rem
}

func (n uint128) div10() (uint128, uint64) {
	var r0, r1, rem uint64
	if n[1] < 10 {
		r0, rem = bits.Div64(n[1], n[0], 10)
	} else {
		r1, rem = bits.Div64(0, n[1], 10)
		r0, rem = bits.Div64(rem, n[0], 10)
	}

	return uint128{r0, r1}, rem
}

func (n uint128) div100() (uint128, uint64) {
	var r0, r1, rem uint64
	if n[1] < 100 {
		r0, rem = bits.Div64(n[1], n[0], 100)
	} else {
		r1, rem = bits.Div64(0, n[1], 100)
		r0, rem = bits.Div64(rem, n[0], 100)
	}

	return uint128{r0, r1}, rem
}

func (n uint128) div1000() (uint128, uint64) {
	var r0, r1, rem uint64
	if n[1] < 1000 {
		r0, rem = bits.Div64(n[1], n[0], 1000)
	} else {
		r1, rem = bits.Div64(0, n[1], 1000)
		r0, rem = bits.Div64(rem, n[0], 1000)
	}

	return uint128{r0, r1}, rem
}

func (n uint128) div10000() (uint128, uint64) {
	var r0, r1, rem uint64
	if n[1] < 10_000 {
		r0, rem = bits.Div64(n[1], n[0], 10_000)
	} else {
		r1, rem = bits.Div64(0, n[1], 10_000)
		r0, rem = bits.Div64(rem, n[0], 10_000)
	}

	return uint128{r0, r1}, rem
}

func (n uint128) div1e8() (uint128, uint64) {
	var r0, r1, rem uint64
	if n[1] < 100_000_000 {
		r0, rem = bits.Div64(n[1], n[0], 100_000_000)
	} else {
		r1, rem = bits.Div64(0, n[1], 100_000_000)
		r0, rem = bits.Div64(rem, n[0], 100_000_000)
	}

	return uint128{r0, r1}, rem
}

func (n uint128) div1e19() (uint128, uint64) {
	var r0, r1, rem uint64
	if n[1] < 10_000_000_000_000_000_000 {
		r0, rem = bits.Div64(n[1], n[0], 10_000_000_000_000_000_000)
	} else {
		r1, rem = bits.Div64(0, n[1], 10_000_000_000_000_000_000)
		r0, rem = bits.Div64(rem, n[0], 10_000_000_000_000_000_000)
	}

	return uint128{r0, r1}, rem
}

func (n uint128) log10() int {
	var l2 int
	if n[1] != 0 {
		l2 = bits.Len64(n[1]) + 64
	} else if n[0] != 0 {
		l2 = bits.Len64(n[0])
	} else {
		return 0
	}

	l10 := l2 * 1233 >> 12
	if n.cmp(uint128PowersOf10[l10]) < 0 {
		l10--
	}

	return l10
}

func (n uint128) lsh(o uint) uint128 {
	var r0, r1 uint64
	if o > 64 {
		r1 = n[0] << (o - 64)
	} else {
		r0 = n[0] << o
		r1 = n[1]<<o | n[0]>>(64-o)
	}

	return uint128{r0, r1}
}

func (n uint128) mul(o uint128) uint256 {
	s1, r0 := bits.Mul64(n[0], o[0])
	t2, t1 := bits.Mul64(n[1], o[0])
	u2, u1 := bits.Mul64(n[0], o[1])
	v3, v2 := bits.Mul64(n[1], o[1])

	r1, carry := bits.Add64(s1, t1, 0)
	r2, w3 := bits.Add64(t2, u2, carry)
	r1, carry = bits.Add64(r1, u1, 0)
	r2, x3 := bits.Add64(r2, v2, carry)
	r3, _ := bits.Add64(v3, w3, x3)

	return uint256{r0, r1, r2, r3}
}

func (n uint128) mul1e38() uint256 {
	const o0 = 687399551400673280
	const o1 = 5421010862427522170

	s1, r0 := bits.Mul64(n[0], o0)
	t2, t1 := bits.Mul64(n[1], o0)
	u2, u1 := bits.Mul64(n[0], o1)
	v3, v2 := bits.Mul64(n[1], o1)

	r1, carry := bits.Add64(s1, t1, 0)
	r2, w3 := bits.Add64(t2, u2, carry)
	r1, carry = bits.Add64(r1, u1, 0)
	r2, x3 := bits.Add64(r2, v2, carry)
	r3, _ := bits.Add64(v3, w3, x3)

	return uint256{r0, r1, r2, r3}
}

func (n uint128) mul64(o uint64) uint128 {
	r1, r0 := bits.Mul64(n[0], o)
	r1 += n[1] * o

	return uint128{r0, r1}
}

func (n uint128) or64(o uint64) uint128 {
	return uint128{n[0] | o, n[1]}
}

func (n uint128) rsh(o uint) uint128 {
	var r0, r1 uint64
	if o > 64 {
		r0 = n[1] >> (o - 64)
	} else {
		r0 = n[0]>>o | n[1]<<(64-o)
		r1 = n[1] >> o
	}

	return uint128{r0, r1}
}

func (n uint128) sub(o uint128) (uint128, uint) {
	r0, borrow := bits.Sub64(n[0], o[0], 0)
	r1, borrow := bits.Sub64(n[1], o[1], borrow)

	return uint128{r0, r1}, uint(borrow)
}

func (n uint128) sub64(o uint64) uint128 {
	r0, borrow := bits.Sub64(n[0], o, 0)
	r1 := n[1] - borrow

	return uint128{r0, r1}
}

func (n uint128) twos() uint128 {
	r0, carry := bits.Add64(^n[0], 1, 0)
	r1 := ^n[1] + carry

	return uint128{r0, r1}
}

type uint192 [3]uint64

func (n uint192) String() string {
	if n[0]|n[1]|n[2] == 0 {
		return "0"
	}

	var buf [58]byte

	i := 58
	for n[0]|n[1]|n[2] != 0 {
		var d uint64
		n, d = n.div10()
		i--
		buf[i] = '0' + byte(d)
	}

	return string(buf[i:])
}

func (n uint192) add(o uint192) uint256 {
	r0, carry := bits.Add64(n[0], o[0], 0)
	r1, carry := bits.Add64(n[1], o[1], carry)
	r2, r3 := bits.Add64(n[2], o[2], carry)

	return uint256{r0, r1, r2, r3}
}

func (n uint192) add64(o uint64) uint192 {
	r0, carry := bits.Add64(n[0], o, 0)
	r1, carry := bits.Add64(n[1], 0, carry)
	r2 := n[2] + carry

	return uint192{r0, r1, r2}
}

func (n uint192) cmp(o uint192) int {
	if n[2] == o[2] {
		if n[1] == o[1] {
			if n[0] == o[0] {
				return 0
			}

			if n[0] < o[0] {
				return -1
			}

			return 1
		}

		if n[1] < o[1] {
			return -1
		}

		return 1
	}

	if n[2] < o[2] {
		return -1
	}

	return 1
}

func (n uint192) div(o uint192) (uint192, uint192) {
	if o[2] == 0 {
		if o[1] == 0 {
			var r0, r1, r2, rem uint64
			if n[2] < o[0] {
				r1, rem = bits.Div64(n[2], n[1], o[0])
				r0, rem = bits.Div64(rem, n[0], o[0])
			} else {
				r2, rem = bits.Div64(0, n[2], o[0])
				r1, rem = bits.Div64(rem, n[1], o[0])
				r0, rem = bits.Div64(rem, n[0], o[0])
			}

			return uint192{r0, r1, r2}, uint192{rem, 0, 0}
		}

		i := uint(bits.LeadingZeros64(o[1]))
		u := o.lsh(i)

		if n[2] == 0 {
			v := n.rsh(1)
			r0, _ := bits.Div64(v[1], v[0], u[1])
			r0 >>= 63 - i
			if r0 != 0 {
				r0--
			}

			r := uint192{r0, 0, 0}
			rem, _ := n.sub(o.mul64(r0))

			if rem.cmp(o) >= 0 {
				r = r.add64(1)
				rem, _ = rem.sub(o)
			}

			return r, rem
		}

		if n[2] < o[1] {
			v := n.lsh(i)
			r0, ur := bits.Div64(v[2], v[1], u[1])

			p1, p0 := bits.Mul64(r0, u[0])
			if p1 > ur || (p1 == ur && p0 > v[0]) {
				r0--
				ur, carry := bits.Add64(ur, u[1], 0)

				if carry == 0 {
					p1, p0 = bits.Mul64(r0, u[0])
					if p1 > ur || (p1 == ur && p0 > v[0]) {
						r0--
					}
				}
			}

			r := uint192{r0, 0, 0}

			q := o.mul(r)
			rem, _ := n.sub(uint192{q[0], q[1], q[2]})

			if rem.cmp(o) >= 0 {
				rem, _ = rem.sub(o)
				r = r.add64(1)
			}

			return r, rem
		}

		v := uint256{n[0], n[1], n[2], 0}.lsh(i)
		r1, ur := bits.Div64(v[3], v[2], u[1])

		p1, p0 := bits.Mul64(r1, u[0])
		if p1 > ur || (p1 == ur && p0 > v[1]) {
			ur, carry := bits.Add64(ur, u[1], 0)
			r1--

			if carry == 0 {
				p1, p0 = bits.Mul64(r1, u[0])
				if p1 > ur || (p1 == ur && p0 > v[1]) {
					r1--
				}
			}
		}

		q192 := u.mul64(r1)
		rem, _ := uint192{v[1], v[2], v[3]}.sub(q192)

		if rem.cmp(u) >= 0 {
			rem, _ = rem.sub(u)
			r1++
		}

		var r0 uint64
		if rem[1] == u[1] {
			r0, ur = math.MaxUint64, rem[0]
		} else {
			r0, ur = bits.Div64(rem[1], rem[0], u[1])
		}

		p1, p0 = bits.Mul64(r0, u[0])
		if p1 > ur || (p1 == ur && p0 > v[0]) {
			var carry uint64
			ur, carry = bits.Add64(ur, u[1], 0)
			r0--

			if carry == 0 {
				p1, p0 = bits.Mul64(r0, u[0])
				if p1 > ur || (p1 == ur && p0 > v[0]) {
					r0--
				}
			}
		}

		r := uint192{r0, r1, 0}

		q := o.mul(r)
		rem, _ = n.sub(uint192{q[0], q[1], q[2]})

		if rem.cmp(o) >= 0 {
			rem, _ = rem.sub(o)
			r = r.add64(1)
		}

		return r, rem
	}

	i := uint(bits.LeadingZeros64(o[2]))
	u := o.lsh(i)
	v := n.rsh(1)
	r0, ur := bits.Div64(v[2], v[1], u[2])

	p1, p0 := bits.Mul64(r0, u[1])
	if p1 > ur || (p1 == ur && p0 > v[0]) {
		r0--
	}

	r0 >>= 63 - i
	if r0 != 0 {
		r0--
	}

	r := uint192{r0, 0, 0}

	q := o.mul(r)
	rem, _ := n.sub(uint192{q[0], q[1], q[2]})

	if rem.cmp(o) >= 0 {
		rem, _ = rem.sub(o)
		r = r.add64(1)
	}

	return r, rem
}

func (n uint192) div10() (uint192, uint64) {
	var r1, r2, rem uint64
	if n[2] < 10 {
		r1, rem = bits.Div64(n[2], n[1], 10)
	} else {
		r2, rem = bits.Div64(0, n[2], 10)
		r1, rem = bits.Div64(rem, n[1], 10)
	}

	r0, rem := bits.Div64(rem, n[0], 10)

	return uint192{r0, r1, r2}, rem
}

func (n uint192) div10000() (uint192, uint64) {
	var r1, r2, rem uint64
	if n[2] < 10000 {
		r1, rem = bits.Div64(n[2], n[1], 10000)
	} else {
		r2, rem = bits.Div64(0, n[2], 10000)
		r1, rem = bits.Div64(rem, n[1], 10000)
	}

	r0, rem := bits.Div64(rem, n[0], 10000)

	return uint192{r0, r1, r2}, rem
}

func (n uint192) div1e8() (uint192, uint64) {
	var r1, r2, rem uint64
	if n[2] < 100_000_000 {
		r1, rem = bits.Div64(n[2], n[1], 100_000_000)
	} else {
		r2, rem = bits.Div64(0, n[2], 100_000_000)
		r1, rem = bits.Div64(rem, n[1], 100_000_000)
	}

	r0, rem := bits.Div64(rem, n[0], 100_000_000)

	return uint192{r0, r1, r2}, rem
}

func (n uint192) div1e19() (uint192, uint64) {
	var r1, r2, rem uint64
	if n[2] < 10_000_000_000_000_000_000 {
		r1, rem = bits.Div64(n[2], n[1], 10_000_000_000_000_000_000)
	} else {
		r2, rem = bits.Div64(0, n[2], 10_000_000_000_000_000_000)
		r1, rem = bits.Div64(rem, n[1], 10_000_000_000_000_000_000)
	}

	r0, rem := bits.Div64(rem, n[0], 10_000_000_000_000_000_000)

	return uint192{r0, r1, r2}, rem
}

func (n uint192) log10() int {
	var l2 int
	if n[2] != 0 {
		l2 = bits.Len64(n[2]) + 128
	} else if n[1] != 0 {
		l2 = bits.Len64(n[1]) + 64
	} else if n[0] != 0 {
		l2 = bits.Len64(n[0])
	} else {
		return 0
	}

	l10 := l2 * 1233 >> 12
	if n.cmp(uint192PowersOf10[l10]) < 0 {
		l10--
	}

	return l10
}

func (n uint192) lsh(o uint) uint192 {
	var r0, r1, r2 uint64
	if o > 128 {
		r2 = n[0] << (o - 128)
	} else if o > 64 {
		r1 = n[0] << (o - 64)
		r2 = n[1]<<(o-64) | n[0]>>(128-o)
	} else {
		r0 = n[0] << o
		r1 = n[1]<<o | n[0]>>(64-o)
		r2 = n[2]<<o | n[1]>>(64-o)
	}

	return uint192{r0, r1, r2}
}

func (n uint192) mul(o uint192) uint384 {
	s1, r0 := bits.Mul64(n[0], o[0])
	t2, t1 := bits.Mul64(n[1], o[0])
	s3, s2 := bits.Mul64(n[2], o[0])
	u2, u1 := bits.Mul64(n[0], o[1])
	v3, v2 := bits.Mul64(n[1], o[1])
	u4, u3 := bits.Mul64(n[2], o[1])
	w3, w2 := bits.Mul64(n[0], o[2])
	x4, x3 := bits.Mul64(n[1], o[2])
	w5, w4 := bits.Mul64(n[2], o[2])

	r1, carry := bits.Add64(s1, t1, 0)
	r2, a3 := bits.Add64(s2, t2, carry)
	r1, carry = bits.Add64(r1, u1, 0)
	r2, b3 := bits.Add64(r2, u2, carry)
	r2, carry = bits.Add64(r2, v2, 0)
	r3, a4 := bits.Add64(s3, u3, a3)
	r3, b4 := bits.Add64(r3, v3, b3)
	r3, c4 := bits.Add64(r3, w3, carry)
	r2, carry = bits.Add64(r2, w2, 0)
	r3, carry = bits.Add64(r3, x3, carry)
	r4, a5 := bits.Add64(u4, w4, a4)
	r4, b5 := bits.Add64(r4, x4, b4)
	r4, carry = bits.Add64(r4, c4+carry, 0)
	r5, _ := bits.Add64(w5, a5+b5+carry, 0)

	return uint384{r0, r1, r2, r3, r4, r5}
}

func (n uint192) mul64(o uint64) uint192 {
	s1, r0 := bits.Mul64(n[0], o)
	t2, t1 := bits.Mul64(n[1], o)
	u2 := n[2] * o

	r1, carry := bits.Add64(s1, t1, 0)
	r2, _ := bits.Add64(t2, u2, carry)

	return uint192{r0, r1, r2}
}

func (n uint192) msd2() int {
	for n[2] >= 10 {
		n, _ = n.div1e19()
	}

	if n[2] != 0 {
		n, _ = n.div10()
	}

	n128 := uint128{n[0], n[1]}

	for n128[1] >= 10 {
		n128, _ = n128.div1e19()
	}

	if n128[1] != 0 {
		n128, _ = n128.div10()
	}

	n64 := n128[0]

	for n64 >= 10000 {
		n64 /= 1000
	}

	for n64 >= 100 {
		n64 /= 10
	}

	return int(n64)
}

func (n uint192) pow2() uint384 {
	s1, r0 := bits.Mul64(n[0], n[0])
	t2, t1 := bits.Mul64(n[1], n[0])
	s3, s2 := bits.Mul64(n[2], n[0])
	u2, u1 := bits.Mul64(n[0], n[1])
	v3, v2 := bits.Mul64(n[1], n[1])
	u4, u3 := bits.Mul64(n[2], n[1])
	w3, w2 := bits.Mul64(n[0], n[2])
	x4, x3 := bits.Mul64(n[1], n[2])
	w5, w4 := bits.Mul64(n[2], n[2])

	r1, carry := bits.Add64(s1, t1, 0)
	r2, a3 := bits.Add64(s2, t2, carry)
	r1, carry = bits.Add64(r1, u1, 0)
	r2, b3 := bits.Add64(r2, u2, carry)
	r2, carry = bits.Add64(r2, v2, 0)
	r3, a4 := bits.Add64(s3, u3, a3)
	r3, b4 := bits.Add64(r3, v3, b3)
	r3, c4 := bits.Add64(r3, w3, carry)
	r2, carry = bits.Add64(r2, w2, 0)
	r3, carry = bits.Add64(r3, x3, carry)
	r4, a5 := bits.Add64(u4, w4, a4)
	r4, b5 := bits.Add64(r4, x4, b4)
	r4, carry = bits.Add64(r4, c4+carry, 0)
	r5, _ := bits.Add64(w5, a5+b5+carry, 0)

	return uint384{r0, r1, r2, r3, r4, r5}
}

func (n uint192) rsh(o uint) uint192 {
	var r0, r1, r2 uint64
	if o > 128 {
		r0 = n[2] >> (o - 128)
	} else if o > 64 {
		r0 = n[1]>>(o-64) | n[2]<<(128-o)
		r1 = n[2] >> (o - 64)
	} else {
		r0 = n[0]>>o | n[1]<<(64-o)
		r1 = n[1]>>o | n[2]<<(64-o)
		r2 = n[2] >> o
	}

	return uint192{r0, r1, r2}
}

func (n uint192) sub(o uint192) (uint192, uint) {
	r0, borrow := bits.Sub64(n[0], o[0], 0)
	r1, borrow := bits.Sub64(n[1], o[1], borrow)
	r2, borrow := bits.Sub64(n[2], o[2], borrow)

	return uint192{r0, r1, r2}, uint(borrow)
}

func (n uint192) sub64(o uint64) uint192 {
	r0, borrow := bits.Sub64(n[0], o, 0)
	r1, borrow := bits.Sub64(n[1], 0, borrow)
	r2 := n[2] - borrow

	return uint192{r0, r1, r2}
}

func (n uint192) twos() uint192 {
	r0, carry := bits.Add64(^n[0], 1, 0)
	r1, carry := bits.Add64(^n[1], 0, carry)
	r2 := ^n[2] + carry

	return uint192{r0, r1, r2}
}

type uint256 [4]uint64

func (n uint256) String() string {
	if n[0]|n[1]|n[2]|n[3] == 0 {
		return "0"
	}

	var buf [78]byte

	i := 78
	for n[0]|n[1]|n[2]|n[3] != 0 {
		var d uint64
		n, d = n.div10()
		i--
		buf[i] = '0' + byte(d)
	}

	return string(buf[i:])
}

func (n uint256) div10() (uint256, uint64) {
	var r2, r3, rem uint64
	if n[3] < 10 {
		r2, rem = bits.Div64(n[3], n[2], 10)
	} else {
		r3, rem = bits.Div64(0, n[3], 10)
		r2, rem = bits.Div64(rem, n[2], 10)
	}

	r1, rem := bits.Div64(rem, n[1], 10)
	r0, rem := bits.Div64(rem, n[0], 10)

	return uint256{r0, r1, r2, r3}, rem
}

func (n uint256) div10000() (uint256, uint64) {
	var r2, r3, rem uint64
	if n[3] < 10_000 {
		r2, rem = bits.Div64(n[3], n[2], 10_000)
	} else {
		r3, rem = bits.Div64(0, n[3], 10_000)
		r2, rem = bits.Div64(rem, n[2], 10_000)
	}

	r1, rem := bits.Div64(rem, n[1], 10_000)
	r0, rem := bits.Div64(rem, n[0], 10_000)

	return uint256{r0, r1, r2, r3}, rem
}

func (n uint256) div1e8() (uint256, uint64) {
	var r2, r3, rem uint64
	if n[3] < 100_000_000 {
		r2, rem = bits.Div64(n[3], n[2], 100_000_000)
	} else {
		r3, rem = bits.Div64(0, n[3], 100_000_000)
		r2, rem = bits.Div64(rem, n[2], 100_000_000)
	}

	r1, rem := bits.Div64(rem, n[1], 100_000_000)
	r0, rem := bits.Div64(rem, n[0], 100_000_000)

	return uint256{r0, r1, r2, r3}, rem
}

func (n uint256) div1e19() (uint256, uint64) {
	var r2, r3, rem uint64
	if n[3] < 10_000_000_000_000_000_000 {
		r2, rem = bits.Div64(n[3], n[2], 10_000_000_000_000_000_000)
	} else {
		r3, rem = bits.Div64(0, n[3], 10_000_000_000_000_000_000)
		r2, rem = bits.Div64(rem, n[2], 10_000_000_000_000_000_000)
	}

	r1, rem := bits.Div64(rem, n[1], 10_000_000_000_000_000_000)
	r0, rem := bits.Div64(rem, n[0], 10_000_000_000_000_000_000)

	return uint256{r0, r1, r2, r3}, rem
}

func (n uint256) lsh(o uint) uint256 {
	var r0, r1, r2, r3 uint64
	if o > 192 {
		r3 = n[0] << (o - 192)
	} else if o > 128 {
		r2 = n[0] << (o - 128)
		r3 = n[1]<<(o-128) | n[0]>>(192-o)
	} else if o > 64 {
		r1 = n[0] << (o - 64)
		r2 = n[1]<<(o-64) | n[0]>>(128-o)
		r3 = n[2]<<(o-64) | n[1]>>(128-o)
	} else {
		r0 = n[0] << o
		r1 = n[1]<<o | n[0]>>(64-o)
		r2 = n[2]<<o | n[1]>>(64-o)
		r3 = n[3]<<o | n[2]>>(64-o)
	}

	return uint256{r0, r1, r2, r3}
}

func (n uint256) mul64(o uint64) uint256 {
	s1, r0 := bits.Mul64(n[0], o)
	t2, t1 := bits.Mul64(n[1], o)
	u3, u2 := bits.Mul64(n[2], o)
	v3 := n[3] * o

	r1, carry := bits.Add64(s1, t1, 0)
	r2, carry := bits.Add64(t2, u2, carry)
	r3, _ := bits.Add64(u3, v3, carry)

	return uint256{r0, r1, r2, r3}
}

func (n uint256) rsh(o uint) uint256 {
	var r0, r1, r2, r3 uint64
	if o > 192 {
		r0 = n[3] >> (o - 192)
	} else if o > 128 {
		r0 = n[2]>>(o-128) | n[3]<<(192-o)
		r1 = n[3] >> (o - 128)
	} else if o > 64 {
		r0 = n[1]>>(o-64) | n[2]<<(128-o)
		r1 = n[2]>>(o-64) | n[3]<<(128-o)
		r2 = n[3] >> (o - 64)
	} else {
		r0 = n[0]>>o | n[1]<<(64-o)
		r1 = n[1]>>o | n[2]<<(64-o)
		r2 = n[2]>>o | n[3]<<(64-o)
		r3 = n[3] >> o
	}

	return uint256{r0, r1, r2, r3}
}

type uint384 [6]uint64

func (n uint384) String() string {
	if n[0]|n[1]|n[2]|n[3]|n[4]|n[5] == 0 {
		return "0"
	}

	var buf [116]byte

	i := 116
	for n[0]|n[1]|n[2]|n[3]|n[4]|n[5] != 0 {
		var d uint64
		n, d = n.div10()
		i--
		buf[i] = '0' + byte(d)
	}

	return string(buf[i:])
}

func (n uint384) div10() (uint384, uint64) {
	var r5, r4, rem uint64
	if n[5] < 10 {
		r4, rem = bits.Div64(n[5], n[4], 10)
	} else {
		r5, rem = bits.Div64(0, n[5], 10)
		r4, rem = bits.Div64(rem, n[4], 10)
	}

	r3, rem := bits.Div64(rem, n[3], 10)
	r2, rem := bits.Div64(rem, n[2], 10)
	r1, rem := bits.Div64(rem, n[1], 10)
	r0, rem := bits.Div64(rem, n[0], 10)

	return uint384{r0, r1, r2, r3, r4, r5}, rem
}

func (n uint384) div1e19() (uint384, uint64) {
	var r5, r4, rem uint64
	if n[5] < 10_000_000_000_000_000_000 {
		r4, rem = bits.Div64(n[5], n[4], 10_000_000_000_000_000_000)
	} else {
		r5, rem = bits.Div64(0, n[5], 10_000_000_000_000_000_000)
		r4, rem = bits.Div64(rem, n[4], 10_000_000_000_000_000_000)
	}

	r3, rem := bits.Div64(rem, n[3], 10_000_000_000_000_000_000)
	r2, rem := bits.Div64(rem, n[2], 10_000_000_000_000_000_000)
	r1, rem := bits.Div64(rem, n[1], 10_000_000_000_000_000_000)
	r0, rem := bits.Div64(rem, n[0], 10_000_000_000_000_000_000)

	return uint384{r0, r1, r2, r3, r4, r5}, rem
}
