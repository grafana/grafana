// Derived from SciPy's special/cephes/igami.c
// https://github.com/scipy/scipy/blob/master/scipy/special/cephes/igami.c
// Made freely available by Stephen L. Moshier without support or guarantee.

// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.
// Copyright ©1984, ©1987, ©1995 by Stephen L. Moshier
// Portions Copyright ©2017 The Gonum Authors. All rights reserved.

package cephes

import "math"

// IgamI computes the inverse of the incomplete Gamma function. That is, it
// returns the x such that:
//
//	IgamC(a, x) = p
//
// The input argument a must be positive and p must be between 0 and 1
// inclusive or IgamI will panic. IgamI should return a positive number, but
// can return 0 even with non-zero y due to underflow.
func IgamI(a, p float64) float64 {
	// Bound the solution
	x0 := math.MaxFloat64
	yl := 0.0
	x1 := 0.0
	yh := 1.0
	dithresh := 5.0 * machEp

	if p < 0 || p > 1 || a <= 0 {
		panic(paramOutOfBounds)
	}

	if p == 0 {
		return math.Inf(1)
	}

	if p == 1 {
		return 0.0
	}

	// Starting with the approximate value
	//  x = a y^3
	// where
	//  y = 1 - d - ndtri(p) sqrt(d)
	// and
	//  d = 1/9a
	// the routine performs up to 10 Newton iterations to find the root of
	//  IgamC(a, x) - p = 0
	d := 1.0 / (9.0 * a)
	y := 1.0 - d - Ndtri(p)*math.Sqrt(d)
	x := a * y * y * y

	lgm := lgam(a)

	for i := 0; i < 10; i++ {
		if x > x0 || x < x1 {
			break
		}

		y = IgamC(a, x)

		if y < yl || y > yh {
			break
		}

		if y < p {
			x0 = x
			yl = y
		} else {
			x1 = x
			yh = y
		}

		// Compute the derivative of the function at this point
		d = (a-1)*math.Log(x) - x - lgm
		if d < -maxLog {
			break
		}
		d = -math.Exp(d)

		// Compute the step to the next approximation of x
		d = (y - p) / d
		if math.Abs(d/x) < machEp {
			return x
		}
		x = x - d
	}

	d = 0.0625
	if x0 == math.MaxFloat64 {
		if x <= 0 {
			x = 1
		}
		for x0 == math.MaxFloat64 {
			x = (1 + d) * x
			y = IgamC(a, x)
			if y < p {
				x0 = x
				yl = y
				break
			}
			d = d + d
		}
	}

	d = 0.5
	dir := 0
	for i := 0; i < 400; i++ {
		x = x1 + d*(x0-x1)
		y = IgamC(a, x)

		lgm = (x0 - x1) / (x1 + x0)
		if math.Abs(lgm) < dithresh {
			break
		}

		lgm = (y - p) / p
		if math.Abs(lgm) < dithresh {
			break
		}

		if x <= 0 {
			break
		}

		if y >= p {
			x1 = x
			yh = y
			if dir < 0 {
				dir = 0
				d = 0.5
			} else if dir > 1 {
				d = 0.5*d + 0.5
			} else {
				d = (p - yl) / (yh - yl)
			}
			dir++
		} else {
			x0 = x
			yl = y
			if dir > 0 {
				dir = 0
				d = 0.5
			} else if dir < -1 {
				d = 0.5 * d
			} else {
				d = (p - yl) / (yh - yl)
			}
			dir--
		}
	}

	return x
}
