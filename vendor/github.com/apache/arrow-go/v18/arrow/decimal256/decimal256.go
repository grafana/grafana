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

package decimal256

import (
	"errors"
	"fmt"
	"math"
	"math/big"
	"math/bits"

	"github.com/apache/arrow-go/v18/arrow/decimal128"
	"github.com/apache/arrow-go/v18/arrow/internal/debug"
)

const (
	MaxPrecision = 76
	MaxScale     = 76
)

func GetMaxValue(prec int32) Num {
	return scaleMultipliers[prec].Sub(FromU64(1))
}

type Num struct {
	// arr[0] is the lowest bits, arr[3] is the highest bits
	arr [4]uint64
}

// New returns a new signed 256-bit integer value where x1 contains
// the highest bits with the rest of the values in order down to the
// lowest bits
//
//	ie: New(1, 2, 3, 4) returns with the elements in little-endian order
//	    {4, 3, 2, 1} but each value is still represented as the native endianness
func New(x1, x2, x3, x4 uint64) Num {
	return Num{[4]uint64{x4, x3, x2, x1}}
}

func (n Num) Array() [4]uint64 { return n.arr }

func (n Num) LowBits() uint64 { return n.arr[0] }

func FromDecimal128(n decimal128.Num) Num {
	var topBits uint64
	if n.Sign() < 0 {
		topBits = math.MaxUint64
	}
	return New(topBits, topBits, uint64(n.HighBits()), n.LowBits())
}

func FromU64(v uint64) Num {
	return Num{[4]uint64{v, 0, 0, 0}}
}

func FromI64(v int64) Num {
	switch {
	case v > 0:
		return New(0, 0, 0, uint64(v))
	case v < 0:
		return New(math.MaxUint64, math.MaxUint64, math.MaxUint64, uint64(v))
	default:
		return Num{}
	}
}

func (n Num) Negate() Num {
	var carry uint64 = 1
	for i := range n.arr {
		n.arr[i] = ^n.arr[i] + carry
		if n.arr[i] != 0 {
			carry = 0
		}
	}
	return n
}

func (n Num) Add(rhs Num) Num {
	var carry uint64
	for i, v := range n.arr {
		n.arr[i], carry = bits.Add64(v, rhs.arr[i], carry)
	}
	return n
}

func (n Num) Sub(rhs Num) Num {
	return n.Add(rhs.Negate())
}

func (n Num) Mul(rhs Num) Num {
	b := n.BigInt()
	return FromBigInt(b.Mul(b, rhs.BigInt()))
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
	out, _, err = big.ParseFloat(v, 10, 255, big.ToNearestEven)
	if err != nil {
		return
	}

	if scale < 0 {
		var tmp big.Int
		val, _ := out.Int(&tmp)
		if val.BitLen() > 255 {
			return Num{}, errors.New("bitlen too large for decimal256")
		}
		n = FromBigInt(val)

		n, _ = n.Div(scaleMultipliers[-scale])
	} else {
		out.Mul(out, (&big.Float{}).SetInt(scaleMultipliers[scale].BigInt())).SetPrec(precInBits)
		// Since we're going to truncate this to get an integer, we need to round
		// the value instead because of edge cases so that we match how other implementations
		// (e.g. C++) handles Decimal values. So if we're negative we'll subtract 0.5 and if
		// we're positive we'll add 0.5.
		if out.Signbit() {
			out.Sub(out, pt5)
		} else {
			out.Add(out, pt5)
		}

		var tmp big.Int
		val, _ := out.Int(&tmp)
		if val.BitLen() > 255 {
			return Num{}, errors.New("bitlen too large for decimal256")
		}
		n = FromBigInt(val)
	}
	if !n.FitsInPrecision(prec) {
		err = fmt.Errorf("value %v doesn't fit in precision %d", n, prec)
	}
	return
}

func FromFloat32(v float32, prec, scale int32) (Num, error) {
	debug.Assert(prec > 0 && prec <= 76, "invalid precision for converting to decimal256")

	if math.IsInf(float64(v), 0) {
		return Num{}, fmt.Errorf("cannot convert %f to decimal256", v)
	}

	if v < 0 {
		dec, err := fromPositiveFloat32(-v, prec, scale)
		if err != nil {
			return dec, err
		}
		return dec.Negate(), nil
	}
	return fromPositiveFloat32(v, prec, scale)
}

func FromFloat64(v float64, prec, scale int32) (Num, error) {
	debug.Assert(prec > 0 && prec <= 76, "invalid precision for converting to decimal256")

	if math.IsInf(v, 0) {
		return Num{}, fmt.Errorf("cannot convert %f to decimal256", v)
	}

	if v < 0 {
		dec, err := fromPositiveFloat64(-v, prec, scale)
		if err != nil {
			return dec, err
		}
		return dec.Negate(), nil
	}
	return fromPositiveFloat64(v, prec, scale)
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

	v = float32(val)
	var arr [4]float32
	arr[3] = float32(math.Floor(math.Ldexp(float64(v), -192)))
	v -= float32(math.Ldexp(float64(arr[3]), 192))
	arr[2] = float32(math.Floor(math.Ldexp(float64(v), -128)))
	v -= float32(math.Ldexp(float64(arr[2]), 128))
	arr[1] = float32(math.Floor(math.Ldexp(float64(v), -64)))
	v -= float32(math.Ldexp(float64(arr[1]), 64))
	arr[0] = v

	debug.Assert(arr[3] >= 0, "bad conversion float64 to decimal256")
	debug.Assert(arr[3] < 1.8446744073709552e+19, "bad conversion float64 to decimal256") // 2**64
	debug.Assert(arr[2] >= 0, "bad conversion float64 to decimal256")
	debug.Assert(arr[2] < 1.8446744073709552e+19, "bad conversion float64 to decimal256") // 2**64
	debug.Assert(arr[1] >= 0, "bad conversion float64 to decimal256")
	debug.Assert(arr[1] < 1.8446744073709552e+19, "bad conversion float64 to decimal256") // 2**64
	debug.Assert(arr[0] >= 0, "bad conversion float64 to decimal256")
	debug.Assert(arr[0] < 1.8446744073709552e+19, "bad conversion float64 to decimal256") // 2**64
	return Num{[4]uint64{uint64(arr[0]), uint64(arr[1]), uint64(arr[2]), uint64(arr[3])}}, nil
}

func scalePositiveFloat64(v float64, prec, scale int32) (float64, error) {
	var pscale float64
	if scale >= -76 && scale <= 76 {
		pscale = float64PowersOfTen[scale+76]
	} else {
		pscale = math.Pow10(int(scale))
	}

	v *= pscale
	v = math.RoundToEven(v)
	maxabs := float64PowersOfTen[prec+76]
	if v <= -maxabs || v >= maxabs {
		return 0, fmt.Errorf("cannot convert %f to decimal256(precision=%d, scale=%d): overflow",
			v, prec, scale)
	}
	return v, nil
}

func fromPositiveFloat64(v float64, prec, scale int32) (Num, error) {
	val, err := scalePositiveFloat64(v, prec, scale)
	if err != nil {
		return Num{}, err
	}

	var arr [4]float64
	arr[3] = math.Floor(math.Ldexp(val, -192))
	val -= math.Ldexp(arr[3], 192)
	arr[2] = math.Floor(math.Ldexp(val, -128))
	val -= math.Ldexp(arr[2], 128)
	arr[1] = math.Floor(math.Ldexp(val, -64))
	val -= math.Ldexp(arr[1], 64)
	arr[0] = val

	debug.Assert(arr[3] >= 0, "bad conversion float64 to decimal256")
	debug.Assert(arr[3] < 1.8446744073709552e+19, "bad conversion float64 to decimal256") // 2**64
	debug.Assert(arr[2] >= 0, "bad conversion float64 to decimal256")
	debug.Assert(arr[2] < 1.8446744073709552e+19, "bad conversion float64 to decimal256") // 2**64
	debug.Assert(arr[1] >= 0, "bad conversion float64 to decimal256")
	debug.Assert(arr[1] < 1.8446744073709552e+19, "bad conversion float64 to decimal256") // 2**64
	debug.Assert(arr[0] >= 0, "bad conversion float64 to decimal256")
	debug.Assert(arr[0] < 1.8446744073709552e+19, "bad conversion float64 to decimal256") // 2**64
	return Num{[4]uint64{uint64(arr[0]), uint64(arr[1]), uint64(arr[2]), uint64(arr[3])}}, nil
}

func (n Num) tofloat64Positive(scale int32) float64 {
	const (
		twoTo64  float64 = 1.8446744073709552e+19
		twoTo128 float64 = 3.402823669209385e+38
		twoTo192 float64 = 6.277101735386681e+57
	)

	x := float64(n.arr[3]) * twoTo192
	x += float64(n.arr[2]) * twoTo128
	x += float64(n.arr[1]) * twoTo64
	x += float64(n.arr[0])

	if scale >= -76 && scale <= 76 {
		return x * float64PowersOfTen[-scale+76]
	}

	return x * math.Pow10(-int(scale))
}

func (n Num) ToFloat32(scale int32) float32 { return float32(n.ToFloat64(scale)) }

func (n Num) ToFloat64(scale int32) float64 {
	if n.Sign() < 0 {
		return -n.Negate().tofloat64Positive(scale)
	}
	return n.tofloat64Positive(scale)
}

func (n Num) ToBigFloat(scale int32) *big.Float {
	f := (&big.Float{}).SetInt(n.BigInt())
	if scale < 0 {
		f.SetPrec(256).Mul(f, (&big.Float{}).SetInt(scaleMultipliers[-scale].BigInt()))
	} else {
		f.SetPrec(256).Quo(f, (&big.Float{}).SetInt(scaleMultipliers[scale].BigInt()))
	}
	return f
}

func (n Num) Sign() int {
	if n == (Num{}) {
		return 0
	}
	return int(1 | (int64(n.arr[3]) >> 63))
}

func FromBigInt(v *big.Int) (n Num) {
	bitlen := v.BitLen()
	if bitlen > 255 {
		panic("arrow/decimal256: cannot represent value larger than 256bits")
	} else if bitlen == 0 {
		return
	}

	b := v.Bits()
	for i, bits := range b {
		n.arr[i] = uint64(bits)
	}
	if v.Sign() < 0 {
		return n.Negate()
	}
	return
}

func toBigIntPositive(n Num) *big.Int {
	return new(big.Int).SetBits([]big.Word{big.Word(n.arr[0]), big.Word(n.arr[1]), big.Word(n.arr[2]), big.Word(n.arr[3])})
}

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
	switch {
	case n.arr[3] != other.arr[3]:
		return int64(n.arr[3]) < int64(other.arr[3])
	case n.arr[2] != other.arr[2]:
		return n.arr[2] < other.arr[2]
	case n.arr[1] != other.arr[1]:
		return n.arr[1] < other.arr[1]
	}
	return n.arr[0] < other.arr[0]
}

// LessEqual returns true if the value represented by n is <= other
func (n Num) LessEqual(other Num) bool {
	return !n.Greater(other)
}

// Max returns the largest Decimal256 that was passed in the arguments
func Max(first Num, rest ...Num) Num {
	answer := first
	for _, number := range rest {
		if number.Greater(answer) {
			answer = number
		}
	}
	return answer
}

// Min returns the smallest Decimal256 that was passed in the arguments
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

func (n Num) IncreaseScaleBy(increase int32) Num {
	debug.Assert(increase >= 0, "invalid amount to increase scale by")
	debug.Assert(increase <= 76, "invalid amount to increase scale by")

	v := scaleMultipliers[increase].BigInt()
	return FromBigInt(v.Mul(n.BigInt(), v))
}

func (n Num) ReduceScaleBy(reduce int32, round bool) Num {
	debug.Assert(reduce >= 0, "invalid amount to reduce scale by")
	debug.Assert(reduce <= 76, "invalid amount to reduce scale by")

	if reduce == 0 {
		return n
	}

	divisor := scaleMultipliers[reduce].BigInt()
	result, remainder := divisor.QuoRem(n.BigInt(), divisor, new(big.Int))
	if round {
		divisorHalf := scaleMultipliersHalf[reduce]
		if remainder.Abs(remainder).Cmp(divisorHalf.BigInt()) != -1 {
			result.Add(result, big.NewInt(int64(n.Sign())))
		}
	}
	return FromBigInt(result)
}

func (n Num) rescaleWouldCauseDataLoss(deltaScale int32, multiplier Num) (out Num, loss bool) {
	if deltaScale < 0 {
		var remainder Num
		out, remainder = n.Div(multiplier)
		return out, remainder != Num{}
	}

	out = n.Mul(multiplier)
	if n.Sign() < 0 {
		loss = n.Less(out)
	} else {
		loss = out.Less(n)
	}
	return
}

func (n Num) Rescale(original, newscale int32) (out Num, err error) {
	if original == newscale {
		return n, nil
	}

	deltaScale := newscale - original
	absDeltaScale := int32(math.Abs(float64(deltaScale)))

	multiplier := scaleMultipliers[absDeltaScale]
	var wouldHaveLoss bool
	out, wouldHaveLoss = n.rescaleWouldCauseDataLoss(deltaScale, multiplier)
	if wouldHaveLoss {
		err = errors.New("rescale data loss")
	}
	return
}

func (n Num) Abs() Num {
	switch n.Sign() {
	case -1:
		return n.Negate()
	}
	return n
}

func (n Num) FitsInPrecision(prec int32) bool {
	debug.Assert(prec > 0, "precision must be > 0")
	debug.Assert(prec <= 76, "precision must be <= 76")
	return n.Abs().Less(scaleMultipliers[prec])
}

func (n Num) ToString(scale int32) string {
	f := (&big.Float{}).SetInt(n.BigInt())
	if scale < 0 {
		f.SetPrec(256).Mul(f, (&big.Float{}).SetInt(scaleMultipliers[-scale].BigInt()))
	} else {
		f.SetPrec(256).Quo(f, (&big.Float{}).SetInt(scaleMultipliers[scale].BigInt()))
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
		New(0, 0, 0, 10000000000000000000),
		New(0, 0, 5, 7766279631452241920),
		New(0, 0, 54, 3875820019684212736),
		New(0, 0, 542, 1864712049423024128),
		New(0, 0, 5421, 200376420520689664),
		New(0, 0, 54210, 2003764205206896640),
		New(0, 0, 542101, 1590897978359414784),
		New(0, 0, 5421010, 15908979783594147840),
		New(0, 0, 54210108, 11515845246265065472),
		New(0, 0, 542101086, 4477988020393345024),
		New(0, 0, 5421010862, 7886392056514347008),
		New(0, 0, 54210108624, 5076944270305263616),
		New(0, 0, 542101086242, 13875954555633532928),
		New(0, 0, 5421010862427, 9632337040368467968),
		New(0, 0, 54210108624275, 4089650035136921600),
		New(0, 0, 542101086242752, 4003012203950112768),
		New(0, 0, 5421010862427522, 3136633892082024448),
		New(0, 0, 54210108624275221, 12919594847110692864),
		New(0, 0, 542101086242752217, 68739955140067328),
		New(0, 0, 5421010862427522170, 687399551400673280),
		New(0, 2, 17316620476856118468, 6873995514006732800),
		New(0, 29, 7145508105175220139, 13399722918938673152),
		New(0, 293, 16114848830623546549, 4870020673419870208),
		New(0, 2938, 13574535716559052564, 11806718586779598848),
		New(0, 29387, 6618148649623664334, 7386721425538678784),
		New(0, 293873, 10841254275107988496, 80237960548581376),
		New(0, 2938735, 16178822382532126880, 802379605485813760),
		New(0, 29387358, 14214271235644855872, 8023796054858137600),
		New(0, 293873587, 13015503840481697412, 6450984253743169536),
		New(0, 2938735877, 1027829888850112811, 9169610316303040512),
		New(0, 29387358770, 10278298888501128114, 17909126868192198656),
		New(0, 293873587705, 10549268516463523069, 13070572018536022016),
		New(0, 2938735877055, 13258964796087472617, 1578511669393358848),
		New(0, 29387358770557, 3462439444907864858, 15785116693933588480),
		New(0, 293873587705571, 16177650375369096972, 10277214349659471872),
		New(0, 2938735877055718, 14202551164014556797, 10538423128046960640),
		New(0, 29387358770557187, 12898303124178706663, 13150510911921848320),
		New(0, 293873587705571876, 18302566799529756941, 2377900603251621888),
		New(0, 2938735877055718769, 17004971331911604867, 5332261958806667264),
		New(1, 10940614696847636083, 4029016655730084128, 16429131440647569408),
		New(15, 17172426599928602752, 3396678409881738056, 16717361816799281152),
		New(159, 5703569335900062977, 15520040025107828953, 1152921504606846976),
		New(1593, 1695461137871974930, 7626447661401876602, 11529215046068469760),
		New(15930, 16954611378719749304, 2477500319180559562, 4611686018427387904),
		New(159309, 3525417123811528497, 6328259118096044006, 9223372036854775808),
		New(1593091, 16807427164405733357, 7942358959831785217, 0),
		New(15930919, 2053574980671369030, 5636613303479645706, 0),
		New(159309191, 2089005733004138687, 1025900813667802212, 0),
		New(1593091911, 2443313256331835254, 10259008136678022120, 0),
		New(15930919111, 5986388489608800929, 10356360998232463120, 0),
		New(159309191113, 4523652674959354447, 11329889613776873120, 0),
		New(1593091911132, 8343038602174441244, 2618431695511421504, 0),
		New(15930919111324, 9643409726906205977, 7737572881404663424, 0),
		New(159309191113245, 4200376900514301694, 3588752519208427776, 0),
		New(1593091911132452, 5110280857723913709, 17440781118374726144, 0),
		New(15930919111324522, 14209320429820033867, 8387114520361296896, 0),
		New(159309191113245227, 12965995782233477362, 10084168908774762496, 0),
		New(1593091911132452277, 532749306367912313, 8607968719199866880, 0),
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
		New(0, 0, 2, 13106511852580896768),
		New(0, 0, 27, 1937910009842106368),
		New(0, 0, 271, 932356024711512064),
		New(0, 0, 2710, 9323560247115120640),
		New(0, 0, 27105, 1001882102603448320),
		New(0, 0, 271050, 10018821026034483200),
		New(0, 0, 2710505, 7954489891797073920),
		New(0, 0, 27105054, 5757922623132532736),
		New(0, 0, 271050543, 2238994010196672512),
		New(0, 0, 2710505431, 3943196028257173504),
		New(0, 0, 27105054312, 2538472135152631808),
		New(0, 0, 271050543121, 6937977277816766464),
		New(0, 0, 2710505431213, 14039540557039009792),
		New(0, 0, 27105054312137, 11268197054423236608),
		New(0, 0, 271050543121376, 2001506101975056384),
		New(0, 0, 2710505431213761, 1568316946041012224),
		New(0, 0, 27105054312137610, 15683169460410122240),
		New(0, 0, 271050543121376108, 9257742014424809472),
		New(0, 0, 2710505431213761085, 343699775700336640),
		New(0, 1, 8658310238428059234, 3436997757003366400),
		New(0, 14, 12796126089442385877, 15923233496324112384),
		New(0, 146, 17280796452166549082, 11658382373564710912),
		New(0, 1469, 6787267858279526282, 5903359293389799424),
		New(0, 14693, 12532446361666607975, 3693360712769339392),
		New(0, 146936, 14643999174408770056, 40118980274290688),
		New(0, 1469367, 17312783228120839248, 401189802742906880),
		New(0, 14693679, 7107135617822427936, 4011898027429068800),
		New(0, 146936793, 15731123957095624514, 3225492126871584768),
		New(0, 1469367938, 9737286981279832213, 13808177195006296064),
		New(0, 14693679385, 5139149444250564057, 8954563434096099328),
		New(0, 146936793852, 14498006295086537342, 15758658046122786816),
		New(0, 1469367938527, 15852854434898512116, 10012627871551455232),
		New(0, 14693679385278, 10954591759308708237, 7892558346966794240),
		New(0, 146936793852785, 17312197224539324294, 5138607174829735936),
		New(0, 1469367938527859, 7101275582007278398, 14492583600878256128),
		New(0, 14693679385278593, 15672523598944129139, 15798627492815699968),
		New(0, 146936793852785938, 9151283399764878470, 10412322338480586752),
		New(0, 1469367938527859384, 17725857702810578241, 11889503016258109440),
		New(0, 14693679385278593849, 11237880364719817872, 8214565720323784704),
		New(7, 17809585336819077184, 1698339204940869028, 8358680908399640576),
		New(79, 12075156704804807296, 16983392049408690284, 9799832789158199296),
		New(796, 10071102605790763273, 3813223830700938301, 5764607523034234880),
		New(7965, 8477305689359874652, 1238750159590279781, 2305843009213693952),
		New(79654, 10986080598760540056, 12387501595902797811, 4611686018427387904),
		New(796545, 17627085619057642486, 13194551516770668416, 9223372036854775808),
		New(7965459, 10250159527190460323, 2818306651739822853, 0),
		New(79654595, 10267874903356845151, 9736322443688676914, 0),
		New(796545955, 10445028665020693435, 5129504068339011060, 0),
		New(7965459555, 12216566281659176272, 14401552535971007368, 0),
		New(79654595556, 11485198374334453031, 14888316843743212368, 0),
		New(796545955566, 4171519301087220622, 1309215847755710752, 0),
		New(7965459555662, 4821704863453102988, 13092158477557107520, 0),
		New(79654595556622, 11323560487111926655, 1794376259604213888, 0),
		New(796545955566226, 2555140428861956854, 17943762596042138880, 0),
		New(7965459555662261, 7104660214910016933, 13416929297035424256, 0),
		New(79654595556622613, 15706369927971514489, 5042084454387381248, 0),
		New(796545955566226138, 9489746690038731964, 13527356396454709248, 0),
	}

	float64PowersOfTen = [...]float64{
		1e-76, 1e-75, 1e-74, 1e-73, 1e-72, 1e-71, 1e-70, 1e-69, 1e-68, 1e-67, 1e-66, 1e-65,
		1e-64, 1e-63, 1e-62, 1e-61, 1e-60, 1e-59, 1e-58, 1e-57, 1e-56, 1e-55, 1e-54, 1e-53,
		1e-52, 1e-51, 1e-50, 1e-49, 1e-48, 1e-47, 1e-46, 1e-45, 1e-44, 1e-43, 1e-42, 1e-41,
		1e-40, 1e-39, 1e-38, 1e-37, 1e-36, 1e-35, 1e-34, 1e-33, 1e-32, 1e-31, 1e-30, 1e-29,
		1e-28, 1e-27, 1e-26, 1e-25, 1e-24, 1e-23, 1e-22, 1e-21, 1e-20, 1e-19, 1e-18, 1e-17,
		1e-16, 1e-15, 1e-14, 1e-13, 1e-12, 1e-11, 1e-10, 1e-9, 1e-8, 1e-7, 1e-6, 1e-5,
		1e-4, 1e-3, 1e-2, 1e-1, 1e0, 1e1, 1e2, 1e3, 1e4, 1e5, 1e6, 1e7,
		1e8, 1e9, 1e10, 1e11, 1e12, 1e13, 1e14, 1e15, 1e16, 1e17, 1e18, 1e19,
		1e20, 1e21, 1e22, 1e23, 1e24, 1e25, 1e26, 1e27, 1e28, 1e29, 1e30, 1e31,
		1e32, 1e33, 1e34, 1e35, 1e36, 1e37, 1e38, 1e39, 1e40, 1e41, 1e42, 1e43,
		1e44, 1e45, 1e46, 1e47, 1e48, 1e49, 1e50, 1e51, 1e52, 1e53, 1e54, 1e55,
		1e56, 1e57, 1e58, 1e59, 1e60, 1e61, 1e62, 1e63, 1e64, 1e65, 1e66, 1e67,
		1e68, 1e69, 1e70, 1e71, 1e72, 1e73, 1e74, 1e75, 1e76,
	}
)
