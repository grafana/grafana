// Copyright ©2016 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package mathext

import "gonum.org/v1/gonum/mathext/internal/cephes"

// Zeta computes the Riemann zeta function of two arguments.
//
//	Zeta(x,q) = \sum_{k=0}^{\infty} (k+q)^{-x}
//
// Note that Zeta returns +Inf if x is 1 and will panic if x is less than 1,
// q is either zero or a negative integer, or q is negative and x is not an
// integer.
//
// See http://mathworld.wolfram.com/HurwitzZetaFunction.html
// or https://en.wikipedia.org/wiki/Multiple_zeta_function#Two_parameters_case
// for more detailed information.
func Zeta(x, q float64) float64 {
	return cephes.Zeta(x, q)
}
