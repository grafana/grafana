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

package r3

import (
	"fmt"
	"math"

	"github.com/blevesearch/geo/s1"
)

// Vector represents a point in ℝ³.
type Vector struct {
	X, Y, Z float64
}

// ApproxEqual reports whether v and ov are equal within a small epsilon.
func (v Vector) ApproxEqual(ov Vector) bool {
	const epsilon = 1e-16
	return math.Abs(v.X-ov.X) < epsilon && math.Abs(v.Y-ov.Y) < epsilon && math.Abs(v.Z-ov.Z) < epsilon
}

func (v Vector) String() string { return fmt.Sprintf("(%0.24f, %0.24f, %0.24f)", v.X, v.Y, v.Z) }

// Norm returns the vector's norm.
func (v Vector) Norm() float64 { return math.Sqrt(v.Dot(v)) }

// Norm2 returns the square of the norm.
func (v Vector) Norm2() float64 { return v.Dot(v) }

// Normalize returns a unit vector in the same direction as v.
func (v Vector) Normalize() Vector {
	n2 := v.Norm2()
	if n2 == 0 {
		return Vector{0, 0, 0}
	}
	return v.Mul(1 / math.Sqrt(n2))
}

// IsUnit returns whether this vector is of approximately unit length.
func (v Vector) IsUnit() bool {
	const epsilon = 5e-14
	return math.Abs(v.Norm2()-1) <= epsilon
}

// Abs returns the vector with nonnegative components.
func (v Vector) Abs() Vector { return Vector{math.Abs(v.X), math.Abs(v.Y), math.Abs(v.Z)} }

// Add returns the standard vector sum of v and ov.
func (v Vector) Add(ov Vector) Vector { return Vector{v.X + ov.X, v.Y + ov.Y, v.Z + ov.Z} }

// Sub returns the standard vector difference of v and ov.
func (v Vector) Sub(ov Vector) Vector { return Vector{v.X - ov.X, v.Y - ov.Y, v.Z - ov.Z} }

// Mul returns the standard scalar product of v and m.
func (v Vector) Mul(m float64) Vector { return Vector{m * v.X, m * v.Y, m * v.Z} }

// Dot returns the standard dot product of v and ov.
func (v Vector) Dot(ov Vector) float64 {
	return float64(v.X*ov.X) + float64(v.Y*ov.Y) + float64(v.Z*ov.Z)
}

// Cross returns the standard cross product of v and ov.
func (v Vector) Cross(ov Vector) Vector {
	return Vector{
		float64(v.Y*ov.Z) - float64(v.Z*ov.Y),
		float64(v.Z*ov.X) - float64(v.X*ov.Z),
		float64(v.X*ov.Y) - float64(v.Y*ov.X),
	}
}

// Distance returns the Euclidean distance between v and ov.
func (v Vector) Distance(ov Vector) float64 { return v.Sub(ov).Norm() }

// Angle returns the angle between v and ov.
func (v Vector) Angle(ov Vector) s1.Angle {
	return s1.Angle(math.Atan2(v.Cross(ov).Norm(), v.Dot(ov))) * s1.Radian
}

// Axis enumerates the 3 axes of ℝ³.
type Axis int

// The three axes of ℝ³.
const (
	XAxis Axis = iota
	YAxis
	ZAxis
)

// Ortho returns a unit vector that is orthogonal to v.
// Ortho(-v) = -Ortho(v) for all v.
func (v Vector) Ortho() Vector {
	ov := Vector{}
	switch v.LargestComponent() {
	case XAxis:
		ov.Z = 1
	case YAxis:
		ov.X = 1
	case ZAxis:
		ov.Y = 1
	}
	return v.Cross(ov).Normalize()
}

// LargestComponent returns the axis that represents the largest component in this vector.
func (v Vector) LargestComponent() Axis {
	t := v.Abs()

	if t.X > t.Y {
		if t.X > t.Z {
			return XAxis
		}
		return ZAxis
	}
	if t.Y > t.Z {
		return YAxis
	}
	return ZAxis
}

// SmallestComponent returns the axis that represents the smallest component in this vector.
func (v Vector) SmallestComponent() Axis {
	t := v.Abs()

	if t.X < t.Y {
		if t.X < t.Z {
			return XAxis
		}
		return ZAxis
	}
	if t.Y < t.Z {
		return YAxis
	}
	return ZAxis
}

// Cmp compares v and ov lexicographically and returns:
//
//	-1 if v <  ov
//	 0 if v == ov
//	+1 if v >  ov
//
// This method is based on C++'s std::lexicographical_compare. Two entities
// are compared element by element with the given operator. The first mismatch
// defines which is less (or greater) than the other. If both have equivalent
// values they are lexicographically equal.
func (v Vector) Cmp(ov Vector) int {
	if v.X < ov.X {
		return -1
	}
	if v.X > ov.X {
		return 1
	}

	// First elements were the same, try the next.
	if v.Y < ov.Y {
		return -1
	}
	if v.Y > ov.Y {
		return 1
	}

	// Second elements were the same return the final compare.
	if v.Z < ov.Z {
		return -1
	}
	if v.Z > ov.Z {
		return 1
	}

	// Both are equal
	return 0
}
