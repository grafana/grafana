// Copyright ©2016 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

/*
 * Cephes Math Library Release 2.1:  January, 1989
 * Copyright 1984, 1987, 1989 by Stephen L. Moshier
 * Direct inquiries to 30 Frost Street, Cambridge, MA 02140
 */

package cephes

import "math"

// TODO(btracey): There is currently an implementation of this functionality
// in gonum/stat/distuv. Find out which implementation is better, and rectify
// by having distuv call this, or moving this implementation into
// gonum/mathext/internal/gonum.

// math.Sqrt(2*pi)
const s2pi = 2.50662827463100050242e0

// approximation for 0 <= |y - 0.5| <= 3/8
var P0 = [5]float64{
	-5.99633501014107895267e1,
	9.80010754185999661536e1,
	-5.66762857469070293439e1,
	1.39312609387279679503e1,
	-1.23916583867381258016e0,
}

var Q0 = [8]float64{
	/* 1.00000000000000000000E0, */
	1.95448858338141759834e0,
	4.67627912898881538453e0,
	8.63602421390890590575e1,
	-2.25462687854119370527e2,
	2.00260212380060660359e2,
	-8.20372256168333339912e1,
	1.59056225126211695515e1,
	-1.18331621121330003142e0,
}

// Approximation for interval z = math.Sqrt(-2 log y ) between 2 and 8
// i.e., y between exp(-2) = .135 and exp(-32) = 1.27e-14.
var P1 = [9]float64{
	4.05544892305962419923e0,
	3.15251094599893866154e1,
	5.71628192246421288162e1,
	4.40805073893200834700e1,
	1.46849561928858024014e1,
	2.18663306850790267539e0,
	-1.40256079171354495875e-1,
	-3.50424626827848203418e-2,
	-8.57456785154685413611e-4,
}

var Q1 = [8]float64{
	/*  1.00000000000000000000E0, */
	1.57799883256466749731e1,
	4.53907635128879210584e1,
	4.13172038254672030440e1,
	1.50425385692907503408e1,
	2.50464946208309415979e0,
	-1.42182922854787788574e-1,
	-3.80806407691578277194e-2,
	-9.33259480895457427372e-4,
}

// Approximation for interval z = math.Sqrt(-2 log y ) between 8 and 64
// i.e., y between exp(-32) = 1.27e-14 and exp(-2048) = 3.67e-890.
var P2 = [9]float64{
	3.23774891776946035970e0,
	6.91522889068984211695e0,
	3.93881025292474443415e0,
	1.33303460815807542389e0,
	2.01485389549179081538e-1,
	1.23716634817820021358e-2,
	3.01581553508235416007e-4,
	2.65806974686737550832e-6,
	6.23974539184983293730e-9,
}

var Q2 = [8]float64{
	/*  1.00000000000000000000E0, */
	6.02427039364742014255e0,
	3.67983563856160859403e0,
	1.37702099489081330271e0,
	2.16236993594496635890e-1,
	1.34204006088543189037e-2,
	3.28014464682127739104e-4,
	2.89247864745380683936e-6,
	6.79019408009981274425e-9,
}

// Ndtri returns the argument, x, for which the area under the
// Gaussian probability density function (integrated from
// minus infinity to x) is equal to y.
func Ndtri(y0 float64) float64 {
	// For small arguments 0 < y < exp(-2), the program computes
	// z = math.Sqrt( -2.0 * math.Log(y) );  then the approximation is
	// x = z - math.Log(z)/z  - (1/z) P(1/z) / Q(1/z).
	// There are two rational functions P/Q, one for 0 < y < exp(-32)
	// and the other for y up to exp(-2).  For larger arguments,
	// w = y - 0.5, and  x/math.Sqrt(2pi) = w + w**3 R(w**2)/S(w**2)).
	var x, y, z, y2, x0, x1 float64
	var code int

	if y0 <= 0.0 {
		if y0 < 0 {
			panic(paramOutOfBounds)
		}
		return math.Inf(-1)
	}
	if y0 >= 1.0 {
		if y0 > 1 {
			panic(paramOutOfBounds)
		}
		return math.Inf(1)
	}
	code = 1
	y = y0
	if y > (1.0 - 0.13533528323661269189) { /* 0.135... = exp(-2) */
		y = 1.0 - y
		code = 0
	}

	if y > 0.13533528323661269189 {
		y = y - 0.5
		y2 = y * y
		x = y + y*(y2*polevl(y2, P0[:], 4)/p1evl(y2, Q0[:], 8))
		x = x * s2pi
		return (x)
	}

	x = math.Sqrt(-2.0 * math.Log(y))
	x0 = x - math.Log(x)/x

	z = 1.0 / x
	if x < 8.0 { /* y > exp(-32) = 1.2664165549e-14 */
		x1 = z * polevl(z, P1[:], 8) / p1evl(z, Q1[:], 8)
	} else {
		x1 = z * polevl(z, P2[:], 8) / p1evl(z, Q2[:], 8)
	}
	x = x0 - x1
	if code != 0 {
		x = -x
	}
	return (x)
}
