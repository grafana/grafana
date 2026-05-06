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
	"database/sql/driver"
	"math"
	"math/big"
	"strconv"
	"strings"

	"github.com/pkg/errors"
)

// Decimal is an arbitrary-precision decimal. Its value is:
//
//     Negative × Coeff × 10**Exponent
//
// Coeff must be positive. If it is negative results may be incorrect and
// apd may panic.
type Decimal struct {
	Form     Form
	Negative bool
	Exponent int32
	Coeff    big.Int
}

// Form specifies the form of a Decimal.
type Form int

const (
	// These constants must be in the following order. CmpTotal assumes that
	// the order of these constants reflects the total order on decimals.

	// Finite is the finite form.
	Finite Form = iota
	// Infinite is the infinite form.
	Infinite
	// NaNSignaling is the signaling NaN form. It will always raise the
	// InvalidOperation condition during an operation.
	NaNSignaling
	// NaN is the NaN form.
	NaN
)

var (
	decimalNaN      = &Decimal{Form: NaN}
	decimalInfinity = &Decimal{Form: Infinite}
)

//go:generate stringer -type=Form

const (
	// TODO(mjibson): MaxExponent is set because both upscale and Round
	// perform a calculation of 10^x, where x is an exponent. This is done by
	// big.Int.Exp. This restriction could be lifted if better algorithms were
	// determined during upscale and Round that don't need to perform Exp.

	// MaxExponent is the highest exponent supported. Exponents near this range will
	// perform very slowly (many seconds per operation).
	MaxExponent = 100000
	// MinExponent is the lowest exponent supported with the same limitations as
	// MaxExponent.
	MinExponent = -MaxExponent
)

// New creates a new decimal with the given coefficient and exponent.
func New(coeff int64, exponent int32) *Decimal {
	d := &Decimal{
		Negative: coeff < 0,
		Coeff:    *big.NewInt(coeff),
		Exponent: exponent,
	}
	d.Coeff.Abs(&d.Coeff)
	return d
}

// NewWithBigInt creates a new decimal with the given coefficient and exponent.
func NewWithBigInt(coeff *big.Int, exponent int32) *Decimal {
	d := &Decimal{
		Exponent: exponent,
	}
	d.Coeff.Set(coeff)
	if d.Coeff.Sign() < 0 {
		d.Negative = true
		d.Coeff.Abs(&d.Coeff)
	}
	return d
}

func consumePrefix(s, prefix string) (string, bool) {
	if strings.HasPrefix(s, prefix) {
		return s[len(prefix):], true
	}
	return s, false
}

func (d *Decimal) setString(c *Context, s string) (Condition, error) {
	orig := s
	s, d.Negative = consumePrefix(s, "-")
	if !d.Negative {
		s, _ = consumePrefix(s, "+")
	}
	s = strings.ToLower(s)
	d.Exponent = 0
	d.Coeff.SetInt64(0)
	// Until there are no parse errors, leave as NaN.
	d.Form = NaN
	if strings.HasPrefix(s, "-") || strings.HasPrefix(s, "+") {
		return 0, errors.Errorf("could not parse: %s", orig)
	}
	switch s {
	case "infinity", "inf":
		d.Form = Infinite
		return 0, nil
	}
	isNaN := false
	s, consumed := consumePrefix(s, "nan")
	if consumed {
		isNaN = true
	}
	s, consumed = consumePrefix(s, "snan")
	if consumed {
		isNaN = true
		d.Form = NaNSignaling
	}
	if isNaN {
		if s != "" {
			// We ignore these digits, but must verify them.
			_, err := strconv.ParseUint(s, 10, 64)
			if err != nil {
				return 0, errors.Wrapf(err, "parse payload: %s", s)
			}
		}
		return 0, nil
	}

	var exps []int64
	if i := strings.IndexByte(s, 'e'); i >= 0 {
		exp, err := strconv.ParseInt(s[i+1:], 10, 32)
		if err != nil {
			return 0, errors.Wrapf(err, "parse exponent: %s", s[i+1:])
		}
		exps = append(exps, exp)
		s = s[:i]
	}
	if i := strings.IndexByte(s, '.'); i >= 0 {
		exp := int64(len(s) - i - 1)
		exps = append(exps, -exp)
		s = s[:i] + s[i+1:]
	}
	if _, ok := d.Coeff.SetString(s, 10); !ok {
		return 0, errors.Errorf("parse mantissa: %s", s)
	}
	// No parse errors, can now flag as finite.
	d.Form = Finite
	return c.goError(d.setExponent(c, 0, exps...))
}

// NewFromString creates a new decimal from s. It has no restrictions on
// exponents or precision.
func NewFromString(s string) (*Decimal, Condition, error) {
	return BaseContext.NewFromString(s)
}

// SetString sets d to s and returns d. It has no restrictions on exponents
// or precision.
func (d *Decimal) SetString(s string) (*Decimal, Condition, error) {
	return BaseContext.SetString(d, s)
}

// NewFromString creates a new decimal from s. The returned Decimal has its
// exponents restricted by the context and its value rounded if it contains more
// digits than the context's precision.
func (c *Context) NewFromString(s string) (*Decimal, Condition, error) {
	d := new(Decimal)
	return c.SetString(d, s)
}

// SetString sets d to s and returns d. The returned Decimal has its exponents
// restricted by the context and its value rounded if it contains more digits
// than the context's precision.
func (c *Context) SetString(d *Decimal, s string) (*Decimal, Condition, error) {
	res, err := d.setString(c, s)
	if err != nil {
		return nil, 0, err
	}
	res |= c.round(d, d)
	_, err = c.goError(res)
	return d, res, err
}

func (d *Decimal) strSpecials() (bool, string) {
	switch d.Form {
	case NaN:
		return true, "NaN"
	case NaNSignaling:
		return true, "sNaN"
	case Infinite:
		return true, "Infinity"
	case Finite:
		return false, ""
	default:
		return true, "unknown"
	}
}

// Set sets d's fields to the values of x and returns d.
func (d *Decimal) Set(x *Decimal) *Decimal {
	if d == x {
		return d
	}
	d.Negative = x.Negative
	d.Coeff.Set(&x.Coeff)
	d.Exponent = x.Exponent
	d.Form = x.Form
	return d
}

// SetInt64 sets d to x and returns d.
func (d *Decimal) SetInt64(x int64) *Decimal {
	return d.SetFinite(x, 0)
}

// SetFinite sets d to x with exponent e and returns d.
func (d *Decimal) SetFinite(x int64, e int32) *Decimal {
	d.setCoefficient(x)
	d.Exponent = e
	return d
}

// setCoefficient sets d's coefficient and negative value to x and its Form
// to Finite The exponent is not changed. Since the exponent is not changed
// (and this is thus easy to misuse), this is unexported for internal use only.
func (d *Decimal) setCoefficient(x int64) {
	d.Negative = x < 0
	d.Coeff.SetInt64(x)
	d.Coeff.Abs(&d.Coeff)
	d.Form = Finite
}

// SetFloat64 sets d's Coefficient and Exponent to x and returns d. d will
// hold the exact value of f.
func (d *Decimal) SetFloat64(f float64) (*Decimal, error) {
	_, _, err := d.SetString(strconv.FormatFloat(f, 'E', -1, 64))
	return d, err
}

// Int64 returns the int64 representation of x. If x cannot be represented in an int64, an error is returned.
func (d *Decimal) Int64() (int64, error) {
	if d.Form != Finite {
		return 0, errors.Errorf("%s is not finite", d)
	}
	integ, frac := new(Decimal), new(Decimal)
	d.Modf(integ, frac)
	if !frac.IsZero() {
		return 0, errors.Errorf("%s: has fractional part", d)
	}
	var ed ErrDecimal
	if integ.Cmp(New(math.MaxInt64, 0)) > 0 {
		return 0, errors.Errorf("%s: greater than max int64", d)
	}
	if integ.Cmp(New(math.MinInt64, 0)) < 0 {
		return 0, errors.Errorf("%s: less than min int64", d)
	}
	if err := ed.Err(); err != nil {
		return 0, err
	}
	v := integ.Coeff.Int64()
	for i := int32(0); i < integ.Exponent; i++ {
		v *= 10
	}
	if d.Negative {
		v = -v
	}
	return v, nil
}

// Float64 returns the float64 representation of x. This conversion may lose
// data (see strconv.ParseFloat for caveats).
func (d *Decimal) Float64() (float64, error) {
	return strconv.ParseFloat(d.String(), 64)
}

const (
	errExponentOutOfRangeStr = "exponent out of range"
)

// setExponent sets d's Exponent to the sum of xs. Each value and the sum
// of xs must fit within an int32. An error occurs if the sum is outside of
// the MaxExponent or MinExponent range. res is any Condition previously set
// for this operation, which can cause Underflow to be set if, for example,
// Inexact is already set.
func (d *Decimal) setExponent(c *Context, res Condition, xs ...int64) Condition {
	var sum int64
	for _, x := range xs {
		if x > MaxExponent {
			return SystemOverflow | Overflow
		}
		if x < MinExponent {
			return SystemUnderflow | Underflow
		}
		sum += x
	}
	r := int32(sum)

	nd := d.NumDigits()
	// adj is the adjusted exponent: exponent + clength - 1
	adj := sum + nd - 1
	// Make sure it is less than the system limits.
	if adj > MaxExponent {
		return SystemOverflow | Overflow
	}
	if adj < MinExponent {
		return SystemUnderflow | Underflow
	}
	v := int32(adj)

	// d is subnormal.
	if v < c.MinExponent {
		if !d.IsZero() {
			res |= Subnormal
		}
		Etiny := c.MinExponent - (int32(c.Precision) - 1)
		// Only need to round if exponent < Etiny.
		if r < Etiny {
			// We need to take off (r - Etiny) digits. Split up d.Coeff into integer and
			// fractional parts and do operations similar Round. We avoid calling Round
			// directly because it calls setExponent and modifies the result's exponent
			// and coeff in ways that would be wrong here.
			b := new(big.Int).Set(&d.Coeff)
			tmp := &Decimal{
				Coeff:    *b,
				Exponent: r - Etiny,
			}
			integ, frac := new(Decimal), new(Decimal)
			tmp.Modf(integ, frac)
			frac.Abs(frac)
			if !frac.IsZero() {
				res |= Inexact
				if c.rounding()(&integ.Coeff, integ.Negative, frac.Cmp(decimalHalf)) {
					integ.Coeff.Add(&integ.Coeff, bigOne)
				}
			}
			if integ.IsZero() {
				res |= Clamped
			}
			r = Etiny
			d.Coeff = integ.Coeff
			res |= Rounded
		}
	} else if v > c.MaxExponent {
		if d.IsZero() {
			res |= Clamped
			r = c.MaxExponent
		} else {
			res |= Overflow | Inexact
			d.Form = Infinite
		}
	}

	if res.Inexact() && res.Subnormal() {
		res |= Underflow
	}

	d.Exponent = r
	return res
}

// upscale converts a and b to big.Ints with the same scaling. It returns
// them with this scaling, along with the scaling. An error can be produced
// if the resulting scale factor is out of range.
func upscale(a, b *Decimal) (*big.Int, *big.Int, int32, error) {
	if a.Exponent == b.Exponent {
		return &a.Coeff, &b.Coeff, a.Exponent, nil
	}
	swapped := false
	if a.Exponent < b.Exponent {
		swapped = true
		b, a = a, b
	}
	s := int64(a.Exponent) - int64(b.Exponent)
	// TODO(mjibson): figure out a better way to upscale numbers with highly
	// differing exponents.
	if s > MaxExponent {
		return nil, nil, 0, errors.New(errExponentOutOfRangeStr)
	}
	x := new(big.Int)
	e := tableExp10(s, x)
	x.Mul(&a.Coeff, e)
	y := &b.Coeff
	if swapped {
		x, y = y, x
	}
	return x, y, b.Exponent, nil
}

// setBig sets b to d's coefficient with negative.
func (d *Decimal) setBig(b *big.Int) *big.Int {
	b.Set(&d.Coeff)
	if d.Negative {
		b.Neg(b)
	}
	return b
}

// CmpTotal compares d and x using their abstract representation rather
// than their numerical value. A total ordering is defined for all possible
// abstract representations, as described below. If the first operand is
// lower in the total order than the second operand then the result is -1,
// if the operands have the same abstract representation then the result is
// 0, and if the first operand is higher in the total order than the second
// operand then the result is 1.
//
// Numbers (representations which are not NaNs) are ordered such that a
// larger numerical value is higher in the ordering. If two representations
// have the same numerical value then the exponent is taken into account;
// larger (more positive) exponents are higher in the ordering.
//
// For example, the following values are ordered from lowest to highest. Note
// the difference in ordering between 1.2300 and 1.23.
//
//   -NaN
//   -NaNSignaling
//   -Infinity
//   -127
//   -1.00
//   -1
//   -0.000
//   -0
//   0
//   1.2300
//   1.23
//   1E+9
//   Infinity
//   NaNSignaling
//   NaN
//
func (d *Decimal) CmpTotal(x *Decimal) int {
	do := d.cmpOrder()
	xo := x.cmpOrder()

	if do < xo {
		return -1
	}
	if do > xo {
		return 1
	}

	switch d.Form {
	case Finite:
		// d and x have the same sign and form, compare their value.
		if c := d.Cmp(x); c != 0 {
			return c
		}

		lt := -1
		gt := 1
		if d.Negative {
			lt = 1
			gt = -1
		}

		// Values are equal, compare exponents.
		if d.Exponent < x.Exponent {
			return lt
		}
		if d.Exponent > x.Exponent {
			return gt
		}
		return 0

	case Infinite:
		return 0

	default:
		return d.Coeff.Cmp(&x.Coeff)
	}
}

func (d *Decimal) cmpOrder() int {
	v := int(d.Form) + 1
	if d.Negative {
		v = -v
	}
	return v
}

// Cmp compares x and y and sets d to:
//
//   -1 if x <  y
//    0 if x == y
//   +1 if x >  y
//
// This comparison respects the normal rules of special values (like NaN),
// and does not compare them.
func (c *Context) Cmp(d, x, y *Decimal) (Condition, error) {
	if set, res, err := c.setIfNaN(d, x, y); set {
		return res, err
	}
	v := x.Cmp(y)
	d.SetInt64(int64(v))
	return 0, nil
}

// Cmp compares d and x and returns:
//
//   -1 if d <  x
//    0 if d == x
//   +1 if d >  x
//   undefined if d or x are NaN
//
func (d *Decimal) Cmp(x *Decimal) int {
	ds := d.Sign()
	xs := x.Sign()

	// First compare signs.
	if ds < xs {
		return -1
	} else if ds > xs {
		return 1
	} else if ds == 0 && xs == 0 {
		return 0
	}

	// Use gt and lt here with flipped signs if d is negative. gt and lt then
	// allow for simpler comparisons since we can ignore the sign of the decimals
	// and only worry about the form and value.
	gt := 1
	lt := -1
	if ds == -1 {
		gt = -1
		lt = 1
	}

	if d.Form == Infinite {
		if x.Form == Infinite {
			return 0
		}
		return gt
	} else if x.Form == Infinite {
		return lt
	}

	if d.Exponent == x.Exponent {
		cmp := d.Coeff.Cmp(&x.Coeff)
		if ds < 0 {
			cmp = -cmp
		}
		return cmp
	}

	// Next compare adjusted exponents.
	dn := d.NumDigits() + int64(d.Exponent)
	xn := x.NumDigits() + int64(x.Exponent)
	if dn < xn {
		return lt
	} else if dn > xn {
		return gt
	}

	// Now have to use aligned big.Ints. This function previously used upscale to
	// align in all cases, but that requires an error in the return value. upscale
	// does that so that it can fail if it needs to take the Exp of too-large a
	// number, which is very slow. The only way for that to happen here is for d
	// and x's coefficients to be of hugely differing values. That is practically
	// more difficult, so we are assuming the user is already comfortable with
	// slowness in those operations.

	var cmp int
	if d.Exponent < x.Exponent {
		var xScaled big.Int
		xScaled.Set(&x.Coeff)
		xScaled.Mul(&xScaled, tableExp10(int64(x.Exponent)-int64(d.Exponent), nil))
		cmp = d.Coeff.Cmp(&xScaled)
	} else {
		var dScaled big.Int
		dScaled.Set(&d.Coeff)
		dScaled.Mul(&dScaled, tableExp10(int64(d.Exponent)-int64(x.Exponent), nil))
		cmp = dScaled.Cmp(&x.Coeff)
	}
	if ds < 0 {
		cmp = -cmp
	}
	return cmp
}

// Sign returns, if d is Finite:
//
//	-1 if d <  0
//	 0 if d == 0 or -0
//	+1 if d >  0
//
// Otherwise (if d is Infinite or NaN):
//
//	-1 if d.Negative == true
//	+1 if d.Negative == false
//
func (d *Decimal) Sign() int {
	if d.Form == Finite && d.Coeff.Sign() == 0 {
		return 0
	}
	if d.Negative {
		return -1
	}
	return 1
}

// IsZero returns true if d == 0 or -0.
func (d *Decimal) IsZero() bool {
	return d.Sign() == 0
}

// Modf sets integ to the integral part of d and frac to the fractional part
// such that d = integ+frac. If d is negative, both integ or frac will be either
// 0 or negative. integ.Exponent will be >= 0; frac.Exponent will be <= 0.
// Either argument can be nil, preventing it from being set.
func (d *Decimal) Modf(integ, frac *Decimal) {
	if integ == nil && frac == nil {
		return
	}

	neg := d.Negative

	// No fractional part.
	if d.Exponent > 0 {
		if frac != nil {
			frac.Negative = neg
			frac.Exponent = 0
			frac.Coeff.SetInt64(0)
		}
		if integ != nil {
			integ.Set(d)
		}
		return
	}
	nd := d.NumDigits()
	exp := -int64(d.Exponent)
	// d < 0 because exponent is larger than number of digits.
	if exp > nd {
		if integ != nil {
			integ.Negative = neg
			integ.Exponent = 0
			integ.Coeff.SetInt64(0)
		}
		if frac != nil {
			frac.Set(d)
		}
		return
	}

	e := tableExp10(exp, nil)

	var icoeff *big.Int
	if integ != nil {
		icoeff = &integ.Coeff
		integ.Exponent = 0
		integ.Negative = neg
	} else {
		// This is the integ == nil branch, and we already checked if both integ and
		// frac were nil above, so frac can never be nil in this branch.
		icoeff = new(big.Int)
	}

	if frac != nil {
		icoeff.QuoRem(&d.Coeff, e, &frac.Coeff)
		frac.Exponent = d.Exponent
		frac.Negative = neg
	} else {
		// This is the frac == nil, which means integ must not be nil since they both
		// can't be due to the check above.
		icoeff.Quo(&d.Coeff, e)
	}
}

// Neg sets d to -x and returns d.
func (d *Decimal) Neg(x *Decimal) *Decimal {
	d.Set(x)
	if d.IsZero() {
		d.Negative = false
	} else {
		d.Negative = !d.Negative
	}
	return d
}

// Abs sets d to |x| and returns d.
func (d *Decimal) Abs(x *Decimal) *Decimal {
	d.Set(x)
	d.Negative = false
	return d
}

// Reduce sets d to x with all trailing zeros removed and returns d and the
// number of zeros removed.
func (d *Decimal) Reduce(x *Decimal) (*Decimal, int) {
	if x.Form != Finite {
		d.Set(x)
		return d, 0
	}
	var nd int
	neg := false
	switch x.Sign() {
	case 0:
		nd = int(d.NumDigits())
		d.SetInt64(0)
		return d, nd - 1
	case -1:
		neg = true
	}
	d.Set(x)

	// Use a uint64 for the division if possible.
	if d.Coeff.BitLen() <= 64 {
		i := d.Coeff.Uint64()
		for i >= 10000 && i%10000 == 0 {
			i /= 10000
			nd += 4
		}
		for i%10 == 0 {
			i /= 10
			nd++
		}
		if nd != 0 {
			d.Exponent += int32(nd)
			d.Coeff.SetUint64(i)
			d.Negative = neg
		}
		return d, nd
	}

	// Divide by 10 in a loop. In benchmarks of reduce0.decTest, this is 20%
	// faster than converting to a string and trimming the 0s from the end.
	z := d.setBig(new(big.Int))
	r := new(big.Int)
	for {
		z.QuoRem(&d.Coeff, bigTen, r)
		if r.Sign() == 0 {
			d.Coeff.Set(z)
			nd++
		} else {
			break
		}
	}
	d.Exponent += int32(nd)
	return d, nd
}

// Value implements the database/sql/driver.Valuer interface. It converts d to a
// string.
func (d Decimal) Value() (driver.Value, error) {
	return d.String(), nil
}

// Scan implements the database/sql.Scanner interface. It supports string,
// []byte, int64, float64.
func (d *Decimal) Scan(src interface{}) error {
	switch src := src.(type) {
	case []byte:
		_, _, err := d.SetString(string(src))
		return err
	case string:
		_, _, err := d.SetString(src)
		return err
	case int64:
		d.SetInt64(src)
		return nil
	case float64:
		_, err := d.SetFloat64(src)
		return err
	default:
		return errors.Errorf("could not convert %T to Decimal", src)
	}
}

// UnmarshalText implements the encoding.TextUnmarshaler interface.
func (d *Decimal) UnmarshalText(b []byte) error {
	_, _, err := d.SetString(string(b))
	return err
}

// MarshalText implements the encoding.TextMarshaler interface.
func (d *Decimal) MarshalText() ([]byte, error) {
	if d == nil {
		return []byte("<nil>"), nil
	}
	return []byte(d.String()), nil
}

// NullDecimal represents a string that may be null. NullDecimal implements
// the database/sql.Scanner interface so it can be used as a scan destination:
//
//  var d NullDecimal
//  err := db.QueryRow("SELECT num FROM foo WHERE id=?", id).Scan(&d)
//  ...
//  if d.Valid {
//     // use d.Decimal
//  } else {
//     // NULL value
//  }
//
type NullDecimal struct {
	Decimal Decimal
	Valid   bool // Valid is true if Decimal is not NULL
}

// Scan implements the database/sql.Scanner interface.
func (nd *NullDecimal) Scan(value interface{}) error {
	if value == nil {
		nd.Valid = false
		return nil
	}
	nd.Valid = true
	return nd.Decimal.Scan(value)
}

// Value implements the database/sql/driver.Valuer interface.
func (nd NullDecimal) Value() (driver.Value, error) {
	if !nd.Valid {
		return nil, nil
	}
	return nd.Decimal.Value()
}
