// Copyright ©2023 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package gonum

import (
	"math"

	"gonum.org/v1/gonum/blas/blas64"
)

// Dptcon computes and returns the reciprocal of the condition number (in the
// 1-norm) of a symmetric positive definite tridiagonal matrix A using the
// factorization A = L*D*Lᵀ or A = Uᵀ*D*U computed by Dpttrf.
//
// The reciprocal of the condition number is computed as
//
//	rcond = 1 / (anorm * ‖A⁻¹‖)
//
// and ‖A⁻¹‖ is computed by a direct method.
//
// d and e contain, respectively, the n diagonal elements of the diagonal matrix
// D and the (n-1) off-diagonal elements of the unit bidiagonal factor U or L
// from the factorization of A, as computed by Dpttrf.
//
// anorm is the 1-norm of the original matrix A.
//
// work must have length n, otherwise Dptcon will panic.
func (impl Implementation) Dptcon(n int, d, e []float64, anorm float64, work []float64) (rcond float64) {
	switch {
	case n < 0:
		panic(nLT0)
	case anorm < 0:
		panic(badNorm)
	}

	// Quick return if possible.
	if n == 0 {
		return 1
	}

	switch {
	case len(d) < n:
		panic(shortD)
	case len(e) < n-1:
		panic(shortE)
	case len(work) < n:
		panic(shortWork)
	}

	// Quick return if possible.
	switch {
	case anorm == 0:
		return 0
	case math.IsNaN(anorm):
		// Propagate NaN.
		return anorm
	case math.IsInf(anorm, 1):
		return 0
	}

	// Check that d[0:n] is positive.
	for _, di := range d[:n] {
		if di <= 0 {
			return 0
		}
	}

	// Solve M(A) * x = e, where M(A) = (m[i,j]) is given by
	//
	// 	m[i,j] =  abs(A[i,j]), i == j,
	// 	m[i,j] = -abs(A[i,j]), i != j,
	//
	// and e = [1,1,...,1]ᵀ. Note M(A) = M(L)*D*M(L)ᵀ.

	// Solve M(L) * b = e.
	work[0] = 1
	for i := 1; i < n; i++ {
		work[i] = 1 + work[i-1]*math.Abs(e[i-1])
	}

	// Solve D * M(L)ᵀ * x = b.
	work[n-1] /= d[n-1]
	for i := n - 2; i >= 0; i-- {
		work[i] = work[i]/d[i] + work[i+1]*math.Abs(e[i])
	}

	// Compute ainvnm = max(x[i]), 0<=i<n.
	bi := blas64.Implementation()
	ix := bi.Idamax(n, work, 1)
	ainvnm := math.Abs(work[ix])
	if ainvnm == 0 {
		return 0
	}

	// Compute the reciprocal condition number.
	return 1 / ainvnm / anorm
}
