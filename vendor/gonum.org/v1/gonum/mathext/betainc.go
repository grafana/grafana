// Copyright ©2016 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package mathext

import "gonum.org/v1/gonum/mathext/internal/cephes"

// RegIncBeta returns the value of the regularized incomplete beta function
// I(x;a,b). It is defined as
//
//	I(x;a,b) = B(x;a,b) / B(a,b)
//	         = Γ(a+b) / (Γ(a)*Γ(b)) * int_0^x u^(a-1) * (1-u)^(b-1) du.
//
// The domain of definition is 0 <= x <= 1, and the parameters a and b must be positive.
// For other values of x, a, and b RegIncBeta will panic.
func RegIncBeta(a, b float64, x float64) float64 {
	return cephes.Incbet(a, b, x)
}

// InvRegIncBeta computes the inverse of the regularized incomplete beta function.
// It returns the x for which
//
//	y = I(x;a,b)
//
// The domain of definition is 0 <= y <= 1, and the parameters a and b must be
// positive. For other values of x, a, and b InvRegIncBeta will panic.
func InvRegIncBeta(a, b float64, y float64) float64 {
	if y < 0 || 1 < y {
		panic("mathext: parameter out of range")
	}
	return cephes.Incbi(a, b, y)
}
