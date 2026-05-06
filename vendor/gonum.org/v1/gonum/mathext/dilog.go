// Copyright ©2025 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package mathext

import (
	"math"
	"math/cmplx"
)

// Li2 returns the dilogarithm Li2(z) on the principal branch.
//
// For |z| < 1, Li2(z) is defined by the power series
//
//	Li2(z) = SUM_{k=1}^{infinity} z^k / k^2
//
// and is analytically continued to the rest of the complex plane.
// The implementation uses reflection and inversion identities to map z into
// a region where the series converges rapidly, then evaluates the series.
//
// Branch cut: Li2 has a logarithmic branch point at z=1 with the standard
// cut on the real axis for z in the interval (1, infinity). The principal value is taken with
// Arg(z) element of (−Pi, Pi].
func Li2(z complex128) complex128 {
	rz, iz := real(z), imag(z)

	// Real-axis fast path:
	if iz == 0 {
		if rz <= 1 {
			return complex(li2Real(rz), 0)
		}
		// rz > 1: principal Im part = −π ln(rz)
		return complex(li2Real(rz), -math.Pi*math.Log(rz))
	}

	abs2 := rz*rz + iz*iz

	// Tiny |z|: 2-term Taylor z + z^2/4
	if abs2 < 1e-16 {
		return z * (1 + 0.25*z)
	}

	if rz <= 0.5 {
		if abs2 > 1 {
			// Inversion on left half-plane:
			// Li2(z) = −[Li2(1−1/z)] − ½ ln²(−z) − π²/6
			l := cmplx.Log(-z) // principal log
			// compute Li2(1−1/z) via x-series: x = −ln(1 − (1−1/z)) = −ln(1/z) = ln z (with sign)
			x := -cmplx.Log(1 - 1/z) // x for Li2(1−1/z)
			return -(li2SeriesXFromX(x)) - 0.5*l*l - complex(pi2over6, 0)
		}
		// Inside unit disk, left half-plane: use x-series with x = −ln(1−z)
		x := -cmplx.Log(1 - z)
		return li2SeriesXFromX(x)
	}

	// rz > 0.5
	if abs2 <= 2*rz {
		// Near 1: reflection
		// Li2(z) = π²/6 − ln z · ln(1−z) − Li2(1−z)
		lz := cmplx.Log(z)
		l1z := cmplx.Log(1 - z)
		// Li2(1−z) via x-series: x = −ln(1 − (1−z)) = −ln z
		x := -lz
		return complex(pi2over6, 0) - lz*l1z - li2SeriesXFromX(x)
	}

	// Farther from 1 on right half-plane: inversion
	// Li2(z) = −½ ln²(−z) − Li2(1−1/z) − π²/6
	l := cmplx.Log(-z)
	x := -cmplx.Log(1 - 1/z) // x for Li2(1−1/z)
	return -(li2SeriesXFromX(x)) - 0.5*l*l - complex(pi2over6, 0)
}

func li2Real(x float64) float64 {
	// see arXiv:2201.01678 for the underlying approximation strategy.
	switch {
	case x < -1:
		// Li2(x) = Li2(1/(1−x)) − π²/6 + ln(1−x)·(½ ln(1−x) − ln(−x))
		l := math.Log(1 - x)
		return li2ApproxHalf(1/(1-x)) - pi2over6 + l*(0.5*l-math.Log(-x))

	case x == -1:
		return -0.5 * pi2over6

	case x < 0:
		// Li2(x) = −Li2(x/(x−1)) − ½ ln²(1−x)
		l := math.Log1p(-x) // ln(1−x)
		return -li2ApproxHalf(x/(x-1)) - 0.5*l*l

	case x == 0:
		return 0

	case x < 0.5:
		return li2ApproxHalf(x)

	case x < 1:
		// Li2(x) = π²/6 − ln x · ln(1−x) − Li2(1−x)
		return -li2ApproxHalf(1-x) + pi2over6 - math.Log(x)*math.Log1p(-x)

	case x == 1:
		return pi2over6

	case x < 2:
		// Li2(x) = Li2(1−1/x) + π²/6 − ln x · (ln(1−1/x) + ½ ln x)
		l := math.Log(x)
		return li2ApproxHalf(1-1/x) + pi2over6 - l*(math.Log(1-1/x)+0.5*l)

	default: // x >= 2
		// Li2(x) = −Li2(1/x) + 2·π²/6 − ½ ln² x
		l := math.Log(x)
		return -li2ApproxHalf(1/x) + 2*pi2over6 - 0.5*l*l
	}
}

func li2ApproxHalf(x float64) float64 {
	// Padé-like rational approximant for Re(Li2(x)) on x ∈ [0, 1/2],
	// following arXiv:2201.01678.
	cp := [...]float64{
		0.9999999999999999502e+0,
		-2.6883926818565423430e+0,
		2.6477222699473109692e+0,
		-1.1538559607887416355e+0,
		2.0886077795020607837e-1,
		-1.0859777134152463084e-2,
	}
	cq := [...]float64{
		1.0000000000000000000e+0,
		-2.9383926818565635485e+0,
		3.2712093293018635389e+0,
		-1.7076702173954289421e+0,
		4.1596017228400603836e-1,
		-3.9801343754084482956e-2,
		8.2743668974466659035e-4,
	}
	x2 := x * x
	x4 := x2 * x2
	p := cp[0] + x*cp[1] + x2*(cp[2]+x*cp[3]) + x4*(cp[4]+x*cp[5])
	q := cq[0] + x*cq[1] + x2*(cq[2]+x*cq[3]) + x4*(cq[4]+x*cq[5]+x2*cq[6])
	return x * (p / q)
}

func li2SeriesXFromX(x complex128) complex128 {
	// Bernoulli-in-x expansion with x = −ln(1−z).
	// Inspired by SPheno CLI2 implementation in Fortran90 (https://spheno.hepforge.org/)
	const (
		b0 = -1.0 / 4.0
		b1 = 1.0 / 36.0
		b2 = -1.0 / 3600.0
		b3 = 1.0 / 211680.0
		b4 = -1.0 / 10886400.0
		b5 = 1.0 / 526901760.0
		b6 = -4.0647616451442255e-11
		b7 = 8.9216910204564526e-13
		b8 = -1.9939295860721076e-14
		b9 = 4.5189800296199182e-16
	)
	x2 := x * x
	x4 := x2 * x2
	return x +
		x2*(complex(b0, 0)+
			x*(complex(b1, 0)+
				x2*(complex(b2, 0)+
					x2*complex(b3, 0)+
					x4*(complex(b4, 0)+x2*complex(b5, 0))+
					x4*x4*(complex(b6, 0)+x2*complex(b7, 0)+x4*(complex(b8, 0)+x2*complex(b9, 0))))))
}

const pi2over6 = math.Pi * math.Pi / 6
