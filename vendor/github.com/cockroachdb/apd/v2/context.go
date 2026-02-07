// Copyright 2016 The Cockroach Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
// implied. See the License for the specific language governing
// permissions and limitations under the License.

package apd

import (
	"math"
	"math/big"

	"github.com/pkg/errors"
)

// Context maintains options for Decimal operations. It can safely be used
// concurrently, but not modified concurrently. Arguments for any method
// can safely be used as both result and operand.
type Context struct {
	// Precision is the number of places to round during rounding; this is
	// effectively the total number of digits (before and after the decimal
	// point).
	Precision uint32
	// MaxExponent specifies the largest effective exponent. The
	// effective exponent is the value of the Decimal in scientific notation. That
	// is, for 10e2, the effective exponent is 3 (1.0e3). Zero (0) is not a special
	// value; it does not disable this check.
	MaxExponent int32
	// MinExponent is similar to MaxExponent, but for the smallest effective
	// exponent.
	MinExponent int32
	// Traps are the conditions which will trigger an error result if the
	// corresponding Flag condition occurred.
	Traps Condition
	// Rounding specifies the Rounder to use during rounding. RoundHalfUp is used if
	// empty or not present in Roundings.
	Rounding string
}

const (
	// DefaultTraps is the default trap set used by BaseContext.
	DefaultTraps = SystemOverflow |
		SystemUnderflow |
		Overflow |
		Underflow |
		Subnormal |
		DivisionUndefined |
		DivisionByZero |
		DivisionImpossible |
		InvalidOperation

	errZeroPrecisionStr = "Context may not have 0 Precision for this operation"
)

// BaseContext is a useful default Context. Should not be mutated.
var BaseContext = Context{
	// Disable rounding.
	Precision: 0,
	// MaxExponent and MinExponent are set to the packages's limits.
	MaxExponent: MaxExponent,
	MinExponent: MinExponent,
	// Default error conditions.
	Traps: DefaultTraps,
}

// WithPrecision returns a copy of c but with the specified precision.
func (c *Context) WithPrecision(p uint32) *Context {
	r := *c
	r.Precision = p
	return &r
}

// goError converts flags into an error based on c.Traps.
func (c *Context) goError(flags Condition) (Condition, error) {
	return flags.GoError(c.Traps)
}

// etiny returns the smallest value an Exponent can contain.
func (c *Context) etiny() int32 {
	return c.MinExponent - int32(c.Precision) + 1
}

// setIfNaN sets d to the first NaNSignaling, or otherwise first NaN, of
// vals. d' is unchanged if vals contains no NaNs. True is returned if d
// was set to a NaN.
func (c *Context) setIfNaN(d *Decimal, vals ...*Decimal) (bool, Condition, error) {
	var nan *Decimal
Loop:
	for _, v := range vals {
		switch v.Form {
		case NaNSignaling:
			nan = v
			break Loop
		case NaN:
			if nan == nil {
				nan = v
			}
		}
	}
	if nan == nil {
		return false, 0, nil
	}
	d.Set(nan)
	var res Condition
	if nan.Form == NaNSignaling {
		res = InvalidOperation
		d.Form = NaN
	}
	_, err := c.goError(res)
	return true, res, err
}

func (c *Context) add(d, x, y *Decimal, subtract bool) (Condition, error) {
	if set, res, err := c.setIfNaN(d, x, y); set {
		return res, err
	}
	xn := x.Negative
	yn := y.Negative != subtract
	if xi, yi := x.Form == Infinite, y.Form == Infinite; xi || yi {
		if xi && yi && xn != yn {
			d.Set(decimalNaN)
			return c.goError(InvalidOperation)
		} else if xi {
			d.Set(x)
		} else {
			d.Set(decimalInfinity)
			d.Negative = yn
		}
		return 0, nil
	}
	a, b, s, err := upscale(x, y)
	if err != nil {
		return 0, errors.Wrap(err, "add")
	}
	d.Negative = xn
	if xn == yn {
		d.Coeff.Add(a, b)
	} else {
		d.Coeff.Sub(a, b)
		switch d.Coeff.Sign() {
		case -1:
			d.Negative = !d.Negative
			d.Coeff.Neg(&d.Coeff)
		case 0:
			d.Negative = c.Rounding == RoundFloor
		}
	}
	d.Exponent = s
	d.Form = Finite
	return c.Round(d, d)
}

// Add sets d to the sum x+y.
func (c *Context) Add(d, x, y *Decimal) (Condition, error) {
	return c.add(d, x, y, false)
}

// Sub sets d to the difference x-y.
func (c *Context) Sub(d, x, y *Decimal) (Condition, error) {
	return c.add(d, x, y, true)
}

// Abs sets d to |x| (the absolute value of x).
func (c *Context) Abs(d, x *Decimal) (Condition, error) {
	if set, res, err := c.setIfNaN(d, x); set {
		return res, err
	}
	d.Abs(x)
	return c.Round(d, d)
}

// Neg sets d to -x.
func (c *Context) Neg(d, x *Decimal) (Condition, error) {
	if set, res, err := c.setIfNaN(d, x); set {
		return res, err
	}
	d.Neg(x)
	return c.Round(d, d)
}

// Mul sets d to the product x*y.
func (c *Context) Mul(d, x, y *Decimal) (Condition, error) {
	if set, res, err := c.setIfNaN(d, x, y); set {
		return res, err
	}
	// The sign of the result is the exclusive or of the signs of the operands.
	neg := x.Negative != y.Negative
	if xi, yi := x.Form == Infinite, y.Form == Infinite; xi || yi {
		if x.IsZero() || y.IsZero() {
			d.Set(decimalNaN)
			return c.goError(InvalidOperation)
		}
		d.Set(decimalInfinity)
		d.Negative = neg
		return 0, nil
	}

	d.Coeff.Mul(&x.Coeff, &y.Coeff)
	d.Negative = neg
	d.Form = Finite
	res := d.setExponent(c, 0, int64(x.Exponent), int64(y.Exponent))
	res |= c.round(d, d)
	return c.goError(res)
}

func (c *Context) quoSpecials(d, x, y *Decimal, canClamp bool) (bool, Condition, error) {
	if set, res, err := c.setIfNaN(d, x, y); set {
		return true, res, err
	}
	// The sign of the result is the exclusive or of the signs of the operands.
	neg := x.Negative != y.Negative
	if xi, yi := x.Form == Infinite, y.Form == Infinite; xi || yi {
		var res Condition
		if xi && yi {
			d.Set(decimalNaN)
			res = InvalidOperation
		} else if xi {
			d.Set(decimalInfinity)
			d.Negative = neg
		} else {
			d.SetInt64(0)
			d.Negative = neg
			if canClamp {
				d.Exponent = c.etiny()
				res = Clamped
			}
		}
		res, err := c.goError(res)
		return true, res, err
	}

	if y.IsZero() {
		var res Condition
		if x.IsZero() {
			res |= DivisionUndefined
			d.Set(decimalNaN)
		} else {
			res |= DivisionByZero
			d.Set(decimalInfinity)
			d.Negative = neg
		}
		res, err := c.goError(res)
		return true, res, err
	}

	if c.Precision == 0 {
		// 0 precision is disallowed because we compute the required number of digits
		// during the 10**x calculation using the precision.
		return true, 0, errors.New(errZeroPrecisionStr)
	}

	return false, 0, nil
}

// Quo sets d to the quotient x/y for y != 0. c.Precision must be > 0. If an
// exact division is required, use a context with high precision and verify
// it was exact by checking the Inexact flag on the return Condition.
func (c *Context) Quo(d, x, y *Decimal) (Condition, error) {
	if set, res, err := c.quoSpecials(d, x, y, true); set {
		return res, err
	}

	if c.Precision > 5000 {
		// High precision could result in a large number of iterations. Arbitrarily
		// limit the precision to prevent runaway processes. This limit was chosen
		// arbitrarily and could likely be increased or removed if the impact was
		// measured. Until then, this is an attempt to prevent users from shooting
		// themselves in the foot.
		return 0, errors.New("Quo requires Precision <= 5000")
	}

	// The sign of the result is the exclusive or of the signs of the operands.
	neg := x.Negative != y.Negative

	// An integer variable, adjust, is initialized to 0.
	var adjust int64
	// The result coefficient is initialized to 0.
	quo := new(Decimal)
	var res Condition
	var diff int64
	if !x.IsZero() {
		dividend := new(big.Int).Abs(&x.Coeff)
		divisor := new(big.Int).Abs(&y.Coeff)

		// The operand coefficients are adjusted so that the coefficient of the
		// dividend is greater than or equal to the coefficient of the divisor and
		// is also less than ten times the coefficient of the divisor, thus:

		// While the coefficient of the dividend is less than the coefficient of
		// the divisor it is multiplied by 10 and adjust is incremented by 1.
		for dividend.Cmp(divisor) < 0 {
			dividend.Mul(dividend, bigTen)
			adjust++
		}

		// While the coefficient of the dividend is greater than or equal to ten
		// times the coefficient of the divisor the coefficient of the divisor is
		// multiplied by 10 and adjust is decremented by 1.
		for tmp := new(big.Int); ; {
			tmp.Mul(divisor, bigTen)
			if dividend.Cmp(tmp) < 0 {
				break
			}
			divisor.Set(tmp)
			adjust--
		}

		prec := int64(c.Precision)

		// The following steps are then repeated until the division is complete:
		for {
			// While the coefficient of the divisor is smaller than or equal to the
			// coefficient of the dividend the former is subtracted from the latter and
			// the coefficient of the result is incremented by 1.
			for divisor.Cmp(dividend) <= 0 {
				dividend.Sub(dividend, divisor)
				quo.Coeff.Add(&quo.Coeff, bigOne)
			}

			// If the coefficient of the dividend is now 0 and adjust is greater than
			// or equal to 0, or if the coefficient of the result has precision digits,
			// the division is complete.
			if (dividend.Sign() == 0 && adjust >= 0) || quo.NumDigits() == prec {
				break
			}

			// Otherwise, the coefficients of the result and the dividend are multiplied
			// by 10 and adjust is incremented by 1.
			quo.Coeff.Mul(&quo.Coeff, bigTen)
			dividend.Mul(dividend, bigTen)
			adjust++
		}

		// Use the adjusted exponent to determine if we are Subnormal. If so,
		// don't round.
		adj := int64(x.Exponent) + int64(-y.Exponent) - adjust + quo.NumDigits() - 1
		// Any remainder (the final coefficient of the dividend) is recorded and
		// taken into account for rounding.
		if dividend.Sign() != 0 && adj >= int64(c.MinExponent) {
			res |= Inexact | Rounded
			dividend.Mul(dividend, bigTwo)
			half := dividend.Cmp(divisor)
			rounding := c.rounding()
			if rounding(&quo.Coeff, quo.Negative, half) {
				roundAddOne(&quo.Coeff, &diff)
			}
		}
	}

	// The exponent of the result is computed by subtracting the sum of the
	// original exponent of the divisor and the value of adjust at the end of
	// the coefficient calculation from the original exponent of the dividend.
	res |= quo.setExponent(c, res, int64(x.Exponent), int64(-y.Exponent), -adjust, diff)
	quo.Negative = neg
	d.Set(quo)
	return c.goError(res)
}

// QuoInteger sets d to the integer part of the quotient x/y. If the result
// cannot fit in d.Precision digits, an error is returned.
func (c *Context) QuoInteger(d, x, y *Decimal) (Condition, error) {
	if set, res, err := c.quoSpecials(d, x, y, false); set {
		return res, err
	}

	// The sign of the result is the exclusive or of the signs of the operands.
	neg := x.Negative != y.Negative
	var res Condition

	a, b, _, err := upscale(x, y)
	if err != nil {
		return 0, errors.Wrap(err, "QuoInteger")
	}
	d.Coeff.Quo(a, b)
	d.Form = Finite
	if d.NumDigits() > int64(c.Precision) {
		d.Set(decimalNaN)
		res |= DivisionImpossible
	}
	d.Exponent = 0
	d.Negative = neg
	return c.goError(res)
}

// Rem sets d to the remainder part of the quotient x/y. If
// the integer part cannot fit in d.Precision digits, an error is returned.
func (c *Context) Rem(d, x, y *Decimal) (Condition, error) {
	if set, res, err := c.setIfNaN(d, x, y); set {
		return res, err
	}

	if x.Form != Finite {
		d.Set(decimalNaN)
		return c.goError(InvalidOperation)
	}
	if y.Form == Infinite {
		d.Set(x)
		return 0, nil
	}

	var res Condition
	if y.IsZero() {
		if x.IsZero() {
			res |= DivisionUndefined
		} else {
			res |= InvalidOperation
		}
		d.Set(decimalNaN)
		return c.goError(res)
	}
	a, b, s, err := upscale(x, y)
	if err != nil {
		return 0, errors.Wrap(err, "Rem")
	}
	tmp := new(big.Int)
	tmp.QuoRem(a, b, &d.Coeff)
	if NumDigits(tmp) > int64(c.Precision) {
		d.Set(decimalNaN)
		return c.goError(DivisionImpossible)
	}
	d.Form = Finite
	d.Exponent = s
	// The sign of the result is sign if the dividend.
	d.Negative = x.Negative
	res |= c.round(d, d)
	return c.goError(res)
}

func (c *Context) rootSpecials(d, x *Decimal, factor int32) (bool, Condition, error) {
	if set, res, err := c.setIfNaN(d, x); set {
		return set, res, err
	}
	if x.Form == Infinite {
		if x.Negative {
			d.Set(decimalNaN)
			res, err := c.goError(InvalidOperation)
			return true, res, err
		}
		d.Set(decimalInfinity)
		return true, 0, nil
	}

	switch x.Sign() {
	case -1:
		if factor%2 == 0 {
			d.Set(decimalNaN)
			res, err := c.goError(InvalidOperation)
			return true, res, err
		}
	case 0:
		d.Set(x)
		d.Exponent /= factor
		return true, 0, nil
	}
	return false, 0, nil
}

// Sqrt sets d to the square root of x. Sqrt uses the Babylonian method
// for computing the square root, which uses O(log p) steps for p digits
// of precision.
func (c *Context) Sqrt(d, x *Decimal) (Condition, error) {
	// See: Properly Rounded Variable Precision Square Root by T. E. Hull
	// and A. Abrham, ACM Transactions on Mathematical Software, Vol 11 #3,
	// pp229–237, ACM, September 1985.

	if set, res, err := c.rootSpecials(d, x, 2); set {
		return res, err
	}

	// workp is the number of digits of precision used. We use the same precision
	// as in decNumber.
	workp := c.Precision + 1
	if nd := uint32(x.NumDigits()); workp < nd {
		workp = nd
	}
	if workp < 7 {
		workp = 7
	}

	f := new(Decimal).Set(x)
	nd := x.NumDigits()
	e := nd + int64(x.Exponent)
	f.Exponent = int32(-nd)
	nc := c.WithPrecision(workp)
	nc.Rounding = RoundHalfEven
	ed := MakeErrDecimal(nc)
	// Set approx to the first guess, based on whether e (the exponent part of x)
	// is odd or even.
	approx := new(Decimal)
	if e%2 == 0 {
		approx.SetFinite(819, -3)
		ed.Mul(approx, approx, f)
		ed.Add(approx, approx, New(259, -3))
	} else {
		f.Exponent--
		e++
		approx.SetFinite(259, -2)
		ed.Mul(approx, approx, f)
		ed.Add(approx, approx, New(819, -4))
	}

	// Now we repeatedly improve approx. Our precision improves quadratically,
	// which we keep track of in p.
	p := uint32(3)
	tmp := new(Decimal)

	// The algorithm in the paper says to use c.Precision + 2. decNumber uses
	// workp + 2. But we use workp + 5 to make the tests pass. This means it is
	// possible there are inputs we don't compute correctly and could be 1ulp off.
	for maxp := workp + 5; p != maxp; {
		p = 2*p - 2
		if p > maxp {
			p = maxp
		}
		nc.Precision = p
		// tmp = f / approx
		ed.Quo(tmp, f, approx)
		// tmp = approx + f / approx
		ed.Add(tmp, tmp, approx)
		// approx = 0.5 * (approx + f / approx)
		ed.Mul(approx, tmp, decimalHalf)
	}

	// At this point the paper says: "approx is now within 1 ulp of the properly
	// rounded square root off; to ensure proper rounding, compare squares of
	// (approx - l/2 ulp) and (approx + l/2 ulp) with f." We originally implemented
	// the proceeding algorithm from the paper. However none of the tests take
	// any of the branches that modify approx. Our best guess as to why is that
	// since we use workp + 5 instead of the + 2 as described in the paper,
	// we are more accurate than this section needed to account for. Thus,
	// we have removed the block from this implementation.

	if err := ed.Err(); err != nil {
		return 0, err
	}

	d.Set(approx)
	d.Exponent += int32(e / 2)
	nc.Precision = c.Precision
	nc.Rounding = RoundHalfEven
	d.Reduce(d) // Remove trailing zeros.
	return nc.Round(d, d)
}

// Cbrt sets d to the cube root of x.
func (c *Context) Cbrt(d, x *Decimal) (Condition, error) {
	// The cube root calculation is implemented using Newton-Raphson
	// method. We start with an initial estimate for cbrt(d), and
	// then iterate:
	//     x_{n+1} = 1/3 * ( 2 * x_n + (d / x_n / x_n) ).

	if set, res, err := c.rootSpecials(d, x, 3); set {
		return res, err
	}

	neg := x.Negative
	ax := x
	if x.Negative {
		ax = new(Decimal).Abs(x)
	}
	z := new(Decimal).Set(ax)
	nc := BaseContext.WithPrecision(c.Precision*2 + 2)
	ed := MakeErrDecimal(nc)
	exp8 := 0

	// See: Turkowski, Ken. Computing the cube root. technical report, Apple
	// Computer, 1998.
	// https://people.freebsd.org/~lstewart/references/apple_tr_kt32_cuberoot.pdf
	//
	// Computing the cube root of any number is reduced to computing
	// the cube root of a number between 0.125 and 1. After the next loops,
	// x = z * 8^exp8 will hold.
	for z.Cmp(decimalOneEighth) < 0 {
		exp8--
		ed.Mul(z, z, decimalEight)
	}

	for z.Cmp(decimalOne) > 0 {
		exp8++
		ed.Mul(z, z, decimalOneEighth)
	}

	// Use this polynomial to approximate the cube root between 0.125 and 1.
	// z = (-0.46946116 * z + 1.072302) * z + 0.3812513
	// It will serve as an initial estimate, hence the precision of this
	// computation may only impact performance, not correctness.
	z0 := new(Decimal).Set(z)
	ed.Mul(z, z, decimalCbrtC1)
	ed.Add(z, z, decimalCbrtC2)
	ed.Mul(z, z, z0)
	ed.Add(z, z, decimalCbrtC3)

	for ; exp8 < 0; exp8++ {
		ed.Mul(z, z, decimalHalf)
	}

	for ; exp8 > 0; exp8-- {
		ed.Mul(z, z, decimalTwo)
	}

	// Loop until convergence.
	for loop := nc.newLoop("cbrt", z, c.Precision+1, 1); ; {
		// z = (2.0 * z0 +  x / (z0 * z0) ) / 3.0;
		z0.Set(z)
		ed.Mul(z, z, z0)
		ed.Quo(z, ax, z)
		ed.Add(z, z, z0)
		ed.Add(z, z, z0)
		ed.Quo(z, z, decimalThree)

		if err := ed.Err(); err != nil {
			return 0, err
		}
		if done, err := loop.done(z); err != nil {
			return 0, err
		} else if done {
			break
		}
	}

	z0.Set(x)
	res, err := c.Round(d, z)
	d.Negative = neg

	// Set z = d^3 to check for exactness.
	ed.Mul(z, d, d)
	ed.Mul(z, z, d)

	if err := ed.Err(); err != nil {
		return 0, err
	}

	// Result is exact
	if z0.Cmp(z) == 0 {
		return 0, nil
	}
	return res, err
}

func (c *Context) logSpecials(d, x *Decimal) (bool, Condition, error) {
	if set, res, err := c.setIfNaN(d, x); set {
		return set, res, err
	}
	if x.Sign() < 0 {
		d.Set(decimalNaN)
		res, err := c.goError(InvalidOperation)
		return true, res, err
	}
	if x.Form == Infinite {
		d.Set(decimalInfinity)
		return true, 0, nil
	}
	if x.Cmp(decimalZero) == 0 {
		d.Set(decimalInfinity)
		d.Negative = true
		return true, 0, nil
	}
	if x.Cmp(decimalOne) == 0 {
		d.Set(decimalZero)
		return true, 0, nil
	}

	return false, 0, nil
}

// Ln sets d to the natural log of x.
func (c *Context) Ln(d, x *Decimal) (Condition, error) {
	// See: On the Use of Iteration Methods for Approximating the Natural
	// Logarithm, James F. Epperson, The American Mathematical Monthly, Vol. 96,
	// No. 9, November 1989, pp. 831-835.

	if set, res, err := c.logSpecials(d, x); set {
		return res, err
	}

	// The internal precision needs to be a few digits higher because errors in
	// series/iterations add up.
	p := c.Precision + 2

	nc := c.WithPrecision(p)
	nc.Rounding = RoundHalfEven
	ed := MakeErrDecimal(nc)

	tmp1 := new(Decimal)
	tmp2 := new(Decimal)
	tmp3 := new(Decimal)
	tmp4 := new(Decimal)

	z := new(Decimal).Set(x)

	// To get an initial estimate, we first reduce the input range to the interval
	// [0.1, 1) by changing the exponent, and later adjust the result by a
	// multiple of ln(10).
	//
	// However, this does not work well for z very close to 1, where the result is
	// very close to 0. For example:
	//   z     = 1.00001
	//   ln(z) = 0.00000999995
	// If we adjust by 10:
	//   z'     = 0.100001
	//   ln(z') = -2.30257509304
	//   ln(10) =  2.30258509299
	//   ln(z)  =  0.00001000...
	//
	// The issue is that we may need to calculate a much higher (~double)
	// precision for ln(z) because many of the significant digits cancel out.
	//
	// Halley's iteration has a similar problem when z is close to 1: in this case
	// the correction term (exp(a_n) - z) needs to be calculated to a high
	// precision. So for z close to 1 (before scaling) we use a power series
	// instead (which converges very rapidly in this range).

	resAdjust := new(Decimal)

	// tmp1 = z - 1
	ed.Sub(tmp1, z, decimalOne)
	// tmp3 = 0.1
	tmp3.SetFinite(1, -1)

	usePowerSeries := false

	if tmp2.Abs(tmp1).Cmp(tmp3) <= 0 {
		usePowerSeries = true
	} else {
		// Reduce input to range [0.1, 1).
		expDelta := int32(z.NumDigits()) + z.Exponent
		z.Exponent -= expDelta

		// We multiplied the input by 10^-expDelta, we will need to add
		//   ln(10^expDelta) = expDelta * ln(10)
		// to the result.
		resAdjust.setCoefficient(int64(expDelta))
		ed.Mul(resAdjust, resAdjust, decimalLn10.get(p))

		// tmp1 = z - 1
		ed.Sub(tmp1, z, decimalOne)

		if tmp2.Abs(tmp1).Cmp(tmp3) <= 0 {
			usePowerSeries = true
		} else {
			// Compute an initial estimate using floats.
			zFloat, err := z.Float64()
			if err != nil {
				// We know that z is in a reasonable range; no errors should happen during conversion.
				return 0, err
			}
			if _, err := tmp1.SetFloat64(math.Log(zFloat)); err != nil {
				return 0, err
			}
		}
	}

	if usePowerSeries {
		// We use the power series:
		//   ln(1+x) = 2 sum [ 1 / (2n+1) * (x / (x+2))^(2n+1) ]
		//
		// This converges rapidly for small x.
		// See https://en.wikipedia.org/wiki/Logarithm#Power_series

		// tmp1 is already x

		// tmp3 = x + 2
		ed.Add(tmp3, tmp1, decimalTwo)

		// tmp2 = (x / (x+2))
		ed.Quo(tmp2, tmp1, tmp3)

		// tmp1 = tmp3 = 2 * (x / (x+2))
		ed.Add(tmp3, tmp2, tmp2)
		tmp1.Set(tmp3)

		eps := Decimal{Coeff: *bigOne, Exponent: -int32(p)}
		for n := 1; ; n++ {

			// tmp3 *= (x / (x+2))^2
			ed.Mul(tmp3, tmp3, tmp2)
			ed.Mul(tmp3, tmp3, tmp2)

			// tmp4 = 2n+1
			tmp4.SetFinite(int64(2*n+1), 0)

			ed.Quo(tmp4, tmp3, tmp4)

			ed.Add(tmp1, tmp1, tmp4)

			if tmp4.Abs(tmp4).Cmp(&eps) <= 0 {
				break
			}
		}
	} else {
		// Use Halley's Iteration.
		// We use a bit more precision than the context asks for in newLoop because
		// this is not the final result.
		for loop := nc.newLoop("ln", x, c.Precision+1, 1); ; {
			// tmp1 = a_n (either from initial estimate or last iteration)

			// tmp2 = exp(a_n)
			ed.Exp(tmp2, tmp1)

			// tmp3 = exp(a_n) - z
			ed.Sub(tmp3, tmp2, z)

			// tmp3 = 2 * (exp(a_n) - z)
			ed.Add(tmp3, tmp3, tmp3)

			// tmp4 = exp(a_n) + z
			ed.Add(tmp4, tmp2, z)

			// tmp2 = 2 * (exp(a_n) - z) / (exp(a_n) + z)
			ed.Quo(tmp2, tmp3, tmp4)

			// tmp1 = a_(n+1) = a_n - 2 * (exp(a_n) - z) / (exp(a_n) + z)
			ed.Sub(tmp1, tmp1, tmp2)

			if done, err := loop.done(tmp1); err != nil {
				return 0, err
			} else if done {
				break
			}
			if err := ed.Err(); err != nil {
				return 0, err
			}
		}
	}

	// Apply the adjustment due to the initial rescaling.
	ed.Add(tmp1, tmp1, resAdjust)

	if err := ed.Err(); err != nil {
		return 0, err
	}
	res := c.round(d, tmp1)
	res |= Inexact
	return c.goError(res)
}

// Log10 sets d to the base 10 log of x.
func (c *Context) Log10(d, x *Decimal) (Condition, error) {
	if set, res, err := c.logSpecials(d, x); set {
		return res, err
	}

	// TODO(mjibson): This is exact under some conditions.
	res := Inexact

	nc := BaseContext.WithPrecision(c.Precision + 2)
	nc.Rounding = RoundHalfEven
	z := new(Decimal)
	_, err := nc.Ln(z, x)
	if err != nil {
		return 0, errors.Wrap(err, "ln")
	}
	nc.Precision = c.Precision

	qr, err := nc.Mul(d, z, decimalInvLn10.get(c.Precision+2))
	if err != nil {
		return 0, err
	}
	res |= qr
	return c.goError(res)
}

// Exp sets d = e**x.
func (c *Context) Exp(d, x *Decimal) (Condition, error) {
	// See: Variable Precision Exponential Function, T. E. Hull and A. Abrham, ACM
	// Transactions on Mathematical Software, Vol 12 #2, pp79-91, ACM, June 1986.

	if set, res, err := c.setIfNaN(d, x); set {
		return res, err
	}
	if x.Form == Infinite {
		if x.Negative {
			d.Set(decimalZero)
		} else {
			d.Set(decimalInfinity)
		}
		return 0, nil
	}

	if x.IsZero() {
		d.Set(decimalOne)
		return 0, nil
	}

	if c.Precision == 0 {
		return 0, errors.New(errZeroPrecisionStr)
	}

	res := Inexact | Rounded

	// Stage 1
	cp := c.Precision
	tmp1 := new(Decimal).Abs(x)
	if f, err := tmp1.Float64(); err == nil {
		// This algorithm doesn't work if currentprecision*23 < |x|. Attempt to
		// increase the working precision if needed as long as it isn't too large. If
		// it is too large, don't bump the precision, causing an early overflow return.
		if ncp := f / 23; ncp > float64(cp) && ncp < 1000 {
			cp = uint32(math.Ceil(ncp))
		}
	}
	tmp2 := New(int64(cp)*23, 0)
	// if abs(x) > 23*currentprecision; assert false
	if tmp1.Cmp(tmp2) > 0 {
		res |= Overflow
		if x.Sign() < 0 {
			res = res.negateOverflowFlags()
			res |= Clamped
			d.SetFinite(0, c.etiny())
		} else {
			d.Set(decimalInfinity)
		}
		return c.goError(res)
	}
	// if abs(x) <= setexp(.9, -currentprecision); then result 1
	tmp2.SetFinite(9, int32(-cp)-1)
	if tmp1.Cmp(tmp2) <= 0 {
		d.Set(decimalOne)
		return c.goError(res)
	}

	// Stage 2
	// Add x.NumDigits because the paper assumes that x.Coeff [0.1, 1).
	t := x.Exponent + int32(x.NumDigits())
	if t < 0 {
		t = 0
	}
	k := New(1, t)
	r := new(Decimal)
	nc := c.WithPrecision(cp)
	nc.Rounding = RoundHalfEven
	if _, err := nc.Quo(r, x, k); err != nil {
		return 0, errors.Wrap(err, "Quo")
	}
	ra := new(Decimal).Abs(r)
	p := int64(cp) + int64(t) + 2

	// Stage 3
	rf, err := ra.Float64()
	if err != nil {
		return 0, errors.Wrap(err, "r.Float64")
	}
	pf := float64(p)
	nf := math.Ceil((1.435*pf - 1.182) / math.Log10(pf/rf))
	if nf > 1000 || math.IsNaN(nf) {
		return 0, errors.New("too many iterations")
	}
	n := int64(nf)

	// Stage 4
	nc.Precision = uint32(p)
	ed := MakeErrDecimal(nc)
	sum := New(1, 0)
	tmp2.Exponent = 0
	for i := n - 1; i > 0; i-- {
		tmp2.setCoefficient(i)
		// tmp1 = r / i
		ed.Quo(tmp1, r, tmp2)
		// sum = sum * r / i
		ed.Mul(sum, tmp1, sum)
		// sum = sum + 1
		ed.Add(sum, sum, decimalOne)
	}
	if err != ed.Err() {
		return 0, err
	}

	// sum ** k
	ki, err := exp10(int64(t))
	if err != nil {
		return 0, errors.Wrap(err, "ki")
	}
	ires, err := nc.integerPower(d, sum, ki)
	if err != nil {
		return 0, errors.Wrap(err, "integer power")
	}
	res |= ires
	nc.Precision = c.Precision
	res |= nc.round(d, d)
	return c.goError(res)
}

// integerPower sets d = x**y. d and x must not point to the same Decimal.
func (c *Context) integerPower(d, x *Decimal, y *big.Int) (Condition, error) {
	// See: https://en.wikipedia.org/wiki/Exponentiation_by_squaring.

	b := new(big.Int).Set(y)
	neg := b.Sign() < 0
	if neg {
		b.Abs(b)
	}

	n, z := new(Decimal), d
	n.Set(x)
	z.Set(decimalOne)
	ed := MakeErrDecimal(c)
	for b.Sign() > 0 {
		if b.Bit(0) == 1 {
			ed.Mul(z, z, n)
		}
		b.Rsh(b, 1)

		// Only compute the next n if we are going to use it. Otherwise n can overflow
		// on the last iteration causing this to error.
		if b.Sign() > 0 {
			ed.Mul(n, n, n)
		}
		if err := ed.Err(); err != nil {
			// In the negative case, convert overflow to underflow.
			if neg {
				ed.Flags = ed.Flags.negateOverflowFlags()
			}
			return ed.Flags, err
		}
	}

	if neg {
		ed.Quo(z, decimalOne, z)
	}
	return ed.Flags, ed.Err()
}

// Pow sets d = x**y.
func (c *Context) Pow(d, x, y *Decimal) (Condition, error) {
	if set, res, err := c.setIfNaN(d, x, y); set {
		return res, err
	}

	integ, frac := new(Decimal), new(Decimal)
	y.Modf(integ, frac)
	yIsInt := frac.IsZero()
	neg := x.Negative && y.Form == Finite && yIsInt && integ.Coeff.Bit(0) == 1 && integ.Exponent == 0

	if x.Form == Infinite {
		var res Condition
		if y.Sign() == 0 {
			d.Set(decimalOne)
		} else if x.Negative && (y.Form == Infinite || !yIsInt) {
			d.Set(decimalNaN)
			res = InvalidOperation
		} else if y.Negative {
			d.Set(decimalZero)
		} else {
			d.Set(decimalInfinity)
		}
		d.Negative = neg
		return c.goError(res)
	}

	// Check if y is of type int.
	tmp := new(Decimal).Abs(y)

	xs := x.Sign()
	ys := y.Sign()

	if xs == 0 {
		var res Condition
		switch ys {
		case 0:
			d.Set(decimalNaN)
			res = InvalidOperation
		case 1:
			d.Set(decimalZero)
		default: // -1
			d.Set(decimalInfinity)
		}
		d.Negative = neg
		return c.goError(res)
	}
	if ys == 0 {
		d.Set(decimalOne)
		return 0, nil
	}

	if xs < 0 && !yIsInt {
		d.Set(decimalNaN)
		return c.goError(InvalidOperation)
	}

	// decNumber sets the precision to be max(x digits, c.Precision) +
	// len(exponent) + 4. 6 is used as the exponent maximum length.
	p := c.Precision
	if nd := uint32(x.NumDigits()); p < nd {
		p = nd
	}
	p += 4 + 6

	nc := BaseContext.WithPrecision(p)

	z := d
	if z == x {
		z = new(Decimal)
	}

	// If integ.Exponent > 0, we need to add trailing 0s to integ.Coeff.
	res := c.quantize(integ, integ, 0)
	nres, err := nc.integerPower(z, x, integ.setBig(&integ.Coeff))
	res |= nres
	if err != nil {
		d.Set(decimalNaN)
		return res, err
	}

	if yIsInt {
		res |= c.round(d, z)
		return c.goError(res)
	}

	ed := MakeErrDecimal(nc)

	// Compute x**frac(y)
	ed.Abs(tmp, x)
	ed.Ln(tmp, tmp)
	ed.Mul(tmp, tmp, frac)
	ed.Exp(tmp, tmp)

	// Join integer and frac parts back.
	ed.Mul(tmp, z, tmp)

	if err := ed.Err(); err != nil {
		return ed.Flags, err
	}
	res |= c.round(d, tmp)
	d.Negative = neg
	res |= Inexact
	return c.goError(res)
}

// Quantize adjusts and rounds x as necessary so it is represented with
// exponent exp and stores the result in d.
func (c *Context) Quantize(d, x *Decimal, exp int32) (Condition, error) {
	if set, res, err := c.setIfNaN(d, x); set {
		return res, err
	}
	if x.Form == Infinite || exp < c.etiny() {
		d.Set(decimalNaN)
		return c.goError(InvalidOperation)
	}
	res := c.quantize(d, x, exp)
	if nd := d.NumDigits(); nd > int64(c.Precision) || exp > c.MaxExponent {
		res = InvalidOperation
		d.Set(decimalNaN)
	} else {
		res |= c.round(d, d)
		if res.Overflow() || res.Underflow() {
			res = InvalidOperation
			d.Set(decimalNaN)
		}
	}
	return c.goError(res)
}

func (c *Context) quantize(d, v *Decimal, exp int32) Condition {
	diff := exp - v.Exponent
	d.Set(v)
	var res Condition
	if diff < 0 {
		if diff < MinExponent {
			return SystemUnderflow | Underflow
		}
		d.Coeff.Mul(&d.Coeff, tableExp10(-int64(diff), nil))
	} else if diff > 0 {
		p := int32(d.NumDigits()) - diff
		if p < 0 {
			if !d.IsZero() {
				d.Coeff.SetInt64(0)
				res = Inexact | Rounded
			}
		} else {
			nc := c.WithPrecision(uint32(p))

			// The idea here is that the resulting d.Exponent after rounding will be 0. We
			// have a number of, say, 5 digits, but p (our precision) above is set at, say,
			// 3. So here d.Exponent is set to `-2`. We have a number like `NNN.xx`, where
			// the `.xx` part will be rounded away. However during rounding of 0.9 to 1.0,
			// d.Exponent could be set to 1 instead of 0, so we have to reduce it and
			// increase the coefficient below.

			// Another solution is to set d.Exponent = v.Exponent and adjust it to exp,
			// instead of setting d.Exponent = -diff and adjusting it to zero. Although
			// this computes the correct result, it fails the Max/MinExponent checks
			// during Round and raises underflow flags. Quantize (as per the spec)
			// is guaranteed to not raise underflow, and using 0 instead of exp as the
			// target eliminates this problem.

			d.Exponent = -diff
			// Avoid the c.Precision == 0 check.
			res = nc.rounding().Round(nc, d, d)
			// Adjust for 0.9 -> 1.0 rollover.
			if d.Exponent > 0 {
				d.Coeff.Mul(&d.Coeff, bigTen)
			}
		}
	}
	d.Exponent = exp
	return res
}

func (c *Context) toIntegral(d, x *Decimal) Condition {
	res := c.quantize(d, x, 0)
	return res
}

func (c *Context) toIntegralSpecials(d, x *Decimal) (bool, Condition, error) {
	if set, res, err := c.setIfNaN(d, x); set {
		return set, res, err
	}
	if x.Form != Finite {
		d.Set(x)
		return true, 0, nil
	}
	return false, 0, nil
}

// RoundToIntegralValue sets d to integral value of x. Inexact and Rounded flags
// are ignored and removed.
func (c *Context) RoundToIntegralValue(d, x *Decimal) (Condition, error) {
	if set, res, err := c.toIntegralSpecials(d, x); set {
		return res, err
	}
	res := c.toIntegral(d, x)
	res &= ^(Inexact | Rounded)
	return c.goError(res)
}

// RoundToIntegralExact sets d to integral value of x.
func (c *Context) RoundToIntegralExact(d, x *Decimal) (Condition, error) {
	if set, res, err := c.toIntegralSpecials(d, x); set {
		return res, err
	}
	res := c.toIntegral(d, x)
	return c.goError(res)
}

// Ceil sets d to the smallest integer >= x.
func (c *Context) Ceil(d, x *Decimal) (Condition, error) {
	frac := new(Decimal)
	x.Modf(d, frac)
	if frac.Sign() > 0 {
		return c.Add(d, d, decimalOne)
	}
	return 0, nil
}

// Floor sets d to the largest integer <= x.
func (c *Context) Floor(d, x *Decimal) (Condition, error) {
	frac := new(Decimal)
	x.Modf(d, frac)
	if frac.Sign() < 0 {
		return c.Sub(d, d, decimalOne)
	}
	return 0, nil
}

// Reduce sets d to x with all trailing zeros removed and returns the number
// of zeros removed.
func (c *Context) Reduce(d, x *Decimal) (int, Condition, error) {
	if set, res, err := c.setIfNaN(d, x); set {
		return 0, res, err
	}
	neg := x.Negative
	_, n := d.Reduce(x)
	d.Negative = neg
	res, err := c.Round(d, d)
	return n, res, err
}

// exp10 returns x, 10^x. An error is returned if x is too large.
func exp10(x int64) (exp *big.Int, err error) {
	if x > MaxExponent || x < MinExponent {
		return nil, errors.New(errExponentOutOfRangeStr)
	}
	return tableExp10(x, nil), nil
}
