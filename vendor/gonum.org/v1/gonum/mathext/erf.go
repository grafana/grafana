// Copyright ©2017 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package mathext

import "math"

/*
Copyright (c) 2012 The Probab Authors. All rights reserved.
Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are
met:
* Redistributions of source code must retain the above copyright
notice, this list of conditions and the following disclaimer.
* Redistributions in binary form must reproduce the above
copyright notice, this list of conditions and the following disclaimer
in the documentation and/or other materials provided with the
distribution.
* Neither the name of Google Inc. nor the names of its
contributors may be used to endorse or promote products derived from
this software without specific prior written permission.
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
"AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

// NormalQuantile computes the quantile function (inverse CDF) of the standard
// normal. NormalQuantile panics if the input p is less than 0 or greater than 1.
func NormalQuantile(p float64) float64 {
	switch {
	case p < 0 || 1 < p:
		panic("mathext: quantile out of bounds")
	case p == 1:
		return math.Inf(1)
	case p == 0:
		return math.Inf(-1)
	}
	// Compute rational approximation based on the value of p.

	dp := p - 0.5
	if math.Abs(dp) <= 0.425 {
		z := 0.180625 - dp*dp
		z1 := ((((((zQSA[0]*z+zQSA[1])*z+zQSA[2])*z+zQSA[3])*z+zQSA[4])*z+zQSA[5])*z+zQSA[6])*z + zQSA[7]
		z2 := ((((((zQSB[0]*z+zQSB[1])*z+zQSB[2])*z+zQSB[3])*z+zQSB[4])*z+zQSB[5])*z+zQSB[6])*z + zQSB[7]
		return dp * z1 / z2
	}

	if p < 0.5 {
		r := math.Sqrt(-math.Log(p))
		if r <= 5.0 {
			z := r - 1.6
			z1 := ((((((zQIA[0]*z+zQIA[1])*z+zQIA[2])*z+zQIA[3])*z+zQIA[4])*z+zQIA[5])*z+zQIA[6])*z + zQIA[7]
			z2 := ((((((zQIB[0]*z+zQIB[1])*z+zQIB[2])*z+zQIB[3])*z+zQIB[4])*z+zQIB[5])*z+zQIB[6])*z + zQIB[7]
			return -z1 / z2
		}
		z := r - 5
		z1 := ((((((zQTA[0]*z+zQTA[1])*z+zQTA[2])*z+zQTA[3])*z+zQTA[4])*z+zQTA[5])*z+zQTA[6])*z + zQTA[7]
		z2 := ((((((zQTB[0]*z+zQTB[1])*z+zQTB[2])*z+zQTB[3])*z+zQTB[4])*z+zQTB[5])*z+zQTB[6])*z + zQTB[7]
		return -z1 / z2
	}
	r := math.Sqrt(-math.Log(1 - p))
	if r <= 5.0 {
		z := r - 1.6
		z1 := ((((((zQIA[0]*z+zQIA[1])*z+zQIA[2])*z+zQIA[3])*z+zQIA[4])*z+zQIA[5])*z+zQIA[6])*z + zQIA[7]
		z2 := ((((((zQIB[0]*z+zQIB[1])*z+zQIB[2])*z+zQIB[3])*z+zQIB[4])*z+zQIB[5])*z+zQIB[6])*z + zQIB[7]
		return z1 / z2
	}

	z := r - 5
	z1 := ((((((zQTA[0]*z+zQTA[1])*z+zQTA[2])*z+zQTA[3])*z+zQTA[4])*z+zQTA[5])*z+zQTA[6])*z + zQTA[7]
	z2 := ((((((zQTB[0]*z+zQTB[1])*z+zQTB[2])*z+zQTB[3])*z+zQTB[4])*z+zQTB[5])*z+zQTB[6])*z + zQTB[7]
	return z1 / z2
}

var (
	zQSA = [...]float64{2509.0809287301226727, 33430.575583588128105, 67265.770927008700853, 45921.953931549871457, 13731.693765509461125, 1971.5909503065514427, 133.14166789178437745, 3.387132872796366608}
	zQSB = [...]float64{5226.495278852854561, 28729.085735721942674, 39307.89580009271061, 21213.794301586595867, 5394.1960214247511077, 687.1870074920579083, 42.313330701600911252, 1.0}
	zQIA = [...]float64{7.7454501427834140764e-4, 0.0227238449892691845833, 0.24178072517745061177, 1.27045825245236838258, 3.64784832476320460504, 5.7694972214606914055, 4.6303378461565452959, 1.42343711074968357734}
	zQIB = [...]float64{1.05075007164441684324e-9, 5.475938084995344946e-4, 0.0151986665636164571966, 0.14810397642748007459, 0.68976733498510000455, 1.6763848301838038494, 2.05319162663775882187, 1.0}
	zQTA = [...]float64{2.01033439929228813265e-7, 2.71155556874348757815e-5, 0.0012426609473880784386, 0.026532189526576123093, 0.29656057182850489123, 1.7848265399172913358, 5.4637849111641143699, 6.6579046435011037772}
	zQTB = [...]float64{2.04426310338993978564e-15, 1.4215117583164458887e-7, 1.8463183175100546818e-5, 7.868691311456132591e-4, 0.0148753612908506148525, 0.13692988092273580531, 0.59983220655588793769, 1.0}
)
