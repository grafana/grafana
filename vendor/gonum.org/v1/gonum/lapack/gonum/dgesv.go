// Copyright ©2021 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package gonum

import "gonum.org/v1/gonum/blas"

// Dgesv computes the solution to a real system of linear equations
//
//	A * X = B
//
// where A is an n×n matrix and X and B are n×nrhs matrices.
//
// The LU decomposition with partial pivoting and row interchanges is used to
// factor A as
//
//	A = P * L * U
//
// where P is a permutation matrix, L is unit lower triangular, and U is upper
// triangular. On return, the factors L and U are stored in a; the unit diagonal
// elements of L are not stored. The row pivot indices that define the
// permutation matrix P are stored in ipiv.
//
// The factored form of A is then used to solve the system of equations A * X =
// B. On entry, b contains the right hand side matrix B. On return, if ok is
// true, b contains the solution matrix X.
func (impl Implementation) Dgesv(n, nrhs int, a []float64, lda int, ipiv []int, b []float64, ldb int) (ok bool) {
	switch {
	case n < 0:
		panic(nLT0)
	case nrhs < 0:
		panic(nrhsLT0)
	case lda < max(1, n):
		panic(badLdA)
	case ldb < max(1, nrhs):
		panic(badLdB)
	}

	// Quick return if possible.
	if n == 0 || nrhs == 0 {
		return true
	}

	switch {
	case len(a) < (n-1)*lda+n:
		panic(shortAB)
	case len(ipiv) != n:
		panic(badLenIpiv)
	case len(b) < (n-1)*ldb+nrhs:
		panic(shortB)
	}

	ok = impl.Dgetrf(n, n, a, lda, ipiv)
	if ok {
		impl.Dgetrs(blas.NoTrans, n, nrhs, a, lda, ipiv, b, ldb)
	}

	return ok
}
