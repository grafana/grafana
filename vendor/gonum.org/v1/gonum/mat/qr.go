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

const badQR = "mat: invalid QR factorization"

// QR is a type for creating and using the QR factorization of a matrix.
type QR struct {
	qr   *Dense
	q    *Dense
	tau  []float64
	cond float64
}

// Dims returns the dimensions of the matrix.
func (qr *QR) Dims() (r, c int) {
	if qr.qr == nil {
		return 0, 0
	}
	return qr.qr.Dims()
}

// At returns the element at row i, column j. At will panic if the receiver
// does not contain a successful factorization.
func (qr *QR) At(i, j int) float64 {
	if !qr.isValid() {
		panic(badQR)
	}

	m, n := qr.Dims()
	if uint(i) >= uint(m) {
		panic(ErrRowAccess)
	}
	if uint(j) >= uint(n) {
		panic(ErrColAccess)
	}

	if qr.q == nil || qr.q.IsEmpty() {
		// Calculate Qi, Q i-th row
		qi := getFloat64s(m, true)
		qr.qRowTo(i, qi)

		// Compute QR(i,j)
		var val float64
		for k := 0; k <= j; k++ {
			val += qi[k] * qr.qr.at(k, j)
		}
		putFloat64s(qi)
		return val
	}

	var val float64
	for k := 0; k <= j; k++ {
		val += qr.q.at(i, k) * qr.qr.at(k, j)
	}
	return val
}

// qRowTo extracts the i-th row of the orthonormal matrix Q from a QR
// decomposition.
func (qr *QR) qRowTo(i int, dst []float64) {
	c := blas64.General{
		Rows:   1,
		Cols:   len(dst),
		Stride: len(dst),
		Data:   dst,
	}
	c.Data[i] = 1 // C is the i-th unit vector

	// Construct Qi from the elementary reflectors: Qi = C * (H(1) H(2) ... H(nTau))
	work := []float64{0}
	lapack64.Ormqr(blas.Right, blas.NoTrans, qr.qr.mat, qr.tau, c, work, -1)
	work = getFloat64s(int(work[0]), false)
	lapack64.Ormqr(blas.Right, blas.NoTrans, qr.qr.mat, qr.tau, c, work, len(work))
	putFloat64s(work)
}

// T performs an implicit transpose by returning the receiver inside a
// Transpose.
func (qr *QR) T() Matrix {
	return Transpose{qr}
}

func (qr *QR) updateCond(norm lapack.MatrixNorm) {
	// Since A = Q*R, and Q is orthogonal, we get for the condition number κ
	//  κ(A) := |A| |A^-1| = |Q*R| |(Q*R)^-1| = |R| |R^-1 * Qᵀ|
	//        = |R| |R^-1| = κ(R),
	// where we used that fact that Q^-1 = Qᵀ. However, this assumes that
	// the matrix norm is invariant under orthogonal transformations which
	// is not the case for CondNorm. Hopefully the error is negligible: κ
	// is only a qualitative measure anyway.
	n := qr.qr.mat.Cols
	work := getFloat64s(3*n, false)
	iwork := getInts(n, false)
	r := qr.qr.asTriDense(n, blas.NonUnit, blas.Upper)
	v := lapack64.Trcon(norm, r.mat, work, iwork)
	putFloat64s(work)
	putInts(iwork)
	qr.cond = 1 / v
}

// Factorize computes the QR factorization of an m×n matrix a where m >= n. The QR
// factorization always exists even if A is singular.
//
// The QR decomposition is a factorization of the matrix A such that A = Q * R.
// The matrix Q is an orthonormal m×m matrix, and R is an m×n upper triangular matrix.
// Q and R can be extracted using the QTo and RTo methods.
func (qr *QR) Factorize(a Matrix) {
	qr.factorize(a, CondNorm)
}

func (qr *QR) factorize(a Matrix, norm lapack.MatrixNorm) {
	m, n := a.Dims()
	if m < n {
		panic(ErrShape)
	}
	if qr.qr == nil {
		qr.qr = &Dense{}
	}
	qr.qr.CloneFrom(a)
	work := []float64{0}
	qr.tau = make([]float64, n)
	lapack64.Geqrf(qr.qr.mat, qr.tau, work, -1)
	work = getFloat64s(int(work[0]), false)
	lapack64.Geqrf(qr.qr.mat, qr.tau, work, len(work))
	putFloat64s(work)
	qr.updateCond(norm)
	if qr.q != nil {
		qr.q.Reset()
	}
}

func (qr *QR) updateQ() {
	m, _ := qr.Dims()
	if qr.q == nil {
		qr.q = NewDense(m, m, nil)
	} else {
		qr.q.reuseAsNonZeroed(m, m)
	}
	// Construct Q from the elementary reflectors.
	qr.q.Copy(qr.qr)
	work := []float64{0}
	lapack64.Orgqr(qr.q.mat, qr.tau, work, -1)
	work = getFloat64s(int(work[0]), false)
	lapack64.Orgqr(qr.q.mat, qr.tau, work, len(work))
	putFloat64s(work)
}

// isValid returns whether the receiver contains a factorization.
func (qr *QR) isValid() bool {
	return qr.qr != nil && !qr.qr.IsEmpty()
}

// Cond returns the condition number for the factorized matrix.
// Cond will panic if the receiver does not contain a factorization.
func (qr *QR) Cond() float64 {
	if !qr.isValid() {
		panic(badQR)
	}
	return qr.cond
}

// TODO(btracey): Add in the "Reduced" forms for extracting the n×n orthogonal
// and upper triangular matrices.

// RTo extracts the m×n upper trapezoidal matrix from a QR decomposition.
//
// If dst is empty, RTo will resize dst to be r×c. When dst is non-empty,
// RTo will panic if dst is not r×c. RTo will also panic if the receiver
// does not contain a successful factorization.
func (qr *QR) RTo(dst *Dense) {
	if !qr.isValid() {
		panic(badQR)
	}

	r, c := qr.qr.Dims()
	if dst.IsEmpty() {
		dst.ReuseAs(r, c)
	} else {
		r2, c2 := dst.Dims()
		if r != r2 || c != c2 {
			panic(ErrShape)
		}
	}

	// Disguise the QR as an upper triangular
	t := &TriDense{
		mat: blas64.Triangular{
			N:      c,
			Stride: qr.qr.mat.Stride,
			Data:   qr.qr.mat.Data,
			Uplo:   blas.Upper,
			Diag:   blas.NonUnit,
		},
		cap: qr.qr.capCols,
	}
	dst.Copy(t)

	// Zero below the triangular.
	for i := r; i < c; i++ {
		zero(dst.mat.Data[i*dst.mat.Stride : i*dst.mat.Stride+c])
	}
}

// QTo extracts the r×r orthonormal matrix Q from a QR decomposition.
//
// If dst is empty, QTo will resize dst to be r×r. When dst is non-empty,
// QTo will panic if dst is not r×r. QTo will also panic if the receiver
// does not contain a successful factorization.
func (qr *QR) QTo(dst *Dense) {
	if !qr.isValid() {
		panic(badQR)
	}

	r, _ := qr.qr.Dims()
	if dst.IsEmpty() {
		dst.ReuseAs(r, r)
	} else {
		r2, c2 := dst.Dims()
		if r != r2 || r != c2 {
			panic(ErrShape)
		}
	}

	if qr.q == nil || qr.q.IsEmpty() {
		qr.updateQ()
	}
	dst.Copy(qr.q)
}

// SolveTo finds a minimum-norm solution to a system of linear equations defined
// by the matrices A and b, where A is an m×n matrix represented in its QR factorized
// form. If A is singular or near-singular a Condition error is returned.
// See the documentation for Condition for more information.
//
// The minimization problem solved depends on the input parameters.
//
//	If trans == false, find X such that ||A*X - B||_2 is minimized.
//	If trans == true, find the minimum norm solution of Aᵀ * X = B.
//
// The solution matrix, X, is stored in place into dst.
// SolveTo will panic if the receiver does not contain a factorization.
func (qr *QR) SolveTo(dst *Dense, trans bool, b Matrix) error {
	if !qr.isValid() {
		panic(badQR)
	}

	r, c := qr.qr.Dims()
	br, bc := b.Dims()

	// The QR solve algorithm stores the result in-place into the right hand side.
	// The storage for the answer must be large enough to hold both b and x.
	// However, this method's receiver must be the size of x. Copy b, and then
	// copy the result into m at the end.
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
	// Do not need to worry about overlap between m and b because x has its own
	// independent storage.
	w := getDenseWorkspace(max(r, c), bc, false)
	w.Copy(b)
	t := qr.qr.asTriDense(qr.qr.mat.Cols, blas.NonUnit, blas.Upper).mat
	if trans {
		ok := lapack64.Trtrs(blas.Trans, t, w.mat)
		if !ok {
			return Condition(math.Inf(1))
		}
		for i := c; i < r; i++ {
			zero(w.mat.Data[i*w.mat.Stride : i*w.mat.Stride+bc])
		}
		work := []float64{0}
		lapack64.Ormqr(blas.Left, blas.NoTrans, qr.qr.mat, qr.tau, w.mat, work, -1)
		work = getFloat64s(int(work[0]), false)
		lapack64.Ormqr(blas.Left, blas.NoTrans, qr.qr.mat, qr.tau, w.mat, work, len(work))
		putFloat64s(work)
	} else {
		work := []float64{0}
		lapack64.Ormqr(blas.Left, blas.Trans, qr.qr.mat, qr.tau, w.mat, work, -1)
		work = getFloat64s(int(work[0]), false)
		lapack64.Ormqr(blas.Left, blas.Trans, qr.qr.mat, qr.tau, w.mat, work, len(work))
		putFloat64s(work)

		ok := lapack64.Trtrs(blas.NoTrans, t, w.mat)
		if !ok {
			return Condition(math.Inf(1))
		}
	}
	// X was set above to be the correct size for the result.
	dst.Copy(w)
	putDenseWorkspace(w)
	if qr.cond > ConditionTolerance {
		return Condition(qr.cond)
	}
	return nil
}

// SolveVecTo finds a minimum-norm solution to a system of linear equations,
//
//	Ax = b.
//
// See QR.SolveTo for the full documentation.
// SolveVecTo will panic if the receiver does not contain a factorization.
func (qr *QR) SolveVecTo(dst *VecDense, trans bool, b Vector) error {
	if !qr.isValid() {
		panic(badQR)
	}

	r, c := qr.qr.Dims()
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
	return qr.SolveTo(dst.asDense(), trans, bm)
}
