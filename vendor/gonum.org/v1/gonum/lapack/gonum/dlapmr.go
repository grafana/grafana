// Copyright ©2022 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package gonum

import "gonum.org/v1/gonum/blas/blas64"

// Dlapmr rearranges the rows of the m×n matrix X as specified by the permutation
// k[0],k[1],...,k[m-1] of the integers 0,...,m-1.
//
// If forward is true, a forward permutation is applied:
//
//	X[k[i],0:n] is moved to X[i,0:n] for i=0,1,...,m-1.
//
// If forward is false, a backward permutation is applied:
//
//	X[i,0:n] is moved to X[k[i],0:n] for i=0,1,...,m-1.
//
// k must have length m, otherwise Dlapmr will panic.
func (impl Implementation) Dlapmr(forward bool, m, n int, x []float64, ldx int, k []int) {
	switch {
	case m < 0:
		panic(mLT0)
	case n < 0:
		panic(nLT0)
	case ldx < max(1, n):
		panic(badLdX)
	}

	// Quick return if possible.
	if m == 0 || n == 0 {
		return
	}

	switch {
	case len(x) < (m-1)*ldx+n:
		panic(shortX)
	case len(k) != m:
		panic(badLenK)
	}

	// Quick return if possible.
	if m == 1 {
		return
	}

	bi := blas64.Implementation()

	for i, ki := range k {
		k[i] = -(ki + 1)
	}
	if forward {
		for i, ki := range k {
			if ki >= 0 {
				continue
			}
			j := i
			k[j] = -k[j] - 1
			in := k[j]
			for {
				if k[in] >= 0 {
					break
				}
				bi.Dswap(n, x[j*ldx:], 1, x[in*ldx:], 1)
				k[in] = -k[in] - 1
				j = in
				in = k[in]
			}
		}
	} else {
		for i, ki := range k {
			if ki >= 0 {
				continue
			}
			k[i] = -ki - 1
			j := k[i]
			for {
				if j == i {
					break
				}
				bi.Dswap(n, x[i*ldx:], 1, x[j*ldx:], 1)
				k[j] = -k[j] - 1
				j = k[j]
			}
		}
	}
}
