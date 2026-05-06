// Copyright 2018 The CUE Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package math

import (
	"math/big"

	"github.com/cockroachdb/apd/v2"

	"cuelang.org/go/internal"
)

func roundContext(rounder string) *apd.Context {
	c := *apdContext
	c.Rounding = rounder
	return &c
}

// TODO: for now we convert Decimals to int. This allows the desired type to be
// conveyed. This has the disadvantage tht a number like 1E10000 will need to be
// expanded. Eventually it would be better to to unify number types and allow
// anything that results in an integer to pose as an integer type.
func toInt(d *internal.Decimal) *big.Int {
	i := &d.Coeff
	if d.Negative {
		i.Neg(i)
	}
	return i
}

// Floor returns the greatest integer value less than or equal to x.
//
// Special cases are:
//
//	Floor(±0) = ±0
//	Floor(±Inf) = ±Inf
//	Floor(NaN) = NaN
func Floor(x *internal.Decimal) (*big.Int, error) {
	var d internal.Decimal
	_, err := apdContext.Floor(&d, x)
	_, _ = apdContext.Quantize(&d, &d, 0)
	return toInt(&d), err
}

// Ceil returns the least integer value greater than or equal to x.
//
// Special cases are:
//
//	Ceil(±0) = ±0
//	Ceil(±Inf) = ±Inf
//	Ceil(NaN) = NaN
func Ceil(x *internal.Decimal) (*big.Int, error) {
	var d internal.Decimal
	_, err := apdContext.Ceil(&d, x)
	_, _ = apdContext.Quantize(&d, &d, 0)
	return toInt(&d), err
}

var roundTruncContext = roundContext(apd.RoundDown)

// Trunc returns the integer value of x.
//
// Special cases are:
//
//	Trunc(±0) = ±0
//	Trunc(±Inf) = ±Inf
//	Trunc(NaN) = NaN
func Trunc(x *internal.Decimal) (*big.Int, error) {
	var d internal.Decimal
	_, err := roundTruncContext.RoundToIntegralExact(&d, x)
	return toInt(&d), err
}

var roundUpContext = roundContext(apd.RoundHalfUp)

// Round returns the nearest integer, rounding half away from zero.
//
// Special cases are:
//
//	Round(±0) = ±0
//	Round(±Inf) = ±Inf
//	Round(NaN) = NaN
func Round(x *internal.Decimal) (*big.Int, error) {
	var d internal.Decimal
	_, err := roundUpContext.RoundToIntegralExact(&d, x)
	return toInt(&d), err
}

var roundEvenContext = roundContext(apd.RoundHalfEven)

// RoundToEven returns the nearest integer, rounding ties to even.
//
// Special cases are:
//
//	RoundToEven(±0) = ±0
//	RoundToEven(±Inf) = ±Inf
//	RoundToEven(NaN) = NaN
func RoundToEven(x *internal.Decimal) (*big.Int, error) {
	var d internal.Decimal
	_, err := roundEvenContext.RoundToIntegralExact(&d, x)
	return toInt(&d), err
}

var mulContext = apd.BaseContext.WithPrecision(1)

// MultipleOf reports whether x is a multiple of y.
func MultipleOf(x, y *internal.Decimal) (bool, error) {
	var d apd.Decimal
	cond, err := mulContext.Quo(&d, x, y)
	return !cond.Inexact(), err
}
