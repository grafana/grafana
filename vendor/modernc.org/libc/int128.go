// Copyright 2020 The Libc Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Some code is copied and adjusted from
// https://github.com/lukechampine/uint128, the original LICENSE file
// reproduced below in full as of 2021-01-19:

/*
The MIT License (MIT)

Copyright (c) 2019 Luke Champine

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

package libc // import "modernc.org/libc"

import (
	mbits "math/bits"

	"modernc.org/mathutil"
)

type Int128 mathutil.Int128

var (
	int128Minus1 = Int128{-1, -1}
	int128Plus1  = Int128{Lo: 1}
)

func Int128FromFloat32(n float32) Int128 { return Int128(mathutil.NewInt128FromFloat32(n)) }
func Int128FromFloat64(n float64) Int128 { return Int128(mathutil.NewInt128FromFloat64(n)) }
func Int128FromInt16(n int16) Int128     { return Int128(mathutil.NewInt128FromInt64(int64(n))) }
func Int128FromInt32(n int32) Int128     { return Int128(mathutil.NewInt128FromInt64(int64(n))) }
func Int128FromInt64(n int64) Int128     { return Int128(mathutil.NewInt128FromInt64(n)) }
func Int128FromInt8(n int8) Int128       { return Int128(mathutil.NewInt128FromInt64(int64(n))) }
func Int128FromUint16(n uint16) Int128   { return Int128(mathutil.NewInt128FromInt64(int64(n))) }
func Int128FromUint32(n uint32) Int128   { return Int128(mathutil.NewInt128FromInt64(int64(n))) }
func Int128FromUint64(n uint64) Int128   { return Int128(mathutil.NewInt128FromUint64(n)) }
func Int128FromUint8(n uint8) Int128     { return Int128(mathutil.NewInt128FromInt64(int64(n))) }
func Int128FromUint128(n Uint128) Int128 { return Int128{Lo: int64(n.Lo), Hi: int64(n.Hi)} }

func (n *Int128) LValueDec()          { *n = n.Add(int128Minus1) }
func (n *Int128) LValueInc()          { *n = n.Add(int128Plus1) }
func (n *Int128) LValueShl(c int32)   { *n = n.Shl(c) }
func (n *Int128) LValueShr(c int32)   { *n = n.Shr(c) }
func (n Int128) And(v Int128) Int128  { return Int128{n.Lo & v.Lo, n.Hi & v.Hi} }
func (n Int128) Cmp(y Int128) int     { return mathutil.Int128(n).Cmp(mathutil.Int128(y)) }
func (n Int128) Int16() int16         { return int16(n.Lo) }
func (n Int128) Int32() int32         { return int32(n.Lo) }
func (n Int128) Int64() int64         { return n.Lo }
func (n Int128) Int8() int8           { return int8(n.Lo) }
func (n Int128) Or(v Int128) Int128   { return Int128{n.Lo | v.Lo, n.Hi | v.Hi} }
func (n Int128) Uint128() (r Uint128) { return Uint128{uint64(n.Lo), uint64(n.Hi)} }
func (n Int128) Uint16() uint16       { return uint16(n.Lo) }
func (n Int128) Uint32() uint32       { return uint32(n.Lo) }
func (n Int128) Uint64() uint64       { return uint64(n.Lo) }
func (n Int128) Uint8() uint8         { return uint8(n.Lo) }
func (n Int128) Xor(v Int128) Int128  { return Int128{n.Lo ^ v.Lo, n.Hi ^ v.Hi} }

func (n Int128) Neg() Int128 {
	n.Lo ^= -1
	n.Hi ^= -1
	return n.Add(int128Plus1)
}

func (n Int128) Float32() float32 {
	switch n.Hi {
	case 0:
		return float32(uint64(n.Lo))
	case -1:
		return -float32(uint64(n.Lo))
	}

	if n.Hi < 0 {
		n = n.Neg()
		return -float32(n.Hi)*(1<<64) + float32(uint64(n.Lo))
	}

	return -float32(n.Hi)*(1<<64) + float32(uint64(n.Lo))
}

func (n Int128) Float64() float64 {
	switch n.Hi {
	case 0:
		return float64(uint64(n.Lo))
	case -1:
		return -float64(uint64(n.Lo))
	}

	if n.Hi < 0 {
		n = n.Neg()
		return -float64(n.Hi)*(1<<64) + float64(uint64(n.Lo))
	}

	return float64(n.Hi)*(1<<64) + float64(uint64(n.Lo))
}

func (n Int128) Add(m Int128) (r Int128) {
	r.Lo = n.Lo + m.Lo
	r.Hi = n.Hi + m.Hi
	if uint64(r.Lo) < uint64(n.Lo) {
		r.Hi++
	}
	return r
}

func (n Int128) Mul(m Int128) Int128 {
	hi, lo := mbits.Mul64(uint64(n.Lo), uint64(m.Lo))
	_, p1 := mbits.Mul64(uint64(n.Hi), uint64(m.Lo))
	_, p3 := mbits.Mul64(uint64(n.Lo), uint64(m.Hi))
	hi, _ = mbits.Add64(hi, p1, 0)
	hi, _ = mbits.Add64(hi, p3, 0)
	return Int128{int64(lo), int64(hi)}
}

func (n Int128) Shl(c int32) (r Int128) {
	if c > 64 {
		r.Lo = 0
		r.Hi = n.Lo << (c - 64)
	} else {
		r.Lo = n.Lo << c
		r.Hi = n.Hi<<c | n.Lo>>(64-c)
	}
	return r
}

func (n Int128) Shr(c int32) (r Int128) {
	if c > 64 {
		r.Lo = n.Hi >> (c - 64)
		switch {
		case n.Hi < 0:
			r.Hi = -1
		default:
			r.Hi = 0
		}
	} else {
		r.Lo = n.Lo>>c | n.Hi<<(64-c)
		r.Hi = n.Hi >> c
	}
	return r
}

type Uint128 mathutil.Uint128

func Uint128FromFloat32(n float32) Uint128 { return Uint128(mathutil.NewUint128FromFloat32(n)) }
func Uint128FromFloat64(n float64) Uint128 { return Uint128(mathutil.NewUint128FromFloat64(n)) }
func Uint128FromInt128(n Int128) Uint128   { return Uint128{Lo: uint64(n.Lo), Hi: uint64(n.Hi)} }
func Uint128FromInt16(n int16) Uint128     { return Uint128FromInt64(int64(n)) }
func Uint128FromInt32(n int32) Uint128     { return Uint128FromInt64(int64(n)) }
func Uint128FromInt8(n int8) Uint128       { return Uint128FromInt64(int64(n)) }
func Uint128FromUint16(n uint16) Uint128   { return Uint128{Lo: uint64(n)} }
func Uint128FromUint32(n uint32) Uint128   { return Uint128{Lo: uint64(n)} }
func Uint128FromUint64(n uint64) Uint128   { return Uint128{Lo: n} }
func Uint128FromUint8(n uint8) Uint128     { return Uint128{Lo: uint64(n)} }

func Uint128FromInt64(n int64) (r Uint128) {
	r.Lo = uint64(n)
	if n < 0 {
		r.Hi = ^uint64(0)
	}
	return r
}

func (n *Uint128) LValueShl(c int32)    { *n = n.Shl(c) }
func (n *Uint128) LValueShr(c int32)    { *n = n.Shr(c) }
func (n Uint128) And(m Uint128) Uint128 { return Uint128{n.Lo & m.Lo, n.Hi & m.Hi} }
func (n Uint128) Int128() Int128        { return Int128{int64(n.Lo), int64(n.Hi)} }
func (n Uint128) Int16() int16          { return int16(n.Lo) }
func (n Uint128) Int32() int32          { return int32(n.Lo) }
func (n Uint128) Int64() int64          { return int64(n.Lo) }
func (n Uint128) Int8() int8            { return int8(n.Lo) }
func (n Uint128) Or(m Uint128) Uint128  { return Uint128{n.Lo | m.Lo, n.Hi | m.Hi} }
func (n Uint128) Uint16() uint16        { return uint16(n.Lo) }
func (n Uint128) Uint32() uint32        { return uint32(n.Lo) }
func (n Uint128) Uint64() uint64        { return n.Lo }
func (n Uint128) Uint8() uint8          { return uint8(n.Lo) }
func (n Uint128) Xor(m Uint128) Uint128 { return Uint128{n.Lo ^ m.Lo, n.Hi ^ m.Hi} }

func (n Uint128) Add(m Uint128) (r Uint128) {
	var carry uint64
	r.Lo, carry = mbits.Add64(n.Lo, m.Lo, 0)
	r.Hi, _ = mbits.Add64(n.Hi, m.Hi, carry)
	return r
}

func (n Uint128) Mul(m Uint128) Uint128 {
	hi, lo := mbits.Mul64(n.Lo, m.Lo)
	_, p1 := mbits.Mul64(n.Hi, m.Lo)
	_, p3 := mbits.Mul64(n.Lo, m.Hi)
	hi, _ = mbits.Add64(hi, p1, 0)
	hi, _ = mbits.Add64(hi, p3, 0)
	return Uint128{lo, hi}
}

func (n Uint128) Shr(c int32) (r Uint128) {
	if c > 64 {
		r.Lo = n.Hi >> (c - 64)
		r.Hi = 0
	} else {
		r.Lo = n.Lo>>c | n.Hi<<(64-c)
		r.Hi = n.Hi >> c
	}
	return r
}

func (n Uint128) mulOvf(m Uint128) (_ Uint128, ovf bool) {
	hi, lo := mbits.Mul64(n.Lo, m.Lo)
	p0, p1 := mbits.Mul64(n.Hi, m.Lo)
	p2, p3 := mbits.Mul64(n.Lo, m.Hi)
	hi, c0 := mbits.Add64(hi, p1, 0)
	hi, c1 := mbits.Add64(hi, p3, 0)
	ovf = p0 != 0 || p2 != 0 || c0 != 0 || c1 != 0
	return Uint128{lo, hi}, ovf
}

func (n Uint128) quoRem(m Uint128) (q, r Uint128) {
	if m.Hi == 0 {
		var r64 uint64
		q, r64 = n.quoRem64(m.Lo)
		r = Uint128FromUint64(r64)
	} else {
		// generate a "trial quotient," guaranteed to be within 1 of the actual
		// quotient, then adjust.
		nz := mbits.LeadingZeros64(m.Hi)
		v1 := m.Shl(int32(nz))
		u1 := n.Shr(1)
		tq, _ := mbits.Div64(u1.Hi, u1.Lo, v1.Hi)
		tq >>= 63 - nz
		if tq != 0 {
			tq--
		}
		q = Uint128FromUint64(tq)
		// calculate remainder using trial quotient, then adjust if remainder is
		// greater than divisor
		r = n.Sub(m.mul64(tq))
		if r.Cmp(m) >= 0 {
			q = q.add64(1)
			r = r.Sub(m)
		}
	}
	return
}

func (n Uint128) quoRem64(m uint64) (q Uint128, r uint64) {
	if n.Hi < m {
		q.Lo, r = mbits.Div64(n.Hi, n.Lo, m)
	} else {
		q.Hi, r = mbits.Div64(0, n.Hi, m)
		q.Lo, r = mbits.Div64(r, n.Lo, m)
	}
	return
}

func (n Uint128) Div(m Uint128) (r Uint128) {
	r, _ = n.quoRem(m)
	return r
}

func (n Uint128) Shl(c int32) (r Uint128) {
	if c > 64 {
		r.Lo = 0
		r.Hi = n.Lo << (c - 64)
	} else {
		r.Lo = n.Lo << c
		r.Hi = n.Hi<<c | n.Lo>>(64-c)
	}
	return
}

func (n Uint128) Sub(m Uint128) Uint128 {
	lo, borrow := mbits.Sub64(n.Lo, m.Lo, 0)
	hi, _ := mbits.Sub64(n.Hi, m.Hi, borrow)
	return Uint128{lo, hi}
}

func (n Uint128) mul64(m uint64) Uint128 {
	hi, lo := mbits.Mul64(n.Lo, m)
	_, p1 := mbits.Mul64(n.Hi, m)
	hi, _ = mbits.Add64(hi, p1, 0)
	return Uint128{lo, hi}
}

func (n Uint128) Cmp(m Uint128) int {
	if n == m {
		return 0
	} else if n.Hi < m.Hi || (n.Hi == m.Hi && n.Lo < m.Lo) {
		return -1
	} else {
		return 1
	}
}

func (n Uint128) add64(m uint64) Uint128 {
	lo, carry := mbits.Add64(n.Lo, m, 0)
	hi, _ := mbits.Add64(n.Hi, 0, carry)
	return Uint128{lo, hi}
}

func (n Uint128) Float32() float32 {
	if n.Hi == 0 {
		return float32(n.Lo)
	}

	return float32(n.Hi)*(1<<64) + float32(n.Lo)
}

func (n Uint128) Float64() float64 {
	if n.Hi == 0 {
		return float64(n.Lo)
	}

	return float64(n.Hi)*(1<<64) + float64(n.Lo)
}
