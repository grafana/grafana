// Copyright 2017 Google Inc. All rights reserved.
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

package s2

import "github.com/blevesearch/geo/s1"

// roundAngle returns the value rounded to nearest as an int32.
// This does not match C++ exactly for the case of x.5.
func roundAngle(val s1.Angle) int32 {
	if val < 0 {
		return int32(val - 0.5)
	}
	return int32(val + 0.5)
}

// minAngle returns the smallest of the given values.
func minAngle(x s1.Angle, others ...s1.Angle) s1.Angle {
	min := x
	for _, y := range others {
		if y < min {
			min = y
		}
	}
	return min
}

// maxAngle returns the largest of the given values.
func maxAngle(x s1.Angle, others ...s1.Angle) s1.Angle {
	max := x
	for _, y := range others {
		if y > max {
			max = y
		}
	}
	return max
}

// minChordAngle returns the smallest of the given values.
func minChordAngle(x s1.ChordAngle, others ...s1.ChordAngle) s1.ChordAngle {
	min := x
	for _, y := range others {
		if y < min {
			min = y
		}
	}
	return min
}

// maxChordAngle returns the largest of the given values.
func maxChordAngle(x s1.ChordAngle, others ...s1.ChordAngle) s1.ChordAngle {
	max := x
	for _, y := range others {
		if y > max {
			max = y
		}
	}
	return max
}

// minFloat64 returns the smallest of the given values.
func minFloat64(x float64, others ...float64) float64 {
	min := x
	for _, y := range others {
		if y < min {
			min = y
		}
	}
	return min
}

// maxFloat64 returns the largest of the given values.
func maxFloat64(x float64, others ...float64) float64 {
	max := x
	for _, y := range others {
		if y > max {
			max = y
		}
	}
	return max
}

// minInt returns the smallest of the given values.
func minInt(x int, others ...int) int {
	min := x
	for _, y := range others {
		if y < min {
			min = y
		}
	}
	return min
}

// maxInt returns the largest of the given values.
func maxInt(x int, others ...int) int {
	max := x
	for _, y := range others {
		if y > max {
			max = y
		}
	}
	return max
}

// clampInt returns the number closest to x within the range min..max.
func clampInt(x, min, max int) int {
	if x < min {
		return min
	}
	if x > max {
		return max
	}
	return x
}
