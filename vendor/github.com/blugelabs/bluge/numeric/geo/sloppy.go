//  Copyright (c) 2020 Couchbase, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// 		http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package geo

import (
	"math"
)

var earthDiameterPerLatitude []float64
var sinTab []float64
var cosTab []float64
var asinTab []float64
var asinDer1DivF1Tab []float64
var asinDer2DivF2Tab []float64
var asinDer3DivF3Tab []float64
var asinDer4DivF4Tab []float64

const radiusTabsSize = (1 << 10) + 1
const radiusDelta = (math.Pi / 2) / (radiusTabsSize - 1)
const radiusIndexer = 1 / radiusDelta
const sinCosTabsSize = (1 << 11) + 1
const asinTabsSize = (1 << 13) + 1
const oneDivF2 = 1 / 2.0
const oneDivF3 = 1 / 6.0
const oneDivF4 = 1 / 24.0

// 1.57079632673412561417e+00 first 33 bits of pi/2
var pio2Hi = math.Float64frombits(0x3FF921FB54400000)

// 6.07710050650619224932e-11 pi/2 - PIO2_HI
var pio2Lo = math.Float64frombits(0x3DD0B4611A626331)

var asinPio2Hi = math.Float64frombits(0x3FF921FB54442D18) // 1.57079632679489655800e+00
var asinPio2Lo = math.Float64frombits(0x3C91A62633145C07) // 6.12323399573676603587e-17
var asinPs0 = math.Float64frombits(0x3fc5555555555555)    //  1.66666666666666657415e-01
var asinPs1 = math.Float64frombits(0xbfd4d61203eb6f7d)    // -3.25565818622400915405e-01
var asinPs2 = math.Float64frombits(0x3fc9c1550e884455)    //  2.01212532134862925881e-01
var asinPs3 = math.Float64frombits(0xbfa48228b5688f3b)    // -4.00555345006794114027e-02
var asinPs4 = math.Float64frombits(0x3f49efe07501b288)    //  7.91534994289814532176e-04
var asinPs5 = math.Float64frombits(0x3f023de10dfdf709)    //  3.47933107596021167570e-05
var asinQs1 = math.Float64frombits(0xc0033a271c8a2d4b)    // -2.40339491173441421878e+00
var asinQs2 = math.Float64frombits(0x40002ae59c598ac8)    //  2.02094576023350569471e+00
var asinQs3 = math.Float64frombits(0xbfe6066c1b8d0159)    // -6.88283971605453293030e-01
var asinQs4 = math.Float64frombits(0x3fb3b8c5b12e9282)    //  7.70381505559019352791e-02

var twoPiHi = 4 * pio2Hi
var twoPiLo = 4 * pio2Lo
var sinCosDeltaHi = twoPiHi/sinCosTabsSize - 1
var sinCosDeltaLo = twoPiLo/sinCosTabsSize - 1
var sinCosIndexer = 1 / (sinCosDeltaHi + sinCosDeltaLo)
var sinCosMaxValueForIntModulo = ((math.MaxInt64 >> 9) / sinCosIndexer) * 0.99
var asinMaxValueForTabs = math.Sin(73.0 * degreesToRadian)

var asinDelta = asinMaxValueForTabs / (asinTabsSize - 1)
var asinIndexer = 1 / asinDelta

func init() {
	// initializes the tables used for the sloppy math functions

	// sin and cos
	sinTab = make([]float64, sinCosTabsSize)
	cosTab = make([]float64, sinCosTabsSize)
	sinCosPiIndex := (sinCosTabsSize - 1) / 2
	sinCosPiMul2Index := 2 * sinCosPiIndex
	sinCosPiMul05Index := sinCosPiIndex / 2
	sinCosPiMul15Index := 3 * sinCosPiIndex / 2
	for i := 0; i < sinCosTabsSize; i++ {
		// angle: in [0,2*PI].
		angle := float64(i)*sinCosDeltaHi + float64(i)*sinCosDeltaLo
		sinAngle := math.Sin(angle)
		cosAngle := math.Cos(angle)
		// For indexes corresponding to null cosine or sine, we make sure the value is zero
		// and not an epsilon. This allows for a much better accuracy for results close to zero.
		if i == sinCosPiIndex {
			sinAngle = 0.0
		} else if i == sinCosPiMul2Index {
			sinAngle = 0.0
		} else if i == sinCosPiMul05Index {
			sinAngle = 0.0
		} else if i == sinCosPiMul15Index {
			sinAngle = 0.0
		}
		sinTab[i] = sinAngle
		cosTab[i] = cosAngle
	}

	// asin
	asinTab = make([]float64, asinTabsSize)
	asinDer1DivF1Tab = make([]float64, asinTabsSize)
	asinDer2DivF2Tab = make([]float64, asinTabsSize)
	asinDer3DivF3Tab = make([]float64, asinTabsSize)
	asinDer4DivF4Tab = make([]float64, asinTabsSize)
	for i := 0; i < asinTabsSize; i++ {
		// x: in [0,ASIN_MAX_VALUE_FOR_TABS].
		x := float64(i) * asinDelta
		asinTab[i] = math.Asin(x)
		oneMinusXSqInv := 1.0 / (1 - x*x)
		oneMinusXSqInv05 := math.Sqrt(oneMinusXSqInv)
		oneMinusXSqInv15 := oneMinusXSqInv05 * oneMinusXSqInv
		oneMinusXSqInv25 := oneMinusXSqInv15 * oneMinusXSqInv
		oneMinusXSqInv35 := oneMinusXSqInv25 * oneMinusXSqInv
		asinDer1DivF1Tab[i] = oneMinusXSqInv05
		asinDer2DivF2Tab[i] = (x * oneMinusXSqInv15) * oneDivF2
		asinDer3DivF3Tab[i] = ((1 + 2*x*x) * oneMinusXSqInv25) * oneDivF3
		asinDer4DivF4Tab[i] = ((5 + 2*x*(2+x*(5-2*x))) * oneMinusXSqInv35) * oneDivF4
	}

	// earth radius
	a := 6378137.0
	b := 6356752.31420
	a2 := a * a
	b2 := b * b
	earthDiameterPerLatitude = make([]float64, radiusTabsSize)
	earthDiameterPerLatitude[0] = 2.0 * a / 1000
	earthDiameterPerLatitude[radiusTabsSize-1] = 2.0 * b / 1000
	for i := 1; i < radiusTabsSize-1; i++ {
		lat := math.Pi * float64(i) / (2*radiusTabsSize - 1)
		one := math.Pow(a2*math.Cos(lat), 2)
		two := math.Pow(b2*math.Sin(lat), 2)
		three := math.Pow(a*math.Cos(lat), 2)
		four := math.Pow(b*math.Sin(lat), 2)
		radius := math.Sqrt((one + two) / (three + four))
		earthDiameterPerLatitude[i] = 2 * radius / 1000
	}
}

// earthDiameter returns an estimation of the earth's diameter at the specified
// latitude in kilometers
func earthDiameter(lat float64) float64 {
	index := math.Mod(math.Abs(lat)*radiusIndexer+0.5, float64(len(earthDiameterPerLatitude)))
	if math.IsNaN(index) {
		return 0
	}
	return earthDiameterPerLatitude[int(index)]
}

var pio2 = math.Pi / 2

func sin(a float64) float64 {
	return cos(a - pio2)
}

// cos is a sloppy math (faster) implementation of math.Cos
func cos(a float64) float64 {
	if a < 0.0 {
		a = -a
	}
	if a > sinCosMaxValueForIntModulo {
		return math.Cos(a)
	}
	// index: possibly outside tables range.
	index := int(a*sinCosIndexer + 0.5)
	delta := (a - float64(index)*sinCosDeltaHi) - float64(index)*sinCosDeltaLo
	// Making sure index is within tables range.
	// Last value of each table is the same than first, so we ignore it (tabs size minus one) for modulo.
	index &= (sinCosTabsSize - 2) // index % (SIN_COS_TABS_SIZE-1)
	indexCos := cosTab[index]
	indexSin := sinTab[index]
	return indexCos + delta*(-indexSin+delta*(-indexCos*oneDivF2+delta*(indexSin*oneDivF3+delta*indexCos*oneDivF4)))
}

// asin is a sloppy math (faster) implementation of math.Asin
func asin(a float64) float64 {
	var negateResult bool
	if a < 0 {
		a = -a
		negateResult = true
	}
	if a <= asinMaxValueForTabs {
		index := int(a*asinIndexer + 0.5)
		delta := a - float64(index)*asinDelta
		result := asinTab[index] + delta*(asinDer1DivF1Tab[index]+delta*(asinDer2DivF2Tab[index]+delta*
			(asinDer3DivF3Tab[index]+delta*asinDer4DivF4Tab[index])))
		if negateResult {
			return -result
		}
		return result
	}
	// value > ASIN_MAX_VALUE_FOR_TABS, or value is NaN
	// This part is derived from fdlibm.
	if a < 1 {
		t := (1.0 - a) * 0.5
		p := t * (asinPs0 + t*(asinPs1+t*(asinPs2+t*(asinPs3+t*(asinPs4+t+asinPs5)))))
		q := 1.0 + t*(asinQs1+t*(asinQs2+t*(asinQs3+t*asinQs4)))
		s := math.Sqrt(t)
		z := s + s*(p/q)
		result := asinPio2Hi - ((z + z) - asinPio2Lo)
		if negateResult {
			return -result
		}
		return result
	}
	// value >= 1.0, or value is NaN
	if a == 1.0 {
		if negateResult {
			return -math.Pi / 2
		}
		return math.Pi / 2
	}
	return math.NaN()
}
