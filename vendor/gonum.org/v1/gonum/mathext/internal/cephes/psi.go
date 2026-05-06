// Copyright ©2025 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

/*
Cephes Math Library Release 2.8:  June, 2000
Copyright 1984, 1987, 1992, 2000 by Stephen L. Moshier
*/

// Code derived from psi.c in https://www.moshier.net/cephes-math-28.tar.gz.

package cephes

import "math"

var a []float64 = []float64{
	0.08333333333333333,
	-0.021092796092796094,
	0.007575757575757576,
	-0.004166666666666667,
	0.003968253968253968,
	-0.008333333333333333,
	0.08333333333333333,
}

/*							psi.c
 *
 *	Psi (digamma) function
 *
 *
 * SYNOPSIS:
 *
 * double x, y, psi();
 *
 * y = psi( x );
 *
 *
 * DESCRIPTION:
 *
 *              d      -
 *   psi(x)  =  -- ln | (x)
 *              dx
 *
 * is the logarithmic derivative of the gamma function.
 * For integer x,
 *                   n-1
 *                    -
 * psi(n) = -EUL  +   >  1/k.
 *                    -
 *                   k=1
 *
 * This formula is used for 0 < n <= 10.  If x is negative, it
 * is transformed to a positive argument by the reflection
 * formula  psi(1-x) = psi(x) + pi cot(pi x).
 * For general positive x, the argument is made greater than 10
 * using the recurrence  psi(x+1) = psi(x) + 1/x.
 * Then the following asymptotic expansion is applied:
 *
 *                           inf.   B
 *                            -      2k
 * psi(x) = log(x) - 1/2x -   >   -------
 *                            -        2k
 *                           k=1   2k x
 *
 * where the B2k are Bernoulli numbers.
 *
 * ACCURACY:
 *    Relative error (except absolute when |psi| < 1):
 * arithmetic   domain     # trials      peak         rms
 *    DEC       0,30         2500       1.7e-16     2.0e-17
 *    IEEE      0,30        30000       1.3e-15     1.4e-16
 *    IEEE      -30,0       40000       1.5e-15     2.2e-16
 *
 * ERROR MESSAGES:
 *     message         condition      value returned
 * psi singularity    x integer <=0      MAXNUM
 */
func psi(x float64) float64 {
	var (
		p, q, nz, s, w, y, z float64
		i, n                 int
		negative             bool
	)

	if x <= 0 {
		negative = true
		q = x
		p = math.Floor(q)
		if p == q {
			panic(errParamFunctionSingularity)
		}

		// Remove the zeros of tan(PI x) by subtracting the nearest integer from x
		nz = q - p
		if nz != 0.5 {
			if nz > 0.5 {
				p += 1
				nz = q - p
			}
			nz = math.Pi / math.Tan(math.Pi*nz)
		} else {
			nz = 0
		}
		x = 1 - x
	}

	// check for positive integer up to 10
	if x <= 10 && x == math.Floor(x) {
		y = 0
		n = int(x)
		for i = 1; i < n; i++ {
			w = float64(i)
			y += 1 / w
		}
		y -= 0.5772156649015329
		goto done
	}

	s = x
	w = 0
	for s < 10 {
		w += 1 / s
		s += 1
	}

	if s < 1e+17 {
		z = 1 / (s * s)
		y = z * polevl(z, a, 6)
	} else {
		y = 0
	}

	y = math.Log(s) - 0.5/s - y - w

done:
	if negative {
		y -= nz
	}
	return y
}
