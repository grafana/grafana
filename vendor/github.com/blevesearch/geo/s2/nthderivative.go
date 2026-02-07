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

// nthDerivativeCoder provides Nth Derivative Coding.
//
//	(In signal processing disciplines, this is known as N-th Delta Coding.)
//
// Good for varint coding integer sequences with polynomial trends.
//
// Instead of coding a sequence of values directly, code its nth-order discrete
// derivative.  Overflow in integer addition and subtraction makes this a
// lossless transform.
//
//	 constant     linear      quadratic
//	  trend       trend         trend
//	/        \  /        \  /           \_
//
// input                               |0  0  0  0  1  2  3  4  9  16  25  36
// 0th derivative(identity)            |0  0  0  0  1  2  3  4  9  16  25  36
// 1st derivative(delta coding)        |   0  0  0  1  1  1  1  5   7   9  11
// 2nd derivative(linear prediction)   |      0  0  1  0  0  0  4   2   2   2
//
//	-------------------------------------
//	0  1  2  3  4  5  6  7  8   9  10  11
//	            n in sequence
//
// Higher-order codings can break even or be detrimental on other sequences.
//
//	     random            oscillating
//	/               \  /                  \_
//
// input                               |5  9  6  1   8  8  2 -2   4  -4   6  -6
// 0th derivative(identity)            |5  9  6  1   8  8  2 -2   4  -4   6  -6
// 1st derivative(delta coding)        |   4 -3 -5   7  0 -6 -4   6  -8  10 -12
// 2nd derivative(linear prediction)   |     -7 -2  12 -7 -6  2  10 -14  18 -22
//
//	---------------------------------------
//	0  1  2  3  4   5  6  7   8   9  10  11
//	            n in sequence
//
// Note that the nth derivative isn't available until sequence item n.  Earlier
// values are coded at lower order.  For the above table, read 5 4 -7 -2 12 ...
type nthDerivativeCoder struct {
	n, m   int
	memory [10]int32
}

// newNthDerivativeCoder returns a new coder, where n is the derivative order of the encoder (the N in NthDerivative).
// n must be within [0,10].
func newNthDerivativeCoder(n int) *nthDerivativeCoder {
	c := &nthDerivativeCoder{n: n}
	if n < 0 || n > len(c.memory) {
		panic("unsupported n. Must be within [0,10].")
	}
	return c
}

func (c *nthDerivativeCoder) encode(k int32) int32 {
	for i := 0; i < c.m; i++ {
		delta := k - c.memory[i]
		c.memory[i] = k
		k = delta
	}
	if c.m < c.n {
		c.memory[c.m] = k
		c.m++
	}
	return k
}

func (c *nthDerivativeCoder) decode(k int32) int32 {
	if c.m < c.n {
		c.m++
	}
	for i := c.m - 1; i >= 0; i-- {
		c.memory[i] += k
		k = c.memory[i]
	}
	return k
}
