// Copyright ©2016 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package mathext

import (
	"math"
)

// Digamma returns the logorithmic derivative of the gamma function at x.
//
//	ψ(x) = d/dx (Ln (Γ(x)).
func Digamma(x float64) float64 {
	// This is adapted from
	// http://web.science.mq.edu.au/~mjohnson/code/digamma.c
	var result float64
	switch {
	case math.IsNaN(x), math.IsInf(x, 1):
		return x
	case math.IsInf(x, -1):
		return math.NaN()
	case x == 0:
		return math.Copysign(math.Inf(1), -x)
	case x < 0:
		if x == math.Floor(x) {
			return math.NaN()
		}
		// Reflection formula, http://dlmf.nist.gov/5.5#E4
		_, r := math.Modf(x)
		result = -math.Pi / math.Tan(math.Pi*r)
		x = 1 - x
	}
	for ; x < 7; x++ {
		// Recurrence relation, http://dlmf.nist.gov/5.5#E2
		result -= 1 / x
	}
	x -= 0.5
	xx := 1 / x
	xx2 := xx * xx
	xx4 := xx2 * xx2
	// Asymptotic expansion, http://dlmf.nist.gov/5.11#E2
	result += math.Log(x) + (1.0/24.0)*xx2 - (7.0/960.0)*xx4 + (31.0/8064.0)*xx4*xx2 - (127.0/30720.0)*xx4*xx4
	return result
}
