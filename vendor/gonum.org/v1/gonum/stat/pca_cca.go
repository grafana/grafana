// Copyright ©2016 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package stat

import (
	"errors"
	"math"

	"gonum.org/v1/gonum/floats"
	"gonum.org/v1/gonum/mat"
)

// PC is a type for computing and extracting the principal components of a
// matrix. The results of the principal components analysis are only valid
// if the call to PrincipalComponents was successful.
type PC struct {
	n, d    int
	weights []float64
	svd     *mat.SVD
	ok      bool
}

// PrincipalComponents performs a weighted principal components analysis on the
// matrix of the input data which is represented as an n×d matrix a where each
// row is an observation and each column is a variable.
//
// PrincipalComponents centers the variables but does not scale the variance.
//
// The weights slice is used to weight the observations. If weights is nil, each
// weight is considered to have a value of one, otherwise the length of weights
// must match the number of observations or PrincipalComponents will panic.
//
// PrincipalComponents returns whether the analysis was successful.
func (c *PC) PrincipalComponents(a mat.Matrix, weights []float64) (ok bool) {
	c.n, c.d = a.Dims()
	if weights != nil && len(weights) != c.n {
		panic("stat: len(weights) != observations")
	}

	c.svd, c.ok = svdFactorizeCentered(c.svd, a, weights)
	if c.ok {
		c.weights = append(c.weights[:0], weights...)
	}
	return c.ok
}

// VectorsTo returns the component direction vectors of a principal components
// analysis. The vectors are returned in the columns of a d×min(n, d) matrix.
//
// If dst is empty, VectorsTo will resize dst to be d×min(n, d). When dst is
// non-empty, VectorsTo will panic if dst is not d×min(n, d). VectorsTo will also
// panic if the receiver does not contain a successful PC.
func (c *PC) VectorsTo(dst *mat.Dense) {
	if !c.ok {
		panic("stat: use of unsuccessful principal components analysis")
	}

	if dst.IsEmpty() {
		dst.ReuseAs(c.d, min(c.n, c.d))
	} else {
		if d, n := dst.Dims(); d != c.d || n != min(c.n, c.d) {
			panic(mat.ErrShape)
		}
	}
	c.svd.VTo(dst)
}

// VarsTo returns the column variances of the principal component scores,
// b * vecs, where b is a matrix with centered columns. Variances are returned
// in descending order.
// If dst is not nil it is used to store the variances and returned.
// Vars will panic if the receiver has not successfully performed a principal
// components analysis or dst is not nil and the length of dst is not min(n, d).
func (c *PC) VarsTo(dst []float64) []float64 {
	if !c.ok {
		panic("stat: use of unsuccessful principal components analysis")
	}
	if dst != nil && len(dst) != min(c.n, c.d) {
		panic("stat: length of slice does not match analysis")
	}

	dst = c.svd.Values(dst)
	var f float64
	if c.weights == nil {
		f = 1 / float64(c.n-1)
	} else {
		f = 1 / (floats.Sum(c.weights) - 1)
	}
	for i, v := range dst {
		dst[i] = f * v * v
	}
	return dst
}

// CC is a type for computing the canonical correlations of a pair of matrices.
// The results of the canonical correlation analysis are only valid
// if the call to CanonicalCorrelations was successful.
type CC struct {
	// n is the number of observations used to
	// construct the canonical correlations.
	n int

	// xd and yd are used for size checks.
	xd, yd int

	x, y, c *mat.SVD
	ok      bool
}

// CanonicalCorrelations performs a canonical correlation analysis of the
// input data x and y, columns of which should be interpretable as two sets
// of measurements on the same observations (rows). These observations are
// optionally weighted by weights. The result of the analysis is stored in
// the receiver if the analysis is successful.
//
// Canonical correlation analysis finds associations between two sets of
// variables on the same observations by finding linear combinations of the two
// sphered datasets that maximize the correlation between them.
//
// Some notation: let Xc and Yc denote the centered input data matrices x
// and y (column means subtracted from each column), let Sx and Sy denote the
// sample covariance matrices within x and y respectively, and let Sxy denote
// the covariance matrix between x and y. The sphered data can then be expressed
// as Xc * Sx^{-1/2} and Yc * Sy^{-1/2} respectively, and the correlation matrix
// between the sphered data is called the canonical correlation matrix,
// Sx^{-1/2} * Sxy * Sy^{-1/2}. In cases where S^{-1/2} is ambiguous for some
// covariance matrix S, S^{-1/2} is taken to be E * D^{-1/2} * Eᵀ where S can
// be eigendecomposed as S = E * D * Eᵀ.
//
// The canonical correlations are the correlations between the corresponding
// pairs of canonical variables and can be obtained with c.Corrs(). Canonical
// variables can be obtained by projecting the sphered data into the left and
// right eigenvectors of the canonical correlation matrix, and these
// eigenvectors can be obtained with c.Left(m, true) and c.Right(m, true)
// respectively. The canonical variables can also be obtained directly from the
// centered raw data by using the back-transformed eigenvectors which can be
// obtained with c.Left(m, false) and c.Right(m, false) respectively.
//
// The first pair of left and right eigenvectors of the canonical correlation
// matrix can be interpreted as directions into which the respective sphered
// data can be projected such that the correlation between the two projections
// is maximized. The second pair and onwards solve the same optimization but
// under the constraint that they are uncorrelated (orthogonal in sphered space)
// to previous projections.
//
// CanonicalCorrelations will panic if the inputs x and y do not have the same
// number of rows.
//
// The slice weights is used to weight the observations. If weights is nil, each
// weight is considered to have a value of one, otherwise the length of weights
// must match the number of observations (rows of both x and y) or
// CanonicalCorrelations will panic.
//
// More details can be found at
// https://en.wikipedia.org/wiki/Canonical_correlation
// or in Chapter 3 of
// Koch, Inge. Analysis of multivariate and high-dimensional data.
// Vol. 32. Cambridge University Press, 2013. ISBN: 9780521887939
func (c *CC) CanonicalCorrelations(x, y mat.Matrix, weights []float64) error {
	var yn int
	c.n, c.xd = x.Dims()
	yn, c.yd = y.Dims()
	if c.n != yn {
		panic("stat: unequal number of observations")
	}
	if weights != nil && len(weights) != c.n {
		panic("stat: len(weights) != observations")
	}

	// Center and factorize x and y.
	c.x, c.ok = svdFactorizeCentered(c.x, x, weights)
	if !c.ok {
		return errors.New("stat: failed to factorize x")
	}
	c.y, c.ok = svdFactorizeCentered(c.y, y, weights)
	if !c.ok {
		return errors.New("stat: failed to factorize y")
	}
	var xu, xv, yu, yv mat.Dense
	c.x.UTo(&xu)
	c.x.VTo(&xv)
	c.y.UTo(&yu)
	c.y.VTo(&yv)

	// Calculate and factorise the canonical correlation matrix.
	var ccor mat.Dense
	ccor.Product(&xv, xu.T(), &yu, yv.T())
	if c.c == nil {
		c.c = &mat.SVD{}
	}
	c.ok = c.c.Factorize(&ccor, mat.SVDThin)
	if !c.ok {
		return errors.New("stat: failed to factorize ccor")
	}
	return nil
}

// CorrsTo returns the canonical correlations, using dst if it is not nil.
// If dst is not nil and len(dst) does not match the number of columns in
// the y input matrix, Corrs will panic.
func (c *CC) CorrsTo(dst []float64) []float64 {
	if !c.ok {
		panic("stat: canonical correlations missing or invalid")
	}

	if dst != nil && len(dst) != c.yd {
		panic("stat: length of destination does not match input dimension")
	}
	return c.c.Values(dst)
}

// LeftTo returns the left eigenvectors of the canonical correlation matrix if
// spheredSpace is true. If spheredSpace is false it returns these eigenvectors
// back-transformed to the original data space.
//
// If dst is empty, LeftTo will resize dst to be xd×yd. When dst is
// non-empty, LeftTo will panic if dst is not xd×yd. LeftTo will also
// panic if the receiver does not contain a successful CC.
func (c *CC) LeftTo(dst *mat.Dense, spheredSpace bool) {
	if !c.ok || c.n < 2 {
		panic("stat: canonical correlations missing or invalid")
	}

	if dst.IsEmpty() {
		dst.ReuseAs(c.xd, c.yd)
	} else {
		if d, n := dst.Dims(); d != c.xd || n != c.yd {
			panic(mat.ErrShape)
		}
	}
	c.c.UTo(dst)
	if spheredSpace {
		return
	}

	xs := c.x.Values(nil)
	xv := &mat.Dense{}
	c.x.VTo(xv)

	scaleColsReciSqrt(xv, xs)

	dst.Product(xv, xv.T(), dst)
	dst.Scale(math.Sqrt(float64(c.n-1)), dst)
}

// RightTo returns the right eigenvectors of the canonical correlation matrix if
// spheredSpace is true. If spheredSpace is false it returns these eigenvectors
// back-transformed to the original data space.
//
// If dst is empty, RightTo will resize dst to be yd×yd. When dst is
// non-empty, RightTo will panic if dst is not yd×yd. RightTo will also
// panic if the receiver does not contain a successful CC.
func (c *CC) RightTo(dst *mat.Dense, spheredSpace bool) {
	if !c.ok || c.n < 2 {
		panic("stat: canonical correlations missing or invalid")
	}

	if dst.IsEmpty() {
		dst.ReuseAs(c.yd, c.yd)
	} else {
		if d, n := dst.Dims(); d != c.yd || n != c.yd {
			panic(mat.ErrShape)
		}
	}
	c.c.VTo(dst)
	if spheredSpace {
		return
	}

	ys := c.y.Values(nil)
	yv := &mat.Dense{}
	c.y.VTo(yv)

	scaleColsReciSqrt(yv, ys)

	dst.Product(yv, yv.T(), dst)
	dst.Scale(math.Sqrt(float64(c.n-1)), dst)
}

func svdFactorizeCentered(work *mat.SVD, m mat.Matrix, weights []float64) (svd *mat.SVD, ok bool) {
	n, d := m.Dims()
	centered := mat.NewDense(n, d, nil)
	col := make([]float64, n)
	for j := 0; j < d; j++ {
		mat.Col(col, j, m)
		floats.AddConst(-Mean(col, weights), col)
		centered.SetCol(j, col)
	}
	for i, w := range weights {
		floats.Scale(math.Sqrt(w), centered.RawRowView(i))
	}
	if work == nil {
		work = &mat.SVD{}
	}
	ok = work.Factorize(centered, mat.SVDThin)
	return work, ok
}

// scaleColsReciSqrt scales the columns of cols
// by the reciprocal square-root of vals.
func scaleColsReciSqrt(cols *mat.Dense, vals []float64) {
	if cols == nil {
		panic("stat: input nil")
	}
	n, d := cols.Dims()
	if len(vals) != d {
		panic("stat: input length mismatch")
	}
	col := make([]float64, n)
	for j := 0; j < d; j++ {
		mat.Col(col, j, cols)
		floats.Scale(math.Sqrt(1/vals[j]), col)
		cols.SetCol(j, col)
	}
}
