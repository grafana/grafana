package decimal128

import "math/bits"

// Cbrt returns the cube root of d.
func Cbrt(d Decimal) Decimal {
	if d.isSpecial() || d.IsZero() {
		return d
	}

	dSig, dExp := d.decompose()
	dExp -= exponentBias
	l10 := int16(dSig.log10())

	d192 := decomposed192{
		sig: uint192{dSig[0], dSig[1], 0},
		exp: dExp,
	}

	d192x2 := decomposed192{
		sig: d192.sig.lsh(1),
		exp: dExp,
	}

	exp := dExp + l10
	if exp < 0 {
		exp++
	}

	dExp -= exp - exp/3

	res := decomposed192{
		sig: uint192{dSig[0], dSig[1], 0},
		exp: dExp,
	}

	var trunc int8
	for i := 0; i < 7; i++ {
		cub, _ := res.mul(res, int8(0))
		cub, _ = cub.mul(res, int8(0))

		num, _ := cub.add(d192x2, int8(0))
		den, _ := cub.add(cub, int8(0))
		den, _ = den.add(d192, int8(0))
		frc, _ := num.quo(den, int8(0))
		res, trunc = res.mul(frc, trunc)
	}

	neg := d.Signbit()
	sig, exp := DefaultRoundingMode.reduce192(neg, res.sig, res.exp+exponentBias, trunc)

	if exp > maxBiasedExponent {
		return inf(neg)
	}

	return compose(neg, sig, exp)
}

// Exp returns e**d, the base-e exponential of d.
func Exp(d Decimal) Decimal {
	if d.isSpecial() {
		if d.IsNaN() {
			return d
		}

		if d.Signbit() {
			return zero(false)
		}

		return inf(false)
	}

	if d.IsZero() {
		return one(false)
	}

	dSig, dExp := d.decompose()
	dExp -= exponentBias
	l10 := dSig.log10()

	if int(dExp) > 5-l10 {
		if d.Signbit() {
			return zero(false)
		}

		return inf(false)
	}

	res, trunc := decomposed192{
		sig: uint192{dSig[0], dSig[1], 0},
		exp: dExp,
	}.epow(int16(l10), int8(0))

	if res.exp > maxUnbiasedExponent+58 {
		if d.Signbit() {
			return zero(false)
		}

		return inf(false)
	}

	if d.Signbit() {
		res, trunc = res.rcp(trunc)
	}

	sig, exp := DefaultRoundingMode.reduce192(false, res.sig, res.exp+exponentBias, trunc)

	if exp > maxBiasedExponent {
		if d.Signbit() {
			return zero(false)
		}

		return inf(false)
	}

	return compose(false, sig, exp)
}

// Exp10 returns 10**d, the base-10 exponential of d.
func Exp10(d Decimal) Decimal {
	if d.isSpecial() {
		if d.IsNaN() {
			return d
		}

		if d.Signbit() {
			return zero(false)
		}

		return inf(false)
	}

	if d.IsZero() {
		return one(false)
	}

	dSig, dExp := d.decompose()
	dExp -= exponentBias
	l10 := dSig.log10()

	if int(dExp) > 4-l10 {
		if d.Signbit() {
			return zero(false)
		}

		return inf(false)
	}

	var dSigInt uint
	if l10+int(dExp) >= 0 {
		sig := dSig
		exp := dExp
		dSig = uint128{}

		for exp < 0 {
			var rem uint64
			sig, rem = sig.div10()

			dSig = dSig.mul64(10)
			dSig = dSig.add64(rem)
			exp++
		}

		dSigInt = uint(sig[0])

		for exp > 0 {
			dSigInt *= 10
			exp--
		}

		if dSigInt > maxUnbiasedExponent+58 {
			if d.Signbit() {
				return zero(false)
			}

			return inf(false)
		}

		sig = dSig
		dSig = uint128{}
		dExp = 0

		for sig[0]|sig[1] != 0 {
			var rem uint64
			sig, rem = sig.div10()

			dSig = dSig.mul64(10)
			dSig = dSig.add64(rem)
			dExp--
		}
	}

	var res decomposed192
	var trunc int8

	var sigInt uint128
	var expInt int16

	if dSigInt != 0 {
		sigInt = uint128{1, 0}

		for dSigInt > maxUnbiasedExponent {
			sigInt = sigInt.mul64(10)
			dSigInt--
		}

		expInt = int16(dSigInt)
	}

	if dSig[0]|dSig[1] != 0 {
		res, trunc = decomposed192{
			sig: uint192{dSig[0], dSig[1], 0},
			exp: dExp,
		}.mul(ln10, int8(0))

		res, trunc = res.epow(int16(res.sig.log10()), trunc)

		if res.exp > maxUnbiasedExponent+58 {
			if d.Signbit() {
				return zero(false)
			}

			return inf(false)
		}

		if expInt != 0 {
			res.exp += expInt
		}
	} else {
		res = decomposed192{
			sig: uint192{1, 0, 0},
			exp: expInt,
		}
	}

	if res.exp > maxUnbiasedExponent+58 {
		if d.Signbit() {
			return zero(false)
		}

		return inf(false)
	}

	if d.Signbit() {
		res, trunc = res.rcp(trunc)
	}

	sig, exp := DefaultRoundingMode.reduce192(false, res.sig, res.exp+exponentBias, trunc)

	if exp > maxBiasedExponent {
		if d.Signbit() {
			return zero(false)
		}

		return inf(false)
	}

	return compose(false, sig, exp)
}

// Exp2 returns 2**d, the base-2 exponential of d.
func Exp2(d Decimal) Decimal {
	if d.isSpecial() {
		if d.IsNaN() {
			return d
		}

		if d.Signbit() {
			return zero(false)
		}

		return inf(false)
	}

	if d.IsZero() {
		return one(false)
	}

	dSig, dExp := d.decompose()
	dExp -= exponentBias
	l10 := dSig.log10()

	if int(dExp) > 5-l10 {
		if d.Signbit() {
			return zero(false)
		}

		return inf(false)
	}

	var dSigInt uint
	if l10+int(dExp) >= 0 {
		sig := dSig
		exp := dExp
		dSig = uint128{}

		for exp < 0 {
			var rem uint64
			sig, rem = sig.div10()

			dSig = dSig.mul64(10)
			dSig = dSig.add64(rem)
			exp++
		}

		dSigInt = uint(sig[0])

		for exp > 0 {
			dSigInt *= 10
			exp--
		}

		sig = dSig
		dSig = uint128{}
		dExp = 0

		for sig[0]|sig[1] != 0 {
			var rem uint64
			sig, rem = sig.div10()

			dSig = dSig.mul64(10)
			dSig = dSig.add64(rem)
			dExp--
		}
	}

	var res decomposed192
	var trunc int8

	var sigInt uint192
	var expInt int16

	if dSigInt != 0 {
		if dSigInt > exponentBias+maxDigits {
			if d.Signbit() {
				return zero(false)
			}

			return inf(false)
		}

		shift := dSigInt

		if shift < 64 {
			sigInt[0] = 1 << shift
		} else if shift < 128 {
			sigInt[1] = 1 << (shift - 64)
		} else {
			var sigInt256 uint256
			if shift < 192 {
				sigInt256[2] = 1 << (shift - 128)
			} else if shift < 256 {
				sigInt256[3] = 1 << (shift - 192)
			} else {
				sigInt256[3] = 0x8000_0000_0000_0000
				shift -= 255

				for shift > 0 {
					var rem uint64
					sigInt256, rem = sigInt256.div10()
					expInt++

					if rem != 0 {
						trunc = 1
					}

					zeros := uint(bits.LeadingZeros64(sigInt256[3]))
					if shift > zeros {
						sigInt256 = sigInt256.lsh(zeros)
						shift -= zeros
					} else {
						sigInt256 = sigInt256.lsh(shift)
						break
					}
				}
			}

			for sigInt256[3] > 0 {
				var rem uint64
				sigInt256, rem = sigInt256.div1e19()
				expInt += 19

				if rem != 0 {
					trunc = 1
				}
			}

			sigInt = uint192{sigInt256[0], sigInt256[1], sigInt256[2]}
		}
	}

	if dSig[0]|dSig[1] != 0 {
		res, trunc = decomposed192{
			sig: uint192{dSig[0], dSig[1], 0},
			exp: dExp,
		}.mul(ln2, int8(0))

		res, trunc = res.epow(int16(res.sig.log10()), trunc)

		if res.exp > maxUnbiasedExponent+58 {
			if d.Signbit() {
				return zero(false)
			}

			return inf(false)
		}

		if dSigInt != 0 {
			res, trunc = decomposed192{
				sig: sigInt,
				exp: expInt,
			}.mul(res, trunc)
		}
	} else {
		res = decomposed192{
			sig: sigInt,
			exp: expInt,
		}
	}

	if res.exp > maxUnbiasedExponent+maxDigits {
		if d.Signbit() {
			return zero(false)
		}

		return inf(false)
	}

	if d.Signbit() {
		res, trunc = res.rcp(trunc)
	}

	sig, exp := DefaultRoundingMode.reduce192(false, res.sig, res.exp+exponentBias, trunc)

	if exp > maxBiasedExponent {
		if d.Signbit() {
			return zero(false)
		}

		return inf(false)
	}

	return compose(false, sig, exp)
}

// Expm1 returns e**d - 1, the base-e exponential of d minus 1. It is more
// accurate than Exp(d) - 1 when d is near zero.
func Expm1(d Decimal) Decimal {
	if d.isSpecial() {
		if d.IsNaN() {
			return d
		}

		if d.Signbit() {
			return one(true)
		}

		return inf(false)
	}

	if d.IsZero() {
		return zero(false)
	}

	dSig, dExp := d.decompose()
	dExp -= exponentBias
	l10 := dSig.log10()

	if int(dExp) > 5-l10 {
		if d.Signbit() {
			return one(true)
		}

		return inf(false)
	}

	neg, res, trunc := decomposed192{
		sig: uint192{dSig[0], dSig[1], 0},
		exp: dExp,
	}.epowm1(d.Signbit(), int16(l10), int8(0))

	if res.exp > maxUnbiasedExponent+58 {
		if d.Signbit() {
			return one(true)
		}

		return inf(false)
	}

	sig, exp := DefaultRoundingMode.reduce192(neg, res.sig, res.exp+exponentBias, trunc)

	if exp > maxBiasedExponent {
		if d.Signbit() {
			return one(true)
		}

		return inf(false)
	}

	return compose(neg, sig, exp)
}

// Log returns the natural logarithm of d.
func Log(d Decimal) Decimal {
	if d.isSpecial() {
		if d.IsNaN() {
			return d
		}

		if d.Signbit() {
			return nan(payloadOpLog, payloadValNegInfinite, 0)
		}

		return inf(false)
	}

	if d.IsZero() {
		return inf(true)
	}

	if d.Signbit() {
		return nan(payloadOpLog, payloadValNegFinite, 0)
	}

	dSig, dExp := d.decompose()

	neg, res, trunc := decomposed192{
		sig: uint192{dSig[0], dSig[1], 0},
		exp: dExp - exponentBias,
	}.log()

	sig, exp := DefaultRoundingMode.reduce192(neg, res.sig, res.exp+exponentBias, trunc)

	if exp > maxBiasedExponent {
		return inf(neg)
	}

	return compose(neg, sig, exp)
}

// Log10 returns the decimal logarithm of d.
func Log10(d Decimal) Decimal {
	if d.isSpecial() {
		if d.IsNaN() {
			return d
		}

		if d.Signbit() {
			return nan(payloadOpLog10, payloadValNegInfinite, 0)
		}

		return inf(false)
	}

	if d.IsZero() {
		return inf(true)
	}

	if d.Signbit() {
		return nan(payloadOpLog10, payloadValNegFinite, 0)
	}

	dSig, dExp := d.decompose()

	neg, res, trunc := decomposed192{
		sig: uint192{dSig[0], dSig[1], 0},
		exp: dExp - exponentBias,
	}.log()

	res, trunc = res.mul(invLn10, trunc)

	sig, exp := DefaultRoundingMode.reduce192(neg, res.sig, res.exp+exponentBias, trunc)

	if exp > maxBiasedExponent {
		return inf(neg)
	}

	return compose(neg, sig, exp)
}

// Log1p returns the natural logarithm 1 plus d. It is more accurate than
// Log(1 + d) when d is near zero.
func Log1p(d Decimal) Decimal {
	if d.isSpecial() {
		if d.IsNaN() {
			return d
		}

		if d.Signbit() {
			return nan(payloadOpLog1p, payloadValNegInfinite, 0)
		}

		return inf(false)
	}

	if d.IsZero() {
		return zero(d.Signbit())
	}

	dSig, dExp := d.decompose()
	dExp -= exponentBias
	dNeg := d.Signbit()

	if dNeg {
		if dExp > 0 {
			return nan(payloadOpLog1p, payloadValNegFinite, 0)
		}

		if dExp > int16(-len(uint128PowersOf10)) {
			if cmp := dSig.cmp(uint128PowersOf10[-dExp]); cmp == 0 {
				return inf(true)
			} else if cmp > 0 {
				return nan(payloadOpLog1p, payloadValNegFinite, 0)
			}
		}
	}

	l10 := int16(dSig.log10()) + dExp

	if l10 > -10 {
		res := decomposed192{
			sig: uint192{dSig[0], dSig[1], 0},
			exp: dExp,
		}

		if dNeg {
			_, res, _ = res.add1neg(0)
		} else {
			res, _ = res.add1(0)
		}

		neg, res, trunc := res.log()

		sig, exp := DefaultRoundingMode.reduce192(neg, res.sig, res.exp+exponentBias, trunc)

		if exp > maxBiasedExponent {
			return inf(neg)
		}

		return compose(neg, sig, exp)
	}

	neg, res, trunc := decomposed192{
		sig: uint192{dSig[0], dSig[1], 0},
		exp: dExp,
	}.log1p(d.Signbit())

	sig, exp := DefaultRoundingMode.reduce192(neg, res.sig, res.exp+exponentBias, trunc)

	if exp > maxBiasedExponent {
		return inf(neg)
	}

	return compose(neg, sig, exp)
}

// Log2 returns the binary logarithm of d.
func Log2(d Decimal) Decimal {
	if d.isSpecial() {
		if d.IsNaN() {
			return d
		}

		if d.Signbit() {
			return nan(payloadOpLog2, payloadValNegInfinite, 0)
		}

		return inf(false)
	}

	if d.IsZero() {
		return inf(true)
	}

	if d.Signbit() {
		return nan(payloadOpLog2, payloadValNegFinite, 0)
	}

	dSig, dExp := d.decompose()

	neg, res, trunc := decomposed192{
		sig: uint192{dSig[0], dSig[1], 0},
		exp: dExp - exponentBias,
	}.log()

	res, trunc = res.mul(invLn2, trunc)

	sig, exp := DefaultRoundingMode.reduce192(neg, res.sig, res.exp+exponentBias, trunc)

	if exp > maxBiasedExponent {
		return inf(neg)
	}

	return compose(neg, sig, exp)
}

// Sqrt returns the square root of d.
func Sqrt(d Decimal) Decimal {
	if d.isSpecial() {
		if d.IsNaN() {
			return d
		}

		if d.Signbit() {
			return nan(payloadOpSqrt, payloadValNegInfinite, 0)
		}

		return d
	}

	if d.IsZero() {
		return d
	}

	if d.Signbit() {
		return nan(payloadOpSqrt, payloadValNegFinite, 0)
	}

	dSig, dExp := d.decompose()
	l10 := int16(dSig.log10())
	dExp = (dExp - exponentBias) + l10

	var add decomposed192
	var mul decomposed192
	var nrm decomposed192
	if dExp&1 == 0 {
		add = decomposed192{
			sig: uint192{259, 0, 0},
			exp: -3,
		}

		mul = decomposed192{
			sig: uint192{819, 0, 0},
			exp: -3,
		}

		nrm = decomposed192{
			sig: uint192{dSig[0], dSig[1], 0},
			exp: -l10,
		}
	} else {
		add = decomposed192{
			sig: uint192{819, 0, 0},
			exp: -4,
		}

		mul = decomposed192{
			sig: uint192{259, 0, 0},
			exp: -2,
		}

		nrm = decomposed192{
			sig: uint192{dSig[0], dSig[1], 0},
			exp: -l10 - 1,
		}

		dExp++
	}

	res, trunc := nrm.mul(mul, int8(0))
	res, trunc = res.add(add, trunc)

	var tmp decomposed192
	half := decomposed192{
		sig: uint192{5, 0, 0},
		exp: -1,
	}

	for i := 0; i < 8; i++ {
		tmp, trunc = nrm.quo(res, trunc)
		res, trunc = res.add(tmp, trunc)
		res, trunc = half.mul(res, trunc)
	}

	res.exp += dExp / 2
	sig, exp := DefaultRoundingMode.reduce192(false, res.sig, res.exp+exponentBias, trunc)

	if exp > maxBiasedExponent {
		return inf(false)
	}

	return compose(false, sig, exp)
}
