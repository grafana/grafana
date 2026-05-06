// Copyright ©2023 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package gonum

import "gonum.org/v1/gonum/blas/blas64"

// dptts2 solves a tridiagonal system of the form
//
//	A * X = B
//
// using the L*D*Lᵀ factorization of A computed by Dpttrf. D is a diagonal
// matrix specified in d, L is a unit bidiagonal matrix whose subdiagonal is
// specified in e, and X and B are n×nrhs matrices.
func (impl Implementation) dptts2(n, nrhs int, d, e []float64, b []float64, ldb int) {
	// Quick return if possible.
	if n <= 1 {
		if n == 1 {
			bi := blas64.Implementation()
			bi.Dscal(nrhs, 1/d[0], b, 1)
		}
		return
	}

	// Solve A * X = B using the factorization A = L*D*Lᵀ, overwriting each
	// right hand side vector with its solution.
	for j := 0; j < nrhs; j++ {
		// Solve L * x = b.
		for i := 1; i < n; i++ {
			b[i*ldb+j] -= b[(i-1)*ldb+j] * e[i-1]
		}
		// Solve D * Lᵀ * x = b.
		b[(n-1)*ldb+j] /= d[n-1]
		for i := n - 2; i >= 0; i-- {
			b[i*ldb+j] = b[i*ldb+j]/d[i] - b[(i+1)*ldb+j]*e[i]
		}
	}
}
