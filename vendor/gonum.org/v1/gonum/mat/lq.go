// Copyright ©2013 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package mat

import (
	"math"

	"gonum.org/v1/gonum/blas"
	"gonum.org/v1/gonum/blas/blas64"
	"gonum.org/v1/gonum/lapack"
	"gonum.org/v1/gonum/lapack/lapack64"
)

const badLQ = "mat: invalid LQ factorization"

// LQ is a type for creating and using the LQ factorization of a matrix.
type LQ struct {
	lq   *Dense
	q    *Dense
	tau  []float64
	cond float64
}

// Dims returns the dimensions of the matrix.
func (lq *LQ) Dims() (r, c int) {
	if lq.lq == nil {
		return 0, 0
	}
	return lq.lq.Dims()
}

// At returns the element at row i, column j.
func (lq *LQ) At(i, j int) float64 {
	m, n := lq.Dims()
	if uint(i) >= uint(m) {
		panic(ErrRowAccess)
	}
	if uint(j) >= uint(n) {
		panic(ErrColAccess)
	}

	var val float64
	for k := 0; k <= i; k++ {
		val += lq.lq.at(i, k) * lq.q.at(k, j)
	}
	return val
}

// T performs an implicit transpose by returning the receiver inside a
// Transpose.
func (lq *LQ) T() Matrix {
	return Transpose{lq}
}

func (lq *LQ) updateCond(norm lapack.MatrixNorm) {
	// Since A = L*Q, and Q is orthogonal, we get for the condition number κ
	//  κ(A) := |A| |A^-1| = |L*Q| |(L*Q)^-1| = |L| |Qᵀ * L^-1|
	//        = |L| |L^-1| = κ(L),
	// where we used that fact that Q^-1 = Qᵀ. However, this assumes that
	// the matrix norm is invariant under orthogonal transformations which
	// is not the case for CondNorm. Hopefully the error is negligible: κ
	// is only a qualitative measure anyway.
	m := lq.lq.mat.Rows
	work := getFloat64s(3*m, false)
	iwork := getInts(m, false)
	l := lq.lq.asTriDense(m, blas.NonUnit, blas.Lower)
	v := lapack64.Trcon(norm, l.mat, work, iwork)
	lq.cond = 1 / v
	putFloat64s(work)
	putInts(iwork)
}

// Factorize computes the LQ factorization of an m×n matrix a where m <= n. The LQ
// factorization always exists even if A is singular.
//
// The LQ decomposition is a factorization of the matrix A such that A = L * Q.
// The matrix Q is an orthonormal n×n matrix, and L is an m×n lower triangular matrix.
// L and Q can be extracted using the LTo and QTo methods.
func (lq *LQ) Factorize(a Matrix) {
	lq.factorize(a, CondNorm)
}

func (lq *LQ) factorize(a Matrix, norm lapack.MatrixNorm) {
	m, n := a.Dims()
	if m > n {
		panic(ErrShape)
	}
	if lq.lq == nil {
		lq.lq = &Dense{}
	}
	lq.lq.CloneFrom(a)
	work := []float64{0}
	lq.tau = make([]float64, m)
	lapack64.Gelqf(lq.lq.mat, lq.tau, work, -1)
	work = getFloat64s(int(work[0]), false)
	lapack64.Gelqf(lq.lq.mat, lq.tau, work, len(work))
	putFloat64s(work)
	lq.updateCond(norm)
	lq.updateQ()
}

func (lq *LQ) updateQ() {
	_, n := lq.Dims()
	if lq.q == nil {
		lq.q = NewDense(n, n, nil)
	} else {
		lq.q.reuseAsNonZeroed(n, n)
	}
	// Construct Q from the elementary reflectors.
	lq.q.Copy(lq.lq)
	work := []float64{0}
	lapack64.Orglq(lq.q.mat, lq.tau, work, -1)
	work = getFloat64s(int(work[0]), false)
	lapack64.Orglq(lq.q.mat, lq.tau, work, len(work))
	putFloat64s(work)
}

// isValid returns whether the receiver contains a factorization.
func (lq *LQ) isValid() bool {
	return lq.lq != nil && !lq.lq.IsEmpty()
}

// Cond returns the condition number for the factorized matrix.
// Cond will panic if the receiver does not contain a factorization.
func (lq *LQ) Cond() float64 {
	if !lq.isValid() {
		panic(badLQ)
	}
	return lq.cond
}

// TODO(btracey): Add in the "Reduced" forms for extracting the m×m orthogonal
// and upper triangular matrices.

// LTo extracts the m×n lower trapezoidal matrix from a LQ decomposition.
//
// If dst is empty, LTo will resize dst to be r×c. When dst is
// non-empty, LTo will panic if dst is not r×c. LTo will also panic
// if the receiver does not contain a successful factorization.
func (lq *LQ) LTo(dst *Dense) {
	if !lq.isValid() {
		panic(badLQ)
	}

	r, c := lq.lq.Dims()
	if dst.IsEmpty() {
		dst.ReuseAs(r, c)
	} else {
		r2, c2 := dst.Dims()
		if r != r2 || c != c2 {
			panic(ErrShape)
		}
	}

	// Disguise the LQ as a lower triangular.
	t := &TriDense{
		mat: blas64.Triangular{
			N:      r,
			Stride: lq.lq.mat.Stride,
			Data:   lq.lq.mat.Data,
			Uplo:   blas.Lower,
			Diag:   blas.NonUnit,
		},
		cap: lq.lq.capCols,
	}
	dst.Copy(t)

	if r == c {
		return
	}
	// Zero right of the triangular.
	for i := 0; i < r; i++ {
		zero(dst.mat.Data[i*dst.mat.Stride+r : i*dst.mat.Stride+c])
	}
}

// QTo extracts the n×n orthonormal matrix Q from an LQ decomposition.
//
// If dst is empty, QTo will resize dst to be n×n. When dst is
// non-empty, QTo will panic if dst is not n×n. QTo will also panic
// if the receiver does not contain a successful factorization.
func (lq *LQ) QTo(dst *Dense) {
	if !lq.isValid() {
		panic(badLQ)
	}

	_, n := lq.lq.Dims()
	if dst.IsEmpty() {
		dst.ReuseAs(n, n)
	} else {
		m2, n2 := dst.Dims()
		if n != m2 || n != n2 {
			panic(ErrShape)
		}
	}
	dst.Copy(lq.q)
}

// SolveTo finds a minimum-norm solution to a system of linear equations defined
// by the matrices A and b, where A is an m×n matrix represented in its LQ factorized
// form. If A is singular or near-singular a Condition error is returned.
// See the documentation for Condition for more information.
//
// The minimization problem solved depends on the input parameters.
//
//	If trans == false, find the minimum norm solution of A * X = B.
//	If trans == true, find X such that ||A*X - B||_2 is minimized.
//
// The solution matrix, X, is stored in place into dst.
// SolveTo will panic if the receiver does not contain a factorization.
func (lq *LQ) SolveTo(dst *Dense, trans bool, b Matrix) error {
	if !lq.isValid() {
		panic(badLQ)
	}

	r, c := lq.lq.Dims()
	br, bc := b.Dims()

	// The LQ solve algorithm stores the result in-place into the right hand side.
	// The storage for the answer must be large enough to hold both b and x.
	// However, this method's receiver must be the size of x. Copy b, and then
	// copy the result into x at the end.
	if trans {
		if c != br {
			panic(ErrShape)
		}
		dst.reuseAsNonZeroed(r, bc)
	} else {
		if r != br {
			panic(ErrShape)
		}
		dst.reuseAsNonZeroed(c, bc)
	}
	// Do not need to worry about overlap between x and b because w has its own
	// independent storage.
	w := getDenseWorkspace(max(r, c), bc, false)
	w.Copy(b)
	t := lq.lq.asTriDense(lq.lq.mat.Rows, blas.NonUnit, blas.Lower).mat
	if trans {
		work := []float64{0}
		lapack64.Ormlq(blas.Left, blas.NoTrans, lq.lq.mat, lq.tau, w.mat, work, -1)
		work = getFloat64s(int(work[0]), false)
		lapack64.Ormlq(blas.Left, blas.NoTrans, lq.lq.mat, lq.tau, w.mat, work, len(work))
		putFloat64s(work)

		ok := lapack64.Trtrs(blas.Trans, t, w.mat)
		if !ok {
			return Condition(math.Inf(1))
		}
	} else {
		ok := lapack64.Trtrs(blas.NoTrans, t, w.mat)
		if !ok {
			return Condition(math.Inf(1))
		}
		for i := r; i < c; i++ {
			zero(w.mat.Data[i*w.mat.Stride : i*w.mat.Stride+bc])
		}
		work := []float64{0}
		lapack64.Ormlq(blas.Left, blas.Trans, lq.lq.mat, lq.tau, w.mat, work, -1)
		work = getFloat64s(int(work[0]), false)
		lapack64.Ormlq(blas.Left, blas.Trans, lq.lq.mat, lq.tau, w.mat, work, len(work))
		putFloat64s(work)
	}
	// x was set above to be the correct size for the result.
	dst.Copy(w)
	putDenseWorkspace(w)
	if lq.cond > ConditionTolerance {
		return Condition(lq.cond)
	}
	return nil
}

// SolveVecTo finds a minimum-norm solution to a system of linear equations.
// See LQ.SolveTo for the full documentation.
// SolveToVec will panic if the receiver does not contain a factorization.
func (lq *LQ) SolveVecTo(dst *VecDense, trans bool, b Vector) error {
	if !lq.isValid() {
		panic(badLQ)
	}

	r, c := lq.lq.Dims()
	if _, bc := b.Dims(); bc != 1 {
		panic(ErrShape)
	}

	// The Solve implementation is non-trivial, so rather than duplicate the code,
	// instead recast the VecDenses as Dense and call the matrix code.
	bm := Matrix(b)
	if rv, ok := b.(RawVectorer); ok {
		bmat := rv.RawVector()
		if dst != b {
			dst.checkOverlap(bmat)
		}
		b := VecDense{mat: bmat}
		bm = b.asDense()
	}
	if trans {
		dst.reuseAsNonZeroed(r)
	} else {
		dst.reuseAsNonZeroed(c)
	}
	return lq.SolveTo(dst.asDense(), trans, bm)
}
