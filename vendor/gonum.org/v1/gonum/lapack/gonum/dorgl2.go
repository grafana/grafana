// Copyright ©2015 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package gonum

import (
	"gonum.org/v1/gonum/blas"
	"gonum.org/v1/gonum/blas/blas64"
)

// Dorgl2 generates an m×n matrix Q with orthonormal rows defined as the first m
// rows of a product of k elementary reflectors of order n
//
//	Q = H_{k-1} * ... * H_0
//
// as returned by Dgelqf.
//
// On entry, tau and the first k rows of A must contain the scalar factors and
// the vectors, respectively, which define the elementary reflectors H_i,
// i=0,...,k-1, as returned by Dgelqf. On return, A contains the matrix Q.
//
// tau must have length at least k, work must have length at least m, and it
// must hold that 0 <= k <= m <= n, otherwise Dorgl2 will panic.
//
// Dorgl2 is an internal routine. It is exported for testing purposes.
func (impl Implementation) Dorgl2(m, n, k int, a []float64, lda int, tau, work []float64) {
	switch {
	case m < 0:
		panic(mLT0)
	case n < m:
		panic(nLTM)
	case k < 0:
		panic(kLT0)
	case k > m:
		panic(kGTM)
	case lda < max(1, n):
		panic(badLdA)
	}

	if m == 0 {
		return
	}

	switch {
	case len(a) < (m-1)*lda+n:
		panic(shortA)
	case len(tau) < k:
		panic(shortTau)
	case len(work) < m:
		panic(shortWork)
	}

	bi := blas64.Implementation()

	if k < m {
		for i := k; i < m; i++ {
			for j := 0; j < n; j++ {
				a[i*lda+j] = 0
			}
		}
		for j := k; j < m; j++ {
			a[j*lda+j] = 1
		}
	}
	for i := k - 1; i >= 0; i-- {
		if i < n-1 {
			if i < m-1 {
				a[i*lda+i] = 1
				impl.Dlarf(blas.Right, m-i-1, n-i, a[i*lda+i:], 1, tau[i], a[(i+1)*lda+i:], lda, work)
			}
			bi.Dscal(n-i-1, -tau[i], a[i*lda+i+1:], 1)
		}
		a[i*lda+i] = 1 - tau[i]
		for l := 0; l < i; l++ {
			a[i*lda+l] = 0
		}
	}
}
