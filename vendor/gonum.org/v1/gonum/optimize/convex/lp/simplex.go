// Copyright ©2016 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Package lp implements routines for solving linear programs.
package lp

import (
	"errors"
	"fmt"
	"math"

	"gonum.org/v1/gonum/floats"
	"gonum.org/v1/gonum/mat"
)

// TODO(btracey): Could have a solver structure with an abstract factorizer. With
// this transformation the same high-level code could handle both Dense and Sparse.
// TODO(btracey): Need to improve error handling. Only want to panic if condition number inf.
// TODO(btracey): Performance enhancements. There are currently lots of linear
// solves that can be improved by doing rank-one updates. For example, the swap
// step is just a rank-one update.
// TODO(btracey): Better handling on the linear solve errors. If the condition
// number is not inf and the equation solved "well", should keep moving.

var (
	ErrBland      = errors.New("lp: bland: all replacements are negative or cause ill-conditioned ab")
	ErrInfeasible = errors.New("lp: problem is infeasible")
	ErrLinSolve   = errors.New("lp: linear solve failure")
	ErrUnbounded  = errors.New("lp: problem is unbounded")
	ErrSingular   = errors.New("lp: A is singular")
	ErrZeroColumn = errors.New("lp: A has a column of all zeros")
	ErrZeroRow    = errors.New("lp: A has a row of all zeros")
)

const badShape = "lp: size mismatch"

// TODO(btracey): Should these tolerances be part of a settings struct?

const (
	// initPosTol is the tolerance on the initial condition being feasible. Strictly,
	// the x should be positive, but instead it must be greater than -initPosTol.
	initPosTol = 1e-13
	// blandNegTol is the tolerance on the value being greater than 0 in the bland test.
	blandNegTol = 1e-14
	// rRoundTol is the tolerance for rounding values to zero when testing if
	// constraints are met.
	rRoundTol = 1e-13
	// dRoundTol is the tolerance for testing if values are zero for the problem
	// being unbounded.
	dRoundTol = 1e-13
	// phaseIZeroTol tests if the Phase I problem returned a feasible solution.
	phaseIZeroTol = 1e-12
	// blandZeroTol is the tolerance on testing if the bland solution can move.
	blandZeroTol = 1e-12
)

// Simplex solves a linear program in standard form using Danzig's Simplex
// algorithm. The standard form of a linear program is:
//
//	minimize	cᵀ x
//	s.t. 		A*x = b
//				x >= 0 .
//
// The input tol sets how close to the optimal solution is found (specifically,
// when the maximal reduced cost is below tol). An error will be returned if the
// problem is infeasible or unbounded. In rare cases, numeric errors can cause
// the Simplex to fail. In this case, an error will be returned along with the
// most recently found feasible solution.
//
// The Convert function can be used to transform a general LP into standard form.
//
// The input matrix A must have at least as many columns as rows, len(c) must
// equal the number of columns of A, and len(b) must equal the number of rows of
// A or Simplex will panic. A must also have full row rank and may not contain any
// columns with all zeros, or Simplex will return an error.
//
// initialBasic can be used to set the initial set of indices for a feasible
// solution to the LP. If an initial feasible solution is not known, initialBasic
// may be nil. If initialBasic is non-nil, len(initialBasic) must equal the number
// of rows of A and must be an actual feasible solution to the LP, otherwise
// Simplex will panic.
//
// A description of the Simplex algorithm can be found in Ch. 8 of
//
//	Strang, Gilbert. "Linear Algebra and Applications." Academic, New York (1976).
//
// For a detailed video introduction, see lectures 11-13 of UC Math 352
//
//	https://www.youtube.com/watch?v=ESzYPFkY3og&index=11&list=PLh464gFUoJWOmBYla3zbZbc4nv2AXez6X.
func Simplex(c []float64, A mat.Matrix, b []float64, tol float64, initialBasic []int) (optF float64, optX []float64, err error) {
	ans, x, _, err := simplex(initialBasic, c, A, b, tol)
	return ans, x, err
}

func simplex(initialBasic []int, c []float64, A mat.Matrix, b []float64, tol float64) (float64, []float64, []int, error) {
	err := verifyInputs(initialBasic, c, A, b)
	if err != nil {
		if err == ErrUnbounded {
			return math.Inf(-1), nil, nil, ErrUnbounded
		}
		return math.NaN(), nil, nil, err
	}
	m, n := A.Dims()

	if m == n {
		// Problem is exactly constrained, perform a linear solve.
		bVec := mat.NewVecDense(len(b), b)
		x := make([]float64, n)
		xVec := mat.NewVecDense(n, x)
		err := xVec.SolveVec(A, bVec)
		if err != nil {
			return math.NaN(), nil, nil, ErrSingular
		}
		for _, v := range x {
			if v < 0 {
				return math.NaN(), nil, nil, ErrInfeasible
			}
		}
		f := floats.Dot(x, c)
		return f, x, nil, nil
	}

	// There is at least one optimal solution to the LP which is at the intersection
	// to a set of constraint boundaries. For a standard form LP with m variables
	// and n equality constraints, at least m-n elements of x must equal zero
	// at optimality. The Simplex algorithm solves the standard-form LP by starting
	// at an initial constraint vertex and successively moving to adjacent constraint
	// vertices. At every vertex, the set of non-zero x values is the "basic
	// feasible solution". The list of non-zero x's are maintained in basicIdxs,
	// the respective columns of A are in ab, and the actual non-zero values of
	// x are in xb.
	//
	// The LP is equality constrained such that A * x = b. This can be expanded
	// to
	//  ab * xb + an * xn = b
	// where ab are the columns of a in the basic set, and an are all of the
	// other columns. Since each element of xn is zero by definition, this means
	// that for all feasible solutions xb = ab^-1 * b.
	//
	// Before the simplex algorithm can start, an initial feasible solution must
	// be found. If initialBasic is non-nil a feasible solution has been supplied.
	// Otherwise the "Phase I" problem must be solved to find an initial feasible
	// solution.

	var basicIdxs []int // The indices of the non-zero x values.
	var ab *mat.Dense   // The subset of columns of A listed in basicIdxs.
	var xb []float64    // The non-zero elements of x. xb = ab^-1 b

	if initialBasic != nil {
		// InitialBasic supplied. Panic if incorrect length or infeasible.
		if len(initialBasic) != m {
			panic("lp: incorrect number of initial vectors")
		}
		ab = mat.NewDense(m, len(initialBasic), nil)
		extractColumns(ab, A, initialBasic)
		xb = make([]float64, m)
		err = initializeFromBasic(xb, ab, b)
		if err != nil {
			panic(err)
		}
		basicIdxs = make([]int, len(initialBasic))
		copy(basicIdxs, initialBasic)
	} else {
		// No initial basis supplied. Solve the PhaseI problem.
		basicIdxs, ab, xb, err = findInitialBasic(A, b)
		if err != nil {
			return math.NaN(), nil, nil, err
		}
	}

	// basicIdxs contains the indexes for an initial feasible solution,
	// ab contains the extracted columns of A, and xb contains the feasible
	// solution. All x not in the basic set are 0 by construction.

	// nonBasicIdx is the set of nonbasic variables.
	nonBasicIdx := make([]int, 0, n-m)
	inBasic := make(map[int]struct{})
	for _, v := range basicIdxs {
		inBasic[v] = struct{}{}
	}
	for i := 0; i < n; i++ {
		_, ok := inBasic[i]
		if !ok {
			nonBasicIdx = append(nonBasicIdx, i)
		}
	}

	// cb is the subset of c for the basic variables. an and cn
	// are the equivalents to ab and cb but for the nonbasic variables.
	cb := make([]float64, len(basicIdxs))
	for i, idx := range basicIdxs {
		cb[i] = c[idx]
	}
	cn := make([]float64, len(nonBasicIdx))
	for i, idx := range nonBasicIdx {
		cn[i] = c[idx]
	}
	an := mat.NewDense(m, len(nonBasicIdx), nil)
	extractColumns(an, A, nonBasicIdx)

	bVec := mat.NewVecDense(len(b), b)
	cbVec := mat.NewVecDense(len(cb), cb)

	// Temporary data needed each iteration. (Described later)
	r := make([]float64, n-m)
	move := make([]float64, m)

	// Solve the linear program starting from the initial feasible set. This is
	// the "Phase 2" problem.
	//
	// Algorithm:
	// 1) Compute the "reduced costs" for the non-basic variables. The reduced
	// costs are the lagrange multipliers of the constraints.
	// 	 r = cn - anᵀ * ab¯ᵀ * cb
	// 2) If all of the reduced costs are positive, no improvement is possible,
	// and the solution is optimal (xn can only increase because of
	// non-negativity constraints). Otherwise, the solution can be improved and
	// one element will be exchanged in the basic set.
	// 3) Choose the x_n with the most negative value of r. Call this value xe.
	// This variable will be swapped into the basic set.
	// 4) Increase xe until the next constraint boundary is met. This will happen
	// when the first element in xb becomes 0. The distance xe can increase before
	// a given element in xb becomes negative can be found from
	//	xb = Ab^-1 b - Ab^-1 An xn
	//     = Ab^-1 b - Ab^-1 Ae xe
	//     = bhat + d x_e
	//  xe = bhat_i / - d_i
	// where Ae is the column of A corresponding to xe.
	// The constraining basic index is the first index for which this is true,
	// so remove the element which is min_i (bhat_i / -d_i), assuming d_i is negative.
	// If no d_i is less than 0, then the problem is unbounded.
	// 5) If the new xe is 0 (that is, bhat_i == 0), then this location is at
	// the intersection of several constraints. Use the Bland rule instead
	// of the rule in step 4 to avoid cycling.
	for {
		// Compute reduced costs -- r = cn - anᵀ ab¯ᵀ cb
		var tmp mat.VecDense
		err = tmp.SolveVec(ab.T(), cbVec)
		if err != nil {
			break
		}
		data := make([]float64, n-m)
		tmp2 := mat.NewVecDense(n-m, data)
		tmp2.MulVec(an.T(), &tmp)
		floats.SubTo(r, cn, data)

		// Replace the most negative element in the simplex. If there are no
		// negative entries then the optimal solution has been found.
		minIdx := floats.MinIdx(r)
		if r[minIdx] >= -tol {
			break
		}

		for i, v := range r {
			if math.Abs(v) < rRoundTol {
				r[i] = 0
			}
		}

		// Compute the moving distance.
		err = computeMove(move, minIdx, A, ab, xb, nonBasicIdx)
		if err != nil {
			if err == ErrUnbounded {
				return math.Inf(-1), nil, nil, ErrUnbounded
			}
			break
		}

		// Replace the basic index along the tightest constraint.
		replace := floats.MinIdx(move)
		if move[replace] <= 0 {
			replace, minIdx, err = replaceBland(A, ab, xb, basicIdxs, nonBasicIdx, r, move)
			if err != nil {
				if err == ErrUnbounded {
					return math.Inf(-1), nil, nil, ErrUnbounded
				}
				break
			}
		}

		// Replace the constrained basicIdx with the newIdx.
		basicIdxs[replace], nonBasicIdx[minIdx] = nonBasicIdx[minIdx], basicIdxs[replace]
		cb[replace], cn[minIdx] = cn[minIdx], cb[replace]
		tmpCol1 := mat.Col(nil, replace, ab)
		tmpCol2 := mat.Col(nil, minIdx, an)
		ab.SetCol(replace, tmpCol2)
		an.SetCol(minIdx, tmpCol1)

		// Compute the new xb.
		xbVec := mat.NewVecDense(len(xb), xb)
		err = xbVec.SolveVec(ab, bVec)
		if err != nil {
			break
		}
	}
	// Found the optimum successfully or died trying. The basic variables get
	// their values, and the non-basic variables are all zero.
	opt := floats.Dot(cb, xb)
	xopt := make([]float64, n)
	for i, v := range basicIdxs {
		xopt[v] = xb[i]
	}
	return opt, xopt, basicIdxs, err
}

// computeMove computes how far can be moved replacing each index. The results
// are stored into move.
func computeMove(move []float64, minIdx int, A mat.Matrix, ab *mat.Dense, xb []float64, nonBasicIdx []int) error {
	// Find ae.
	col := mat.Col(nil, nonBasicIdx[minIdx], A)
	aCol := mat.NewVecDense(len(col), col)

	// d = - Ab^-1 Ae
	nb, _ := ab.Dims()
	d := make([]float64, nb)
	dVec := mat.NewVecDense(nb, d)
	err := dVec.SolveVec(ab, aCol)
	if err != nil {
		return ErrLinSolve
	}
	floats.Scale(-1, d)

	for i, v := range d {
		if math.Abs(v) < dRoundTol {
			d[i] = 0
		}
	}

	// If no di < 0, then problem is unbounded.
	if floats.Min(d) >= 0 {
		return ErrUnbounded
	}

	// move = bhat_i / - d_i, assuming d is negative.
	bHat := xb // ab^-1 b
	for i, v := range d {
		if v >= 0 {
			move[i] = math.Inf(1)
		} else {
			move[i] = bHat[i] / math.Abs(v)
		}
	}
	return nil
}

// replaceBland uses the Bland rule to find the indices to swap if the minimum
// move is 0. The indices to be swapped are replace and minIdx (following the
// nomenclature in the main routine).
func replaceBland(A mat.Matrix, ab *mat.Dense, xb []float64, basicIdxs, nonBasicIdx []int, r, move []float64) (replace, minIdx int, err error) {
	m, _ := A.Dims()
	// Use the traditional bland rule, except don't replace a constraint which
	// causes the new ab to be singular.
	for i, v := range r {
		if v > -blandNegTol {
			continue
		}
		minIdx = i
		err = computeMove(move, minIdx, A, ab, xb, nonBasicIdx)
		if err != nil {
			// Either unbounded or something went wrong.
			return -1, -1, err
		}
		replace = floats.MinIdx(move)
		if math.Abs(move[replace]) > blandZeroTol {
			// Large enough that it shouldn't be a problem
			return replace, minIdx, nil
		}
		// Find a zero index where replacement is non-singular.
		biCopy := make([]int, len(basicIdxs))
		for replace, v := range move {
			if v > blandZeroTol {
				continue
			}
			copy(biCopy, basicIdxs)
			biCopy[replace] = nonBasicIdx[minIdx]
			abTmp := mat.NewDense(m, len(biCopy), nil)
			extractColumns(abTmp, A, biCopy)
			// If the condition number is reasonable, use this index.
			if mat.Cond(abTmp, 1) < 1e16 {
				return replace, minIdx, nil
			}
		}
	}
	return -1, -1, ErrBland
}

func verifyInputs(initialBasic []int, c []float64, A mat.Matrix, b []float64) error {
	m, n := A.Dims()
	if m > n {
		panic("lp: more equality constraints than variables")
	}
	if len(c) != n {
		panic("lp: c vector incorrect length")
	}
	if len(b) != m {
		panic("lp: b vector incorrect length")
	}
	if len(c) != n {
		panic("lp: c vector incorrect length")
	}
	if len(initialBasic) != 0 && len(initialBasic) != m {
		panic("lp: initialBasic incorrect length")
	}

	// Do some sanity checks so that ab does not become singular during the
	// simplex solution. If the ZeroRow checks are removed then the code for
	// finding a set of linearly independent columns must be improved.

	// Check that if a row of A only has zero elements that corresponding
	// element in b is zero, otherwise the problem is infeasible.
	// Otherwise return ErrZeroRow.
	for i := 0; i < m; i++ {
		isZero := true
		for j := 0; j < n; j++ {
			if A.At(i, j) != 0 {
				isZero = false
				break
			}
		}
		if isZero && b[i] != 0 {
			// Infeasible
			return ErrInfeasible
		} else if isZero {
			return ErrZeroRow
		}
	}
	// Check that if a column only has zero elements that the respective C vector
	// is positive (otherwise unbounded). Otherwise return ErrZeroColumn.
	for j := 0; j < n; j++ {
		isZero := true
		for i := 0; i < m; i++ {
			if A.At(i, j) != 0 {
				isZero = false
				break
			}
		}
		if isZero && c[j] < 0 {
			return ErrUnbounded
		} else if isZero {
			return ErrZeroColumn
		}
	}
	return nil
}

// initializeFromBasic initializes the basic feasible solution given a set of
// basic indices. It extracts the columns of A specified by basicIdxs and finds
// the x values at that location. These are stored into xb.
//
// If the columns of A are not linearly independent or if the initial set is not
// feasible, an error is returned.
func initializeFromBasic(xb []float64, ab *mat.Dense, b []float64) error {
	m, _ := ab.Dims()
	if len(xb) != m {
		panic("simplex: bad xb length")
	}
	xbMat := mat.NewVecDense(m, xb)

	err := xbMat.SolveVec(ab, mat.NewVecDense(m, b))
	if err != nil {
		return errors.New("lp: subcolumns of A for supplied initial basic singular")
	}
	// The solve ensures that the equality constraints are met (ab * xb = b).
	// Thus, the solution is feasible if and only if all of the x's are positive.
	allPos := true
	for _, v := range xb {
		if v < -initPosTol {
			allPos = false
			break
		}
	}
	if !allPos {
		return errors.New("lp: supplied subcolumns not a feasible solution")
	}
	return nil
}

// extractColumns copies the columns specified by cols into the columns of dst.
func extractColumns(dst *mat.Dense, A mat.Matrix, cols []int) {
	r, c := dst.Dims()
	ra, _ := A.Dims()
	if ra != r {
		panic("simplex: row mismatch")
	}
	if c != len(cols) {
		panic("simplex: column mismatch")
	}
	col := make([]float64, r)
	for j, idx := range cols {
		mat.Col(col, idx, A)
		dst.SetCol(j, col)
	}
}

// findInitialBasic finds an initial basic solution, and returns the basic
// indices, ab, and xb.
func findInitialBasic(A mat.Matrix, b []float64) ([]int, *mat.Dense, []float64, error) {
	m, n := A.Dims()
	basicIdxs := findLinearlyIndependent(A)
	if len(basicIdxs) != m {
		return nil, nil, nil, ErrSingular
	}

	// It may be that this linearly independent basis is also a feasible set. If
	// so, the Phase I problem can be avoided.
	ab := mat.NewDense(m, len(basicIdxs), nil)
	extractColumns(ab, A, basicIdxs)
	xb := make([]float64, m)
	err := initializeFromBasic(xb, ab, b)
	if err == nil {
		return basicIdxs, ab, xb, nil
	}

	// This set was not feasible. Instead the "Phase I" problem must be solved
	// to find an initial feasible set of basis.
	//
	// Method: Construct an LP whose optimal solution is a feasible solution
	// to the original LP.
	// 1) Introduce an artificial variable x_{n+1}.
	// 2) Let x_j be the most negative element of x_b (largest constraint violation).
	// 3) Add the artificial variable to A with:
	//      a_{n+1} = b - \sum_{i in basicIdxs} a_i + a_j
	//    swap j with n+1 in the basicIdxs.
	// 4) Define a new LP:
	//   minimize  x_{n+1}
	//   subject to [A A_{n+1}][x_1 ... x_{n+1}] = b
	//          x, x_{n+1} >= 0
	// 5) Solve this LP. If x_{n+1} != 0, then the problem is infeasible, otherwise
	// the found basis can be used as an initial basis for phase II.
	//
	// The extra column in Step 3 is defined such that the vector of 1s is an
	// initial feasible solution.

	// Find the largest constraint violator.
	// Compute a_{n+1} = b - \sum{i in basicIdxs}a_i + a_j. j is in basicIDx, so
	// instead just subtract the basicIdx columns that are not minIDx.
	minIdx := floats.MinIdx(xb)
	aX1 := make([]float64, m)
	copy(aX1, b)
	col := make([]float64, m)
	for i, v := range basicIdxs {
		if i == minIdx {
			continue
		}
		mat.Col(col, v, A)
		floats.Sub(aX1, col)
	}

	// Construct the new LP.
	// aNew = [A, a_{n+1}]
	// bNew = b
	// cNew = 1 for x_{n+1}
	aNew := mat.NewDense(m, n+1, nil)
	aNew.Copy(A)
	aNew.SetCol(n, aX1)
	basicIdxs[minIdx] = n // swap minIdx with n in the basic set.
	c := make([]float64, n+1)
	c[n] = 1

	// Solve the Phase I linear program.
	_, xOpt, newBasic, err := simplex(basicIdxs, c, aNew, b, 1e-10)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("lp: error finding feasible basis: %s", err)
	}

	// The original LP is infeasible if the added variable has non-zero value
	// in the optimal solution to the Phase I problem.
	if math.Abs(xOpt[n]) > phaseIZeroTol {
		return nil, nil, nil, ErrInfeasible
	}

	// The basis found in Phase I is a feasible solution to the original LP if
	// the added variable is not in the basis.
	addedIdx := -1
	for i, v := range newBasic {
		if v == n {
			addedIdx = i
		}
		xb[i] = xOpt[v]
	}
	if addedIdx == -1 {
		extractColumns(ab, A, newBasic)
		return newBasic, ab, xb, nil
	}

	// The value of the added variable is in the basis, but it has a zero value.
	// See if exchanging another variable into the basic set finds a feasible
	// solution.
	basicMap := make(map[int]struct{})
	for _, v := range newBasic {
		basicMap[v] = struct{}{}
	}
	var set bool
	for i := range xOpt {
		if _, inBasic := basicMap[i]; inBasic {
			continue
		}
		newBasic[addedIdx] = i
		if set {
			mat.Col(col, i, A)
			ab.SetCol(addedIdx, col)
		} else {
			extractColumns(ab, A, newBasic)
			set = true
		}
		err := initializeFromBasic(xb, ab, b)
		if err == nil {
			return newBasic, ab, xb, nil
		}
	}
	return nil, nil, nil, ErrInfeasible
}

// findLinearlyIndependent finds a set of linearly independent columns of A, and
// returns the column indexes of the linearly independent columns.
func findLinearlyIndependent(A mat.Matrix) []int {
	m, n := A.Dims()
	idxs := make([]int, 0, m)
	columns := mat.NewDense(m, m, nil)
	newCol := make([]float64, m)
	// Walk in reverse order because slack variables are typically the last columns
	// of A.
	for i := n - 1; i >= 0; i-- {
		if len(idxs) == m {
			break
		}
		mat.Col(newCol, i, A)
		columns.SetCol(len(idxs), newCol)
		if len(idxs) == 0 {
			// A column is linearly independent from the null set.
			// If all-zero column of A are allowed, this code needs to be adjusted.
			idxs = append(idxs, i)
			continue
		}
		if mat.Cond(columns.Slice(0, m, 0, len(idxs)+1), 1) > 1e12 {
			// Not linearly independent.
			continue
		}
		idxs = append(idxs, i)
	}
	return idxs
}
