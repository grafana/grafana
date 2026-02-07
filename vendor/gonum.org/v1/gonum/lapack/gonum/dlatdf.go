// Copyright ©2021 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package gonum

import (
	"math"

	"gonum.org/v1/gonum/blas/blas64"
	"gonum.org/v1/gonum/lapack"
)

// Dlatdf computes a contribution to the reciprocal Dif-estimate by solving
//
//	Z * x = h - f
//
// and choosing the vector h such that the norm of x is as large as possible.
//
// The n×n matrix Z is represented by its LU factorization as computed by Dgetc2
// and has the form
//
//	Z = P * L * U * Q
//
// where P and Q are permutation matrices, L is lower triangular with unit
// diagonal elements and U is upper triangular.
//
// job specifies the heuristic method for computing the contribution.
//
// If job is lapack.LocalLookAhead, all entries of h are chosen as either +1 or
// -1.
//
// If job is lapack.NormalizedNullVector, an approximate null-vector e of Z is
// computed using Dgecon and normalized. h is chosen as ±e with the sign giving
// the greater value of 2-norm(x). This strategy is about 5 times as expensive
// as LocalLookAhead.
//
// On entry, rhs holds the contribution f from earlier solved sub-systems. On
// return, rhs holds the solution x.
//
// ipiv and jpiv contain the pivot indices as returned by Dgetc2: row i of the
// matrix has been interchanged with row ipiv[i] and column j of the matrix has
// been interchanged with column jpiv[j].
//
// n must be at most 8, ipiv and jpiv must have length n, and rhs must have
// length at least n, otherwise Dlatdf will panic.
//
// rdsum and rdscal represent the sum of squares of computed contributions to
// the Dif-estimate from earlier solved sub-systems. rdscal is the scaling
// factor used to prevent overflow in rdsum. Dlatdf returns this sum of squares
// updated with the contributions from the current sub-system.
//
// Dlatdf is an internal routine. It is exported for testing purposes.
func (impl Implementation) Dlatdf(job lapack.MaximizeNormXJob, n int, z []float64, ldz int, rhs []float64, rdsum, rdscal float64, ipiv, jpiv []int) (scale, sum float64) {
	switch {
	case job != lapack.LocalLookAhead && job != lapack.NormalizedNullVector:
		panic(badMaximizeNormXJob)
	case n < 0:
		panic(nLT0)
	case n > 8:
		panic("lapack: n > 8")
	case ldz < max(1, n):
		panic(badLdZ)
	}

	// Quick return if possible.
	if n == 0 {
		return
	}

	switch {
	case len(z) < (n-1)*ldz+n:
		panic(shortZ)
	case len(rhs) < n:
		panic(shortRHS)
	case len(ipiv) != n:
		panic(badLenIpiv)
	case len(jpiv) != n:
		panic(badLenJpiv)
	}

	const maxdim = 8
	var (
		xps   [maxdim]float64
		xms   [maxdim]float64
		work  [4 * maxdim]float64
		iwork [maxdim]int
	)
	bi := blas64.Implementation()
	xp := xps[:n]
	xm := xms[:n]
	if job == lapack.NormalizedNullVector {
		// Compute approximate nullvector xm of Z.
		_ = impl.Dgecon(lapack.MaxRowSum, n, z, ldz, 1, work[:], iwork[:])
		// This relies on undocumented content in work[n:2*n] stored by Dgecon.
		bi.Dcopy(n, work[n:], 1, xm, 1)

		// Compute rhs.
		impl.Dlaswp(1, xm, 1, 0, n-2, ipiv[:n-1], -1)
		tmp := 1 / bi.Dnrm2(n, xm, 1)
		bi.Dscal(n, tmp, xm, 1)
		bi.Dcopy(n, xm, 1, xp, 1)
		bi.Daxpy(n, 1, rhs, 1, xp, 1)
		bi.Daxpy(n, -1.0, xm, 1, rhs, 1)
		_ = impl.Dgesc2(n, z, ldz, rhs, ipiv, jpiv)
		_ = impl.Dgesc2(n, z, ldz, xp, ipiv, jpiv)
		if bi.Dasum(n, xp, 1) > bi.Dasum(n, rhs, 1) {
			bi.Dcopy(n, xp, 1, rhs, 1)
		}

		// Compute and return the updated sum of squares.
		return impl.Dlassq(n, rhs, 1, rdscal, rdsum)
	}

	// Apply permutations ipiv to rhs
	impl.Dlaswp(1, rhs, 1, 0, n-2, ipiv[:n-1], 1)

	// Solve for L-part choosing rhs either to +1 or -1.
	pmone := -1.0
	for j := 0; j < n-2; j++ {
		bp := rhs[j] + 1
		bm := rhs[j] - 1

		// Look-ahead for L-part rhs[0:n-2] = +1 or -1, splus and sminu computed
		// more efficiently than in https://doi.org/10.1109/9.29404.
		splus := 1 + bi.Ddot(n-j-1, z[(j+1)*ldz+j:], ldz, z[(j+1)*ldz+j:], ldz)
		sminu := bi.Ddot(n-j-1, z[(j+1)*ldz+j:], ldz, rhs[j+1:], 1)
		splus *= rhs[j]
		switch {
		case splus > sminu:
			rhs[j] = bp
		case sminu > splus:
			rhs[j] = bm
		default:
			// In this case the updating sums are equal and we can choose rsh[j]
			// +1 or -1. The first time this happens we choose -1, thereafter
			// +1. This is a simple way to get good estimates of matrices like
			// Byers well-known example (see https://doi.org/10.1109/9.29404).
			rhs[j] += pmone
			pmone = 1
		}

		// Compute remaining rhs.
		bi.Daxpy(n-j-1, -rhs[j], z[(j+1)*ldz+j:], ldz, rhs[j+1:], 1)
	}

	// Solve for U-part, look-ahead for rhs[n-1] = ±1. This is not done in
	// Bsolve and will hopefully give us a better estimate because any
	// ill-conditioning of the original matrix is transferred to U and not to L.
	// U[n-1,n-1] is an approximation to sigma_min(LU).
	bi.Dcopy(n-1, rhs, 1, xp, 1)
	xp[n-1] = rhs[n-1] + 1
	rhs[n-1] -= 1
	var splus, sminu float64
	for i := n - 1; i >= 0; i-- {
		tmp := 1 / z[i*ldz+i]
		xp[i] *= tmp
		rhs[i] *= tmp
		for k := i + 1; k < n; k++ {
			xp[i] -= xp[k] * (z[i*ldz+k] * tmp)
			rhs[i] -= rhs[k] * (z[i*ldz+k] * tmp)
		}
		splus += math.Abs(xp[i])
		sminu += math.Abs(rhs[i])
	}
	if splus > sminu {
		bi.Dcopy(n, xp, 1, rhs, 1)
	}

	// Apply the permutations jpiv to the computed solution (rhs).
	impl.Dlaswp(1, rhs, 1, 0, n-2, jpiv[:n-1], -1)

	// Compute and return the updated sum of squares.
	return impl.Dlassq(n, rhs, 1, rdscal, rdsum)
}
