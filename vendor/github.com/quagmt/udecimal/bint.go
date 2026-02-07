package udecimal

import (
	"bytes"
	"fmt"
	"math/big"
	"strings"
)

var (
	defaultParseMode = ParseModeError
)

func SetDefaultParseMode(mode ParseMode) {
	switch mode {
	case ParseModeError, ParseModeTrunc:
		defaultParseMode = mode
	default:
		panic("can't set default parse mode: invalid mode value")
	}
}

type ParseMode int

const (
	// Default parse mode will return error if the string number
	// has more than [defaultPrec] decimal digits.
	ParseModeError ParseMode = iota

	// ParseModeTrunc will not return error if the string number
	// has more than [defaultPrec] decimal digits and truncate the exceeded digits instead.
	// Use this mode if the data source (e.g. database, external API, etc.) stores data
	// that has more than [defaultPrec] decimal digits already, allowing for some
	// precision loss (if acceptable).
	ParseModeTrunc
)

var (
	bigZero = big.NewInt(0)
	bigOne  = big.NewInt(1)
	bigTen  = big.NewInt(10)
)

// bint represents a whole decimal number without a decimal point.
// The value is always positive and is stored in a 128-bit unsigned integer.
// If the value exceeds the 128-bit limit, it falls back to using big.Int.
type bint struct {
	// fall back, in case the value is our of u128 range
	bigInt *big.Int

	// Stores small numbers with high performance and zero allocation operations.
	// The value range is 0 <= u128 <= 2^128 - 1
	u128 u128
}

func (u *bint) overflow() bool {
	return u.bigInt != nil
}

func bintFromBigInt(b *big.Int) bint {
	return bint{bigInt: b}
}

func bintFromU128(u u128) bint {
	return bint{u128: u}
}

func bintFromU64(u uint64) bint {
	return bint{u128: u128{lo: u}}
}

func (u bint) GetBig() *big.Int {
	if u.overflow() {
		return new(big.Int).Set(u.bigInt)
	}

	return u.u128.ToBigInt()
}

func (u bint) IsZero() bool {
	if !u.overflow() {
		return u.u128.IsZero()
	}

	return u.bigInt.Cmp(bigZero) == 0
}

func (u bint) Cmp(v bint) int {
	if !u.overflow() && !v.overflow() {
		return u.u128.Cmp(v.u128)
	}

	return u.GetBig().Cmp(v.GetBig())
}

func errInvalidFormat(s []byte) error {
	return fmt.Errorf("%w: can't parse '%s'", ErrInvalidFormat, s)
}

func parseBint(s []byte) (bool, bint, uint8, error) {
	if len(s) == 0 {
		return false, bint{}, 0, ErrEmptyString
	}

	if len(s) > maxStrLen {
		return false, bint{}, 0, ErrMaxStrLen
	}

	// if s has less than 41 characters, it can fit into u128
	// 41 chars = maxLen(u128) + dot + sign = 39 + 1 + 1
	if len(s) <= 41 {
		neg, bint, prec, err := parseBintFromU128(s)
		if err == nil || err != errOverflow {
			return neg, bint, prec, err
		}

		// overflow, try to parse into big.Int
	}

	// parse into big.Int
	var (
		width     = len(s)
		intString string
		prec, pos int
		neg       bool
		value     = s
	)

	switch s[0] {
	case '.':
		return false, bint{}, 0, errInvalidFormat(s)
	case '-':
		neg = true
		value = s[1:]
		pos++
	case '+':
		pos++
	default:
		// do nothing
	}

	// prevent "+" or "-"
	if pos == width {
		return false, bint{}, 0, errInvalidFormat(s)
	}

	// prevent "-.123" or "+.123"
	if s[pos] == '.' {
		return false, bint{}, 0, errInvalidFormat(s)
	}

	vLen := len(value)
	pIndex := bytes.IndexByte(value, '.')

	switch {
	case pIndex == -1:
		// There is no decimal point, we can just parse the original string as an int
		intString = string(value)
	case pIndex == 0 || pIndex >= vLen-1:
		// prevent "123." or "-123."
		return false, bint{}, 0, errInvalidFormat(s)
	default:
		prec = vLen - pIndex - 1
		switch defaultParseMode {
		case ParseModeError:
			if prec > int(defaultPrec) {
				return false, bint{}, 0, ErrPrecOutOfRange
			}
		case ParseModeTrunc:
			if prec > int(defaultPrec) {
				value = value[:pIndex+1+int(defaultPrec)]
				prec = int(defaultPrec)
			}
		default:
			return false, bint{}, 0, fmt.Errorf("invalid parse mode: %d. Make sure to use SetParseMode with a valid value", defaultParseMode)
		}

		b := strings.Builder{}
		_, err := b.Write(value[:pIndex])
		if err != nil {
			return false, bint{}, 0, err
		}

		_, err = b.Write(value[pIndex+1:])
		if err != nil {
			return false, bint{}, 0, err
		}

		// intString = value[:pIndex] + value[pIndex+1:]
		intString = b.String()
	}

	dValue := new(big.Int)
	_, ok := dValue.SetString(intString, 10)
	if !ok {
		return false, bint{}, 0, errInvalidFormat(s)
	}

	// the value should always be positive, as we already extracted the sign
	if dValue.Sign() == -1 {
		return false, bint{}, 0, errInvalidFormat(s)
	}

	//nolint:gosec // prec <= maxPrec (19) and can be safely converted to uint8
	return neg, bintFromBigInt(dValue), uint8(prec), nil
}

func parseBintFromU128(s []byte) (bool, bint, uint8, error) {
	width := len(s)

	var (
		pos int
		neg bool
	)

	switch s[0] {
	case '.':
		return false, bint{}, 0, errInvalidFormat(s)
	case '-':
		neg = true
		pos++
	case '+':
		pos++
	default:
		// do nothing
	}

	// prevent "+" or "-"
	if pos == width {
		return false, bint{}, 0, errInvalidFormat(s)
	}

	// prevent "-.123" or "+.123"
	if s[pos] == '.' {
		return false, bint{}, 0, errInvalidFormat(s)
	}

	var (
		err  error
		coef u128
		prec uint8
	)

	if len(s[pos:]) <= maxDigitU64 {
		coef, prec, err = parseSmallToU128(s[pos:])
	} else {
		coef, prec, err = parseLargeToU128(s[pos:])
	}

	if err == ErrInvalidFormat {
		return neg, bint{}, 0, errInvalidFormat(s)
	}

	return neg, bint{u128: coef}, prec, err
}

func parseSmallToU128(s []byte) (u128, uint8, error) {
	var (
		coef uint64
		prec uint8
	)

	for i := 0; i < len(s); i++ {
		if s[i] == '.' {
			// return err if we encounter the '.' more than once
			if prec != 0 {
				return u128{}, 0, ErrInvalidFormat
			}

			//nolint:gosec // len(s) <= maxDigitU64 and len(s)-i-1 >= 0, can be safely converted to uint8
			prec = uint8(len(s) - i - 1)

			// prevent "123." or "-123."
			if prec == 0 {
				return u128{}, 0, ErrInvalidFormat
			}

			if prec > defaultPrec {
				return u128{}, 0, ErrPrecOutOfRange
			}

			continue
		}

		if s[i] < '0' || s[i] > '9' {
			return u128{}, 0, ErrInvalidFormat
		}

		coef = coef*10 + uint64(s[i]-'0')
	}

	if coef == 0 {
		return u128{}, 0, nil
	}

	return u128{lo: coef}, prec, nil
}

func parseLargeToU128(s []byte) (u128, uint8, error) {
	// find '.' position
	l := len(s)
	pos := bytes.IndexByte(s, '.')
	if pos == 0 || pos == l-1 {
		// prevent ".123" or "123."
		return u128{}, 0, ErrInvalidFormat
	}

	if pos == -1 {
		// no decimal point
		coef, err := digitToU128(s)
		if err != nil {
			return u128{}, 0, err
		}

		return coef, 0, nil
	}

	// now 0 < pos < l-1
	//nolint:gosec // l < maxStrLen, so 0 < l-pos-1 < 256, can be safely converted to uint8
	prec := uint8(l - pos - 1)
	switch defaultParseMode {
	case ParseModeError:
		if prec > defaultPrec {
			return u128{}, 0, ErrPrecOutOfRange
		}
	case ParseModeTrunc:
		if prec > defaultPrec {
			s = s[:pos+1+int(defaultPrec)]
			prec = defaultPrec
		}
	default:
		return u128{}, 0, fmt.Errorf("invalid parse mode: %d. Make sure to use SetParseMode with a valid value", defaultParseMode)
	}

	// number has a decimal point, split into 2 parts: integer and fraction
	intPart, err := digitToU128(s[:pos])
	if err != nil {
		return u128{}, 0, err
	}

	// because max prec is 19,
	// factionPart can't be larger than 10^19-1 and will fit into uint64 (fractionPart.hi == 0)
	fractionPart, err := digitToU128(s[pos+1:])
	if err != nil {
		return u128{}, 0, err
	}

	// combine
	coef, err := intPart.Mul64(pow10[uint64(prec)].lo)
	if err != nil {
		return u128{}, 0, err
	}

	coef, err = coef.Add64(fractionPart.lo)
	if err != nil {
		return u128{}, 0, err
	}

	return coef, prec, nil
}

func digitToU128(s []byte) (u128, error) {
	if len(s) <= maxDigitU64 {
		var u uint64
		for i := 0; i < len(s); i++ {
			if s[i] < '0' || s[i] > '9' {
				return u128{}, ErrInvalidFormat
			}

			u = u*10 + uint64(s[i]-'0')
		}

		return u128{lo: u}, nil
	}

	// number is too large
	var (
		u   u128
		err error
	)

	for i := 0; i < len(s); i++ {
		if s[i] < '0' || s[i] > '9' {
			return u128{}, ErrInvalidFormat
		}

		u, err = u.Mul64(10)
		if err != nil {
			return u128{}, err
		}

		u, err = u.Add64(uint64(s[i] - '0'))
		if err != nil {
			return u128{}, err
		}
	}

	return u, nil
}

// GT returns true if u > v
func (u bint) GT(v bint) bool {
	return u.Cmp(v) == 1
}

func (u bint) Add(v bint) bint {
	if !u.overflow() && !v.overflow() {
		c, err := u.u128.Add(v.u128)
		if err == nil {
			return bint{u128: c}
		}

		// overflow, fallback to big.Int
	}

	return bintFromBigInt(new(big.Int).Add(u.GetBig(), v.GetBig()))
}

func (u bint) Sub(v bint) (bint, error) {
	if !u.overflow() && !v.overflow() {
		c, err := u.u128.Sub(v.u128)
		if err == nil {
			return bint{u128: c}, nil
		}
	}

	uBig := u.GetBig()
	vBig := v.GetBig()

	// make sure the result is always positive
	if uBig.Cmp(vBig) < 0 {
		return bint{}, errOverflow
	}

	return bintFromBigInt(new(big.Int).Sub(uBig, vBig)), nil
}

func (u bint) Mul(v bint) bint {
	if !u.overflow() && !v.overflow() {
		c, err := u.u128.Mul(v.u128)
		if err == nil {
			return bint{u128: c}
		}
	}

	return bintFromBigInt(new(big.Int).Mul(u.GetBig(), v.GetBig()))
}
