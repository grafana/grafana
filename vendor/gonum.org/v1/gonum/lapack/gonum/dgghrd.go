// Copyright ©2023 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package gonum

import (
	"gonum.org/v1/gonum/blas"
	"gonum.org/v1/gonum/blas/blas64"
	"gonum.org/v1/gonum/lapack"
)

// Dgghrd reduces a pair of real matrices (A,B) to generalized upper Hessenberg
// form using orthogonal transformations, where A is a general matrix and B is
// upper triangular.
//
// This subroutine simultaneously reduces A to a Hessenberg matrix H
//
//	Qᵀ*A*Z = H,
//
// and transforms B to another upper triangular matrix T
//
//	Qᵀ*B*Z = T.
//
// The orthogonal matrices Q and Z are determined as products of Givens
// rotations. They may either be formed explicitly (lapack.OrthoExplicit), or
// they may be postmultiplied into input matrices Q1 and Z1
// (lapack.OrthoPostmul), so that
//
//	Q1 * A * Z1ᵀ = (Q1*Q) * H * (Z1*Z)ᵀ,
//	Q1 * B * Z1ᵀ = (Q1*Q) * T * (Z1*Z)ᵀ.
//
// ilo and ihi determine the block of A that will be reduced. It must hold that
//
//   - 0 <= ilo <= ihi < n      if n > 0,
//   - ilo == 0 and ihi == -1   if n == 0,
//
// otherwise Dgghrd will panic.
//
// Dgghrd is an internal routine. It is exported for testing purposes.
func (impl Implementation) Dgghrd(compq, compz lapack.OrthoComp, n, ilo, ihi int, a []float64, lda int, b []float64, ldb int, q []float64, ldq int, z []float64, ldz int) {
	switch {
	case compq != lapack.OrthoNone && compq != lapack.OrthoExplicit && compq != lapack.OrthoPostmul:
		panic(badOrthoComp)
	case compz != lapack.OrthoNone && compz != lapack.OrthoExplicit && compz != lapack.OrthoPostmul:
		panic(badOrthoComp)
	case n < 0:
		panic(nLT0)
	case ilo < 0 || max(0, n-1) < ilo:
		panic(badIlo)
	case ihi < min(ilo, n-1) || n <= ihi:
		panic(badIhi)
	case lda < max(1, n):
		panic(badLdA)
	case ldb < max(1, n):
		panic(badLdB)
	case (compq != lapack.OrthoNone && ldq < n) || ldq < 1:
		panic(badLdQ)
	case (compz != lapack.OrthoNone && ldz < n) || ldz < 1:
		panic(badLdZ)
	}

	// Quick return if possible.
	if n == 0 {
		return
	}

	switch {
	case len(a) < (n-1)*lda+n:
		panic(shortA)
	case len(b) < (n-1)*ldb+n:
		panic(shortB)
	case compq != lapack.OrthoNone && len(q) < (n-1)*ldq+n:
		panic(shortQ)
	case compz != lapack.OrthoNone && len(z) < (n-1)*ldz+n:
		panic(shortZ)
	}

	if compq == lapack.OrthoExplicit {
		impl.Dlaset(blas.All, n, n, 0, 1, q, ldq)
	}
	if compz == lapack.OrthoExplicit {
		impl.Dlaset(blas.All, n, n, 0, 1, z, ldz)
	}

	// Quick return if possible.
	if n == 1 {
		return
	}

	// Zero out lower triangle of B.
	for i := 1; i < n; i++ {
		for j := 0; j < i; j++ {
			b[i*ldb+j] = 0
		}
	}
	bi := blas64.Implementation()
	// Reduce A and B.
	for jcol := ilo; jcol <= ihi-2; jcol++ {
		for jrow := ihi; jrow >= jcol+2; jrow-- {
			// Step 1: rotate rows jrow-1, jrow to kill A[jrow,jcol].
			var c, s float64
			c, s, a[(jrow-1)*lda+jcol] = impl.Dlartg(a[(jrow-1)*lda+jcol], a[jrow*lda+jcol])
			a[jrow*lda+jcol] = 0

			bi.Drot(n-jcol-1, a[(jrow-1)*lda+jcol+1:], 1, a[jrow*lda+jcol+1:], 1, c, s)
			bi.Drot(n+2-jrow-1, b[(jrow-1)*ldb+jrow-1:], 1, b[jrow*ldb+jrow-1:], 1, c, s)

			if compq != lapack.OrthoNone {
				bi.Drot(n, q[jrow-1:], ldq, q[jrow:], ldq, c, s)
			}

			// Step 2: rotate columns jrow, jrow-1 to kill B[jrow,jrow-1].
			c, s, b[jrow*ldb+jrow] = impl.Dlartg(b[jrow*ldb+jrow], b[jrow*ldb+jrow-1])
			b[jrow*ldb+jrow-1] = 0

			bi.Drot(ihi+1, a[jrow:], lda, a[jrow-1:], lda, c, s)
			bi.Drot(jrow, b[jrow:], ldb, b[jrow-1:], ldb, c, s)

			if compz != lapack.OrthoNone {
				bi.Drot(n, z[jrow:], ldz, z[jrow-1:], ldz, c, s)
			}
		}
	}
}
