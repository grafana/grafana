// Copyright 2016 Google Inc. All rights reserved.
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

package r3

import (
	"fmt"
	"math/big"
)

const (
	// MaxPrec is the number of bits of precision to use for the Float values.
	// To keep things simple, we match the limit used in the C++ library.
	// This allows us to handle all values we expect in the s2 library.
	MaxPrec = 64 << 20 // see C++'s util/math/exactfloat/exactfloat.h

	// MaxExp is the maximum exponent supported.  If a value has an exponent larger than
	// this, it is replaced by infinity (with the appropriate sign).
	MaxExp = 200 * 1000 * 1000 // About 10**(60 million)

	// MinExp is the minimum exponent supported.  If a value has an exponent less than
	// this, it is replaced by zero (with the appropriate sign).
	MinExp = -MaxExp // About 10**(-60 million)
)

// define some commonly referenced values.
var (
	precise0 = precInt(0)
	precise1 = precInt(1)
)

// precStr wraps the conversion from a string into a big.Float. For results that
// actually can be represented exactly, this should only be used on values that
// are integer multiples of integer powers of 2.
func precStr(s string) *big.Float {
	// Explicitly ignoring the bool return for this usage.
	f, _ := new(big.Float).SetPrec(MaxPrec).SetString(s)
	return f
}

func precInt(i int64) *big.Float {
	return new(big.Float).SetPrec(MaxPrec).SetInt64(i)
}

func precFloat(f float64) *big.Float {
	return new(big.Float).SetPrec(MaxPrec).SetFloat64(f)
}

func precAdd(a, b *big.Float) *big.Float {
	return new(big.Float).SetPrec(MaxPrec).Add(a, b)
}

func precSub(a, b *big.Float) *big.Float {
	return new(big.Float).SetPrec(MaxPrec).Sub(a, b)
}

func precMul(a, b *big.Float) *big.Float {
	return new(big.Float).SetPrec(MaxPrec).Mul(a, b)
}

// PreciseVector represents a point in ℝ³ using high-precision values.
// Note that this is NOT a complete implementation because there are some
// operations that Vector supports that are not feasible with arbitrary precision
// math. (e.g., methods that need division like Normalize, or methods needing a
// square root operation such as Norm)
type PreciseVector struct {
	X, Y, Z *big.Float
}

// PreciseVectorFromVector creates a high precision vector from the given Vector.
func PreciseVectorFromVector(v Vector) PreciseVector {
	return NewPreciseVector(v.X, v.Y, v.Z)
}

// NewPreciseVector creates a high precision vector from the given floating point values.
func NewPreciseVector(x, y, z float64) PreciseVector {
	return PreciseVector{
		X: precFloat(x),
		Y: precFloat(y),
		Z: precFloat(z),
	}
}

// Vector returns this precise vector converted to a Vector.
func (v PreciseVector) Vector() Vector {
	// The accuracy flag is ignored on these conversions back to float64.
	x, _ := v.X.Float64()
	y, _ := v.Y.Float64()
	z, _ := v.Z.Float64()
	return Vector{x, y, z}.Normalize()
}

// Equal reports whether v and ov are equal.
func (v PreciseVector) Equal(ov PreciseVector) bool {
	return v.X.Cmp(ov.X) == 0 && v.Y.Cmp(ov.Y) == 0 && v.Z.Cmp(ov.Z) == 0
}

func (v PreciseVector) String() string {
	return fmt.Sprintf("(%10g, %10g, %10g)", v.X, v.Y, v.Z)
}

// Norm2 returns the square of the norm.
func (v PreciseVector) Norm2() *big.Float { return v.Dot(v) }

// IsUnit reports whether this vector is of unit length.
func (v PreciseVector) IsUnit() bool {
	return v.Norm2().Cmp(precise1) == 0
}

// Abs returns the vector with nonnegative components.
func (v PreciseVector) Abs() PreciseVector {
	return PreciseVector{
		X: new(big.Float).Abs(v.X),
		Y: new(big.Float).Abs(v.Y),
		Z: new(big.Float).Abs(v.Z),
	}
}

// Add returns the standard vector sum of v and ov.
func (v PreciseVector) Add(ov PreciseVector) PreciseVector {
	return PreciseVector{
		X: precAdd(v.X, ov.X),
		Y: precAdd(v.Y, ov.Y),
		Z: precAdd(v.Z, ov.Z),
	}
}

// Sub returns the standard vector difference of v and ov.
func (v PreciseVector) Sub(ov PreciseVector) PreciseVector {
	return PreciseVector{
		X: precSub(v.X, ov.X),
		Y: precSub(v.Y, ov.Y),
		Z: precSub(v.Z, ov.Z),
	}
}

// Mul returns the standard scalar product of v and f.
func (v PreciseVector) Mul(f *big.Float) PreciseVector {
	return PreciseVector{
		X: precMul(v.X, f),
		Y: precMul(v.Y, f),
		Z: precMul(v.Z, f),
	}
}

// MulByFloat64 returns the standard scalar product of v and f.
func (v PreciseVector) MulByFloat64(f float64) PreciseVector {
	return v.Mul(precFloat(f))
}

// Dot returns the standard dot product of v and ov.
func (v PreciseVector) Dot(ov PreciseVector) *big.Float {
	return precAdd(precMul(v.X, ov.X), precAdd(precMul(v.Y, ov.Y), precMul(v.Z, ov.Z)))
}

// Cross returns the standard cross product of v and ov.
func (v PreciseVector) Cross(ov PreciseVector) PreciseVector {
	return PreciseVector{
		X: precSub(precMul(v.Y, ov.Z), precMul(v.Z, ov.Y)),
		Y: precSub(precMul(v.Z, ov.X), precMul(v.X, ov.Z)),
		Z: precSub(precMul(v.X, ov.Y), precMul(v.Y, ov.X)),
	}
}

// LargestComponent returns the axis that represents the largest component in this vector.
func (v PreciseVector) LargestComponent() Axis {
	t := v.Abs()

	if t.X.Cmp(t.Y) > 0 {
		if t.X.Cmp(t.Z) > 0 {
			return XAxis
		}
		return ZAxis
	}
	if t.Y.Cmp(t.Z) > 0 {
		return YAxis
	}
	return ZAxis
}

// SmallestComponent returns the axis that represents the smallest component in this vector.
func (v PreciseVector) SmallestComponent() Axis {
	t := v.Abs()

	if t.X.Cmp(t.Y) < 0 {
		if t.X.Cmp(t.Z) < 0 {
			return XAxis
		}
		return ZAxis
	}
	if t.Y.Cmp(t.Z) < 0 {
		return YAxis
	}
	return ZAxis
}

// IsZero reports if this vector is exactly 0 efficiently.
func (v PreciseVector) IsZero() bool {
	return v.X.Sign() == 0 && v.Y.Sign() == 0 && v.Z.Sign() == 0
}
