package json

import (
	"bytes"
	"encoding"
	"encoding/json"
	"fmt"
	"math"
	"math/big"
	"reflect"
	"strconv"
	"time"
	"unsafe"

	"github.com/segmentio/asm/base64"
	"github.com/segmentio/asm/keyset"
	"github.com/segmentio/encoding/iso8601"
)

func (d decoder) anyFlagsSet(flags ParseFlags) bool {
	return d.flags&flags != 0
}

func (d decoder) decodeNull(b []byte, p unsafe.Pointer) ([]byte, error) {
	if hasNullPrefix(b) {
		return b[4:], nil
	}
	return d.inputError(b, nullType)
}

func (d decoder) decodeBool(b []byte, p unsafe.Pointer) ([]byte, error) {
	switch {
	case hasTruePrefix(b):
		*(*bool)(p) = true
		return b[4:], nil

	case hasFalsePrefix(b):
		*(*bool)(p) = false
		return b[5:], nil

	case hasNullPrefix(b):
		return b[4:], nil

	default:
		return d.inputError(b, boolType)
	}
}

func (d decoder) decodeInt(b []byte, p unsafe.Pointer) ([]byte, error) {
	if hasNullPrefix(b) {
		return b[4:], nil
	}

	v, r, err := d.parseInt(b, intType)
	if err != nil {
		return r, err
	}

	*(*int)(p) = int(v)
	return r, nil
}

func (d decoder) decodeInt8(b []byte, p unsafe.Pointer) ([]byte, error) {
	if hasNullPrefix(b) {
		return b[4:], nil
	}

	v, r, err := d.parseInt(b, int8Type)
	if err != nil {
		return r, err
	}

	if v < math.MinInt8 || v > math.MaxInt8 {
		return r, unmarshalOverflow(b[:len(b)-len(r)], int8Type)
	}

	*(*int8)(p) = int8(v)
	return r, nil
}

func (d decoder) decodeInt16(b []byte, p unsafe.Pointer) ([]byte, error) {
	if hasNullPrefix(b) {
		return b[4:], nil
	}

	v, r, err := d.parseInt(b, int16Type)
	if err != nil {
		return r, err
	}

	if v < math.MinInt16 || v > math.MaxInt16 {
		return r, unmarshalOverflow(b[:len(b)-len(r)], int16Type)
	}

	*(*int16)(p) = int16(v)
	return r, nil
}

func (d decoder) decodeInt32(b []byte, p unsafe.Pointer) ([]byte, error) {
	if hasNullPrefix(b) {
		return b[4:], nil
	}

	v, r, err := d.parseInt(b, int32Type)
	if err != nil {
		return r, err
	}

	if v < math.MinInt32 || v > math.MaxInt32 {
		return r, unmarshalOverflow(b[:len(b)-len(r)], int32Type)
	}

	*(*int32)(p) = int32(v)
	return r, nil
}

func (d decoder) decodeInt64(b []byte, p unsafe.Pointer) ([]byte, error) {
	if hasNullPrefix(b) {
		return b[4:], nil
	}

	v, r, err := d.parseInt(b, int64Type)
	if err != nil {
		return r, err
	}

	*(*int64)(p) = v
	return r, nil
}

func (d decoder) decodeUint(b []byte, p unsafe.Pointer) ([]byte, error) {
	if hasNullPrefix(b) {
		return b[4:], nil
	}

	v, r, err := d.parseUint(b, uintType)
	if err != nil {
		return r, err
	}

	*(*uint)(p) = uint(v)
	return r, nil
}

func (d decoder) decodeUintptr(b []byte, p unsafe.Pointer) ([]byte, error) {
	if hasNullPrefix(b) {
		return b[4:], nil
	}

	v, r, err := d.parseUint(b, uintptrType)
	if err != nil {
		return r, err
	}

	*(*uintptr)(p) = uintptr(v)
	return r, nil
}

func (d decoder) decodeUint8(b []byte, p unsafe.Pointer) ([]byte, error) {
	if hasNullPrefix(b) {
		return b[4:], nil
	}

	v, r, err := d.parseUint(b, uint8Type)
	if err != nil {
		return r, err
	}

	if v > math.MaxUint8 {
		return r, unmarshalOverflow(b[:len(b)-len(r)], uint8Type)
	}

	*(*uint8)(p) = uint8(v)
	return r, nil
}

func (d decoder) decodeUint16(b []byte, p unsafe.Pointer) ([]byte, error) {
	if hasNullPrefix(b) {
		return b[4:], nil
	}

	v, r, err := d.parseUint(b, uint16Type)
	if err != nil {
		return r, err
	}

	if v > math.MaxUint16 {
		return r, unmarshalOverflow(b[:len(b)-len(r)], uint16Type)
	}

	*(*uint16)(p) = uint16(v)
	return r, nil
}

func (d decoder) decodeUint32(b []byte, p unsafe.Pointer) ([]byte, error) {
	if hasNullPrefix(b) {
		return b[4:], nil
	}

	v, r, err := d.parseUint(b, uint32Type)
	if err != nil {
		return r, err
	}

	if v > math.MaxUint32 {
		return r, unmarshalOverflow(b[:len(b)-len(r)], uint32Type)
	}

	*(*uint32)(p) = uint32(v)
	return r, nil
}

func (d decoder) decodeUint64(b []byte, p unsafe.Pointer) ([]byte, error) {
	if hasNullPrefix(b) {
		return b[4:], nil
	}

	v, r, err := d.parseUint(b, uint64Type)
	if err != nil {
		return r, err
	}

	*(*uint64)(p) = v
	return r, nil
}

func (d decoder) decodeFloat32(b []byte, p unsafe.Pointer) ([]byte, error) {
	if hasNullPrefix(b) {
		return b[4:], nil
	}

	v, r, _, err := d.parseNumber(b)
	if err != nil {
		return d.inputError(b, float32Type)
	}

	f, err := strconv.ParseFloat(*(*string)(unsafe.Pointer(&v)), 32)
	if err != nil {
		return d.inputError(b, float32Type)
	}

	*(*float32)(p) = float32(f)
	return r, nil
}

func (d decoder) decodeFloat64(b []byte, p unsafe.Pointer) ([]byte, error) {
	if hasNullPrefix(b) {
		return b[4:], nil
	}

	v, r, _, err := d.parseNumber(b)
	if err != nil {
		return d.inputError(b, float64Type)
	}

	f, err := strconv.ParseFloat(*(*string)(unsafe.Pointer(&v)), 64)
	if err != nil {
		return d.inputError(b, float64Type)
	}

	*(*float64)(p) = f
	return r, nil
}

func (d decoder) decodeNumber(b []byte, p unsafe.Pointer) ([]byte, error) {
	if hasNullPrefix(b) {
		return b[4:], nil
	}

	v, r, _, err := d.parseNumber(b)
	if err != nil {
		return d.inputError(b, numberType)
	}

	if (d.flags & DontCopyNumber) != 0 {
		*(*Number)(p) = *(*Number)(unsafe.Pointer(&v))
	} else {
		*(*Number)(p) = Number(v)
	}

	return r, nil
}

func (d decoder) decodeString(b []byte, p unsafe.Pointer) ([]byte, error) {
	if hasNullPrefix(b) {
		return b[4:], nil
	}

	s, r, new, err := d.parseStringUnquote(b, nil)
	if err != nil {
		if len(b) == 0 || b[0] != '"' {
			return d.inputError(b, stringType)
		}
		return r, err
	}

	if new || (d.flags&DontCopyString) != 0 {
		*(*string)(p) = *(*string)(unsafe.Pointer(&s))
	} else {
		*(*string)(p) = string(s)
	}

	return r, nil
}

func (d decoder) decodeFromString(b []byte, p unsafe.Pointer, decode decodeFunc) ([]byte, error) {
	if hasNullPrefix(b) {
		return decode(d, b, p)
	}

	v, b, _, err := d.parseStringUnquote(b, nil)
	if err != nil {
		return d.inputError(v, stringType)
	}

	if v, err = decode(d, v, p); err != nil {
		return b, err
	}

	if v = skipSpaces(v); len(v) != 0 {
		return b, syntaxError(v, "unexpected trailing tokens after string value")
	}

	return b, nil
}

func (d decoder) decodeFromStringToInt(b []byte, p unsafe.Pointer, t reflect.Type, decode decodeFunc) ([]byte, error) {
	if hasNullPrefix(b) {
		return decode(d, b, p)
	}

	if len(b) > 0 && b[0] != '"' {
		v, r, k, err := d.parseNumber(b)
		if err == nil {
			// The encoding/json package will return a *json.UnmarshalTypeError if
			// the input was a floating point number representation, even tho a
			// string is expected here.
			if k == Float {
				_, err := strconv.ParseFloat(*(*string)(unsafe.Pointer(&v)), 64)
				if err != nil {
					return r, unmarshalTypeError(v, t)
				}
			}
		}
		return r, fmt.Errorf("json: invalid use of ,string struct tag, trying to unmarshal unquoted value into int")
	}

	if len(b) > 1 && b[0] == '"' && b[1] == '"' {
		return b, fmt.Errorf("json: invalid use of ,string struct tag, trying to unmarshal \"\" into int")
	}

	v, b, _, err := d.parseStringUnquote(b, nil)
	if err != nil {
		return d.inputError(v, t)
	}

	if hasLeadingZeroes(v) {
		// In this context the encoding/json package accepts leading zeroes because
		// it is not constrained by the JSON syntax, remove them so the parsing
		// functions don't return syntax errors.
		u := make([]byte, 0, len(v))
		i := 0

		if i < len(v) && v[i] == '-' || v[i] == '+' {
			u = append(u, v[i])
			i++
		}

		for (i+1) < len(v) && v[i] == '0' && '0' <= v[i+1] && v[i+1] <= '9' {
			i++
		}

		v = append(u, v[i:]...)
	}

	if r, err := decode(d, v, p); err != nil {
		if _, isSyntaxError := err.(*SyntaxError); isSyntaxError {
			if hasPrefix(v, "-") {
				// The standard library interprets sequences of '-' characters
				// as numbers but still returns type errors in this case...
				return b, unmarshalTypeError(v, t)
			}
			return b, fmt.Errorf("json: invalid use of ,string struct tag, trying to unmarshal %q into int", prefix(v))
		}
		// When the input value was a valid number representation we retain the
		// error returned by the decoder.
		if _, _, _, err := d.parseNumber(v); err != nil {
			// When the input value valid JSON we mirror the behavior of the
			// encoding/json package and return a generic error.
			if _, _, _, err := d.parseValue(v); err == nil {
				return b, fmt.Errorf("json: invalid use of ,string struct tag, trying to unmarshal %q into int", prefix(v))
			}
		}
		return b, err
	} else if len(r) != 0 {
		return r, unmarshalTypeError(v, t)
	}

	return b, nil
}

func (d decoder) decodeBytes(b []byte, p unsafe.Pointer) ([]byte, error) {
	if hasNullPrefix(b) {
		*(*[]byte)(p) = nil
		return b[4:], nil
	}

	if len(b) < 2 {
		return d.inputError(b, bytesType)
	}

	if b[0] != '"' {
		// Go 1.7- behavior: bytes slices may be decoded from array of integers.
		if len(b) > 0 && b[0] == '[' {
			return d.decodeSlice(b, p, 1, bytesType, decoder.decodeUint8)
		}
		return d.inputError(b, bytesType)
	}

	// The input string contains escaped sequences, we need to parse it before
	// decoding it to match the encoding/json package behvaior.
	src, r, _, err := d.parseStringUnquote(b, nil)
	if err != nil {
		return d.inputError(b, bytesType)
	}

	dst := make([]byte, base64.StdEncoding.DecodedLen(len(src)))

	n, err := base64.StdEncoding.Decode(dst, src)
	if err != nil {
		return r, err
	}

	*(*[]byte)(p) = dst[:n]
	return r, nil
}

func (d decoder) decodeDuration(b []byte, p unsafe.Pointer) ([]byte, error) {
	if hasNullPrefix(b) {
		return b[4:], nil
	}

	// in order to inter-operate with the stdlib, we must be able to interpret
	// durations passed as integer values.  there's some discussion about being
	// flexible on how durations are formatted, but for the time being, it's
	// been punted to go2 at the earliest: https://github.com/golang/go/issues/4712
	if len(b) > 0 && b[0] != '"' {
		v, r, err := d.parseInt(b, durationType)
		if err != nil {
			return d.inputError(b, int32Type)
		}

		if v < math.MinInt64 || v > math.MaxInt64 {
			return r, unmarshalOverflow(b[:len(b)-len(r)], int32Type)
		}

		*(*time.Duration)(p) = time.Duration(v)
		return r, nil
	}

	if len(b) < 2 || b[0] != '"' {
		return d.inputError(b, durationType)
	}

	i := bytes.IndexByte(b[1:], '"') + 1
	if i <= 0 {
		return d.inputError(b, durationType)
	}

	s := b[1:i] // trim quotes

	v, err := time.ParseDuration(*(*string)(unsafe.Pointer(&s)))
	if err != nil {
		return d.inputError(b, durationType)
	}

	*(*time.Duration)(p) = v
	return b[i+1:], nil
}

func (d decoder) decodeTime(b []byte, p unsafe.Pointer) ([]byte, error) {
	if hasNullPrefix(b) {
		return b[4:], nil
	}

	if len(b) < 2 || b[0] != '"' {
		return d.inputError(b, timeType)
	}

	i := bytes.IndexByte(b[1:], '"') + 1
	if i <= 0 {
		return d.inputError(b, timeType)
	}

	s := b[1:i] // trim quotes

	v, err := iso8601.Parse(*(*string)(unsafe.Pointer(&s)))
	if err != nil {
		return d.inputError(b, timeType)
	}

	*(*time.Time)(p) = v
	return b[i+1:], nil
}

func (d decoder) decodeArray(b []byte, p unsafe.Pointer, n int, size uintptr, t reflect.Type, decode decodeFunc) ([]byte, error) {
	if hasNullPrefix(b) {
		return b[4:], nil
	}

	if len(b) < 2 || b[0] != '[' {
		return d.inputError(b, t)
	}
	b = b[1:]

	var err error
	for i := range n {
		b = skipSpaces(b)

		if i != 0 {
			if len(b) == 0 {
				return b, syntaxError(b, "unexpected EOF after array element")
			}
			switch b[0] {
			case ',':
				b = skipSpaces(b[1:])
			case ']':
				return b[1:], nil
			default:
				return b, syntaxError(b, "expected ',' after array element but found '%c'", b[0])
			}
		}

		b, err = decode(d, b, unsafe.Pointer(uintptr(p)+(uintptr(i)*size)))
		if err != nil {
			if e, ok := err.(*UnmarshalTypeError); ok {
				e.Struct = t.String() + e.Struct
				e.Field = d.prependField(strconv.Itoa(i), e.Field)
			}
			return b, err
		}
	}

	// The encoding/json package ignores extra elements found when decoding into
	// array types (which have a fixed size).
	for {
		b = skipSpaces(b)

		if len(b) == 0 {
			return b, syntaxError(b, "missing closing ']' in array value")
		}

		switch b[0] {
		case ',':
			b = skipSpaces(b[1:])
		case ']':
			return b[1:], nil
		}

		_, b, _, err = d.parseValue(b)
		if err != nil {
			return b, err
		}
	}
}

// This is a placeholder used to consturct non-nil empty slices.
var empty struct{}

func (d decoder) decodeSlice(b []byte, p unsafe.Pointer, size uintptr, t reflect.Type, decode decodeFunc) ([]byte, error) {
	if hasNullPrefix(b) {
		*(*slice)(p) = slice{}
		return b[4:], nil
	}

	if len(b) < 2 {
		return d.inputError(b, t)
	}

	if b[0] != '[' {
		// Go 1.7- behavior: fallback to decoding as a []byte if the element
		// type is byte; allow conversions from JSON strings even tho the
		// underlying type implemented unmarshaler interfaces.
		if t.Elem().Kind() == reflect.Uint8 {
			return d.decodeBytes(b, p)
		}
		return d.inputError(b, t)
	}

	input := b
	b = b[1:]

	s := (*slice)(p)
	s.len = 0

	var err error
	for {
		b = skipSpaces(b)

		if len(b) != 0 && b[0] == ']' {
			if s.data == nil {
				s.data = unsafe.Pointer(&empty)
			}
			return b[1:], nil
		}

		if s.len != 0 {
			if len(b) == 0 {
				return b, syntaxError(b, "unexpected EOF after array element")
			}
			if b[0] != ',' {
				return b, syntaxError(b, "expected ',' after array element but found '%c'", b[0])
			}
			b = skipSpaces(b[1:])
		}

		if s.len == s.cap {
			c := s.cap

			if c == 0 {
				c = 10
			} else {
				c *= 2
			}

			*s = extendSlice(t, s, c)
		}

		b, err = decode(d, b, unsafe.Pointer(uintptr(s.data)+(uintptr(s.len)*size)))
		if err != nil {
			if _, r, _, err := d.parseValue(input); err != nil {
				return r, err
			} else {
				b = r
			}
			if e, ok := err.(*UnmarshalTypeError); ok {
				e.Struct = t.String() + e.Struct
				e.Field = d.prependField(strconv.Itoa(s.len), e.Field)
			}
			return b, err
		}

		s.len++
	}
}

func (d decoder) decodeMap(b []byte, p unsafe.Pointer, t, kt, vt reflect.Type, kz, vz reflect.Value, decodeKey, decodeValue decodeFunc) ([]byte, error) {
	if hasNullPrefix(b) {
		*(*unsafe.Pointer)(p) = nil
		return b[4:], nil
	}

	if len(b) < 2 || b[0] != '{' {
		return d.inputError(b, t)
	}
	i := 0
	m := reflect.NewAt(t, p).Elem()

	k := reflect.New(kt).Elem()
	v := reflect.New(vt).Elem()

	kptr := (*iface)(unsafe.Pointer(&k)).ptr
	vptr := (*iface)(unsafe.Pointer(&v)).ptr
	input := b

	if m.IsNil() {
		m = reflect.MakeMap(t)
	}

	var err error
	b = b[1:]
	for {
		k.Set(kz)
		v.Set(vz)
		b = skipSpaces(b)

		if len(b) != 0 && b[0] == '}' {
			*(*unsafe.Pointer)(p) = unsafe.Pointer(m.Pointer())
			return b[1:], nil
		}

		if i != 0 {
			if len(b) == 0 {
				return b, syntaxError(b, "unexpected end of JSON input after object field value")
			}
			if b[0] != ',' {
				return b, syntaxError(b, "expected ',' after object field value but found '%c'", b[0])
			}
			b = skipSpaces(b[1:])
		}

		if hasNullPrefix(b) {
			return b, syntaxError(b, "cannot decode object key string from 'null' value")
		}

		if b, err = decodeKey(d, b, kptr); err != nil {
			return objectKeyError(b, err)
		}
		b = skipSpaces(b)

		if len(b) == 0 {
			return b, syntaxError(b, "unexpected end of JSON input after object field key")
		}
		if b[0] != ':' {
			return b, syntaxError(b, "expected ':' after object field key but found '%c'", b[0])
		}
		b = skipSpaces(b[1:])

		if b, err = decodeValue(d, b, vptr); err != nil {
			if _, r, _, err := d.parseValue(input); err != nil {
				return r, err
			} else {
				b = r
			}
			if e, ok := err.(*UnmarshalTypeError); ok {
				e.Struct = "map[" + kt.String() + "]" + vt.String() + "{" + e.Struct + "}"
				e.Field = d.prependField(fmt.Sprint(k.Interface()), e.Field)
			}
			return b, err
		}

		m.SetMapIndex(k, v)
		i++
	}
}

func (d decoder) decodeMapStringInterface(b []byte, p unsafe.Pointer) ([]byte, error) {
	if hasNullPrefix(b) {
		*(*unsafe.Pointer)(p) = nil
		return b[4:], nil
	}

	if len(b) < 2 || b[0] != '{' {
		return d.inputError(b, mapStringInterfaceType)
	}

	i := 0
	m := *(*map[string]any)(p)

	if m == nil {
		m = make(map[string]any, 64)
	}

	var (
		input = b
		key   string
		val   any
		err   error
	)

	b = b[1:]
	for {
		key = ""
		val = nil

		b = skipSpaces(b)

		if len(b) != 0 && b[0] == '}' {
			*(*unsafe.Pointer)(p) = *(*unsafe.Pointer)(unsafe.Pointer(&m))
			return b[1:], nil
		}

		if i != 0 {
			if len(b) == 0 {
				return b, syntaxError(b, "unexpected end of JSON input after object field value")
			}
			if b[0] != ',' {
				return b, syntaxError(b, "expected ',' after object field value but found '%c'", b[0])
			}
			b = skipSpaces(b[1:])
		}

		if hasNullPrefix(b) {
			return b, syntaxError(b, "cannot decode object key string from 'null' value")
		}

		b, err = d.decodeString(b, unsafe.Pointer(&key))
		if err != nil {
			return objectKeyError(b, err)
		}
		b = skipSpaces(b)

		if len(b) == 0 {
			return b, syntaxError(b, "unexpected end of JSON input after object field key")
		}
		if b[0] != ':' {
			return b, syntaxError(b, "expected ':' after object field key but found '%c'", b[0])
		}
		b = skipSpaces(b[1:])

		b, err = d.decodeInterface(b, unsafe.Pointer(&val))
		if err != nil {
			if _, r, _, err := d.parseValue(input); err != nil {
				return r, err
			} else {
				b = r
			}
			if e, ok := err.(*UnmarshalTypeError); ok {
				e.Struct = mapStringInterfaceType.String() + e.Struct
				e.Field = d.prependField(key, e.Field)
			}
			return b, err
		}

		m[key] = val
		i++
	}
}

func (d decoder) decodeMapStringRawMessage(b []byte, p unsafe.Pointer) ([]byte, error) {
	if hasNullPrefix(b) {
		*(*unsafe.Pointer)(p) = nil
		return b[4:], nil
	}

	if len(b) < 2 || b[0] != '{' {
		return d.inputError(b, mapStringRawMessageType)
	}

	i := 0
	m := *(*map[string]RawMessage)(p)

	if m == nil {
		m = make(map[string]RawMessage, 64)
	}

	var err error
	var key string
	var val RawMessage
	input := b

	b = b[1:]
	for {
		key = ""
		val = nil

		b = skipSpaces(b)

		if len(b) != 0 && b[0] == '}' {
			*(*unsafe.Pointer)(p) = *(*unsafe.Pointer)(unsafe.Pointer(&m))
			return b[1:], nil
		}

		if i != 0 {
			if len(b) == 0 {
				return b, syntaxError(b, "unexpected end of JSON input after object field value")
			}
			if b[0] != ',' {
				return b, syntaxError(b, "expected ',' after object field value but found '%c'", b[0])
			}
			b = skipSpaces(b[1:])
		}

		if hasNullPrefix(b) {
			return b, syntaxError(b, "cannot decode object key string from 'null' value")
		}

		b, err = d.decodeString(b, unsafe.Pointer(&key))
		if err != nil {
			return objectKeyError(b, err)
		}
		b = skipSpaces(b)

		if len(b) == 0 {
			return b, syntaxError(b, "unexpected end of JSON input after object field key")
		}
		if b[0] != ':' {
			return b, syntaxError(b, "expected ':' after object field key but found '%c'", b[0])
		}
		b = skipSpaces(b[1:])

		b, err = d.decodeRawMessage(b, unsafe.Pointer(&val))
		if err != nil {
			if _, r, _, err := d.parseValue(input); err != nil {
				return r, err
			} else {
				b = r
			}
			if e, ok := err.(*UnmarshalTypeError); ok {
				e.Struct = mapStringRawMessageType.String() + e.Struct
				e.Field = d.prependField(key, e.Field)
			}
			return b, err
		}

		m[key] = val
		i++
	}
}

func (d decoder) decodeMapStringString(b []byte, p unsafe.Pointer) ([]byte, error) {
	if hasNullPrefix(b) {
		*(*unsafe.Pointer)(p) = nil
		return b[4:], nil
	}

	if len(b) < 2 || b[0] != '{' {
		return d.inputError(b, mapStringStringType)
	}

	i := 0
	m := *(*map[string]string)(p)

	if m == nil {
		m = make(map[string]string, 64)
	}

	var err error
	var key string
	var val string
	input := b

	b = b[1:]
	for {
		key = ""
		val = ""

		b = skipSpaces(b)

		if len(b) != 0 && b[0] == '}' {
			*(*unsafe.Pointer)(p) = *(*unsafe.Pointer)(unsafe.Pointer(&m))
			return b[1:], nil
		}

		if i != 0 {
			if len(b) == 0 {
				return b, syntaxError(b, "unexpected end of JSON input after object field value")
			}
			if b[0] != ',' {
				return b, syntaxError(b, "expected ',' after object field value but found '%c'", b[0])
			}
			b = skipSpaces(b[1:])
		}

		if hasNullPrefix(b) {
			return b, syntaxError(b, "cannot decode object key string from 'null' value")
		}

		b, err = d.decodeString(b, unsafe.Pointer(&key))
		if err != nil {
			return objectKeyError(b, err)
		}
		b = skipSpaces(b)

		if len(b) == 0 {
			return b, syntaxError(b, "unexpected end of JSON input after object field key")
		}
		if b[0] != ':' {
			return b, syntaxError(b, "expected ':' after object field key but found '%c'", b[0])
		}
		b = skipSpaces(b[1:])

		b, err = d.decodeString(b, unsafe.Pointer(&val))
		if err != nil {
			if _, r, _, err := d.parseValue(input); err != nil {
				return r, err
			} else {
				b = r
			}
			if e, ok := err.(*UnmarshalTypeError); ok {
				e.Struct = mapStringStringType.String() + e.Struct
				e.Field = d.prependField(key, e.Field)
			}
			return b, err
		}

		m[key] = val
		i++
	}
}

func (d decoder) decodeMapStringStringSlice(b []byte, p unsafe.Pointer) ([]byte, error) {
	if hasNullPrefix(b) {
		*(*unsafe.Pointer)(p) = nil
		return b[4:], nil
	}

	if len(b) < 2 || b[0] != '{' {
		return d.inputError(b, mapStringStringSliceType)
	}

	i := 0
	m := *(*map[string][]string)(p)

	if m == nil {
		m = make(map[string][]string, 64)
	}

	var err error
	var key string
	var buf []string
	input := b
	stringSize := unsafe.Sizeof("")

	b = b[1:]
	for {
		key = ""
		buf = buf[:0]

		b = skipSpaces(b)

		if len(b) != 0 && b[0] == '}' {
			*(*unsafe.Pointer)(p) = *(*unsafe.Pointer)(unsafe.Pointer(&m))
			return b[1:], nil
		}

		if i != 0 {
			if len(b) == 0 {
				return b, syntaxError(b, "unexpected end of JSON input after object field value")
			}
			if b[0] != ',' {
				return b, syntaxError(b, "expected ',' after object field value but found '%c'", b[0])
			}
			b = skipSpaces(b[1:])
		}

		if hasNullPrefix(b) {
			return b, syntaxError(b, "cannot decode object key string from 'null' value")
		}

		b, err = d.decodeString(b, unsafe.Pointer(&key))
		if err != nil {
			return objectKeyError(b, err)
		}
		b = skipSpaces(b)

		if len(b) == 0 {
			return b, syntaxError(b, "unexpected end of JSON input after object field key")
		}
		if b[0] != ':' {
			return b, syntaxError(b, "expected ':' after object field key but found '%c'", b[0])
		}
		b = skipSpaces(b[1:])

		b, err = d.decodeSlice(b, unsafe.Pointer(&buf), stringSize, sliceStringType, decoder.decodeString)
		if err != nil {
			if _, r, _, err := d.parseValue(input); err != nil {
				return r, err
			} else {
				b = r
			}
			if e, ok := err.(*UnmarshalTypeError); ok {
				e.Struct = mapStringStringType.String() + e.Struct
				e.Field = d.prependField(key, e.Field)
			}
			return b, err
		}

		val := make([]string, len(buf))
		copy(val, buf)

		m[key] = val
		i++
	}
}

func (d decoder) decodeMapStringBool(b []byte, p unsafe.Pointer) ([]byte, error) {
	if hasNullPrefix(b) {
		*(*unsafe.Pointer)(p) = nil
		return b[4:], nil
	}

	if len(b) < 2 || b[0] != '{' {
		return d.inputError(b, mapStringBoolType)
	}

	i := 0
	m := *(*map[string]bool)(p)

	if m == nil {
		m = make(map[string]bool, 64)
	}

	var err error
	var key string
	var val bool
	input := b

	b = b[1:]
	for {
		key = ""
		val = false

		b = skipSpaces(b)

		if len(b) != 0 && b[0] == '}' {
			*(*unsafe.Pointer)(p) = *(*unsafe.Pointer)(unsafe.Pointer(&m))
			return b[1:], nil
		}

		if i != 0 {
			if len(b) == 0 {
				return b, syntaxError(b, "unexpected end of JSON input after object field value")
			}
			if b[0] != ',' {
				return b, syntaxError(b, "expected ',' after object field value but found '%c'", b[0])
			}
			b = skipSpaces(b[1:])
		}

		if hasNullPrefix(b) {
			return b, syntaxError(b, "cannot decode object key string from 'null' value")
		}

		b, err = d.decodeString(b, unsafe.Pointer(&key))
		if err != nil {
			return objectKeyError(b, err)
		}
		b = skipSpaces(b)

		if len(b) == 0 {
			return b, syntaxError(b, "unexpected end of JSON input after object field key")
		}
		if b[0] != ':' {
			return b, syntaxError(b, "expected ':' after object field key but found '%c'", b[0])
		}
		b = skipSpaces(b[1:])

		b, err = d.decodeBool(b, unsafe.Pointer(&val))
		if err != nil {
			if _, r, _, err := d.parseValue(input); err != nil {
				return r, err
			} else {
				b = r
			}
			if e, ok := err.(*UnmarshalTypeError); ok {
				e.Struct = mapStringStringType.String() + e.Struct
				e.Field = d.prependField(key, e.Field)
			}
			return b, err
		}

		m[key] = val
		i++
	}
}

func (d decoder) decodeStruct(b []byte, p unsafe.Pointer, st *structType) ([]byte, error) {
	if hasNullPrefix(b) {
		return b[4:], nil
	}

	if len(b) < 2 || b[0] != '{' {
		return d.inputError(b, st.typ)
	}

	var err error
	var k []byte
	var i int

	// memory buffer used to convert short field names to lowercase
	var buf [64]byte
	var key []byte
	input := b

	b = b[1:]
	for {
		b = skipSpaces(b)

		if len(b) != 0 && b[0] == '}' {
			return b[1:], nil
		}

		if i != 0 {
			if len(b) == 0 {
				return b, syntaxError(b, "unexpected end of JSON input after object field value")
			}
			if b[0] != ',' {
				return b, syntaxError(b, "expected ',' after object field value but found '%c'", b[0])
			}
			b = skipSpaces(b[1:])
		}
		i++

		if hasNullPrefix(b) {
			return b, syntaxError(b, "cannot decode object key string from 'null' value")
		}

		k, b, _, err = d.parseStringUnquote(b, nil)
		if err != nil {
			return objectKeyError(b, err)
		}
		b = skipSpaces(b)

		if len(b) == 0 {
			return b, syntaxError(b, "unexpected end of JSON input after object field key")
		}
		if b[0] != ':' {
			return b, syntaxError(b, "expected ':' after object field key but found '%c'", b[0])
		}
		b = skipSpaces(b[1:])

		var f *structField
		if len(st.keyset) != 0 {
			if n := keyset.Lookup(st.keyset, k); n < len(st.fields) {
				f = &st.fields[n]
			}
		} else {
			f = st.fieldsIndex[string(k)]
		}

		if f == nil && (d.flags&DontMatchCaseInsensitiveStructFields) == 0 {
			key = appendToLower(buf[:0], k)
			f = st.ficaseIndex[string(key)]
		}

		if f == nil {
			if (d.flags & DisallowUnknownFields) != 0 {
				return b, fmt.Errorf("json: unknown field %q", k)
			}
			if _, b, _, err = d.parseValue(b); err != nil {
				return b, err
			}
			continue
		}

		if b, err = f.codec.decode(d, b, unsafe.Pointer(uintptr(p)+f.offset)); err != nil {
			if _, r, _, err := d.parseValue(input); err != nil {
				return r, err
			} else {
				b = r
			}
			if e, ok := err.(*UnmarshalTypeError); ok {
				e.Struct = st.typ.String() + e.Struct
				e.Field = d.prependField(string(k), e.Field)
			}
			return b, err
		}
	}
}

func (d decoder) decodeEmbeddedStructPointer(b []byte, p unsafe.Pointer, t reflect.Type, unexported bool, offset uintptr, decode decodeFunc) ([]byte, error) {
	v := *(*unsafe.Pointer)(p)

	if v == nil {
		if unexported {
			return nil, fmt.Errorf("json: cannot set embedded pointer to unexported struct: %s", t)
		}
		v = unsafe.Pointer(reflect.New(t).Pointer())
		*(*unsafe.Pointer)(p) = v
	}

	return decode(d, b, unsafe.Pointer(uintptr(v)+offset))
}

func (d decoder) decodePointer(b []byte, p unsafe.Pointer, t reflect.Type, decode decodeFunc) ([]byte, error) {
	if hasNullPrefix(b) {
		pp := *(*unsafe.Pointer)(p)
		if pp != nil && t.Kind() == reflect.Ptr {
			return decode(d, b, pp)
		}
		*(*unsafe.Pointer)(p) = nil
		return b[4:], nil
	}

	v := *(*unsafe.Pointer)(p)
	if v == nil {
		v = unsafe.Pointer(reflect.New(t).Pointer())
		*(*unsafe.Pointer)(p) = v
	}

	return decode(d, b, v)
}

func (d decoder) decodeInterface(b []byte, p unsafe.Pointer) ([]byte, error) {
	val := *(*any)(p)
	*(*any)(p) = nil

	if t := reflect.TypeOf(val); t != nil && t.Kind() == reflect.Ptr {
		if v := reflect.ValueOf(val); v.IsNil() || t.Elem().Kind() != reflect.Ptr {
			// If the destination is nil the only value that is OK to decode is
			// `null`, and the encoding/json package always nils the destination
			// interface value in this case.
			if hasNullPrefix(b) {
				*(*any)(p) = nil
				return b[4:], nil
			}
		}

		b, err := Parse(b, val, d.flags)
		if err == nil {
			*(*any)(p) = val
		}

		return b, err
	}

	v, b, k, err := d.parseValue(b)
	if err != nil {
		return b, err
	}

	switch k.Class() {
	case Object:
		m := make(map[string]interface{})
		v, err = d.decodeMapStringInterface(v, unsafe.Pointer(&m))
		val = m

	case Array:
		a := make([]interface{}, 0, 10)
		v, err = d.decodeSlice(v, unsafe.Pointer(&a), unsafe.Sizeof(a[0]), sliceInterfaceType, decoder.decodeInterface)
		val = a

	case String:
		s := ""
		v, err = d.decodeString(v, unsafe.Pointer(&s))
		val = s

	case Null:
		v, val = nil, nil

	case Bool:
		v, val = nil, k == True

	case Num:
		v, err = d.decodeDynamicNumber(v, unsafe.Pointer(&val))

	default:
		return b, syntaxError(v, "expected token but found '%c'", v[0])
	}

	if err != nil {
		return b, err
	}

	if v = skipSpaces(v); len(v) != 0 {
		return b, syntaxError(v, "unexpected trailing trailing tokens after json value")
	}

	*(*any)(p) = val
	return b, nil
}

func (d decoder) decodeDynamicNumber(b []byte, p unsafe.Pointer) ([]byte, error) {
	kind := Float
	var err error

	// Only pre-parse for numeric kind if a conditional decode
	// has been requested.
	if d.anyFlagsSet(UseBigInt | UseInt64 | UseUint64) {
		_, _, kind, err = d.parseNumber(b)
		if err != nil {
			return b, err
		}
	}

	var rem []byte
	anyPtr := (*any)(p)

	// Mutually exclusive integer handling cases.
	switch {
	// If requested, attempt decode of positive integers as uint64.
	case kind == Uint && d.anyFlagsSet(UseUint64):
		rem, err = decodeInto[uint64](anyPtr, b, d, decoder.decodeUint64)
		if err == nil {
			return rem, err
		}

	// If uint64 decode was not requested but int64 decode was requested,
	// then attempt decode of positive integers as int64.
	case kind == Uint && d.anyFlagsSet(UseInt64):
		fallthrough

	// If int64 decode was requested,
	// attempt decode of negative integers as int64.
	case kind == Int && d.anyFlagsSet(UseInt64):
		rem, err = decodeInto[int64](anyPtr, b, d, decoder.decodeInt64)
		if err == nil {
			return rem, err
		}
	}

	// Fallback numeric handling cases:
	// these cannot be combined into the above switch,
	// since these cases also handle overflow
	// from the above cases, if decode was already attempted.
	switch {
	// If *big.Int decode was requested, handle that case for any integer.
	case kind == Uint && d.anyFlagsSet(UseBigInt):
		fallthrough
	case kind == Int && d.anyFlagsSet(UseBigInt):
		rem, err = decodeInto[*big.Int](anyPtr, b, d, bigIntDecoder)

	// If json.Number decode was requested, handle that for any number.
	case d.anyFlagsSet(UseNumber):
		rem, err = decodeInto[Number](anyPtr, b, d, decoder.decodeNumber)

	// Fall back to float64 decode when no special decoding has been requested.
	default:
		rem, err = decodeInto[float64](anyPtr, b, d, decoder.decodeFloat64)
	}

	return rem, err
}

func (d decoder) decodeMaybeEmptyInterface(b []byte, p unsafe.Pointer, t reflect.Type) ([]byte, error) {
	if hasNullPrefix(b) {
		*(*any)(p) = nil
		return b[4:], nil
	}

	if x := reflect.NewAt(t, p).Elem(); !x.IsNil() {
		if e := x.Elem(); e.Kind() == reflect.Ptr {
			return Parse(b, e.Interface(), d.flags)
		}
	} else if t.NumMethod() == 0 { // empty interface
		return Parse(b, (*any)(p), d.flags)
	}

	return d.decodeUnmarshalTypeError(b, p, t)
}

func (d decoder) decodeUnmarshalTypeError(b []byte, _ unsafe.Pointer, t reflect.Type) ([]byte, error) {
	v, b, _, err := d.parseValue(b)
	if err != nil {
		return b, err
	}
	return b, &UnmarshalTypeError{
		Value: string(v),
		Type:  t,
	}
}

func (d decoder) decodeRawMessage(b []byte, p unsafe.Pointer) ([]byte, error) {
	v, r, _, err := d.parseValue(b)
	if err != nil {
		return d.inputError(b, rawMessageType)
	}

	if (d.flags & DontCopyRawMessage) == 0 {
		v = append(make([]byte, 0, len(v)), v...)
	}

	*(*RawMessage)(p) = json.RawMessage(v)
	return r, err
}

func (d decoder) decodeJSONUnmarshaler(b []byte, p unsafe.Pointer, t reflect.Type, pointer bool) ([]byte, error) {
	v, b, _, err := d.parseValue(b)
	if err != nil {
		return b, err
	}

	u := reflect.NewAt(t, p)
	if !pointer {
		u = u.Elem()
		t = t.Elem()
	}
	if u.IsNil() {
		u.Set(reflect.New(t))
	}

	return b, u.Interface().(Unmarshaler).UnmarshalJSON(v)
}

func (d decoder) decodeTextUnmarshaler(b []byte, p unsafe.Pointer, t reflect.Type, pointer bool) ([]byte, error) {
	var value string

	v, b, k, err := d.parseValue(b)
	if err != nil {
		return b, err
	}
	if len(v) == 0 {
		return d.inputError(v, t)
	}

	switch k.Class() {
	case Null:
		return b, err

	case String:
		s, _, _, err := d.parseStringUnquote(v, nil)
		if err != nil {
			return b, err
		}
		u := reflect.NewAt(t, p)
		if !pointer {
			u = u.Elem()
			t = t.Elem()
		}
		if u.IsNil() {
			u.Set(reflect.New(t))
		}
		return b, u.Interface().(encoding.TextUnmarshaler).UnmarshalText(s)

	case Bool:
		if k == True {
			value = "true"
		} else {
			value = "false"
		}

	case Num:
		value = "number"

	case Object:
		value = "object"

	case Array:
		value = "array"
	}

	return b, &UnmarshalTypeError{Value: value, Type: reflect.PointerTo(t)}
}

func (d decoder) prependField(key, field string) string {
	if field != "" {
		return key + "." + field
	}
	return key
}

func (d decoder) inputError(b []byte, t reflect.Type) ([]byte, error) {
	if len(b) == 0 {
		return nil, unexpectedEOF(b)
	}
	_, r, _, err := d.parseValue(b)
	if err != nil {
		return r, err
	}
	return skipSpaces(r), unmarshalTypeError(b, t)
}

func decodeInto[T any](dest *any, b []byte, d decoder, fn decodeFunc) ([]byte, error) {
	var v T
	rem, err := fn(d, b, unsafe.Pointer(&v))
	if err == nil {
		*dest = v
	}

	return rem, err
}
