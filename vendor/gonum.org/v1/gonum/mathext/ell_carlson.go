// Copyright ©2017 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package mathext

import (
	"math"
)

// EllipticRF computes the symmetric elliptic integral R_F(x,y,z):
//
//	R_F(x,y,z) = (1/2)\int_{0}^{\infty}{1/s(t)} dt,
//	s(t) = \sqrt{(t+x)(t+y)(t+z)}.
//
// The arguments x, y, z must satisfy the following conditions, otherwise the function returns math.NaN():
//
//	0 ≤ x,y,z ≤ upper,
//	lower ≤ x+y,y+z,z+x,
//
// where:
//
//	lower = 5/(2^1022) = 1.112536929253601e-307,
//	upper = (2^1022)/5 = 8.988465674311580e+306.
//
// The definition of the symmetric elliptic integral R_F can be found in NIST
// Digital Library of Mathematical Functions (http://dlmf.nist.gov/19.16.E1).
func EllipticRF(x, y, z float64) float64 {
	// The original Fortran code was published as Algorithm 577 in ACM TOMS (http://doi.org/10.1145/355958.355970).
	// This code is also available as a part of SLATEC Common Mathematical Library (http://netlib.org/slatec/index.html). Later, Carlson described
	// an improved version in http://dx.doi.org/10.1007/BF02198293 (also available at https://arxiv.org/abs/math/9409227).
	const (
		lower = 5.0 / (1 << 256) / (1 << 256) / (1 << 256) / (1 << 254) // 5*2^-1022
		upper = 1 / lower
		tol   = 1.2674918778210762260320167734407048051023273568443e-02 // (3ε)^(1/8)
	)
	if x < 0 || y < 0 || z < 0 || math.IsNaN(x) || math.IsNaN(y) || math.IsNaN(z) {
		return math.NaN()
	}
	if upper < x || upper < y || upper < z {
		return math.NaN()
	}
	if x+y < lower || y+z < lower || z+x < lower {
		return math.NaN()
	}

	A0 := (x + y + z) / 3
	An := A0
	Q := math.Max(math.Max(math.Abs(A0-x), math.Abs(A0-y)), math.Abs(A0-z)) / tol
	xn, yn, zn := x, y, z
	mul := 1.0

	for Q >= mul*math.Abs(An) {
		xnsqrt, ynsqrt, znsqrt := math.Sqrt(xn), math.Sqrt(yn), math.Sqrt(zn)
		lambda := xnsqrt*ynsqrt + ynsqrt*znsqrt + znsqrt*xnsqrt
		An = (An + lambda) * 0.25
		xn = (xn + lambda) * 0.25
		yn = (yn + lambda) * 0.25
		zn = (zn + lambda) * 0.25
		mul *= 4
	}

	X := (A0 - x) / (mul * An)
	Y := (A0 - y) / (mul * An)
	Z := -(X + Y)
	E2 := X*Y - Z*Z
	E3 := X * Y * Z

	// http://dlmf.nist.gov/19.36.E1
	return (1 - 1/10.0*E2 + 1/14.0*E3 + 1/24.0*E2*E2 - 3/44.0*E2*E3 - 5/208.0*E2*E2*E2 + 3/104.0*E3*E3 + 1/16.0*E2*E2*E3) / math.Sqrt(An)
}

// EllipticRD computes the symmetric elliptic integral R_D(x,y,z):
//
//	R_D(x,y,z) = (1/2)\int_{0}^{\infty}{1/(s(t)(t+z))} dt,
//	s(t) = \sqrt{(t+x)(t+y)(t+z)}.
//
// The arguments x, y, z must satisfy the following conditions, otherwise the function returns math.NaN():
//
//	0 ≤ x,y ≤ upper,
//	lower ≤ z ≤ upper,
//	lower ≤ x+y,
//
// where:
//
//	lower = (5/(2^1022))^(1/3) = 4.809554074311679e-103,
//	upper = ((2^1022)/5)^(1/3) = 2.079194837087086e+102.
//
// The definition of the symmetric elliptic integral R_D can be found in NIST
// Digital Library of Mathematical Functions (http://dlmf.nist.gov/19.16.E5).
func EllipticRD(x, y, z float64) float64 {
	// The original Fortran code was published as Algorithm 577 in ACM TOMS (http://doi.org/10.1145/355958.355970).
	// This code is also available as a part of SLATEC Common Mathematical Library (http://netlib.org/slatec/index.html). Later, Carlson described
	// an improved version in http://dx.doi.org/10.1007/BF02198293 (also available at https://arxiv.org/abs/math/9409227).
	const (
		lower = 4.8095540743116787026618007863123676393525016818363e-103 // (5*2^-1022)^(1/3)
		upper = 1 / lower
		tol   = 9.0351169339315770474760122547068324993857488849382e-03 // (ε/5)^(1/8)
	)
	if x < 0 || y < 0 || math.IsNaN(x) || math.IsNaN(y) || math.IsNaN(z) {
		return math.NaN()
	}
	if upper < x || upper < y || upper < z {
		return math.NaN()
	}
	if x+y < lower || z < lower {
		return math.NaN()
	}

	A0 := (x + y + 3*z) / 5
	An := A0
	Q := math.Max(math.Max(math.Abs(A0-x), math.Abs(A0-y)), math.Abs(A0-z)) / tol
	xn, yn, zn := x, y, z
	mul, s := 1.0, 0.0

	for Q >= mul*math.Abs(An) {
		xnsqrt, ynsqrt, znsqrt := math.Sqrt(xn), math.Sqrt(yn), math.Sqrt(zn)
		lambda := xnsqrt*ynsqrt + ynsqrt*znsqrt + znsqrt*xnsqrt
		s += 1 / (mul * znsqrt * (zn + lambda))
		An = (An + lambda) * 0.25
		xn = (xn + lambda) * 0.25
		yn = (yn + lambda) * 0.25
		zn = (zn + lambda) * 0.25
		mul *= 4
	}

	X := (A0 - x) / (mul * An)
	Y := (A0 - y) / (mul * An)
	Z := -(X + Y) / 3
	E2 := X*Y - 6*Z*Z
	E3 := (3*X*Y - 8*Z*Z) * Z
	E4 := 3 * (X*Y - Z*Z) * Z * Z
	E5 := X * Y * Z * Z * Z

	// http://dlmf.nist.gov/19.36.E2
	return (1-3/14.0*E2+1/6.0*E3+9/88.0*E2*E2-3/22.0*E4-9/52.0*E2*E3+3/26.0*E5-1/16.0*E2*E2*E2+3/40.0*E3*E3+3/20.0*E2*E4+45/272.0*E2*E2*E3-9/68.0*(E3*E4+E2*E5))/(mul*An*math.Sqrt(An)) + 3*s
}

// EllipticF computes the Legendre's elliptic integral of the 1st kind F(phi,m), 0≤m<1:
//
//	F(\phi,m) = \int_{0}^{\phi} 1 / \sqrt{1-m\sin^2(\theta)} d\theta
//
// Legendre's elliptic integrals can be expressed as symmetric elliptic integrals, in this case:
//
//	F(\phi,m) = \sin\phi R_F(\cos^2\phi,1-m\sin^2\phi,1)
//
// The definition of F(phi,k) where k=sqrt(m) can be found in NIST Digital Library of Mathematical
// Functions (http://dlmf.nist.gov/19.2.E4).
func EllipticF(phi, m float64) float64 {
	s, c := math.Sincos(phi)
	return s * EllipticRF(c*c, 1-m*s*s, 1)
}

// EllipticE computes the Legendre's elliptic integral of the 2nd kind E(phi,m), 0≤m<1:
//
//	E(\phi,m) = \int_{0}^{\phi} \sqrt{1-m\sin^2(\theta)} d\theta
//
// Legendre's elliptic integrals can be expressed as symmetric elliptic integrals, in this case:
//
//	E(\phi,m) = \sin\phi R_F(\cos^2\phi,1-m\sin^2\phi,1)-(m/3)\sin^3\phi R_D(\cos^2\phi,1-m\sin^2\phi,1)
//
// The definition of E(phi,k) where k=sqrt(m) can be found in NIST Digital Library of Mathematical
// Functions (http://dlmf.nist.gov/19.2.E5).
func EllipticE(phi, m float64) float64 {
	s, c := math.Sincos(phi)
	x, y := c*c, 1-m*s*s
	return s * (EllipticRF(x, y, 1) - (m/3)*s*s*EllipticRD(x, y, 1))
}
