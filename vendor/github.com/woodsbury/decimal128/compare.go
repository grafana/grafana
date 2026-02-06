package decimal128

// Compare returns:
//
//	-1 if d < o
//	 0 if d == o
//	+1 if d > o
//
// Unlike [Decimal.Cmp], Compare considers NaN values to be less than any other
// values.
func Compare(d, o Decimal) int {
	if d.IsNaN() {
		if o.IsNaN() {
			return 0
		}

		return -1
	}

	if o.IsNaN() {
		return 1
	}

	return int(d.Cmp(o))
}

// Max returns the larger of d or o. If either value is NaN the result is NaN.
func Max(d, o Decimal) Decimal {
	if d.IsNaN() {
		return d
	}

	if o.IsNaN() {
		return o
	}

	if d.IsZero() && o.IsZero() {
		if !d.Signbit() || !o.Signbit() {
			return zero(false)
		}

		return zero(true)
	}

	if o.Cmp(d).Greater() {
		return o
	}

	return d
}

// Min returns the smaller of d or o. If either value is NaN the result is NaN.
func Min(d, o Decimal) Decimal {
	if d.IsNaN() {
		return d
	}

	if o.IsNaN() {
		return o
	}

	if d.IsZero() && o.IsZero() {
		if d.Signbit() || o.Signbit() {
			return zero(true)
		}

		return zero(false)
	}

	if o.Cmp(d).Less() {
		return o
	}

	return d
}

// CmpResult represents the result from comparing two Decimals. When the values
// being compared aren't NaNs, the integer value of the CmpResult will be:
//
//	-1 if lhs < rhs
//	 0 if lhs == rhs
//	+1 if lhs > rhs
//
// The Equal, Greater, GreaterOrEqual, Less, and LessOrEqual methods can also
// be used to determine the result. If either value is a NaN, then these
// methods will still behave correctly.
type CmpResult int8

const (
	cmpNaN     CmpResult = -2
	cmpLess    CmpResult = -1
	cmpEqual   CmpResult = 0
	cmpGreater CmpResult = 1
)

// Equal returns whether this CmpResult represents that the two Decimals were
// equal to each other. This method will handle when one of the values being
// compared was a NaN.
func (cr CmpResult) Equal() bool {
	return cr == cmpEqual
}

// Greater returns whether this CmpResult represents that the value on the
// left-hand side of the comparison was greater than the value on the
// right-hand side. This method will handle when one of the values being
// compared was a NaN.
func (cr CmpResult) Greater() bool {
	return cr == cmpGreater
}

// GreaterOrEqual returns whether this CmpResult represents that the value on
// the left-hand side of the comparison was greater than or equal to the value
// on the right-hand side. This method will handle when one of the values being
// compared was a NaN.
func (cr CmpResult) GreaterOrEqual() bool {
	return cr == cmpGreater || cr == cmpEqual
}

// Less returns whether this CmpResult represents that the value on the
// left-hand side of the comparison was less than the value on the right-hand
// side. This method will handle when one of the values being compared was a
// NaN.
func (cr CmpResult) Less() bool {
	return cr == cmpLess
}

// LessOrEqual returns whether this CmpResult represents that the value on the
// left-hand side of the comparison was less than or equal to the value on the
// right-hand side. This method will handle when one of the values being
// compared was a NaN.
func (cr CmpResult) LessOrEqual() bool {
	return cr == cmpLess || cr == cmpEqual
}

// Cmp compares two Decimals and returns a CmpResult representing whether the
// two values were equal, the left-hand side was greater than the right-hand
// side, or the left-hand side was less than the right-hand side.
func (d Decimal) Cmp(o Decimal) CmpResult {
	if d.isSpecial() || o.isSpecial() {
		if d.IsNaN() || o.IsNaN() {
			return cmpNaN
		}

		if d.isInf() {
			neg := d.Signbit()

			if o.isInf() && neg == o.Signbit() {
				return cmpEqual
			}

			if neg {
				return cmpLess
			}

			return cmpGreater
		}

		if o.isInf() {
			if o.Signbit() {
				return cmpGreater
			}

			return cmpLess
		}
	}

	if d == o {
		return cmpEqual
	}

	dSig, dExp := d.decompose()

	if dSig[0]|dSig[1] == 0 {
		if o.IsZero() {
			return cmpEqual
		}

		if o.Signbit() {
			return cmpGreater
		}

		return cmpLess
	}

	oSig, oExp := o.decompose()

	if oSig[0]|oSig[1] == 0 {
		if d.Signbit() {
			return cmpLess
		}

		return cmpGreater
	}

	neg := d.Signbit()

	if neg != o.Signbit() {
		if neg {
			return cmpLess
		}

		return cmpGreater
	}

	exp := dExp - oExp
	trunc := false

	var res CmpResult
	if neg {
		res = cmpLess
	} else {
		res = cmpGreater
	}

	if exp < 0 {
		if oSig.cmp(dSig) >= 0 {
			return res * -1
		}

		if exp <= -19 {
			if exp < -maxDigits {
				return res * -1
			}

			var rem uint64
			dSig, rem = dSig.div1e19()
			if dSig[0]|dSig[1] == 0 {
				return res * -1
			}

			if rem != 0 {
				trunc = true
			}

			exp += 19
		}

		exp *= -1
		dSig, oSig = oSig, dSig
		res *= -1
	} else if exp > 0 {
		if dSig.cmp(oSig) >= 0 {
			return res
		}

		if exp >= 19 {
			if exp > maxDigits {
				return res
			}

			var rem uint64
			oSig, rem = oSig.div1e19()
			if oSig[0]|oSig[1] == 0 {
				return res
			}

			if rem != 0 {
				trunc = true
			}

			exp -= 19
		}
	}

	if exp >= 8 {
		var rem uint64
		oSig, rem = oSig.div1e8()
		if oSig[0]|oSig[1] == 0 {
			return res
		}

		if rem != 0 {
			trunc = true
		}

		exp -= 8
	}

	if oSig[1] == 0 {
		if dSig[1] != 0 {
			return res
		}

		oSig64 := oSig[0]

		if exp >= 8 {
			if oSig64%100_000_000 != 0 {
				trunc = true
			}

			oSig64 /= 100_000_000
			if oSig64 == 0 {
				return res
			}

			exp -= 8
		}

		switch exp {
		case 7:
			if oSig64%10_000_000 != 0 {
				trunc = true
			}

			oSig64 /= 10_000_000
			if oSig64 == 0 {
				return res
			}
		case 6:
			if oSig64%1_000_000 != 0 {
				trunc = true
			}

			oSig64 /= 1_000_000
			if oSig64 == 0 {
				return res
			}
		case 5:
			if oSig64%100_000 != 0 {
				trunc = true
			}

			oSig64 /= 100_000
			if oSig64 == 0 {
				return res
			}
		case 4:
			if oSig64%10_000 != 0 {
				trunc = true
			}

			oSig64 /= 10_000
			if oSig64 == 0 {
				return res
			}
		case 3:
			if oSig64%1000 != 0 {
				trunc = true
			}

			oSig64 /= 1000
			if oSig64 == 0 {
				return res
			}
		case 2:
			if oSig64%100 != 0 {
				trunc = true
			}

			oSig64 /= 100
			if oSig64 == 0 {
				return res
			}
		case 1:
			if oSig64%10 != 0 {
				trunc = true
			}

			oSig64 /= 10
			if oSig64 == 0 {
				return res
			}
		}

		if dSig[0] == oSig64 {
			if trunc {
				return res * -1
			}

			return cmpEqual
		}

		if dSig[0] < oSig64 {
			return res * -1
		}

		return res
	}

	if exp >= 8 {
		var rem uint64
		oSig, rem = oSig.div1e8()
		if oSig[0]|oSig[1] == 0 {
			return res
		}

		if rem != 0 {
			trunc = true
		}

		exp -= 8
	}

	var rem uint64
	switch exp {
	case 7:
		oSig, rem = oSig.div10()
		if oSig[0]|oSig[1] == 0 {
			return res
		}

		if rem != 0 {
			trunc = true
		}

		fallthrough
	case 6:
		oSig, rem = oSig.div1000()
		if oSig[0]|oSig[1] == 0 {
			return res
		}

		if rem != 0 {
			trunc = true
		}

		oSig, rem = oSig.div1000()
		if oSig[0]|oSig[1] == 0 {
			return res
		}

		if rem != 0 {
			trunc = true
		}
	case 5:
		oSig, rem = oSig.div10()
		if oSig[0]|oSig[1] == 0 {
			return res
		}

		if rem != 0 {
			trunc = true
		}

		fallthrough
	case 4:
		oSig, rem = oSig.div10000()
		if oSig[0]|oSig[1] == 0 {
			return res
		}

		if rem != 0 {
			trunc = true
		}
	case 3:
		oSig, rem = oSig.div1000()
		if oSig[0]|oSig[1] == 0 {
			return res
		}

		if rem != 0 {
			trunc = true
		}
	case 2:
		oSig, rem = oSig.div10()
		if oSig[0]|oSig[1] == 0 {
			return res
		}

		if rem != 0 {
			trunc = true
		}

		fallthrough
	case 1:
		oSig, rem = oSig.div10()
		if oSig[0]|oSig[1] == 0 {
			return res
		}

		if rem != 0 {
			trunc = true
		}
	}

	sres := dSig.cmp(oSig)
	if sres == 0 {
		if trunc {
			return res * -1
		}

		return cmpEqual
	}

	if res == cmpLess {
		return CmpResult(sres * -1)
	}

	return CmpResult(sres)
}

// CmpAbs compares the absolute value of two Decimals and returns a CmpResult
// representing whether the two values were equal, the left-hand side was
// greater than the right-hand side, or the left-hand side was less than the
// right-hand side.
func (d Decimal) CmpAbs(o Decimal) CmpResult {
	if d.isSpecial() || o.isSpecial() {
		if d.IsNaN() || o.IsNaN() {
			return cmpNaN
		}

		if d.isInf() {
			if o.isInf() {
				return cmpEqual
			}

			return cmpGreater
		}

		if o.isInf() {
			return cmpLess
		}
	}

	if d == o {
		return cmpEqual
	}

	dSig, dExp := d.decompose()

	if dSig[0]|dSig[1] == 0 {
		if o.IsZero() {
			return cmpEqual
		}

		return cmpLess
	}

	oSig, oExp := o.decompose()

	if oSig[0]|oSig[1] == 0 {
		return cmpGreater
	}

	exp := dExp - oExp
	trunc := false
	res := cmpGreater

	if exp < 0 {
		if oSig.cmp(dSig) >= 0 {
			return cmpLess
		}

		if exp <= -19 {
			if exp < -maxDigits {
				return cmpLess
			}

			var rem uint64
			dSig, rem = dSig.div1e19()
			if dSig[0]|dSig[1] == 0 {
				return cmpLess
			}

			if rem != 0 {
				trunc = true
			}

			exp += 19
		}

		exp *= -1
		dSig, oSig = oSig, dSig
		res = cmpLess
	} else if exp > 0 {
		if dSig.cmp(oSig) >= 0 {
			return cmpGreater
		}

		if exp >= 19 {
			if exp > maxDigits {
				return cmpGreater
			}

			var rem uint64
			oSig, rem = oSig.div1e19()
			if oSig[0]|oSig[1] == 0 {
				return cmpGreater
			}

			if rem != 0 {
				trunc = true
			}

			exp -= 19
		}
	}

	if exp >= 8 {
		var rem uint64
		oSig, rem = oSig.div1e8()
		if oSig[0]|oSig[1] == 0 {
			return res
		}

		if rem != 0 {
			trunc = true
		}

		exp -= 8
	}

	if oSig[1] == 0 {
		if dSig[1] != 0 {
			return res
		}

		oSig64 := oSig[0]

		if exp >= 8 {
			if oSig64%100_000_000 != 0 {
				trunc = true
			}

			oSig64 /= 100_000_000
			if oSig64 == 0 {
				return res
			}

			exp -= 8
		}

		switch exp {
		case 7:
			if oSig64%10_000_000 != 0 {
				trunc = true
			}

			oSig64 /= 10_000_000
			if oSig64 == 0 {
				return res
			}
		case 6:
			if oSig64%1_000_000 != 0 {
				trunc = true
			}

			oSig64 /= 1_000_000
			if oSig64 == 0 {
				return res
			}
		case 5:
			if oSig64%100_000 != 0 {
				trunc = true
			}

			oSig64 /= 100_000
			if oSig64 == 0 {
				return res
			}
		case 4:
			if oSig64%10_000 != 0 {
				trunc = true
			}

			oSig64 /= 10_000
			if oSig64 == 0 {
				return res
			}
		case 3:
			if oSig64%1000 != 0 {
				trunc = true
			}

			oSig64 /= 1000
			if oSig64 == 0 {
				return res
			}
		case 2:
			if oSig64%100 != 0 {
				trunc = true
			}

			oSig64 /= 100
			if oSig64 == 0 {
				return res
			}
		case 1:
			if oSig64%10 != 0 {
				trunc = true
			}

			oSig64 /= 10
			if oSig64 == 0 {
				return res
			}
		}

		if dSig[0] == oSig64 {
			if trunc {
				return res * -1
			}

			return cmpEqual
		}

		if dSig[0] < oSig64 {
			return res * -1
		}

		return res
	}

	if exp >= 8 {
		var rem uint64
		oSig, rem = oSig.div1e8()
		if oSig[0]|oSig[1] == 0 {
			return res
		}

		if rem != 0 {
			trunc = true
		}

		exp -= 8
	}

	var rem uint64
	switch exp {
	case 7:
		oSig, rem = oSig.div10()
		if oSig[0]|oSig[1] == 0 {
			return res
		}

		if rem != 0 {
			trunc = true
		}

		fallthrough
	case 6:
		oSig, rem = oSig.div1000()
		if oSig[0]|oSig[1] == 0 {
			return res
		}

		if rem != 0 {
			trunc = true
		}

		oSig, rem = oSig.div1000()
		if oSig[0]|oSig[1] == 0 {
			return res
		}

		if rem != 0 {
			trunc = true
		}
	case 5:
		oSig, rem = oSig.div10()
		if oSig[0]|oSig[1] == 0 {
			return res
		}

		if rem != 0 {
			trunc = true
		}

		fallthrough
	case 4:
		oSig, rem = oSig.div10000()
		if oSig[0]|oSig[1] == 0 {
			return res
		}

		if rem != 0 {
			trunc = true
		}
	case 3:
		oSig, rem = oSig.div1000()
		if oSig[0]|oSig[1] == 0 {
			return res
		}

		if rem != 0 {
			trunc = true
		}
	case 2:
		oSig, rem = oSig.div10()
		if oSig[0]|oSig[1] == 0 {
			return res
		}

		if rem != 0 {
			trunc = true
		}

		fallthrough
	case 1:
		oSig, rem = oSig.div10()
		if oSig[0]|oSig[1] == 0 {
			return res
		}

		if rem != 0 {
			trunc = true
		}
	}

	sres := dSig.cmp(oSig)
	if sres == 0 {
		if trunc {
			return res * -1
		}

		return cmpEqual
	}

	if res == cmpLess {
		return CmpResult(sres * -1)
	}

	return CmpResult(sres)
}

// Equal compares two Decimals and reports whether they are equal.
func (d Decimal) Equal(o Decimal) bool {
	if d.isSpecial() || o.isSpecial() {
		if d.IsNaN() || o.IsNaN() {
			return false
		}

		if d.isInf() {
			return o.isInf() && d.Signbit() == o.Signbit()
		}

		if o.isInf() {
			return false
		}
	}

	if d == o {
		return true
	}

	dSig, dExp := d.decompose()

	if dSig[0]|dSig[1] == 0 {
		return o.IsZero()
	}

	oSig, oExp := o.decompose()

	if oSig[0]|oSig[1] == 0 {
		return false
	}

	if d.Signbit() != o.Signbit() {
		return false
	}

	exp := dExp - oExp

	if exp < 0 {
		if oSig.cmp(dSig) >= 0 {
			return false
		}

		if exp <= -19 {
			if exp < -maxDigits {
				return false
			}

			var rem uint64
			dSig, rem = dSig.div1e19()
			if rem != 0 {
				return false
			}

			exp += 19
		}

		exp *= -1
		dSig, oSig = oSig, dSig
	} else if exp > 0 {
		if dSig.cmp(oSig) >= 0 {
			return false
		}

		if exp >= 19 {
			if exp > maxDigits {
				return false
			}

			var rem uint64
			oSig, rem = oSig.div1e19()
			if rem != 0 {
				return false
			}

			exp -= 19
		}
	}

	if exp >= 8 {
		var rem uint64
		oSig, rem = oSig.div1e8()
		if rem != 0 {
			return false
		}

		exp -= 8
	}

	if oSig[1] == 0 {
		if dSig[1] != 0 {
			return false
		}

		oSig64 := oSig[0]

		if exp >= 8 {
			if oSig64%100_000_000 != 0 {
				return false
			}

			oSig64 /= 100_000_000
			exp -= 8
		}

		switch exp {
		case 7:
			if oSig64%10_000_000 != 0 {
				return false
			}

			oSig64 /= 10_000_000
		case 6:
			if oSig64%1_000_000 != 0 {
				return false
			}

			oSig64 /= 1_000_000
		case 5:
			if oSig64%100_000 != 0 {
				return false
			}

			oSig64 /= 100_000
		case 4:
			if oSig64%10_000 != 0 {
				return false
			}

			oSig64 /= 10_000
		case 3:
			if oSig64%1000 != 0 {
				return false
			}

			oSig64 /= 1000
		case 2:
			if oSig64%100 != 0 {
				return false
			}

			oSig64 /= 100
		case 1:
			if oSig64%10 != 0 {
				return false
			}

			oSig64 /= 10
		}

		return dSig[0] == oSig64
	}

	if exp >= 8 {
		var rem uint64
		oSig, rem = oSig.div1e8()
		if rem != 0 {
			return false
		}

		exp -= 8
	}

	var rem uint64
	switch exp {
	case 7:
		oSig, rem = oSig.div10()
		if rem != 0 {
			return false
		}

		fallthrough
	case 6:
		oSig, rem = oSig.div1000()
		if rem != 0 {
			return false
		}

		oSig, rem = oSig.div1000()
		if rem != 0 {
			return false
		}
	case 5:
		oSig, rem = oSig.div10()
		if rem != 0 {
			return false
		}

		fallthrough
	case 4:
		oSig, rem = oSig.div10000()
		if rem != 0 {
			return false
		}
	case 3:
		oSig, rem = oSig.div1000()
		if rem != 0 {
			return false
		}
	case 2:
		oSig, rem = oSig.div10()
		if rem != 0 {
			return false
		}

		fallthrough
	case 1:
		oSig, rem = oSig.div10()
		if rem != 0 {
			return false
		}
	}

	return dSig == oSig
}

// IsZero reports whether the Decimal is equal to zero. This method will return
// true for both positive and negative zero.
func (d Decimal) IsZero() bool {
	if d.hi&0x6000_0000_0000_0000 == 0x6000_0000_0000_0000 {
		return false
	} else {
		return d.lo == 0 && d.hi&0x0001_ffff_ffff_ffff == 0
	}
}

func (d Decimal) isOne() bool {
	if d.isSpecial() {
		return false
	}

	sig, exp := d.decompose()

	if exp <= int16(-len(uint128PowersOf10)+exponentBias) || exp > exponentBias {
		return false
	}

	return sig == uint128PowersOf10[-(exp-exponentBias)]
}
