// Derived from SciPy's special/cephes/unity.c
// https://github.com/scipy/scipy/blob/master/scipy/special/cephes/unity.c
// Made freely available by Stephen L. Moshier without support or guarantee.

// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.
// Copyright ©1984, ©1996 by Stephen L. Moshier
// Portions Copyright ©2016 The Gonum Authors. All rights reserved.

package cephes

import "math"

// Relative error approximations for function arguments near unity.
//  log1p(x) = log(1+x)
//  expm1(x) = exp(x) - 1
//  cosm1(x) = cos(x) - 1
//  lgam1p(x) = lgam(1+x)

const (
	invSqrt2 = 1 / math.Sqrt2
	pi4      = math.Pi / 4
	euler    = 0.577215664901532860606512090082402431 // Euler constant
)

// Coefficients for
//
//	log(1+x) = x - \frac{x^2}{2} + \frac{x^3 lP(x)}{lQ(x)}
//
// for
//
//	\frac{1}{\sqrt{2}} <= x < \sqrt{2}
//
// Theoretical peak relative error = 2.32e-20
var lP = [...]float64{
	4.5270000862445199635215e-5,
	4.9854102823193375972212e-1,
	6.5787325942061044846969e0,
	2.9911919328553073277375e1,
	6.0949667980987787057556e1,
	5.7112963590585538103336e1,
	2.0039553499201281259648e1,
}

var lQ = [...]float64{
	1.5062909083469192043167e1,
	8.3047565967967209469434e1,
	2.2176239823732856465394e2,
	3.0909872225312059774938e2,
	2.1642788614495947685003e2,
	6.0118660497603843919306e1,
}

// log1p computes
//
//	log(1 + x)
func log1p(x float64) float64 {
	z := 1 + x
	if z < invSqrt2 || z > math.Sqrt2 {
		return math.Log(z)
	}
	z = x * x
	z = -0.5*z + x*(z*polevl(x, lP[:], 6)/p1evl(x, lQ[:], 6))
	return x + z
}

// log1pmx computes
//
//	log(1 + x) - x
func log1pmx(x float64) float64 {
	if math.Abs(x) < 0.5 {
		xfac := x
		res := 0.0

		var term float64
		for n := 2; n < maxIter; n++ {
			xfac *= -x
			term = xfac / float64(n)
			res += term
			if math.Abs(term) < machEp*math.Abs(res) {
				break
			}
		}
		return res
	}
	return log1p(x) - x
}

// Coefficients for
//
//	e^x = 1 + \frac{2x eP(x^2)}{eQ(x^2) - eP(x^2)}
//
// for
//
//	-0.5 <= x <= 0.5
var eP = [...]float64{
	1.2617719307481059087798e-4,
	3.0299440770744196129956e-2,
	9.9999999999999999991025e-1,
}

var eQ = [...]float64{
	3.0019850513866445504159e-6,
	2.5244834034968410419224e-3,
	2.2726554820815502876593e-1,
	2.0000000000000000000897e0,
}

// expm1 computes
//
//	expm1(x) = e^x - 1
func expm1(x float64) float64 {
	if math.IsInf(x, 0) {
		if math.IsNaN(x) || x > 0 {
			return x
		}
		return -1
	}
	if x < -0.5 || x > 0.5 {
		return math.Exp(x) - 1
	}
	xx := x * x
	r := x * polevl(xx, eP[:], 2)
	r = r / (polevl(xx, eQ[:], 3) - r)
	return r + r
}

var coscof = [...]float64{
	4.7377507964246204691685e-14,
	-1.1470284843425359765671e-11,
	2.0876754287081521758361e-9,
	-2.7557319214999787979814e-7,
	2.4801587301570552304991e-5,
	-1.3888888888888872993737e-3,
	4.1666666666666666609054e-2,
}

// cosm1 computes
//
//	cosm1(x) = cos(x) - 1
func cosm1(x float64) float64 {
	if x < -pi4 || x > pi4 {
		return math.Cos(x) - 1
	}
	xx := x * x
	xx = -0.5*xx + xx*xx*polevl(xx, coscof[:], 6)
	return xx
}

// lgam1pTayler computes
//
//	lgam(x + 1)
//
// around x = 0 using its Taylor series.
func lgam1pTaylor(x float64) float64 {
	if x == 0 {
		return 0
	}
	res := -euler * x
	xfac := -x
	for n := 2; n < 42; n++ {
		nf := float64(n)
		xfac *= -x
		coeff := Zeta(nf, 1) * xfac / nf
		res += coeff
		if math.Abs(coeff) < machEp*math.Abs(res) {
			break
		}
	}

	return res
}

// lgam1p computes
//
//	lgam(x + 1)
func lgam1p(x float64) float64 {
	if math.Abs(x) <= 0.5 {
		return lgam1pTaylor(x)
	} else if math.Abs(x-1) < 0.5 {
		return math.Log(x) + lgam1pTaylor(x-1)
	}
	return lgam(x + 1)
}
