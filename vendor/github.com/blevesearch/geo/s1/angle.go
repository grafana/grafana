// Copyright 2014 Google Inc. All rights reserved.
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

package s1

import (
	"math"
	"strconv"
)

// Angle represents a 1D angle. The internal representation is a double precision
// value in radians, so conversion to and from radians is exact.
// Conversions between E5, E6, E7, and Degrees are not always
// exact. For example, Degrees(3.1) is different from E6(3100000) or E7(31000000).
//
// The following conversions between degrees and radians are exact:
//
//	    Degree*180 == Radian*math.Pi
//	Degree*(180/n) == Radian*(math.Pi/n)     for n == 0..8
//
// These identities hold when the arguments are scaled up or down by any power
// of 2. Some similar identities are also true, for example,
//
//	Degree*60 == Radian*(math.Pi/3)
//
// But be aware that this type of identity does not hold in general. For example,
//
//	Degree*3 != Radian*(math.Pi/60)
//
// Similarly, the conversion to radians means that (Angle(x)*Degree).Degrees()
// does not always equal x. For example,
//
//	(Angle(45*n)*Degree).Degrees() == 45*n     for n == 0..8
//
// but
//
//	(60*Degree).Degrees() != 60
//
// When testing for equality, you should allow for numerical errors (ApproxEqual)
// or convert to discrete E5/E6/E7 values first.
type Angle float64

// Angle units.
const (
	Radian Angle = 1
	Degree       = (math.Pi / 180) * Radian

	E5 = 1e-5 * Degree
	E6 = 1e-6 * Degree
	E7 = 1e-7 * Degree
)

// Radians returns the angle in radians.
func (a Angle) Radians() float64 { return float64(a) }

// Degrees returns the angle in degrees.
func (a Angle) Degrees() float64 { return float64(a / Degree) }

// round returns the value rounded to nearest as an int32.
// This does not match C++ exactly for the case of x.5.
func round(val float64) int32 {
	if val < 0 {
		return int32(val - 0.5)
	}
	return int32(val + 0.5)
}

// InfAngle returns an angle larger than any finite angle.
func InfAngle() Angle {
	return Angle(math.Inf(1))
}

// isInf reports whether this Angle is infinite.
func (a Angle) isInf() bool {
	return math.IsInf(float64(a), 0)
}

// E5 returns the angle in hundred thousandths of degrees.
func (a Angle) E5() int32 { return round(a.Degrees() * 1e5) }

// E6 returns the angle in millionths of degrees.
func (a Angle) E6() int32 { return round(a.Degrees() * 1e6) }

// E7 returns the angle in ten millionths of degrees.
func (a Angle) E7() int32 { return round(a.Degrees() * 1e7) }

// Abs returns the absolute value of the angle.
func (a Angle) Abs() Angle { return Angle(math.Abs(float64(a))) }

// Normalized returns an equivalent angle in (-π, π].
func (a Angle) Normalized() Angle {
	rad := math.Remainder(float64(a), 2*math.Pi)
	if rad <= -math.Pi {
		rad = math.Pi
	}
	return Angle(rad)
}

func (a Angle) String() string {
	return strconv.FormatFloat(a.Degrees(), 'f', 7, 64) // like "%.7f"
}

// ApproxEqual reports whether the two angles are the same up to a small tolerance.
func (a Angle) ApproxEqual(other Angle) bool {
	return math.Abs(float64(a)-float64(other)) <= epsilon
}

// BUG(dsymonds): The major differences from the C++ version are:
//   - no unsigned E5/E6/E7 methods
