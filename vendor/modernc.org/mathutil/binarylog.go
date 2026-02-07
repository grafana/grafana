// Copyright (c) 2016 The mathutil Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package mathutil // import "modernc.org/mathutil"

import (
	"math/big"
)

type float struct {
	n           *big.Int
	fracBits    int
	maxFracBits int
}

func newFloat(n *big.Int, fracBits, maxFracBits int) float {
	f := float{n: n, fracBits: fracBits, maxFracBits: maxFracBits}
	f.normalize()
	return f
}

func (f *float) normalize() {
	n := f.n.BitLen()
	if n == 0 {
		return
	}

	if n := f.fracBits - f.maxFracBits; n > 0 {
		bit := f.n.Bit(n - 1)
		f.n.Rsh(f.n, uint(n))
		if bit != 0 {
			f.n.Add(f.n, _1)
		}
		f.fracBits -= n
	}

	var i int
	for ; f.fracBits > 0 && i <= f.fracBits && f.n.Bit(i) == 0; i++ {
		f.fracBits--
	}

	if i != 0 {
		f.n.Rsh(f.n, uint(i))
	}
}

func (f *float) eq1() bool { return f.fracBits == 0 && f.n.BitLen() == 1 }
func (f *float) ge2() bool { return f.n.BitLen() > f.fracBits+1 }

func (f *float) div2() {
	f.fracBits++
	f.normalize()
}

// BinaryLog computes the binary logarithm of n. The result consists of a
// characteristic and a mantissa having precision mantissaBits. The value of
// the binary logarithm is
//
//	characteristic + mantissa*(2^-mantissaBits)
//
// BinaryLog panics for n <= 0 or mantissaBits < 0.
func BinaryLog(n *big.Int, mantissaBits int) (characteristic int, mantissa *big.Int) {
	if n.Sign() <= 0 || mantissaBits < 0 {
		panic("invalid argument of BinaryLog")
	}

	characteristic = n.BitLen() - 1
	mantissa = big.NewInt(0)
	x := newFloat(n, characteristic, mantissaBits)
	for ; mantissaBits != 0 && !x.eq1(); mantissaBits-- {
		x.sqr()
		mantissa.Lsh(mantissa, 1)
		if x.ge2() {
			mantissa.SetBit(mantissa, 0, 1)
			x.div2()
		}
	}
	return characteristic, mantissa
}
