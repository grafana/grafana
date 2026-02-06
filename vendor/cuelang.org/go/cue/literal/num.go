// Copyright 2020 CUE Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package literal

import (
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/token"
	"github.com/cockroachdb/apd/v2"
)

var baseContext apd.Context

func init() {
	baseContext = apd.BaseContext
	baseContext.Precision = 24
}

// NumInfo contains information about a parsed numbers.
//
// Reusing a NumInfo across parses may avoid memory allocations.
type NumInfo struct {
	pos token.Pos
	src string
	p   int
	ch  byte
	buf []byte

	mul     Multiplier
	base    byte
	neg     bool
	UseSep  bool
	isFloat bool
	err     error
}

// String returns a canonical string representation of the number so that
// it can be parsed with math.Float.Parse.
func (p *NumInfo) String() string {
	if len(p.buf) > 0 && p.base == 10 && p.mul == 0 {
		return string(p.buf)
	}
	var d apd.Decimal
	_ = p.decimal(&d)
	return d.String()
}

type decimal = apd.Decimal

// Decimal is for internal use.
func (p *NumInfo) Decimal(v *decimal) error {
	return p.decimal(v)
}

func (p *NumInfo) decimal(v *apd.Decimal) error {
	if p.base != 10 {
		_, _, _ = v.SetString("0")
		b := p.buf
		if p.buf[0] == '-' {
			v.Negative = p.neg
			b = p.buf[1:]
		}
		v.Coeff.SetString(string(b), int(p.base))
		return nil
	}
	_ = v.UnmarshalText(p.buf)
	if p.mul != 0 {
		_, _ = baseContext.Mul(v, v, mulToRat[p.mul])
		cond, _ := baseContext.RoundToIntegralExact(v, v)
		if cond.Inexact() {
			return p.errorf("number cannot be represented as int")
		}
	}
	return nil
}

// Multiplier reports which multiplier was used in an integral number.
func (p *NumInfo) Multiplier() Multiplier {
	return p.mul
}

// IsInt reports whether the number is an integral number.
func (p *NumInfo) IsInt() bool {
	return !p.isFloat
}

// ParseNum parses s and populates NumInfo with the result.
func ParseNum(s string, n *NumInfo) error {
	*n = NumInfo{pos: n.pos, src: s, buf: n.buf[:0]}
	if !n.next() {
		return n.errorf("invalid number %q", s)
	}
	if n.ch == '-' {
		n.neg = true
		n.buf = append(n.buf, '-')
		n.next()
	}
	seenDecimalPoint := false
	if n.ch == '.' {
		n.next()
		seenDecimalPoint = true
	}
	err := n.scanNumber(seenDecimalPoint)
	if err != nil {
		return err
	}
	if n.err != nil {
		return n.err
	}
	if n.p < len(n.src) {
		return n.errorf("invalid number %q", s)
	}
	if len(n.buf) == 0 {
		n.buf = append(n.buf, '0')
	}
	return nil
}

func (p *NumInfo) errorf(format string, args ...interface{}) error {
	return errors.Newf(p.pos, format, args...)
}

// A Multiplier indicates a multiplier indicator used in the literal.
type Multiplier byte

const (
	mul1 Multiplier = 1 + iota
	mul2
	mul3
	mul4
	mul5
	mul6
	mul7
	mul8

	mulBin = 0x10
	mulDec = 0x20

	K = mulDec | mul1
	M = mulDec | mul2
	G = mulDec | mul3
	T = mulDec | mul4
	P = mulDec | mul5
	E = mulDec | mul6
	Z = mulDec | mul7
	Y = mulDec | mul8

	Ki = mulBin | mul1
	Mi = mulBin | mul2
	Gi = mulBin | mul3
	Ti = mulBin | mul4
	Pi = mulBin | mul5
	Ei = mulBin | mul6
	Zi = mulBin | mul7
	Yi = mulBin | mul8
)

func (p *NumInfo) next() bool {
	if p.p >= len(p.src) {
		p.ch = 0
		return false
	}
	p.ch = p.src[p.p]
	p.p++
	if p.ch == '.' {
		if len(p.buf) == 0 {
			p.buf = append(p.buf, '0')
		}
		p.buf = append(p.buf, '.')
	}
	return true
}

func (p *NumInfo) digitVal(ch byte) (d int) {
	switch {
	case '0' <= ch && ch <= '9':
		d = int(ch - '0')
	case ch == '_':
		p.UseSep = true
		return 0
	case 'a' <= ch && ch <= 'f':
		d = int(ch - 'a' + 10)
	case 'A' <= ch && ch <= 'F':
		d = int(ch - 'A' + 10)
	default:
		return 16 // larger than any legal digit val
	}
	return d
}

func (p *NumInfo) scanMantissa(base int) bool {
	hasDigit := false
	var last byte
	for p.digitVal(p.ch) < base {
		if p.ch != '_' {
			p.buf = append(p.buf, p.ch)
			hasDigit = true
		}
		last = p.ch
		p.next()
	}
	if last == '_' {
		p.err = p.errorf("illegal '_' in number")
	}
	return hasDigit
}

func (p *NumInfo) scanNumber(seenDecimalPoint bool) error {
	p.base = 10

	if seenDecimalPoint {
		p.isFloat = true
		if !p.scanMantissa(10) {
			return p.errorf("illegal fraction %q", p.src)
		}
		goto exponent
	}

	if p.ch == '0' {
		// int or float
		p.next()
		switch p.ch {
		case 'x', 'X':
			p.base = 16
			// hexadecimal int
			p.next()
			if !p.scanMantissa(16) {
				// only scanned "0x" or "0X"
				return p.errorf("illegal hexadecimal number %q", p.src)
			}
		case 'b':
			p.base = 2
			// binary int
			p.next()
			if !p.scanMantissa(2) {
				// only scanned "0b"
				return p.errorf("illegal binary number %q", p.src)
			}
		case 'o':
			p.base = 8
			// octal int
			p.next()
			if !p.scanMantissa(8) {
				// only scanned "0o"
				return p.errorf("illegal octal number %q", p.src)
			}
		default:
			// int (base 8 or 10) or float
			p.scanMantissa(8)
			if p.ch == '8' || p.ch == '9' {
				p.scanMantissa(10)
				if p.ch != '.' && p.ch != 'e' && p.ch != 'E' {
					return p.errorf("illegal integer number %q", p.src)
				}
			}
			switch p.ch {
			case 'e', 'E':
				if len(p.buf) == 0 {
					p.buf = append(p.buf, '0')
				}
				fallthrough
			case '.':
				goto fraction
			}
			if len(p.buf) > 0 {
				p.base = 8
			}
		}
		goto exit
	}

	// decimal int or float
	if !p.scanMantissa(10) {
		return p.errorf("illegal number start %q", p.src)
	}

fraction:
	if p.ch == '.' {
		p.isFloat = true
		p.next()
		p.scanMantissa(10)
	}

exponent:
	switch p.ch {
	case 'K', 'M', 'G', 'T', 'P':
		p.mul = charToMul[p.ch]
		p.next()
		if p.ch == 'i' {
			p.mul |= mulBin
			p.next()
		} else {
			p.mul |= mulDec
		}
		var v apd.Decimal
		p.isFloat = false
		return p.decimal(&v)

	case 'e', 'E':
		p.isFloat = true
		p.next()
		p.buf = append(p.buf, 'e')
		if p.ch == '-' || p.ch == '+' {
			p.buf = append(p.buf, p.ch)
			p.next()
		}
		if !p.scanMantissa(10) {
			return p.errorf("illegal exponent %q", p.src)
		}
	}

exit:
	return nil
}

var charToMul = map[byte]Multiplier{
	'K': mul1,
	'M': mul2,
	'G': mul3,
	'T': mul4,
	'P': mul5,
	'E': mul6,
	'Z': mul7,
	'Y': mul8,
}

var mulToRat = map[Multiplier]*apd.Decimal{}

func init() {
	d := apd.New(1, 0)
	b := apd.New(1, 0)
	dm := apd.New(1000, 0)
	bm := apd.New(1024, 0)

	c := apd.BaseContext
	for i := Multiplier(1); int(i) < len(charToMul); i++ {
		// TODO: may we write to one of the sources?
		var bn, dn apd.Decimal
		_, _ = c.Mul(&dn, d, dm)
		d = &dn
		_, _ = c.Mul(&bn, b, bm)
		b = &bn
		mulToRat[mulDec|i] = d
		mulToRat[mulBin|i] = b
	}
}
