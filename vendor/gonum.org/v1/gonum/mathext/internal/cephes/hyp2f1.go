// Copyright ©2025 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

/*
Cephes Math Library Release 2.8:  June, 2000
Copyright 1984, 1987, 1992, 2000 by Stephen L. Moshier
*/

// Code derived from hyp2f1.c in https://www.moshier.net/cephes-math-28.tar.gz.

package cephes

import "math"

const (
	eps     float64 = 1e-13
	ethresh float64 = 1e-12
)

/*							hyp2f1.c
 *
 *	Gauss hypergeometric function   F
 *	                               2 1
 *
 *
 * SYNOPSIS:
 *
 * double a, b, c, x, y, hyp2f1();
 *
 * y = hyp2f1( a, b, c, x );
 *
 *
 * DESCRIPTION:
 *
 *
 *  hyp2f1( a, b, c, x )  =   F ( a, b; c; x )
 *                           2 1
 *
 *           inf.
 *            -   a(a+1)...(a+k) b(b+1)...(b+k)   k+1
 *   =  1 +   >   -----------------------------  x   .
 *            -         c(c+1)...(c+k) (k+1)!
 *          k = 0
 *
 *  Cases addressed are
 *	Tests and escapes for negative integer a, b, or c
 *	Linear transformation if c - a or c - b negative integer
 *	Special case c = a or c = b
 *	Linear transformation for  x near +1
 *	Transformation for x < -0.5
 *	Psi function expansion if x > 0.5 and c - a - b integer
 *      Conditionally, a recurrence on c to make c-a-b > 0
 *
 * |x| > 1 is rejected.
 *
 * The parameters a, b, c are considered to be integer
 * valued if they are within 1.0e-14 of the nearest integer
 * (1.0e-13 for IEEE arithmetic).
 *
 * ACCURACY:
 *
 *
 *               Relative error (-1 < x < 1):
 * arithmetic   domain     # trials      peak         rms
 *    IEEE      -1,7        230000      1.2e-11     5.2e-14
 *
 * Several special cases also tested with a, b, c in
 * the range -7 to 7.
 *
 * ERROR MESSAGES:
 *
 * A "partial loss of precision" message is printed if
 * the internally estimated relative error exceeds 1^-12.
 * A "singularity" message is printed on overflow or
 * in cases not addressed (such as x < -1).
 */
func Hyp2f1(a, b, c, x float64) float64 {
	var (
		d, d1, d2, e        float64
		p, q, r, s, y, ax   float64
		ia, ib, ic, id, err float64
		flag, i, aid        int
	)

	ax = math.Abs(x)
	s = 1 - x
	ia = math.Round(a) // nearest integer to a
	ib = math.Round(b)

	if a <= 0 {
		if math.Abs(a-ia) < eps { // a is a negative integer
			flag |= 1
		}
	}

	if b <= 0 {
		if math.Abs(b-ib) < eps { // b is a negative integer
			flag |= 2
		}
	}

	if ax < 1 {
		if math.Abs(b-c) < eps { // b == c
			y = math.Pow(s, -a) // s to the -a power
			goto hypdon
		}
		if math.Abs(a-c) < eps { // a = c
			y = math.Pow(s, -b) // s to the -b power
			goto hypdon
		}
	}

	if c <= 0 {
		ic = math.Round(c)        // nearest integer to c
		if math.Abs(c-ic) < eps { // c is a negative integer
			// check if termination before explosion
			if flag&1 != 0 && ia > ic {
				goto hypok
			}
			if flag&2 != 0 && ib > ic {
				goto hypok
			}
			goto hypdiv
		}
	}

	if flag != 0 { // function is a polynomial
		goto hypok
	}

	if ax > 1 { // series diverges
		goto hypdiv
	}

	p = c - a
	ia = math.Round(p)                   // nearest integer to c-a
	if ia <= 0 && math.Abs(p-ia) < eps { // negative int c - a
		flag |= 4
	}

	r = c - b
	ib = math.Round(r)                   // nearest integer to c-b
	if ib <= 0 && math.Abs(r-ib) < eps { // negative int c - b
		flag |= 8
	}

	d = c - a - b
	id = math.Round(d) // nearest integer to d
	q = math.Abs(d - id)

	// Thanks to Christian Burger <BURGER@DMRHRZ11.HRZ.Uni-Marburg.DE> for reporting a bug here.
	if math.Abs(ax-1) < eps { // |x| == 1.0
		if x > 0 {
			if flag&12 != 0 { // negative int c-a or c-b
				if d >= 0 {
					goto hypf
				} else {
					goto hypdiv
				}
			}
			if d <= 0 {
				goto hypdiv
			}
			y = math.Gamma(c) * math.Gamma(d) / (math.Gamma(p) * math.Gamma(r))
			goto hypdon
		}
		if d <= -1 {
			goto hypdiv
		}
	}

	// Conditionally make d > 0 by recurrence on c, AMS55 #15.2.27.
	if d < 0 {
		// Try the power series first
		y, err = hyt2f1(a, b, c, x)
		if err < ethresh {
			goto hypdon
		}

		// Apply the recurrence if power series fails
		err = 0
		aid = int(2 - id)
		e = c + float64(aid)
		d2 = Hyp2f1(a, b, e, x)
		d1 = Hyp2f1(a, b, e+1, x)
		q = a + b + 1
		for i = 0; i < aid; i++ {
			r = e - 1
			y = (e*(r-(2*e-q)*x)*d2 + (e-a)*(e-b)*x*d1) / (e * r * s)
			e = r
			d1 = d2
			d2 = y
		}
		goto hypdon
	}

	if flag&12 != 0 { // negative integer c-a or c-b
		goto hypf
	}

hypok:
	y, err = hyt2f1(a, b, c, x)
hypdon:
	if err > ethresh {
		// partial loss of precision
	}
	return y
hypf:
	y, err = Hys2f1(c-a, c-b, c, x)
	y *= math.Pow(s, d)
	goto hypdon
hypdiv:
	// overflow range error
	return math.Inf(1)
}

/* Apply transformations for |x| near 1
 * then call the power series
 */
func hyt2f1(a, b, c, x float64) (y, loss float64) {
	var (
		p, q, r, s, t, d, err, err1 float64
		ax, id, d1, d2, e, y1       float64
		i, aid                      int32
	)

	s = 1 - x
	if x < -0.5 {
		if b > a {
			y, err = Hys2f1(a, c-b, c, -x/s)
			y *= math.Pow(s, -a)
		} else {
			y, err = Hys2f1(c-a, b, c, -x/s)
			y *= math.Pow(s, -b)
		}
		goto done
	}

	d = c - a - b
	id = math.Round(d) // nearest integer to d

	if x > 0.9 {
		if math.Abs(d-id) > eps { // test for integer c-a-b
			// Try the power series first
			y, err = Hys2f1(a, b, c, x)
			if err < ethresh {
				goto done
			}

			// If power series fails, then apply AMS55 #15.3.6
			q, err = Hys2f1(a, b, 1-d, s)
			q *= gammaADivBDivC(d, c-a, c-b)
			r, err1 = Hys2f1(c-a, c-b, d+1, s)
			r *= math.Pow(s, d)
			r *= gammaADivBDivC(-d, a, b)
			y = q + r

			q = math.Abs(q) // estimate cancellation error
			r = math.Abs(r)
			if q > r {
				r = q
			}
			err += err1 + float64(machEp*r/y)

			y *= math.Gamma(c)
			goto done
		} else {
			// Psi function expansion, AMS55 #15.3.10, #15.3.11, #15.3.12
			if id >= 0 {
				e = d
				d1 = d
				d2 = 0
				aid = int32(id)
			} else {
				e = -d
				d1 = 0
				d2 = d
				aid = int32(-id)
			}
			ax = math.Log(s)

			// sum for t = 0
			y = psi(1) + psi(1+e) - psi(a+d1) - psi(b+d1) - ax
			y /= math.Gamma(e + 1)

			p = (a + d1) * (b + d1) * s / math.Gamma(e+2)
			t = 1
			for {
				r = psi(1+t) + psi(1+t+e) - psi(a+t+d1) - psi(b+t+d1) - ax
				q = p * r
				y += q
				p *= s * (a + t + d1) / (t + 1)
				p *= (b + t + d1) / (t + 1 + e)
				t += 1

				if math.Abs(q/y) <= eps {
					break
				}
			}

			if id == 0 {
				y *= math.Gamma(c) / (math.Gamma(a) * math.Gamma(b))
				goto psidon
			}

			y1 = 1

			if aid == int32(1) {
				goto nosum
			}

			t = 0
			p = 1
			for i = int32(1); i < aid; i++ {
				r = 1 - e + t
				p *= s * (a + t + d2) * (b + t + d2) / r
				t += 1
				p /= t
				y1 += p
			}
		nosum:
			p = math.Gamma(c)
			y1 *= math.Gamma(e) * p / (math.Gamma(a+d1) * math.Gamma(b+d1))

			y *= p / (math.Gamma(a+d2) * math.Gamma(b+d2))
			if aid&int32(1) != int32(0) {
				y = -y
			}

			q = math.Pow(s, id) // s to the id power
			if id > 0 {
				y *= q
			} else {
				y1 *= q
			}

			y += y1
		psidon:
			goto done
		}
	}

	// Use defining power series if no special cases
	y, err = Hys2f1(a, b, c, x)

done:
	return y, err
}

/* Defining power series expansion of Gauss hypergeometric function */
// loss estimates loss of significance upon return.
func Hys2f1(a, b, c, x float64) (s, loss float64) {
	var (
		f, g, h, k, m, u, umax float64
		i                      int32
	)

	f = a
	g = b
	h = c
	s = 1
	u = 1
	for {
		if math.Abs(h) < 1e-13 {
			return math.MaxFloat64, 1
		}
		m = k + 1
		u = u * ((f + k) * (g + k) * x / ((h + k) * m))
		s += u
		k = math.Abs(u) // remember largest term summed
		if k > umax {
			umax = k
		}
		k = m

		i++
		if i > 10000 { // should never happen
			return s, 1
		}

		if math.Abs(u/s) <= machEp {
			break
		}
	}

	return s, machEp*umax/math.Abs(s) + machEp*float64(i)
}

// gammaADivBDivC performs gamma(a) / (gamma(b)*gamma(c)).
// It is more accurate than directly multiplying gammas for large values of b as discussed in https://github.com/scipy/scipy/pull/2734 .
func gammaADivBDivC(a, b, c float64) float64 {
	var sign int = 1
	var w float64

	lga, sgngam := math.Lgamma(a)
	w += lga
	sign *= sgngam

	lgb, sgngam := math.Lgamma(b)
	w -= lgb
	sign *= sgngam

	lgc, sgngam := math.Lgamma(c)
	w -= lgc
	sign *= sgngam

	return float64(sign) * math.Exp(w)
}
