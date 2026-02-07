// Copyright ©2016 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

/*
 * Cephes Math Library, Release 2.3:  March, 1995
 * Copyright 1984, 1995 by Stephen L. Moshier
 */

package cephes

import (
	"math"

	"gonum.org/v1/gonum/mathext/internal/gonum"
)

const (
	maxGam = 171.624376956302725
	big    = 4.503599627370496e15
	biginv = 2.22044604925031308085e-16
)

// Incbet computes the regularized incomplete beta function.
func Incbet(aa, bb, xx float64) float64 {
	if aa <= 0 || bb <= 0 {
		panic(paramOutOfBounds)
	}
	if xx <= 0 || xx >= 1 {
		if xx == 0 {
			return 0
		}
		if xx == 1 {
			return 1
		}
		panic(paramOutOfBounds)
	}

	var flag int
	if bb*xx <= 1 && xx <= 0.95 {
		t := pseries(aa, bb, xx)
		return transformT(t, flag)
	}

	w := 1 - xx

	// Reverse a and b if x is greater than the mean.
	var a, b, xc, x float64
	if xx > aa/(aa+bb) {
		flag = 1
		a = bb
		b = aa
		xc = xx
		x = w
	} else {
		a = aa
		b = bb
		xc = w
		x = xx
	}

	if flag == 1 && (b*x) <= 1.0 && x <= 0.95 {
		t := pseries(a, b, x)
		return transformT(t, flag)
	}

	// Choose expansion for better convergence.
	y := x*(a+b-2.0) - (a - 1.0)
	if y < 0.0 {
		w = incbcf(a, b, x)
	} else {
		w = incbd(a, b, x) / xc
	}

	// Multiply w by the factor
	// x^a * (1-x)^b * Γ(a+b) / (a*Γ(a)*Γ(b))
	var t float64
	y = a * math.Log(x)
	t = b * math.Log(xc)
	if (a+b) < maxGam && math.Abs(y) < maxLog && math.Abs(t) < maxLog {
		t = math.Pow(xc, b)
		t *= math.Pow(x, a)
		t /= a
		t *= w
		t *= 1.0 / gonum.Beta(a, b)
		return transformT(t, flag)
	}

	// Resort to logarithms.
	y += t - gonum.Lbeta(a, b)
	y += math.Log(w / a)
	if y < minLog {
		t = 0.0
	} else {
		t = math.Exp(y)
	}

	return transformT(t, flag)
}

func transformT(t float64, flag int) float64 {
	if flag == 1 {
		if t <= machEp {
			t = 1.0 - machEp
		} else {
			t = 1.0 - t
		}
	}
	return t
}

// incbcf returns the incomplete beta integral evaluated by a continued fraction
// expansion.
func incbcf(a, b, x float64) float64 {
	var xk, pk, pkm1, pkm2, qk, qkm1, qkm2 float64
	var k1, k2, k3, k4, k5, k6, k7, k8 float64
	var r, t, ans, thresh float64
	var n int

	k1 = a
	k2 = a + b
	k3 = a
	k4 = a + 1.0
	k5 = 1.0
	k6 = b - 1.0
	k7 = k4
	k8 = a + 2.0

	pkm2 = 0.0
	qkm2 = 1.0
	pkm1 = 1.0
	qkm1 = 1.0
	ans = 1.0
	r = 1.0
	thresh = 3.0 * machEp

	for n = 0; n <= 300; n++ {

		xk = -(x * k1 * k2) / (k3 * k4)
		pk = pkm1 + pkm2*xk
		qk = qkm1 + qkm2*xk
		pkm2 = pkm1
		pkm1 = pk
		qkm2 = qkm1
		qkm1 = qk

		xk = (x * k5 * k6) / (k7 * k8)
		pk = pkm1 + pkm2*xk
		qk = qkm1 + qkm2*xk
		pkm2 = pkm1
		pkm1 = pk
		qkm2 = qkm1
		qkm1 = qk

		if qk != 0 {
			r = pk / qk
		}
		if r != 0 {
			t = math.Abs((ans - r) / r)
			ans = r
		} else {
			t = 1.0
		}

		if t < thresh {
			return ans
		}

		k1 += 1.0
		k2 += 1.0
		k3 += 2.0
		k4 += 2.0
		k5 += 1.0
		k6 -= 1.0
		k7 += 2.0
		k8 += 2.0

		if (math.Abs(qk) + math.Abs(pk)) > big {
			pkm2 *= biginv
			pkm1 *= biginv
			qkm2 *= biginv
			qkm1 *= biginv
		}
		if (math.Abs(qk) < biginv) || (math.Abs(pk) < biginv) {
			pkm2 *= big
			pkm1 *= big
			qkm2 *= big
			qkm1 *= big
		}
	}

	return ans
}

// incbd returns the incomplete beta integral evaluated by a continued fraction
// expansion.
func incbd(a, b, x float64) float64 {
	var xk, pk, pkm1, pkm2, qk, qkm1, qkm2 float64
	var k1, k2, k3, k4, k5, k6, k7, k8 float64
	var r, t, ans, z, thresh float64
	var n int

	k1 = a
	k2 = b - 1.0
	k3 = a
	k4 = a + 1.0
	k5 = 1.0
	k6 = a + b
	k7 = a + 1.0
	k8 = a + 2.0

	pkm2 = 0.0
	qkm2 = 1.0
	pkm1 = 1.0
	qkm1 = 1.0
	z = x / (1.0 - x)
	ans = 1.0
	r = 1.0
	thresh = 3.0 * machEp
	for n = 0; n <= 300; n++ {

		xk = -(z * k1 * k2) / (k3 * k4)
		pk = pkm1 + pkm2*xk
		qk = qkm1 + qkm2*xk
		pkm2 = pkm1
		pkm1 = pk
		qkm2 = qkm1
		qkm1 = qk

		xk = (z * k5 * k6) / (k7 * k8)
		pk = pkm1 + pkm2*xk
		qk = qkm1 + qkm2*xk
		pkm2 = pkm1
		pkm1 = pk
		qkm2 = qkm1
		qkm1 = qk

		if qk != 0 {
			r = pk / qk
		}
		if r != 0 {
			t = math.Abs((ans - r) / r)
			ans = r
		} else {
			t = 1.0
		}

		if t < thresh {
			return ans
		}

		k1 += 1.0
		k2 -= 1.0
		k3 += 2.0
		k4 += 2.0
		k5 += 1.0
		k6 += 1.0
		k7 += 2.0
		k8 += 2.0

		if (math.Abs(qk) + math.Abs(pk)) > big {
			pkm2 *= biginv
			pkm1 *= biginv
			qkm2 *= biginv
			qkm1 *= biginv
		}
		if (math.Abs(qk) < biginv) || (math.Abs(pk) < biginv) {
			pkm2 *= big
			pkm1 *= big
			qkm2 *= big
			qkm1 *= big
		}
	}
	return ans
}

// pseries returns the incomplete beta integral evaluated by a power series. Use
// when b*x is small and x not too close to 1.
func pseries(a, b, x float64) float64 {
	var s, t, u, v, n, t1, z, ai float64
	ai = 1.0 / a
	u = (1.0 - b) * x
	v = u / (a + 1.0)
	t1 = v
	t = u
	n = 2.0
	s = 0.0
	z = machEp * ai
	for math.Abs(v) > z {
		u = (n - b) * x / n
		t *= u
		v = t / (a + n)
		s += v
		n += 1.0
	}
	s += t1
	s += ai

	u = a * math.Log(x)
	if (a+b) < maxGam && math.Abs(u) < maxLog {
		t = 1.0 / gonum.Beta(a, b)
		s = s * t * math.Pow(x, a)
	} else {
		t = -gonum.Lbeta(a, b) + u + math.Log(s)
		if t < minLog {
			s = 0.0
		} else {
			s = math.Exp(t)
		}
	}
	return (s)
}
