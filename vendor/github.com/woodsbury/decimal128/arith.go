package decimal128

import "math/bits"

// Add adds d and o, rounded using the [DefaultRoundingMode], and returns the
// result.
func (d Decimal) Add(o Decimal) Decimal {
	return d.AddWithMode(o, DefaultRoundingMode)
}

// AddWithMode adds d and o, rounding using the provided rounding mode, and
// returns the result.
func (d Decimal) AddWithMode(o Decimal, mode RoundingMode) Decimal {
	if d.isSpecial() || o.isSpecial() {
		if d.IsNaN() {
			return d
		}

		if o.IsNaN() {
			return o
		}

		if d.isInf() {
			neg := d.Signbit()

			if o.isInf() && neg != o.Signbit() {
				lhs := payloadValPosInfinite
				rhs := payloadValNegInfinite
				if neg {
					lhs = payloadValNegInfinite
					rhs = payloadValPosInfinite
				}

				return nan(payloadOpAdd, lhs, rhs)
			}

			return inf(neg)
		}

		return inf(o.Signbit())
	}

	return d.add(o, mode, false)
}

// Mul multiplies d and o, rounding using the [DefaultRoundingMode], and
// returns the result.
func (d Decimal) Mul(o Decimal) Decimal {
	return d.MulWithMode(o, DefaultRoundingMode)
}

// MulWithMode multiplies d and o, rounding using the provided rounding mode,
// and returns the result.
func (d Decimal) MulWithMode(o Decimal, mode RoundingMode) Decimal {
	if d.isSpecial() || o.isSpecial() {
		if d.IsNaN() {
			return d
		}

		if o.IsNaN() {
			return o
		}

		if !d.isSpecial() {
			sig, _ := d.decompose()
			if sig[0]|sig[1] == 0 {
				lhs := payloadValPosZero
				if d.Signbit() {
					lhs = payloadValNegZero
				}

				rhs := payloadValPosInfinite
				if o.Signbit() {
					rhs = payloadValNegInfinite
				}

				return nan(payloadOpMul, lhs, rhs)
			}
		} else if !o.isSpecial() {
			sig, _ := o.decompose()
			if sig[0]|sig[1] == 0 {
				lhs := payloadValPosInfinite
				if d.Signbit() {
					lhs = payloadValNegInfinite
				}

				rhs := payloadValPosZero
				if o.Signbit() {
					rhs = payloadValNegZero
				}

				return nan(payloadOpMul, lhs, rhs)
			}
		}

		return inf(d.Signbit() != o.Signbit())
	}

	dSig, dExp := d.decompose()
	oSig, oExp := o.decompose()

	exp := (dExp - exponentBias) + (oExp - exponentBias) + exponentBias
	neg := d.Signbit() != o.Signbit()

	var sig uint128
	if dSig[1]|oSig[1] == 0 {
		sig1, sig0 := bits.Mul64(dSig[0], oSig[0])

		if sig0|sig1 == 0 {
			return zero(neg)
		}

		sig, exp = mode.reduce128(neg, uint128{sig0, sig1}, exp, 0)
	} else {
		sig256 := dSig.mul(oSig)

		if sig256[0]|sig256[1]|sig256[2]|sig256[3] == 0 {
			return zero(neg)
		}

		sig, exp = mode.reduce256(neg, sig256, exp, 0)
	}

	if exp > maxBiasedExponent {
		return inf(neg)
	}

	return compose(neg, sig, exp)
}

// Pow raises d to the power of o, rounding using the [DefaultRoundingMode],
// and returns the result.
func (d Decimal) Pow(o Decimal) Decimal {
	return d.PowWithMode(o, DefaultRoundingMode)
}

// PowWithMode raises d to the power of o, rounding using the provided rounding
// mode, and returns the result.
func (d Decimal) PowWithMode(o Decimal, mode RoundingMode) Decimal {
	if o.IsZero() {
		return one(false)
	}

	if d.isOne() {
		if !d.Signbit() || o.isInf() {
			return one(false)
		}
	}

	if o.isOne() {
		if o.Signbit() {
			return one(false).QuoWithMode(d, mode)
		}

		return d
	}

	if d.IsNaN() {
		return d
	}

	if o.IsNaN() {
		return o
	}

	dNeg := d.Signbit()
	oNeg := o.Signbit()

	if o.isInf() {
		if d.IsZero() {
			if oNeg {
				return inf(false)
			}

			return zero(false)
		}

		if d.isInf() {
			if oNeg {
				return zero(false)
			}

			return inf(false)
		}

		dSig, dExp := d.decompose()
		dExp -= exponentBias

		if dExp > 0 {
			if oNeg {
				return zero(false)
			}

			return inf(false)
		}

		if dExp > -maxDigits {
			l10 := int16(dSig.log10())
			if l10 >= -dExp {
				if oNeg {
					return zero(false)
				}

				return inf(false)
			}
		}

		if oNeg {
			return inf(false)
		}

		return zero(false)
	}

	oSig, oExp := o.decompose()

	for {
		sig, rem := oSig.div10()
		if rem != 0 {
			break
		}

		oSig = sig
		oExp++
	}

	if d.IsZero() {
		neg := false

		if d.Signbit() && oExp == exponentBias {
			_, digit := oSig.div10()
			if digit&1 != 0 {
				neg = true
			}
		}

		if oNeg {
			return inf(neg)
		}

		return zero(neg)
	}

	if d.isInf() {
		if dNeg {
			neg := false

			if oExp == exponentBias {
				_, digit := oSig.div10()
				if digit&1 != 0 {
					neg = true
				}
			}

			if oNeg {
				return zero(neg)
			}

			return inf(neg)
		}

		if oNeg {
			return zero(false)
		}

		return inf(false)
	}

	dSig, dExp := d.decompose()

	for {
		sig, rem := dSig.div10()
		if rem != 0 {
			break
		}

		dSig = sig
		dExp++
	}

	neg := false

	if dNeg {
		if oExp < exponentBias {
			rhs := payloadValPosFinite
			if oNeg {
				rhs = payloadValNegFinite
			}

			return nan(payloadOpPow, payloadValNegFinite, rhs)
		}

		if oExp == exponentBias {
			_, digit := oSig.div10()
			if digit&1 != 0 {
				neg = true
			}
		}
	}

	if !oNeg && oExp >= exponentBias && dSig == (uint128{1, 0}) {
		if oSig[1] != 0 || oSig[0] > maxUnbiasedExponent {
			if dExp == exponentBias {
				return one(neg)
			}

			if dExp < exponentBias {
				return zero(neg)
			}

			return inf(neg)
		}

		var p10 int64
		switch oExp {
		case exponentBias:
			p10 = 1
		case 1 + exponentBias:
			p10 = 10
		case 2 + exponentBias:
			p10 = 100
		case 3 + exponentBias:
			p10 = 1_000
		case 4 + exponentBias:
			p10 = 10_000
		case 5 + exponentBias:
			p10 = 100_000
		case 6 + exponentBias:
			p10 = 1_000_000
		case 7 + exponentBias:
			p10 = 10_000_000
		default:
			if dExp == exponentBias {
				return one(neg)
			}

			if dExp < exponentBias {
				return zero(neg)
			}

			return inf(neg)
		}

		exp64 := int64(dExp-exponentBias)*p10*int64(oSig[0]) + exponentBias

		if exp64 < minBiasedExponent-maxDigits {
			return zero(neg)
		}

		if exp64 > maxBiasedExponent+maxDigits {
			return inf(neg)
		}

		sig, exp := mode.reduce128(dNeg, dSig, int16(exp64), 0)

		if exp > maxBiasedExponent {
			return inf(neg)
		}

		return compose(neg, sig, exp)
	}

	if dExp&1 == 0 && oExp == exponentBias-1 && dSig == (uint128{1, 0}) && oSig == (uint128{5, 0}) {
		exp := (dExp - exponentBias) / 2

		if oNeg {
			exp *= -1
		}

		return compose(neg, dSig, exp+exponentBias)
	}

	inv, res, trunc := decomposed192{
		sig: uint192{dSig[0], dSig[1], 0},
		exp: dExp - exponentBias,
	}.log()

	if res.sig[0]|res.sig[1]|res.sig[2] == 0 {
		return one(neg)
	}

	if int64(res.exp)+int64(oExp) > maxBiasedExponent+maxDigits {
		if oNeg != inv {
			return zero(neg)
		}

		return inf(neg)
	}

	res, trunc = res.mul(decomposed192{
		sig: uint192{oSig[0], oSig[1], 0},
		exp: oExp - exponentBias,
	}, trunc)

	if res.sig[0]|res.sig[1]|res.sig[2] == 0 {
		return one(neg)
	}

	l10 := res.sig.log10()

	if int(res.exp) > 5-l10 {
		if oNeg != inv {
			return zero(neg)
		}

		return inf(neg)
	}

	if res.sig[0]|res.sig[1]|res.sig[2] == 0 {
		return one(neg)
	}

	res, trunc = res.epow(int16(l10), trunc)

	if res.exp > maxUnbiasedExponent+58 {
		if oNeg != inv {
			return zero(neg)
		}

		return inf(neg)
	}

	if oNeg != inv {
		res, trunc = res.rcp(trunc)
		trunc *= -1
	}

	sig, exp := mode.reduce192(neg, res.sig, res.exp+exponentBias, trunc)

	if exp > maxBiasedExponent {
		return inf(neg)
	}

	return compose(neg, sig, exp)
}

// Quo divides d by o, rounding using the [DefaultRoundingMode], and returns
// the result.
func (d Decimal) Quo(o Decimal) Decimal {
	return d.QuoWithMode(o, DefaultRoundingMode)
}

// QuoWithMode divides d by o, rounding using the provided rounding mode, and
// returns the result.
func (d Decimal) QuoWithMode(o Decimal, mode RoundingMode) Decimal {
	if d.isSpecial() || o.isSpecial() {
		if d.IsNaN() {
			return d
		}

		if o.IsNaN() {
			return o
		}

		if d.isInf() {
			if o.isInf() {
				lhs := payloadValPosInfinite
				if d.Signbit() {
					lhs = payloadValNegInfinite
				}

				rhs := payloadValPosInfinite
				if o.Signbit() {
					rhs = payloadValNegInfinite
				}

				return nan(payloadOpQuo, lhs, rhs)
			}

			return inf(d.Signbit() != o.Signbit())
		}

		if o.isInf() {
			return zero(d.Signbit() != o.Signbit())
		}
	}

	dSig, dExp := d.decompose()
	oSig, oExp := o.decompose()

	if oSig[0]|oSig[1] == 0 {
		if dSig[0]|dSig[1] == 0 {
			lhs := payloadValPosZero
			if d.Signbit() {
				lhs = payloadValNegZero
			}

			rhs := payloadValPosZero
			if o.Signbit() {
				rhs = payloadValNegZero
			}

			return nan(payloadOpQuo, lhs, rhs)
		}

		return inf(d.Signbit() != o.Signbit())
	}

	if dSig[0]|dSig[1] == 0 {
		return zero(d.Signbit() != o.Signbit())
	}

	exp := (dExp - exponentBias) - (oExp - exponentBias) + exponentBias

	var sig uint128
	var rem uint128
	if dSig[1]|oSig[1] == 0 {
		dSig64 := dSig[0]

		for dSig64 <= 0x0002_7fff_ffff_ffff {
			dSig64 *= 10_000
			exp -= 4
		}

		for dSig64 <= 0x18ff_ffff_ffff_ffff {
			dSig64 *= 10
			exp--
		}

		sig64, rem64 := bits.Div64(0, dSig64, oSig[0])

		var carry uint64
		for rem64 != 0 && sig64 <= 0x18ff_ffff_ffff_ffff {
			for rem64 <= 0x0002_7fff_ffff_ffff && sig64 <= 0x0002_7fff_ffff_ffff {
				rem64 *= 10_000
				sig64 *= 10_000
				exp -= 4
			}

			for rem64 <= 0x18ff_ffff_ffff_ffff && sig64 <= 0x18ff_ffff_ffff_ffff {
				rem64 *= 10
				sig64 *= 10
				exp--
			}

			if rem64 < oSig[0] {
				break
			}

			var tmp uint64
			tmp, rem64 = bits.Div64(0, rem64, oSig[0])
			sig64, carry = bits.Add64(sig64, tmp, 0)

			if carry != 0 {
				break
			}
		}

		sig = uint128{sig64, carry}
		rem = uint128{rem64, 0}
	} else {
		if dSig[1] == 0 {
			dSig = dSig.mul64(10_000_000_000_000_000_000)
			exp -= 19
		}

		for dSig[1] <= 0x0002_7fff_ffff_ffff {
			dSig = dSig.mul64(10_000)
			exp -= 4
		}

		for dSig[1] <= 0x18ff_ffff_ffff_ffff {
			dSig = dSig.mul64(10)
			exp--
		}

		sig, rem = dSig.div(oSig)
	}

	trunc := int8(0)

	for rem[0]|rem[1] != 0 && sig[1] <= 0x0002_7fff_ffff_ffff {
		for rem[1] <= 0x0002_7fff_ffff_ffff && sig[1] <= 0x0002_7fff_ffff_ffff {
			rem = rem.mul64(10_000)
			sig = sig.mul64(10_000)
			exp -= 4
		}

		for rem[1] <= 0x18ff_ffff_ffff_ffff && sig[1] <= 0x18ff_ffff_ffff_ffff {
			rem = rem.mul64(10)
			sig = sig.mul64(10)
			exp--
		}

		var tmp uint128
		tmp, rem = rem.div(oSig)
		sig192 := sig.add(tmp)

		for sig192[2] != 0 {
			var rem192 uint64
			sig192, rem192 = sig192.div10()
			exp++

			if rem192 != 0 {
				trunc = 1
			}
		}

		sig = uint128{sig192[0], sig192[1]}
	}

	if rem[0]|rem[1] != 0 {
		trunc = 1
	}

	neg := d.Signbit() != o.Signbit()
	sig, exp = mode.reduce128(neg, sig, exp, trunc)

	if exp > maxBiasedExponent {
		return inf(neg)
	}

	return compose(neg, sig, exp)
}

// QuoRem divides d by o, rounding using the [DefaultRoundingMode], and returns
// the result as an integer quotient and a remainder.
func (d Decimal) QuoRem(o Decimal) (Decimal, Decimal) {
	return d.QuoRemWithMode(o, DefaultRoundingMode)
}

// QuoRem divides d by o, rounding using the provided rounding mode, and
// returns the result as an integer quotient and a remainder.
func (d Decimal) QuoRemWithMode(o Decimal, mode RoundingMode) (Decimal, Decimal) {
	if d.isSpecial() || o.isSpecial() {
		if d.IsNaN() {
			return d, d
		}

		if o.IsNaN() {
			return o, o
		}

		if d.isInf() {
			lhs := payloadValPosInfinite
			if d.Signbit() {
				lhs = payloadValNegInfinite
			}

			if o.isInf() {
				rhs := payloadValPosInfinite
				if o.Signbit() {
					rhs = payloadValNegInfinite
				}

				res := nan(payloadOpQuoRem, lhs, rhs)
				return res, res
			}

			rhs := payloadValPosFinite
			if o.IsZero() {
				if o.Signbit() {
					rhs = payloadValNegZero
				} else {
					rhs = payloadValPosZero
				}
			} else if o.Signbit() {
				rhs = payloadValNegFinite
			}

			return inf(d.Signbit() != o.Signbit()), nan(payloadOpQuoRem, lhs, rhs)
		}

		if o.isInf() {
			return zero(d.Signbit() != o.Signbit()), d
		}
	}

	dSig, dExp := d.decompose()
	oSig, oExp := o.decompose()

	if oSig[0]|oSig[1] == 0 {
		rhs := payloadValPosZero
		if o.Signbit() {
			rhs = payloadValNegZero
		}

		if dSig[0]|dSig[1] == 0 {
			lhs := payloadValPosZero
			if d.Signbit() {
				lhs = payloadValNegZero
			}

			res := nan(payloadOpQuoRem, lhs, rhs)
			return res, res
		}

		lhs := payloadValPosFinite
		if d.Signbit() {
			lhs = payloadValNegFinite
		}

		return inf(d.Signbit() != o.Signbit()), nan(payloadOpQuoRem, lhs, rhs)
	}

	if dSig[0]|dSig[1] == 0 {
		return zero(d.Signbit() != o.Signbit()), zero(d.Signbit())
	}

	exp := (dExp - exponentBias) - (oExp - exponentBias)

	if exp < 0 {
		if exp <= -19 && oSig[1] == 0 {
			oSig = oSig.mul64(10_000_000_000_000_000_000)
			exp += 19
		}

		for exp <= -4 && oSig[1] <= 0x0002_7fff_ffff_ffff {
			oSig = oSig.mul64(10_000)
			exp += 4
		}

		for exp < 0 && oSig[1] <= 0x18ff_ffff_ffff_ffff {
			oSig = oSig.mul64(10)
			exp++
		}

		if exp < 0 || oSig.cmp(dSig) > 0 {
			return zero(d.Signbit() != o.Signbit()), d
		}
	} else if exp > 0 {
		if exp >= 19 && dSig[1] == 0 {
			dSig = dSig.mul64(10_000_000_000_000_000_000)
			dExp -= 19
			exp -= 19
		}

		for exp >= 4 && dSig[1] <= 0x0002_7fff_ffff_ffff {
			dSig = dSig.mul64(10_000)
			dExp -= 4
			exp -= 4
		}

		for exp > 0 && dSig[1] <= 0x18ff_ffff_ffff_ffff {
			dSig = dSig.mul64(10)
			dExp--
			exp--
		}
	}

	qexp := exp + exponentBias
	rexp := dExp

	var sig uint128
	var rem uint128
	if dSig[1]|oSig[1] == 0 {
		sig64, rem64 := bits.Div64(0, dSig[0], oSig[0])

		var carry uint64
		for exp > 0 && rem64 != 0 && sig64 <= 0x18ff_ffff_ffff_ffff {
			for exp >= 4 && rem64 <= 0x0002_7fff_ffff_ffff && sig64 <= 0x0002_7fff_ffff_ffff {
				rem64 *= 10_000
				sig64 *= 10_000
				exp -= 4
				qexp -= 4
				rexp -= 4
			}

			for exp > 0 && rem64 <= 0x18ff_ffff_ffff_ffff && sig64 <= 0x18ff_ffff_ffff_ffff {
				rem64 *= 10
				sig64 *= 10
				exp--
				qexp--
				rexp--
			}

			if rem64 < oSig[0] {
				break
			}

			var tmp uint64
			tmp, rem64 = bits.Div64(0, rem64, oSig[0])
			sig64, carry = bits.Add64(sig64, tmp, 0)

			if carry != 0 {
				break
			}
		}

		sig = uint128{sig64, carry}
		rem = uint128{rem64, 0}
	} else {
		sig, rem = dSig.div(oSig)
	}

	trunc := int8(0)

	for exp > 0 && rem[0]|rem[1] != 0 && sig[1] <= 0x0002_7fff_ffff_ffff {
		for exp >= 4 && rem[1] <= 0x0002_7fff_ffff_ffff && sig[1] <= 0x0002_7fff_ffff_ffff {
			rem = rem.mul64(10_000)
			sig = sig.mul64(10_000)
			exp -= 4
			qexp -= 4
			rexp -= 4
		}

		for exp > 0 && rem[1] <= 0x18ff_ffff_ffff_ffff && sig[1] <= 0x18ff_ffff_ffff_ffff {
			rem = rem.mul64(10)
			sig = sig.mul64(10)
			exp--
			qexp--
			rexp--
		}

		var tmp uint128
		tmp, rem = rem.div(oSig)
		sig192 := sig.add(tmp)

		for sig192[2] != 0 {
			var rem192 uint64
			sig192, rem192 = sig192.div10()
			qexp++

			if rem192 != 0 {
				trunc = 1
			}
		}

		sig = uint128{sig192[0], sig192[1]}
	}

	for exp > 0 && rem[0]|rem[1] != 0 {
		for exp >= 4 && rem[1] <= 0x0002_7fff_ffff_ffff {
			rem = rem.mul64(10_000)
			exp -= 4
			rexp -= 4
		}

		for exp > 0 && rem[1] <= 0x18ff_ffff_ffff_ffff {
			rem = rem.mul64(10)
			exp--
			rexp--
		}

		var tmp uint128
		tmp, rem = rem.div(oSig)

		if tmp[0]|tmp[1] != 0 {
			trunc = 1
		}
	}

	qneg := d.Signbit() != o.Signbit()
	qsig, qexp := mode.reduce128(qneg, sig, qexp, trunc)

	rneg := d.Signbit()
	rsig, rexp := mode.reduce128(rneg, rem, rexp, 0)

	quo := compose(qneg, qsig, qexp)

	if qexp > maxBiasedExponent {
		quo = inf(qneg)
	}

	if rexp > maxBiasedExponent {
		return quo, inf(rneg)
	}

	return quo, compose(rneg, rsig, rexp)
}

// Sub subtracts o from d, rounding using the [DefaultRoundingMode], and
// returns the result.
func (d Decimal) Sub(o Decimal) Decimal {
	return d.SubWithMode(o, DefaultRoundingMode)
}

// SubWithMode subtracts o from d, rounding using the provided rounding mode,
// and returns the result.
func (d Decimal) SubWithMode(o Decimal, mode RoundingMode) Decimal {
	if d.isSpecial() || o.isSpecial() {
		if d.IsNaN() {
			return d
		}

		if o.IsNaN() {
			return o
		}

		if d.isInf() {
			neg := d.Signbit()

			if o.isInf() && neg == o.Signbit() {
				lhs := payloadValPosInfinite
				rhs := payloadValPosInfinite
				if neg {
					lhs = payloadValNegInfinite
					rhs = payloadValNegInfinite
				}

				return nan(payloadOpSub, lhs, rhs)
			}

			return inf(neg)
		}

		return inf(!o.Signbit())
	}

	return d.add(o, mode, true)
}

func (d Decimal) add(o Decimal, mode RoundingMode, subtract bool) Decimal {
	dSig, dExp := d.decompose()
	oSig, oExp := o.decompose()

	if dSig[0]|dSig[1] == 0 {
		if oSig[0]|oSig[1] == 0 {
			if subtract {
				return zero(d.Signbit() && !o.Signbit())
			} else {
				return zero(d.Signbit() && o.Signbit())
			}
		}

		if subtract {
			return compose(!o.Signbit(), oSig, oExp)
		}

		return o
	}

	if oSig[0]|oSig[1] == 0 {
		return d
	}

	exp := dExp - oExp
	trunc := int8(0)

	if exp < 0 {
		if exp <= -19 && oSig[1] == 0 {
			oSig = oSig.mul64(10_000_000_000_000_000_000)
			oExp -= 19
			exp += 19
		}

		for exp <= -4 && oSig[1] <= 0x0002_7fff_ffff_ffff {
			oSig = oSig.mul64(10_000)
			oExp -= 4
			exp += 4
		}

		for exp < 0 && oSig[1] <= 0x18ff_ffff_ffff_ffff {
			oSig = oSig.mul64(10)
			oExp--
			exp++
		}

		if exp < -maxDigits {
			if dSig[0]|dSig[1] != 0 {
				dSig = uint128{}
				trunc = 1
			}

			dExp = oExp
			exp = 0
		}

		if exp <= -8 {
			var rem uint64
			dSig, rem = dSig.div1e8()
			if rem != 0 {
				trunc = 1
			}

			if dSig[0]|dSig[1] == 0 {
				dExp = oExp
				exp = 0
			} else {
				dExp += 8
				exp += 8
			}
		}

		if exp <= -4 {
			var rem uint64
			dSig, rem = dSig.div10000()
			if rem != 0 {
				trunc = 1
			}

			if dSig[0]|dSig[1] == 0 {
				dExp = oExp
				exp = 0
			} else {
				dExp += 4
				exp += 4
			}
		}

		if exp <= -3 {
			var rem uint64
			dSig, rem = dSig.div1000()
			if rem != 0 {
				trunc = 1
			}

			if dSig[0]|dSig[1] == 0 {
				dExp = oExp
				exp = 0
			} else {
				dExp += 3
				exp += 3
			}
		}

		if exp <= -2 {
			var rem uint64
			dSig, rem = dSig.div100()
			if rem != 0 {
				trunc = 1
			}

			if dSig[0]|dSig[1] == 0 {
				dExp = oExp
				exp = 0
			} else {
				dExp += 2
				exp += 2
			}
		}

		for exp < 0 {
			var rem uint64
			dSig, rem = dSig.div10()
			if rem != 0 {
				trunc = 1
			}

			if dSig[0]|dSig[1] == 0 {
				dExp = oExp
				break
			}

			dExp++
			exp++
		}
	} else if exp > 0 {
		if exp >= 19 && dSig[1] == 0 {
			dSig = dSig.mul64(10_000_000_000_000_000_000)
			dExp -= 19
			exp -= 19
		}

		for exp >= 4 && dSig[1] <= 0x0002_7fff_ffff_ffff {
			dSig = dSig.mul64(10_000)
			dExp -= 4
			exp -= 4
		}

		for exp > 0 && dSig[1] <= 0x18ff_ffff_ffff_ffff {
			dSig = dSig.mul64(10)
			dExp--
			exp--
		}

		if exp > maxDigits {
			if oSig[0]|oSig[1] != 0 {
				oSig = uint128{}
				trunc = -1
			}

			exp = 0
		}

		if exp >= 8 {
			var rem uint64
			oSig, rem = oSig.div1e8()
			if rem != 0 {
				trunc = -1
			}

			if oSig[0]|oSig[1] == 0 {
				exp = 0
			} else {
				exp -= 8
			}
		}

		if exp >= 4 {
			var rem uint64
			oSig, rem = oSig.div10000()
			if rem != 0 {
				trunc = -1
			}

			if oSig[0]|oSig[1] == 0 {
				exp = 0
			} else {
				exp -= 4
			}
		}

		if exp >= 3 {
			var rem uint64
			oSig, rem = oSig.div1000()
			if rem != 0 {
				trunc = -1
			}

			if oSig[0]|oSig[1] == 0 {
				exp = 0
			} else {
				exp -= 3
			}
		}

		if exp >= 2 {
			var rem uint64
			oSig, rem = oSig.div100()
			if rem != 0 {
				trunc = -1
			}

			if oSig[0]|oSig[1] == 0 {
				exp = 0
			} else {
				exp -= 2
			}
		}

		for exp > 0 {
			var rem uint64
			oSig, rem = oSig.div10()
			if rem != 0 {
				trunc = -1
			}

			if oSig[0]|oSig[1] == 0 {
				break
			}

			exp--
		}
	}

	dNeg := d.Signbit()
	oNeg := o.Signbit()
	if subtract {
		oNeg = !oNeg
	}

	neg := dNeg

	var sig uint128
	if dNeg == oNeg {
		sig192 := dSig.add(oSig)

		if sig192[0]|sig192[1]|sig192[2] == 0 {
			return zero(mode == ToNegativeInf)
		}

		if trunc == -1 {
			trunc = 1
		}

		sig, exp = mode.reduce192(neg, sig192, dExp, trunc)
	} else {
		var brw uint
		sig, brw = dSig.sub(oSig)

		if brw != 0 {
			sig = sig.twos()
			neg = !neg
			trunc *= -1
		} else if sig[0]|sig[1] == 0 {
			return zero(mode == ToNegativeInf)
		}

		sig, exp = mode.reduce128(neg, sig, dExp, trunc)
	}

	if exp > maxBiasedExponent {
		return inf(neg)
	}

	return compose(neg, sig, exp)
}
