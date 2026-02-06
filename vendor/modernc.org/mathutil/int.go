// Copyright (c) 2018 The mathutil Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package mathutil // import "modernc.org/mathutil"

import (
	"fmt"
	"math"
	"math/big"
)

var (
	// MaxInt128 represents the maximun Int128 value as big.Int
	MaxInt128 *big.Int
	// MinInt128 represents the minimun Int128 value as big.Int
	MinInt128 *big.Int
	// MaxUint128 represents the maximun Uint128 value as big.Int
	MaxUint128 *big.Int
)

func init() {
	var ok bool
	MaxInt128, ok = big.NewInt(0).SetString("0x7fffffff_ffffffff_ffffffff_ffffffff", 0)
	if !ok {
		panic("internal error")
	}

	MinInt128 = big.NewInt(0).Set(MaxInt128)
	MinInt128.Add(MinInt128, _1)
	MinInt128.Neg(MinInt128)

	MaxUint128, ok = big.NewInt(0).SetString("0xffffffff_ffffffff_ffffffff_ffffffff", 0)
	if !ok {
		panic("internal error")
	}
}

const (
	maxInt128  = 1<<127 - 1
	maxUint128 = 1<<128 - 1
	minInt128  = -maxInt128 - 1
)

// Int128 is an 128 bit signed integer.
type Int128 struct {
	Lo int64 // Bits 63..0.
	Hi int64 // Bits 127..64.
}

// Add returns the sum of x and y and a carry indication.
func (x Int128) Add(y Int128) (r Int128, cy bool) {
	r.Lo = x.Lo + y.Lo
	r.Hi = x.Hi + y.Hi
	if uint64(r.Lo) < uint64(x.Lo) {
		r.Hi++
	}
	return r, (r.Cmp(x) < 0) == (y.Sign() >= 0)
}

// BigInt returns x in the form of a big.Int.
func (x Int128) BigInt() *big.Int {
	r := big.NewInt(x.Hi)
	r.Lsh(r, 64)
	lo := big.NewInt(0)
	lo.SetUint64(uint64(x.Lo))
	return r.Add(r, lo)
}

// Cmp compares x and y and returns:
//
//	-1 if x <  y
//	 0 if x == y
//	+1 if x >  y
func (x Int128) Cmp(y Int128) int {
	if x.Hi > y.Hi {
		return 1
	}

	if x.Hi < y.Hi {
		return -1
	}

	if uint64(x.Lo) > uint64(y.Lo) {
		return 1
	}

	if uint64(x.Lo) < uint64(y.Lo) {
		return -1
	}

	return 0
}

// Neg returns -x and an indication that x was not equal to MinInt128.
func (x Int128) Neg() (r Int128, ok bool) {
	if x == (Int128{Hi: math.MinInt64}) {
		return x, false
	}

	x.Lo = ^x.Lo
	x.Hi = ^x.Hi
	r, _ = x.Add(Int128{Lo: 1})
	return r, true
}

// SetBigInt sets x to y, returns x and an error, if any.
func (x *Int128) SetBigInt(y *big.Int) (r Int128, err error) {
	if y.Cmp(MaxInt128) > 0 {
		return *x, fmt.Errorf("%T.SetInt: overflow", x)
	}
	if y.Cmp(MinInt128) < 0 {
		return *x, fmt.Errorf("%T.SetInt: underflow", x)
	}
	neg := y.Sign() < 0
	var z big.Int
	z.Set(y)
	if neg {
		z.Neg(&z)
	}
	r.Lo = z.Int64()
	z.Rsh(&z, 64)
	r.Hi = z.Int64()
	if neg {
		r, _ = r.Neg()
	}
	*x = r
	return r, nil
}

// SetInt64 sets x to y and returns x.
func (x *Int128) SetInt64(y int64) (r Int128) {
	r.Lo = y
	if y >= 0 {
		r.Hi = 0
		*x = r
		return r
	}

	r.Hi = -1
	*x = r
	return r
}

// SetUint64 sets x to y and returns x.
func (x *Int128) SetUint64(y uint64) (r Int128) {
	r = Int128{Lo: int64(y)}
	*x = r
	return r
}

// Sign returns:
//
//	-1 if x <  0
//	 0 if x == 0
//	+1 if x >  0
func (x Int128) Sign() int {
	if x.Hi < 0 {
		return -1
	}

	if x.Hi != 0 || x.Lo != 0 {
		return 1
	}

	return 0
}

// String implements fmt.Stringer()
func (x Int128) String() string { return x.BigInt().String() }

// NewInt128FromInt64 return a new Int128 value initialized to n.
func NewInt128FromInt64(n int64) (r Int128) {
	r.Lo = n
	if n < 0 {
		r.Hi = -1
	}
	return r
}

// NewInt128FromUint64 return a new Int128 value initialized to n.
func NewInt128FromUint64(n uint64) (r Int128) { return Int128{Lo: int64(n)} }

// NewInt128FromFloat32 returns a new Int128 value initialized to n. Result is
// not specified in n does not represent a number within the range of Int128
// values.
func NewInt128FromFloat32(n float32) (r Int128) {
	if n >= minInt128 && n <= maxInt128 {
		if n >= math.MinInt64 && n <= math.MaxInt64 {
			return NewInt128FromInt64(int64(n))
		}

		f := big.NewFloat(float64(n))
		bi, _ := f.Int(nil)
		r.SetBigInt(bi)
	}
	return r
}

// NewInt128FromFloat64 returns a new Int128 value initialized to n. Result is
// not specified in n does not represent a number within the range of Int128
// values.
func NewInt128FromFloat64(n float64) (r Int128) {
	if n >= minInt128 && n <= maxInt128 {
		if n >= math.MinInt64 && n <= math.MaxInt64 {
			return NewInt128FromInt64(int64(n))
		}

		f := big.NewFloat(n)
		bi, _ := f.Int(nil)
		r.SetBigInt(bi)
	}
	return r
}

// Uint128 is an 128 bit unsigned integer.
type Uint128 struct {
	Lo uint64 // Bits 63..0.
	Hi uint64 // Bits 127..64.
}

// NewUint128FromInt64 return a new Uint128 value initialized to n.
func NewUint128FromInt64(n int64) (r Uint128) {
	r.Lo = uint64(n)
	if n < 0 {
		r.Hi = ^uint64(0)
	}
	return r
}

// NewUint128FromUint64 return a new Uint128 value initialized to n.
func NewUint128FromUint64(n uint64) (r Uint128) { return Uint128{Lo: n} }

// NewUint128FromFloat32 returns a new Uint128 value initialized to n. Result is
// not specified in n does not represent a number within the range of Uint128
// values.
func NewUint128FromFloat32(n float32) (r Uint128) {
	if n >= 0 {
		if n <= math.MaxUint64 {
			return NewUint128FromUint64(uint64(n))
		}

		f := big.NewFloat(float64(n))
		bi, _ := f.Int(nil)
		r.SetBigInt(bi)
	}
	return r
}

// NewUint128FromFloat64 returns a new Uint128 value initialized to n. Result is
// not specified in n does not represent a number within the range of Uint128
// values.
func NewUint128FromFloat64(n float64) (r Uint128) {
	if n >= 0 && n <= maxUint128 {
		if n <= math.MaxUint64 {
			return NewUint128FromUint64(uint64(n))
		}

		f := big.NewFloat(n)
		bi, _ := f.Int(nil)
		r.SetBigInt(bi)
	}
	return r
}

// SetBigInt sets x to y, returns x and an error, if any.
func (x *Uint128) SetBigInt(y *big.Int) (r Uint128, err error) {
	if y.Sign() < 0 || y.Cmp(MaxUint128) > 0 {
		return *x, fmt.Errorf("%T.SetInt: overflow", x)
	}

	var z big.Int
	z.Set(y)
	r.Lo = z.Uint64()
	z.Rsh(&z, 64)
	r.Hi = z.Uint64()
	*x = r
	return r, nil
}
