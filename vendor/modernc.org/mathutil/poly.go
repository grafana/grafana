// Copyright (c) 2016 The mathutil Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package mathutil // import "modernc.org/mathutil"

import (
	"fmt"
	"math/big"
)

func abs(n int) uint64 {
	if n >= 0 {
		return uint64(n)
	}

	return uint64(-n)
}

// QuadPolyDiscriminant returns the discriminant of a quadratic polynomial in
// one variable of the form a*x^2+b*x+c with integer coefficients a, b, c, or
// an error on overflow.
//
// ds is the square of the discriminant. If |ds| is a square number, d is set
// to sqrt(|ds|), otherwise d is < 0.
func QuadPolyDiscriminant(a, b, c int) (ds, d int, _ error) {
	if 2*BitLenUint64(abs(b)) > IntBits-1 ||
		2+BitLenUint64(abs(a))+BitLenUint64(abs(c)) > IntBits-1 {
		return 0, 0, fmt.Errorf("overflow")
	}

	ds = b*b - 4*a*c
	s := ds
	if s < 0 {
		s = -s
	}
	d64 := SqrtUint64(uint64(s))
	if d64*d64 != uint64(s) {
		return ds, -1, nil
	}

	return ds, int(d64), nil
}

// PolyFactor describes an irreducible factor of a polynomial in one variable
// with integer coefficients P, Q of the form P*x+Q.
type PolyFactor struct {
	P, Q int
}

// QuadPolyFactors returns the content and the irreducible factors of the
// primitive part of a quadratic polynomial in one variable with integer
// coefficients a, b, c of the form a*x^2+b*x+c in integers, or an error on
// overflow.
//
// If the factorization in integers does not exists, the return value is (0,
// nil, nil).
//
// See also:
// https://en.wikipedia.org/wiki/Factorization_of_polynomials#Primitive_part.E2.80.93content_factorization
func QuadPolyFactors(a, b, c int) (content int, primitivePart []PolyFactor, _ error) {
	content = int(GCDUint64(abs(a), GCDUint64(abs(b), abs(c))))
	switch {
	case content == 0:
		content = 1
	case content > 0:
		if a < 0 || a == 0 && b < 0 {
			content = -content
		}
	}
	a /= content
	b /= content
	c /= content
	if a == 0 {
		if b == 0 {
			return content, []PolyFactor{{0, c}}, nil
		}

		if b < 0 && c < 0 {
			b = -b
			c = -c
		}
		if b < 0 {
			b = -b
			c = -c
		}
		return content, []PolyFactor{{b, c}}, nil
	}

	ds, d, err := QuadPolyDiscriminant(a, b, c)
	if err != nil {
		return 0, nil, err
	}

	if ds < 0 || d < 0 {
		return 0, nil, nil
	}

	x1num := -b + d
	x1denom := 2 * a
	gcd := int(GCDUint64(abs(x1num), abs(x1denom)))
	x1num /= gcd
	x1denom /= gcd

	x2num := -b - d
	x2denom := 2 * a
	gcd = int(GCDUint64(abs(x2num), abs(x2denom)))
	x2num /= gcd
	x2denom /= gcd

	return content, []PolyFactor{{x1denom, -x1num}, {x2denom, -x2num}}, nil
}

// QuadPolyDiscriminantBig returns the discriminant of a quadratic polynomial
// in one variable of the form a*x^2+b*x+c with integer coefficients a, b, c.
//
// ds is the square of the discriminant. If |ds| is a square number, d is set
// to sqrt(|ds|), otherwise d is nil.
func QuadPolyDiscriminantBig(a, b, c *big.Int) (ds, d *big.Int) {
	ds = big.NewInt(0).Set(b)
	ds.Mul(ds, b)
	x := big.NewInt(4)
	x.Mul(x, a)
	x.Mul(x, c)
	ds.Sub(ds, x)

	s := big.NewInt(0).Set(ds)
	if s.Sign() < 0 {
		s.Neg(s)
	}

	if s.Bit(1) != 0 { // s is not a square number
		return ds, nil
	}

	d = SqrtBig(s)
	x.Set(d)
	x.Mul(x, x)
	if x.Cmp(s) != 0 { // s is not a square number
		d = nil
	}
	return ds, d
}

// PolyFactorBig describes an irreducible factor of a polynomial in one
// variable with integer coefficients P, Q of the form P*x+Q.
type PolyFactorBig struct {
	P, Q *big.Int
}

// QuadPolyFactorsBig returns the content and the irreducible factors of the
// primitive part of a quadratic polynomial in one variable with integer
// coefficients a, b, c of the form a*x^2+b*x+c in integers.
//
// If the factorization in integers does not exists, the return value is (nil,
// nil).
//
// See also:
// https://en.wikipedia.org/wiki/Factorization_of_polynomials#Primitive_part.E2.80.93content_factorization
func QuadPolyFactorsBig(a, b, c *big.Int) (content *big.Int, primitivePart []PolyFactorBig) {
	content = bigGCD(bigAbs(a), bigGCD(bigAbs(b), bigAbs(c)))
	switch {
	case content.Sign() == 0:
		content.SetInt64(1)
	case content.Sign() > 0:
		if a.Sign() < 0 || a.Sign() == 0 && b.Sign() < 0 {
			content = bigNeg(content)
		}
	}
	a = bigDiv(a, content)
	b = bigDiv(b, content)
	c = bigDiv(c, content)

	if a.Sign() == 0 {
		if b.Sign() == 0 {
			return content, []PolyFactorBig{{big.NewInt(0), c}}
		}

		if b.Sign() < 0 && c.Sign() < 0 {
			b = bigNeg(b)
			c = bigNeg(c)
		}
		if b.Sign() < 0 {
			b = bigNeg(b)
			c = bigNeg(c)
		}
		return content, []PolyFactorBig{{b, c}}
	}

	ds, d := QuadPolyDiscriminantBig(a, b, c)
	if ds.Sign() < 0 || d == nil {
		return nil, nil
	}

	x1num := bigAdd(bigNeg(b), d)
	x1denom := bigMul(_2, a)
	gcd := bigGCD(bigAbs(x1num), bigAbs(x1denom))
	x1num = bigDiv(x1num, gcd)
	x1denom = bigDiv(x1denom, gcd)

	x2num := bigAdd(bigNeg(b), bigNeg(d))
	x2denom := bigMul(_2, a)
	gcd = bigGCD(bigAbs(x2num), bigAbs(x2denom))
	x2num = bigDiv(x2num, gcd)
	x2denom = bigDiv(x2denom, gcd)

	return content, []PolyFactorBig{{x1denom, bigNeg(x1num)}, {x2denom, bigNeg(x2num)}}
}

func bigAbs(n *big.Int) *big.Int {
	n = big.NewInt(0).Set(n)
	if n.Sign() >= 0 {
		return n
	}

	return n.Neg(n)
}

func bigDiv(a, b *big.Int) *big.Int {
	a = big.NewInt(0).Set(a)
	return a.Div(a, b)
}

func bigGCD(a, b *big.Int) *big.Int {
	a = big.NewInt(0).Set(a)
	b = big.NewInt(0).Set(b)
	for b.Sign() != 0 {
		c := big.NewInt(0)
		c.Mod(a, b)
		a, b = b, c
	}
	return a
}

func bigNeg(n *big.Int) *big.Int {
	n = big.NewInt(0).Set(n)
	return n.Neg(n)
}

func bigMul(a, b *big.Int) *big.Int {
	r := big.NewInt(0).Set(a)
	return r.Mul(r, b)
}

func bigAdd(a, b *big.Int) *big.Int {
	r := big.NewInt(0).Set(a)
	return r.Add(r, b)
}
