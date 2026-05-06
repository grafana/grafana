// Copyright ©2021 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package gonum

import (
	"math"

	"gonum.org/v1/gonum/blas"
	"gonum.org/v1/gonum/blas/blas64"
)

// Dpstrf computes the Cholesky factorization with complete pivoting of an n×n
// symmetric positive semidefinite matrix A.
//
// The factorization has the form
//
//	Pᵀ * A * P = Uᵀ * U ,  if uplo = blas.Upper,
//	Pᵀ * A * P = L  * Lᵀ,  if uplo = blas.Lower,
//
// where U is an upper triangular matrix, L is lower triangular, and P is a
// permutation matrix.
//
// tol is a user-defined tolerance. The algorithm terminates if the pivot is
// less than or equal to tol. If tol is negative, then n*eps*max(A[k,k]) will be
// used instead.
//
// On return, A contains the factor U or L from the Cholesky factorization and
// piv contains P stored such that P[piv[k],k] = 1.
//
// Dpstrf returns the computed rank of A and whether the factorization can be
// used to solve a system. Dpstrf does not attempt to check that A is positive
// semi-definite, so if ok is false, the matrix A is either rank deficient or is
// not positive semidefinite.
//
// The length of piv must be n and the length of work must be at least 2*n,
// otherwise Dpstrf will panic.
//
// Dpstrf is an internal routine. It is exported for testing purposes.
func (impl Implementation) Dpstrf(uplo blas.Uplo, n int, a []float64, lda int, piv []int, tol float64, work []float64) (rank int, ok bool) {
	switch {
	case uplo != blas.Upper && uplo != blas.Lower:
		panic(badUplo)
	case n < 0:
		panic(nLT0)
	case lda < max(1, n):
		panic(badLdA)
	}

	// Quick return if possible.
	if n == 0 {
		return 0, true
	}

	switch {
	case len(a) < (n-1)*lda+n:
		panic(shortA)
	case len(piv) != n:
		panic(badLenPiv)
	case len(work) < 2*n:
		panic(shortWork)
	}

	// Get block size.
	nb := impl.Ilaenv(1, "DPOTRF", string(uplo), n, -1, -1, -1)
	if nb <= 1 || n <= nb {
		// Use unblocked code.
		return impl.Dpstf2(uplo, n, a, lda, piv, tol, work)
	}

	// Initialize piv.
	for i := range piv[:n] {
		piv[i] = i
	}

	// Compute the first pivot.
	pvt := 0
	ajj := a[0]
	for i := 1; i < n; i++ {
		aii := a[i*lda+i]
		if aii > ajj {
			pvt = i
			ajj = aii
		}
	}
	if ajj <= 0 || math.IsNaN(ajj) {
		return 0, false
	}

	// Compute stopping value if not supplied.
	dstop := tol
	if dstop < 0 {
		dstop = float64(n) * dlamchE * ajj
	}

	bi := blas64.Implementation()
	// Split work in half, the first half holds dot products.
	dots := work[:n]
	work2 := work[n : 2*n]
	if uplo == blas.Upper {
		// Compute the Cholesky factorization  Pᵀ * A * P = Uᵀ * U.
		for k := 0; k < n; k += nb {
			// Account for last block not being nb wide.
			jb := min(nb, n-k)
			// Set relevant part of dot products to zero.
			for i := k; i < n; i++ {
				dots[i] = 0
			}
			for j := k; j < k+jb; j++ {
				// Update dot products and compute possible pivots which are stored
				// in the second half of work.
				for i := j; i < n; i++ {
					if j > k {
						tmp := a[(j-1)*lda+i]
						dots[i] += tmp * tmp
					}
					work2[i] = a[i*lda+i] - dots[i]
				}
				if j > 0 {
					// Find the pivot.
					pvt = j
					ajj = work2[pvt]
					for l := j + 1; l < n; l++ {
						wl := work2[l]
						if wl > ajj {
							pvt = l
							ajj = wl
						}
					}
					// Test for exit.
					if ajj <= dstop || math.IsNaN(ajj) {
						a[j*lda+j] = ajj
						return j, false
					}
				}
				if j != pvt {
					// Swap pivot rows and columns.
					a[pvt*lda+pvt] = a[j*lda+j]
					bi.Dswap(j, a[j:], lda, a[pvt:], lda)
					if pvt < n-1 {
						bi.Dswap(n-pvt-1, a[j*lda+(pvt+1):], 1, a[pvt*lda+(pvt+1):], 1)
					}
					bi.Dswap(pvt-j-1, a[j*lda+(j+1):], 1, a[(j+1)*lda+pvt:], lda)
					// Swap dot products and piv.
					dots[j], dots[pvt] = dots[pvt], dots[j]
					piv[j], piv[pvt] = piv[pvt], piv[j]
				}
				ajj = math.Sqrt(ajj)
				a[j*lda+j] = ajj
				// Compute elements j+1:n of row j.
				if j < n-1 {
					bi.Dgemv(blas.Trans, j-k, n-j-1,
						-1, a[k*lda+j+1:], lda, a[k*lda+j:], lda,
						1, a[j*lda+j+1:], 1)
					bi.Dscal(n-j-1, 1/ajj, a[j*lda+j+1:], 1)
				}
			}
			// Update trailing matrix.
			if k+jb < n {
				j := k + jb
				bi.Dsyrk(blas.Upper, blas.Trans, n-j, jb,
					-1, a[k*lda+j:], lda, 1, a[j*lda+j:], lda)
			}
		}
	} else {
		// Compute the Cholesky factorization  Pᵀ * A * P = L * Lᵀ.
		for k := 0; k < n; k += nb {
			// Account for last block not being nb wide.
			jb := min(nb, n-k)
			// Set relevant part of dot products to zero.
			for i := k; i < n; i++ {
				dots[i] = 0
			}
			for j := k; j < k+jb; j++ {
				// Update dot products and compute possible pivots which are stored
				// in the second half of work.
				for i := j; i < n; i++ {
					if j > k {
						tmp := a[i*lda+(j-1)]
						dots[i] += tmp * tmp
					}
					work2[i] = a[i*lda+i] - dots[i]
				}
				if j > 0 {
					// Find the pivot.
					pvt = j
					ajj = work2[pvt]
					for l := j + 1; l < n; l++ {
						wl := work2[l]
						if wl > ajj {
							pvt = l
							ajj = wl
						}
					}
					// Test for exit.
					if ajj <= dstop || math.IsNaN(ajj) {
						a[j*lda+j] = ajj
						return j, false
					}
				}
				if j != pvt {
					// Swap pivot rows and columns.
					a[pvt*lda+pvt] = a[j*lda+j]
					bi.Dswap(j, a[j*lda:], 1, a[pvt*lda:], 1)
					if pvt < n-1 {
						bi.Dswap(n-pvt-1, a[(pvt+1)*lda+j:], lda, a[(pvt+1)*lda+pvt:], lda)
					}
					bi.Dswap(pvt-j-1, a[(j+1)*lda+j:], lda, a[pvt*lda+(j+1):], 1)
					// Swap dot products and piv.
					dots[j], dots[pvt] = dots[pvt], dots[j]
					piv[j], piv[pvt] = piv[pvt], piv[j]
				}
				ajj = math.Sqrt(ajj)
				a[j*lda+j] = ajj
				// Compute elements j+1:n of column j.
				if j < n-1 {
					bi.Dgemv(blas.NoTrans, n-j-1, j-k,
						-1, a[(j+1)*lda+k:], lda, a[j*lda+k:], 1,
						1, a[(j+1)*lda+j:], lda)
					bi.Dscal(n-j-1, 1/ajj, a[(j+1)*lda+j:], lda)
				}
			}
			// Update trailing matrix.
			if k+jb < n {
				j := k + jb
				bi.Dsyrk(blas.Lower, blas.NoTrans, n-j, jb,
					-1, a[j*lda+k:], lda, 1, a[j*lda+j:], lda)
			}
		}
	}
	return n, true
}
