package json

import (
	"encoding"
	"fmt"
	"math"
	"reflect"
	"sort"
	"strconv"
	"sync"
	"time"
	"unicode/utf8"
	"unsafe"

	"github.com/segmentio/asm/base64"
)

const hex = "0123456789abcdef"

func (e encoder) encodeNull(b []byte, p unsafe.Pointer) ([]byte, error) {
	return append(b, "null"...), nil
}

func (e encoder) encodeBool(b []byte, p unsafe.Pointer) ([]byte, error) {
	if *(*bool)(p) {
		return append(b, "true"...), nil
	}
	return append(b, "false"...), nil
}

func (e encoder) encodeInt(b []byte, p unsafe.Pointer) ([]byte, error) {
	return appendInt(b, int64(*(*int)(p))), nil
}

func (e encoder) encodeInt8(b []byte, p unsafe.Pointer) ([]byte, error) {
	return appendInt(b, int64(*(*int8)(p))), nil
}

func (e encoder) encodeInt16(b []byte, p unsafe.Pointer) ([]byte, error) {
	return appendInt(b, int64(*(*int16)(p))), nil
}

func (e encoder) encodeInt32(b []byte, p unsafe.Pointer) ([]byte, error) {
	return appendInt(b, int64(*(*int32)(p))), nil
}

func (e encoder) encodeInt64(b []byte, p unsafe.Pointer) ([]byte, error) {
	return appendInt(b, *(*int64)(p)), nil
}

func (e encoder) encodeUint(b []byte, p unsafe.Pointer) ([]byte, error) {
	return appendUint(b, uint64(*(*uint)(p))), nil
}

func (e encoder) encodeUintptr(b []byte, p unsafe.Pointer) ([]byte, error) {
	return appendUint(b, uint64(*(*uintptr)(p))), nil
}

func (e encoder) encodeUint8(b []byte, p unsafe.Pointer) ([]byte, error) {
	return appendUint(b, uint64(*(*uint8)(p))), nil
}

func (e encoder) encodeUint16(b []byte, p unsafe.Pointer) ([]byte, error) {
	return appendUint(b, uint64(*(*uint16)(p))), nil
}

func (e encoder) encodeUint32(b []byte, p unsafe.Pointer) ([]byte, error) {
	return appendUint(b, uint64(*(*uint32)(p))), nil
}

func (e encoder) encodeUint64(b []byte, p unsafe.Pointer) ([]byte, error) {
	return appendUint(b, *(*uint64)(p)), nil
}

func (e encoder) encodeFloat32(b []byte, p unsafe.Pointer) ([]byte, error) {
	return e.encodeFloat(b, float64(*(*float32)(p)), 32)
}

func (e encoder) encodeFloat64(b []byte, p unsafe.Pointer) ([]byte, error) {
	return e.encodeFloat(b, *(*float64)(p), 64)
}

func (e encoder) encodeFloat(b []byte, f float64, bits int) ([]byte, error) {
	switch {
	case math.IsNaN(f):
		return b, &UnsupportedValueError{Value: reflect.ValueOf(f), Str: "NaN"}
	case math.IsInf(f, 0):
		return b, &UnsupportedValueError{Value: reflect.ValueOf(f), Str: "inf"}
	}

	// Convert as if by ES6 number to string conversion.
	// This matches most other JSON generators.
	// See golang.org/issue/6384 and golang.org/issue/14135.
	// Like fmt %g, but the exponent cutoffs are different
	// and exponents themselves are not padded to two digits.
	abs := math.Abs(f)
	fmt := byte('f')
	// Note: Must use float32 comparisons for underlying float32 value to get precise cutoffs right.
	if abs != 0 {
		if bits == 64 && (abs < 1e-6 || abs >= 1e21) || bits == 32 && (float32(abs) < 1e-6 || float32(abs) >= 1e21) {
			fmt = 'e'
		}
	}

	b = strconv.AppendFloat(b, f, fmt, -1, int(bits))

	if fmt == 'e' {
		// clean up e-09 to e-9
		n := len(b)
		if n >= 4 && b[n-4] == 'e' && b[n-3] == '-' && b[n-2] == '0' {
			b[n-2] = b[n-1]
			b = b[:n-1]
		}
	}

	return b, nil
}

func (e encoder) encodeNumber(b []byte, p unsafe.Pointer) ([]byte, error) {
	n := *(*Number)(p)
	if n == "" {
		n = "0"
	}

	d := decoder{}
	_, _, _, err := d.parseNumber(stringToBytes(string(n)))
	if err != nil {
		return b, err
	}

	return append(b, n...), nil
}

func (e encoder) encodeString(b []byte, p unsafe.Pointer) ([]byte, error) {
	s := *(*string)(p)
	if len(s) == 0 {
		return append(b, `""`...), nil
	}
	i := 0
	j := 0
	escapeHTML := (e.flags & EscapeHTML) != 0

	b = append(b, '"')

	if len(s) >= 8 {
		if j = escapeIndex(s, escapeHTML); j < 0 {
			return append(append(b, s...), '"'), nil
		}
	}

	for j < len(s) {
		c := s[j]

		if c >= 0x20 && c <= 0x7f && c != '\\' && c != '"' && (!escapeHTML || (c != '<' && c != '>' && c != '&')) {
			// fast path: most of the time, printable ascii characters are used
			j++
			continue
		}

		switch c {
		case '\\', '"', '\b', '\f', '\n', '\r', '\t':
			b = append(b, s[i:j]...)
			b = append(b, '\\', escapeByteRepr(c))
			i = j + 1
			j = j + 1
			continue

		case '<', '>', '&':
			b = append(b, s[i:j]...)
			b = append(b, `\u00`...)
			b = append(b, hex[c>>4], hex[c&0xF])
			i = j + 1
			j = j + 1
			continue
		}

		// This encodes bytes < 0x20 except for \t, \n and \r.
		if c < 0x20 {
			b = append(b, s[i:j]...)
			b = append(b, `\u00`...)
			b = append(b, hex[c>>4], hex[c&0xF])
			i = j + 1
			j = j + 1
			continue
		}

		r, size := utf8.DecodeRuneInString(s[j:])

		if r == utf8.RuneError && size == 1 {
			b = append(b, s[i:j]...)
			b = append(b, `\ufffd`...)
			i = j + size
			j = j + size
			continue
		}

		switch r {
		case '\u2028', '\u2029':
			// U+2028 is LINE SEPARATOR.
			// U+2029 is PARAGRAPH SEPARATOR.
			// They are both technically valid characters in JSON strings,
			// but don't work in JSONP, which has to be evaluated as JavaScript,
			// and can lead to security holes there. It is valid JSON to
			// escape them, so we do so unconditionally.
			// See http://timelessrepo.com/json-isnt-a-javascript-subset for discussion.
			b = append(b, s[i:j]...)
			b = append(b, `\u202`...)
			b = append(b, hex[r&0xF])
			i = j + size
			j = j + size
			continue
		}

		j += size
	}

	b = append(b, s[i:]...)
	b = append(b, '"')
	return b, nil
}

func (e encoder) encodeToString(b []byte, p unsafe.Pointer, encode encodeFunc) ([]byte, error) {
	i := len(b)

	b, err := encode(e, b, p)
	if err != nil {
		return b, err
	}

	j := len(b)
	s := b[i:]

	if b, err = e.encodeString(b, unsafe.Pointer(&s)); err != nil {
		return b, err
	}

	n := copy(b[i:], b[j:])
	return b[:i+n], nil
}

func (e encoder) encodeBytes(b []byte, p unsafe.Pointer) ([]byte, error) {
	v := *(*[]byte)(p)
	if v == nil {
		return append(b, "null"...), nil
	}

	n := base64.StdEncoding.EncodedLen(len(v)) + 2

	if avail := cap(b) - len(b); avail < n {
		newB := make([]byte, cap(b)+(n-avail))
		copy(newB, b)
		b = newB[:len(b)]
	}

	i := len(b)
	j := len(b) + n

	b = b[:j]
	b[i] = '"'
	base64.StdEncoding.Encode(b[i+1:j-1], v)
	b[j-1] = '"'
	return b, nil
}

func (e encoder) encodeDuration(b []byte, p unsafe.Pointer) ([]byte, error) {
	b = append(b, '"')
	b = appendDuration(b, *(*time.Duration)(p))
	b = append(b, '"')
	return b, nil
}

func (e encoder) encodeTime(b []byte, p unsafe.Pointer) ([]byte, error) {
	t := *(*time.Time)(p)
	b = append(b, '"')
	b = t.AppendFormat(b, time.RFC3339Nano)
	b = append(b, '"')
	return b, nil
}

func (e encoder) encodeArray(b []byte, p unsafe.Pointer, n int, size uintptr, t reflect.Type, encode encodeFunc) ([]byte, error) {
	start := len(b)
	var err error
	b = append(b, '[')

	for i := range n {
		if i != 0 {
			b = append(b, ',')
		}
		if b, err = encode(e, b, unsafe.Pointer(uintptr(p)+(uintptr(i)*size))); err != nil {
			return b[:start], err
		}
	}

	b = append(b, ']')
	return b, nil
}

func (e encoder) encodeSlice(b []byte, p unsafe.Pointer, size uintptr, t reflect.Type, encode encodeFunc) ([]byte, error) {
	s := (*slice)(p)

	if s.data == nil && s.len == 0 && s.cap == 0 {
		return append(b, "null"...), nil
	}

	return e.encodeArray(b, s.data, s.len, size, t, encode)
}

func (e encoder) encodeMap(b []byte, p unsafe.Pointer, t reflect.Type, encodeKey, encodeValue encodeFunc, sortKeys sortFunc) ([]byte, error) {
	m := reflect.NewAt(t, p).Elem()
	if m.IsNil() {
		return append(b, "null"...), nil
	}

	keys := m.MapKeys()
	if sortKeys != nil && (e.flags&SortMapKeys) != 0 {
		sortKeys(keys)
	}

	start := len(b)
	var err error
	b = append(b, '{')

	for i, k := range keys {
		v := m.MapIndex(k)

		if i != 0 {
			b = append(b, ',')
		}

		if b, err = encodeKey(e, b, (*iface)(unsafe.Pointer(&k)).ptr); err != nil {
			return b[:start], err
		}

		b = append(b, ':')

		if b, err = encodeValue(e, b, (*iface)(unsafe.Pointer(&v)).ptr); err != nil {
			return b[:start], err
		}
	}

	b = append(b, '}')
	return b, nil
}

type element struct {
	key string
	val any
	raw RawMessage
}

type mapslice struct {
	elements []element
}

func (m *mapslice) Len() int           { return len(m.elements) }
func (m *mapslice) Less(i, j int) bool { return m.elements[i].key < m.elements[j].key }
func (m *mapslice) Swap(i, j int)      { m.elements[i], m.elements[j] = m.elements[j], m.elements[i] }

var mapslicePool = sync.Pool{
	New: func() any { return new(mapslice) },
}

func (e encoder) encodeMapStringInterface(b []byte, p unsafe.Pointer) ([]byte, error) {
	m := *(*map[string]any)(p)
	if m == nil {
		return append(b, "null"...), nil
	}

	if (e.flags & SortMapKeys) == 0 {
		// Optimized code path when the program does not need the map keys to be
		// sorted.
		b = append(b, '{')

		if len(m) != 0 {
			var err error
			i := 0

			for k, v := range m {
				if i != 0 {
					b = append(b, ',')
				}

				b, _ = e.encodeString(b, unsafe.Pointer(&k))
				b = append(b, ':')

				b, err = Append(b, v, e.flags)
				if err != nil {
					return b, err
				}

				i++
			}
		}

		b = append(b, '}')
		return b, nil
	}

	s := mapslicePool.Get().(*mapslice)
	if cap(s.elements) < len(m) {
		s.elements = make([]element, 0, align(10, uintptr(len(m))))
	}
	for key, val := range m {
		s.elements = append(s.elements, element{key: key, val: val})
	}
	sort.Sort(s)

	start := len(b)
	var err error
	b = append(b, '{')

	for i, elem := range s.elements {
		if i != 0 {
			b = append(b, ',')
		}

		b, _ = e.encodeString(b, unsafe.Pointer(&elem.key))
		b = append(b, ':')

		b, err = Append(b, elem.val, e.flags)
		if err != nil {
			break
		}
	}

	for i := range s.elements {
		s.elements[i] = element{}
	}

	s.elements = s.elements[:0]
	mapslicePool.Put(s)

	if err != nil {
		return b[:start], err
	}

	b = append(b, '}')
	return b, nil
}

func (e encoder) encodeMapStringRawMessage(b []byte, p unsafe.Pointer) ([]byte, error) {
	m := *(*map[string]RawMessage)(p)
	if m == nil {
		return append(b, "null"...), nil
	}

	if (e.flags & SortMapKeys) == 0 {
		// Optimized code path when the program does not need the map keys to be
		// sorted.
		b = append(b, '{')

		if len(m) != 0 {
			var err error
			i := 0

			for k, v := range m {
				if i != 0 {
					b = append(b, ',')
				}

				// encodeString doesn't return errors so we ignore it here
				b, _ = e.encodeString(b, unsafe.Pointer(&k))
				b = append(b, ':')

				b, err = e.encodeRawMessage(b, unsafe.Pointer(&v))
				if err != nil {
					break
				}

				i++
			}
		}

		b = append(b, '}')
		return b, nil
	}

	s := mapslicePool.Get().(*mapslice)
	if cap(s.elements) < len(m) {
		s.elements = make([]element, 0, align(10, uintptr(len(m))))
	}
	for key, raw := range m {
		s.elements = append(s.elements, element{key: key, raw: raw})
	}
	sort.Sort(s)

	start := len(b)
	var err error
	b = append(b, '{')

	for i, elem := range s.elements {
		if i != 0 {
			b = append(b, ',')
		}

		b, _ = e.encodeString(b, unsafe.Pointer(&elem.key))
		b = append(b, ':')

		b, err = e.encodeRawMessage(b, unsafe.Pointer(&elem.raw))
		if err != nil {
			break
		}
	}

	for i := range s.elements {
		s.elements[i] = element{}
	}

	s.elements = s.elements[:0]
	mapslicePool.Put(s)

	if err != nil {
		return b[:start], err
	}

	b = append(b, '}')
	return b, nil
}

func (e encoder) encodeMapStringString(b []byte, p unsafe.Pointer) ([]byte, error) {
	m := *(*map[string]string)(p)
	if m == nil {
		return append(b, "null"...), nil
	}

	if (e.flags & SortMapKeys) == 0 {
		// Optimized code path when the program does not need the map keys to be
		// sorted.
		b = append(b, '{')

		if len(m) != 0 {
			i := 0

			for k, v := range m {
				if i != 0 {
					b = append(b, ',')
				}

				// encodeString never returns an error so we ignore it here
				b, _ = e.encodeString(b, unsafe.Pointer(&k))
				b = append(b, ':')
				b, _ = e.encodeString(b, unsafe.Pointer(&v))

				i++
			}
		}

		b = append(b, '}')
		return b, nil
	}

	s := mapslicePool.Get().(*mapslice)
	if cap(s.elements) < len(m) {
		s.elements = make([]element, 0, align(10, uintptr(len(m))))
	}
	for key, val := range m {
		v := val
		s.elements = append(s.elements, element{key: key, val: &v})
	}
	sort.Sort(s)

	b = append(b, '{')

	for i, elem := range s.elements {
		if i != 0 {
			b = append(b, ',')
		}

		// encodeString never returns an error so we ignore it here
		b, _ = e.encodeString(b, unsafe.Pointer(&elem.key))
		b = append(b, ':')
		b, _ = e.encodeString(b, unsafe.Pointer(elem.val.(*string)))
	}

	for i := range s.elements {
		s.elements[i] = element{}
	}

	s.elements = s.elements[:0]
	mapslicePool.Put(s)

	b = append(b, '}')
	return b, nil
}

func (e encoder) encodeMapStringStringSlice(b []byte, p unsafe.Pointer) ([]byte, error) {
	m := *(*map[string][]string)(p)
	if m == nil {
		return append(b, "null"...), nil
	}

	stringSize := unsafe.Sizeof("")

	if (e.flags & SortMapKeys) == 0 {
		// Optimized code path when the program does not need the map keys to be
		// sorted.
		b = append(b, '{')

		if len(m) != 0 {
			var err error
			i := 0

			for k, v := range m {
				if i != 0 {
					b = append(b, ',')
				}

				b, _ = e.encodeString(b, unsafe.Pointer(&k))
				b = append(b, ':')

				b, err = e.encodeSlice(b, unsafe.Pointer(&v), stringSize, sliceStringType, encoder.encodeString)
				if err != nil {
					return b, err
				}

				i++
			}
		}

		b = append(b, '}')
		return b, nil
	}

	s := mapslicePool.Get().(*mapslice)
	if cap(s.elements) < len(m) {
		s.elements = make([]element, 0, align(10, uintptr(len(m))))
	}
	for key, val := range m {
		v := val
		s.elements = append(s.elements, element{key: key, val: &v})
	}
	sort.Sort(s)

	start := len(b)
	var err error
	b = append(b, '{')

	for i, elem := range s.elements {
		if i != 0 {
			b = append(b, ',')
		}

		b, _ = e.encodeString(b, unsafe.Pointer(&elem.key))
		b = append(b, ':')

		b, err = e.encodeSlice(b, unsafe.Pointer(elem.val.(*[]string)), stringSize, sliceStringType, encoder.encodeString)
		if err != nil {
			break
		}
	}

	for i := range s.elements {
		s.elements[i] = element{}
	}

	s.elements = s.elements[:0]
	mapslicePool.Put(s)

	if err != nil {
		return b[:start], err
	}

	b = append(b, '}')
	return b, nil
}

func (e encoder) encodeMapStringBool(b []byte, p unsafe.Pointer) ([]byte, error) {
	m := *(*map[string]bool)(p)
	if m == nil {
		return append(b, "null"...), nil
	}

	if (e.flags & SortMapKeys) == 0 {
		// Optimized code path when the program does not need the map keys to be
		// sorted.
		b = append(b, '{')

		if len(m) != 0 {
			i := 0

			for k, v := range m {
				if i != 0 {
					b = append(b, ',')
				}

				// encodeString never returns an error so we ignore it here
				b, _ = e.encodeString(b, unsafe.Pointer(&k))
				if v {
					b = append(b, ":true"...)
				} else {
					b = append(b, ":false"...)
				}

				i++
			}
		}

		b = append(b, '}')
		return b, nil
	}

	s := mapslicePool.Get().(*mapslice)
	if cap(s.elements) < len(m) {
		s.elements = make([]element, 0, align(10, uintptr(len(m))))
	}
	for key, val := range m {
		s.elements = append(s.elements, element{key: key, val: val})
	}
	sort.Sort(s)

	b = append(b, '{')

	for i, elem := range s.elements {
		if i != 0 {
			b = append(b, ',')
		}

		// encodeString never returns an error so we ignore it here
		b, _ = e.encodeString(b, unsafe.Pointer(&elem.key))
		if elem.val.(bool) {
			b = append(b, ":true"...)
		} else {
			b = append(b, ":false"...)
		}
	}

	for i := range s.elements {
		s.elements[i] = element{}
	}

	s.elements = s.elements[:0]
	mapslicePool.Put(s)

	b = append(b, '}')
	return b, nil
}

func (e encoder) encodeStruct(b []byte, p unsafe.Pointer, st *structType) ([]byte, error) {
	start := len(b)
	var err error
	var k string
	var n int
	b = append(b, '{')

	escapeHTML := (e.flags & EscapeHTML) != 0

	for i := range st.fields {
		f := &st.fields[i]
		v := unsafe.Pointer(uintptr(p) + f.offset)

		if f.omitempty && f.empty(v) {
			continue
		}

		if escapeHTML {
			k = f.html
		} else {
			k = f.json
		}

		lengthBeforeKey := len(b)

		if n != 0 {
			b = append(b, k...)
		} else {
			b = append(b, k[1:]...)
		}

		if b, err = f.codec.encode(e, b, v); err != nil {
			if err == (rollback{}) {
				b = b[:lengthBeforeKey]
				continue
			}
			return b[:start], err
		}

		n++
	}

	b = append(b, '}')
	return b, nil
}

type rollback struct{}

func (rollback) Error() string { return "rollback" }

func (e encoder) encodeEmbeddedStructPointer(b []byte, p unsafe.Pointer, t reflect.Type, unexported bool, offset uintptr, encode encodeFunc) ([]byte, error) {
	p = *(*unsafe.Pointer)(p)
	if p == nil {
		return b, rollback{}
	}
	return encode(e, b, unsafe.Pointer(uintptr(p)+offset))
}

func (e encoder) encodePointer(b []byte, p unsafe.Pointer, t reflect.Type, encode encodeFunc) ([]byte, error) {
	if p = *(*unsafe.Pointer)(p); p != nil {
		if e.ptrDepth++; e.ptrDepth >= startDetectingCyclesAfter {
			if _, seen := e.ptrSeen[p]; seen {
				// TODO: reconstruct the reflect.Value from p + t so we can set
				// the erorr's Value field?
				return b, &UnsupportedValueError{Str: fmt.Sprintf("encountered a cycle via %s", t)}
			}
			if e.ptrSeen == nil {
				e.ptrSeen = make(map[unsafe.Pointer]struct{})
			}
			e.ptrSeen[p] = struct{}{}
			defer delete(e.ptrSeen, p)
		}
		return encode(e, b, p)
	}
	return e.encodeNull(b, nil)
}

func (e encoder) encodeInterface(b []byte, p unsafe.Pointer) ([]byte, error) {
	return Append(b, *(*any)(p), e.flags)
}

func (e encoder) encodeMaybeEmptyInterface(b []byte, p unsafe.Pointer, t reflect.Type) ([]byte, error) {
	return Append(b, reflect.NewAt(t, p).Elem().Interface(), e.flags)
}

func (e encoder) encodeUnsupportedTypeError(b []byte, p unsafe.Pointer, t reflect.Type) ([]byte, error) {
	return b, &UnsupportedTypeError{Type: t}
}

func (e encoder) encodeRawMessage(b []byte, p unsafe.Pointer) ([]byte, error) {
	v := *(*RawMessage)(p)

	if v == nil {
		return append(b, "null"...), nil
	}

	var s []byte

	if (e.flags & TrustRawMessage) != 0 {
		s = v
	} else {
		var err error
		v = skipSpaces(v) // don't assume that a RawMessage starts with a token.
		d := decoder{}
		s, _, _, err = d.parseValue(v)
		if err != nil {
			return b, &UnsupportedValueError{Value: reflect.ValueOf(v), Str: err.Error()}
		}
	}

	if (e.flags & EscapeHTML) != 0 {
		return appendCompactEscapeHTML(b, s), nil
	}

	return append(b, s...), nil
}

func (e encoder) encodeJSONMarshaler(b []byte, p unsafe.Pointer, t reflect.Type, pointer bool) ([]byte, error) {
	v := reflect.NewAt(t, p)

	if !pointer {
		v = v.Elem()
	}

	switch v.Kind() {
	case reflect.Ptr, reflect.Interface:
		if v.IsNil() {
			return append(b, "null"...), nil
		}
	}

	j, err := v.Interface().(Marshaler).MarshalJSON()
	if err != nil {
		return b, err
	}

	d := decoder{}
	s, _, _, err := d.parseValue(j)
	if err != nil {
		return b, &MarshalerError{Type: t, Err: err}
	}

	if (e.flags & EscapeHTML) != 0 {
		return appendCompactEscapeHTML(b, s), nil
	}

	return append(b, s...), nil
}

func (e encoder) encodeTextMarshaler(b []byte, p unsafe.Pointer, t reflect.Type, pointer bool) ([]byte, error) {
	v := reflect.NewAt(t, p)

	if !pointer {
		v = v.Elem()
	}

	switch v.Kind() {
	case reflect.Ptr, reflect.Interface:
		if v.IsNil() {
			return append(b, `null`...), nil
		}
	}

	s, err := v.Interface().(encoding.TextMarshaler).MarshalText()
	if err != nil {
		return b, err
	}

	return e.encodeString(b, unsafe.Pointer(&s))
}

func appendCompactEscapeHTML(dst []byte, src []byte) []byte {
	start := 0
	escape := false
	inString := false

	for i, c := range src {
		if !inString {
			switch c {
			case '"': // enter string
				inString = true
			case ' ', '\n', '\r', '\t': // skip space
				if start < i {
					dst = append(dst, src[start:i]...)
				}
				start = i + 1
			}
			continue
		}

		if escape {
			escape = false
			continue
		}

		if c == '\\' {
			escape = true
			continue
		}

		if c == '"' {
			inString = false
			continue
		}

		if c == '<' || c == '>' || c == '&' {
			if start < i {
				dst = append(dst, src[start:i]...)
			}
			dst = append(dst, `\u00`...)
			dst = append(dst, hex[c>>4], hex[c&0xF])
			start = i + 1
			continue
		}

		// Convert U+2028 and U+2029 (E2 80 A8 and E2 80 A9).
		if c == 0xE2 && i+2 < len(src) && src[i+1] == 0x80 && src[i+2]&^1 == 0xA8 {
			if start < i {
				dst = append(dst, src[start:i]...)
			}
			dst = append(dst, `\u202`...)
			dst = append(dst, hex[src[i+2]&0xF])
			start = i + 3
			continue
		}
	}

	if start < len(src) {
		dst = append(dst, src[start:]...)
	}

	return dst
}
