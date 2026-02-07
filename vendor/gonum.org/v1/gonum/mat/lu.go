// Copyright ©2013 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package mat

import (
	"math"

	"gonum.org/v1/gonum/blas"
	"gonum.org/v1/gonum/blas/blas64"
	"gonum.org/v1/gonum/floats"
	"gonum.org/v1/gonum/lapack"
	"gonum.org/v1/gonum/lapack/lapack64"
)

const (
	badSliceLength = "mat: improper slice length"
	badLU          = "mat: invalid LU factorization"
)

// LU is a square n×n matrix represented by its LU factorization with partial
// pivoting.
//
// The factorization has the form
//
//	A = P * L * U
//
// where P is a permutation matrix, L is lower triangular with unit diagonal
// elements, and U is upper triangular.
//
// Note that this matrix representation is useful for certain operations, in
// particular for solving linear systems of equations. It is very inefficient at
// other operations, in particular At is slow.
type LU struct {
	lu    *Dense
	swaps []int
	piv   []int
	cond  float64
	ok    bool // Whether A is nonsingular
}

var _ Matrix = (*LU)(nil)

// Dims returns the dimensions of the matrix A.
func (lu *LU) Dims() (r, c int) {
	if lu.lu == nil {
		return 0, 0
	}
	return lu.lu.Dims()
}

// At returns the element of A at row i, column j.
func (lu *LU) At(i, j int) float64 {
	n, _ := lu.Dims()
	if uint(i) >= uint(n) {
		panic(ErrRowAccess)
	}
	if uint(j) >= uint(n) {
		panic(ErrColAccess)
	}

	i = lu.piv[i]
	var val float64
	for k := 0; k < min(i, j+1); k++ {
		val += lu.lu.at(i, k) * lu.lu.at(k, j)
	}
	if i <= j {
		val += lu.lu.at(i, j)
	}
	return val
}

// T performs an implicit transpose by returning the receiver inside a
// Transpose.
func (lu *LU) T() Matrix {
	return Transpose{lu}
}

// updateCond updates the stored condition number of the matrix. anorm is the
// norm of the original matrix. If anorm is negative it will be estimated.
func (lu *LU) updateCond(anorm float64, norm lapack.MatrixNorm) {
	n := lu.lu.mat.Cols
	work := getFloat64s(4*n, false)
	defer putFloat64s(work)
	iwork := getInts(n, false)
	defer putInts(iwork)
	if anorm < 0 {
		// This is an approximation. By the definition of a norm,
		//  |AB| <= |A| |B|.
		// Since A = L*U, we get for the condition number κ that
		//  κ(A) := |A| |A^-1| = |L*U| |A^-1| <= |L| |U| |A^-1|,
		// so this will overestimate the condition number somewhat.
		// The norm of the original factorized matrix cannot be stored
		// because of update possibilities.
		u := lu.lu.asTriDense(n, blas.NonUnit, blas.Upper)
		l := lu.lu.asTriDense(n, blas.Unit, blas.Lower)
		unorm := lapack64.Lantr(norm, u.mat, work)
		lnorm := lapack64.Lantr(norm, l.mat, work)
		anorm = unorm * lnorm
	}
	v := lapack64.Gecon(norm, lu.lu.mat, anorm, work, iwork)
	lu.cond = 1 / v
}

// Factorize computes the LU factorization of the square matrix A and stores the
// result in the receiver. The LU decomposition will complete regardless of the
// singularity of a.
//
// The L and U matrix factors can be extracted from the factorization using the
// LTo and UTo methods. The matrix P can be extracted as a row permutation using
// the RowPivots method and applied using Dense.PermuteRows.
func (lu *LU) Factorize(a Matrix) {
	lu.factorize(a, CondNorm)
}

func (lu *LU) factorize(a Matrix, norm lapack.MatrixNorm) {
	m, n := a.Dims()
	if m != n {
		panic(ErrSquare)
	}
	if lu.lu == nil {
		lu.lu = NewDense(n, n, nil)
	} else {
		lu.lu.Reset()
		lu.lu.reuseAsNonZeroed(n, n)
	}
	lu.lu.Copy(a)
	lu.swaps = useInt(lu.swaps, n)
	lu.piv = useInt(lu.piv, n)
	work := getFloat64s(n, false)
	anorm := lapack64.Lange(norm, lu.lu.mat, work)
	putFloat64s(work)
	lu.ok = lapack64.Getrf(lu.lu.mat, lu.swaps)
	lu.updatePivots(lu.swaps)
	lu.updateCond(anorm, norm)
}

func (lu *LU) updatePivots(swaps []int) {
	// Replay the sequence of row swaps in order to find the row permutation.
	for i := range lu.piv {
		lu.piv[i] = i
	}
	n, _ := lu.Dims()
	for i := n - 1; i >= 0; i-- {
		v := swaps[i]
		lu.piv[i], lu.piv[v] = lu.piv[v], lu.piv[i]
	}
}

// isValid returns whether the receiver contains a factorization.
func (lu *LU) isValid() bool {
	return lu.lu != nil && !lu.lu.IsEmpty()
}

// Cond returns the condition number for the factorized matrix.
// Cond will panic if the receiver does not contain a factorization.
func (lu *LU) Cond() float64 {
	if !lu.isValid() {
		panic(badLU)
	}
	return lu.cond
}

// Reset resets the factorization so that it can be reused as the receiver of a
// dimensionally restricted operation.
func (lu *LU) Reset() {
	if lu.lu != nil {
		lu.lu.Reset()
	}
	lu.swaps = lu.swaps[:0]
	lu.piv = lu.piv[:0]
}

func (lu *LU) isZero() bool {
	return len(lu.swaps) == 0
}

// Det returns the determinant of the matrix that has been factorized. In many
// expressions, using LogDet will be more numerically stable.
// Det will panic if the receiver does not contain a factorization.
func (lu *LU) Det() float64 {
	if !lu.ok {
		return 0
	}
	det, sign := lu.LogDet()
	return math.Exp(det) * sign
}

// LogDet returns the log of the determinant and the sign of the determinant
// for the matrix that has been factorized. Numerical stability in product and
// division expressions is generally improved by working in log space.
// LogDet will panic if the receiver does not contain a factorization.
func (lu *LU) LogDet() (det float64, sign float64) {
	if !lu.isValid() {
		panic(badLU)
	}

	_, n := lu.lu.Dims()
	logDiag := getFloat64s(n, false)
	defer putFloat64s(logDiag)
	sign = 1.0
	for i := 0; i < n; i++ {
		v := lu.lu.at(i, i)
		if v < 0 {
			sign *= -1
		}
		if lu.swaps[i] != i {
			sign *= -1
		}
		logDiag[i] = math.Log(math.Abs(v))
	}
	return floats.Sum(logDiag), sign
}

// RowPivots returns the row permutation that represents the permutation matrix
// P from the LU factorization
//
//	A = P * L * U.
//
// If dst is nil, a new slice is allocated and returned. If dst is not nil and
// the length of dst does not equal the size of the factorized matrix, RowPivots
// will panic. RowPivots will panic if the receiver does not contain a
// factorization.
func (lu *LU) RowPivots(dst []int) []int {
	if !lu.isValid() {
		panic(badLU)
	}
	_, n := lu.lu.Dims()
	if dst == nil {
		dst = make([]int, n)
	}
	if len(dst) != n {
		panic(badSliceLength)
	}
	copy(dst, lu.piv)
	return dst
}

// Pivot returns the row pivots of the receiver.
//
// Deprecated: Use RowPivots instead.
func (lu *LU) Pivot(dst []int) []int {
	return lu.RowPivots(dst)
}

// RankOne updates an LU factorization as if a rank-one update had been applied to
// the original matrix A, storing the result into the receiver. That is, if in
// the original LU decomposition P * L * U = A, in the updated decomposition
// P * L' * U' = A + alpha * x * yᵀ.
// RankOne will panic if orig does not contain a factorization.
func (lu *LU) RankOne(orig *LU, alpha float64, x, y Vector) {
	if !orig.isValid() {
		panic(badLU)
	}

	// RankOne uses algorithm a1 on page 28 of "Multiple-Rank Updates to Matrix
	// Factorizations for Nonlinear Analysis and Circuit Design" by Linzhong Deng.
	// http://web.stanford.edu/group/SOL/dissertations/Linzhong-Deng-thesis.pdf
	_, n := orig.lu.Dims()
	if r, c := x.Dims(); r != n || c != 1 {
		panic(ErrShape)
	}
	if r, c := y.Dims(); r != n || c != 1 {
		panic(ErrShape)
	}
	if orig != lu {
		if lu.isZero() {
			lu.swaps = useInt(lu.swaps, n)
			lu.piv = useInt(lu.piv, n)
			if lu.lu == nil {
				lu.lu = NewDense(n, n, nil)
			} else {
				lu.lu.reuseAsNonZeroed(n, n)
			}
		} else if len(lu.swaps) != n {
			panic(ErrShape)
		}
		copy(lu.swaps, orig.swaps)
		lu.updatePivots(lu.swaps)
		lu.lu.Copy(orig.lu)
	}

	xs := getFloat64s(n, false)
	defer putFloat64s(xs)
	ys := getFloat64s(n, false)
	defer putFloat64s(ys)
	for i := 0; i < n; i++ {
		xs[i] = x.AtVec(i)
		ys[i] = y.AtVec(i)
	}

	// Adjust for the pivoting in the LU factorization
	for i, v := range lu.swaps {
		xs[i], xs[v] = xs[v], xs[i]
	}

	lum := lu.lu.mat
	omega := alpha
	for j := 0; j < n; j++ {
		ujj := lum.Data[j*lum.Stride+j]
		ys[j] /= ujj
		theta := 1 + xs[j]*ys[j]*omega
		beta := omega * ys[j] / theta
		gamma := omega * xs[j]
		omega -= beta * gamma
		lum.Data[j*lum.Stride+j] *= theta
		for i := j + 1; i < n; i++ {
			xs[i] -= lum.Data[i*lum.Stride+j] * xs[j]
			tmp := ys[i]
			ys[i] -= lum.Data[j*lum.Stride+i] * ys[j]
			lum.Data[i*lum.Stride+j] += beta * xs[i]
			lum.Data[j*lum.Stride+i] += gamma * tmp
		}
	}
	lu.updateCond(-1, CondNorm)
}

// LTo extracts the lower triangular matrix from an LU factorization.
//
// If dst is empty, LTo will resize dst to be a lower-triangular n×n matrix.
// When dst is non-empty, LTo will panic if dst is not n×n or not Lower.
// LTo will also panic if the receiver does not contain a successful
// factorization.
func (lu *LU) LTo(dst *TriDense) *TriDense {
	if !lu.isValid() {
		panic(badLU)
	}

	_, n := lu.lu.Dims()
	if dst.IsEmpty() {
		dst.ReuseAsTri(n, Lower)
	} else {
		n2, kind := dst.Triangle()
		if n != n2 {
			panic(ErrShape)
		}
		if kind != Lower {
			panic(ErrTriangle)
		}
	}
	// Extract the lower triangular elements.
	for i := 1; i < n; i++ {
		copy(dst.mat.Data[i*dst.mat.Stride:i*dst.mat.Stride+i], lu.lu.mat.Data[i*lu.lu.mat.Stride:i*lu.lu.mat.Stride+i])
	}
	// Set ones on the diagonal.
	for i := 0; i < n; i++ {
		dst.mat.Data[i*dst.mat.Stride+i] = 1
	}
	return dst
}

// UTo extracts the upper triangular matrix from an LU factorization.
//
// If dst is empty, UTo will resize dst to be an upper-triangular n×n matrix.
// When dst is non-empty, UTo will panic if dst is not n×n or not Upper.
// UTo will also panic if the receiver does not contain a successful
// factorization.
func (lu *LU) UTo(dst *TriDense) {
	if !lu.isValid() {
		panic(badLU)
	}

	_, n := lu.lu.Dims()
	if dst.IsEmpty() {
		dst.ReuseAsTri(n, Upper)
	} else {
		n2, kind := dst.Triangle()
		if n != n2 {
			panic(ErrShape)
		}
		if kind != Upper {
			panic(ErrTriangle)
		}
	}
	// Extract the upper triangular elements.
	for i := 0; i < n; i++ {
		copy(dst.mat.Data[i*dst.mat.Stride+i:i*dst.mat.Stride+n], lu.lu.mat.Data[i*lu.lu.mat.Stride+i:i*lu.lu.mat.Stride+n])
	}
}

// SolveTo solves a system of linear equations
//
//	A * X = B   if trans == false
//	Aᵀ * X = B  if trans == true
//
// using the LU factorization of A stored in the receiver. The solution matrix X
// is stored into dst.
//
// If A is singular or near-singular a Condition error is returned. See the
// documentation for Condition for more information. SolveTo will panic if the
// receiver does not contain a factorization.
func (lu *LU) SolveTo(dst *Dense, trans bool, b Matrix) error {
	if !lu.isValid() {
		panic(badLU)
	}

	_, n := lu.lu.Dims()
	br, bc := b.Dims()
	if br != n {
		panic(ErrShape)
	}

	if !lu.ok {
		return Condition(math.Inf(1))
	}

	dst.reuseAsNonZeroed(n, bc)
	bU, _ := untranspose(b)
	if dst == bU {
		var restore func()
		dst, restore = dst.isolatedWorkspace(bU)
		defer restore()
	} else if rm, ok := bU.(RawMatrixer); ok {
		dst.checkOverlap(rm.RawMatrix())
	}

	dst.Copy(b)
	t := blas.NoTrans
	if trans {
		t = blas.Trans
	}
	lapack64.Getrs(t, lu.lu.mat, dst.mat, lu.swaps)
	if lu.cond > ConditionTolerance {
		return Condition(lu.cond)
	}
	return nil
}

// SolveVecTo solves a system of linear equations
//
//	A * x = b   if trans == false
//	Aᵀ * x = b  if trans == true
//
// using the LU factorization of A stored in the receiver. The solution matrix x
// is stored into dst.
//
// If A is singular or near-singular a Condition error is returned. See the
// documentation for Condition for more information. SolveVecTo will panic if the
// receiver does not contain a factorization.
func (lu *LU) SolveVecTo(dst *VecDense, trans bool, b Vector) error {
	if !lu.isValid() {
		panic(badLU)
	}

	_, n := lu.lu.Dims()
	if br, bc := b.Dims(); br != n || bc != 1 {
		panic(ErrShape)
	}

	switch rv := b.(type) {
	default:
		dst.reuseAsNonZeroed(n)
		return lu.SolveTo(dst.asDense(), trans, b)
	case RawVectorer:
		if dst != b {
			dst.checkOverlap(rv.RawVector())
		}

		if !lu.ok {
			return Condition(math.Inf(1))
		}

		dst.reuseAsNonZeroed(n)
		var restore func()
		if dst == b {
			dst, restore = dst.isolatedWorkspace(b)
			defer restore()
		}
		dst.CopyVec(b)
		vMat := blas64.General{
			Rows:   n,
			Cols:   1,
			Stride: dst.mat.Inc,
			Data:   dst.mat.Data,
		}
		t := blas.NoTrans
		if trans {
			t = blas.Trans
		}
		lapack64.Getrs(t, lu.lu.mat, vMat, lu.swaps)
		if lu.cond > ConditionTolerance {
			return Condition(lu.cond)
		}
		return nil
	}
}
