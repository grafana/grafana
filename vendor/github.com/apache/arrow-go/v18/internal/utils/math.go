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

package utils

import (
	"math"
	"math/bits"

	"golang.org/x/exp/constraints"
)

func Min[T constraints.Ordered](a, b T) T {
	if a < b {
		return a
	}
	return b
}

func Max[T constraints.Ordered](a, b T) T {
	if a > b {
		return a
	}
	return b
}

// Add returns the sum of two integers while checking for [overflow].
// It returns false (not ok) when the operation overflows.
//
// [overflow]: https://go.dev/ref/spec#Integer_overflow
func Add[T constraints.Signed](a, b T) (T, bool) {
	// Overflow occurs when a and b are too positive or too negative.
	// That is, when: (a > 0) && (b > 0) && (a > math.Max[T] - b)
	// or when:       (a < 0) && (b < 0) && (a < math.Min[T] - b)
	result := a + b

	// No overflow occurred if the result is larger exactly when b is positive.
	return result, (result > a) == (b > 0)
}

const (
	sqrtMaxInt = 1<<((bits.UintSize>>1)-1) - 1
	sqrtMinInt = -1 << ((bits.UintSize >> 1) - 1)
)

// Mul returns the product of two integers while checking for [overflow].
// It returns false (not ok) when the operation overflows.
//
// [overflow]: https://go.dev/ref/spec#Integer_overflow
func Mul(a, b int) (int, bool) {
	// Avoid division by zero and calculate nothing when a or b is zero.
	if a == 0 || b == 0 {
		return 0, true
	}

	result := a * b

	// Overflow occurred if the result is positive when exactly one input
	// is negative.
	if result > 0 == ((a < 0) != (b < 0)) {
		return result, false
	}

	// Overflow cannot occur when a or b is zero or one.
	// Overflow cannot occur when a and b are less positive than sqrt(MaxInt).
	// Overflow cannot occur when a and b are less negative than sqrt(MinInt).
	if (sqrtMinInt <= a && a <= sqrtMaxInt &&
		sqrtMinInt <= b && b <= sqrtMaxInt) || a == 1 || b == 1 {
		return result, true
	}

	// Finally, no overflow occurred if division produces the input. This is
	// last because division can be expensive. Dividing by -1 can overflow,
	// but we returned early in that case above.
	return result, (result/a == b)
}

const (
	sqrtMaxInt64 = math.MaxInt32
	sqrtMinInt64 = math.MinInt32
)

// Mul64 returns the product of two integers while checking for [overflow].
// It returns false (not ok) when the operation overflows.
//
// [overflow]: https://go.dev/ref/spec#Integer_overflow
func Mul64(a, b int64) (int64, bool) {
	// Avoid division by zero and calculate nothing when a or b is zero.
	if a == 0 || b == 0 {
		return 0, true
	}

	result := a * b

	// Overflow occurred if the result is positive when exactly one input
	// is negative.
	if result > 0 == ((a < 0) != (b < 0)) {
		return result, false
	}

	// Overflow cannot occur when a or b is zero or one.
	// Overflow cannot occur when a and b are less positive than sqrt(MaxInt64).
	// Overflow cannot occur when a and b are less negative than sqrt(MinInt64).
	if (sqrtMinInt64 <= a && a <= sqrtMaxInt64 &&
		sqrtMinInt64 <= b && b <= sqrtMaxInt64) || a == 1 || b == 1 {
		return result, true
	}

	// Finally, no overflow occurred if division produces the input. This is
	// last because division can be expensive. Dividing by -1 can overflow,
	// but we returned early in that case above.
	return result, (result/a == b)
}
