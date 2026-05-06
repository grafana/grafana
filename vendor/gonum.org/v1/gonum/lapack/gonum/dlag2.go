// Copyright ©2021 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package gonum

import "math"

// Dlag2 computes the eigenvalues of a 2×2 generalized eigenvalue problem
//
//	A - w*B
//
// where B is an upper triangular matrix.
//
// Dlag2 uses scaling as necessary to avoid over-/underflow. Scaling results in
// a modified eigenvalue problem
//
//	s*A - w*B
//
// where s is a non-negative scaling factor chosen so that w, w*B, and s*A do
// not overflow and, if possible, do not underflow, either.
//
// scale1 and scale2 are used to avoid over-/underflow in the eigenvalue
// equation which defines the first and second eigenvalue respectively. Note
// that scale1 and scale2 may be zero or less than the underflow threshold if
// the corresponding exact eigenvalue is sufficiently large.
//
// If the eigenvalues are real, then:
//   - wi is zero,
//   - the eigenvalues are wr1/scale1 and wr2/scale2.
//
// If the eigenvalues are complex, then:
//   - wi is non-negative,
//   - the eigenvalues are (wr1 ± wi*i)/scale1,
//   - wr1 = wr2,
//   - scale1 = scale2.
//
// Dlag2 assumes that the one-norm of A and B is less than 1/dlamchS. Entries of
// A less than sqrt(dlamchS)*norm(A) are subject to being treated as zero. The
// diagonals of B should be at least sqrt(dlamchS) times the largest element of
// B (in absolute value); if a diagonal is smaller than that, then
// ±sqrt(dlamchS) will be used instead of that diagonal.
//
// Dlag2 is an internal routine. It is exported for testing purposes.
func (Implementation) Dlag2(a []float64, lda int, b []float64, ldb int) (scale1, scale2, wr1, wr2, wi float64) {
	switch {
	case lda < 2:
		panic(badLdA)
	case ldb < 2:
		panic(badLdB)
	case len(a) < lda+2:
		panic(shortA)
	case len(b) < ldb+2:
		panic(shortB)
	}

	const (
		safmin = dlamchS
		safmax = 1 / safmin
		fuzzy1 = 1 + 1e-5
	)
	rtmin := math.Sqrt(safmin)
	rtmax := 1 / rtmin

	// Scale A.
	anorm := math.Max(math.Abs(a[0])+math.Abs(a[lda]),
		math.Abs(a[1])+math.Abs(a[lda+1]))
	anorm = math.Max(anorm, safmin)
	ascale := 1 / anorm
	a11 := ascale * a[0]
	a21 := ascale * a[lda]
	a12 := ascale * a[1]
	a22 := ascale * a[lda+1]

	// Perturb B if necessary to insure non-singularity.
	b11 := b[0]
	b12 := b[1]
	b22 := b[ldb+1]
	bmin := rtmin * math.Max(math.Max(math.Abs(b11), math.Abs(b12)),
		math.Max(math.Abs(b22), rtmin))
	if math.Abs(b11) < bmin {
		b11 = math.Copysign(bmin, b11)
	}
	if math.Abs(b22) < bmin {
		b22 = math.Copysign(bmin, b22)
	}

	// Scale B.
	bnorm := math.Max(math.Max(math.Abs(b11), math.Abs(b12)+math.Abs(b22)), safmin)
	bsize := math.Max(math.Abs(b11), math.Abs(b22))
	bscale := 1 / bsize
	b11 *= bscale
	b12 *= bscale
	b22 *= bscale

	// Compute larger eigenvalue by method described by C. van Loan.
	var (
		as12, abi22   float64
		pp, qq, shift float64
	)
	binv11 := 1 / b11
	binv22 := 1 / b22
	s1 := a11 * binv11
	s2 := a22 * binv22
	// AS is A shifted by -shift*B.
	if math.Abs(s1) <= math.Abs(s2) {
		shift = s1
		as12 = a12 - shift*b12
		as22 := a22 - shift*b22
		ss := a21 * (binv11 * binv22)
		abi22 = as22*binv22 - ss*b12
		pp = 0.5 * abi22
		qq = ss * as12
	} else {
		shift = s2
		as12 = a12 - shift*b12
		as11 := a11 - shift*b11
		ss := a21 * (binv11 * binv22)
		abi22 = -ss * b12
		pp = 0.5 * (as11*binv11 + abi22)
		qq = ss * as12
	}
	var discr, r float64
	if math.Abs(pp*rtmin) >= 1 {
		tmp := rtmin * pp
		discr = tmp*tmp + qq*safmin
		r = math.Sqrt(math.Abs(discr)) * rtmax
	} else {
		pp2 := pp * pp
		if pp2+math.Abs(qq) <= safmin {
			tmp := rtmax * pp
			discr = tmp*tmp + qq*safmax
			r = math.Sqrt(math.Abs(discr)) * rtmin
		} else {
			discr = pp2 + qq
			r = math.Sqrt(math.Abs(discr))
		}
	}

	// TODO(vladimir-ch): Is the following comment from the reference needed in
	// a Go implementation?
	//
	// Note: the test of r in the following `if` is to cover the case when discr
	// is small and negative and is flushed to zero during the calculation of r.
	// On machines which have a consistent flush-to-zero threshold and handle
	// numbers above that threshold correctly, it would not be necessary.
	if discr >= 0 || r == 0 {
		sum := pp + math.Copysign(r, pp)
		diff := pp - math.Copysign(r, pp)
		wbig := shift + sum

		// Compute smaller eigenvalue.
		wsmall := shift + diff
		if 0.5*math.Abs(wbig) > math.Max(math.Abs(wsmall), safmin) {
			wdet := (a11*a22 - a12*a21) * (binv11 * binv22)
			wsmall = wdet / wbig
		}
		// Choose (real) eigenvalue closest to 2,2 element of A*B^{-1} for wr1.
		if pp > abi22 {
			wr1 = math.Min(wbig, wsmall)
			wr2 = math.Max(wbig, wsmall)
		} else {
			wr1 = math.Max(wbig, wsmall)
			wr2 = math.Min(wbig, wsmall)
		}
	} else {
		// Complex eigenvalues.
		wr1 = shift + pp
		wr2 = wr1
		wi = r
	}

	// Further scaling to avoid underflow and overflow in computing
	// scale1 and overflow in computing w*B.
	//
	// This scale factor (wscale) is bounded from above using c1 and c2,
	// and from below using c3 and c4:
	//  - c1 implements the condition s*A must never overflow.
	//  - c2 implements the condition w*B must never overflow.
	//  - c3, with c2, implement the condition that s*A - w*B must never overflow.
	//  - c4 implements the condition s should not underflow.
	//  - c5 implements the condition max(s,|w|) should be at least 2.
	c1 := bsize * (safmin * math.Max(1, ascale))
	c2 := safmin * math.Max(1, bnorm)
	c3 := bsize * safmin
	c4 := 1.0
	c5 := 1.0
	if ascale <= 1 || bsize <= 1 {
		c5 = math.Min(1, ascale*bsize)
		if ascale <= 1 && bsize <= 1 {
			c4 = math.Min(1, (ascale/safmin)*bsize)
		}
	}

	// Scale first eigenvalue.
	wabs := math.Abs(wr1) + math.Abs(wi)
	wsize := math.Max(math.Max(safmin, c1), math.Max(fuzzy1*(wabs*c2+c3),
		math.Min(c4, 0.5*math.Max(wabs, c5))))
	maxABsize := math.Max(ascale, bsize)
	minABsize := math.Min(ascale, bsize)
	if wsize != 1 {
		wscale := 1 / wsize
		if wsize > 1 {
			scale1 = (maxABsize * wscale) * minABsize
		} else {
			scale1 = (minABsize * wscale) * maxABsize
		}
		wr1 *= wscale
		if wi != 0 {
			wi *= wscale
			wr2 = wr1
			scale2 = scale1
		}
	} else {
		scale1 = ascale * bsize
		scale2 = scale1
	}

	// Scale second eigenvalue if real.
	if wi == 0 {
		wsize = math.Max(math.Max(safmin, c1), math.Max(fuzzy1*(math.Abs(wr2)*c2+c3),
			math.Min(c4, 0.5*math.Max(math.Abs(wr2), c5))))
		if wsize != 1 {
			wscale := 1 / wsize
			if wsize > 1 {
				scale2 = (maxABsize * wscale) * minABsize
			} else {
				scale2 = (minABsize * wscale) * maxABsize
			}
			wr2 *= wscale
		} else {
			scale2 = ascale * bsize
		}
	}

	return scale1, scale2, wr1, wr2, wi
}
