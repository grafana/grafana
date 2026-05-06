package pgtype

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"io"
	"strconv"
	"strings"
	"unicode"

	"github.com/jackc/pgx/v5/internal/pgio"
)

// Information on the internals of PostgreSQL arrays can be found in
// src/include/utils/array.h and src/backend/utils/adt/arrayfuncs.c. Of
// particular interest is the array_send function.

type arrayHeader struct {
	ContainsNull bool
	ElementOID   uint32
	Dimensions   []ArrayDimension
}

type ArrayDimension struct {
	Length     int32
	LowerBound int32
}

// cardinality returns the number of elements in an array of dimensions size.
func cardinality(dimensions []ArrayDimension) int {
	if len(dimensions) == 0 {
		return 0
	}

	elementCount := int(dimensions[0].Length)
	for _, d := range dimensions[1:] {
		elementCount *= int(d.Length)
	}

	return elementCount
}

func (dst *arrayHeader) DecodeBinary(m *Map, src []byte) (int, error) {
	if len(src) < 12 {
		return 0, fmt.Errorf("array header too short: %d", len(src))
	}

	rp := 0

	numDims := int(binary.BigEndian.Uint32(src[rp:]))
	rp += 4

	dst.ContainsNull = binary.BigEndian.Uint32(src[rp:]) == 1
	rp += 4

	dst.ElementOID = binary.BigEndian.Uint32(src[rp:])
	rp += 4

	dst.Dimensions = make([]ArrayDimension, numDims)
	if len(src) < 12+numDims*8 {
		return 0, fmt.Errorf("array header too short for %d dimensions: %d", numDims, len(src))
	}
	for i := range dst.Dimensions {
		dst.Dimensions[i].Length = int32(binary.BigEndian.Uint32(src[rp:]))
		rp += 4

		dst.Dimensions[i].LowerBound = int32(binary.BigEndian.Uint32(src[rp:]))
		rp += 4
	}

	return rp, nil
}

func (src arrayHeader) EncodeBinary(buf []byte) []byte {
	buf = pgio.AppendInt32(buf, int32(len(src.Dimensions)))

	var containsNull int32
	if src.ContainsNull {
		containsNull = 1
	}
	buf = pgio.AppendInt32(buf, containsNull)

	buf = pgio.AppendUint32(buf, src.ElementOID)

	for i := range src.Dimensions {
		buf = pgio.AppendInt32(buf, src.Dimensions[i].Length)
		buf = pgio.AppendInt32(buf, src.Dimensions[i].LowerBound)
	}

	return buf
}

type untypedTextArray struct {
	Elements   []string
	Quoted     []bool
	Dimensions []ArrayDimension
}

func parseUntypedTextArray(src string) (*untypedTextArray, error) {
	dst := &untypedTextArray{
		Elements:   []string{},
		Quoted:     []bool{},
		Dimensions: []ArrayDimension{},
	}

	buf := bytes.NewBufferString(src)

	skipWhitespace(buf)

	r, _, err := buf.ReadRune()
	if err != nil {
		return nil, fmt.Errorf("invalid array: %w", err)
	}

	var explicitDimensions []ArrayDimension

	// Array has explicit dimensions
	if r == '[' {
		buf.UnreadRune()

		for {
			r, _, err = buf.ReadRune()
			if err != nil {
				return nil, fmt.Errorf("invalid array: %w", err)
			}

			if r == '=' {
				break
			} else if r != '[' {
				return nil, fmt.Errorf("invalid array, expected '[' or '=' got %v", r)
			}

			lower, err := arrayParseInteger(buf)
			if err != nil {
				return nil, fmt.Errorf("invalid array: %w", err)
			}

			r, _, err = buf.ReadRune()
			if err != nil {
				return nil, fmt.Errorf("invalid array: %w", err)
			}

			if r != ':' {
				return nil, fmt.Errorf("invalid array, expected ':' got %v", r)
			}

			upper, err := arrayParseInteger(buf)
			if err != nil {
				return nil, fmt.Errorf("invalid array: %w", err)
			}

			r, _, err = buf.ReadRune()
			if err != nil {
				return nil, fmt.Errorf("invalid array: %w", err)
			}

			if r != ']' {
				return nil, fmt.Errorf("invalid array, expected ']' got %v", r)
			}

			explicitDimensions = append(explicitDimensions, ArrayDimension{LowerBound: lower, Length: upper - lower + 1})
		}

		r, _, err = buf.ReadRune()
		if err != nil {
			return nil, fmt.Errorf("invalid array: %w", err)
		}
	}

	if r != '{' {
		return nil, fmt.Errorf("invalid array, expected '{' got %v", r)
	}

	implicitDimensions := []ArrayDimension{{LowerBound: 1, Length: 0}}

	// Consume all initial opening brackets. This provides number of dimensions.
	for {
		r, _, err = buf.ReadRune()
		if err != nil {
			return nil, fmt.Errorf("invalid array: %w", err)
		}

		if r == '{' {
			implicitDimensions[len(implicitDimensions)-1].Length = 1
			implicitDimensions = append(implicitDimensions, ArrayDimension{LowerBound: 1})
		} else {
			buf.UnreadRune()
			break
		}
	}
	currentDim := len(implicitDimensions) - 1
	counterDim := currentDim

	for {
		r, _, err = buf.ReadRune()
		if err != nil {
			return nil, fmt.Errorf("invalid array: %w", err)
		}

		switch r {
		case '{':
			if currentDim == counterDim {
				implicitDimensions[currentDim].Length++
			}
			currentDim++
		case ',':
		case '}':
			currentDim--
			if currentDim < counterDim {
				counterDim = currentDim
			}
		default:
			buf.UnreadRune()
			value, quoted, err := arrayParseValue(buf)
			if err != nil {
				return nil, fmt.Errorf("invalid array value: %w", err)
			}
			if currentDim == counterDim {
				implicitDimensions[currentDim].Length++
			}
			dst.Quoted = append(dst.Quoted, quoted)
			dst.Elements = append(dst.Elements, value)
		}

		if currentDim < 0 {
			break
		}
	}

	skipWhitespace(buf)

	if buf.Len() > 0 {
		return nil, fmt.Errorf("unexpected trailing data: %v", buf.String())
	}

	if len(dst.Elements) == 0 {
	} else if len(explicitDimensions) > 0 {
		dst.Dimensions = explicitDimensions
	} else {
		dst.Dimensions = implicitDimensions
	}

	return dst, nil
}

func skipWhitespace(buf *bytes.Buffer) {
	var r rune
	var err error
	for r, _, _ = buf.ReadRune(); unicode.IsSpace(r); r, _, _ = buf.ReadRune() {
	}

	if err != io.EOF {
		buf.UnreadRune()
	}
}

func arrayParseValue(buf *bytes.Buffer) (string, bool, error) {
	r, _, err := buf.ReadRune()
	if err != nil {
		return "", false, err
	}
	if r == '"' {
		return arrayParseQuotedValue(buf)
	}
	buf.UnreadRune()

	s := &bytes.Buffer{}

	for {
		r, _, err := buf.ReadRune()
		if err != nil {
			return "", false, err
		}

		switch r {
		case ',', '}':
			buf.UnreadRune()
			return s.String(), false, nil
		}

		s.WriteRune(r)
	}
}

func arrayParseQuotedValue(buf *bytes.Buffer) (string, bool, error) {
	s := &bytes.Buffer{}

	for {
		r, _, err := buf.ReadRune()
		if err != nil {
			return "", false, err
		}

		switch r {
		case '\\':
			r, _, err = buf.ReadRune()
			if err != nil {
				return "", false, err
			}
		case '"':
			r, _, err = buf.ReadRune()
			if err != nil {
				return "", false, err
			}
			buf.UnreadRune()
			return s.String(), true, nil
		}
		s.WriteRune(r)
	}
}

func arrayParseInteger(buf *bytes.Buffer) (int32, error) {
	s := &bytes.Buffer{}

	for {
		r, _, err := buf.ReadRune()
		if err != nil {
			return 0, err
		}

		if ('0' <= r && r <= '9') || r == '-' {
			s.WriteRune(r)
		} else {
			buf.UnreadRune()
			n, err := strconv.ParseInt(s.String(), 10, 32)
			if err != nil {
				return 0, err
			}
			return int32(n), nil
		}
	}
}

func encodeTextArrayDimensions(buf []byte, dimensions []ArrayDimension) []byte {
	var customDimensions bool
	for _, dim := range dimensions {
		if dim.LowerBound != 1 {
			customDimensions = true
		}
	}

	if !customDimensions {
		return buf
	}

	for _, dim := range dimensions {
		buf = append(buf, '[')
		buf = append(buf, strconv.FormatInt(int64(dim.LowerBound), 10)...)
		buf = append(buf, ':')
		buf = append(buf, strconv.FormatInt(int64(dim.LowerBound+dim.Length-1), 10)...)
		buf = append(buf, ']')
	}

	return append(buf, '=')
}

var quoteArrayReplacer = strings.NewReplacer(`\`, `\\`, `"`, `\"`)

func quoteArrayElement(src string) string {
	return `"` + quoteArrayReplacer.Replace(src) + `"`
}

func isSpace(ch byte) bool {
	// see array_isspace:
	// https://github.com/postgres/postgres/blob/master/src/backend/utils/adt/arrayfuncs.c
	return ch == ' ' || ch == '\t' || ch == '\n' || ch == '\r' || ch == '\v' || ch == '\f'
}

func quoteArrayElementIfNeeded(src string) string {
	if src == "" || (len(src) == 4 && strings.EqualFold(src, "null")) || isSpace(src[0]) || isSpace(src[len(src)-1]) || strings.ContainsAny(src, `{},"\`) {
		return quoteArrayElement(src)
	}
	return src
}

// Array represents a PostgreSQL array for T. It implements the [ArrayGetter] and [ArraySetter] interfaces. It preserves
// PostgreSQL dimensions and custom lower bounds. Use [FlatArray] if these are not needed.
type Array[T any] struct {
	Elements []T
	Dims     []ArrayDimension
	Valid    bool
}

func (a Array[T]) Dimensions() []ArrayDimension {
	return a.Dims
}

func (a Array[T]) Index(i int) any {
	return a.Elements[i]
}

func (a Array[T]) IndexType() any {
	var el T
	return el
}

func (a *Array[T]) SetDimensions(dimensions []ArrayDimension) error {
	if dimensions == nil {
		*a = Array[T]{}
		return nil
	}

	elementCount := cardinality(dimensions)
	*a = Array[T]{
		Elements: make([]T, elementCount),
		Dims:     dimensions,
		Valid:    true,
	}

	return nil
}

func (a Array[T]) ScanIndex(i int) any {
	return &a.Elements[i]
}

func (a Array[T]) ScanIndexType() any {
	return new(T)
}

// FlatArray implements the [ArrayGetter] and [ArraySetter] interfaces for any slice of T. It ignores PostgreSQL dimensions
// and custom lower bounds. Use [Array] to preserve these.
type FlatArray[T any] []T

func (a FlatArray[T]) Dimensions() []ArrayDimension {
	if a == nil {
		return nil
	}

	return []ArrayDimension{{Length: int32(len(a)), LowerBound: 1}}
}

func (a FlatArray[T]) Index(i int) any {
	return a[i]
}

func (a FlatArray[T]) IndexType() any {
	var el T
	return el
}

func (a *FlatArray[T]) SetDimensions(dimensions []ArrayDimension) error {
	if dimensions == nil {
		*a = nil
		return nil
	}

	elementCount := cardinality(dimensions)
	*a = make(FlatArray[T], elementCount)
	return nil
}

func (a FlatArray[T]) ScanIndex(i int) any {
	return &a[i]
}

func (a FlatArray[T]) ScanIndexType() any {
	return new(T)
}
