// Copyright 2020 The CUE Authors
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

// Copyright 2018 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Generated with go run cuelang.org/go/internal/cmd/qgo -exclude= extract math/big

package math

import "math/big"

// Exponent and precision limits.
const (
	MaxExp  = 2147483647  // largest supported exponent
	MinExp  = -2147483648 // smallest supported exponent
	MaxPrec = 4294967295  // largest (theoretically) supported precision; likely memory-limited
)

// These constants define supported rounding modes.
const (
	ToNearestEven = 0 // == IEEE 754-2008 roundTiesToEven
	ToNearestAway = 1 // == IEEE 754-2008 roundTiesToAway
	ToZero        = 2 // == IEEE 754-2008 roundTowardZero
	AwayFromZero  = 3 // no IEEE 754-2008 equivalent
	ToNegativeInf = 4 // == IEEE 754-2008 roundTowardNegative
	ToPositiveInf = 5 // == IEEE 754-2008 roundTowardPositive
)

// Constants describing the Accuracy of a Float.
const (
	Below = -1
	Exact = 0
	Above = 1
)

// Jacobi returns the Jacobi symbol (x/y), either +1, -1, or 0.
// The y argument must be an odd integer.
func Jacobi(x, y *big.Int) int {
	return big.Jacobi(x, y)
}

// MaxBase is the largest number base accepted for string conversions.
const MaxBase = 62
