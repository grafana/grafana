// Copyright 2019 Gregory Petrosyan <gregory.petrosyan@gmail.com>
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

package rapid

import (
	"fmt"
	"math"
)

const (
	byteKind    = "Byte"
	intKind     = "Int"
	int8Kind    = "Int8"
	int16Kind   = "Int16"
	int32Kind   = "Int32"
	int64Kind   = "Int64"
	uintKind    = "Uint"
	uint8Kind   = "Uint8"
	uint16Kind  = "Uint16"
	uint32Kind  = "Uint32"
	uint64Kind  = "Uint64"
	uintptrKind = "Uintptr"

	uintptrSize = 32 << (^uintptr(0) >> 32 & 1)
	uintSize    = 32 << (^uint(0) >> 32 & 1)
	intSize     = uintSize

	maxUintptr = 1<<(uint(uintptrSize)) - 1
)

var (
	integerKindToInfo = map[string]integerKindInfo{
		byteKind:    {size: 1, umax: math.MaxUint8},
		intKind:     {signed: true, size: intSize / 8, smin: math.MinInt, smax: math.MaxInt},
		int8Kind:    {signed: true, size: 1, smin: math.MinInt8, smax: math.MaxInt8},
		int16Kind:   {signed: true, size: 2, smin: math.MinInt16, smax: math.MaxInt16},
		int32Kind:   {signed: true, size: 4, smin: math.MinInt32, smax: math.MaxInt32},
		int64Kind:   {signed: true, size: 8, smin: math.MinInt64, smax: math.MaxInt64},
		uintKind:    {size: uintSize / 8, umax: math.MaxUint},
		uint8Kind:   {size: 1, umax: math.MaxUint8},
		uint16Kind:  {size: 2, umax: math.MaxUint16},
		uint32Kind:  {size: 4, umax: math.MaxUint32},
		uint64Kind:  {size: 8, umax: math.MaxUint64},
		uintptrKind: {size: uintptrSize / 8, umax: maxUintptr},
	}
)

type integer interface {
	~int | ~int8 | ~int16 | ~int32 | ~int64 |
		~uint | ~uint8 | ~uint16 | ~uint32 | ~uint64 | ~uintptr
}

type integerKindInfo struct {
	signed bool
	size   int
	smin   int64
	smax   int64
	umax   uint64
}

type boolGen struct{}

func Bool() *Generator[bool]       { return newGenerator[bool](&boolGen{}) }
func (g *boolGen) String() string  { return "Bool()" }
func (g *boolGen) value(t *T) bool { return t.s.drawBits(1) == 1 }

func Byte() *Generator[byte]       { return newIntegerGen[byte](byteKind) }
func Int() *Generator[int]         { return newIntegerGen[int](intKind) }
func Int8() *Generator[int8]       { return newIntegerGen[int8](int8Kind) }
func Int16() *Generator[int16]     { return newIntegerGen[int16](int16Kind) }
func Int32() *Generator[int32]     { return newIntegerGen[int32](int32Kind) }
func Int64() *Generator[int64]     { return newIntegerGen[int64](int64Kind) }
func Uint() *Generator[uint]       { return newIntegerGen[uint](uintKind) }
func Uint8() *Generator[uint8]     { return newIntegerGen[uint8](uint8Kind) }
func Uint16() *Generator[uint16]   { return newIntegerGen[uint16](uint16Kind) }
func Uint32() *Generator[uint32]   { return newIntegerGen[uint32](uint32Kind) }
func Uint64() *Generator[uint64]   { return newIntegerGen[uint64](uint64Kind) }
func Uintptr() *Generator[uintptr] { return newIntegerGen[uintptr](uintptrKind) }

func ByteMin(min byte) *Generator[byte]       { return newUintMinGen[byte](byteKind, uint64(min)) }
func IntMin(min int) *Generator[int]          { return newIntMinGen[int](intKind, int64(min)) }
func Int8Min(min int8) *Generator[int8]       { return newIntMinGen[int8](int8Kind, int64(min)) }
func Int16Min(min int16) *Generator[int16]    { return newIntMinGen[int16](int16Kind, int64(min)) }
func Int32Min(min int32) *Generator[int32]    { return newIntMinGen[int32](int32Kind, int64(min)) }
func Int64Min(min int64) *Generator[int64]    { return newIntMinGen[int64](int64Kind, min) }
func UintMin(min uint) *Generator[uint]       { return newUintMinGen[uint](uintKind, uint64(min)) }
func Uint8Min(min uint8) *Generator[uint8]    { return newUintMinGen[uint8](uint8Kind, uint64(min)) }
func Uint16Min(min uint16) *Generator[uint16] { return newUintMinGen[uint16](uint16Kind, uint64(min)) }
func Uint32Min(min uint32) *Generator[uint32] { return newUintMinGen[uint32](uint32Kind, uint64(min)) }
func Uint64Min(min uint64) *Generator[uint64] { return newUintMinGen[uint64](uint64Kind, min) }
func UintptrMin(min uintptr) *Generator[uintptr] {
	return newUintMinGen[uintptr](uintptrKind, uint64(min))
}

func ByteMax(max byte) *Generator[byte]       { return newUintMaxGen[byte](byteKind, uint64(max)) }
func IntMax(max int) *Generator[int]          { return newIntMaxGen[int](intKind, int64(max)) }
func Int8Max(max int8) *Generator[int8]       { return newIntMaxGen[int8](int8Kind, int64(max)) }
func Int16Max(max int16) *Generator[int16]    { return newIntMaxGen[int16](int16Kind, int64(max)) }
func Int32Max(max int32) *Generator[int32]    { return newIntMaxGen[int32](int32Kind, int64(max)) }
func Int64Max(max int64) *Generator[int64]    { return newIntMaxGen[int64](int64Kind, max) }
func UintMax(max uint) *Generator[uint]       { return newUintMaxGen[uint](uintKind, uint64(max)) }
func Uint8Max(max uint8) *Generator[uint8]    { return newUintMaxGen[uint8](uint8Kind, uint64(max)) }
func Uint16Max(max uint16) *Generator[uint16] { return newUintMaxGen[uint16](uint16Kind, uint64(max)) }
func Uint32Max(max uint32) *Generator[uint32] { return newUintMaxGen[uint32](uint32Kind, uint64(max)) }
func Uint64Max(max uint64) *Generator[uint64] { return newUintMaxGen[uint64](uint64Kind, max) }
func UintptrMax(max uintptr) *Generator[uintptr] {
	return newUintMaxGen[uintptr](uintptrKind, uint64(max))
}

func ByteRange(min byte, max byte) *Generator[byte] {
	return newUintRangeGen[byte](byteKind, uint64(min), uint64(max))
}
func IntRange(min int, max int) *Generator[int] {
	return newIntRangeGen[int](intKind, int64(min), int64(max))
}
func Int8Range(min int8, max int8) *Generator[int8] {
	return newIntRangeGen[int8](int8Kind, int64(min), int64(max))
}
func Int16Range(min int16, max int16) *Generator[int16] {
	return newIntRangeGen[int16](int16Kind, int64(min), int64(max))
}
func Int32Range(min int32, max int32) *Generator[int32] {
	return newIntRangeGen[int32](int32Kind, int64(min), int64(max))
}
func Int64Range(min int64, max int64) *Generator[int64] {
	return newIntRangeGen[int64](int64Kind, min, max)
}
func UintRange(min uint, max uint) *Generator[uint] {
	return newUintRangeGen[uint](uintKind, uint64(min), uint64(max))
}
func Uint8Range(min uint8, max uint8) *Generator[uint8] {
	return newUintRangeGen[uint8](uint8Kind, uint64(min), uint64(max))
}
func Uint16Range(min uint16, max uint16) *Generator[uint16] {
	return newUintRangeGen[uint16](uint16Kind, uint64(min), uint64(max))
}
func Uint32Range(min uint32, max uint32) *Generator[uint32] {
	return newUintRangeGen[uint32](uint32Kind, uint64(min), uint64(max))
}
func Uint64Range(min uint64, max uint64) *Generator[uint64] {
	return newUintRangeGen[uint64](uint64Kind, min, max)
}
func UintptrRange(min uintptr, max uintptr) *Generator[uintptr] {
	return newUintRangeGen[uintptr](uintptrKind, uint64(min), uint64(max))
}

func newIntegerGen[I integer](kind string) *Generator[I] {
	return newGenerator[I](&integerGen[I]{
		integerKindInfo: integerKindToInfo[kind],
		kind:            kind,
	})
}

func newIntRangeGen[I integer](kind string, min int64, max int64) *Generator[I] {
	assertf(min <= max, "invalid integer range [%v, %v]", min, max)

	g := &integerGen[I]{
		integerKindInfo: integerKindToInfo[kind],
		kind:            kind,
		hasMin:          true,
		hasMax:          true,
	}
	g.smin = min
	g.smax = max

	return newGenerator[I](g)
}

func newIntMinGen[I integer](kind string, min int64) *Generator[I] {
	g := &integerGen[I]{
		integerKindInfo: integerKindToInfo[kind],
		kind:            kind,
		hasMin:          true,
	}
	g.smin = min

	return newGenerator[I](g)
}

func newIntMaxGen[I integer](kind string, max int64) *Generator[I] {
	g := &integerGen[I]{
		integerKindInfo: integerKindToInfo[kind],
		kind:            kind,
		hasMax:          true,
	}
	g.smax = max

	return newGenerator[I](g)
}

func newUintRangeGen[I integer](kind string, min uint64, max uint64) *Generator[I] {
	assertf(min <= max, "invalid integer range [%v, %v]", min, max)

	g := &integerGen[I]{
		integerKindInfo: integerKindToInfo[kind],
		kind:            kind,
		hasMin:          true,
		hasMax:          true,
	}
	g.umin = min
	g.umax = max

	return newGenerator[I](g)
}

func newUintMinGen[I integer](kind string, min uint64) *Generator[I] {
	g := &integerGen[I]{
		integerKindInfo: integerKindToInfo[kind],
		kind:            kind,
		hasMin:          true,
	}
	g.umin = min

	return newGenerator[I](g)
}

func newUintMaxGen[I integer](kind string, max uint64) *Generator[I] {
	g := &integerGen[I]{
		integerKindInfo: integerKindToInfo[kind],
		kind:            kind,
		hasMax:          true,
	}
	g.umax = max

	return newGenerator[I](g)
}

type integerGen[I integer] struct {
	integerKindInfo
	kind   string
	umin   uint64
	hasMin bool
	hasMax bool
}

func (g *integerGen[I]) String() string {
	if g.hasMin && g.hasMax {
		if g.signed {
			return fmt.Sprintf("%sRange(%d, %d)", g.kind, g.smin, g.smax)
		} else {
			return fmt.Sprintf("%sRange(%d, %d)", g.kind, g.umin, g.umax)
		}
	} else if g.hasMin {
		if g.signed {
			return fmt.Sprintf("%sMin(%d)", g.kind, g.smin)
		} else {
			return fmt.Sprintf("%sMin(%d)", g.kind, g.umin)
		}
	} else if g.hasMax {
		if g.signed {
			return fmt.Sprintf("%sMax(%d)", g.kind, g.smax)
		} else {
			return fmt.Sprintf("%sMax(%d)", g.kind, g.umax)
		}
	}

	return fmt.Sprintf("%s()", g.kind)
}

func (g *integerGen[I]) value(t *T) I {
	if g.signed {
		i, _, _ := genIntRange(t.s, g.smin, g.smax, true)
		return I(i)
	} else {
		u, _, _ := genUintRange(t.s, g.umin, g.umax, true)
		return I(u)
	}
}
