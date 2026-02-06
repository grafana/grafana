// Derived from SciPy's special/c_misc/gammaincinv.c
// https://github.com/scipy/scipy/blob/master/scipy/special/c_misc/gammaincinv.c

// Copyright ©2017 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package mathext

import (
	"math"

	"gonum.org/v1/gonum/mathext/internal/cephes"
)

const (
	allowedATol = 1e-306
	allowedRTol = 1e-6
)

func gammaIncReg(x float64, params []float64) float64 {
	return cephes.Igam(params[0], x) - params[1]
}

// gammaIncRegInv is the inverse of the regularized incomplete Gamma integral. That is, it
// returns x such that:
//
//	Igam(a, x) = y
//
// The input argument a must be positive and y must be between 0 and 1
// inclusive or gammaIncRegInv will panic. gammaIncRegInv should return a
// positive number, but can return NaN if there is a failure to converge.
func gammaIncRegInv(a, y float64) float64 {
	// For y not small, we just use
	//  IgamI(a, 1-y)
	// (inverse of the complemented incomplete Gamma integral). For y small,
	// however, 1-y is about 1, and we lose digits.
	if a <= 0 || y <= 0 || y >= 0.25 {
		return cephes.IgamI(a, 1-y)
	}

	lo := 0.0
	flo := -y
	hi := cephes.IgamI(a, 0.75)
	fhi := 0.25 - y

	params := []float64{a, y}

	// Also, after we generate a small interval by bisection above, false
	// position will do a large step from an interval of width ~1e-4 to ~1e-14
	// in one step (a=10, x=0.05, but similar for other values).
	result, bestX, _, errEst := falsePosition(lo, hi, flo, fhi, 2*machEp, 2*machEp, 1e-2*a, gammaIncReg, params)
	if result == fSolveMaxIterations && errEst > allowedATol+allowedRTol*math.Abs(bestX) {
		bestX = math.NaN()
	}

	return bestX
}
