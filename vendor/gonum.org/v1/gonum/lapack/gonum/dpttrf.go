// Copyright ©2023 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package gonum

// Dpttrf computes the L*D*Lᵀ factorization of an n×n symmetric positive
// definite tridiagonal matrix A and returns whether the factorization was
// successful.
//
// On entry, d and e contain the n diagonal and (n-1) subdiagonal elements,
// respectively, of A.
//
// On return, d contains the n diagonal elements of the diagonal matrix D and e
// contains the (n-1) subdiagonal elements of the unit bidiagonal matrix L.
func (impl Implementation) Dpttrf(n int, d, e []float64) (ok bool) {
	if n < 0 {
		panic(nLT0)
	}

	if n == 0 {
		return true
	}

	switch {
	case len(d) < n:
		panic(shortD)
	case len(e) < n-1:
		panic(shortE)
	}

	// Compute the L*D*Lᵀ (or Uᵀ*D*U) factorization of A.
	i4 := (n - 1) % 4
	for i := 0; i < i4; i++ {
		if d[i] <= 0 {
			return false
		}
		ei := e[i]
		e[i] /= d[i]
		d[i+1] -= e[i] * ei
	}
	for i := i4; i < n-4; i += 4 {
		// Drop out of the loop if d[i] <= 0: the matrix is not positive
		// definite.
		if d[i] <= 0 {
			return false
		}

		// Solve for e[i] and d[i+1].
		ei := e[i]
		e[i] /= d[i]
		d[i+1] -= e[i] * ei
		if d[i+1] <= 0 {
			return false
		}

		// Solve for e[i+1] and d[i+2].
		ei = e[i+1]
		e[i+1] /= d[i+1]
		d[i+2] -= e[i+1] * ei
		if d[i+2] <= 0 {
			return false
		}

		// Solve for e[i+2] and d[i+3].
		ei = e[i+2]
		e[i+2] /= d[i+2]
		d[i+3] -= e[i+2] * ei
		if d[i+3] <= 0 {
			return false
		}

		// Solve for e[i+3] and d[i+4].
		ei = e[i+3]
		e[i+3] /= d[i+3]
		d[i+4] -= e[i+3] * ei
	}
	// Check d[n-1] for positive definiteness.
	return d[n-1] > 0
}
