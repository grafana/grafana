package fpconv

import (
	"math"
)

var (
	fracmask  uint64 = 0x000FFFFFFFFFFFFF
	expmask   uint64 = 0x7FF0000000000000
	hiddenbit uint64 = 0x0010000000000000
	signmask  uint64 = 0x8000000000000000
	expbias   int64  = 1023 + 52
	zeros            = []rune("0000000000000000000000")

	tens = []uint64{
		10000000000000000000,
		1000000000000000000,
		100000000000000000,
		10000000000000000,
		1000000000000000,
		100000000000000,
		10000000000000,
		1000000000000,
		100000000000,
		10000000000,
		1000000000,
		100000000,
		10000000,
		1000000,
		100000,
		10000,
		1000,
		100,
		10,
		1}
)

func absv(n int) int {
	if n < 0 {
		return -n
	}
	return n
}

func minv(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func Dtoa(d float64) string {
	var (
		dest   [25]rune // Note C has 24, which is broken
		digits [18]rune

		str_len int = 0
		neg         = false
	)

	if get_dbits(d)&signmask != 0 {
		dest[0] = '-'
		str_len++
		neg = true
	}

	if spec := filter_special(d, dest[str_len:]); spec != 0 {
		return string(dest[:str_len+spec])
	}

	var (
		k       int = 0
		ndigits int = grisu2(d, &digits, &k)
	)

	str_len += emit_digits(&digits, ndigits, dest[str_len:], k, neg)
	return string(dest[:str_len])
}

func filter_special(fp float64, dest []rune) int {
	if fp == 0.0 {
		dest[0] = '0'
		return 1
	}

	if math.IsNaN(fp) {
		dest[0] = 'n'
		dest[1] = 'a'
		dest[2] = 'n'
		return 3
	}
	if math.IsInf(fp, 0) {
		dest[0] = 'i'
		dest[1] = 'n'
		dest[2] = 'f'
		return 3
	}
	return 0
}

func grisu2(d float64, digits *[18]rune, K *int) int {
	w := build_fp(d)

	lower, upper := get_normalized_boundaries(w)

	w = normalize(w)

	var k int64
	cp := find_cachedpow10(upper.exp, &k)

	w = multiply(w, cp)
	upper = multiply(upper, cp)
	lower = multiply(lower, cp)

	lower.frac++
	upper.frac--

	*K = int(-k)

	return generate_digits(w, upper, lower, digits[:], K)
}

func emit_digits(digits *[18]rune, ndigits int, dest []rune, K int, neg bool) int {
	exp := int(absv(K + ndigits - 1))

	/* write plain integer */
	if K >= 0 && (exp < (ndigits + 7)) {
		copy(dest, digits[:ndigits])
		copy(dest[ndigits:], zeros[:K])

		return ndigits + K
	}

	/* write decimal w/o scientific notation */
	if K < 0 && (K > -7 || exp < 4) {
		offset := int(ndigits - absv(K))
		/* fp < 1.0 -> write leading zero */
		if offset <= 0 {
			offset = -offset
			dest[0] = '0'
			dest[1] = '.'
			copy(dest[2:], zeros[:offset])
			copy(dest[offset+2:], digits[:ndigits])

			return ndigits + 2 + offset

			/* fp > 1.0 */
		} else {
			copy(dest, digits[:offset])
			dest[offset] = '.'
			copy(dest[offset+1:], digits[offset:offset+ndigits-offset])

			return ndigits + 1
		}
	}
	/* write decimal w/ scientific notation */
	l := 18 // was: 18-neg
	if neg {
		l--
	}
	ndigits = minv(ndigits, l)

	var idx int = 0
	dest[idx] = digits[0]
	idx++

	if ndigits > 1 {
		dest[idx] = '.'
		idx++
		copy(dest[idx:], digits[+1:ndigits-1+1])
		idx += ndigits - 1
	}

	dest[idx] = 'e'
	idx++

	sign := '+'
	if K+ndigits-1 < 0 {
		sign = '-'
	}
	dest[idx] = sign
	idx++

	var cent rune = 0

	if exp > 99 {
		cent = rune(exp / 100)
		dest[idx] = cent + '0'
		idx++
		exp -= int(cent) * 100
	}
	if exp > 9 {
		dec := rune(exp / 10)
		dest[idx] = dec + '0'
		idx++
		exp -= int(dec) * 10
	} else if cent != 0 {
		dest[idx] = '0'
		idx++
	}

	dest[idx] = rune(exp%10) + '0'
	idx++

	return idx
}

func generate_digits(fp, upper, lower Fp, digits []rune, K *int) int {
	var (
		wfrac = uint64(upper.frac - fp.frac)
		delta = uint64(upper.frac - lower.frac)
	)

	one := Fp{
		frac: 1 << -upper.exp,
		exp:  upper.exp,
	}

	part1 := uint64(upper.frac >> -one.exp)
	part2 := uint64(upper.frac & (one.frac - 1))

	var (
		idx   = 0
		kappa = 10
		index = 10
	)
	/* 1000000000 */
	for ; kappa > 0; index++ {
		div := tens[index]
		digit := part1 / div

		if digit != 0 || idx != 0 {
			digits[idx] = rune(digit) + '0'
			idx++
		}

		part1 -= digit * div
		kappa--

		tmp := (part1 << -one.exp) + part2
		if tmp <= delta {
			*K += kappa
			round_digit(digits, idx, delta, tmp, div<<-one.exp, wfrac)

			return idx
		}
	}

	/* 10 */
	index = 18
	for {
		var unit uint64 = tens[index]
		part2 *= 10
		delta *= 10
		kappa--

		digit := part2 >> -one.exp
		if digit != 0 || idx != 0 {
			digits[idx] = rune(digit) + '0'
			idx++
		}

		part2 &= uint64(one.frac) - 1
		if part2 < delta {
			*K += kappa
			round_digit(digits, idx, delta, part2, uint64(one.frac), wfrac*unit)

			return idx
		}

		index--
	}
}

func round_digit(digits []rune,
	ndigits int,
	delta uint64,
	rem uint64,
	kappa uint64,
	frac uint64) {
	for rem < frac && delta-rem >= kappa &&
		(rem+kappa < frac || frac-rem > rem+kappa-frac) {
		digits[ndigits-1]--
		rem += kappa
	}
}
