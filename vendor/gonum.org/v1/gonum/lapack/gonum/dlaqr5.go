// Copyright ©2016 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package gonum

import (
	"math"

	"gonum.org/v1/gonum/blas"
	"gonum.org/v1/gonum/blas/blas64"
)

// Dlaqr5 performs a single small-bulge multi-shift QR sweep on an isolated
// block of a Hessenberg matrix.
//
// wantt and wantz determine whether the quasi-triangular Schur factor and the
// orthogonal Schur factor, respectively, will be computed.
//
// kacc22 specifies the computation mode of far-from-diagonal orthogonal
// updates. Permitted values are:
//
//	0: Dlaqr5 will not accumulate reflections and will not use matrix-matrix
//	   multiply to update far-from-diagonal matrix entries.
//	1: Dlaqr5 will accumulate reflections and use matrix-matrix multiply to
//	   update far-from-diagonal matrix entries.
//	2: Same as kacc22=1. This option used to enable exploiting the 2×2 structure
//	   during matrix multiplications, but this is no longer supported.
//
// For other values of kacc2 Dlaqr5 will panic.
//
// n is the order of the Hessenberg matrix H.
//
// ktop and kbot are indices of the first and last row and column of an isolated
// diagonal block upon which the QR sweep will be applied. It must hold that
//
//	ktop == 0,   or 0 < ktop <= n-1 and H[ktop, ktop-1] == 0, and
//	kbot == n-1, or 0 <= kbot < n-1 and H[kbot+1, kbot] == 0,
//
// otherwise Dlaqr5 will panic.
//
// nshfts is the number of simultaneous shifts. It must be positive and even,
// otherwise Dlaqr5 will panic.
//
// sr and si contain the real and imaginary parts, respectively, of the shifts
// of origin that define the multi-shift QR sweep. On return both slices may be
// reordered by Dlaqr5. Their length must be equal to nshfts, otherwise Dlaqr5
// will panic.
//
// h and ldh represent the Hessenberg matrix H of size n×n. On return
// multi-shift QR sweep with shifts sr+i*si has been applied to the isolated
// diagonal block in rows and columns ktop through kbot, inclusive.
//
// iloz and ihiz specify the rows of Z to which transformations will be applied
// if wantz is true. It must hold that 0 <= iloz <= ihiz < n, otherwise Dlaqr5
// will panic.
//
// z and ldz represent the matrix Z of size n×n. If wantz is true, the QR sweep
// orthogonal similarity transformation is accumulated into
// z[iloz:ihiz,iloz:ihiz] from the right, otherwise z not referenced.
//
// v and ldv represent an auxiliary matrix V of size (nshfts/2)×3. Note that V
// is transposed with respect to the reference netlib implementation.
//
// u and ldu represent an auxiliary matrix of size (2*nshfts)×(2*nshfts).
//
// wh and ldwh represent an auxiliary matrix of size (2*nshfts-1)×nh.
//
// wv and ldwv represent an auxiliary matrix of size nv×(2*nshfts-1).
//
// Dlaqr5 is an internal routine. It is exported for testing purposes.
func (impl Implementation) Dlaqr5(wantt, wantz bool, kacc22 int, n, ktop, kbot, nshfts int, sr, si []float64, h []float64, ldh int, iloz, ihiz int, z []float64, ldz int, v []float64, ldv int, u []float64, ldu int, nv int, wv []float64, ldwv int, nh int, wh []float64, ldwh int) {
	switch {
	case kacc22 != 0 && kacc22 != 1 && kacc22 != 2:
		panic(badKacc22)
	case n < 0:
		panic(nLT0)
	case ktop < 0 || n <= ktop:
		panic(badKtop)
	case kbot < 0 || n <= kbot:
		panic(badKbot)

	case nshfts < 0:
		panic(nshftsLT0)
	case nshfts&0x1 != 0:
		panic(nshftsOdd)
	case len(sr) != nshfts:
		panic(badLenSr)
	case len(si) != nshfts:
		panic(badLenSi)

	case ldh < max(1, n):
		panic(badLdH)
	case len(h) < (n-1)*ldh+n:
		panic(shortH)

	case wantz && ihiz >= n:
		panic(badIhiz)
	case wantz && iloz < 0 || ihiz < iloz:
		panic(badIloz)
	case ldz < 1, wantz && ldz < n:
		panic(badLdZ)
	case wantz && len(z) < (n-1)*ldz+n:
		panic(shortZ)

	case ldv < 3:
		// V is transposed w.r.t. reference lapack.
		panic(badLdV)
	case len(v) < (nshfts/2-1)*ldv+3:
		panic(shortV)

	case ldu < max(1, 2*nshfts):
		panic(badLdU)
	case len(u) < (2*nshfts-1)*ldu+2*nshfts:
		panic(shortU)

	case nv < 0:
		panic(nvLT0)
	case ldwv < max(1, 2*nshfts):
		panic(badLdWV)
	case len(wv) < (nv-1)*ldwv+2*nshfts:
		panic(shortWV)

	case nh < 0:
		panic(nhLT0)
	case ldwh < max(1, nh):
		panic(badLdWH)
	case len(wh) < (2*nshfts-1)*ldwh+nh:
		panic(shortWH)

	case ktop > 0 && h[ktop*ldh+ktop-1] != 0:
		panic(notIsolated)
	case kbot < n-1 && h[(kbot+1)*ldh+kbot] != 0:
		panic(notIsolated)
	}

	// If there are no shifts, then there is nothing to do.
	if nshfts < 2 {
		return
	}
	// If the active block is empty or 1×1, then there is nothing to do.
	if ktop >= kbot {
		return
	}

	// Shuffle shifts into pairs of real shifts and pairs of complex
	// conjugate shifts assuming complex conjugate shifts are already
	// adjacent to one another.
	for i := 0; i < nshfts-2; i += 2 {
		if si[i] == -si[i+1] {
			continue
		}
		sr[i], sr[i+1], sr[i+2] = sr[i+1], sr[i+2], sr[i]
		si[i], si[i+1], si[i+2] = si[i+1], si[i+2], si[i]
	}

	// Note: lapack says that nshfts must be even but allows it to be odd
	// anyway. We panic above if nshfts is not even, so reducing it by one
	// is unnecessary. The only caller Dlaqr04 uses only even nshfts.
	//
	// The original comment and code from lapack-3.6.0/SRC/dlaqr5.f:341:
	// *     ==== NSHFTS is supposed to be even, but if it is odd,
	// *     .    then simply reduce it by one.  The shuffle above
	// *     .    ensures that the dropped shift is real and that
	// *     .    the remaining shifts are paired. ====
	// *
	//      NS = NSHFTS - MOD( NSHFTS, 2 )
	ns := nshfts

	safmin := dlamchS
	ulp := dlamchP
	smlnum := safmin * float64(n) / ulp

	// Use accumulated reflections to update far-from-diagonal entries?
	accum := kacc22 == 1 || kacc22 == 2

	// Clear trash.
	if ktop+2 <= kbot {
		h[(ktop+2)*ldh+ktop] = 0
	}

	// nbmps = number of 2-shift bulges in the chain.
	nbmps := ns / 2

	// kdu = width of slab.
	kdu := 4 * nbmps

	// Create and chase chains of nbmps bulges.
	for incol := ktop - 2*nbmps + 1; incol <= kbot-2; incol += 2 * nbmps {
		// jtop is an index from which updates from the right start.
		var jtop int
		switch {
		case accum:
			jtop = max(ktop, incol)
		case wantt:
		default:
			jtop = ktop
		}
		ndcol := incol + kdu
		if accum {
			impl.Dlaset(blas.All, kdu, kdu, 0, 1, u, ldu)
		}
		// Near-the-diagonal bulge chase. The following loop performs
		// the near-the-diagonal part of a small bulge multi-shift QR
		// sweep. Each 4*nbmps column diagonal chunk extends from
		// column incol to column ndcol (including both column incol and
		// column ndcol). The following loop chases a 2*nbmps+1 column
		// long chain of nbmps bulges 2*nbmps columns to the right.
		// (incol may be less than ktop and ndcol may be greater than
		// kbot indicating phantom columns from which to chase bulges
		// before they are actually introduced or to which to chase
		// bulges beyond column kbot.)
		for krcol := incol; krcol <= min(incol+2*nbmps-1, kbot-2); krcol++ {
			// Bulges number mtop to mbot are active double implicit
			// shift bulges. There may or may not also be small 2×2
			// bulge, if there is room. The inactive bulges (if any)
			// must wait until the active bulges have moved down the
			// diagonal to make room. The phantom matrix paradigm
			// described above helps keep track.
			mtop := max(0, (ktop-krcol)/2)
			mbot := min(nbmps, (kbot-krcol-1)/2) - 1
			m22 := mbot + 1
			bmp22 := (mbot < nbmps-1) && (krcol+2*m22 == kbot-2)
			// Generate reflections to chase the chain right one column.
			// The minimum value of k is ktop-1.
			if bmp22 {
				// Special case: 2×2 reflection at bottom treated separately.
				k := krcol + 2*m22
				if k == ktop-1 {
					impl.Dlaqr1(2, h[(k+1)*ldh+k+1:], ldh,
						sr[2*m22], si[2*m22], sr[2*m22+1], si[2*m22+1],
						v[m22*ldv:m22*ldv+2])
					beta := v[m22*ldv]
					_, v[m22*ldv] = impl.Dlarfg(2, beta, v[m22*ldv+1:m22*ldv+2], 1)
				} else {
					beta := h[(k+1)*ldh+k]
					v[m22*ldv+1] = h[(k+2)*ldh+k]
					beta, v[m22*ldv] = impl.Dlarfg(2, beta, v[m22*ldv+1:m22*ldv+2], 1)
					h[(k+1)*ldh+k] = beta
					h[(k+2)*ldh+k] = 0
				}
				// Perform update from right within computational window.
				t1 := v[m22*ldv]
				t2 := t1 * v[m22*ldv+1]
				for j := jtop; j <= min(kbot, k+3); j++ {
					refsum := h[j*ldh+k+1] + v[m22*ldv+1]*h[j*ldh+k+2]
					h[j*ldh+k+1] -= refsum * t1
					h[j*ldh+k+2] -= refsum * t2
				}
				// Perform update from left within computational window.
				var jbot int
				switch {
				case accum:
					jbot = min(ndcol, kbot)
				case wantt:
					jbot = n - 1
				default:
					jbot = kbot
				}
				t1 = v[m22*ldv]
				t2 = t1 * v[m22*ldv+1]
				for j := k + 1; j <= jbot; j++ {
					refsum := h[(k+1)*ldh+j] + v[m22*ldv+1]*h[(k+2)*ldh+j]
					h[(k+1)*ldh+j] -= refsum * t1
					h[(k+2)*ldh+j] -= refsum * t2
				}
				// The following convergence test requires that the traditional
				// small-compared-to-nearby-diagonals criterion and the Ahues &
				// Tisseur (LAWN 122, 1997) criteria both be satisfied. The latter
				// improves accuracy in some examples. Falling back on an alternate
				// convergence criterion when tst1 or tst2 is zero (as done here) is
				// traditional but probably unnecessary.
				if k >= ktop && h[(k+1)*ldh+k] != 0 {
					tst1 := math.Abs(h[k*ldh+k]) + math.Abs(h[(k+1)*ldh+k+1])
					if tst1 == 0 {
						if k >= ktop+1 {
							tst1 += math.Abs(h[k*ldh+k-1])
						}
						if k >= ktop+2 {
							tst1 += math.Abs(h[k*ldh+k-2])
						}
						if k >= ktop+3 {
							tst1 += math.Abs(h[k*ldh+k-3])
						}
						if k <= kbot-2 {
							tst1 += math.Abs(h[(k+2)*ldh+k+1])
						}
						if k <= kbot-3 {
							tst1 += math.Abs(h[(k+3)*ldh+k+1])
						}
						if k <= kbot-4 {
							tst1 += math.Abs(h[(k+4)*ldh+k+1])
						}
					}
					if math.Abs(h[(k+1)*ldh+k]) <= math.Max(smlnum, ulp*tst1) {
						h12 := math.Max(math.Abs(h[(k+1)*ldh+k]), math.Abs(h[k*ldh+k+1]))
						h21 := math.Min(math.Abs(h[(k+1)*ldh+k]), math.Abs(h[k*ldh+k+1]))
						h11 := math.Max(math.Abs(h[(k+1)*ldh+k+1]), math.Abs(h[k*ldh+k]-h[(k+1)*ldh+k+1]))
						h22 := math.Min(math.Abs(h[(k+1)*ldh+k+1]), math.Abs(h[k*ldh+k]-h[(k+1)*ldh+k+1]))
						scl := h11 + h12
						tst2 := h22 * (h11 / scl)
						if tst2 == 0 || h21*(h12/scl) <= math.Max(smlnum, ulp*tst2) {
							h[(k+1)*ldh+k] = 0
						}
					}
				}
				// Accumulate orthogonal transformations.
				if accum {
					kms := k - incol - 1
					t1 = v[m22*ldv]
					t2 = t1 * v[m22*ldv+1]
					for j := max(0, ktop-incol-1); j < kdu; j++ {
						refsum := u[j*ldu+kms+1] + v[m22*ldv+1]*u[j*ldu+kms+2]
						u[j*ldu+kms+1] -= refsum * t1
						u[j*ldu+kms+2] -= refsum * t2
					}
				} else if wantz {
					t1 = v[m22*ldv]
					t2 = t1 * v[m22*ldv+1]
					for j := iloz; j <= ihiz; j++ {
						refsum := z[j*ldz+k+1] + v[m22*ldv+1]*z[j*ldz+k+2]
						z[j*ldz+k+1] -= refsum * t1
						z[j*ldz+k+2] -= refsum * t2
					}
				}
			}
			// Normal case: Chain of 3×3 reflections.
			for m := mbot; m >= mtop; m-- {
				k := krcol + 2*m
				if k == ktop-1 {
					impl.Dlaqr1(3, h[ktop*ldh+ktop:], ldh,
						sr[2*m], si[2*m], sr[2*m+1], si[2*m+1],
						v[m*ldv:m*ldv+3])
					alpha := v[m*ldv]
					_, v[m*ldv] = impl.Dlarfg(3, alpha, v[m*ldv+1:m*ldv+3], 1)
				} else {
					// Perform delayed transformation of row below m-th bulge.
					// Exploit fact that first two elements of row are actually
					// zero.
					t1 := v[m*ldv]
					t2 := t1 * v[m*ldv+1]
					t3 := t1 * v[m*ldv+2]
					refsum := v[m*ldv+2] * h[(k+3)*ldh+k+2]
					h[(k+3)*ldh+k] = -refsum * t1
					h[(k+3)*ldh+k+1] = -refsum * t2
					h[(k+3)*ldh+k+2] -= refsum * t3
					// Calculate reflection to move m-th bulge one step.
					beta := h[(k+1)*ldh+k]
					v[m*ldv+1] = h[(k+2)*ldh+k]
					v[m*ldv+2] = h[(k+3)*ldh+k]
					beta, v[m*ldv] = impl.Dlarfg(3, beta, v[m*ldv+1:m*ldv+3], 1)
					// A bulge may collapse because of vigilant deflation or
					// destructive underflow. In the underflow case, try the
					// two-small-subdiagonals trick to try to reinflate the
					// bulge.
					if h[(k+3)*ldh+k] != 0 || h[(k+3)*ldh+k+1] != 0 || h[(k+3)*ldh+k+2] == 0 {
						// Typical case: not collapsed (yet).
						h[(k+1)*ldh+k] = beta
						h[(k+2)*ldh+k] = 0
						h[(k+3)*ldh+k] = 0
					} else {
						// Atypical case: collapsed. Attempt to reintroduce
						// ignoring H[k+1,k] and H[k+2,k]. If the fill resulting
						// from the new reflector is too large, then abandon it.
						// Otherwise, use the new one.
						var vt [3]float64
						impl.Dlaqr1(3, h[(k+1)*ldh+k+1:], ldh,
							sr[2*m], si[2*m], sr[2*m+1], si[2*m+1],
							vt[:])
						_, vt[0] = impl.Dlarfg(3, vt[0], vt[1:3], 1)
						t1 = vt[0]
						t2 = t1 * vt[1]
						t3 = t1 * vt[2]
						refsum = h[(k+1)*ldh+k] + vt[1]*h[(k+2)*ldh+k]
						dsum := math.Abs(h[k*ldh+k]) + math.Abs(h[(k+1)*ldh+k+1]) + math.Abs(h[(k+2)*ldh+k+2])
						if math.Abs(h[(k+2)*ldh+k]-refsum*t2)+math.Abs(refsum*t3) > ulp*dsum {
							// Starting a new bulge here would create
							// non-negligible fill. Use the old one with
							// trepidation.
							h[(k+1)*ldh+k] = beta
							h[(k+2)*ldh+k] = 0
							h[(k+3)*ldh+k] = 0
						} else {
							// Starting a new bulge here would create only
							// negligible fill. Replace the old reflector with
							// the new one.
							h[(k+1)*ldh+k] -= refsum * t1
							h[(k+2)*ldh+k] = 0
							h[(k+3)*ldh+k] = 0
							v[m*ldv] = vt[0]
							v[m*ldv+1] = vt[1]
							v[m*ldv+2] = vt[2]
						}
					}
				}
				// Apply reflection from the right and the first column of
				// update from the left. These updates are required for the
				// vigilant deflation check. We still delay most of the updates
				// from the left for efficiency.
				t1 := v[m*ldv]
				t2 := t1 * v[m*ldv+1]
				t3 := t1 * v[m*ldv+2]
				for j := jtop; j <= min(kbot, k+3); j++ {
					refsum := h[j*ldh+k+1] + v[m*ldv+1]*h[j*ldh+k+2] + v[m*ldv+2]*h[j*ldh+k+3]
					h[j*ldh+k+1] -= refsum * t1
					h[j*ldh+k+2] -= refsum * t2
					h[j*ldh+k+3] -= refsum * t3
				}
				// Perform update from left for subsequent column.
				refsum := h[(k+1)*ldh+k+1] + v[m*ldv+1]*h[(k+2)*ldh+k+1] + v[m*ldv+2]*h[(k+3)*ldh+k+1]
				h[(k+1)*ldh+k+1] -= refsum * t1
				h[(k+2)*ldh+k+1] -= refsum * t2
				h[(k+3)*ldh+k+1] -= refsum * t3
				// The following convergence test requires that the tradition
				// small-compared-to-nearby-diagonals criterion and the Ahues &
				// Tisseur (LAWN 122, 1997) criteria both be satisfied. The
				// latter improves accuracy in some examples. Falling back on an
				// alternate convergence criterion when tst1 or tst2 is zero (as
				// done here) is traditional but probably unnecessary.
				if k < ktop {
					continue
				}
				if h[(k+1)*ldh+k] != 0 {
					tst1 := math.Abs(h[k*ldh+k]) + math.Abs(h[(k+1)*ldh+k+1])
					if tst1 == 0 {
						if k >= ktop+1 {
							tst1 += math.Abs(h[k*ldh+k-1])
						}
						if k >= ktop+2 {
							tst1 += math.Abs(h[k*ldh+k-2])
						}
						if k >= ktop+3 {
							tst1 += math.Abs(h[k*ldh+k-3])
						}
						if k <= kbot-2 {
							tst1 += math.Abs(h[(k+2)*ldh+k+1])
						}
						if k <= kbot-3 {
							tst1 += math.Abs(h[(k+3)*ldh+k+1])
						}
						if k <= kbot-4 {
							tst1 += math.Abs(h[(k+4)*ldh+k+1])
						}
					}
					if math.Abs(h[(k+1)*ldh+k]) <= math.Max(smlnum, ulp*tst1) {
						h12 := math.Max(math.Abs(h[(k+1)*ldh+k]), math.Abs(h[k*ldh+k+1]))
						h21 := math.Min(math.Abs(h[(k+1)*ldh+k]), math.Abs(h[k*ldh+k+1]))
						h11 := math.Max(math.Abs(h[(k+1)*ldh+k+1]), math.Abs(h[k*ldh+k]-h[(k+1)*ldh+k+1]))
						h22 := math.Min(math.Abs(h[(k+1)*ldh+k+1]), math.Abs(h[k*ldh+k]-h[(k+1)*ldh+k+1]))
						scl := h11 + h12
						tst2 := h22 * (h11 / scl)
						if tst2 == 0 || h21*(h12/scl) <= math.Max(smlnum, ulp*tst2) {
							h[(k+1)*ldh+k] = 0
						}
					}
				}
			}
			// Multiply H by reflections from the left.
			var jbot int
			switch {
			case accum:
				jbot = min(ndcol, kbot)
			case wantt:
				jbot = n - 1
			default:
				jbot = kbot
			}
			for m := mbot; m >= mtop; m-- {
				k := krcol + 2*m
				t1 := v[m*ldv]
				t2 := t1 * v[m*ldv+1]
				t3 := t1 * v[m*ldv+2]
				for j := max(ktop, krcol+2*(m+1)); j <= jbot; j++ {
					refsum := h[(k+1)*ldh+j] + v[m*ldv+1]*h[(k+2)*ldh+j] + v[m*ldv+2]*h[(k+3)*ldh+j]
					h[(k+1)*ldh+j] -= refsum * t1
					h[(k+2)*ldh+j] -= refsum * t2
					h[(k+3)*ldh+j] -= refsum * t3
				}
			}
			// Accumulate orthogonal transformations.
			if accum {
				// Accumulate U. If necessary, update Z later with an
				// efficient matrix-matrix multiply.
				for m := mbot; m >= mtop; m-- {
					k := krcol + 2*m
					kms := k - incol - 1
					i2 := max(0, ktop-incol-1)
					i2 = max(i2, kms-(krcol-incol))
					i4 := min(kdu, krcol+2*mbot-incol+5)
					t1 := v[m*ldv]
					t2 := t1 * v[m*ldv+1]
					t3 := t1 * v[m*ldv+2]
					for j := i2; j < i4; j++ {
						refsum := u[j*ldu+kms+1] + v[m*ldv+1]*u[j*ldu+kms+2] + v[m*ldv+2]*u[j*ldu+kms+3]
						u[j*ldu+kms+1] -= refsum * t1
						u[j*ldu+kms+2] -= refsum * t2
						u[j*ldu+kms+3] -= refsum * t3
					}
				}
			} else if wantz {
				// U is not accumulated, so update Z now by multiplying by
				// reflections from the right.
				for m := mbot; m >= mtop; m-- {
					k := krcol + 2*m
					t1 := v[m*ldv]
					t2 := t1 * v[m*ldv+1]
					t3 := t1 * v[m*ldv+2]
					for j := iloz; j <= ihiz; j++ {
						refsum := z[j*ldz+k+1] + v[m*ldv+1]*z[j*ldz+k+2] + v[m*ldv+2]*z[j*ldz+k+3]
						z[j*ldz+k+1] -= refsum * t1
						z[j*ldz+k+2] -= refsum * t2
						z[j*ldz+k+3] -= refsum * t3
					}
				}
			}
		}
		// Use U (if accumulated) to update far-from-diagonal entries in H.
		// If required, use U to update Z as well.
		if !accum {
			continue
		}
		jtop, jbot := ktop, kbot
		if wantt {
			jtop = 0
			jbot = n - 1
		}
		bi := blas64.Implementation()
		k1 := max(0, ktop-incol-1)
		nu := kdu - max(0, ndcol-kbot) - k1
		// Horizontal multiply.
		for jcol := min(ndcol, kbot) + 1; jcol <= jbot; jcol += nh {
			jlen := min(nh, jbot-jcol+1)
			bi.Dgemm(blas.Trans, blas.NoTrans, nu, jlen, nu,
				1, u[k1*ldu+k1:], ldu,
				h[(incol+k1+1)*ldh+jcol:], ldh,
				0, wh, ldwh)
			impl.Dlacpy(blas.All, nu, jlen, wh, ldwh, h[(incol+k1+1)*ldh+jcol:], ldh)
		}
		// Vertical multiply.
		for jrow := jtop; jrow < max(ktop, incol); jrow += nv {
			jlen := min(nv, max(ktop, incol)-jrow)
			bi.Dgemm(blas.NoTrans, blas.NoTrans, jlen, nu, nu,
				1, h[jrow*ldh+incol+k1+1:], ldh,
				u[k1*ldu+k1:], ldu,
				0, wv, ldwv)
			impl.Dlacpy(blas.All, jlen, nu, wv, ldwv, h[jrow*ldh+incol+k1+1:], ldh)
		}
		// Z multiply (also vertical).
		if wantz {
			for jrow := iloz; jrow <= ihiz; jrow += nv {
				jlen := min(nv, ihiz-jrow+1)
				bi.Dgemm(blas.NoTrans, blas.NoTrans, jlen, nu, nu,
					1, z[jrow*ldz+incol+k1+1:], ldz,
					u[k1*ldu+k1:], ldu,
					0, wv, ldwv)
				impl.Dlacpy(blas.All, jlen, nu, wv, ldwv, z[jrow*ldz+incol+k1+1:], ldz)
			}
		}
	}
}
