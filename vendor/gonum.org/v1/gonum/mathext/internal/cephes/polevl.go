// Derived from SciPy's special/cephes/polevl.h
// https://github.com/scipy/scipy/blob/master/scipy/special/cephes/polevl.h
// Made freely available by Stephen L. Moshier without support or guarantee.

// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.
// Copyright ©1984, ©1987, ©1988 by Stephen L. Moshier
// Portions Copyright ©2016 The Gonum Authors. All rights reserved.

package cephes

import "math"

// polevl evaluates a polynomial of degree N
//
//	y = c_0 + c_1 x_1 + c_2 x_2^2 ...
//
// where the coefficients are stored in reverse order, i.e. coef[0] = c_n and
// coef[n] = c_0.
func polevl(x float64, coef []float64, n int) float64 {
	ans := coef[0]
	for i := 1; i <= n; i++ {
		ans = ans*x + coef[i]
	}
	return ans
}

// p1evl is the same as polevl, except c_n is assumed to be 1 and is not included
// in the slice.
func p1evl(x float64, coef []float64, n int) float64 {
	ans := x + coef[0]
	for i := 1; i <= n-1; i++ {
		ans = ans*x + coef[i]
	}
	return ans
}

// ratevl evaluates a rational function
func ratevl(x float64, num []float64, m int, denom []float64, n int) float64 {
	// Source: Holin et. al., "Polynomial and Rational Function Evaluation",
	// http://www.boost.org/doc/libs/1_61_0/libs/math/doc/html/math_toolkit/roots/rational.html
	absx := math.Abs(x)

	var dir, idx int
	var y float64
	if absx > 1 {
		// Evaluate as a polynomial in 1/x
		dir = -1
		idx = m
		y = 1 / x
	} else {
		dir = 1
		idx = 0
		y = x
	}

	// Evaluate the numerator
	numAns := num[idx]
	idx += dir
	for i := 0; i < m; i++ {
		numAns = numAns*y + num[idx]
		idx += dir
	}

	// Evaluate the denominator
	if absx > 1 {
		idx = n
	} else {
		idx = 0
	}

	denomAns := denom[idx]
	idx += dir
	for i := 0; i < n; i++ {
		denomAns = denomAns*y + denom[idx]
		idx += dir
	}

	if absx > 1 {
		pow := float64(n - m)
		return math.Pow(x, pow) * numAns / denomAns
	}
	return numAns / denomAns
}
