// Copyright ©2016 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package mathext

import "gonum.org/v1/gonum/mathext/internal/gonum"

// Beta returns the value of the complete beta function B(a, b). It is defined as
//
//	Γ(a)Γ(b) / Γ(a+b)
//
// Special cases are:
//
//	B(a,b) returns NaN if a or b is Inf
//	B(a,b) returns NaN if a and b are 0
//	B(a,b) returns NaN if a or b is NaN
//	B(a,b) returns NaN if a or b is < 0
//	B(a,b) returns +Inf if a xor b is 0.
//
// See http://mathworld.wolfram.com/BetaFunction.html for more detailed information.
func Beta(a, b float64) float64 {
	return gonum.Beta(a, b)
}

// Lbeta returns the natural logarithm of the complete beta function B(a,b).
// Lbeta is defined as:
//
//	Ln(Γ(a)Γ(b)/Γ(a+b))
//
// Special cases are:
//
//	Lbeta(a,b) returns NaN if a or b is Inf
//	Lbeta(a,b) returns NaN if a and b are 0
//	Lbeta(a,b) returns NaN if a or b is NaN
//	Lbeta(a,b) returns NaN if a or b is < 0
//	Lbeta(a,b) returns +Inf if a xor b is 0.
func Lbeta(a, b float64) float64 {
	return gonum.Lbeta(a, b)
}
