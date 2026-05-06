// Copyright ©2016 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package lp

import (
	"gonum.org/v1/gonum/floats"
	"gonum.org/v1/gonum/mat"
)

// TODO(btracey): Have some sort of preprocessing step for helping to fix A to make it
// full rank?
// TODO(btracey): Reduce rows? Get rid of all zeros, places where only one variable
// is there, etc. Could be implemented with a Reduce function.
// TODO(btracey): Provide method of artificial variables for help when problem
// is infeasible?
// TODO(btracey): Add an lp.Solve that solves an LP in non-standard form.

// Convert converts a General-form LP into a standard form LP.
// The general form of an LP is:
//
//	minimize cᵀ * x
//	s.t      G * x <= h
//	         A * x = b
//
// And the standard form is:
//
//	minimize cNewᵀ * x
//	s.t      aNew * x = bNew
//	         x >= 0
//
// If there are no constraints of the given type, the inputs may be nil.
func Convert(c []float64, g mat.Matrix, h []float64, a mat.Matrix, b []float64) (cNew []float64, aNew *mat.Dense, bNew []float64) {
	nVar := len(c)
	nIneq := len(h)

	// Check input sizes.
	if g == nil {
		if nIneq != 0 {
			panic(badShape)
		}
	} else {
		gr, gc := g.Dims()
		if gr != nIneq {
			panic(badShape)
		}
		if gc != nVar {
			panic(badShape)
		}
	}

	nEq := len(b)
	if a == nil {
		if nEq != 0 {
			panic(badShape)
		}
	} else {
		ar, ac := a.Dims()
		if ar != nEq {
			panic(badShape)
		}
		if ac != nVar {
			panic(badShape)
		}
	}

	// Convert the general form LP.
	// Derivation:
	// 0. Start with general form
	//  min.	cᵀ * x
	//  s.t.	G * x <= h
	//  		A * x = b
	// 1. Introduce slack variables for each constraint
	//  min. 	cᵀ * x
	//  s.t.	G * x + s = h
	//			A * x = b
	//      	s >= 0
	// 2. Add non-negativity constraints for x by splitting x
	// into positive and negative components.
	//   x = xp - xn
	//   xp >= 0, xn >= 0
	// This makes the LP
	//  min.	cᵀ * xp - cᵀ xn
	//  s.t. 	G * xp - G * xn + s = h
	//			A * xp  - A * xn = b
	//			xp >= 0, xn >= 0, s >= 0
	// 3. Write the above in standard form:
	//  xt = [xp
	//	 	  xn
	//		  s ]
	//  min.	[cᵀ, -cᵀ, 0] xt
	//  s.t.	[G, -G, I] xt = h
	//   		[A, -A, 0] xt = b
	//			x >= 0

	// In summary:
	// Original LP:
	//  min.	cᵀ * x
	//  s.t.	G * x <= h
	//  		A * x = b
	// Standard Form:
	//  xt = [xp; xn; s]
	//  min.	[cᵀ, -cᵀ, 0] xt
	//  s.t.	[G, -G, I] xt = h
	//   		[A, -A, 0] xt = b
	//			x >= 0

	// New size of x is [xp, xn, s]
	nNewVar := nVar + nVar + nIneq

	// Construct cNew = [c; -c; 0]
	cNew = make([]float64, nNewVar)
	copy(cNew, c)
	copy(cNew[nVar:], c)
	floats.Scale(-1, cNew[nVar:2*nVar])

	// New number of equality constraints is the number of total constraints.
	nNewEq := nIneq + nEq

	// Construct bNew = [h, b].
	bNew = make([]float64, nNewEq)
	copy(bNew, h)
	copy(bNew[nIneq:], b)

	// Construct aNew = [G, -G, I; A, -A, 0].
	aNew = mat.NewDense(nNewEq, nNewVar, nil)
	if nIneq != 0 {
		aNew.Slice(0, nIneq, 0, nVar).(*mat.Dense).Copy(g)
		aNew.Slice(0, nIneq, nVar, 2*nVar).(*mat.Dense).Scale(-1, g)
		aView := aNew.Slice(0, nIneq, 2*nVar, 2*nVar+nIneq).(*mat.Dense)
		for i := 0; i < nIneq; i++ {
			aView.Set(i, i, 1)
		}
	}
	if nEq != 0 {
		aNew.Slice(nIneq, nIneq+nEq, 0, nVar).(*mat.Dense).Copy(a)
		aNew.Slice(nIneq, nIneq+nEq, nVar, 2*nVar).(*mat.Dense).Scale(-1, a)
	}
	return cNew, aNew, bNew
}
