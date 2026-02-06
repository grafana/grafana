// Copyright ©2015 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package gonum

import "math"

// Dlartg generates a plane rotation so that
//
//	[ cs sn] * [f] = [r]
//	[-sn cs]   [g] = [0]
//
// where cs*cs + sn*sn = 1.
//
// This is a more accurate version of BLAS Drotg that uses scaling to avoid
// overflow or underflow, with the other differences that
//   - cs >= 0
//   - if g = 0, then cs = 1 and sn = 0
//   - if f = 0 and g != 0, then cs = 0 and sn = sign(1,g)
//
// Dlartg is an internal routine. It is exported for testing purposes.
func (impl Implementation) Dlartg(f, g float64) (cs, sn, r float64) {
	// Implementation based on Supplemental Material to:
	//
	// Edward Anderson
	// Algorithm 978: Safe Scaling in the Level 1 BLAS
	// ACM Trans. Math. Softw. 44, 1, Article 12 (2017)
	// DOI: https://doi.org/10.1145/3061665
	//
	// For further details see:
	//
	// W. Pereira, A. Lotfi, J. Langou
	// Numerical analysis of Givens rotation
	// DOI: https://doi.org/10.48550/arXiv.2211.04010

	if g == 0 {
		return 1, 0, f
	}

	g1 := math.Abs(g)

	if f == 0 {
		return 0, math.Copysign(1, g), g1
	}

	const safmin = dlamchS
	const safmax = 1 / safmin
	rtmin := math.Sqrt(safmin)
	rtmax := math.Sqrt(safmax / 2)

	f1 := math.Abs(f)

	if rtmin < f1 && f1 < rtmax && rtmin < g1 && g1 < rtmax {
		d := math.Sqrt(f*f + g*g)
		cs = f1 / d
		r = math.Copysign(d, f)
		sn = g / r

		return cs, sn, r
	}

	u := math.Min(math.Max(safmin, math.Max(f1, g1)), safmax)
	fs := f / u
	gs := g / u
	d := math.Sqrt(fs*fs + gs*gs)
	cs = math.Abs(fs) / d
	r = math.Copysign(d, f)
	sn = gs / r
	r *= u

	return cs, sn, r
}
