// Derived from SciPy's special/c_misc/fsolve.c and special/c_misc/misc.h
// https://github.com/scipy/scipy/blob/master/scipy/special/c_misc/fsolve.c
// https://github.com/scipy/scipy/blob/master/scipy/special/c_misc/misc.h

// Copyright ©2017 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package mathext

import "math"

type objectiveFunc func(float64, []float64) float64

type fSolveResult uint8

const (
	// An exact solution was found, in which case the first point on the
	// interval is the value
	fSolveExact fSolveResult = iota + 1
	// Interval width is less than the tolerance
	fSolveConverged
	// Root-finding didn't converge in a set number of iterations
	fSolveMaxIterations
)

const (
	machEp = 1.0 / (1 << 53)
)

// falsePosition uses a combination of bisection and false position to find a
// root of a function within a given interval. This is guaranteed to converge,
// and always keeps a bounding interval, unlike Newton's method. Inputs are:
//
//	x1, x2:   initial bounding interval
//	f1, f2: value of f() at x1 and x2
//	absErr, relErr: absolute and relative errors on the bounding interval
//	bisectTil: if > 0.0, perform bisection until the width of the bounding
//	           interval is less than this
//	f, fExtra: function to find root of is f(x, fExtra)
//
// Returns:
//
//	result: whether an exact root was found, the process converged to a
//	        bounding interval small than the required error, or the max number
//	        of iterations was hit
//	bestX: best root approximation
//	bestF: function value at bestX
//	errEst: error estimation
func falsePosition(x1, x2, f1, f2, absErr, relErr, bisectTil float64, f objectiveFunc, fExtra []float64) (fSolveResult, float64, float64, float64) {
	// The false position steps are either unmodified, or modified with the
	// Anderson-Bjorck method as appropriate. Theoretically, this has a "speed of
	// convergence" of 1.7 (bisection is 1, Newton is 2).
	// Note that this routine was designed initially to work with gammaincinv, so
	// it may not be tuned right for other problems. Don't use it blindly.

	if f1*f2 >= 0 {
		panic("Initial interval is not a bounding interval")
	}

	const (
		maxIterations = 100
		bisectIter    = 4
		bisectWidth   = 4.0
	)

	const (
		bisect = iota + 1
		falseP
	)

	var state uint8
	if bisectTil > 0 {
		state = bisect
	} else {
		state = falseP
	}

	gamma := 1.0

	w := math.Abs(x2 - x1)
	lastBisectWidth := w

	var nFalseP int
	var x3, f3, bestX, bestF float64
	for i := 0; i < maxIterations; i++ {
		switch state {
		case bisect:
			x3 = 0.5 * (x1 + x2)
			if x3 == x1 || x3 == x2 {
				// i.e., x1 and x2 are successive floating-point numbers
				bestX = x3
				if x3 == x1 {
					bestF = f1
				} else {
					bestF = f2
				}
				return fSolveConverged, bestX, bestF, w
			}

			f3 = f(x3, fExtra)
			if f3 == 0 {
				return fSolveExact, x3, f3, w
			}

			if f3*f2 < 0 {
				x1 = x2
				f1 = f2
			}
			x2 = x3
			f2 = f3
			w = math.Abs(x2 - x1)
			lastBisectWidth = w
			if bisectTil > 0 {
				if w < bisectTil {
					bisectTil = -1.0
					gamma = 1.0
					nFalseP = 0
					state = falseP
				}
			} else {
				gamma = 1.0
				nFalseP = 0
				state = falseP
			}
		case falseP:
			s12 := (f2 - gamma*f1) / (x2 - x1)
			x3 = x2 - f2/s12
			f3 = f(x3, fExtra)
			if f3 == 0 {
				return fSolveExact, x3, f3, w
			}

			nFalseP++
			if f3*f2 < 0 {
				gamma = 1.0
				x1 = x2
				f1 = f2
			} else {
				// Anderson-Bjorck method
				g := 1.0 - f3/f2
				if g <= 0 {
					g = 0.5
				}
				gamma *= g
			}
			x2 = x3
			f2 = f3
			w = math.Abs(x2 - x1)

			// Sanity check. For every 4 false position checks, see if we really are
			// decreasing the interval by comparing to what bisection would have
			// achieved (or, rather, a bit more lenient than that -- interval
			// decreased by 4 instead of by 16, as the fp could be decreasing gamma
			// for a bit). Note that this should guarantee convergence, as it makes
			// sure that we always end up decreasing the interval width with a
			// bisection.
			if nFalseP > bisectIter {
				if w*bisectWidth > lastBisectWidth {
					state = bisect
				}
				nFalseP = 0
				lastBisectWidth = w
			}
		}

		tol := absErr + relErr*math.Max(math.Max(math.Abs(x1), math.Abs(x2)), 1.0)
		if w <= tol {
			if math.Abs(f1) < math.Abs(f2) {
				bestX = x1
				bestF = f1
			} else {
				bestX = x2
				bestF = f2
			}
			return fSolveConverged, bestX, bestF, w
		}
	}

	return fSolveMaxIterations, x3, f3, w
}
