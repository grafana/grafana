package decimal128

import (
	"errors"
	"fmt"
	"io"
	"strconv"
)

// MustParse is like [Parse] but panics if the provided string cannot be parsed,
// instead of returning an error.
func MustParse(s string) Decimal {
	d, err := parse(s, payloadOpMustParse)
	if err != nil {
		panic("decimal128.MustParse(" + strconv.Quote(s) + "): invalid syntax")
	}

	return d
}

// Parse parses a Decimal value from the string provided. Parse accepts decimal
// floating point syntax. An underscore character '_' may appear between digits
// as a separator. Parse also recognises the string "NaN", and the (possibly
// signed) strings "Inf" and "Infinity", as their respective special floating
// point values. It ignores case when matching.
//
// If s is not syntactically well-formed, Parse returns an error that can be
// compared to [strconv.ErrSyntax] via [errors.Is].
//
// If the value is too precise to fit in a Decimal the result is rounded using
// the [DefaultRoundingMode]. If the value is greater than the largest possible
// Decimal value, Parse returns ±Inf and an error that can be compared to
// [strconv.ErrRange] via [errors.Is].
func Parse(s string) (Decimal, error) {
	return parse(s, payloadOpParse)
}

// Scan implements the [fmt.Scanner] interface. It supports the verbs 'e', 'E',
// 'f', 'F', 'g', 'G', and 'v'.
func (d *Decimal) Scan(f fmt.ScanState, verb rune) error {
	switch verb {
	case 'e', 'E', 'f', 'F', 'g', 'G', 'v':
	default:
		return errors.New("bad verb '%" + string(verb) + "' for Decimal")
	}

	f.SkipSpace()
	r, _, err := f.ReadRune()
	if err != nil {
		if errors.Is(err, io.EOF) {
			return io.ErrUnexpectedEOF
		}

		return err
	}

	neg := false

	if r == '-' {
		neg = true
	} else if r != '+' {
		f.UnreadRune()
	}

	r, _, err = f.ReadRune()
	if err != nil {
		if errors.Is(err, io.EOF) {
			return io.ErrUnexpectedEOF
		}

		return err
	}

	if r == 'I' || r == 'i' {
		r2, _, err := f.ReadRune()
		if err != nil {
			if errors.Is(err, io.EOF) {
				return io.ErrUnexpectedEOF
			}

			return err
		}

		if r2 != 'N' && r2 != 'n' {
			return &parseSyntaxError{s: string([]rune{r, r2})}
		}

		r3, _, err := f.ReadRune()
		if err != nil {
			if errors.Is(err, io.EOF) {
				return io.ErrUnexpectedEOF
			}

			return err
		}

		if r3 != 'F' && r3 != 'f' {
			return &parseSyntaxError{s: string([]rune{r, r2, r3})}
		}

		*d = inf(neg)
		return nil
	}

	if r == 'N' || r == 'n' {
		r2, _, err := f.ReadRune()
		if err != nil {
			if errors.Is(err, io.EOF) {
				return io.ErrUnexpectedEOF
			}

			return err
		}

		if r2 != 'A' && r2 != 'a' {
			return &parseSyntaxError{s: string([]rune{r, r2})}
		}

		r3, _, err := f.ReadRune()
		if err != nil {
			if errors.Is(err, io.EOF) {
				return io.ErrUnexpectedEOF
			}

			return err
		}

		if r3 != 'N' && r3 != 'n' {
			return &parseSyntaxError{s: string([]rune{r, r2, r3})}
		}

		*d = nan(payloadOpScan, 0, 0)
		return nil
	}

	f.UnreadRune()

	tok, err := f.Token(false, func(r rune) bool {
		switch {
		case r >= '0' && r <= '9':
			return true
		case r == '.':
			return true
		case r == 'E' || r == 'e':
			return true
		case r == '-':
			return true
		case r == '_':
			return true
		case r == '+':
			return true
		default:
			return false
		}
	})

	if err != nil {
		return err
	}

	tmp, err := parseNumber(tok, neg, true)
	if err != nil {
		switch err := err.(type) {
		case parseNumberRangeError:
			return &parseRangeError{string(tok)}
		case parseNumberSyntaxError:
			return &parseSyntaxError{string(tok)}
		default:
			return err
		}
	}

	*d = tmp
	return nil
}

// UnmarshalText implements the [encoding.TextUnmarshaler] interface.
func (d *Decimal) UnmarshalText(data []byte) error {
	tmp, err := parse(data, payloadOpUnmarshalText)
	if err != nil {
		return err
	}

	*d = tmp
	return nil
}

func parse[D []byte | string](d D, op Payload) (Decimal, error) {
	if len(d) == 0 {
		return Decimal{}, &parseSyntaxError{}
	}

	s := d
	neg := false

	if d[0] == '+' {
		d = d[1:]
	} else if d[0] == '-' {
		neg = true
		d = d[1:]
	}

	l := len(d)

	if l == 0 {
		return Decimal{}, &parseSyntaxError{string(s)}
	} else if l == 3 {
		if (d[0] == 'I' || d[0] == 'i') && (d[1] == 'N' || d[1] == 'n') && (d[2] == 'F' || d[2] == 'f') {
			return inf(neg), nil
		}

		if (d[0] == 'N' || d[0] == 'n') && (d[1] == 'A' || d[1] == 'a') && (d[2] == 'N' || d[2] == 'n') {
			return nan(op, 0, 0), nil
		}
	} else if l == 8 {
		if (d[0] == 'I' || d[0] == 'i') && (d[1] == 'N' || d[1] == 'n') && (d[2] == 'F' || d[2] == 'f') && (d[3] == 'I' || d[3] == 'i') && (d[4] == 'N' || d[4] == 'n') && (d[5] == 'I' || d[5] == 'i') && (d[6] == 'T' || d[6] == 't') && (d[7] == 'Y' || d[7] == 'y') {
			return inf(neg), nil
		}
	}

	v, err := parseNumber(d, neg, true)
	if err != nil {
		switch err := err.(type) {
		case parseNumberRangeError:
			return v, &parseRangeError{string(s)}
		case parseNumberSyntaxError:
			return v, &parseSyntaxError{string(s)}
		default:
			return v, err
		}
	}

	return v, nil
}

func parseNumber[D []byte | string](d D, neg, sepallowed bool) (Decimal, error) {
	var sig64 uint64
	var nfrac int16
	var trunc int8
	caneof := false
	cansep := false
	cansgn := false
	eneg := false
	sawdig := false
	sawdot := false
	sawexp := false

	l := len(d)
	i := 0
	for ; !sawexp && sig64 <= 0x18ff_ffff_ffff_ffff && i < l; i++ {
		switch c := d[i]; true {
		case c >= '0' && c <= '9':
			caneof = true
			cansep = true
			cansgn = false
			sawdig = true

			sig64 = sig64*10 + uint64(c-'0')

			if sawdot {
				nfrac++
			}
		case c == '.':
			if sawdot {
				return Decimal{}, parseNumberSyntaxError{}
			}

			caneof = true
			cansep = false
			cansgn = false
			sawdot = true
		case c == 'E' || c == 'e':
			if !sawdig {
				return Decimal{}, parseNumberSyntaxError{}
			}

			caneof = false
			cansep = false
			cansgn = true
			sawexp = true
		case c == '_':
			if !sepallowed || !cansep {
				return Decimal{}, parseNumberSyntaxError{}
			}

			caneof = false
			cansep = false
			cansgn = false
		default:
			return Decimal{}, parseNumberSyntaxError{}
		}
	}

	sig := uint128{sig64, 0}
	var exp int16
	maxexp := false

	for ; i < l; i++ {
		switch c := d[i]; true {
		case c >= '0' && c <= '9':
			caneof = true
			cansep = true
			cansgn = false
			sawdig = true

			if sawexp {
				if exp > exponentBias/10+1 {
					maxexp = true
				}

				exp *= 10
				exp += int16(c - '0')
			} else {
				if sig[1] <= 0x18ff_ffff_ffff_ffff {
					if sig[1] <= 0x027f_ffff_ffff_ffff && i < l-1 {
						c2 := d[i+1]
						if c2 >= '0' && c2 <= '9' {
							sig = sig.mul64(100)
							sig = sig.add64(uint64(c-'0')*10 + uint64(c2-'0'))

							if sawdot {
								nfrac += 2
							}

							i++
							continue
						}
					}

					sig = sig.mul64(10)
					sig = sig.add64(uint64(c - '0'))

					if sawdot {
						nfrac++
					}
				} else {
					if c != '0' {
						trunc = 1
					}

					if !sawdot {
						if exp < exponentBias+39 {
							nfrac--
						}
					}
				}
			}
		case c == '.':
			if sawdot || sawexp {
				return Decimal{}, parseNumberSyntaxError{}
			}

			caneof = true
			cansep = false
			cansgn = false
			sawdot = true
		case c == 'E' || c == 'e':
			if !sawdig || sawexp {
				return Decimal{}, parseNumberSyntaxError{}
			}

			caneof = false
			cansep = false
			cansgn = true
			sawexp = true
		case c == '-':
			if !cansgn {
				return Decimal{}, parseNumberSyntaxError{}
			}

			caneof = false
			cansep = false
			cansgn = false
			eneg = true
		case c == '_':
			if !cansep {
				return Decimal{}, parseNumberSyntaxError{}
			}

			caneof = false
			cansep = false
			cansgn = false
		case c == '+':
			if !cansgn {
				return Decimal{}, parseNumberSyntaxError{}
			}

			caneof = false
			cansep = false
			cansgn = false
		default:
			return Decimal{}, parseNumberSyntaxError{}
		}
	}

	if !caneof {
		return Decimal{}, parseNumberSyntaxError{}
	}

	if sig[0]|sig[1] == 0 {
		return zero(neg), nil
	}

	// If the exponent value is larger than the maximum supported exponent,
	// there are two cases where the value is still valid:
	//  - the exponent is negative, where the logical value rounds to 0
	//  - the significand is zero, where the logical value is 0
	//
	// Otherwise, return a range error.
	if maxexp {
		if eneg {
			return zero(neg), nil
		}

		return inf(neg), parseNumberRangeError{}
	}

	if eneg {
		exp *= -1
	}

	exp -= nfrac

	if exp > maxUnbiasedExponent+39 {
		return inf(neg), parseNumberRangeError{}
	}

	if exp < minUnbiasedExponent-39 {
		return zero(neg), nil
	}

	sig, exp = DefaultRoundingMode.reduce128(neg, sig, exp+exponentBias, trunc)

	if exp > maxBiasedExponent {
		return inf(neg), parseNumberRangeError{}
	}

	return compose(neg, sig, exp), nil
}

type parseNumberRangeError struct{}

func (err parseNumberRangeError) Error() string {
	return "value out of range"
}

type parseNumberSyntaxError struct{}

func (err parseNumberSyntaxError) Error() string {
	return "invalid syntax"
}

type parseRangeError struct {
	s string
}

func (err *parseRangeError) Error() string {
	return "parsing " + strconv.Quote(err.s) + ": value out of range"
}

func (err *parseRangeError) Is(target error) bool {
	return target == strconv.ErrRange
}

type parseSyntaxError struct {
	s string
}

func (err *parseSyntaxError) Error() string {
	return "parsing " + strconv.Quote(err.s) + ": invalid syntax"
}

func (err *parseSyntaxError) Is(target error) bool {
	return target == strconv.ErrSyntax
}
