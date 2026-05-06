// Copyright ©2015 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package gonum

import "gonum.org/v1/gonum/lapack"

// Implementation is the native Go implementation of LAPACK routines. It
// is built on top of calls to the return of blas64.Implementation(), so while
// this code is in pure Go, the underlying BLAS implementation may not be.
type Implementation struct{}

var _ lapack.Float64 = Implementation{}

func abs(a int) int {
	if a < 0 {
		return -a
	}
	return a
}

const (
	// dlamchE is the machine epsilon. For IEEE this is 2^{-53}.
	dlamchE = 0x1p-53

	// dlamchB is the radix of the machine (the base of the number system).
	dlamchB = 2

	// dlamchP is base * eps.
	dlamchP = dlamchB * dlamchE

	// dlamchS is the "safe minimum", that is, the lowest number such that
	// 1/dlamchS does not overflow, or also the smallest normal number.
	// For IEEE this is 2^{-1022}.
	dlamchS = 0x1p-1022

	// Blue's scaling constants
	//
	// An n-vector x is well-scaled if
	//  dtsml ≤ |xᵢ| ≤ dtbig for 0 ≤ i < n and n ≤ 1/dlamchP,
	// where
	//  dtsml = 2^ceil((expmin-1)/2) = 2^ceil((-1021-1)/2) = 2^{-511} = 1.4916681462400413e-154
	//  dtbig = 2^floor((expmax-digits+1)/2) = 2^floor((1024-53+1)/2) = 2^{486} = 1.997919072202235e+146
	// If any xᵢ is not well-scaled, then multiplying small values by dssml and
	// large values by dsbig avoids underflow or overflow when computing the sum
	// of squares \sum_0^{n-1} (xᵢ)².
	//  dssml = 2^{-floor((expmin-digits)/2)} = 2^{-floor((-1021-53)/2)} = 2^537 = 4.4989137945431964e+161
	//  dsbig = 2^{-ceil((expmax+digits-1)/2)} = 2^{-ceil((1024+53-1)/2)} = 2^{-538} = 1.1113793747425387e-162
	//
	// References:
	//  - Anderson E. (2017)
	//    Algorithm 978: Safe Scaling in the Level 1 BLAS
	//    ACM Trans Math Softw 44:1--28
	//    https://doi.org/10.1145/3061665
	//  - Blue, James L. (1978)
	//    A Portable Fortran Program to Find the Euclidean Norm of a Vector
	//    ACM Trans Math Softw 4:15--23
	//    https://doi.org/10.1145/355769.355771
	dtsml = 0x1p-511
	dtbig = 0x1p486
	dssml = 0x1p537
	dsbig = 0x1p-538
)
