// Copyright ©2020 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package mat

import (
	"math"

	"gonum.org/v1/gonum/blas"
	"gonum.org/v1/gonum/blas/blas64"
	"gonum.org/v1/gonum/internal/asm/f64"
	"gonum.org/v1/gonum/lapack/lapack64"
)

var (
	tridiagDense *Tridiag
	_            Matrix           = tridiagDense
	_            allMatrix        = tridiagDense
	_            denseMatrix      = tridiagDense
	_            Banded           = tridiagDense
	_            MutableBanded    = tridiagDense
	_            RawTridiagonaler = tridiagDense
)

// A RawTridiagonaler can return a lapack64.Tridiagonal representation of the
// receiver. Changes to the elements of DL, D, DU in lapack64.Tridiagonal will
// be reflected in the original matrix, changes to the N field will not.
type RawTridiagonaler interface {
	RawTridiagonal() lapack64.Tridiagonal
}

// Tridiag represents a tridiagonal matrix by its three diagonals.
type Tridiag struct {
	mat lapack64.Tridiagonal
}

// NewTridiag creates a new n×n tridiagonal matrix with the first sub-diagonal
// in dl, the main diagonal in d and the first super-diagonal in du. If all of
// dl, d, and du are nil, new backing slices will be allocated for them. If dl
// and du have length n-1 and d has length n, they will be used as backing
// slices, and changes to the elements of the returned Tridiag will be reflected
// in dl, d, du. If neither of these is true, NewTridiag will panic.
func NewTridiag(n int, dl, d, du []float64) *Tridiag {
	if n <= 0 {
		if n == 0 {
			panic(ErrZeroLength)
		}
		panic(ErrNegativeDimension)
	}
	if dl != nil || d != nil || du != nil {
		if len(dl) != n-1 || len(d) != n || len(du) != n-1 {
			panic(ErrShape)
		}
	} else {
		d = make([]float64, n)
		if n > 1 {
			dl = make([]float64, n-1)
			du = make([]float64, n-1)
		}
	}
	return &Tridiag{
		mat: lapack64.Tridiagonal{
			N:  n,
			DL: dl,
			D:  d,
			DU: du,
		},
	}
}

// Dims returns the number of rows and columns in the matrix.
func (a *Tridiag) Dims() (r, c int) {
	return a.mat.N, a.mat.N
}

// Bandwidth returns 1, 1 - the upper and lower bandwidths of the matrix.
func (a *Tridiag) Bandwidth() (kl, ku int) {
	return 1, 1
}

// T performs an implicit transpose by returning the receiver inside a Transpose.
func (a *Tridiag) T() Matrix {
	// An alternative would be to return the receiver with DL,DU swapped; the
	// untranspose function would then always return false. With Transpose the
	// diagonal swapping will be done in tridiagonal routines in lapack like
	// lapack64.Gtsv or gonum.Dlagtm based on the trans parameter.
	return Transpose{a}
}

// TBand performs an implicit transpose by returning the receiver inside a
// TransposeBand.
func (a *Tridiag) TBand() Banded {
	// An alternative would be to return the receiver with DL,DU swapped; see
	// explanation in T above.
	return TransposeBand{a}
}

// RawTridiagonal returns the underlying lapack64.Tridiagonal used by the
// receiver. Changes to elements in the receiver following the call will be
// reflected in the returned matrix.
func (a *Tridiag) RawTridiagonal() lapack64.Tridiagonal {
	return a.mat
}

// SetRawTridiagonal sets the underlying lapack64.Tridiagonal used by the
// receiver. Changes to elements in the receiver following the call will be
// reflected in the input.
func (a *Tridiag) SetRawTridiagonal(mat lapack64.Tridiagonal) {
	a.mat = mat
}

// IsEmpty returns whether the receiver is empty. Empty matrices can be the
// receiver for size-restricted operations. The receiver can be zeroed using
// Reset.
func (a *Tridiag) IsEmpty() bool {
	return a.mat.N == 0
}

// Reset empties the matrix so that it can be reused as the receiver of a
// dimensionally restricted operation.
//
// Reset should not be used when the matrix shares backing data. See the Reseter
// interface for more information.
func (a *Tridiag) Reset() {
	a.mat.N = 0
	a.mat.DL = a.mat.DL[:0]
	a.mat.D = a.mat.D[:0]
	a.mat.DU = a.mat.DU[:0]
}

// CloneFromTridiag makes a copy of the input Tridiag into the receiver,
// overwriting the previous value of the receiver. CloneFromTridiag does not
// place any restrictions on receiver shape.
func (a *Tridiag) CloneFromTridiag(from *Tridiag) {
	n := from.mat.N
	switch n {
	case 0:
		panic(ErrZeroLength)
	case 1:
		a.mat = lapack64.Tridiagonal{
			N:  1,
			DL: use(a.mat.DL, 0),
			D:  use(a.mat.D, 1),
			DU: use(a.mat.DU, 0),
		}
		a.mat.D[0] = from.mat.D[0]
	default:
		a.mat = lapack64.Tridiagonal{
			N:  n,
			DL: use(a.mat.DL, n-1),
			D:  use(a.mat.D, n),
			DU: use(a.mat.DU, n-1),
		}
		copy(a.mat.DL, from.mat.DL)
		copy(a.mat.D, from.mat.D)
		copy(a.mat.DU, from.mat.DU)
	}
}

// DiagView returns the diagonal as a matrix backed by the original data.
func (a *Tridiag) DiagView() Diagonal {
	return &DiagDense{
		mat: blas64.Vector{
			N:    a.mat.N,
			Data: a.mat.D[:a.mat.N],
			Inc:  1,
		},
	}
}

// Zero sets all of the matrix elements to zero.
func (a *Tridiag) Zero() {
	zero(a.mat.DL)
	zero(a.mat.D)
	zero(a.mat.DU)
}

// Trace returns the trace of the matrix.
//
// Trace will panic with ErrZeroLength if the matrix has zero size.
func (a *Tridiag) Trace() float64 {
	if a.IsEmpty() {
		panic(ErrZeroLength)
	}
	return f64.Sum(a.mat.D)
}

// Norm returns the specified norm of the receiver. Valid norms are:
//
//	1 - The maximum absolute column sum
//	2 - The Frobenius norm, the square root of the sum of the squares of the elements
//	Inf - The maximum absolute row sum
//
// Norm will panic with ErrNormOrder if an illegal norm is specified and with
// ErrZeroLength if the matrix has zero size.
func (a *Tridiag) Norm(norm float64) float64 {
	if a.IsEmpty() {
		panic(ErrZeroLength)
	}
	return lapack64.Langt(normLapack(norm, false), a.mat)
}

// MulVecTo computes A⋅x or Aᵀ⋅x storing the result into dst.
func (a *Tridiag) MulVecTo(dst *VecDense, trans bool, x Vector) {
	n := a.mat.N
	if x.Len() != n {
		panic(ErrShape)
	}
	dst.reuseAsNonZeroed(n)
	t := blas.NoTrans
	if trans {
		t = blas.Trans
	}
	xMat, _ := untransposeExtract(x)
	if xVec, ok := xMat.(*VecDense); ok && dst != xVec {
		dst.checkOverlap(xVec.mat)
		lapack64.Lagtm(t, 1, a.mat, xVec.asGeneral(), 0, dst.asGeneral())
	} else {
		xCopy := getVecDenseWorkspace(n, false)
		xCopy.CloneFromVec(x)
		lapack64.Lagtm(t, 1, a.mat, xCopy.asGeneral(), 0, dst.asGeneral())
		putVecDenseWorkspace(xCopy)
	}
}

// SolveTo solves a tridiagonal system A⋅X = B  or  Aᵀ⋅X = B where A is an
// n×n tridiagonal matrix represented by the receiver and B is a given n×nrhs
// matrix. If A is non-singular, the result will be stored into dst and nil will
// be returned. If A is singular, the contents of dst will be undefined and a
// Condition error will be returned.
func (a *Tridiag) SolveTo(dst *Dense, trans bool, b Matrix) error {
	n, nrhs := b.Dims()
	if n != a.mat.N {
		panic(ErrShape)
	}

	dst.reuseAsNonZeroed(n, nrhs)
	bU, bTrans := untranspose(b)
	if dst == bU {
		if bTrans {
			work := getDenseWorkspace(n, nrhs, false)
			defer putDenseWorkspace(work)
			work.Copy(b)
			dst.Copy(work)
		}
	} else {
		if rm, ok := bU.(RawMatrixer); ok {
			dst.checkOverlap(rm.RawMatrix())
		}
		dst.Copy(b)
	}

	var aCopy Tridiag
	aCopy.CloneFromTridiag(a)
	var ok bool
	if trans {
		ok = lapack64.Gtsv(blas.Trans, aCopy.mat, dst.mat)
	} else {
		ok = lapack64.Gtsv(blas.NoTrans, aCopy.mat, dst.mat)
	}
	if !ok {
		return Condition(math.Inf(1))
	}
	return nil
}

// SolveVecTo solves a tridiagonal system A⋅X = B  or  Aᵀ⋅X = B where A is an
// n×n tridiagonal matrix represented by the receiver and b is a given n-vector.
// If A is non-singular, the result will be stored into dst and nil will be
// returned. If A is singular, the contents of dst will be undefined and a
// Condition error will be returned.
func (a *Tridiag) SolveVecTo(dst *VecDense, trans bool, b Vector) error {
	n, nrhs := b.Dims()
	if n != a.mat.N || nrhs != 1 {
		panic(ErrShape)
	}
	if b, ok := b.(RawVectorer); ok && dst != b {
		dst.checkOverlap(b.RawVector())
	}
	dst.reuseAsNonZeroed(n)
	if dst != b {
		dst.CopyVec(b)
	}
	var aCopy Tridiag
	aCopy.CloneFromTridiag(a)
	var ok bool
	if trans {
		ok = lapack64.Gtsv(blas.Trans, aCopy.mat, dst.asGeneral())
	} else {
		ok = lapack64.Gtsv(blas.NoTrans, aCopy.mat, dst.asGeneral())
	}
	if !ok {
		return Condition(math.Inf(1))
	}
	return nil
}

// DoNonZero calls the function fn for each of the non-zero elements of A. The
// function fn takes a row/column index and the element value of A at (i,j).
func (a *Tridiag) DoNonZero(fn func(i, j int, v float64)) {
	for i, aij := range a.mat.DU {
		if aij != 0 {
			fn(i, i+1, aij)
		}
	}
	for i, aii := range a.mat.D {
		if aii != 0 {
			fn(i, i, aii)
		}
	}
	for i, aij := range a.mat.DL {
		if aij != 0 {
			fn(i+1, i, aij)
		}
	}
}

// DoRowNonZero calls the function fn for each of the non-zero elements of row i
// of A. The function fn takes a row/column index and the element value of A at
// (i,j).
func (a *Tridiag) DoRowNonZero(i int, fn func(i, j int, v float64)) {
	n := a.mat.N
	if uint(i) >= uint(n) {
		panic(ErrRowAccess)
	}
	if n == 1 {
		v := a.mat.D[0]
		if v != 0 {
			fn(0, 0, v)
		}
		return
	}
	switch i {
	case 0:
		v := a.mat.D[0]
		if v != 0 {
			fn(i, 0, v)
		}
		v = a.mat.DU[0]
		if v != 0 {
			fn(i, 1, v)
		}
	case n - 1:
		v := a.mat.DL[n-2]
		if v != 0 {
			fn(n-1, n-2, v)
		}
		v = a.mat.D[n-1]
		if v != 0 {
			fn(n-1, n-1, v)
		}
	default:
		v := a.mat.DL[i-1]
		if v != 0 {
			fn(i, i-1, v)
		}
		v = a.mat.D[i]
		if v != 0 {
			fn(i, i, v)
		}
		v = a.mat.DU[i]
		if v != 0 {
			fn(i, i+1, v)
		}
	}
}

// DoColNonZero calls the function fn for each of the non-zero elements of
// column j of A. The function fn takes a row/column index and the element value
// of A at (i, j).
func (a *Tridiag) DoColNonZero(j int, fn func(i, j int, v float64)) {
	n := a.mat.N
	if uint(j) >= uint(n) {
		panic(ErrColAccess)
	}
	if n == 1 {
		v := a.mat.D[0]
		if v != 0 {
			fn(0, 0, v)
		}
		return
	}
	switch j {
	case 0:
		v := a.mat.D[0]
		if v != 0 {
			fn(0, 0, v)
		}
		v = a.mat.DL[0]
		if v != 0 {
			fn(1, 0, v)
		}
	case n - 1:
		v := a.mat.DU[n-2]
		if v != 0 {
			fn(n-2, n-1, v)
		}
		v = a.mat.D[n-1]
		if v != 0 {
			fn(n-1, n-1, v)
		}
	default:
		v := a.mat.DU[j-1]
		if v != 0 {
			fn(j-1, j, v)
		}
		v = a.mat.D[j]
		if v != 0 {
			fn(j, j, v)
		}
		v = a.mat.DL[j]
		if v != 0 {
			fn(j+1, j, v)
		}
	}
}
