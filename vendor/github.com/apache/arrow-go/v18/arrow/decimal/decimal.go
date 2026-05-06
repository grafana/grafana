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

package decimal

import (
	"errors"
	"fmt"
	"math"
	"math/big"
	"math/bits"
	"unsafe"

	"github.com/apache/arrow-go/v18/arrow/decimal128"
	"github.com/apache/arrow-go/v18/arrow/decimal256"
	"github.com/apache/arrow-go/v18/arrow/internal/debug"
)

// DecimalTypes is a generic constraint representing the implemented decimal types
// in this package, and a single point of update for future additions. Everything
// else is constrained by this.
type DecimalTypes interface {
	Decimal32 | Decimal64 | Decimal128 | Decimal256
}

// Num is an interface that is useful for building generic types for all decimal
// type implementations. It presents all the methods and interfaces necessary to
// operate on the decimal objects without having to care about the bit width.
type Num[T DecimalTypes] interface {
	Negate() T
	Add(T) T
	Sub(T) T
	Mul(T) T
	Div(T) (res, rem T)
	Pow(T) T

	FitsInPrecision(int32) bool
	Abs() T
	Sign() int
	Rescale(int32, int32) (T, error)
	Cmp(T) int

	IncreaseScaleBy(int32) T
	ReduceScaleBy(int32, bool) T

	ToFloat32(int32) float32
	ToFloat64(int32) float64
	ToBigFloat(int32) *big.Float

	ToString(int32) string
}

type (
	Decimal32  int32
	Decimal64  int64
	Decimal128 = decimal128.Num
	Decimal256 = decimal256.Num
)

func MaxPrecision[T DecimalTypes]() int {
	// max precision is computed by Floor(log10(2^(nbytes * 8 - 1) - 1))
	var z T
	return int(math.Floor(math.Log10(math.Pow(2, float64(unsafe.Sizeof(z))*8-1) - 1)))
}

func (d Decimal32) Negate() Decimal32 { return -d }
func (d Decimal64) Negate() Decimal64 { return -d }

func (d Decimal32) Add(rhs Decimal32) Decimal32 { return d + rhs }
func (d Decimal64) Add(rhs Decimal64) Decimal64 { return d + rhs }

func (d Decimal32) Sub(rhs Decimal32) Decimal32 { return d - rhs }
func (d Decimal64) Sub(rhs Decimal64) Decimal64 { return d - rhs }

func (d Decimal32) Mul(rhs Decimal32) Decimal32 { return d * rhs }
func (d Decimal64) Mul(rhs Decimal64) Decimal64 { return d * rhs }

func (d Decimal32) Div(rhs Decimal32) (res, rem Decimal32) {
	return d / rhs, d % rhs
}

func (d Decimal64) Div(rhs Decimal64) (res, rem Decimal64) {
	return d / rhs, d % rhs
}

// about 4-5x faster than using math.Pow which requires converting to float64
// and back to integers
func intPow[T int32 | int64](base, exp T) T {
	result := T(1)
	for {
		if exp&1 == 1 {
			result *= base
		}
		exp >>= 1
		if exp == 0 {
			break
		}
		base *= base
	}

	return result
}

func (d Decimal32) Pow(rhs Decimal32) Decimal32 {
	return Decimal32(intPow(int32(d), int32(rhs)))
}

func (d Decimal64) Pow(rhs Decimal64) Decimal64 {
	return Decimal64(intPow(int64(d), int64(rhs)))
}

func (d Decimal32) Sign() int {
	if d == 0 {
		return 0
	}
	return int(1 | (d >> 31))
}

func (d Decimal64) Sign() int {
	if d == 0 {
		return 0
	}
	return int(1 | (d >> 63))
}

func (n Decimal32) Abs() Decimal32 {
	if n < 0 {
		return -n
	}
	return n
}

func (n Decimal64) Abs() Decimal64 {
	if n < 0 {
		return -n
	}
	return n
}

func (n Decimal32) FitsInPrecision(prec int32) bool {
	debug.Assert(prec > 0, "precision must be > 0")
	debug.Assert(prec <= 9, "precision must be <= 9")
	return n.Abs() < Decimal32(math.Pow10(int(prec)))
}

func (n Decimal64) FitsInPrecision(prec int32) bool {
	debug.Assert(prec > 0, "precision must be > 0")
	debug.Assert(prec <= 18, "precision must be <= 18")
	return n.Abs() < Decimal64(math.Pow10(int(prec)))
}

func (n Decimal32) ToString(scale int32) string {
	return n.ToBigFloat(scale).Text('f', int(scale))
}

func (n Decimal64) ToString(scale int32) string {
	return n.ToBigFloat(scale).Text('f', int(scale))
}

var pt5 = big.NewFloat(0.5)

func decimalFromString[T interface {
	Decimal32 | Decimal64
	FitsInPrecision(int32) bool
}](v string, prec, scale int32) (n T, err error) {
	var nbits = uint(unsafe.Sizeof(T(0))) * 8

	var out *big.Float
	out, _, err = big.ParseFloat(v, 10, nbits, big.ToNearestEven)

	if scale < 0 {
		var tmp big.Int
		val, _ := out.Int(&tmp)
		if val.BitLen() > int(nbits) {
			return n, fmt.Errorf("bitlen too large for decimal%d", nbits)
		}

		n = T(val.Int64() / int64(math.Pow10(int(-scale))))
	} else {
		var precInBits = uint(math.Round(float64(prec+scale+1)/math.Log10(2))) + 1

		p := (&big.Float{}).SetInt(big.NewInt(int64(math.Pow10(int(scale)))))
		out.SetPrec(precInBits).Mul(out, p)
		if out.Signbit() {
			out.Sub(out, pt5)
		} else {
			out.Add(out, pt5)
		}

		var tmp big.Int
		val, _ := out.Int(&tmp)
		if val.BitLen() > int(nbits) {
			return n, fmt.Errorf("bitlen too large for decimal%d", nbits)
		}
		n = T(val.Int64())
	}

	if !n.FitsInPrecision(prec) {
		err = fmt.Errorf("val %v doesn't fit in precision %d", n, prec)
	}
	return
}

func Decimal32FromString(v string, prec, scale int32) (n Decimal32, err error) {
	return decimalFromString[Decimal32](v, prec, scale)
}

func Decimal64FromString(v string, prec, scale int32) (n Decimal64, err error) {
	return decimalFromString[Decimal64](v, prec, scale)
}

func Decimal128FromString(v string, prec, scale int32) (n Decimal128, err error) {
	return decimal128.FromString(v, prec, scale)
}

func Decimal256FromString(v string, prec, scale int32) (n Decimal256, err error) {
	return decimal256.FromString(v, prec, scale)
}

func scalePositiveFloat64(v float64, prec, scale int32) (float64, error) {
	v *= math.Pow10(int(scale))
	v = math.RoundToEven(v)

	maxabs := math.Pow10(int(prec))
	if v >= maxabs {
		return 0, fmt.Errorf("cannot convert %f to decimal(precision=%d, scale=%d)", v, prec, scale)
	}
	return v, nil
}

func fromPositiveFloat[T Decimal32 | Decimal64, F float32 | float64](v F, prec, scale int32) (T, error) {
	if prec > int32(MaxPrecision[T]()) {
		return T(0), fmt.Errorf("invalid precision %d for converting float to Decimal", prec)
	}

	val, err := scalePositiveFloat64(float64(v), prec, scale)
	if err != nil {
		return T(0), err
	}

	return T(F(val)), nil
}

func Decimal32FromFloat[F float32 | float64](v F, prec, scale int32) (Decimal32, error) {
	if v < 0 {
		dec, err := fromPositiveFloat[Decimal32](-v, prec, scale)
		if err != nil {
			return dec, err
		}

		return -dec, nil
	}

	return fromPositiveFloat[Decimal32](v, prec, scale)
}

func Decimal64FromFloat[F float32 | float64](v F, prec, scale int32) (Decimal64, error) {
	if v < 0 {
		dec, err := fromPositiveFloat[Decimal64](-v, prec, scale)
		if err != nil {
			return dec, err
		}

		return -dec, nil
	}

	return fromPositiveFloat[Decimal64](v, prec, scale)
}

func Decimal128FromFloat(v float64, prec, scale int32) (Decimal128, error) {
	return decimal128.FromFloat64(v, prec, scale)
}

func Decimal256FromFloat(v float64, prec, scale int32) (Decimal256, error) {
	return decimal256.FromFloat64(v, prec, scale)
}

func (n Decimal32) ToFloat32(scale int32) float32 {
	return float32(n.ToFloat64(scale))
}

func (n Decimal64) ToFloat32(scale int32) float32 {
	return float32(n.ToFloat64(scale))
}

func (n Decimal32) ToFloat64(scale int32) float64 {
	return float64(n) * math.Pow10(-int(scale))
}

func (n Decimal64) ToFloat64(scale int32) float64 {
	return float64(n) * math.Pow10(-int(scale))
}

func (n Decimal32) ToBigFloat(scale int32) *big.Float {
	f := (&big.Float{}).SetInt64(int64(n))
	if scale < 0 {
		f.SetPrec(32).Mul(f, (&big.Float{}).SetInt64(intPow(10, -int64(scale))))
	} else {
		f.SetPrec(32).Quo(f, (&big.Float{}).SetInt64(intPow(10, int64(scale))))
	}
	return f
}

func (n Decimal64) ToBigFloat(scale int32) *big.Float {
	f := (&big.Float{}).SetInt64(int64(n))
	if scale < 0 {
		f.SetPrec(64).Mul(f, (&big.Float{}).SetInt64(intPow(10, -int64(scale))))
	} else {
		f.SetPrec(64).Quo(f, (&big.Float{}).SetInt64(intPow(10, int64(scale))))
	}
	return f
}

func cmpDec[T Decimal32 | Decimal64](lhs, rhs T) int {
	switch {
	case lhs > rhs:
		return 1
	case lhs < rhs:
		return -1
	}
	return 0
}

func (n Decimal32) Cmp(other Decimal32) int {
	return cmpDec(n, other)
}

func (n Decimal64) Cmp(other Decimal64) int {
	return cmpDec(n, other)
}

func (n Decimal32) IncreaseScaleBy(increase int32) Decimal32 {
	debug.Assert(increase >= 0, "invalid increase scale for decimal32")
	debug.Assert(increase <= 9, "invalid increase scale for decimal32")

	return n * Decimal32(intPow(10, increase))
}

func (n Decimal64) IncreaseScaleBy(increase int32) Decimal64 {
	debug.Assert(increase >= 0, "invalid increase scale for decimal64")
	debug.Assert(increase <= 18, "invalid increase scale for decimal64")

	return n * Decimal64(intPow(10, int64(increase)))
}

func reduceScale[T interface {
	Decimal32 | Decimal64
	Abs() T
}](n T, reduce int32, round bool) T {
	if reduce == 0 {
		return n
	}

	divisor := T(intPow(10, reduce))
	if !round {
		return n / divisor
	}

	quo, remainder := n/divisor, n%divisor
	divisorHalf := divisor / 2
	if remainder.Abs() >= divisorHalf {
		if n > 0 {
			quo++
		} else {
			quo--
		}
	}

	return quo
}

func (n Decimal32) ReduceScaleBy(reduce int32, round bool) Decimal32 {
	debug.Assert(reduce >= 0, "invalid reduce scale for decimal32")
	debug.Assert(reduce <= 9, "invalid reduce scale for decimal32")

	return reduceScale(n, reduce, round)
}

func (n Decimal64) ReduceScaleBy(reduce int32, round bool) Decimal64 {
	debug.Assert(reduce >= 0, "invalid reduce scale for decimal32")
	debug.Assert(reduce <= 18, "invalid reduce scale for decimal32")

	return reduceScale(n, reduce, round)
}

//lint:ignore U1000 function is being used, staticcheck seems to not follow generics
func (n Decimal32) rescaleWouldCauseDataLoss(deltaScale int32, multiplier Decimal32) (out Decimal32, loss bool) {
	if deltaScale < 0 {
		debug.Assert(multiplier != 0, "multiplier must not be zero")
		quo, remainder := bits.Div32(0, uint32(n), uint32(multiplier))
		return Decimal32(quo), remainder != 0
	}

	overflow, result := bits.Mul32(uint32(n), uint32(multiplier))
	if overflow != 0 {
		return Decimal32(result), true
	}

	out = Decimal32(result)
	return out, out < n
}

//lint:ignore U1000 function is being used, staticcheck seems to not follow generics
func (n Decimal64) rescaleWouldCauseDataLoss(deltaScale int32, multiplier Decimal64) (out Decimal64, loss bool) {
	if deltaScale < 0 {
		debug.Assert(multiplier != 0, "multiplier must not be zero")
		quo, remainder := bits.Div32(0, uint32(n), uint32(multiplier))
		return Decimal64(quo), remainder != 0
	}

	overflow, result := bits.Mul32(uint32(n), uint32(multiplier))
	if overflow != 0 {
		return Decimal64(result), true
	}

	out = Decimal64(result)
	return out, out < n
}

func rescale[T interface {
	Decimal32 | Decimal64
	rescaleWouldCauseDataLoss(int32, T) (T, bool)
	Sign() int
}](n T, originalScale, newScale int32) (out T, err error) {
	if originalScale == newScale {
		return n, nil
	}

	deltaScale := newScale - originalScale
	absDeltaScale := int32(math.Abs(float64(deltaScale)))

	sign := n.Sign()
	if n < 0 {
		n = -n
	}

	multiplier := T(intPow(10, absDeltaScale))
	var wouldHaveLoss bool
	out, wouldHaveLoss = n.rescaleWouldCauseDataLoss(deltaScale, multiplier)
	if wouldHaveLoss {
		err = errors.New("rescale data loss")
	}
	out *= T(sign)
	return
}

func (n Decimal32) Rescale(originalScale, newScale int32) (out Decimal32, err error) {
	return rescale(n, originalScale, newScale)
}

func (n Decimal64) Rescale(originalScale, newScale int32) (out Decimal64, err error) {
	return rescale(n, originalScale, newScale)
}

var (
	_ Num[Decimal32]  = Decimal32(0)
	_ Num[Decimal64]  = Decimal64(0)
	_ Num[Decimal128] = Decimal128{}
	_ Num[Decimal256] = Decimal256{}
)
