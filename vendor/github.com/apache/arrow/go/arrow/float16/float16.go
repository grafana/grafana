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

package float16 // import "github.com/apache/arrow/go/arrow/float16"

import (
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

func (f Num) Uint16() uint16 { return f.bits }
func (f Num) String() string { return strconv.FormatFloat(float64(f.Float32()), 'g', -1, 32) }
