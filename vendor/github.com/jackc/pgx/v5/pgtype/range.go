package pgtype

import (
	"bytes"
	"encoding/binary"
	"fmt"
)

type BoundType byte

const (
	Inclusive = BoundType('i')
	Exclusive = BoundType('e')
	Unbounded = BoundType('U')
	Empty     = BoundType('E')
)

func (bt BoundType) String() string {
	return string(bt)
}

type untypedTextRange struct {
	Lower     string
	Upper     string
	LowerType BoundType
	UpperType BoundType
}

func parseUntypedTextRange(src string) (*untypedTextRange, error) {
	utr := &untypedTextRange{}
	if src == "empty" {
		utr.LowerType = Empty
		utr.UpperType = Empty
		return utr, nil
	}

	buf := bytes.NewBufferString(src)

	skipWhitespace(buf)

	r, _, err := buf.ReadRune()
	if err != nil {
		return nil, fmt.Errorf("invalid lower bound: %w", err)
	}
	switch r {
	case '(':
		utr.LowerType = Exclusive
	case '[':
		utr.LowerType = Inclusive
	default:
		return nil, fmt.Errorf("missing lower bound, instead got: %v", string(r))
	}

	r, _, err = buf.ReadRune()
	if err != nil {
		return nil, fmt.Errorf("invalid lower value: %w", err)
	}
	buf.UnreadRune()

	if r == ',' {
		utr.LowerType = Unbounded
	} else {
		utr.Lower, err = rangeParseValue(buf)
		if err != nil {
			return nil, fmt.Errorf("invalid lower value: %w", err)
		}
	}

	r, _, err = buf.ReadRune()
	if err != nil {
		return nil, fmt.Errorf("missing range separator: %w", err)
	}
	if r != ',' {
		return nil, fmt.Errorf("missing range separator: %v", r)
	}

	r, _, err = buf.ReadRune()
	if err != nil {
		return nil, fmt.Errorf("invalid upper value: %w", err)
	}

	if r == ')' || r == ']' {
		utr.UpperType = Unbounded
	} else {
		buf.UnreadRune()
		utr.Upper, err = rangeParseValue(buf)
		if err != nil {
			return nil, fmt.Errorf("invalid upper value: %w", err)
		}

		r, _, err = buf.ReadRune()
		if err != nil {
			return nil, fmt.Errorf("missing upper bound: %w", err)
		}
		switch r {
		case ')':
			utr.UpperType = Exclusive
		case ']':
			utr.UpperType = Inclusive
		default:
			return nil, fmt.Errorf("missing upper bound, instead got: %v", string(r))
		}
	}

	skipWhitespace(buf)

	if buf.Len() > 0 {
		return nil, fmt.Errorf("unexpected trailing data: %v", buf.String())
	}

	return utr, nil
}

func rangeParseValue(buf *bytes.Buffer) (string, error) {
	r, _, err := buf.ReadRune()
	if err != nil {
		return "", err
	}
	if r == '"' {
		return rangeParseQuotedValue(buf)
	}
	buf.UnreadRune()

	s := &bytes.Buffer{}

	for {
		r, _, err := buf.ReadRune()
		if err != nil {
			return "", err
		}

		switch r {
		case '\\':
			r, _, err = buf.ReadRune()
			if err != nil {
				return "", err
			}
		case ',', '[', ']', '(', ')':
			buf.UnreadRune()
			return s.String(), nil
		}

		s.WriteRune(r)
	}
}

func rangeParseQuotedValue(buf *bytes.Buffer) (string, error) {
	s := &bytes.Buffer{}

	for {
		r, _, err := buf.ReadRune()
		if err != nil {
			return "", err
		}

		switch r {
		case '\\':
			r, _, err = buf.ReadRune()
			if err != nil {
				return "", err
			}
		case '"':
			r, _, err = buf.ReadRune()
			if err != nil {
				return "", err
			}
			if r != '"' {
				buf.UnreadRune()
				return s.String(), nil
			}
		}
		s.WriteRune(r)
	}
}

type untypedBinaryRange struct {
	Lower     []byte
	Upper     []byte
	LowerType BoundType
	UpperType BoundType
}

// 0 = ()      = 00000
// 1 = empty   = 00001
// 2 = [)      = 00010
// 4 = (]      = 00100
// 6 = []      = 00110
// 8 = )       = 01000
// 12 = ]      = 01100
// 16 = (      = 10000
// 18 = [      = 10010
// 24 =        = 11000

const (
	emptyMask          = 1
	lowerInclusiveMask = 2
	upperInclusiveMask = 4
	lowerUnboundedMask = 8
	upperUnboundedMask = 16
)

func parseUntypedBinaryRange(src []byte) (*untypedBinaryRange, error) {
	ubr := &untypedBinaryRange{}

	if len(src) == 0 {
		return nil, fmt.Errorf("range too short: %v", len(src))
	}

	rangeType := src[0]
	rp := 1

	if rangeType&emptyMask > 0 {
		if len(src[rp:]) > 0 {
			return nil, fmt.Errorf("unexpected trailing bytes parsing empty range: %v", len(src[rp:]))
		}
		ubr.LowerType = Empty
		ubr.UpperType = Empty
		return ubr, nil
	}

	if rangeType&lowerInclusiveMask > 0 {
		ubr.LowerType = Inclusive
	} else if rangeType&lowerUnboundedMask > 0 {
		ubr.LowerType = Unbounded
	} else {
		ubr.LowerType = Exclusive
	}

	if rangeType&upperInclusiveMask > 0 {
		ubr.UpperType = Inclusive
	} else if rangeType&upperUnboundedMask > 0 {
		ubr.UpperType = Unbounded
	} else {
		ubr.UpperType = Exclusive
	}

	if ubr.LowerType == Unbounded && ubr.UpperType == Unbounded {
		if len(src[rp:]) > 0 {
			return nil, fmt.Errorf("unexpected trailing bytes parsing unbounded range: %v", len(src[rp:]))
		}
		return ubr, nil
	}

	if len(src[rp:]) < 4 {
		return nil, fmt.Errorf("too few bytes for size: %v", src[rp:])
	}
	valueLen := int(binary.BigEndian.Uint32(src[rp:]))
	rp += 4

	val := src[rp : rp+valueLen]
	rp += valueLen

	if ubr.LowerType != Unbounded {
		ubr.Lower = val
	} else {
		ubr.Upper = val
		if len(src[rp:]) > 0 {
			return nil, fmt.Errorf("unexpected trailing bytes parsing range: %v", len(src[rp:]))
		}
		return ubr, nil
	}

	if ubr.UpperType != Unbounded {
		if len(src[rp:]) < 4 {
			return nil, fmt.Errorf("too few bytes for size: %v", src[rp:])
		}
		valueLen := int(binary.BigEndian.Uint32(src[rp:]))
		rp += 4
		ubr.Upper = src[rp : rp+valueLen]
		rp += valueLen
	}

	if len(src[rp:]) > 0 {
		return nil, fmt.Errorf("unexpected trailing bytes parsing range: %v", len(src[rp:]))
	}

	return ubr, nil
}

// Range is a generic range type.
type Range[T any] struct {
	Lower     T
	Upper     T
	LowerType BoundType
	UpperType BoundType
	Valid     bool
}

func (r Range[T]) IsNull() bool {
	return !r.Valid
}

func (r Range[T]) BoundTypes() (lower, upper BoundType) {
	return r.LowerType, r.UpperType
}

func (r Range[T]) Bounds() (lower, upper any) {
	return &r.Lower, &r.Upper
}

func (r *Range[T]) ScanNull() error {
	*r = Range[T]{}
	return nil
}

func (r *Range[T]) ScanBounds() (lowerTarget, upperTarget any) {
	return &r.Lower, &r.Upper
}

func (r *Range[T]) SetBoundTypes(lower, upper BoundType) error {
	if lower == Unbounded || lower == Empty {
		var zero T
		r.Lower = zero
	}
	if upper == Unbounded || upper == Empty {
		var zero T
		r.Upper = zero
	}
	r.LowerType = lower
	r.UpperType = upper
	r.Valid = true
	return nil
}
