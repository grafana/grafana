// Copyright 2019 Gregory Petrosyan <gregory.petrosyan@gmail.com>
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

package rapid

import (
	"fmt"
	"math"
	"math/bits"
)

const (
	float32ExpBits    = 8
	float32SignifBits = 23

	float64ExpBits    = 11
	float64SignifBits = 52

	floatExpLabel    = "floatexp"
	floatSignifLabel = "floatsignif"
)

// Float32 is a shorthand for [Float32Range](-[math.MaxFloat32], [math.MaxFloat32]).
func Float32() *Generator[float32] {
	return Float32Range(-math.MaxFloat32, math.MaxFloat32)
}

// Float32Min is a shorthand for [Float32Range](min, [math.MaxFloat32]).
func Float32Min(min float32) *Generator[float32] {
	return Float32Range(min, math.MaxFloat32)
}

// Float32Max is a shorthand for [Float32Range](-[math.MaxFloat32], max).
func Float32Max(max float32) *Generator[float32] {
	return Float32Range(-math.MaxFloat32, max)
}

// Float32Range creates a generator of 32-bit floating-point numbers in range [min, max].
// Both min and max can be infinite.
func Float32Range(min float32, max float32) *Generator[float32] {
	assertf(min == min, "min should not be a NaN")
	assertf(max == max, "max should not be a NaN")
	assertf(min <= max, "invalid range [%v, %v]", min, max)

	return newGenerator[float32](&float32Gen{
		floatGen{
			min:    float64(min),
			max:    float64(max),
			minVal: -math.MaxFloat32,
			maxVal: math.MaxFloat32,
		},
	})
}

// Float64 is a shorthand for [Float64Range](-[math.MaxFloat64], [math.MaxFloat64]).
func Float64() *Generator[float64] {
	return Float64Range(-math.MaxFloat64, math.MaxFloat64)
}

// Float64Min is a shorthand for [Float64Range](min, [math.MaxFloat64]).
func Float64Min(min float64) *Generator[float64] {
	return Float64Range(min, math.MaxFloat64)
}

// Float64Max is a shorthand for [Float64Range](-[math.MaxFloat64], max).
func Float64Max(max float64) *Generator[float64] {
	return Float64Range(-math.MaxFloat64, max)
}

// Float64Range creates a generator of 64-bit floating-point numbers in range [min, max].
// Both min and max can be infinite.
func Float64Range(min float64, max float64) *Generator[float64] {
	assertf(min == min, "min should not be a NaN")
	assertf(max == max, "max should not be a NaN")
	assertf(min <= max, "invalid range [%v, %v]", min, max)

	return newGenerator[float64](&float64Gen{
		floatGen{
			min:    min,
			max:    max,
			minVal: -math.MaxFloat64,
			maxVal: math.MaxFloat64,
		},
	})
}

type floatGen struct {
	min    float64
	max    float64
	minVal float64
	maxVal float64
}
type float32Gen struct{ floatGen }
type float64Gen struct{ floatGen }

func (g *floatGen) stringImpl(kind string) string {
	if g.min != g.minVal && g.max != g.maxVal {
		return fmt.Sprintf("%sRange(%g, %g)", kind, g.min, g.max)
	} else if g.min != g.minVal {
		return fmt.Sprintf("%sMin(%g)", kind, g.min)
	} else if g.max != g.maxVal {
		return fmt.Sprintf("%sMax(%g)", kind, g.max)
	}

	return fmt.Sprintf("%s()", kind)
}
func (g *float32Gen) String() string {
	return g.stringImpl("Float32")
}
func (g *float64Gen) String() string {
	return g.stringImpl("Float64")
}

func (g *float32Gen) value(t *T) float32 {
	return float32FromParts(genFloatRange(t.s, g.min, g.max, float32SignifBits))
}
func (g *float64Gen) value(t *T) float64 {
	return float64FromParts(genFloatRange(t.s, g.min, g.max, float64SignifBits))
}

func ufloatFracBits(e int32, signifBits uint) uint {
	if e <= 0 {
		return signifBits
	} else if uint(e) < signifBits {
		return signifBits - uint(e)
	} else {
		return 0
	}
}

func ufloat32Parts(f float32) (int32, uint64, uint64) {
	u := math.Float32bits(f) & math.MaxInt32

	e := int32(u>>float32SignifBits) - int32(bitmask64(float32ExpBits-1))
	s := uint64(u) & bitmask64(float32SignifBits)
	n := ufloatFracBits(e, float32SignifBits)

	return e, s >> n, s & bitmask64(n)
}

func ufloat64Parts(f float64) (int32, uint64, uint64) {
	u := math.Float64bits(f) & math.MaxInt64

	e := int32(u>>float64SignifBits) - int32(bitmask64(float64ExpBits-1))
	s := u & bitmask64(float64SignifBits)
	n := ufloatFracBits(e, float64SignifBits)

	return e, s >> n, s & bitmask64(n)
}

func ufloat32FromParts(e int32, si uint64, sf uint64) float32 {
	e_ := (uint32(e) + uint32(bitmask64(float32ExpBits-1))) << float32SignifBits
	s_ := (uint32(si) << ufloatFracBits(e, float32SignifBits)) | uint32(sf)

	return math.Float32frombits(e_ | s_)
}

func ufloat64FromParts(e int32, si uint64, sf uint64) float64 {
	e_ := (uint64(e) + bitmask64(float64ExpBits-1)) << float64SignifBits
	s_ := (si << ufloatFracBits(e, float64SignifBits)) | sf

	return math.Float64frombits(e_ | s_)
}

func float32FromParts(sign bool, e int32, si uint64, sf uint64) float32 {
	f := ufloat32FromParts(e, si, sf)
	if sign {
		return -f
	} else {
		return f
	}
}

func float64FromParts(sign bool, e int32, si uint64, sf uint64) float64 {
	f := ufloat64FromParts(e, si, sf)
	if sign {
		return -f
	} else {
		return f
	}
}

func genUfloatRange(s bitStream, min float64, max float64, signifBits uint) (int32, uint64, uint64) {
	assert(min >= 0 && min <= max)

	var (
		minExp, maxExp                                 int32
		minSignifI, maxSignifI, minSignifF, maxSignifF uint64
	)
	if signifBits == float32SignifBits {
		minExp, minSignifI, minSignifF = ufloat32Parts(float32(min))
		maxExp, maxSignifI, maxSignifF = ufloat32Parts(float32(max))
	} else {
		minExp, minSignifI, minSignifF = ufloat64Parts(min)
		maxExp, maxSignifI, maxSignifF = ufloat64Parts(max)
	}

	i := s.beginGroup(floatExpLabel, false)
	e, lOverflow, rOverflow := genIntRange(s, int64(minExp), int64(maxExp), true)
	s.endGroup(i, false)

	fracBits := ufloatFracBits(int32(e), signifBits)

	j := s.beginGroup(floatSignifLabel, false)
	var siMin, siMax uint64
	switch {
	case lOverflow:
		siMin, siMax = minSignifI, minSignifI
	case rOverflow:
		siMin, siMax = maxSignifI, maxSignifI
	case minExp == maxExp:
		siMin, siMax = minSignifI, maxSignifI
	case int32(e) == minExp:
		siMin, siMax = minSignifI, bitmask64(signifBits-fracBits)
	case int32(e) == maxExp:
		siMin, siMax = 0, maxSignifI
	default:
		siMin, siMax = 0, bitmask64(signifBits-fracBits)
	}
	si, _, _ := genUintRange(s, siMin, siMax, false)
	var sfMin, sfMax uint64
	switch {
	case lOverflow:
		sfMin, sfMax = minSignifF, minSignifF
	case rOverflow:
		sfMin, sfMax = maxSignifF, maxSignifF
	case minExp == maxExp && minSignifI == maxSignifI:
		sfMin, sfMax = minSignifF, maxSignifF
	case int32(e) == minExp && si == minSignifI:
		sfMin, sfMax = minSignifF, bitmask64(fracBits)
	case int32(e) == maxExp && si == maxSignifI:
		sfMin, sfMax = 0, maxSignifF
	default:
		sfMin, sfMax = 0, bitmask64(fracBits)
	}
	maxR := bits.Len64(sfMax - sfMin)
	r := genUintNNoReject(s, uint64(maxR))
	sf, _, _ := genUintRange(s, sfMin, sfMax, false)
	s.endGroup(j, false)

	for i := uint(0); i < uint(maxR)-uint(r); i++ {
		mask := ^(uint64(1) << i)
		if sf&mask < sfMin {
			break
		}
		sf &= mask
	}

	return int32(e), si, sf
}

func genFloatRange(s bitStream, min float64, max float64, signifBits uint) (bool, int32, uint64, uint64) {
	var posMin, negMin, pNeg float64
	if min >= 0 {
		posMin = min
		pNeg = 0
	} else if max <= 0 {
		negMin = -max
		pNeg = 1
	} else {
		pNeg = 0.5
	}

	if flipBiasedCoin(s, pNeg) {
		e, si, sf := genUfloatRange(s, negMin, -min, signifBits)
		return true, e, si, sf
	} else {
		e, si, sf := genUfloatRange(s, posMin, max, signifBits)
		return false, e, si, sf
	}
}
