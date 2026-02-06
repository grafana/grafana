// Copyright ©2016 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package mathext

import "math"

const (
	logPi = 1.14472988584940017414342735135305871164729481 // http://oeis.org/A053510
)

// MvLgamma returns the log of the multivariate Gamma function. Dim
// must be greater than zero, and MvLgamma will return NaN if v < (dim-1)/2.
//
// See https://en.wikipedia.org/wiki/Multivariate_gamma_function for more
// information.
func MvLgamma(v float64, dim int) float64 {
	if dim < 1 {
		panic("mathext: negative dimension")
	}
	df := float64(dim)
	if v < (df-1)*0.5 {
		return math.NaN()
	}
	ans := df * (df - 1) * 0.25 * logPi
	for i := 1; i <= dim; i++ {
		lg, _ := math.Lgamma(v + float64(1-i)*0.5)
		ans += lg
	}
	return ans
}
