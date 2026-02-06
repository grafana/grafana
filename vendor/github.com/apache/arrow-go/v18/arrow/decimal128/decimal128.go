// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package decimal128

import (
	"errors"
	"fmt"
	"math"
	"math/big"
	"math/bits"

	"github.com/apache/arrow-go/v18/arrow/internal/debug"
)

const (
	MaxPrecision = 38
	MaxScale     = 38
)

var (
	MaxDecimal128 = New(542101086242752217, 687399551400673280-1)
)

func GetMaxValue(prec int32) Num {
	return scaleMultipliers[prec].Sub(FromU64(1))
}

// Num represents a signed 128-bit integer in two's complement.
// Calculations wrap around and overflow is ignored.
//
// For a discussion of the algorithms, look at Knuth's volume 2,
// Semi-numerical Algorithms section 4.3.1.
//
// Adapted from the Apache ORC C++ implementation
type Num struct {
	lo uint64 // low bits
	hi int64  // high bits
}

// New returns a new signed 128-bit integer value.
func New(hi int64, lo uint64) Num {
	return Num{lo: lo, hi: hi}
}

// FromU64 returns a new signed 128-bit integer value from the provided uint64 one.
func FromU64(v uint64) Num {
	return New(0, v)
}

// FromI64 returns a new signed 128-bit integer value from the provided int64 one.
func FromI64(v int64) Num {
	switch {
	case v > 0:
		return New(0, uint64(v))
	case v < 0:
		return New(-1, uint64(v))
	default:
		return Num{}
	}
}

// FromBigInt will convert a big.Int to a Num, if the value in v has a
// BitLen > 128, this will panic.
func FromBigInt(v *big.Int) (n Num) {
	bitlen := v.BitLen()
	if bitlen > 127 {
		panic("arrow/decimal128: cannot represent value larger than 128bits")
	} else if bitlen == 0 {
		// if bitlen is 0, then the value is 0 so return the default zeroed
		// out n
		return
	}

	// if the value is negative, then get the high and low bytes from
	// v, and then negate it. this is because Num uses a two's compliment
	// representation of values and big.Int stores the value as a bool for
	// the sign and the absolute value of the integer. This means that the
	// raw bytes are *always* the absolute value.
	b := v.Bits()
	n.lo = uint64(b[0])
	if len(b) > 1 {
		n.hi = int64(b[1])
	}
	if v.Sign() < 0 {
		return n.Negate()
	}
	return
}

// Negate returns a copy of this Decimal128 value but with the sign negated
func (n Num) Negate() Num {
	n.lo = ^n.lo + 1
	n.hi = ^n.hi
	if n.lo == 0 {
		n.hi += 1
	}
	return n
}

func (n Num) Add(rhs Num) Num {
	n.hi += rhs.hi
	var carry uint64
	n.lo, carry = bits.Add64(n.lo, rhs.lo, 0)
	n.hi += int64(carry)
	return n
}

func (n Num) Sub(rhs Num) Num {
	n.hi -= rhs.hi
	var borrow uint64
	n.lo, borrow = bits.Sub64(n.lo, rhs.lo, 0)
	n.hi -= int64(borrow)
	return n
}

func (n Num) Mul(rhs Num) Num {
	hi, lo := bits.Mul64(n.lo, rhs.lo)
	hi += (uint64(n.hi) * rhs.lo) + (n.lo * uint64(rhs.hi))
	return Num{hi: int64(hi), lo: lo}
}

func (n Num) Div(rhs Num) (res, rem Num) {
	b := n.BigInt()
	out, remainder := b.QuoRem(b, rhs.BigInt(), &big.Int{})
	return FromBigInt(out), FromBigInt(remainder)
}

func (n Num) Pow(rhs Num) Num {
	b := n.BigInt()
	return FromBigInt(b.Exp(b, rhs.BigInt(), nil))
}

func scalePositiveFloat64(v float64, prec, scale int32) (float64, error) {
	var pscale float64
	if scale >= -38 && scale <= 38 {
		pscale = float64PowersOfTen[scale+38]
	} else {
		pscale = math.Pow10(int(scale))
	}

	v *= pscale
	v = math.RoundToEven(v)
	maxabs := float64PowersOfTen[prec+38]
	if v <= -maxabs || v >= maxabs {
		return 0, fmt.Errorf("cannot convert %f to decimal128(precision=%d, scale=%d): overflow", v, prec, scale)
	}
	return v, nil
}

func fromPositiveFloat64(v float64, prec, scale int32) (Num, error) {
	v, err := scalePositiveFloat64(v, prec, scale)
	if err != nil {
		return Num{}, err
	}

	hi := math.Floor(math.Ldexp(v, -64))
	low := v - math.Ldexp(hi, 64)
	return Num{hi: int64(hi), lo: uint64(low)}, nil
}

// this has to exist despite sharing some code with fromPositiveFloat64
// because if we don't do the casts back to float32 in between each
// step, we end up with a significantly different answer!
// Aren't floating point values so much fun?
//
// example value to use:
//
//	v := float32(1.8446746e+15)
//
// You'll end up with a different values if you do:
//
//	FromFloat64(float64(v), 20, 4)
//
// vs
//
//	FromFloat32(v, 20, 4)
//
// because float64(v) == 1844674629206016 rather than 1844674600000000
func fromPositiveFloat32(v float32, prec, scale int32) (Num, error) {
	val, err := scalePositiveFloat64(float64(v), prec, scale)
	if err != nil {
		return Num{}, err
	}

	hi := float32(math.Floor(math.Ldexp(float64(float32(val)), -64)))
	low := float32(val) - float32(math.Ldexp(float64(hi), 64))
	return Num{hi: int64(hi), lo: uint64(low)}, nil
}

// FromFloat32 returns a new decimal128.Num constructed from the given float32
// value using the provided precision and scale. Will return an error if the
// value cannot be accurately represented with the desired precision and scale.
func FromFloat32(v float32, prec, scale int32) (Num, error) {
	if v < 0 {
		dec, err := fromPositiveFloat32(-v, prec, scale)
		if err != nil {
			return dec, err
		}
		return dec.Negate(), nil
	}
	return fromPositiveFloat32(v, prec, scale)
}

// FromFloat64 returns a new decimal128.Num constructed from the given float64
// value using the provided precision and scale. Will return an error if the
// value cannot be accurately represented with the desired precision and scale.
func FromFloat64(v float64, prec, scale int32) (Num, error) {
	if v < 0 {
		dec, err := fromPositiveFloat64(-v, prec, scale)
		if err != nil {
			return dec, err
		}
		return dec.Negate(), nil
	}
	return fromPositiveFloat64(v, prec, scale)
}

var pt5 = big.NewFloat(0.5)

func FromString(v string, prec, scale int32) (n Num, err error) {
	// time for some math!
	// Our input precision means "number of digits of precision" but the
	// math/big library refers to precision in floating point terms
	// where it refers to the "number of bits of precision in the mantissa".
	// So we need to figure out how many bits we should use for precision,
	// based on the input precision. Too much precision and we aren't rounding
	// when we should. Too little precision and we round when we shouldn't.
	//
	// In general, the number of decimal digits you get from a given number
	// of bits will be:
	//
	//	digits = log[base 10](2^nbits)
	//
	// it thus follows that:
	//
	//	digits = nbits * log[base 10](2)
	//  nbits = digits / log[base 10](2)
	//
	// So we need to account for our scale since we're going to be multiplying
	// by 10^scale in order to get the integral value we're actually going to use
	// So to get our number of bits we do:
	//
	// 	(prec + scale + 1) / log[base10](2)
	//
	// Finally, we still have a sign bit, so we -1 to account for the sign bit.
	// Aren't floating point numbers fun?
	var precInBits = uint(math.Round(float64(prec+scale+1)/math.Log10(2))) + 1

	var out *big.Float
	out, _, err = big.ParseFloat(v, 10, 128, big.ToNearestEven)
	if err != nil {
		return
	}

	if scale < 0 {
		var tmp big.Int
		val, _ := out.Int(&tmp)
		if val.BitLen() > 127 {
			return Num{}, errors.New("bitlen too large for decimal128")
		}
		n = FromBigInt(val)
		n, _ = n.Div(scaleMultipliers[-scale])
	} else {
		// Since we're going to truncate this to get an integer, we need to round
		// the value instead because of edge cases so that we match how other implementations
		// (e.g. C++) handles Decimal values. So if we're negative we'll subtract 0.5 and if
		// we're positive we'll add 0.5.
		p := (&big.Float{}).SetInt(scaleMultipliers[scale].BigInt())
		out.SetPrec(precInBits).Mul(out, p)
		if out.Signbit() {
			out.Sub(out, pt5)
		} else {
			out.Add(out, pt5)
		}

		var tmp big.Int
		val, _ := out.Int(&tmp)
		if val.BitLen() > 127 {
			return Num{}, errors.New("bitlen too large for decimal128")
		}
		n = FromBigInt(val)
	}

	if !n.FitsInPrecision(prec) {
		err = fmt.Errorf("val %v doesn't fit in precision %d", n, prec)
	}
	return
}

// ToFloat32 returns a float32 value representative of this decimal128.Num,
// but with the given scale.
func (n Num) ToFloat32(scale int32) float32 {
	return float32(n.ToFloat64(scale))
}

func (n Num) tofloat64Positive(scale int32) float64 {
	const twoTo64 float64 = 1.8446744073709552e+19
	x := float64(n.hi) * twoTo64
	x += float64(n.lo)
	if scale >= -38 && scale <= 38 {
		return x * float64PowersOfTen[-scale+38]
	}

	return x * math.Pow10(-int(scale))
}

// ToFloat64 returns a float64 value representative of this decimal128.Num,
// but with the given scale.
func (n Num) ToFloat64(scale int32) float64 {
	if n.hi < 0 {
		return -n.Negate().tofloat64Positive(scale)
	}
	return n.tofloat64Positive(scale)
}

func (n Num) ToBigFloat(scale int32) *big.Float {
	f := (&big.Float{}).SetInt(n.BigInt())
	if scale < 0 {
		f.SetPrec(128).Mul(f, (&big.Float{}).SetInt(scaleMultipliers[-scale].BigInt()))
	} else {
		f.SetPrec(128).Quo(f, (&big.Float{}).SetInt(scaleMultipliers[scale].BigInt()))
	}
	return f
}

// LowBits returns the low bits of the two's complement representation of the number.
func (n Num) LowBits() uint64 { return n.lo }

// HighBits returns the high bits of the two's complement representation of the number.
func (n Num) HighBits() int64 { return n.hi }

// Sign returns:
//
// -1 if x <  0
//
//	0 if x == 0
//
// +1 if x >  0
func (n Num) Sign() int {
	if n == (Num{}) {
		return 0
	}
	return int(1 | (n.hi >> 63))
}

func toBigIntPositive(n Num) *big.Int {
	return (&big.Int{}).SetBits([]big.Word{big.Word(n.lo), big.Word(n.hi)})
}

// while the code would be simpler to just do lsh/rsh and add
// it turns out from benchmarking that calling SetBits passing
// in the words and negating ends up being >2x faster
func (n Num) BigInt() *big.Int {
	if n.Sign() < 0 {
		b := toBigIntPositive(n.Negate())
		return b.Neg(b)
	}
	return toBigIntPositive(n)
}

// Greater returns true if the value represented by n is > other
func (n Num) Greater(other Num) bool {
	return other.Less(n)
}

// GreaterEqual returns true if the value represented by n is >= other
func (n Num) GreaterEqual(other Num) bool {
	return !n.Less(other)
}

// Less returns true if the value represented by n is < other
func (n Num) Less(other Num) bool {
	return n.hi < other.hi || (n.hi == other.hi && n.lo < other.lo)
}

// LessEqual returns true if the value represented by n is <= other
func (n Num) LessEqual(other Num) bool {
	return !n.Greater(other)
}

// Max returns the largest Decimal128 that was passed in the arguments
func Max(first Num, rest ...Num) Num {
	answer := first
	for _, number := range rest {
		if number.Greater(answer) {
			answer = number
		}
	}
	return answer
}

// Min returns the smallest Decimal128 that was passed in the arguments
func Min(first Num, rest ...Num) Num {
	answer := first
	for _, number := range rest {
		if number.Less(answer) {
			answer = number
		}
	}
	return answer
}

// Cmp compares the numbers represented by n and other and returns:
//
//	+1 if n > other
//	 0 if n == other
//	-1 if n < other
func (n Num) Cmp(other Num) int {
	switch {
	case n.Greater(other):
		return 1
	case n.Less(other):
		return -1
	}
	return 0
}

// IncreaseScaleBy returns a new decimal128.Num with the value scaled up by
// the desired amount. Must be 0 <= increase <= 38. Any data loss from scaling
// is ignored. If you wish to prevent data loss, use Rescale which will
// return an error if data loss is detected.
func (n Num) IncreaseScaleBy(increase int32) Num {
	debug.Assert(increase >= 0, "invalid increase scale for decimal128")
	debug.Assert(increase <= 38, "invalid increase scale for decimal128")

	v := scaleMultipliers[increase].BigInt()
	return FromBigInt(v.Mul(n.BigInt(), v))
}

// ReduceScaleBy returns a new decimal128.Num with the value scaled down by
// the desired amount and, if 'round' is true, the value will be rounded
// accordingly. Assumes 0 <= reduce <= 38. Any data loss from scaling
// is ignored. If you wish to prevent data loss, use Rescale which will
// return an error if data loss is detected.
func (n Num) ReduceScaleBy(reduce int32, round bool) Num {
	debug.Assert(reduce >= 0, "invalid reduce scale for decimal128")
	debug.Assert(reduce <= 38, "invalid reduce scale for decimal128")

	if reduce == 0 {
		return n
	}

	divisor := scaleMultipliers[reduce].BigInt()
	result, remainder := divisor.QuoRem(n.BigInt(), divisor, (&big.Int{}))
	if round {
		divisorHalf := scaleMultipliersHalf[reduce]
		if remainder.Abs(remainder).Cmp(divisorHalf.BigInt()) != -1 {
			result.Add(result, big.NewInt(int64(n.Sign())))
		}
	}
	return FromBigInt(result)
}

func (n Num) rescaleWouldCauseDataLoss(deltaScale int32, multiplier Num) (out Num, loss bool) {
	var (
		value, result, remainder *big.Int
	)
	value = n.BigInt()
	if deltaScale < 0 {
		debug.Assert(multiplier.lo != 0 || multiplier.hi != 0, "multiplier needs to not be zero")
		result, remainder = (&big.Int{}).QuoRem(value, multiplier.BigInt(), (&big.Int{}))
		return FromBigInt(result), remainder.Cmp(big.NewInt(0)) != 0
	}

	result = (&big.Int{}).Mul(value, multiplier.BigInt())
	out = FromBigInt(result)
	cmp := result.Cmp(value)
	if n.Sign() < 0 {
		loss = cmp == 1
	} else {
		loss = cmp == -1
	}
	return
}

// Rescale returns a new decimal128.Num with the value updated assuming
// the current value is scaled to originalScale with the new value scaled
// to newScale. If rescaling this way would cause data loss, an error is
// returned instead.
func (n Num) Rescale(originalScale, newScale int32) (out Num, err error) {
	if originalScale == newScale {
		return n, nil
	}

	deltaScale := newScale - originalScale
	absDeltaScale := int32(math.Abs(float64(deltaScale)))

	multiplier := scaleMultipliers[absDeltaScale]
	var wouldHaveLoss bool
	out, wouldHaveLoss = n.rescaleWouldCauseDataLoss(deltaScale, multiplier)
	if wouldHaveLoss {
		err = errors.New("rescale data loss")
	}
	return
}

// Abs returns a new decimal128.Num that contains the absolute value of n
func (n Num) Abs() Num {
	switch n.Sign() {
	case -1:
		return n.Negate()
	}
	return n
}

// FitsInPrecision returns true or false if the value currently held by
// n would fit within precision (0 < prec <= 38) without losing any data.
func (n Num) FitsInPrecision(prec int32) bool {
	debug.Assert(prec > 0, "precision must be > 0")
	debug.Assert(prec <= 38, "precision must be <= 38")
	return n.Abs().Less(scaleMultipliers[prec])
}

func (n Num) ToString(scale int32) string {
	f := (&big.Float{}).SetInt(n.BigInt())
	if scale < 0 {
		f.SetPrec(128).Mul(f, (&big.Float{}).SetInt(scaleMultipliers[-scale].BigInt()))
	} else {
		f.SetPrec(128).Quo(f, (&big.Float{}).SetInt(scaleMultipliers[scale].BigInt()))
	}
	return f.Text('f', int(scale))
}

func GetScaleMultiplier(pow int) Num { return scaleMultipliers[pow] }

func GetHalfScaleMultiplier(pow int) Num { return scaleMultipliersHalf[pow] }

var (
	scaleMultipliers = [...]Num{
		FromU64(1),
		FromU64(10),
		FromU64(100),
		FromU64(1000),
		FromU64(10000),
		FromU64(100000),
		FromU64(1000000),
		FromU64(10000000),
		FromU64(100000000),
		FromU64(1000000000),
		FromU64(10000000000),
		FromU64(100000000000),
		FromU64(1000000000000),
		FromU64(10000000000000),
		FromU64(100000000000000),
		FromU64(1000000000000000),
		FromU64(10000000000000000),
		FromU64(100000000000000000),
		FromU64(1000000000000000000),
		New(0, 10000000000000000000),
		New(5, 7766279631452241920),
		New(54, 3875820019684212736),
		New(542, 1864712049423024128),
		New(5421, 200376420520689664),
		New(54210, 2003764205206896640),
		New(542101, 1590897978359414784),
		New(5421010, 15908979783594147840),
		New(54210108, 11515845246265065472),
		New(542101086, 4477988020393345024),
		New(5421010862, 7886392056514347008),
		New(54210108624, 5076944270305263616),
		New(542101086242, 13875954555633532928),
		New(5421010862427, 9632337040368467968),
		New(54210108624275, 4089650035136921600),
		New(542101086242752, 4003012203950112768),
		New(5421010862427522, 3136633892082024448),
		New(54210108624275221, 12919594847110692864),
		New(542101086242752217, 68739955140067328),
		New(5421010862427522170, 687399551400673280),
	}

	scaleMultipliersHalf = [...]Num{
		FromU64(0),
		FromU64(5),
		FromU64(50),
		FromU64(500),
		FromU64(5000),
		FromU64(50000),
		FromU64(500000),
		FromU64(5000000),
		FromU64(50000000),
		FromU64(500000000),
		FromU64(5000000000),
		FromU64(50000000000),
		FromU64(500000000000),
		FromU64(5000000000000),
		FromU64(50000000000000),
		FromU64(500000000000000),
		FromU64(5000000000000000),
		FromU64(50000000000000000),
		FromU64(500000000000000000),
		FromU64(5000000000000000000),
		New(2, 13106511852580896768),
		New(27, 1937910009842106368),
		New(271, 932356024711512064),
		New(2710, 9323560247115120640),
		New(27105, 1001882102603448320),
		New(271050, 10018821026034483200),
		New(2710505, 7954489891797073920),
		New(27105054, 5757922623132532736),
		New(271050543, 2238994010196672512),
		New(2710505431, 3943196028257173504),
		New(27105054312, 2538472135152631808),
		New(271050543121, 6937977277816766464),
		New(2710505431213, 14039540557039009792),
		New(27105054312137, 11268197054423236608),
		New(271050543121376, 2001506101975056384),
		New(2710505431213761, 1568316946041012224),
		New(27105054312137610, 15683169460410122240),
		New(271050543121376108, 9257742014424809472),
		New(2710505431213761085, 343699775700336640),
	}

	float64PowersOfTen = [...]float64{
		1e-38, 1e-37, 1e-36, 1e-35, 1e-34, 1e-33, 1e-32, 1e-31, 1e-30, 1e-29,
		1e-28, 1e-27, 1e-26, 1e-25, 1e-24, 1e-23, 1e-22, 1e-21, 1e-20, 1e-19,
		1e-18, 1e-17, 1e-16, 1e-15, 1e-14, 1e-13, 1e-12, 1e-11, 1e-10, 1e-9,
		1e-8, 1e-7, 1e-6, 1e-5, 1e-4, 1e-3, 1e-2, 1e-1, 1e0, 1e1,
		1e2, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10, 1e11,
		1e12, 1e13, 1e14, 1e15, 1e16, 1e17, 1e18, 1e19, 1e20, 1e21,
		1e22, 1e23, 1e24, 1e25, 1e26, 1e27, 1e28, 1e29, 1e30, 1e31,
		1e32, 1e33, 1e34, 1e35, 1e36, 1e37, 1e38,
	}
)
