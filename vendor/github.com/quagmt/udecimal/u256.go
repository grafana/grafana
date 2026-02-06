package udecimal

import (
	"math/bits"
)

// u256 represents a 256-bits unsigned integer
// u256 = carry * 2^128 + hi*2^64 + lo
// carry = u*2^64 + v
type u256 struct {
	hi, lo uint64

	// store overflow
	carry u128
}

func (u u256) bitLen() int {
	if u.carry.hi != 0 {
		return 192 + bits.Len64(u.carry.hi)
	}

	if u.carry.lo != 0 {
		return 128 + bits.Len64(u.carry.lo)
	}

	if u.hi != 0 {
		return 64 + bits.Len64(u.hi)
	}

	return bits.Len64(u.lo)
}

// for debugging
// func (u u256) PrintBit() {
// 	b1 := strconv.FormatUint(u.carry.hi, 2)
// 	b2 := strconv.FormatUint(u.carry.lo, 2)
// 	b3 := strconv.FormatUint(u.hi, 2)
// 	b4 := strconv.FormatUint(u.lo, 2)

// 	fmt.Printf("%s.%s.%s.%s\n", apz(b1), apz(b2), apz(b3), apz(b4))
// }

// func apz(s string) string {
// 	if len(s) == 64 {
// 		return s
// 	}

// 	l := len(s)

// 	for range 64 - l {
// 		s = "0" + s
// 	}

// 	return s
// }

// Compare u256 and U128, returns:
//
//	+1 when u > v
//	 0 when u = v
//	-1 when u < v
func (u u256) cmp128(v u128) int {
	if !u.carry.IsZero() {
		return 1
	}

	return u128FromHiLo(u.hi, u.lo).Cmp(v)
}

// pow returns u^e (with e > 0).
// Use int instead of uint to avoid unnecessary checks for type conversion.
//
// NOTE: Caller must ensure that e > 0 before calling this function.
func (u u256) pow(e int) (u256, error) {
	result := u256{lo: 1}
	d256 := u
	var err error

	for ; e > 0; e >>= 1 {
		if e&1 == 1 {
			if !result.carry.IsZero() {
				return u256{}, errOverflow
			}

			// result = result * u (with u = (d256)^(2^i))
			result, err = d256.mul128(u128{lo: result.lo, hi: result.hi})
			if err != nil {
				return u256{}, err
			}
		}

		// d256 = (d256)^2 each time
		d256, err = d256.mul128(u128{lo: d256.lo, hi: d256.hi})
		if err != nil {
			return u256{}, err
		}

		// if there's a carry, next iteration will overflow
		if !d256.carry.IsZero() && e > 1 {
			return u256{}, errOverflow
		}
	}

	return result, nil
}

func (u u256) mul128(v u128) (u256, error) {
	a := u128FromHiLo(u.hi, u.lo).MulToU256(v)
	b, err := u.carry.Mul(v)
	if err != nil {
		return u256{}, err
	}

	c, err := a.carry.Add(b)
	if err != nil {
		return u256{}, err
	}

	return u256{hi: a.hi, lo: a.lo, carry: c}, nil
}

// fastQuo returns quotient and remainder of u/v
func (u u256) fastQuo(v u128) (u128, u128, error) {
	if u.carry.IsZero() {
		q, r, err := u128FromHiLo(u.hi, u.lo).QuoRem(v)
		return q, r, err
	}

	if v.hi == 0 && u.carry.hi == 0 {
		q, r, err := u.div192by64(v.lo)
		return q, u128{lo: r}, err
	}

	// now we have u192 / u128 or u256 / u128
	if u.carry.Cmp(v) >= 0 {
		// obviously the result won't fit into u128
		return u128{}, u128{}, errOverflow
	}

	q, r := u.div256by128(v)
	return q, r, nil
}

// div192by64 return q,r which:
// q must be a u128
// u = q*v + r
// Returns error if u.carry >= v, because the result can't fit into u128
func (u u256) div192by64(v uint64) (u128, uint64, error) {
	if u.carry.Cmp64(v) >= 0 {
		return u128{}, 0, errOverflow
	}

	// can't panic because we already check u.carry < v (u.carry.hi == 0 && u.carry.lo < v)
	hi, rem := bits.Div64(u.carry.lo, u.hi, v)

	// can't panic because rem < v
	lo, r := bits.Div64(rem, u.lo, v)
	return u128FromHiLo(hi, lo), r, nil
}

// div256by128 performs u256 / u128, which u256.carry < u128
// Returns both quotient and remainder
// This implementation is based on divllu from https://github.com/ridiculousfish/libdivide
// The algorithm is explained in this blog post: https://ridiculousfish.com/blog/posts/labor-of-division-episode-iv.html
func (u u256) div256by128(v u128) (u128, u128) {
	// normalize v
	n := bits.LeadingZeros64(v.hi)

	//nolint:gosec // 0 <= n <= 63, so it's safe to convert to uint
	v = v.Lsh(uint(n))

	// shift u to the left by n bits (n < 64)
	a := [4]uint64{}
	a[0] = u.lo << n
	a[1] = u.lo>>(64-n) | u.hi<<n
	a[2] = u.hi>>(64-n) | u.carry.lo<<n
	a[3] = u.carry.lo>>(64-n) | u.carry.hi<<n

	// q = a / v
	aLen := 3
	if a[3] != 0 || (a[3] == 0 && a[2] > v.hi) {
		aLen = 4
	}

	q := [2]uint64{}

	for i := aLen - 3; i >= 0; i-- {
		u2, u1, u0 := a[i+2], a[i+1], a[i]

		// trial quotient tq = [u2,u1,u0] / v ~= [u2,u1] / v.hi
		// tq <= q + 2
		tq, r := bits.Div64(u2, u1, v.hi)

		c1h, c1l := bits.Mul64(tq, v.lo)
		c1 := u128{hi: c1h, lo: c1l}
		c2 := u128{hi: r, lo: u0}

		// adjust tq
		var k uint64
		if c1.Cmp(c2) > 0 {
			k = 1

			// d = c1 - c2
			if subUnsafe(c1, c2).Cmp(v) > 0 {
				k = 2
			}
		}

		q[i] = tq - k

		// true remainder rem = [u2,u1,u0] - q*v = c2 - c1 + k*v (k <= 2)
		var rem u128
		switch k {
		case 0:
			// rem = c2 - c1
			rem = subUnsafe(c2, c1)
		case 1:
			// rem = c2 - c1 + v = v - (c1 - c2) with c1 > c2
			rem = subUnsafe(c1, c2)
			rem = subUnsafe(v, rem)
		case 2:
			// rem = c2 - c1 + 2*v = v + v - (c1 - c2) with c1 > c2
			// v = max(u128) - not(v)
			// --> rem = v - not(v) + max(u128) - (c1 - c2)
			//  v >= not(v) because v is normalized. Hence, we can safely caculate rem without checking overflow
			c12 := subUnsafe(c1, c2)
			c12 = subUnsafe(max128, c12)
			rem = subUnsafe(v, u128{hi: ^v.hi, lo: ^v.lo})

			// this also can't overflow because rem < v <= max(u128)
			rem, _ = rem.Add(c12)
		}

		a[i+1], a[i] = rem.hi, rem.lo
	}

	//nolint:gosec // 0 <= n <= 63, so it's safe to convert to uint
	r := u128{hi: a[1], lo: a[0]}.Rsh(uint(n))

	return u128{hi: q[1], lo: q[0]}, r
}

// subUnsafe returns u - v with u >= v
// must be called only when u >= v or the result will be incorrect
func subUnsafe(u, v u128) u128 {
	lo, borrow := bits.Sub64(u.lo, v.lo, 0)
	hi, _ := bits.Sub64(u.hi, v.hi, borrow)
	return u128{hi: hi, lo: lo}
}
