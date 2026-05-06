// Copyright ©2015 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package gonum

import (
	"math"

	"gonum.org/v1/gonum/blas"
	"gonum.org/v1/gonum/blas/blas64"
	"gonum.org/v1/gonum/lapack"
)

// Dgecon estimates and returns the reciprocal of the condition number of the
// n×n matrix A, in either the 1-norm or the ∞-norm, using the LU factorization
// computed by Dgetrf.
//
// An estimate is obtained for norm(A⁻¹), and the reciprocal of the condition
// number rcond is computed as
//
//	rcond 1 / ( norm(A) * norm(A⁻¹) ).
//
// If n is zero, rcond is always 1.
//
// anorm is the 1-norm or the ∞-norm of the original matrix A. anorm must be
// non-negative, otherwise Dgecon will panic. If anorm is 0 or infinity, Dgecon
// returns 0. If anorm is NaN, Dgecon returns NaN.
//
// work must have length at least 4*n and iwork must have length at least n,
// otherwise Dgecon will panic.
func (impl Implementation) Dgecon(norm lapack.MatrixNorm, n int, a []float64, lda int, anorm float64, work []float64, iwork []int) float64 {
	switch {
	case norm != lapack.MaxColumnSum && norm != lapack.MaxRowSum:
		panic(badNorm)
	case n < 0:
		panic(nLT0)
	case lda < max(1, n):
		panic(badLdA)
	case anorm < 0:
		panic(negANorm)
	}

	// Quick return if possible.
	if n == 0 {
		return 1
	}

	switch {
	case len(a) < (n-1)*lda+n:
		panic(shortA)
	case len(work) < 4*n:
		panic(shortWork)
	case len(iwork) < n:
		panic(shortIWork)
	}

	// Quick return if possible.
	switch {
	case anorm == 0:
		return 0
	case math.IsNaN(anorm):
		// Propagate NaN.
		return anorm
	case math.IsInf(anorm, 1):
		return 0
	}

	bi := blas64.Implementation()
	var rcond, ainvnm float64
	var kase int
	var normin bool
	isave := new([3]int)
	onenrm := norm == lapack.MaxColumnSum
	smlnum := dlamchS
	kase1 := 2
	if onenrm {
		kase1 = 1
	}
	for {
		ainvnm, kase = impl.Dlacn2(n, work[n:], work, iwork, ainvnm, kase, isave)
		if kase == 0 {
			if ainvnm != 0 {
				rcond = (1 / ainvnm) / anorm
			}
			return rcond
		}
		var sl, su float64
		if kase == kase1 {
			sl = impl.Dlatrs(blas.Lower, blas.NoTrans, blas.Unit, normin, n, a, lda, work, work[2*n:])
			su = impl.Dlatrs(blas.Upper, blas.NoTrans, blas.NonUnit, normin, n, a, lda, work, work[3*n:])
		} else {
			su = impl.Dlatrs(blas.Upper, blas.Trans, blas.NonUnit, normin, n, a, lda, work, work[3*n:])
			sl = impl.Dlatrs(blas.Lower, blas.Trans, blas.Unit, normin, n, a, lda, work, work[2*n:])
		}
		scale := sl * su
		normin = true
		if scale != 1 {
			ix := bi.Idamax(n, work, 1)
			if scale == 0 || scale < math.Abs(work[ix])*smlnum {
				return rcond
			}
			impl.Drscl(n, scale, work, 1)
		}
	}
}
