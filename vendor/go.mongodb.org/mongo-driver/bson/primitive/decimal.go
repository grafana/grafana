// Copyright (C) MongoDB, Inc. 2017-present.
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
//
// Based on gopkg.in/mgo.v2/bson by Gustavo Niemeyer
// See THIRD-PARTY-NOTICES for original license terms.

package primitive

import (
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"regexp"
	"strconv"
	"strings"
)

// These constants are the maximum and minimum values for the exponent field in a decimal128 value.
const (
	MaxDecimal128Exp = 6111
	MinDecimal128Exp = -6176
)

// These errors are returned when an invalid value is parsed as a big.Int.
var (
	ErrParseNaN    = errors.New("cannot parse NaN as a *big.Int")
	ErrParseInf    = errors.New("cannot parse Infinity as a *big.Int")
	ErrParseNegInf = errors.New("cannot parse -Infinity as a *big.Int")
)

// Decimal128 holds decimal128 BSON values.
type Decimal128 struct {
	h, l uint64
}

// NewDecimal128 creates a Decimal128 using the provide high and low uint64s.
func NewDecimal128(h, l uint64) Decimal128 {
	return Decimal128{h: h, l: l}
}

// GetBytes returns the underlying bytes of the BSON decimal value as two uint64 values. The first
// contains the most first 8 bytes of the value and the second contains the latter.
func (d Decimal128) GetBytes() (uint64, uint64) {
	return d.h, d.l
}

// String returns a string representation of the decimal value.
func (d Decimal128) String() string {
	var posSign int      // positive sign
	var exp int          // exponent
	var high, low uint64 // significand high/low

	if d.h>>63&1 == 0 {
		posSign = 1
	}

	switch d.h >> 58 & (1<<5 - 1) {
	case 0x1F:
		return "NaN"
	case 0x1E:
		return "-Infinity"[posSign:]
	}

	low = d.l
	if d.h>>61&3 == 3 {
		// Bits: 1*sign 2*ignored 14*exponent 111*significand.
		// Implicit 0b100 prefix in significand.
		exp = int(d.h >> 47 & (1<<14 - 1))
		// Spec says all of these values are out of range.
		high, low = 0, 0
	} else {
		// Bits: 1*sign 14*exponent 113*significand
		exp = int(d.h >> 49 & (1<<14 - 1))
		high = d.h & (1<<49 - 1)
	}
	exp += MinDecimal128Exp

	// Would be handled by the logic below, but that's trivial and common.
	if high == 0 && low == 0 && exp == 0 {
		return "-0"[posSign:]
	}

	var repr [48]byte // Loop 5 times over 9 digits plus dot, negative sign, and leading zero.
	var last = len(repr)
	var i = len(repr)
	var dot = len(repr) + exp
	var rem uint32
Loop:
	for d9 := 0; d9 < 5; d9++ {
		high, low, rem = divmod(high, low, 1e9)
		for d1 := 0; d1 < 9; d1++ {
			// Handle "-0.0", "0.00123400", "-1.00E-6", "1.050E+3", etc.
			if i < len(repr) && (dot == i || low == 0 && high == 0 && rem > 0 && rem < 10 && (dot < i-6 || exp > 0)) {
				exp += len(repr) - i
				i--
				repr[i] = '.'
				last = i - 1
				dot = len(repr) // Unmark.
			}
			c := '0' + byte(rem%10)
			rem /= 10
			i--
			repr[i] = c
			// Handle "0E+3", "1E+3", etc.
			if low == 0 && high == 0 && rem == 0 && i == len(repr)-1 && (dot < i-5 || exp > 0) {
				last = i
				break Loop
			}
			if c != '0' {
				last = i
			}
			// Break early. Works without it, but why.
			if dot > i && low == 0 && high == 0 && rem == 0 {
				break Loop
			}
		}
	}
	repr[last-1] = '-'
	last--

	if exp > 0 {
		return string(repr[last+posSign:]) + "E+" + strconv.Itoa(exp)
	}
	if exp < 0 {
		return string(repr[last+posSign:]) + "E" + strconv.Itoa(exp)
	}
	return string(repr[last+posSign:])
}

// BigInt returns significand as big.Int and exponent, bi * 10 ^ exp.
func (d Decimal128) BigInt() (*big.Int, int, error) {
	high, low := d.GetBytes()
	posSign := high>>63&1 == 0 // positive sign

	switch high >> 58 & (1<<5 - 1) {
	case 0x1F:
		return nil, 0, ErrParseNaN
	case 0x1E:
		if posSign {
			return nil, 0, ErrParseInf
		}
		return nil, 0, ErrParseNegInf
	}

	var exp int
	if high>>61&3 == 3 {
		// Bits: 1*sign 2*ignored 14*exponent 111*significand.
		// Implicit 0b100 prefix in significand.
		exp = int(high >> 47 & (1<<14 - 1))
		// Spec says all of these values are out of range.
		high, low = 0, 0
	} else {
		// Bits: 1*sign 14*exponent 113*significand
		exp = int(high >> 49 & (1<<14 - 1))
		high &= (1<<49 - 1)
	}
	exp += MinDecimal128Exp

	// Would be handled by the logic below, but that's trivial and common.
	if high == 0 && low == 0 && exp == 0 {
		return new(big.Int), 0, nil
	}

	bi := big.NewInt(0)
	const host32bit = ^uint(0)>>32 == 0
	if host32bit {
		bi.SetBits([]big.Word{big.Word(low), big.Word(low >> 32), big.Word(high), big.Word(high >> 32)})
	} else {
		bi.SetBits([]big.Word{big.Word(low), big.Word(high)})
	}

	if !posSign {
		return bi.Neg(bi), exp, nil
	}
	return bi, exp, nil
}

// IsNaN returns whether d is NaN.
func (d Decimal128) IsNaN() bool {
	return d.h>>58&(1<<5-1) == 0x1F
}

// IsInf returns:
//
//	+1 d == Infinity
//	 0 other case
//	-1 d == -Infinity
func (d Decimal128) IsInf() int {
	if d.h>>58&(1<<5-1) != 0x1E {
		return 0
	}

	if d.h>>63&1 == 0 {
		return 1
	}
	return -1
}

// IsZero returns true if d is the empty Decimal128.
func (d Decimal128) IsZero() bool {
	return d.h == 0 && d.l == 0
}

// MarshalJSON returns Decimal128 as a string.
func (d Decimal128) MarshalJSON() ([]byte, error) {
	return json.Marshal(d.String())
}

// UnmarshalJSON creates a primitive.Decimal128 from a JSON string, an extended JSON $numberDecimal value, or the string
// "null". If b is a JSON string or extended JSON value, d will have the value of that string, and if b is "null", d will
// be unchanged.
func (d *Decimal128) UnmarshalJSON(b []byte) error {
	// Ignore "null" to keep parity with the standard library. Decoding a JSON null into a non-pointer Decimal128 field
	// will leave the field unchanged. For pointer values, encoding/json will set the pointer to nil and will not
	// enter the UnmarshalJSON hook.
	if string(b) == "null" {
		return nil
	}

	var res interface{}
	err := json.Unmarshal(b, &res)
	if err != nil {
		return err
	}
	str, ok := res.(string)

	// Extended JSON
	if !ok {
		m, ok := res.(map[string]interface{})
		if !ok {
			return errors.New("not an extended JSON Decimal128: expected document")
		}
		d128, ok := m["$numberDecimal"]
		if !ok {
			return errors.New("not an extended JSON Decimal128: expected key $numberDecimal")
		}
		str, ok = d128.(string)
		if !ok {
			return errors.New("not an extended JSON Decimal128: expected decimal to be string")
		}
	}

	*d, err = ParseDecimal128(str)
	return err
}

func divmod(h, l uint64, div uint32) (qh, ql uint64, rem uint32) {
	div64 := uint64(div)
	a := h >> 32
	aq := a / div64
	ar := a % div64
	b := ar<<32 + h&(1<<32-1)
	bq := b / div64
	br := b % div64
	c := br<<32 + l>>32
	cq := c / div64
	cr := c % div64
	d := cr<<32 + l&(1<<32-1)
	dq := d / div64
	dr := d % div64
	return (aq<<32 | bq), (cq<<32 | dq), uint32(dr)
}

var dNaN = Decimal128{0x1F << 58, 0}
var dPosInf = Decimal128{0x1E << 58, 0}
var dNegInf = Decimal128{0x3E << 58, 0}

func dErr(s string) (Decimal128, error) {
	return dNaN, fmt.Errorf("cannot parse %q as a decimal128", s)
}

// match scientific notation number, example -10.15e-18
var normalNumber = regexp.MustCompile(`^(?P<int>[-+]?\d*)?(?:\.(?P<dec>\d*))?(?:[Ee](?P<exp>[-+]?\d+))?$`)

// ParseDecimal128 takes the given string and attempts to parse it into a valid
// Decimal128 value.
func ParseDecimal128(s string) (Decimal128, error) {
	if s == "" {
		return dErr(s)
	}

	matches := normalNumber.FindStringSubmatch(s)
	if len(matches) == 0 {
		orig := s
		neg := s[0] == '-'
		if neg || s[0] == '+' {
			s = s[1:]
		}

		if s == "NaN" || s == "nan" || strings.EqualFold(s, "nan") {
			return dNaN, nil
		}
		if s == "Inf" || s == "inf" || strings.EqualFold(s, "inf") || strings.EqualFold(s, "infinity") {
			if neg {
				return dNegInf, nil
			}
			return dPosInf, nil
		}
		return dErr(orig)
	}

	intPart := matches[1]
	decPart := matches[2]
	expPart := matches[3]

	var err error
	exp := 0
	if expPart != "" {
		exp, err = strconv.Atoi(expPart)
		if err != nil {
			return dErr(s)
		}
	}
	if decPart != "" {
		exp -= len(decPart)
	}

	if len(strings.Trim(intPart+decPart, "-0")) > 35 {
		return dErr(s)
	}

	// Parse the significand (i.e. the non-exponent part) as a big.Int.
	bi, ok := new(big.Int).SetString(intPart+decPart, 10)
	if !ok {
		return dErr(s)
	}

	d, ok := ParseDecimal128FromBigInt(bi, exp)
	if !ok {
		return dErr(s)
	}

	if bi.Sign() == 0 && s[0] == '-' {
		d.h |= 1 << 63
	}

	return d, nil
}

var (
	ten  = big.NewInt(10)
	zero = new(big.Int)

	maxS, _ = new(big.Int).SetString("9999999999999999999999999999999999", 10)
)

// ParseDecimal128FromBigInt attempts to parse the given significand and exponent into a valid Decimal128 value.
func ParseDecimal128FromBigInt(bi *big.Int, exp int) (Decimal128, bool) {
	// copy
	bi = new(big.Int).Set(bi)

	q := new(big.Int)
	r := new(big.Int)

	// If the significand is zero, the logical value will always be zero, independent of the
	// exponent. However, the loops for handling out-of-range exponent values below may be extremely
	// slow for zero values because the significand never changes. Limit the exponent value to the
	// supported range here to prevent entering the loops below.
	if bi.Cmp(zero) == 0 {
		if exp > MaxDecimal128Exp {
			exp = MaxDecimal128Exp
		}
		if exp < MinDecimal128Exp {
			exp = MinDecimal128Exp
		}
	}

	for bigIntCmpAbs(bi, maxS) == 1 {
		bi, _ = q.QuoRem(bi, ten, r)
		if r.Cmp(zero) != 0 {
			return Decimal128{}, false
		}
		exp++
		if exp > MaxDecimal128Exp {
			return Decimal128{}, false
		}
	}

	for exp < MinDecimal128Exp {
		// Subnormal.
		bi, _ = q.QuoRem(bi, ten, r)
		if r.Cmp(zero) != 0 {
			return Decimal128{}, false
		}
		exp++
	}
	for exp > MaxDecimal128Exp {
		// Clamped.
		bi.Mul(bi, ten)
		if bigIntCmpAbs(bi, maxS) == 1 {
			return Decimal128{}, false
		}
		exp--
	}

	b := bi.Bytes()
	var h, l uint64
	for i := 0; i < len(b); i++ {
		if i < len(b)-8 {
			h = h<<8 | uint64(b[i])
			continue
		}
		l = l<<8 | uint64(b[i])
	}

	h |= uint64(exp-MinDecimal128Exp) & uint64(1<<14-1) << 49
	if bi.Sign() == -1 {
		h |= 1 << 63
	}

	return Decimal128{h: h, l: l}, true
}

// bigIntCmpAbs computes big.Int.Cmp(absoluteValue(x), absoluteValue(y)).
func bigIntCmpAbs(x, y *big.Int) int {
	xAbs := bigIntAbsValue(x)
	yAbs := bigIntAbsValue(y)
	return xAbs.Cmp(yAbs)
}

// bigIntAbsValue returns a big.Int containing the absolute value of b.
// If b is already a non-negative number, it is returned without any changes or copies.
func bigIntAbsValue(b *big.Int) *big.Int {
	if b.Sign() >= 0 {
		return b // already positive
	}
	return new(big.Int).Abs(b)
}
