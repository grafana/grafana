// Copyright ©2023 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package gonum

// Dpttrs solves a tridiagonal system of the form
//
//	A * X = B
//
// using the L*D*Lᵀ factorization of A computed by Dpttrf. D is a diagonal
// matrix specified in d, L is a unit bidiagonal matrix whose subdiagonal is
// specified in e, and X and B are n×nrhs matrices.
func (impl Implementation) Dpttrs(n, nrhs int, d, e []float64, b []float64, ldb int) {
	switch {
	case n < 0:
		panic(nLT0)
	case nrhs < 0:
		panic(nrhsLT0)
	case ldb < max(1, nrhs):
		panic(badLdB)
	}

	// Quick return if possible.
	if n == 0 || nrhs == 0 {
		return
	}

	switch {
	case len(d) < n:
		panic(shortD)
	case len(e) < n-1:
		panic(shortE)
	case len(b) < (n-1)*ldb+nrhs:
		panic(shortB)
	}

	nb := 1
	if nrhs > 1 {
		nb = max(1, impl.Ilaenv(1, "DPTTRS", " ", n, nrhs, -1, -1))
	}

	if nb >= nrhs {
		impl.dptts2(n, nrhs, d, e, b, ldb)
	} else {
		for j := 0; j < nrhs; j += nb {
			jb := min(nrhs-j, nb)
			impl.dptts2(n, jb, d, e, b[j:], ldb)
		}
	}
}
