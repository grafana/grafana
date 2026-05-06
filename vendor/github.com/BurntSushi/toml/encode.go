package toml

import (
	"bufio"
	"bytes"
	"encoding"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"reflect"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/BurntSushi/toml/internal"
)

type tomlEncodeError struct{ error }

var (
	errArrayNilElement = errors.New("toml: cannot encode array with nil element")
	errNonString       = errors.New("toml: cannot encode a map with non-string key type")
	errNoKey           = errors.New("toml: top-level values must be Go maps or structs")
	errAnything        = errors.New("") // used in testing
)

var dblQuotedReplacer = strings.NewReplacer(
	"\"", "\\\"",
	"\\", "\\\\",
	"\x00", `\u0000`,
	"\x01", `\u0001`,
	"\x02", `\u0002`,
	"\x03", `\u0003`,
	"\x04", `\u0004`,
	"\x05", `\u0005`,
	"\x06", `\u0006`,
	"\x07", `\u0007`,
	"\b", `\b`,
	"\t", `\t`,
	"\n", `\n`,
	"\x0b", `\u000b`,
	"\f", `\f`,
	"\r", `\r`,
	"\x0e", `\u000e`,
	"\x0f", `\u000f`,
	"\x10", `\u0010`,
	"\x11", `\u0011`,
	"\x12", `\u0012`,
	"\x13", `\u0013`,
	"\x14", `\u0014`,
	"\x15", `\u0015`,
	"\x16", `\u0016`,
	"\x17", `\u0017`,
	"\x18", `\u0018`,
	"\x19", `\u0019`,
	"\x1a", `\u001a`,
	"\x1b", `\u001b`,
	"\x1c", `\u001c`,
	"\x1d", `\u001d`,
	"\x1e", `\u001e`,
	"\x1f", `\u001f`,
	"\x7f", `\u007f`,
)

var (
	marshalToml = reflect.TypeOf((*Marshaler)(nil)).Elem()
	marshalText = reflect.TypeOf((*encoding.TextMarshaler)(nil)).Elem()
	timeType    = reflect.TypeOf((*time.Time)(nil)).Elem()
)

// Marshaler is the interface implemented by types that can marshal themselves
// into valid TOML.
type Marshaler interface {
	MarshalTOML() ([]byte, error)
}

// Marshal returns a TOML representation of the Go value.
//
// See [Encoder] for a description of the encoding process.
func Marshal(v any) ([]byte, error) {
	buff := new(bytes.Buffer)
	if err := NewEncoder(buff).Encode(v); err != nil {
		return nil, err
	}
	return buff.Bytes(), nil
}

// Encoder encodes a Go to a TOML document.
//
// The mapping between Go values and TOML values should be precisely the same as
// for [Decode].
//
// time.Time is encoded as a RFC 3339 string, and time.Duration as its string
// representation.
//
// The [Marshaler] and [encoding.TextMarshaler] interfaces are supported to
// encoding the value as custom TOML.
//
// If you want to write arbitrary binary data then you will need to use
// something like base64 since TOML does not have any binary types.
//
// When encoding TOML hashes (Go maps or structs), keys without any sub-hashes
// are encoded first.
//
// Go maps will be sorted alphabetically by key for deterministic output.
//
// The toml struct tag can be used to provide the key name; if omitted the
// struct field name will be used. If the "omitempty" option is present the
// following value will be skipped:
//
//   - arrays, slices, maps, and string with len of 0
//   - struct with all zero values
//   - bool false
//
// If omitzero is given all int and float types with a value of 0 will be
// skipped.
//
// Encoding Go values without a corresponding TOML representation will return an
// error. Examples of this includes maps with non-string keys, slices with nil
// elements, embedded non-struct types, and nested slices containing maps or
// structs. (e.g. [][]map[string]string is not allowed but []map[string]string
// is okay, as is []map[string][]string).
//
// NOTE: only exported keys are encoded due to the use of reflection. Unexported
// keys are silently discarded.
type Encoder struct {
	Indent     string // string for a single indentation level; default is two spaces.
	hasWritten bool   // written any output to w yet?
	w          *bufio.Writer
}

// NewEncoder create a new Encoder.
func NewEncoder(w io.Writer) *Encoder {
	return &Encoder{w: bufio.NewWriter(w), Indent: "  "}
}

// Encode writes a TOML representation of the Go value to the [Encoder]'s writer.
//
// An error is returned if the value given cannot be encoded to a valid TOML
// document.
func (enc *Encoder) Encode(v any) error {
	rv := eindirect(reflect.ValueOf(v))
	err := enc.safeEncode(Key([]string{}), rv)
	if err != nil {
		return err
	}
	return enc.w.Flush()
}

func (enc *Encoder) safeEncode(key Key, rv reflect.Value) (err error) {
	defer func() {
		if r := recover(); r != nil {
			if terr, ok := r.(tomlEncodeError); ok {
				err = terr.error
				return
			}
			panic(r)
		}
	}()
	enc.encode(key, rv)
	return nil
}

func (enc *Encoder) encode(key Key, rv reflect.Value) {
	// If we can marshal the type to text, then we use that. This prevents the
	// encoder for handling these types as generic structs (or whatever the
	// underlying type of a TextMarshaler is).
	switch {
	case isMarshaler(rv):
		enc.writeKeyValue(key, rv, false)
		return
	case rv.Type() == primitiveType: // TODO: #76 would make this superfluous after implemented.
		enc.encode(key, reflect.ValueOf(rv.Interface().(Primitive).undecoded))
		return
	}

	k := rv.Kind()
	switch k {
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32,
		reflect.Int64,
		reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32,
		reflect.Uint64,
		reflect.Float32, reflect.Float64, reflect.String, reflect.Bool:
		enc.writeKeyValue(key, rv, false)
	case reflect.Array, reflect.Slice:
		if typeEqual(tomlArrayHash, tomlTypeOfGo(rv)) {
			enc.eArrayOfTables(key, rv)
		} else {
			enc.writeKeyValue(key, rv, false)
		}
	case reflect.Interface:
		if rv.IsNil() {
			return
		}
		enc.encode(key, rv.Elem())
	case reflect.Map:
		if rv.IsNil() {
			return
		}
		enc.eTable(key, rv)
	case reflect.Ptr:
		if rv.IsNil() {
			return
		}
		enc.encode(key, rv.Elem())
	case reflect.Struct:
		enc.eTable(key, rv)
	default:
		encPanic(fmt.Errorf("unsupported type for key '%s': %s", key, k))
	}
}

// eElement encodes any value that can be an array element.
func (enc *Encoder) eElement(rv reflect.Value) {
	switch v := rv.Interface().(type) {
	case time.Time: // Using TextMarshaler adds extra quotes, which we don't want.
		format := time.RFC3339Nano
		switch v.Location() {
		case internal.LocalDatetime:
			format = "2006-01-02T15:04:05.999999999"
		case internal.LocalDate:
			format = "2006-01-02"
		case internal.LocalTime:
			format = "15:04:05.999999999"
		}
		switch v.Location() {
		default:
			enc.wf(v.Format(format))
		case internal.LocalDatetime, internal.LocalDate, internal.LocalTime:
			enc.wf(v.In(time.UTC).Format(format))
		}
		return
	case Marshaler:
		s, err := v.MarshalTOML()
		if err != nil {
			encPanic(err)
		}
		if s == nil {
			encPanic(errors.New("MarshalTOML returned nil and no error"))
		}
		enc.w.Write(s)
		return
	case encoding.TextMarshaler:
		s, err := v.MarshalText()
		if err != nil {
			encPanic(err)
		}
		if s == nil {
			encPanic(errors.New("MarshalText returned nil and no error"))
		}
		enc.writeQuoted(string(s))
		return
	case time.Duration:
		enc.writeQuoted(v.String())
		return
	case json.Number:
		n, _ := rv.Interface().(json.Number)

		if n == "" { /// Useful zero value.
			enc.w.WriteByte('0')
			return
		} else if v, err := n.Int64(); err == nil {
			enc.eElement(reflect.ValueOf(v))
			return
		} else if v, err := n.Float64(); err == nil {
			enc.eElement(reflect.ValueOf(v))
			return
		}
		encPanic(fmt.Errorf("unable to convert %q to int64 or float64", n))
	}

	switch rv.Kind() {
	case reflect.Ptr:
		enc.eElement(rv.Elem())
		return
	case reflect.String:
		enc.writeQuoted(rv.String())
	case reflect.Bool:
		enc.wf(strconv.FormatBool(rv.Bool()))
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		enc.wf(strconv.FormatInt(rv.Int(), 10))
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		enc.wf(strconv.FormatUint(rv.Uint(), 10))
	case reflect.Float32:
		f := rv.Float()
		if math.IsNaN(f) {
			if math.Signbit(f) {
				enc.wf("-")
			}
			enc.wf("nan")
		} else if math.IsInf(f, 0) {
			if math.Signbit(f) {
				enc.wf("-")
			}
			enc.wf("inf")
		} else {
			enc.wf(floatAddDecimal(strconv.FormatFloat(f, 'f', -1, 32)))
		}
	case reflect.Float64:
		f := rv.Float()
		if math.IsNaN(f) {
			if math.Signbit(f) {
				enc.wf("-")
			}
			enc.wf("nan")
		} else if math.IsInf(f, 0) {
			if math.Signbit(f) {
				enc.wf("-")
			}
			enc.wf("inf")
		} else {
			enc.wf(floatAddDecimal(strconv.FormatFloat(f, 'f', -1, 64)))
		}
	case reflect.Array, reflect.Slice:
		enc.eArrayOrSliceElement(rv)
	case reflect.Struct:
		enc.eStruct(nil, rv, true)
	case reflect.Map:
		enc.eMap(nil, rv, true)
	case reflect.Interface:
		enc.eElement(rv.Elem())
	default:
		encPanic(fmt.Errorf("unexpected type: %s", fmtType(rv.Interface())))
	}
}

// By the TOML spec, all floats must have a decimal with at least one number on
// either side.
func floatAddDecimal(fstr string) string {
	if !strings.Contains(fstr, ".") {
		return fstr + ".0"
	}
	return fstr
}

func (enc *Encoder) writeQuoted(s string) {
	enc.wf("\"%s\"", dblQuotedReplacer.Replace(s))
}

func (enc *Encoder) eArrayOrSliceElement(rv reflect.Value) {
	length := rv.Len()
	enc.wf("[")
	for i := 0; i < length; i++ {
		elem := eindirect(rv.Index(i))
		enc.eElement(elem)
		if i != length-1 {
			enc.wf(", ")
		}
	}
	enc.wf("]")
}

func (enc *Encoder) eArrayOfTables(key Key, rv reflect.Value) {
	if len(key) == 0 {
		encPanic(errNoKey)
	}
	for i := 0; i < rv.Len(); i++ {
		trv := eindirect(rv.Index(i))
		if isNil(trv) {
			continue
		}
		enc.newline()
		enc.wf("%s[[%s]]", enc.indentStr(key), key)
		enc.newline()
		enc.eMapOrStruct(key, trv, false)
	}
}

func (enc *Encoder) eTable(key Key, rv reflect.Value) {
	if len(key) == 1 {
		// Output an extra newline between top-level tables.
		// (The newline isn't written if nothing else has been written though.)
		enc.newline()
	}
	if len(key) > 0 {
		enc.wf("%s[%s]", enc.indentStr(key), key)
		enc.newline()
	}
	enc.eMapOrStruct(key, rv, false)
}

func (enc *Encoder) eMapOrStruct(key Key, rv reflect.Value, inline bool) {
	switch rv.Kind() {
	case reflect.Map:
		enc.eMap(key, rv, inline)
	case reflect.Struct:
		enc.eStruct(key, rv, inline)
	default:
		// Should never happen?
		panic("eTable: unhandled reflect.Value Kind: " + rv.Kind().String())
	}
}

func (enc *Encoder) eMap(key Key, rv reflect.Value, inline bool) {
	rt := rv.Type()
	if rt.Key().Kind() != reflect.String {
		encPanic(errNonString)
	}

	// Sort keys so that we have deterministic output. And write keys directly
	// underneath this key first, before writing sub-structs or sub-maps.
	var mapKeysDirect, mapKeysSub []reflect.Value
	for _, mapKey := range rv.MapKeys() {
		if typeIsTable(tomlTypeOfGo(eindirect(rv.MapIndex(mapKey)))) {
			mapKeysSub = append(mapKeysSub, mapKey)
		} else {
			mapKeysDirect = append(mapKeysDirect, mapKey)
		}
	}

	writeMapKeys := func(mapKeys []reflect.Value, trailC bool) {
		sort.Slice(mapKeys, func(i, j int) bool { return mapKeys[i].String() < mapKeys[j].String() })
		for i, mapKey := range mapKeys {
			val := eindirect(rv.MapIndex(mapKey))
			if isNil(val) {
				continue
			}

			if inline {
				enc.writeKeyValue(Key{mapKey.String()}, val, true)
				if trailC || i != len(mapKeys)-1 {
					enc.wf(", ")
				}
			} else {
				enc.encode(key.add(mapKey.String()), val)
			}
		}
	}

	if inline {
		enc.wf("{")
	}
	writeMapKeys(mapKeysDirect, len(mapKeysSub) > 0)
	writeMapKeys(mapKeysSub, false)
	if inline {
		enc.wf("}")
	}
}

func pointerTo(t reflect.Type) reflect.Type {
	if t.Kind() == reflect.Ptr {
		return pointerTo(t.Elem())
	}
	return t
}

func (enc *Encoder) eStruct(key Key, rv reflect.Value, inline bool) {
	// Write keys for fields directly under this key first, because if we write
	// a field that creates a new table then all keys under it will be in that
	// table (not the one we're writing here).
	//
	// Fields is a [][]int: for fieldsDirect this always has one entry (the
	// struct index). For fieldsSub it contains two entries: the parent field
	// index from tv, and the field indexes for the fields of the sub.
	var (
		rt                      = rv.Type()
		fieldsDirect, fieldsSub [][]int
		addFields               func(rt reflect.Type, rv reflect.Value, start []int)
	)
	addFields = func(rt reflect.Type, rv reflect.Value, start []int) {
		for i := 0; i < rt.NumField(); i++ {
			f := rt.Field(i)
			isEmbed := f.Anonymous && pointerTo(f.Type).Kind() == reflect.Struct
			if f.PkgPath != "" && !isEmbed { /// Skip unexported fields.
				continue
			}
			opts := getOptions(f.Tag)
			if opts.skip {
				continue
			}

			frv := eindirect(rv.Field(i))

			// Need to make a copy because ... ehm, I don't know why... I guess
			// allocating a new array can cause it to fail(?)
			//
			// Done for: https://github.com/BurntSushi/toml/issues/430
			// Previously only on 32bit for: https://github.com/BurntSushi/toml/issues/314
			copyStart := make([]int, len(start))
			copy(copyStart, start)
			start = copyStart

			// Treat anonymous struct fields with tag names as though they are
			// not anonymous, like encoding/json does.
			//
			// Non-struct anonymous fields use the normal encoding logic.
			if isEmbed {
				if getOptions(f.Tag).name == "" && frv.Kind() == reflect.Struct {
					addFields(frv.Type(), frv, append(start, f.Index...))
					continue
				}
			}

			if typeIsTable(tomlTypeOfGo(frv)) {
				fieldsSub = append(fieldsSub, append(start, f.Index...))
			} else {
				fieldsDirect = append(fieldsDirect, append(start, f.Index...))
			}
		}
	}
	addFields(rt, rv, nil)

	writeFields := func(fields [][]int, totalFields int) {
		for _, fieldIndex := range fields {
			fieldType := rt.FieldByIndex(fieldIndex)
			fieldVal := rv.FieldByIndex(fieldIndex)

			opts := getOptions(fieldType.Tag)
			if opts.skip {
				continue
			}
			if opts.omitempty && isEmpty(fieldVal) {
				continue
			}

			fieldVal = eindirect(fieldVal)

			if isNil(fieldVal) { /// Don't write anything for nil fields.
				continue
			}

			keyName := fieldType.Name
			if opts.name != "" {
				keyName = opts.name
			}

			if opts.omitzero && isZero(fieldVal) {
				continue
			}

			if inline {
				enc.writeKeyValue(Key{keyName}, fieldVal, true)
				if fieldIndex[0] != totalFields-1 {
					enc.wf(", ")
				}
			} else {
				enc.encode(key.add(keyName), fieldVal)
			}
		}
	}

	if inline {
		enc.wf("{")
	}

	l := len(fieldsDirect) + len(fieldsSub)
	writeFields(fieldsDirect, l)
	writeFields(fieldsSub, l)
	if inline {
		enc.wf("}")
	}
}

// tomlTypeOfGo returns the TOML type name of the Go value's type.
//
// It is used to determine whether the types of array elements are mixed (which
// is forbidden). If the Go value is nil, then it is illegal for it to be an
// array element, and valueIsNil is returned as true.
//
// The type may be `nil`, which means no concrete TOML type could be found.
func tomlTypeOfGo(rv reflect.Value) tomlType {
	if isNil(rv) || !rv.IsValid() {
		return nil
	}

	if rv.Kind() == reflect.Struct {
		if rv.Type() == timeType {
			return tomlDatetime
		}
		if isMarshaler(rv) {
			return tomlString
		}
		return tomlHash
	}

	if isMarshaler(rv) {
		return tomlString
	}

	switch rv.Kind() {
	case reflect.Bool:
		return tomlBool
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32,
		reflect.Int64,
		reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32,
		reflect.Uint64:
		return tomlInteger
	case reflect.Float32, reflect.Float64:
		return tomlFloat
	case reflect.Array, reflect.Slice:
		if isTableArray(rv) {
			return tomlArrayHash
		}
		return tomlArray
	case reflect.Ptr, reflect.Interface:
		return tomlTypeOfGo(rv.Elem())
	case reflect.String:
		return tomlString
	case reflect.Map:
		return tomlHash
	default:
		encPanic(errors.New("unsupported type: " + rv.Kind().String()))
		panic("unreachable")
	}
}

func isMarshaler(rv reflect.Value) bool {
	return rv.Type().Implements(marshalText) || rv.Type().Implements(marshalToml)
}

// isTableArray reports if all entries in the array or slice are a table.
func isTableArray(arr reflect.Value) bool {
	if isNil(arr) || !arr.IsValid() || arr.Len() == 0 {
		return false
	}

	ret := true
	for i := 0; i < arr.Len(); i++ {
		tt := tomlTypeOfGo(eindirect(arr.Index(i)))
		// Don't allow nil.
		if tt == nil {
			encPanic(errArrayNilElement)
		}

		if ret && !typeEqual(tomlHash, tt) {
			ret = false
		}
	}
	return ret
}

type tagOptions struct {
	skip      bool // "-"
	name      string
	omitempty bool
	omitzero  bool
}

func getOptions(tag reflect.StructTag) tagOptions {
	t := tag.Get("toml")
	if t == "-" {
		return tagOptions{skip: true}
	}
	var opts tagOptions
	parts := strings.Split(t, ",")
	opts.name = parts[0]
	for _, s := range parts[1:] {
		switch s {
		case "omitempty":
			opts.omitempty = true
		case "omitzero":
			opts.omitzero = true
		}
	}
	return opts
}

func isZero(rv reflect.Value) bool {
	switch rv.Kind() {
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return rv.Int() == 0
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		return rv.Uint() == 0
	case reflect.Float32, reflect.Float64:
		return rv.Float() == 0.0
	}
	return false
}

func isEmpty(rv reflect.Value) bool {
	switch rv.Kind() {
	case reflect.Array, reflect.Slice, reflect.Map, reflect.String:
		return rv.Len() == 0
	case reflect.Struct:
		if rv.Type().Comparable() {
			return reflect.Zero(rv.Type()).Interface() == rv.Interface()
		}
		// Need to also check if all the fields are empty, otherwise something
		// like this with uncomparable types will always return true:
		//
		//   type a struct{ field b }
		//   type b struct{ s []string }
		//   s := a{field: b{s: []string{"AAA"}}}
		for i := 0; i < rv.NumField(); i++ {
			if !isEmpty(rv.Field(i)) {
				return false
			}
		}
		return true
	case reflect.Bool:
		return !rv.Bool()
	case reflect.Ptr:
		return rv.IsNil()
	}
	return false
}

func (enc *Encoder) newline() {
	if enc.hasWritten {
		enc.wf("\n")
	}
}

// Write a key/value pair:
//
//	key = <any value>
//
// This is also used for "k = v" in inline tables; so something like this will
// be written in three calls:
//
//	┌───────────────────┐
//	│      ┌───┐  ┌────┐│
//	v      v   v  v    vv
//	key = {k = 1, k2 = 2}
func (enc *Encoder) writeKeyValue(key Key, val reflect.Value, inline bool) {
	/// Marshaler used on top-level document; call eElement() to just call
	/// Marshal{TOML,Text}.
	if len(key) == 0 {
		enc.eElement(val)
		return
	}
	enc.wf("%s%s = ", enc.indentStr(key), key.maybeQuoted(len(key)-1))
	enc.eElement(val)
	if !inline {
		enc.newline()
	}
}

func (enc *Encoder) wf(format string, v ...any) {
	_, err := fmt.Fprintf(enc.w, format, v...)
	if err != nil {
		encPanic(err)
	}
	enc.hasWritten = true
}

func (enc *Encoder) indentStr(key Key) string {
	return strings.Repeat(enc.Indent, len(key)-1)
}

func encPanic(err error) {
	panic(tomlEncodeError{err})
}

// Resolve any level of pointers to the actual value (e.g. **string → string).
func eindirect(v reflect.Value) reflect.Value {
	if v.Kind() != reflect.Ptr && v.Kind() != reflect.Interface {
		if isMarshaler(v) {
			return v
		}
		if v.CanAddr() { /// Special case for marshalers; see #358.
			if pv := v.Addr(); isMarshaler(pv) {
				return pv
			}
		}
		return v
	}

	if v.IsNil() {
		return v
	}

	return eindirect(v.Elem())
}

func isNil(rv reflect.Value) bool {
	switch rv.Kind() {
	case reflect.Interface, reflect.Map, reflect.Ptr, reflect.Slice:
		return rv.IsNil()
	default:
		return false
	}
}
