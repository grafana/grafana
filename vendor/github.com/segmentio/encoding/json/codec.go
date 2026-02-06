package json

import (
	"encoding"
	"encoding/json"
	"fmt"
	"maps"
	"math/big"
	"reflect"
	"sort"
	"strconv"
	"strings"
	"sync/atomic"
	"time"
	"unicode"
	"unsafe"

	"github.com/segmentio/asm/keyset"
)

const (
	// 1000 is the value used by the standard encoding/json package.
	//
	// https://cs.opensource.google/go/go/+/refs/tags/go1.17.3:src/encoding/json/encode.go;drc=refs%2Ftags%2Fgo1.17.3;l=300
	startDetectingCyclesAfter = 1000
)

type codec struct {
	encode encodeFunc
	decode decodeFunc
}

type encoder struct {
	flags AppendFlags
	// ptrDepth tracks the depth of pointer cycles, when it reaches the value
	// of startDetectingCyclesAfter, the ptrSeen map is allocated and the
	// encoder starts tracking pointers it has seen as an attempt to detect
	// whether it has entered a pointer cycle and needs to error before the
	// goroutine runs out of stack space.
	ptrDepth uint32
	ptrSeen  map[unsafe.Pointer]struct{}
}

type decoder struct {
	flags ParseFlags
}

type (
	encodeFunc func(encoder, []byte, unsafe.Pointer) ([]byte, error)
	decodeFunc func(decoder, []byte, unsafe.Pointer) ([]byte, error)
)

type (
	emptyFunc func(unsafe.Pointer) bool
	sortFunc  func([]reflect.Value)
)

// Eventually consistent cache mapping go types to dynamically generated
// codecs.
//
// Note: using a uintptr as key instead of reflect.Type shaved ~15ns off of
// the ~30ns Marhsal/Unmarshal functions which were dominated by the map
// lookup time for simple types like bool, int, etc..
var cache atomic.Pointer[map[unsafe.Pointer]codec]

func cacheLoad() map[unsafe.Pointer]codec {
	p := cache.Load()
	if p == nil {
		return nil
	}

	return *p
}

func cacheStore(typ reflect.Type, cod codec, oldCodecs map[unsafe.Pointer]codec) {
	newCodecs := make(map[unsafe.Pointer]codec, len(oldCodecs)+1)
	maps.Copy(newCodecs, oldCodecs)
	newCodecs[typeid(typ)] = cod

	cache.Store(&newCodecs)
}

func typeid(t reflect.Type) unsafe.Pointer {
	return (*iface)(unsafe.Pointer(&t)).ptr
}

func constructCachedCodec(t reflect.Type, cache map[unsafe.Pointer]codec) codec {
	c := constructCodec(t, map[reflect.Type]*structType{}, t.Kind() == reflect.Ptr)

	if inlined(t) {
		c.encode = constructInlineValueEncodeFunc(c.encode)
	}

	cacheStore(t, c, cache)
	return c
}

func constructCodec(t reflect.Type, seen map[reflect.Type]*structType, canAddr bool) (c codec) {
	switch t {
	case nullType, nil:
		c = codec{encode: encoder.encodeNull, decode: decoder.decodeNull}

	case numberType:
		c = codec{encode: encoder.encodeNumber, decode: decoder.decodeNumber}

	case bytesType:
		c = codec{encode: encoder.encodeBytes, decode: decoder.decodeBytes}

	case durationType:
		c = codec{encode: encoder.encodeDuration, decode: decoder.decodeDuration}

	case timeType:
		c = codec{encode: encoder.encodeTime, decode: decoder.decodeTime}

	case interfaceType:
		c = codec{encode: encoder.encodeInterface, decode: decoder.decodeInterface}

	case rawMessageType:
		c = codec{encode: encoder.encodeRawMessage, decode: decoder.decodeRawMessage}

	case numberPtrType:
		c = constructPointerCodec(numberPtrType, nil)

	case durationPtrType:
		c = constructPointerCodec(durationPtrType, nil)

	case timePtrType:
		c = constructPointerCodec(timePtrType, nil)

	case rawMessagePtrType:
		c = constructPointerCodec(rawMessagePtrType, nil)
	}

	if c.encode != nil {
		return
	}

	switch t.Kind() {
	case reflect.Bool:
		c = codec{encode: encoder.encodeBool, decode: decoder.decodeBool}

	case reflect.Int:
		c = codec{encode: encoder.encodeInt, decode: decoder.decodeInt}

	case reflect.Int8:
		c = codec{encode: encoder.encodeInt8, decode: decoder.decodeInt8}

	case reflect.Int16:
		c = codec{encode: encoder.encodeInt16, decode: decoder.decodeInt16}

	case reflect.Int32:
		c = codec{encode: encoder.encodeInt32, decode: decoder.decodeInt32}

	case reflect.Int64:
		c = codec{encode: encoder.encodeInt64, decode: decoder.decodeInt64}

	case reflect.Uint:
		c = codec{encode: encoder.encodeUint, decode: decoder.decodeUint}

	case reflect.Uintptr:
		c = codec{encode: encoder.encodeUintptr, decode: decoder.decodeUintptr}

	case reflect.Uint8:
		c = codec{encode: encoder.encodeUint8, decode: decoder.decodeUint8}

	case reflect.Uint16:
		c = codec{encode: encoder.encodeUint16, decode: decoder.decodeUint16}

	case reflect.Uint32:
		c = codec{encode: encoder.encodeUint32, decode: decoder.decodeUint32}

	case reflect.Uint64:
		c = codec{encode: encoder.encodeUint64, decode: decoder.decodeUint64}

	case reflect.Float32:
		c = codec{encode: encoder.encodeFloat32, decode: decoder.decodeFloat32}

	case reflect.Float64:
		c = codec{encode: encoder.encodeFloat64, decode: decoder.decodeFloat64}

	case reflect.String:
		c = codec{encode: encoder.encodeString, decode: decoder.decodeString}

	case reflect.Interface:
		c = constructInterfaceCodec(t)

	case reflect.Array:
		c = constructArrayCodec(t, seen, canAddr)

	case reflect.Slice:
		c = constructSliceCodec(t, seen)

	case reflect.Map:
		c = constructMapCodec(t, seen)

	case reflect.Struct:
		c = constructStructCodec(t, seen, canAddr)

	case reflect.Ptr:
		c = constructPointerCodec(t, seen)

	default:
		c = constructUnsupportedTypeCodec(t)
	}

	p := reflect.PointerTo(t)

	if canAddr {
		switch {
		case p.Implements(jsonMarshalerType):
			c.encode = constructJSONMarshalerEncodeFunc(t, true)
		case p.Implements(textMarshalerType):
			c.encode = constructTextMarshalerEncodeFunc(t, true)
		}
	}

	switch {
	case t.Implements(jsonMarshalerType):
		c.encode = constructJSONMarshalerEncodeFunc(t, false)
	case t.Implements(textMarshalerType):
		c.encode = constructTextMarshalerEncodeFunc(t, false)
	}

	switch {
	case p.Implements(jsonUnmarshalerType):
		c.decode = constructJSONUnmarshalerDecodeFunc(t, true)
	case p.Implements(textUnmarshalerType):
		c.decode = constructTextUnmarshalerDecodeFunc(t, true)
	}

	return
}

func constructStringCodec(t reflect.Type, seen map[reflect.Type]*structType, canAddr bool) codec {
	c := constructCodec(t, seen, canAddr)
	return codec{
		encode: constructStringEncodeFunc(c.encode),
		decode: constructStringDecodeFunc(c.decode),
	}
}

func constructStringEncodeFunc(encode encodeFunc) encodeFunc {
	return func(e encoder, b []byte, p unsafe.Pointer) ([]byte, error) {
		return e.encodeToString(b, p, encode)
	}
}

func constructStringDecodeFunc(decode decodeFunc) decodeFunc {
	return func(d decoder, b []byte, p unsafe.Pointer) ([]byte, error) {
		return d.decodeFromString(b, p, decode)
	}
}

func constructStringToIntDecodeFunc(t reflect.Type, decode decodeFunc) decodeFunc {
	return func(d decoder, b []byte, p unsafe.Pointer) ([]byte, error) {
		return d.decodeFromStringToInt(b, p, t, decode)
	}
}

func constructArrayCodec(t reflect.Type, seen map[reflect.Type]*structType, canAddr bool) codec {
	e := t.Elem()
	c := constructCodec(e, seen, canAddr)
	s := alignedSize(e)
	return codec{
		encode: constructArrayEncodeFunc(s, t, c.encode),
		decode: constructArrayDecodeFunc(s, t, c.decode),
	}
}

func constructArrayEncodeFunc(size uintptr, t reflect.Type, encode encodeFunc) encodeFunc {
	n := t.Len()
	return func(e encoder, b []byte, p unsafe.Pointer) ([]byte, error) {
		return e.encodeArray(b, p, n, size, t, encode)
	}
}

func constructArrayDecodeFunc(size uintptr, t reflect.Type, decode decodeFunc) decodeFunc {
	n := t.Len()
	return func(d decoder, b []byte, p unsafe.Pointer) ([]byte, error) {
		return d.decodeArray(b, p, n, size, t, decode)
	}
}

func constructSliceCodec(t reflect.Type, seen map[reflect.Type]*structType) codec {
	e := t.Elem()
	s := alignedSize(e)

	if e.Kind() == reflect.Uint8 {
		// Go 1.7+ behavior: slices of byte types (and aliases) may override the
		// default encoding and decoding behaviors by implementing marshaler and
		// unmarshaler interfaces.
		p := reflect.PointerTo(e)
		c := codec{}

		switch {
		case e.Implements(jsonMarshalerType):
			c.encode = constructJSONMarshalerEncodeFunc(e, false)
		case e.Implements(textMarshalerType):
			c.encode = constructTextMarshalerEncodeFunc(e, false)
		case p.Implements(jsonMarshalerType):
			c.encode = constructJSONMarshalerEncodeFunc(e, true)
		case p.Implements(textMarshalerType):
			c.encode = constructTextMarshalerEncodeFunc(e, true)
		}

		switch {
		case e.Implements(jsonUnmarshalerType):
			c.decode = constructJSONUnmarshalerDecodeFunc(e, false)
		case e.Implements(textUnmarshalerType):
			c.decode = constructTextUnmarshalerDecodeFunc(e, false)
		case p.Implements(jsonUnmarshalerType):
			c.decode = constructJSONUnmarshalerDecodeFunc(e, true)
		case p.Implements(textUnmarshalerType):
			c.decode = constructTextUnmarshalerDecodeFunc(e, true)
		}

		if c.encode != nil {
			c.encode = constructSliceEncodeFunc(s, t, c.encode)
		} else {
			c.encode = encoder.encodeBytes
		}

		if c.decode != nil {
			c.decode = constructSliceDecodeFunc(s, t, c.decode)
		} else {
			c.decode = decoder.decodeBytes
		}

		return c
	}

	c := constructCodec(e, seen, true)
	return codec{
		encode: constructSliceEncodeFunc(s, t, c.encode),
		decode: constructSliceDecodeFunc(s, t, c.decode),
	}
}

func constructSliceEncodeFunc(size uintptr, t reflect.Type, encode encodeFunc) encodeFunc {
	return func(e encoder, b []byte, p unsafe.Pointer) ([]byte, error) {
		return e.encodeSlice(b, p, size, t, encode)
	}
}

func constructSliceDecodeFunc(size uintptr, t reflect.Type, decode decodeFunc) decodeFunc {
	return func(d decoder, b []byte, p unsafe.Pointer) ([]byte, error) {
		return d.decodeSlice(b, p, size, t, decode)
	}
}

func constructMapCodec(t reflect.Type, seen map[reflect.Type]*structType) codec {
	var sortKeys sortFunc
	k := t.Key()
	v := t.Elem()

	// Faster implementations for some common cases.
	switch {
	case k == stringType && v == interfaceType:
		return codec{
			encode: encoder.encodeMapStringInterface,
			decode: decoder.decodeMapStringInterface,
		}

	case k == stringType && v == rawMessageType:
		return codec{
			encode: encoder.encodeMapStringRawMessage,
			decode: decoder.decodeMapStringRawMessage,
		}

	case k == stringType && v == stringType:
		return codec{
			encode: encoder.encodeMapStringString,
			decode: decoder.decodeMapStringString,
		}

	case k == stringType && v == stringsType:
		return codec{
			encode: encoder.encodeMapStringStringSlice,
			decode: decoder.decodeMapStringStringSlice,
		}

	case k == stringType && v == boolType:
		return codec{
			encode: encoder.encodeMapStringBool,
			decode: decoder.decodeMapStringBool,
		}
	}

	kc := codec{}
	vc := constructCodec(v, seen, false)

	if k.Implements(textMarshalerType) || reflect.PointerTo(k).Implements(textUnmarshalerType) {
		kc.encode = constructTextMarshalerEncodeFunc(k, false)
		kc.decode = constructTextUnmarshalerDecodeFunc(k, true)

		sortKeys = func(keys []reflect.Value) {
			sort.Slice(keys, func(i, j int) bool {
				// This is a performance abomination but the use case is rare
				// enough that it shouldn't be a problem in practice.
				k1, _ := keys[i].Interface().(encoding.TextMarshaler).MarshalText()
				k2, _ := keys[j].Interface().(encoding.TextMarshaler).MarshalText()
				return string(k1) < string(k2)
			})
		}
	} else {
		switch k.Kind() {
		case reflect.String:
			kc.encode = encoder.encodeString
			kc.decode = decoder.decodeString

			sortKeys = func(keys []reflect.Value) {
				sort.Slice(keys, func(i, j int) bool { return keys[i].String() < keys[j].String() })
			}

		case reflect.Int,
			reflect.Int8,
			reflect.Int16,
			reflect.Int32,
			reflect.Int64:
			kc = constructStringCodec(k, seen, false)

			sortKeys = func(keys []reflect.Value) {
				sort.Slice(keys, func(i, j int) bool { return intStringsAreSorted(keys[i].Int(), keys[j].Int()) })
			}

		case reflect.Uint,
			reflect.Uintptr,
			reflect.Uint8,
			reflect.Uint16,
			reflect.Uint32,
			reflect.Uint64:
			kc = constructStringCodec(k, seen, false)

			sortKeys = func(keys []reflect.Value) {
				sort.Slice(keys, func(i, j int) bool { return uintStringsAreSorted(keys[i].Uint(), keys[j].Uint()) })
			}

		default:
			return constructUnsupportedTypeCodec(t)
		}
	}

	if inlined(v) {
		vc.encode = constructInlineValueEncodeFunc(vc.encode)
	}

	return codec{
		encode: constructMapEncodeFunc(t, kc.encode, vc.encode, sortKeys),
		decode: constructMapDecodeFunc(t, kc.decode, vc.decode),
	}
}

func constructMapEncodeFunc(t reflect.Type, encodeKey, encodeValue encodeFunc, sortKeys sortFunc) encodeFunc {
	return func(e encoder, b []byte, p unsafe.Pointer) ([]byte, error) {
		return e.encodeMap(b, p, t, encodeKey, encodeValue, sortKeys)
	}
}

func constructMapDecodeFunc(t reflect.Type, decodeKey, decodeValue decodeFunc) decodeFunc {
	kt := t.Key()
	vt := t.Elem()
	kz := reflect.Zero(kt)
	vz := reflect.Zero(vt)
	return func(d decoder, b []byte, p unsafe.Pointer) ([]byte, error) {
		return d.decodeMap(b, p, t, kt, vt, kz, vz, decodeKey, decodeValue)
	}
}

func constructStructCodec(t reflect.Type, seen map[reflect.Type]*structType, canAddr bool) codec {
	st := constructStructType(t, seen, canAddr)
	return codec{
		encode: constructStructEncodeFunc(st),
		decode: constructStructDecodeFunc(st),
	}
}

func constructStructType(t reflect.Type, seen map[reflect.Type]*structType, canAddr bool) *structType {
	// Used for preventing infinite recursion on types that have pointers to
	// themselves.
	st := seen[t]

	if st == nil {
		st = &structType{
			fields:      make([]structField, 0, t.NumField()),
			fieldsIndex: make(map[string]*structField),
			ficaseIndex: make(map[string]*structField),
			typ:         t,
		}

		seen[t] = st
		st.fields = appendStructFields(st.fields, t, 0, seen, canAddr)

		for i := range st.fields {
			f := &st.fields[i]
			s := strings.ToLower(f.name)
			st.fieldsIndex[f.name] = f
			// When there is ambiguity because multiple fields have the same
			// case-insensitive representation, the first field must win.
			if _, exists := st.ficaseIndex[s]; !exists {
				st.ficaseIndex[s] = f
			}
		}

		// At a certain point the linear scan provided by keyset is less
		// efficient than a map. The 32 was chosen based on benchmarks in the
		// segmentio/asm repo run with an Intel Kaby Lake processor and go1.17.
		if len(st.fields) <= 32 {
			keys := make([][]byte, len(st.fields))
			for i, f := range st.fields {
				keys[i] = []byte(f.name)
			}
			st.keyset = keyset.New(keys)
		}
	}

	return st
}

func constructStructEncodeFunc(st *structType) encodeFunc {
	return func(e encoder, b []byte, p unsafe.Pointer) ([]byte, error) {
		return e.encodeStruct(b, p, st)
	}
}

func constructStructDecodeFunc(st *structType) decodeFunc {
	return func(d decoder, b []byte, p unsafe.Pointer) ([]byte, error) {
		return d.decodeStruct(b, p, st)
	}
}

func constructEmbeddedStructPointerCodec(t reflect.Type, unexported bool, offset uintptr, field codec) codec {
	return codec{
		encode: constructEmbeddedStructPointerEncodeFunc(t, unexported, offset, field.encode),
		decode: constructEmbeddedStructPointerDecodeFunc(t, unexported, offset, field.decode),
	}
}

func constructEmbeddedStructPointerEncodeFunc(t reflect.Type, unexported bool, offset uintptr, encode encodeFunc) encodeFunc {
	return func(e encoder, b []byte, p unsafe.Pointer) ([]byte, error) {
		return e.encodeEmbeddedStructPointer(b, p, t, unexported, offset, encode)
	}
}

func constructEmbeddedStructPointerDecodeFunc(t reflect.Type, unexported bool, offset uintptr, decode decodeFunc) decodeFunc {
	return func(d decoder, b []byte, p unsafe.Pointer) ([]byte, error) {
		return d.decodeEmbeddedStructPointer(b, p, t, unexported, offset, decode)
	}
}

func appendStructFields(fields []structField, t reflect.Type, offset uintptr, seen map[reflect.Type]*structType, canAddr bool) []structField {
	type embeddedField struct {
		index      int
		offset     uintptr
		pointer    bool
		unexported bool
		subtype    *structType
		subfield   *structField
	}

	names := make(map[string]struct{})
	embedded := make([]embeddedField, 0, 10)

	for i := range t.NumField() {
		f := t.Field(i)

		var (
			name       = f.Name
			anonymous  = f.Anonymous
			tag        = false
			omitempty  = false
			stringify  = false
			unexported = len(f.PkgPath) != 0
		)

		if unexported && !anonymous { // unexported
			continue
		}

		if parts := strings.Split(f.Tag.Get("json"), ","); len(parts) != 0 {
			if len(parts[0]) != 0 {
				name, tag = parts[0], true
			}

			if name == "-" && len(parts) == 1 { // ignored
				continue
			}

			if !isValidTag(name) {
				name = f.Name
			}

			for _, tag := range parts[1:] {
				switch tag {
				case "omitempty":
					omitempty = true
				case "string":
					stringify = true
				}
			}
		}

		if anonymous && !tag { // embedded
			typ := f.Type
			ptr := f.Type.Kind() == reflect.Ptr

			if ptr {
				typ = f.Type.Elem()
			}

			if typ.Kind() == reflect.Struct {
				// When the embedded fields is inlined the fields can be looked
				// up by offset from the address of the wrapping object, so we
				// simply add the embedded struct fields to the list of fields
				// of the current struct type.
				subtype := constructStructType(typ, seen, canAddr)

				for j := range subtype.fields {
					embedded = append(embedded, embeddedField{
						index:      i<<32 | j,
						offset:     offset + f.Offset,
						pointer:    ptr,
						unexported: unexported,
						subtype:    subtype,
						subfield:   &subtype.fields[j],
					})
				}

				continue
			}

			if unexported { // ignore unexported non-struct types
				continue
			}
		}

		codec := constructCodec(f.Type, seen, canAddr)

		if stringify {
			// https://golang.org/pkg/encoding/json/#Marshal
			//
			// The "string" option signals that a field is stored as JSON inside
			// a JSON-encoded string. It applies only to fields of string,
			// floating point, integer, or boolean types. This extra level of
			// encoding is sometimes used when communicating with JavaScript
			// programs:
			typ := f.Type

			if typ.Kind() == reflect.Ptr {
				typ = typ.Elem()
			}

			switch typ.Kind() {
			case reflect.Int,
				reflect.Int8,
				reflect.Int16,
				reflect.Int32,
				reflect.Int64,
				reflect.Uint,
				reflect.Uintptr,
				reflect.Uint8,
				reflect.Uint16,
				reflect.Uint32,
				reflect.Uint64:
				codec.encode = constructStringEncodeFunc(codec.encode)
				codec.decode = constructStringToIntDecodeFunc(typ, codec.decode)
			case reflect.Bool,
				reflect.Float32,
				reflect.Float64,
				reflect.String:
				codec.encode = constructStringEncodeFunc(codec.encode)
				codec.decode = constructStringDecodeFunc(codec.decode)
			}
		}

		fields = append(fields, structField{
			codec:     codec,
			offset:    offset + f.Offset,
			empty:     emptyFuncOf(f.Type),
			tag:       tag,
			omitempty: omitempty,
			name:      name,
			index:     i << 32,
			typ:       f.Type,
			zero:      reflect.Zero(f.Type),
		})

		names[name] = struct{}{}
	}

	// Only unambiguous embedded fields must be serialized.
	ambiguousNames := make(map[string]int)
	ambiguousTags := make(map[string]int)

	// Embedded types can never override a field that was already present at
	// the top-level.
	for name := range names {
		ambiguousNames[name]++
		ambiguousTags[name]++
	}

	for _, embfield := range embedded {
		ambiguousNames[embfield.subfield.name]++
		if embfield.subfield.tag {
			ambiguousTags[embfield.subfield.name]++
		}
	}

	for _, embfield := range embedded {
		subfield := *embfield.subfield

		if ambiguousNames[subfield.name] > 1 && (!subfield.tag || ambiguousTags[subfield.name] != 1) {
			continue // ambiguous embedded field
		}

		if embfield.pointer {
			subfield.codec = constructEmbeddedStructPointerCodec(embfield.subtype.typ, embfield.unexported, subfield.offset, subfield.codec)
			subfield.offset = embfield.offset
		} else {
			subfield.offset += embfield.offset
		}

		// To prevent dominant flags more than one level below the embedded one.
		subfield.tag = false

		// To ensure the order of the fields in the output is the same is in the
		// struct type.
		subfield.index = embfield.index

		fields = append(fields, subfield)
	}

	for i := range fields {
		name := fields[i].name
		fields[i].json = encodeKeyFragment(name, 0)
		fields[i].html = encodeKeyFragment(name, EscapeHTML)
	}

	sort.Slice(fields, func(i, j int) bool { return fields[i].index < fields[j].index })
	return fields
}

func encodeKeyFragment(s string, flags AppendFlags) string {
	b := make([]byte, 1, len(s)+4)
	b[0] = ','
	e := encoder{flags: flags}
	b, _ = e.encodeString(b, unsafe.Pointer(&s))
	b = append(b, ':')
	return *(*string)(unsafe.Pointer(&b))
}

func constructPointerCodec(t reflect.Type, seen map[reflect.Type]*structType) codec {
	e := t.Elem()
	c := constructCodec(e, seen, true)
	return codec{
		encode: constructPointerEncodeFunc(e, c.encode),
		decode: constructPointerDecodeFunc(e, c.decode),
	}
}

func constructPointerEncodeFunc(t reflect.Type, encode encodeFunc) encodeFunc {
	return func(e encoder, b []byte, p unsafe.Pointer) ([]byte, error) {
		return e.encodePointer(b, p, t, encode)
	}
}

func constructPointerDecodeFunc(t reflect.Type, decode decodeFunc) decodeFunc {
	return func(d decoder, b []byte, p unsafe.Pointer) ([]byte, error) {
		return d.decodePointer(b, p, t, decode)
	}
}

func constructInterfaceCodec(t reflect.Type) codec {
	return codec{
		encode: constructMaybeEmptyInterfaceEncoderFunc(t),
		decode: constructMaybeEmptyInterfaceDecoderFunc(t),
	}
}

func constructMaybeEmptyInterfaceEncoderFunc(t reflect.Type) encodeFunc {
	return func(e encoder, b []byte, p unsafe.Pointer) ([]byte, error) {
		return e.encodeMaybeEmptyInterface(b, p, t)
	}
}

func constructMaybeEmptyInterfaceDecoderFunc(t reflect.Type) decodeFunc {
	return func(d decoder, b []byte, p unsafe.Pointer) ([]byte, error) {
		return d.decodeMaybeEmptyInterface(b, p, t)
	}
}

func constructUnsupportedTypeCodec(t reflect.Type) codec {
	return codec{
		encode: constructUnsupportedTypeEncodeFunc(t),
		decode: constructUnsupportedTypeDecodeFunc(t),
	}
}

func constructUnsupportedTypeEncodeFunc(t reflect.Type) encodeFunc {
	return func(e encoder, b []byte, p unsafe.Pointer) ([]byte, error) {
		return e.encodeUnsupportedTypeError(b, p, t)
	}
}

func constructUnsupportedTypeDecodeFunc(t reflect.Type) decodeFunc {
	return func(d decoder, b []byte, p unsafe.Pointer) ([]byte, error) {
		return d.decodeUnmarshalTypeError(b, p, t)
	}
}

func constructJSONMarshalerEncodeFunc(t reflect.Type, pointer bool) encodeFunc {
	return func(e encoder, b []byte, p unsafe.Pointer) ([]byte, error) {
		return e.encodeJSONMarshaler(b, p, t, pointer)
	}
}

func constructJSONUnmarshalerDecodeFunc(t reflect.Type, pointer bool) decodeFunc {
	return func(d decoder, b []byte, p unsafe.Pointer) ([]byte, error) {
		return d.decodeJSONUnmarshaler(b, p, t, pointer)
	}
}

func constructTextMarshalerEncodeFunc(t reflect.Type, pointer bool) encodeFunc {
	return func(e encoder, b []byte, p unsafe.Pointer) ([]byte, error) {
		return e.encodeTextMarshaler(b, p, t, pointer)
	}
}

func constructTextUnmarshalerDecodeFunc(t reflect.Type, pointer bool) decodeFunc {
	return func(d decoder, b []byte, p unsafe.Pointer) ([]byte, error) {
		return d.decodeTextUnmarshaler(b, p, t, pointer)
	}
}

func constructInlineValueEncodeFunc(encode encodeFunc) encodeFunc {
	return func(e encoder, b []byte, p unsafe.Pointer) ([]byte, error) {
		return encode(e, b, noescape(unsafe.Pointer(&p)))
	}
}

// noescape hides a pointer from escape analysis.  noescape is
// the identity function but escape analysis doesn't think the
// output depends on the input. noescape is inlined and currently
// compiles down to zero instructions.
// USE CAREFULLY!
// This was copied from the runtime; see issues 23382 and 7921.
//
//go:nosplit
func noescape(p unsafe.Pointer) unsafe.Pointer {
	x := uintptr(p)
	return unsafe.Pointer(x ^ 0)
}

func alignedSize(t reflect.Type) uintptr {
	a := t.Align()
	s := t.Size()
	return align(uintptr(a), uintptr(s))
}

func align(align, size uintptr) uintptr {
	if align != 0 && (size%align) != 0 {
		size = ((size / align) + 1) * align
	}
	return size
}

func inlined(t reflect.Type) bool {
	switch t.Kind() {
	case reflect.Ptr:
		return true
	case reflect.Map:
		return true
	case reflect.Struct:
		return t.NumField() == 1 && inlined(t.Field(0).Type)
	default:
		return false
	}
}

func isValidTag(s string) bool {
	if s == "" {
		return false
	}
	for _, c := range s {
		switch {
		case strings.ContainsRune("!#$%&()*+-./:;<=>?@[]^_{|}~ ", c):
			// Backslash and quote chars are reserved, but
			// otherwise any punctuation chars are allowed
			// in a tag name.
		default:
			if !unicode.IsLetter(c) && !unicode.IsDigit(c) {
				return false
			}
		}
	}
	return true
}

func emptyFuncOf(t reflect.Type) emptyFunc {
	switch t {
	case bytesType, rawMessageType:
		return func(p unsafe.Pointer) bool { return (*slice)(p).len == 0 }
	}

	switch t.Kind() {
	case reflect.Array:
		if t.Len() == 0 {
			return func(unsafe.Pointer) bool { return true }
		}

	case reflect.Map:
		return func(p unsafe.Pointer) bool { return reflect.NewAt(t, p).Elem().Len() == 0 }

	case reflect.Slice:
		return func(p unsafe.Pointer) bool { return (*slice)(p).len == 0 }

	case reflect.String:
		return func(p unsafe.Pointer) bool { return len(*(*string)(p)) == 0 }

	case reflect.Bool:
		return func(p unsafe.Pointer) bool { return !*(*bool)(p) }

	case reflect.Int, reflect.Uint:
		return func(p unsafe.Pointer) bool { return *(*uint)(p) == 0 }

	case reflect.Uintptr:
		return func(p unsafe.Pointer) bool { return *(*uintptr)(p) == 0 }

	case reflect.Int8, reflect.Uint8:
		return func(p unsafe.Pointer) bool { return *(*uint8)(p) == 0 }

	case reflect.Int16, reflect.Uint16:
		return func(p unsafe.Pointer) bool { return *(*uint16)(p) == 0 }

	case reflect.Int32, reflect.Uint32:
		return func(p unsafe.Pointer) bool { return *(*uint32)(p) == 0 }

	case reflect.Int64, reflect.Uint64:
		return func(p unsafe.Pointer) bool { return *(*uint64)(p) == 0 }

	case reflect.Float32:
		return func(p unsafe.Pointer) bool { return *(*float32)(p) == 0 }

	case reflect.Float64:
		return func(p unsafe.Pointer) bool { return *(*float64)(p) == 0 }

	case reflect.Ptr:
		return func(p unsafe.Pointer) bool { return *(*unsafe.Pointer)(p) == nil }

	case reflect.Interface:
		return func(p unsafe.Pointer) bool { return (*iface)(p).ptr == nil }
	}

	return func(unsafe.Pointer) bool { return false }
}

type iface struct {
	typ unsafe.Pointer
	ptr unsafe.Pointer
}

type slice struct {
	data unsafe.Pointer
	len  int
	cap  int
}

type structType struct {
	fields      []structField
	fieldsIndex map[string]*structField
	ficaseIndex map[string]*structField
	keyset      []byte
	typ         reflect.Type
}

type structField struct {
	codec     codec
	offset    uintptr
	empty     emptyFunc
	tag       bool
	omitempty bool
	json      string
	html      string
	name      string
	typ       reflect.Type
	zero      reflect.Value
	index     int
}

func unmarshalTypeError(b []byte, t reflect.Type) error {
	return &UnmarshalTypeError{Value: strconv.Quote(prefix(b)), Type: t}
}

func unmarshalOverflow(b []byte, t reflect.Type) error {
	return &UnmarshalTypeError{Value: "number " + prefix(b) + " overflows", Type: t}
}

func unexpectedEOF(b []byte) error {
	return syntaxError(b, "unexpected end of JSON input")
}

var syntaxErrorMsgOffset = ^uintptr(0)

func init() {
	t := reflect.TypeOf(SyntaxError{})
	for i := range t.NumField() {
		if f := t.Field(i); f.Type.Kind() == reflect.String {
			syntaxErrorMsgOffset = f.Offset
		}
	}
}

func syntaxError(b []byte, msg string, args ...any) error {
	e := new(SyntaxError)
	i := syntaxErrorMsgOffset
	if i != ^uintptr(0) {
		s := "json: " + fmt.Sprintf(msg, args...) + ": " + prefix(b)
		p := unsafe.Pointer(e)
		// Hack to set the unexported `msg` field.
		*(*string)(unsafe.Pointer(uintptr(p) + i)) = s
	}
	return e
}

func objectKeyError(b []byte, err error) ([]byte, error) {
	if len(b) == 0 {
		return nil, unexpectedEOF(b)
	}
	switch err.(type) {
	case *UnmarshalTypeError:
		err = syntaxError(b, "invalid character '%c' looking for beginning of object key", b[0])
	}
	return b, err
}

func prefix(b []byte) string {
	if len(b) < 32 {
		return string(b)
	}
	return string(b[:32]) + "..."
}

func intStringsAreSorted(i0, i1 int64) bool {
	var b0, b1 [32]byte
	return string(strconv.AppendInt(b0[:0], i0, 10)) < string(strconv.AppendInt(b1[:0], i1, 10))
}

func uintStringsAreSorted(u0, u1 uint64) bool {
	var b0, b1 [32]byte
	return string(strconv.AppendUint(b0[:0], u0, 10)) < string(strconv.AppendUint(b1[:0], u1, 10))
}

func stringToBytes(s string) []byte {
	return *(*[]byte)(unsafe.Pointer(&sliceHeader{
		Data: *(*unsafe.Pointer)(unsafe.Pointer(&s)),
		Len:  len(s),
		Cap:  len(s),
	}))
}

type sliceHeader struct {
	Data unsafe.Pointer
	Len  int
	Cap  int
}

var (
	nullType = reflect.TypeOf(nil)
	boolType = reflect.TypeOf(false)

	intType   = reflect.TypeOf(int(0))
	int8Type  = reflect.TypeOf(int8(0))
	int16Type = reflect.TypeOf(int16(0))
	int32Type = reflect.TypeOf(int32(0))
	int64Type = reflect.TypeOf(int64(0))

	uintType    = reflect.TypeOf(uint(0))
	uint8Type   = reflect.TypeOf(uint8(0))
	uint16Type  = reflect.TypeOf(uint16(0))
	uint32Type  = reflect.TypeOf(uint32(0))
	uint64Type  = reflect.TypeOf(uint64(0))
	uintptrType = reflect.TypeOf(uintptr(0))

	float32Type = reflect.TypeOf(float32(0))
	float64Type = reflect.TypeOf(float64(0))

	bigIntType     = reflect.TypeOf(new(big.Int))
	numberType     = reflect.TypeOf(json.Number(""))
	stringType     = reflect.TypeOf("")
	stringsType    = reflect.TypeOf([]string(nil))
	bytesType      = reflect.TypeOf(([]byte)(nil))
	durationType   = reflect.TypeOf(time.Duration(0))
	timeType       = reflect.TypeOf(time.Time{})
	rawMessageType = reflect.TypeOf(RawMessage(nil))

	numberPtrType     = reflect.PointerTo(numberType)
	durationPtrType   = reflect.PointerTo(durationType)
	timePtrType       = reflect.PointerTo(timeType)
	rawMessagePtrType = reflect.PointerTo(rawMessageType)

	sliceInterfaceType       = reflect.TypeOf(([]any)(nil))
	sliceStringType          = reflect.TypeOf(([]any)(nil))
	mapStringInterfaceType   = reflect.TypeOf((map[string]any)(nil))
	mapStringRawMessageType  = reflect.TypeOf((map[string]RawMessage)(nil))
	mapStringStringType      = reflect.TypeOf((map[string]string)(nil))
	mapStringStringSliceType = reflect.TypeOf((map[string][]string)(nil))
	mapStringBoolType        = reflect.TypeOf((map[string]bool)(nil))

	interfaceType       = reflect.TypeOf((*any)(nil)).Elem()
	jsonMarshalerType   = reflect.TypeOf((*Marshaler)(nil)).Elem()
	jsonUnmarshalerType = reflect.TypeOf((*Unmarshaler)(nil)).Elem()
	textMarshalerType   = reflect.TypeOf((*encoding.TextMarshaler)(nil)).Elem()
	textUnmarshalerType = reflect.TypeOf((*encoding.TextUnmarshaler)(nil)).Elem()

	bigIntDecoder = constructJSONUnmarshalerDecodeFunc(bigIntType, false)
)

// =============================================================================
// Copyright 2009 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// appendDuration appends a human-readable representation of d to b.
//
// The function copies the implementation of time.Duration.String but prevents
// Go from making a dynamic memory allocation on the returned value.
func appendDuration(b []byte, d time.Duration) []byte {
	// Largest time is 2540400h10m10.000000000s
	var buf [32]byte
	w := len(buf)

	u := uint64(d)
	neg := d < 0
	if neg {
		u = -u
	}

	if u < uint64(time.Second) {
		// Special case: if duration is smaller than a second,
		// use smaller units, like 1.2ms
		var prec int
		w--
		buf[w] = 's'
		w--
		switch {
		case u == 0:
			return append(b, '0', 's')
		case u < uint64(time.Microsecond):
			// print nanoseconds
			prec = 0
			buf[w] = 'n'
		case u < uint64(time.Millisecond):
			// print microseconds
			prec = 3
			// U+00B5 'µ' micro sign == 0xC2 0xB5
			w-- // Need room for two bytes.
			copy(buf[w:], "µ")
		default:
			// print milliseconds
			prec = 6
			buf[w] = 'm'
		}
		w, u = fmtFrac(buf[:w], u, prec)
		w = fmtInt(buf[:w], u)
	} else {
		w--
		buf[w] = 's'

		w, u = fmtFrac(buf[:w], u, 9)

		// u is now integer seconds
		w = fmtInt(buf[:w], u%60)
		u /= 60

		// u is now integer minutes
		if u > 0 {
			w--
			buf[w] = 'm'
			w = fmtInt(buf[:w], u%60)
			u /= 60

			// u is now integer hours
			// Stop at hours because days can be different lengths.
			if u > 0 {
				w--
				buf[w] = 'h'
				w = fmtInt(buf[:w], u)
			}
		}
	}

	if neg {
		w--
		buf[w] = '-'
	}

	return append(b, buf[w:]...)
}

// fmtFrac formats the fraction of v/10**prec (e.g., ".12345") into the
// tail of buf, omitting trailing zeros.  it omits the decimal
// point too when the fraction is 0.  It returns the index where the
// output bytes begin and the value v/10**prec.
func fmtFrac(buf []byte, v uint64, prec int) (nw int, nv uint64) {
	// Omit trailing zeros up to and including decimal point.
	w := len(buf)
	print := false
	for range prec {
		digit := v % 10
		print = print || digit != 0
		if print {
			w--
			buf[w] = byte(digit) + '0'
		}
		v /= 10
	}
	if print {
		w--
		buf[w] = '.'
	}
	return w, v
}

// fmtInt formats v into the tail of buf.
// It returns the index where the output begins.
func fmtInt(buf []byte, v uint64) int {
	w := len(buf)
	if v == 0 {
		w--
		buf[w] = '0'
	} else {
		for v > 0 {
			w--
			buf[w] = byte(v%10) + '0'
			v /= 10
		}
	}
	return w
}

// =============================================================================
