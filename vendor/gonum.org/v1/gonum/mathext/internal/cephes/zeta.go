// Derived from SciPy's special/cephes/zeta.c
// https://github.com/scipy/scipy/blob/master/scipy/special/cephes/zeta.c
// Made freely available by Stephen L. Moshier without support or guarantee.

// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.
// Copyright ©1984, ©1987 by Stephen L. Moshier
// Portions Copyright ©2016 The Gonum Authors. All rights reserved.

package cephes

import "math"

// zetaCoegs are the expansion coefficients for Euler-Maclaurin summation
// formula:
//
//	\frac{(2k)!}{B_{2k}}
//
// where
//
//	B_{2k}
//
// are Bernoulli numbers.
var zetaCoefs = [...]float64{
	12.0,
	-720.0,
	30240.0,
	-1209600.0,
	47900160.0,
	-1.307674368e12 / 691,
	7.47242496e10,
	-1.067062284288e16 / 3617,
	5.109094217170944e18 / 43867,
	-8.028576626982912e20 / 174611,
	1.5511210043330985984e23 / 854513,
	-1.6938241367317436694528e27 / 236364091,
}

// Zeta computes the Riemann zeta function of two arguments.
//
//	Zeta(x,q) = \sum_{k=0}^{\infty} (k+q)^{-x}
//
// Note that Zeta returns +Inf if x is 1 and will panic if x is less than 1,
// q is either zero or a negative integer, or q is negative and x is not an
// integer.
//
// Note that:
//
//	zeta(x,1) = zetac(x) + 1
func Zeta(x, q float64) float64 {
	// REFERENCE: Gradshteyn, I. S., and I. M. Ryzhik, Tables of Integrals, Series,
	// and Products, p. 1073; Academic Press, 1980.
	if x == 1 {
		return math.Inf(1)
	}

	if x < 1 {
		panic(paramOutOfBounds)
	}

	if q <= 0 {
		if q == math.Floor(q) {
			panic(errParamFunctionSingularity)
		}
		if x != math.Floor(x) {
			panic(paramOutOfBounds) // Because q^-x not defined
		}
	}

	// Asymptotic expansion: http://dlmf.nist.gov/25.11#E43
	if q > 1e8 {
		return (1/(x-1) + 1/(2*q)) * math.Pow(q, 1-x)
	}

	// The Euler-Maclaurin summation formula is used to obtain the expansion:
	//  Zeta(x,q) = \sum_{k=1}^n (k+q)^{-x} + \frac{(n+q)^{1-x}}{x-1} - \frac{1}{2(n+q)^x} + \sum_{j=1}^{\infty} \frac{B_{2j}x(x+1)...(x+2j)}{(2j)! (n+q)^{x+2j+1}}
	// where
	//  B_{2j}
	// are Bernoulli numbers.
	// Permit negative q but continue sum until n+q > 9. This case should be
	// handled by a reflection formula. If q<0 and x is an integer, there is a
	// relation to the polyGamma function.
	s := math.Pow(q, -x)
	a := q
	i := 0
	b := 0.0
	for i < 9 || a <= 9 {
		i++
		a += 1.0
		b = math.Pow(a, -x)
		s += b
		if math.Abs(b/s) < machEp {
			return s
		}
	}

	w := a
	s += b * w / (x - 1)
	s -= 0.5 * b
	a = 1.0
	k := 0.0
	for _, coef := range zetaCoefs {
		a *= x + k
		b /= w
		t := a * b / coef
		s = s + t
		t = math.Abs(t / s)
		if t < machEp {
			return s
		}
		k += 1.0
		a *= x + k
		b /= w
		k += 1.0
	}
	return s
}
