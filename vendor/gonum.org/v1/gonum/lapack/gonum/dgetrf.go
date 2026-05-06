// Copyright ©2015 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package gonum

import (
	"gonum.org/v1/gonum/blas"
	"gonum.org/v1/gonum/blas/blas64"
)

// Dgetrf computes the LU decomposition of an m×n matrix A using partial
// pivoting with row interchanges.
//
// The LU decomposition is a factorization of A into
//
//	A = P * L * U
//
// where P is a permutation matrix, L is a lower triangular with unit diagonal
// elements (lower trapezoidal if m > n), and U is upper triangular (upper
// trapezoidal if m < n).
//
// On entry, a contains the matrix A. On return, L and U are stored in place
// into a, and P is represented by ipiv.
//
// ipiv contains a sequence of row interchanges. It indicates that row i of the
// matrix was interchanged with ipiv[i]. ipiv must have length min(m,n), and
// Dgetrf will panic otherwise. ipiv is zero-indexed.
//
// Dgetrf returns whether the matrix A is nonsingular. The LU decomposition will
// be computed regardless of the singularity of A, but the result should not be
// used to solve a system of equation.
func (impl Implementation) Dgetrf(m, n int, a []float64, lda int, ipiv []int) (ok bool) {
	mn := min(m, n)
	switch {
	case m < 0:
		panic(mLT0)
	case n < 0:
		panic(nLT0)
	case lda < max(1, n):
		panic(badLdA)
	}

	// Quick return if possible.
	if mn == 0 {
		return true
	}

	switch {
	case len(a) < (m-1)*lda+n:
		panic(shortA)
	case len(ipiv) != mn:
		panic(badLenIpiv)
	}

	bi := blas64.Implementation()

	nb := impl.Ilaenv(1, "DGETRF", " ", m, n, -1, -1)
	if nb <= 1 || mn <= nb {
		// Use the unblocked algorithm.
		return impl.Dgetf2(m, n, a, lda, ipiv)
	}
	ok = true
	for j := 0; j < mn; j += nb {
		jb := min(mn-j, nb)
		blockOk := impl.Dgetf2(m-j, jb, a[j*lda+j:], lda, ipiv[j:j+jb])
		if !blockOk {
			ok = false
		}
		for i := j; i <= min(m-1, j+jb-1); i++ {
			ipiv[i] = j + ipiv[i]
		}
		impl.Dlaswp(j, a, lda, j, j+jb-1, ipiv[:j+jb], 1)
		if j+jb < n {
			impl.Dlaswp(n-j-jb, a[j+jb:], lda, j, j+jb-1, ipiv[:j+jb], 1)
			bi.Dtrsm(blas.Left, blas.Lower, blas.NoTrans, blas.Unit,
				jb, n-j-jb, 1,
				a[j*lda+j:], lda,
				a[j*lda+j+jb:], lda)
			if j+jb < m {
				bi.Dgemm(blas.NoTrans, blas.NoTrans, m-j-jb, n-j-jb, jb, -1,
					a[(j+jb)*lda+j:], lda,
					a[j*lda+j+jb:], lda,
					1, a[(j+jb)*lda+j+jb:], lda)
			}
		}
	}
	return ok
}
