// Copyright ©2015 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package gonum

import "math"

// Dlassq updates a sum of squares represented in scaled form. Dlassq returns
// the values scl and smsq such that
//
//	scl^2*smsq = X[0]^2 + ... + X[n-1]^2 + scale^2*sumsq
//
// The value of sumsq is assumed to be non-negative.
//
// Dlassq is an internal routine. It is exported for testing purposes.
func (impl Implementation) Dlassq(n int, x []float64, incx int, scale float64, sumsq float64) (scl, smsq float64) {
	// Implementation based on Supplemental Material to:
	// Edward Anderson. 2017. Algorithm 978: Safe Scaling in the Level 1 BLAS.
	// ACM Trans. Math. Softw. 44, 1, Article 12 (July 2017), 28 pages.
	// DOI: https://doi.org/10.1145/3061665
	switch {
	case n < 0:
		panic(nLT0)
	case incx <= 0:
		panic(badIncX)
	case len(x) < 1+(n-1)*incx:
		panic(shortX)
	}

	if math.IsNaN(scale) || math.IsNaN(sumsq) {
		return scale, sumsq
	}

	if sumsq == 0 {
		scale = 1
	}
	if scale == 0 {
		scale = 1
		sumsq = 0
	}

	if n == 0 {
		return scale, sumsq
	}

	// Compute the sum of squares in 3 accumulators:
	//  - abig: sum of squares scaled down to avoid overflow
	//  - asml: sum of squares scaled up to avoid underflow
	//  - amed: sum of squares that do not require scaling
	// The thresholds and multipliers are:
	//  - values bigger than dtbig are scaled down by dsbig
	//  - values smaller than dtsml are scaled up by dssml
	var (
		isBig            bool
		asml, amed, abig float64
	)
	for i, ix := 0, 0; i < n; i++ {
		ax := math.Abs(x[ix])
		switch {
		case ax > dtbig:
			ax *= dsbig
			abig += ax * ax
			isBig = true
		case ax < dtsml:
			if !isBig {
				ax *= dssml
				asml += ax * ax
			}
		default:
			amed += ax * ax
		}
		ix += incx
	}
	// Put the existing sum of squares into one of the accumulators.
	if sumsq > 0 {
		ax := scale * math.Sqrt(sumsq)
		switch {
		case ax > dtbig:
			if scale > 1 {
				scale *= dsbig
				abig += scale * (scale * sumsq)
			} else {
				// sumsq > dtbig^2 => (dsbig * (dsbig * sumsq)) is representable.
				abig += scale * (scale * (dsbig * (dsbig * sumsq)))
			}
		case ax < dtsml:
			if !isBig {
				if scale < 1 {
					scale *= dssml
					asml += scale * (scale * sumsq)
				} else {
					// sumsq < dtsml^2 => (dssml * (dssml * sumsq)) is representable.
					asml += scale * (scale * (dssml * (dssml * sumsq)))
				}
			}
		default:
			amed += scale * (scale * sumsq)
		}
	}
	// Combine abig and amed or amed and asml if more than one accumulator was
	// used.
	switch {
	case abig > 0:
		// Combine abig and amed:
		if amed > 0 || math.IsNaN(amed) {
			abig += (amed * dsbig) * dsbig
		}
		scale = 1 / dsbig
		sumsq = abig
	case asml > 0:
		// Combine amed and asml:
		if amed > 0 || math.IsNaN(amed) {
			amed = math.Sqrt(amed)
			asml = math.Sqrt(asml) / dssml
			ymin, ymax := asml, amed
			if asml > amed {
				ymin, ymax = amed, asml
			}
			scale = 1
			sumsq = ymax * ymax * (1 + (ymin/ymax)*(ymin/ymax))
		} else {
			scale = 1 / dssml
			sumsq = asml
		}
	default:
		scale = 1
		sumsq = amed
	}
	return scale, sumsq
}
