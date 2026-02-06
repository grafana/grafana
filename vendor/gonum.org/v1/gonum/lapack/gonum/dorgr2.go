// Copyright ©2021 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package gonum

import (
	"gonum.org/v1/gonum/blas"
	"gonum.org/v1/gonum/blas/blas64"
)

// Dorgr2 generates an m×n real matrix Q with orthonormal rows, which is defined
// as the last m rows of a product of k elementary reflectors of order n
//
//	Q = H_0 * H_1 * ... * H_{k-1}
//
// as returned by Dgerqf.
//
// On entry, the (m-k+i)-th row of A must contain the vector which defines the
// elementary reflector H_i, for i = 0,1,...,k, as returned by Dgerqf. On
// return, A will contain the m×n matrix Q.
//
// The i-th element of tau must contain the scalar factor of the elementary
// reflector H_i, as returned by Dgerqf.
//
// It must hold that
//
//	n >= m >= k >= 0,
//
// the length of tau must be k and the length of work must be m, otherwise
// Dorgr2 will panic.
//
// Dorgr2 is an internal routine. It is exported for testing purposes.
func (impl Implementation) Dorgr2(m, n, k int, a []float64, lda int, tau, work []float64) {
	switch {
	case k < 0:
		panic(kLT0)
	case m < k:
		panic(kGTM)
	case n < m:
		panic(mGTN)
	case lda < max(1, n):
		panic(badLdA)
	}

	// Quick return if possible.
	if m == 0 {
		return
	}

	switch {
	case len(tau) != k:
		panic(badLenTau)
	case len(a) < (m-1)*lda+n:
		panic(shortA)
	case len(work) < m:
		panic(shortWork)
	}

	// Initialise rows 0:m-k to rows of the unit matrix.
	for l := 0; l < m-k; l++ {
		row := a[l*lda : l*lda+n]
		for j := range row {
			row[j] = 0
		}
		a[l*lda+n-m+l] = 1
	}
	bi := blas64.Implementation()
	for i := 0; i < k; i++ {
		ii := m - k + i

		// Apply H_i to A[0:m-k+i+1, 0:n-k+i+1] from the right.
		a[ii*lda+n-m+ii] = 1
		impl.Dlarf(blas.Right, ii, n-m+ii+1, a[ii*lda:], 1, tau[i], a, lda, work)
		bi.Dscal(n-m+ii, -tau[i], a[ii*lda:], 1)
		a[ii*lda+n-m+ii] = 1 - tau[i]

		// Set A[m-k+i, n-k+i:n] to zero.
		for l := n - m + ii + 1; l < n; l++ {
			a[ii*lda+l] = 0
		}
	}
}
