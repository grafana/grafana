// Copyright ©2015 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package gonum

import (
	"gonum.org/v1/gonum/blas"
	"gonum.org/v1/gonum/lapack"
)

// Dorglq generates an m×n matrix Q with orthonormal rows defined as the first m
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
// tau must have length at least k, work must have length at least lwork and
// lwork must be at least max(1,m). On return, optimal value of lwork will be
// stored in work[0]. It must also hold that 0 <= k <= m <= n, otherwise Dorglq
// will panic.
//
// If lwork == -1, instead of performing Dorglq, the function only calculates
// the optimal value of lwork and stores it into work[0].
func (impl Implementation) Dorglq(m, n, k int, a []float64, lda int, tau, work []float64, lwork int) {
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
	case lwork < max(1, m) && lwork != -1:
		panic(badLWork)
	case len(work) < max(1, lwork):
		panic(shortWork)
	}

	if m == 0 {
		work[0] = 1
		return
	}

	nb := impl.Ilaenv(1, "DORGLQ", " ", m, n, k, -1)
	if lwork == -1 {
		work[0] = float64(m * nb)
		return
	}

	switch {
	case len(a) < (m-1)*lda+n:
		panic(shortA)
	case len(tau) < k:
		panic(shortTau)
	}

	nbmin := 2 // Minimum block size
	var nx int // Crossover size from blocked to unblocked code
	iws := m   // Length of work needed
	var ldwork int
	if 1 < nb && nb < k {
		nx = max(0, impl.Ilaenv(3, "DORGLQ", " ", m, n, k, -1))
		if nx < k {
			ldwork = nb
			iws = m * ldwork
			if lwork < iws {
				nb = lwork / m
				ldwork = nb
				nbmin = max(2, impl.Ilaenv(2, "DORGLQ", " ", m, n, k, -1))
			}
		}
	}

	var ki, kk int
	if nbmin <= nb && nb < k && nx < k {
		// The first kk rows are handled by the blocked method.
		ki = ((k - nx - 1) / nb) * nb
		kk = min(k, ki+nb)
		for i := kk; i < m; i++ {
			for j := 0; j < kk; j++ {
				a[i*lda+j] = 0
			}
		}
	}
	if kk < m {
		// Perform the operation on columns kk to the end.
		impl.Dorgl2(m-kk, n-kk, k-kk, a[kk*lda+kk:], lda, tau[kk:], work)
	}
	if kk > 0 {
		// Perform the operation on column-blocks
		for i := ki; i >= 0; i -= nb {
			ib := min(nb, k-i)
			if i+ib < m {
				impl.Dlarft(lapack.Forward, lapack.RowWise,
					n-i, ib,
					a[i*lda+i:], lda,
					tau[i:],
					work, ldwork)

				impl.Dlarfb(blas.Right, blas.Trans, lapack.Forward, lapack.RowWise,
					m-i-ib, n-i, ib,
					a[i*lda+i:], lda,
					work, ldwork,
					a[(i+ib)*lda+i:], lda,
					work[ib*ldwork:], ldwork)
			}
			impl.Dorgl2(ib, n-i, ib, a[i*lda+i:], lda, tau[i:], work)
			for l := i; l < i+ib; l++ {
				for j := 0; j < i; j++ {
					a[l*lda+j] = 0
				}
			}
		}
	}
	work[0] = float64(iws)
}
