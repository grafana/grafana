// Copyright ©2023 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package gonum

// Dptsv computes the solution to system of linear equations
//
//	A * X = B
//
// where A is an n×n symmetric positive definite tridiagonal matrix, and X and B
// are n×nrhs matrices. A is factored as A = L*D*Lᵀ, and the factored form of A
// is then used to solve the system of equations.
//
// On entry, d contains the n diagonal elements of A and e contains the (n-1)
// subdiagonal elements of A. On return, d contains the n diagonal elements of
// the diagonal matrix D from the factorization A = L*D*Lᵀ and e contains the
// (n-1) subdiagonal elements of the unit bidiagonal factor L.
//
// Dptsv returns whether the solution X has been successfully computed.
func (impl Implementation) Dptsv(n, nrhs int, d, e []float64, b []float64, ldb int) (ok bool) {
	switch {
	case n < 0:
		panic(nLT0)
	case nrhs < 0:
		panic(nrhsLT0)
	case ldb < max(1, nrhs):
		panic(badLdB)
	}

	if n == 0 || nrhs == 0 {
		return true
	}

	switch {
	case len(d) < n:
		panic(shortD)
	case len(e) < n-1:
		panic(shortE)
	case len(b) < (n-1)*ldb+nrhs:
		panic(shortB)
	}

	ok = impl.Dpttrf(n, d, e)
	if ok {
		impl.Dpttrs(n, nrhs, d, e, b, ldb)
	}
	return ok
}
