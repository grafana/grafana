// Copyright ©2021 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package gonum

import (
	"math"

	"gonum.org/v1/gonum/blas/blas64"
)

// Dgetc2 computes an LU factorization with complete pivoting of the n×n matrix
// A. The factorization has the form
//
//	A = P * L * U * Q,
//
// where P and Q are permutation matrices, L is lower triangular with unit
// diagonal elements and U is upper triangular.
//
// On entry, a contains the matrix A to be factored. On return, a is overwritten
// with the factors L and U. The unit diagonal elements of L are not stored.
//
// On return, ipiv and jpiv contain the pivot indices: row i has been
// interchanged with row ipiv[i] and column j has been interchanged with column
// jpiv[j]. ipiv and jpiv must have length n, otherwise Dgetc2 will panic.
//
// If k is non-negative, then U[k,k] is likely to produce overflow when solving
// for x in A*x=b and U has been perturbed to avoid the overflow.
//
// Dgetc2 is an internal routine. It is exported for testing purposes.
func (impl Implementation) Dgetc2(n int, a []float64, lda int, ipiv, jpiv []int) (k int) {
	switch {
	case n < 0:
		panic(nLT0)
	case lda < max(1, n):
		panic(badLdA)
	}

	// Negative k indicates U was not perturbed.
	k = -1

	// Quick return if possible.
	if n == 0 {
		return k
	}

	switch {
	case len(a) < (n-1)*lda+n:
		panic(shortA)
	case len(ipiv) != n:
		panic(badLenIpiv)
	case len(jpiv) != n:
		panic(badLenJpvt)
	}

	const (
		eps    = dlamchP
		smlnum = dlamchS / eps
	)

	if n == 1 {
		ipiv[0], jpiv[0] = 0, 0
		if math.Abs(a[0]) < smlnum {
			k = 0
			a[0] = smlnum
		}
		return k
	}

	// Factorize A using complete pivoting.
	// Set pivots less than smin to smin.
	var smin float64
	var ipv, jpv int
	bi := blas64.Implementation()
	for i := 0; i < n-1; i++ {
		var xmax float64
		for ip := i; ip < n; ip++ {
			for jp := i; jp < n; jp++ {
				if math.Abs(a[ip*lda+jp]) >= xmax {
					xmax = math.Abs(a[ip*lda+jp])
					ipv = ip
					jpv = jp
				}
			}
		}
		if i == 0 {
			smin = math.Max(eps*xmax, smlnum)
		}

		// Swap rows.
		if ipv != i {
			bi.Dswap(n, a[ipv*lda:], 1, a[i*lda:], 1)
		}
		ipiv[i] = ipv

		// Swap columns.
		if jpv != i {
			bi.Dswap(n, a[jpv:], lda, a[i:], lda)
		}
		jpiv[i] = jpv

		// Check for singularity.
		if math.Abs(a[i*lda+i]) < smin {
			k = i
			a[i*lda+i] = smin
		}

		for j := i + 1; j < n; j++ {
			a[j*lda+i] /= a[i*lda+i]
		}
		bi.Dger(n-i-1, n-i-1, -1, a[(i+1)*lda+i:], lda, a[i*lda+i+1:], 1, a[(i+1)*lda+i+1:], lda)
	}

	if math.Abs(a[(n-1)*lda+n-1]) < smin {
		k = n - 1
		a[(n-1)*lda+(n-1)] = smin
	}

	// Set last pivots to last index.
	ipiv[n-1] = n - 1
	jpiv[n-1] = n - 1

	return k
}
