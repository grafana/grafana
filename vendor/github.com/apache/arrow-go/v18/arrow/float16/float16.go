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

package float16

import (
	"encoding/binary"
	"math"
	"strconv"
)

// Num represents a half-precision floating point value (float16)
// stored on 16 bits.
//
// See https://en.wikipedia.org/wiki/Half-precision_floating-point_format for more informations.
type Num struct {
	bits uint16
}

var (
	MaxNum = Num{bits: 0b0111101111111111}
	MinNum = MaxNum.Negate()
)

// New creates a new half-precision floating point value from the provided
// float32 value.
func New(f float32) Num {
	b := math.Float32bits(f)
	sn := uint16((b >> 31) & 0x1)
	exp := (b >> 23) & 0xff
	res := int16(exp) - 127 + 15
	fc := uint16(b>>13) & 0x3ff
	switch {
	case exp == 0:
		res = 0
	case exp == 0xff:
		res = 0x1f
	case res > 0x1e:
		res = 0x1f
		fc = 0
	case res < 0x01:
		res = 0
		fc = 0
	}
	return Num{bits: (sn << 15) | uint16(res<<10) | fc}
}

func (f Num) Float32() float32 {
	sn := uint32((f.bits >> 15) & 0x1)
	exp := (f.bits >> 10) & 0x1f
	res := uint32(exp) + 127 - 15
	fc := uint32(f.bits & 0x3ff)
	switch {
	case exp == 0:
		res = 0
	case exp == 0x1f:
		res = 0xff
	}
	return math.Float32frombits((sn << 31) | (res << 23) | (fc << 13))
}

func (n Num) Negate() Num {
	return Num{bits: n.bits ^ 0x8000}
}

func (n Num) Add(rhs Num) Num {
	return New(n.Float32() + rhs.Float32())
}

func (n Num) Sub(rhs Num) Num {
	return New(n.Float32() - rhs.Float32())
}

func (n Num) Mul(rhs Num) Num {
	return New(n.Float32() * rhs.Float32())
}

func (n Num) Div(rhs Num) Num {
	return New(n.Float32() / rhs.Float32())
}

// Equal returns true if the value represented by n is == other
func (n Num) Equal(other Num) bool {
	return n.Float32() == other.Float32()
}

// Greater returns true if the value represented by n is > other
func (n Num) Greater(other Num) bool {
	return n.Float32() > other.Float32()
}

// GreaterEqual returns true if the value represented by n is >= other
func (n Num) GreaterEqual(other Num) bool {
	return n.Float32() >= other.Float32()
}

// Less returns true if the value represented by n is < other
func (n Num) Less(other Num) bool {
	return n.Float32() < other.Float32()
}

// LessEqual returns true if the value represented by n is <= other
func (n Num) LessEqual(other Num) bool {
	return n.Float32() <= other.Float32()
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

func (n Num) Abs() Num {
	switch n.Sign() {
	case -1:
		return n.Negate()
	}
	return n
}

func (n Num) Sign() int {
	if n.IsZero() {
		return 0
	} else if n.Signbit() {
		return -1
	}
	return 1
}

func (n Num) Signbit() bool { return (n.bits & 0x8000) != 0 }

func (n Num) IsNaN() bool { return (n.bits & 0x7fff) > 0x7c00 }

func (n Num) IsInf() bool { return (n.bits & 0x7c00) == 0x7c00 }

func (n Num) IsZero() bool { return (n.bits & 0x7fff) == 0 }

func (f Num) Uint16() uint16 { return f.bits }
func (f Num) String() string { return strconv.FormatFloat(float64(f.Float32()), 'g', -1, 32) }

func Inf() Num { return Num{bits: 0x7c00} }

func NaN() Num { return Num{bits: 0x7fff} }

func FromBits(src uint16) Num { return Num{bits: src} }

func FromLEBytes(src []byte) Num {
	return Num{bits: binary.LittleEndian.Uint16(src)}
}

func (f Num) PutLEBytes(dst []byte) {
	binary.LittleEndian.PutUint16(dst, f.bits)
}

func (f Num) ToLEBytes() []byte {
	dst := make([]byte, 2)
	f.PutLEBytes(dst)
	return dst
}
