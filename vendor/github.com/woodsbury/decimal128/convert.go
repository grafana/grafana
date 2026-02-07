package decimal128

import (
	"math"
	"math/big"
	"math/bits"
)

// FromFloat converts f into a Decimal.
func FromFloat(f *big.Float) Decimal {
	if f.IsInf() {
		return inf(f.Signbit())
	}

	if f.Sign() == 0 {
		return zero(f.Signbit())
	}

	r, _ := f.Rat(nil)
	return FromRat(r)
}

// FromFloat32 converts f into a Decimal.
func FromFloat32(f float32) Decimal {
	if math.IsNaN(float64(f)) {
		return nan(payloadOpFromFloat32, 0, 0)
	}

	return FromFloat64(float64(f))
}

// FromFloat64 converts f into a Decimal.
func FromFloat64(f float64) Decimal {
	if math.IsNaN(f) {
		return nan(payloadOpFromFloat64, 0, 0)
	}

	if math.IsInf(f, 0) {
		return inf(math.Signbit(f))
	}

	if f == 0.0 {
		return zero(math.Signbit(f))
	}

	fbits := math.Float64bits(f)
	mant := fbits & 0x000f_ffff_ffff_ffff
	exp := int16(fbits >> 52 & 0x07ff)
	neg := fbits&0x8000_0000_0000_0000 != 0

	if exp == 0 {
		exp = -1022
	} else {
		mant |= 0x0010_0000_0000_0000
		exp -= 1023
	}

	shift := int(52 - exp)

	if shift == 0 {
		return compose(neg, uint128{mant, 0}, exponentBias)
	}

	var sig256 uint256
	exp = exponentBias
	trunc := int8(0)

	if shift < 0 {
		shift *= -1
		zeros := bits.LeadingZeros64(mant)

		if zeros > shift {
			zeros = shift
		}

		mant <<= zeros
		shift -= zeros

		sig256 = uint256{mant, 0, 0, 0}

		if shift <= 192 {
			sig256 = sig256.lsh(uint(shift))
		} else {
			sig256 = sig256.lsh(192)
			shift -= 192

			for shift != 0 {
				var rem uint64
				sig256, rem = sig256.div10()
				exp++

				if rem != 0 {
					trunc = 1
				}

				zeros = bits.LeadingZeros64(sig256[3])
				if shift > zeros {
					sig256 = sig256.lsh(uint(zeros))
					shift -= zeros
				} else {
					sig256 = sig256.lsh(uint(shift))
					break
				}
			}
		}
	} else {
		zeros := bits.TrailingZeros64(mant)

		if zeros > shift {
			zeros = shift
		}

		mant >>= zeros
		shift -= zeros

		if shift == 0 {
			sig256 = uint256{mant, 0, 0, 0}
		} else {
			sig := uint128{mant, 0}
			sig256 = sig.mul1e38()
			exp -= 38

			for shift != 0 {
				zeros = bits.LeadingZeros64(sig256[3])
				for zeros >= 4 {
					sig256 = sig256.mul64(10)
					exp--
					zeros = bits.LeadingZeros64(sig256[3])
				}

				max := 4 - zeros
				if shift < max {
					max = shift
				}

				zeros = bits.TrailingZeros64(sig256[0])

				if zeros < max {
					trunc = 1
				}

				sig256 = sig256.rsh(uint(max))
				shift -= max
			}
		}
	}

	sig, exp := DefaultRoundingMode.reduce256(neg, sig256, exp, trunc)

	if exp > maxBiasedExponent {
		return inf(neg)
	}

	return compose(neg, sig, exp)
}

// FromInt converts i into a Decimal.
func FromInt(i *big.Int) Decimal {
	neg := false
	if sgn := i.Sign(); sgn == 0 {
		return zero(false)
	} else if sgn < 0 {
		neg = true
	}

	exp := int16(exponentBias)
	trunc := int8(0)

	if bl := i.BitLen(); bl > 128 {
		i = new(big.Int).Set(i)
		r := new(big.Int)

		if bl > 256 {
			e18 := big.NewInt(1_000_000_000_000_000_000)

			for bl > 256 {
				i.QuoRem(i, e18, r)
				exp += 18

				if exp > maxBiasedExponent {
					return inf(neg)
				}

				bl = i.BitLen()

				if r.Sign() != 0 {
					trunc = 1
				}
			}
		}

		ten := big.NewInt(10)

		for bl > 128 {
			i.QuoRem(i, ten, r)
			exp++

			if exp > maxBiasedExponent {
				return inf(neg)
			}

			bl = i.BitLen()

			if r.Sign() != 0 {
				trunc = 1
			}
		}
	}

	var sig uint128

	b := i.Bits()
	for i := len(b) - 1; i >= 0; i-- {
		sig = sig.lsh(bits.UintSize)
		sig = sig.or64(uint64(b[i]))
	}

	sig, exp = DefaultRoundingMode.reduce128(neg, sig, exp, trunc)

	if exp > maxBiasedExponent {
		return inf(neg)
	}

	return compose(neg, sig, exp)
}

// FromInt32 converts i into a Decimal.
func FromInt32(i int32) Decimal {
	return FromInt64(int64(i))
}

// FromInt64 converts i into a Decimal.
func FromInt64(i int64) Decimal {
	if i == 0 {
		return zero(false)
	}

	neg := false
	if i < 0 {
		neg = true
		i *= -1
	}

	return compose(neg, uint128{uint64(i), 0}, exponentBias)
}

// FromRat converts r into a Decimal.
func FromRat(r *big.Rat) Decimal {
	num := r.Num()

	if num.Sign() == 0 {
		return zero(false)
	}

	denom := r.Denom()

	return FromInt(num).Quo(FromInt(denom))
}

// FromUint32 converts i into a Decimal.
func FromUint32(i uint32) Decimal {
	return FromUint64(uint64(i))
}

// FromUint64 converts i into a Decimal.
func FromUint64(i uint64) Decimal {
	if i == 0 {
		return zero(false)
	}

	return compose(false, uint128{i, 0}, exponentBias)
}

// Float converts d into a big.Float. If a non-nil argument f is provided,
// Float stores the result in f instead of allocating a new big.Float. It
// panics if d is NaN.
func (d Decimal) Float(f *big.Float) *big.Float {
	if d.isSpecial() {
		if d.IsNaN() {
			panic("Decimal(NaN).Float()")
		}

		if f == nil {
			f = new(big.Float)
		} else if f.Prec() == 0 {
			f.SetPrec(128)
		}

		return f.SetInf(d.Signbit())
	}

	sig, exp := d.decompose()
	exp -= exponentBias

	if f == nil {
		f = new(big.Float).SetPrec(128)
	} else if f.Prec() == 0 {
		f.SetPrec(128)
	}

	if sig[1] == 0 {
		f.SetUint64(sig[0])
	} else {
		bigsig := new(big.Int).SetUint64(sig[1])
		bigsig.Lsh(bigsig, 64).Or(bigsig, new(big.Int).SetUint64(sig[0]))

		f.SetInt(bigsig)
	}

	if d.Signbit() {
		f.Neg(f)
	}

	if exp == 0 {
		return f
	}

	var bigexp *big.Int
	if exp > 0 {
		bigexp = big.NewInt(int64(exp))
	} else {
		bigexp = big.NewInt(int64(exp * -1))
	}

	bigexp.Exp(big.NewInt(10), bigexp, nil)

	if exp > 0 {
		f.Mul(f, new(big.Float).SetInt(bigexp))
	} else {
		f.Quo(f, new(big.Float).SetInt(bigexp))
	}

	return f
}

// Float32 converts d into a float32.
func (d Decimal) Float32() float32 {
	return float32(d.Float64())
}

// Float64 converts d into a float64.
func (d Decimal) Float64() float64 {
	if d.isSpecial() {
		if d.IsNaN() {
			return math.NaN()
		}

		if d.Signbit() {
			return math.Inf(-1)
		}

		return math.Inf(1)
	}

	sig, exp := d.decompose()

	if sig[0]|sig[1] == 0 {
		f := 0.0
		if d.Signbit() {
			f = math.Copysign(f, -1.0)
		}

		return f
	}

	exp -= exponentBias

	if exp < -358 {
		f := 0.0
		if d.Signbit() {
			f = math.Copysign(f, -1.0)
		}

		return f
	}

	if exp > 308 {
		if d.Signbit() {
			return math.Inf(-1)
		}

		return math.Inf(1)
	}

	var sig256 uint256
	shift := int(exp)
	exp = 0

	if shift < 0 {
		shift *= -1
		sig256 = uint256{0, 0, sig[0], sig[1]}
		exp = -128

		for shift != 0 {
			zeros := bits.LeadingZeros64(sig256[3])
			sig256 = sig256.lsh(uint(zeros))
			exp -= int16(zeros)

			sig256, _ = sig256.div10()
			shift--
		}
	} else {
		sig256 = uint256{sig[0], sig[1], 0, 0}

		for shift > 19 && sig256[3] == 0 {
			sig256 = sig256.mul64(10_000_000_000_000_000_000)
			shift -= 19
		}

		for shift != 0 && sig256[3] <= 0x18ff_ffff_ffff_ffff {
			sig256 = sig256.mul64(10)
			shift--
		}

		for shift != 0 {
			sig256 = sig256.rsh(4)
			exp += 4

			for shift != 0 && sig256[3] <= 0x18ff_ffff_ffff_ffff {
				sig256 = sig256.mul64(10)
				shift--
			}
		}
	}

	zeros := bits.LeadingZeros64(sig256[3])
	for zeros != 0 {
		sig256 = sig256.lsh(uint(zeros))
		exp -= int16(zeros)
		zeros = bits.LeadingZeros64(sig256[3])
	}

	exp += 192
	f := float64(sig256[3])
	f = math.Ldexp(f, int(exp))

	if d.Signbit() {
		f = math.Copysign(f, -1.0)
	}

	return f
}

// Int converts d into a big.Int, truncating towards zero. If a non-nil
// argument i is provided, Int stores the result in i instead of allocating a
// new big.Int. It panics if d is NaN or infinite.
func (d Decimal) Int(i *big.Int) *big.Int {
	if d.isSpecial() {
		if d.IsNaN() {
			panic("Decimal(NaN).Int()")
		}

		if d.Signbit() {
			panic("Decimal(-Inf).Int()")
		}

		panic("Decimal(+Inf).Int()")
	}

	sig, exp := d.decompose()
	exp -= exponentBias

	if i == nil {
		i = new(big.Int)
	}

	if exp < -maxDigits {
		return i
	}

	if sig[1] == 0 {
		i.SetUint64(sig[0])
	} else {
		i.SetUint64(sig[1])
		i.Lsh(i, 64).Or(i, new(big.Int).SetUint64(sig[0]))
	}

	if d.Signbit() {
		i.Neg(i)
	}

	if exp == 0 {
		return i
	}

	var bigexp *big.Int
	if exp > 0 {
		bigexp = big.NewInt(int64(exp))
	} else {
		bigexp = big.NewInt(int64(exp * -1))
	}

	bigexp.Exp(big.NewInt(10), bigexp, nil)

	if exp > 0 {
		i.Mul(i, bigexp)
	} else {
		i.Quo(i, bigexp)
	}

	return i
}

// Int32 converts d into an int32, truncating towards zero. If the result is
// outside the range of an int32 the returned value will be either
// [math.MinInt32] or [math.MaxInt32] depending on the sign of the result and
// the boolean value will be false. Otherwise the boolean value will be true.
// It panics if d is NaN.
func (d Decimal) Int32() (int32, bool) {
	if d.isSpecial() {
		if d.IsNaN() {
			panic("Decimal(NaN).Int32()")
		}

		if d.Signbit() {
			return math.MinInt32, false
		}

		return math.MaxInt32, false
	}

	sig, exp := d.decompose()
	exp -= exponentBias

	if exp < -maxDigits {
		return 0, true
	}

	for exp < 0 {
		sig, _ = sig.div10()
		exp++

		if sig[0]|sig[1] == 0 {
			exp = 0
			break
		}
	}

	for sig[1] == 0 && exp > 0 {
		sig = sig.mul64(10)
		exp--
	}

	if sig[1] != 0 || exp != 0 {
		if d.Signbit() {
			return math.MinInt32, false
		}

		return math.MaxInt32, false
	}

	neg := d.Signbit()

	if neg {
		if sig[0] > math.MinInt32*-1 {
			return math.MinInt32, false
		}
	} else {
		if sig[0] > math.MaxInt32 {
			return math.MaxInt32, false
		}
	}

	i := int32(sig[0])

	if neg {
		i *= -1
	}

	return i, true
}

// Int64 converts d into an int64, truncating towards zero. If the result is
// outside the range of an int64 the returned value will be either
// [math.MinInt64] or [math.MaxInt64] depending on the sign of the result and
// the boolean value will be false. Otherwise the boolean value will be true.
// It panics if d is NaN.
func (d Decimal) Int64() (int64, bool) {
	if d.isSpecial() {
		if d.IsNaN() {
			panic("Decimal(NaN).Int64()")
		}

		if d.Signbit() {
			return math.MinInt64, false
		}

		return math.MaxInt64, false
	}

	sig, exp := d.decompose()
	exp -= exponentBias

	if exp < -maxDigits {
		return 0, true
	}

	for exp < 0 {
		sig, _ = sig.div10()
		exp++

		if sig[0]|sig[1] == 0 {
			exp = 0
			break
		}
	}

	for sig[1] == 0 && exp > 0 {
		sig = sig.mul64(10)
		exp--
	}

	if sig[1] != 0 || exp != 0 {
		if d.Signbit() {
			return math.MinInt64, false
		}

		return math.MaxInt64, false
	}

	neg := d.Signbit()

	if neg {
		if sig[0] > math.MinInt64*-1 {
			return math.MinInt64, false
		}
	} else {
		if sig[0] > math.MaxInt64 {
			return math.MaxInt64, false
		}
	}

	i := int64(sig[0])

	if neg {
		i *= -1
	}

	return i, true
}

// Rat converts d into a big.Rat. If a non-nil argument r is provided, Rat
// stores the result in r instead of allocating a new big.Rat. It panics if d
// is NaN or infinite.
func (d Decimal) Rat(r *big.Rat) *big.Rat {
	if d.isSpecial() {
		if d.IsNaN() {
			panic("Decimal(NaN).Rat()")
		}

		if d.Signbit() {
			panic("Decimal(-Inf).Rat()")
		}

		panic("Decimal(+Inf).Rat()")
	}

	sig, exp := d.decompose()
	exp -= exponentBias

	if r == nil {
		r = new(big.Rat)
	}

	if exp == 0 && sig[1] == 0 {
		r.SetUint64(sig[0])
	} else {
		bigsig := new(big.Int).SetUint64(sig[1])
		bigsig.Lsh(bigsig, 64).Or(bigsig, new(big.Int).SetUint64(sig[0]))

		var bigexp *big.Int
		if exp > 0 {
			bigexp = big.NewInt(int64(exp))
		} else {
			bigexp = big.NewInt(int64(exp * -1))
		}

		bigexp.Exp(big.NewInt(10), bigexp, nil)

		if exp > 0 {
			bigsig.Mul(bigsig, bigexp)
			r.SetInt(bigsig)
		} else {
			r.SetFrac(bigsig, bigexp)
		}
	}

	if d.Signbit() {
		r.Neg(r)
	}

	return r
}

// Uint32 converts d into a uint32, truncating towards zero. If the result is
// outside the range of a uint32 the returned value will be either 0 or
// [math.MaxUint32] depending on the sign of the result and the boolean value
// will be false. Otherwise the boolean value will be true. It panics if d is
// NaN.
func (d Decimal) Uint32() (uint32, bool) {
	if d.isSpecial() {
		if d.IsNaN() {
			panic("Decimal(NaN).Uint32()")
		}

		if d.Signbit() {
			return 0, false
		}

		return math.MaxUint32, false
	}

	if d.Signbit() {
		return 0, false
	}

	sig, exp := d.decompose()
	exp -= exponentBias

	if exp < -maxDigits {
		return 0, true
	}

	for exp < 0 {
		sig, _ = sig.div10()
		exp++

		if sig[0]|sig[1] == 0 {
			exp = 0
			break
		}
	}

	for sig[1] == 0 && exp > 0 {
		sig = sig.mul64(10)
		exp--
	}

	if sig[1] != 0 || exp != 0 {
		return math.MaxUint32, false
	}

	if sig[0] > math.MaxUint32 {
		return math.MaxUint32, false
	}

	return uint32(sig[0]), true
}

// Uint64 converts d into a uint64, truncating towards zero. If the result is
// outside the range of a uint64 the returned value will be either 0 or
// [math.MaxUint64] depending on the sign of the result and the boolean value
// will be false. Otherwise the boolean value will be true. It panics if d is
// NaN.
func (d Decimal) Uint64() (uint64, bool) {
	if d.isSpecial() {
		if d.IsNaN() {
			panic("Decimal(NaN).Uint64()")
		}

		if d.Signbit() {
			return 0, false
		}

		return math.MaxUint64, false
	}

	if d.Signbit() {
		return 0, false
	}

	sig, exp := d.decompose()
	exp -= exponentBias

	if exp < -maxDigits {
		return 0, true
	}

	for exp < 0 {
		sig, _ = sig.div10()
		exp++

		if sig[0]|sig[1] == 0 {
			exp = 0
			break
		}
	}

	for sig[1] == 0 && exp > 0 {
		sig = sig.mul64(10)
		exp--
	}

	if sig[1] != 0 || exp != 0 {
		return math.MaxUint64, false
	}

	return sig[0], true
}
