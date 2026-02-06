// Copyright 2024 The Prometheus Authors
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

package almost

import (
	"math"

	"github.com/prometheus/prometheus/model/value"
)

var minNormal = math.Float64frombits(0x0010000000000000) // The smallest positive normal value of type float64.

// Equal returns true if a and b differ by less than their sum
// multiplied by epsilon, or if both are StaleNaN, or if both are any other NaN.
func Equal(a, b, epsilon float64) bool {
	// StaleNaN is a special value that is used as staleness maker, and
	// we don't want it to compare equal to any other NaN.
	if value.IsStaleNaN(a) || value.IsStaleNaN(b) {
		return value.IsStaleNaN(a) && value.IsStaleNaN(b)
	}

	// NaN has no equality but for testing we still want to know whether both values
	// are NaN.
	if math.IsNaN(a) && math.IsNaN(b) {
		return true
	}

	// Cf. http://floating-point-gui.de/errors/comparison/
	if a == b {
		return true
	}

	absSum := math.Abs(a) + math.Abs(b)
	diff := math.Abs(a - b)

	if a == 0 || b == 0 || absSum < minNormal {
		return diff < epsilon*minNormal
	}
	return diff/math.Min(absSum, math.MaxFloat64) < epsilon
}
