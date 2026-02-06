// Copyright ©2016 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package mathext

import "gonum.org/v1/gonum/mathext/internal/amos"

// AiryAi returns the value of the Airy function at z. The Airy function here,
// Ai(z), is one of the two linearly independent solutions to
//
//	y′′ - y*z = 0.
//
// See http://mathworld.wolfram.com/AiryFunctions.html for more detailed information.
func AiryAi(z complex128) complex128 {
	// id specifies the order of the derivative to compute,
	// 0 for the function itself and 1 for the derivative.
	// kode specifies the scaling option. See the function
	// documentation for the exact behavior.
	id := 0
	kode := 1
	air, aii, _, _ := amos.Zairy(real(z), imag(z), id, kode)
	return complex(air, aii)
}

// AiryAiDeriv returns the value of the derivative of the Airy function at z. The
// Airy function here, Ai(z), is one of the two linearly independent solutions to
//
//	y′′ - y*z = 0.
//
// See http://mathworld.wolfram.com/AiryFunctions.html for more detailed information.
func AiryAiDeriv(z complex128) complex128 {
	// id specifies the order of the derivative to compute,
	// 0 for the function itself and 1 for the derivative.
	// kode specifies the scaling option. See the function
	// documentation for the exact behavior.
	id := 1
	kode := 1
	air, aii, _, _ := amos.Zairy(real(z), imag(z), id, kode)
	return complex(air, aii)
}
