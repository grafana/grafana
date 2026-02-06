package toml

import (
	"bytes"
	"encoding"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"math"
	"os"
	"reflect"
	"strconv"
	"strings"
	"time"
)

// Unmarshaler is the interface implemented by objects that can unmarshal a
// TOML description of themselves.
type Unmarshaler interface {
	UnmarshalTOML(any) error
}

// Unmarshal decodes the contents of data in TOML format into a pointer v.
//
// See [Decoder] for a description of the decoding process.
func Unmarshal(data []byte, v any) error {
	_, err := NewDecoder(bytes.NewReader(data)).Decode(v)
	return err
}

// Decode the TOML data in to the pointer v.
//
// See [Decoder] for a description of the decoding process.
func Decode(data string, v any) (MetaData, error) {
	return NewDecoder(strings.NewReader(data)).Decode(v)
}

// DecodeFile reads the contents of a file and decodes it with [Decode].
func DecodeFile(path string, v any) (MetaData, error) {
	fp, err := os.Open(path)
	if err != nil {
		return MetaData{}, err
	}
	defer fp.Close()
	return NewDecoder(fp).Decode(v)
}

// DecodeFS reads the contents of a file from [fs.FS] and decodes it with
// [Decode].
func DecodeFS(fsys fs.FS, path string, v any) (MetaData, error) {
	fp, err := fsys.Open(path)
	if err != nil {
		return MetaData{}, err
	}
	defer fp.Close()
	return NewDecoder(fp).Decode(v)
}

// Primitive is a TOML value that hasn't been decoded into a Go value.
//
// This type can be used for any value, which will cause decoding to be delayed.
// You can use [PrimitiveDecode] to "manually" decode these values.
//
// NOTE: The underlying representation of a `Primitive` value is subject to
// change. Do not rely on it.
//
// NOTE: Primitive values are still parsed, so using them will only avoid the
// overhead of reflection. They can be useful when you don't know the exact type
// of TOML data until runtime.
type Primitive struct {
	undecoded any
	context   Key
}

// The significand precision for float32 and float64 is 24 and 53 bits; this is
// the range a natural number can be stored in a float without loss of data.
const (
	maxSafeFloat32Int = 16777215                // 2^24-1
	maxSafeFloat64Int = int64(9007199254740991) // 2^53-1
)

// Decoder decodes TOML data.
//
// TOML tables correspond to Go structs or maps; they can be used
// interchangeably, but structs offer better type safety.
//
// TOML table arrays correspond to either a slice of structs or a slice of maps.
//
// TOML datetimes correspond to [time.Time]. Local datetimes are parsed in the
// local timezone.
//
// [time.Duration] types are treated as nanoseconds if the TOML value is an
// integer, or they're parsed with time.ParseDuration() if they're strings.
//
// All other TOML types (float, string, int, bool and array) correspond to the
// obvious Go types.
//
// An exception to the above rules is if a type implements the TextUnmarshaler
// interface, in which case any primitive TOML value (floats, strings, integers,
// booleans, datetimes) will be converted to a []byte and given to the value's
// UnmarshalText method. See the Unmarshaler example for a demonstration with
// email addresses.
//
// # Key mapping
//
// TOML keys can map to either keys in a Go map or field names in a Go struct.
// The special `toml` struct tag can be used to map TOML keys to struct fields
// that don't match the key name exactly (see the example). A case insensitive
// match to struct names will be tried if an exact match can't be found.
//
// The mapping between TOML values and Go values is loose. That is, there may
// exist TOML values that cannot be placed into your representation, and there
// may be parts of your representation that do not correspond to TOML values.
// This loose mapping can be made stricter by using the IsDefined and/or
// Undecoded methods on the MetaData returned.
//
// This decoder does not handle cyclic types. Decode will not terminate if a
// cyclic type is passed.
type Decoder struct {
	r io.Reader
}

// NewDecoder creates a new Decoder.
func NewDecoder(r io.Reader) *Decoder {
	return &Decoder{r: r}
}

var (
	unmarshalToml = reflect.TypeOf((*Unmarshaler)(nil)).Elem()
	unmarshalText = reflect.TypeOf((*encoding.TextUnmarshaler)(nil)).Elem()
	primitiveType = reflect.TypeOf((*Primitive)(nil)).Elem()
)

// Decode TOML data in to the pointer `v`.
func (dec *Decoder) Decode(v any) (MetaData, error) {
	rv := reflect.ValueOf(v)
	if rv.Kind() != reflect.Ptr {
		s := "%q"
		if reflect.TypeOf(v) == nil {
			s = "%v"
		}

		return MetaData{}, fmt.Errorf("toml: cannot decode to non-pointer "+s, reflect.TypeOf(v))
	}
	if rv.IsNil() {
		return MetaData{}, fmt.Errorf("toml: cannot decode to nil value of %q", reflect.TypeOf(v))
	}

	// Check if this is a supported type: struct, map, any, or something that
	// implements UnmarshalTOML or UnmarshalText.
	rv = indirect(rv)
	rt := rv.Type()
	if rv.Kind() != reflect.Struct && rv.Kind() != reflect.Map &&
		!(rv.Kind() == reflect.Interface && rv.NumMethod() == 0) &&
		!rt.Implements(unmarshalToml) && !rt.Implements(unmarshalText) {
		return MetaData{}, fmt.Errorf("toml: cannot decode to type %s", rt)
	}

	// TODO: parser should read from io.Reader? Or at the very least, make it
	// read from []byte rather than string
	data, err := io.ReadAll(dec.r)
	if err != nil {
		return MetaData{}, err
	}

	p, err := parse(string(data))
	if err != nil {
		return MetaData{}, err
	}

	md := MetaData{
		mapping: p.mapping,
		keyInfo: p.keyInfo,
		keys:    p.ordered,
		decoded: make(map[string]struct{}, len(p.ordered)),
		context: nil,
		data:    data,
	}
	return md, md.unify(p.mapping, rv)
}

// PrimitiveDecode is just like the other Decode* functions, except it decodes a
// TOML value that has already been parsed. Valid primitive values can *only* be
// obtained from values filled by the decoder functions, including this method.
// (i.e., v may contain more [Primitive] values.)
//
// Meta data for primitive values is included in the meta data returned by the
// Decode* functions with one exception: keys returned by the Undecoded method
// will only reflect keys that were decoded. Namely, any keys hidden behind a
// Primitive will be considered undecoded. Executing this method will update the
// undecoded keys in the meta data. (See the example.)
func (md *MetaData) PrimitiveDecode(primValue Primitive, v any) error {
	md.context = primValue.context
	defer func() { md.context = nil }()
	return md.unify(primValue.undecoded, rvalue(v))
}

// markDecodedRecursive is a helper to mark any key under the given tmap as
// decoded, recursing as needed
func markDecodedRecursive(md *MetaData, tmap map[string]any) {
	for key := range tmap {
		md.decoded[md.context.add(key).String()] = struct{}{}
		if tmap, ok := tmap[key].(map[string]any); ok {
			md.context = append(md.context, key)
			markDecodedRecursive(md, tmap)
			md.context = md.context[0 : len(md.context)-1]
		}
	}
}

// unify performs a sort of type unification based on the structure of `rv`,
// which is the client representation.
//
// Any type mismatch produces an error. Finding a type that we don't know
// how to handle produces an unsupported type error.
func (md *MetaData) unify(data any, rv reflect.Value) error {
	// Special case. Look for a `Primitive` value.
	// TODO: #76 would make this superfluous after implemented.
	if rv.Type() == primitiveType {
		// Save the undecoded data and the key context into the primitive
		// value.
		context := make(Key, len(md.context))
		copy(context, md.context)
		rv.Set(reflect.ValueOf(Primitive{
			undecoded: data,
			context:   context,
		}))
		return nil
	}

	rvi := rv.Interface()
	if v, ok := rvi.(Unmarshaler); ok {
		err := v.UnmarshalTOML(data)
		if err != nil {
			return md.parseErr(err)
		}
		// Assume the Unmarshaler decoded everything, so mark all keys under
		// this table as decoded.
		if tmap, ok := data.(map[string]any); ok {
			markDecodedRecursive(md, tmap)
		}
		if aot, ok := data.([]map[string]any); ok {
			for _, tmap := range aot {
				markDecodedRecursive(md, tmap)
			}
		}
		return nil
	}
	if v, ok := rvi.(encoding.TextUnmarshaler); ok {
		return md.unifyText(data, v)
	}

	// TODO:
	// The behavior here is incorrect whenever a Go type satisfies the
	// encoding.TextUnmarshaler interface but also corresponds to a TOML hash or
	// array. In particular, the unmarshaler should only be applied to primitive
	// TOML values. But at this point, it will be applied to all kinds of values
	// and produce an incorrect error whenever those values are hashes or arrays
	// (including arrays of tables).

	k := rv.Kind()

	if k >= reflect.Int && k <= reflect.Uint64 {
		return md.unifyInt(data, rv)
	}
	switch k {
	case reflect.Struct:
		return md.unifyStruct(data, rv)
	case reflect.Map:
		return md.unifyMap(data, rv)
	case reflect.Array:
		return md.unifyArray(data, rv)
	case reflect.Slice:
		return md.unifySlice(data, rv)
	case reflect.String:
		return md.unifyString(data, rv)
	case reflect.Bool:
		return md.unifyBool(data, rv)
	case reflect.Interface:
		if rv.NumMethod() > 0 { /// Only empty interfaces are supported.
			return md.e("unsupported type %s", rv.Type())
		}
		return md.unifyAnything(data, rv)
	case reflect.Float32, reflect.Float64:
		return md.unifyFloat64(data, rv)
	}
	return md.e("unsupported type %s", rv.Kind())
}

func (md *MetaData) unifyStruct(mapping any, rv reflect.Value) error {
	tmap, ok := mapping.(map[string]any)
	if !ok {
		if mapping == nil {
			return nil
		}
		return md.e("type mismatch for %s: expected table but found %s", rv.Type().String(), fmtType(mapping))
	}

	for key, datum := range tmap {
		var f *field
		fields := cachedTypeFields(rv.Type())
		for i := range fields {
			ff := &fields[i]
			if ff.name == key {
				f = ff
				break
			}
			if f == nil && strings.EqualFold(ff.name, key) {
				f = ff
			}
		}
		if f != nil {
			subv := rv
			for _, i := range f.index {
				subv = indirect(subv.Field(i))
			}

			if isUnifiable(subv) {
				md.decoded[md.context.add(key).String()] = struct{}{}
				md.context = append(md.context, key)

				err := md.unify(datum, subv)
				if err != nil {
					return err
				}
				md.context = md.context[0 : len(md.context)-1]
			} else if f.name != "" {
				return md.e("cannot write unexported field %s.%s", rv.Type().String(), f.name)
			}
		}
	}
	return nil
}

func (md *MetaData) unifyMap(mapping any, rv reflect.Value) error {
	keyType := rv.Type().Key().Kind()
	if keyType != reflect.String && keyType != reflect.Interface {
		return fmt.Errorf("toml: cannot decode to a map with non-string key type (%s in %q)",
			keyType, rv.Type())
	}

	tmap, ok := mapping.(map[string]any)
	if !ok {
		if tmap == nil {
			return nil
		}
		return md.badtype("map", mapping)
	}
	if rv.IsNil() {
		rv.Set(reflect.MakeMap(rv.Type()))
	}
	for k, v := range tmap {
		md.decoded[md.context.add(k).String()] = struct{}{}
		md.context = append(md.context, k)

		rvval := reflect.Indirect(reflect.New(rv.Type().Elem()))

		err := md.unify(v, indirect(rvval))
		if err != nil {
			return err
		}
		md.context = md.context[0 : len(md.context)-1]

		rvkey := indirect(reflect.New(rv.Type().Key()))

		switch keyType {
		case reflect.Interface:
			rvkey.Set(reflect.ValueOf(k))
		case reflect.String:
			rvkey.SetString(k)
		}

		rv.SetMapIndex(rvkey, rvval)
	}
	return nil
}

func (md *MetaData) unifyArray(data any, rv reflect.Value) error {
	datav := reflect.ValueOf(data)
	if datav.Kind() != reflect.Slice {
		if !datav.IsValid() {
			return nil
		}
		return md.badtype("slice", data)
	}
	if l := datav.Len(); l != rv.Len() {
		return md.e("expected array length %d; got TOML array of length %d", rv.Len(), l)
	}
	return md.unifySliceArray(datav, rv)
}

func (md *MetaData) unifySlice(data any, rv reflect.Value) error {
	datav := reflect.ValueOf(data)
	if datav.Kind() != reflect.Slice {
		if !datav.IsValid() {
			return nil
		}
		return md.badtype("slice", data)
	}
	n := datav.Len()
	if rv.IsNil() || rv.Cap() < n {
		rv.Set(reflect.MakeSlice(rv.Type(), n, n))
	}
	rv.SetLen(n)
	return md.unifySliceArray(datav, rv)
}

func (md *MetaData) unifySliceArray(data, rv reflect.Value) error {
	l := data.Len()
	for i := 0; i < l; i++ {
		err := md.unify(data.Index(i).Interface(), indirect(rv.Index(i)))
		if err != nil {
			return err
		}
	}
	return nil
}

func (md *MetaData) unifyString(data any, rv reflect.Value) error {
	_, ok := rv.Interface().(json.Number)
	if ok {
		if i, ok := data.(int64); ok {
			rv.SetString(strconv.FormatInt(i, 10))
		} else if f, ok := data.(float64); ok {
			rv.SetString(strconv.FormatFloat(f, 'f', -1, 64))
		} else {
			return md.badtype("string", data)
		}
		return nil
	}

	if s, ok := data.(string); ok {
		rv.SetString(s)
		return nil
	}
	return md.badtype("string", data)
}

func (md *MetaData) unifyFloat64(data any, rv reflect.Value) error {
	rvk := rv.Kind()

	if num, ok := data.(float64); ok {
		switch rvk {
		case reflect.Float32:
			if num < -math.MaxFloat32 || num > math.MaxFloat32 {
				return md.parseErr(errParseRange{i: num, size: rvk.String()})
			}
			fallthrough
		case reflect.Float64:
			rv.SetFloat(num)
		default:
			panic("bug")
		}
		return nil
	}

	if num, ok := data.(int64); ok {
		if (rvk == reflect.Float32 && (num < -maxSafeFloat32Int || num > maxSafeFloat32Int)) ||
			(rvk == reflect.Float64 && (num < -maxSafeFloat64Int || num > maxSafeFloat64Int)) {
			return md.parseErr(errUnsafeFloat{i: num, size: rvk.String()})
		}
		rv.SetFloat(float64(num))
		return nil
	}

	return md.badtype("float", data)
}

func (md *MetaData) unifyInt(data any, rv reflect.Value) error {
	_, ok := rv.Interface().(time.Duration)
	if ok {
		// Parse as string duration, and fall back to regular integer parsing
		// (as nanosecond) if this is not a string.
		if s, ok := data.(string); ok {
			dur, err := time.ParseDuration(s)
			if err != nil {
				return md.parseErr(errParseDuration{s})
			}
			rv.SetInt(int64(dur))
			return nil
		}
	}

	num, ok := data.(int64)
	if !ok {
		return md.badtype("integer", data)
	}

	rvk := rv.Kind()
	switch {
	case rvk >= reflect.Int && rvk <= reflect.Int64:
		if (rvk == reflect.Int8 && (num < math.MinInt8 || num > math.MaxInt8)) ||
			(rvk == reflect.Int16 && (num < math.MinInt16 || num > math.MaxInt16)) ||
			(rvk == reflect.Int32 && (num < math.MinInt32 || num > math.MaxInt32)) {
			return md.parseErr(errParseRange{i: num, size: rvk.String()})
		}
		rv.SetInt(num)
	case rvk >= reflect.Uint && rvk <= reflect.Uint64:
		unum := uint64(num)
		if rvk == reflect.Uint8 && (num < 0 || unum > math.MaxUint8) ||
			rvk == reflect.Uint16 && (num < 0 || unum > math.MaxUint16) ||
			rvk == reflect.Uint32 && (num < 0 || unum > math.MaxUint32) {
			return md.parseErr(errParseRange{i: num, size: rvk.String()})
		}
		rv.SetUint(unum)
	default:
		panic("unreachable")
	}
	return nil
}

func (md *MetaData) unifyBool(data any, rv reflect.Value) error {
	if b, ok := data.(bool); ok {
		rv.SetBool(b)
		return nil
	}
	return md.badtype("boolean", data)
}

func (md *MetaData) unifyAnything(data any, rv reflect.Value) error {
	rv.Set(reflect.ValueOf(data))
	return nil
}

func (md *MetaData) unifyText(data any, v encoding.TextUnmarshaler) error {
	var s string
	switch sdata := data.(type) {
	case Marshaler:
		text, err := sdata.MarshalTOML()
		if err != nil {
			return err
		}
		s = string(text)
	case encoding.TextMarshaler:
		text, err := sdata.MarshalText()
		if err != nil {
			return err
		}
		s = string(text)
	case fmt.Stringer:
		s = sdata.String()
	case string:
		s = sdata
	case bool:
		s = fmt.Sprintf("%v", sdata)
	case int64:
		s = fmt.Sprintf("%d", sdata)
	case float64:
		s = fmt.Sprintf("%f", sdata)
	default:
		return md.badtype("primitive (string-like)", data)
	}
	if err := v.UnmarshalText([]byte(s)); err != nil {
		return md.parseErr(err)
	}
	return nil
}

func (md *MetaData) badtype(dst string, data any) error {
	return md.e("incompatible types: TOML value has type %s; destination has type %s", fmtType(data), dst)
}

func (md *MetaData) parseErr(err error) error {
	k := md.context.String()
	d := string(md.data)
	return ParseError{
		Message:  err.Error(),
		err:      err,
		LastKey:  k,
		Position: md.keyInfo[k].pos.withCol(d),
		Line:     md.keyInfo[k].pos.Line,
		input:    d,
	}
}

func (md *MetaData) e(format string, args ...any) error {
	f := "toml: "
	if len(md.context) > 0 {
		f = fmt.Sprintf("toml: (last key %q): ", md.context)
		p := md.keyInfo[md.context.String()].pos
		if p.Line > 0 {
			f = fmt.Sprintf("toml: line %d (last key %q): ", p.Line, md.context)
		}
	}
	return fmt.Errorf(f+format, args...)
}

// rvalue returns a reflect.Value of `v`. All pointers are resolved.
func rvalue(v any) reflect.Value {
	return indirect(reflect.ValueOf(v))
}

// indirect returns the value pointed to by a pointer.
//
// Pointers are followed until the value is not a pointer. New values are
// allocated for each nil pointer.
//
// An exception to this rule is if the value satisfies an interface of interest
// to us (like encoding.TextUnmarshaler).
func indirect(v reflect.Value) reflect.Value {
	if v.Kind() != reflect.Ptr {
		if v.CanSet() {
			pv := v.Addr()
			pvi := pv.Interface()
			if _, ok := pvi.(encoding.TextUnmarshaler); ok {
				return pv
			}
			if _, ok := pvi.(Unmarshaler); ok {
				return pv
			}
		}
		return v
	}
	if v.IsNil() {
		v.Set(reflect.New(v.Type().Elem()))
	}
	return indirect(reflect.Indirect(v))
}

func isUnifiable(rv reflect.Value) bool {
	if rv.CanSet() {
		return true
	}
	rvi := rv.Interface()
	if _, ok := rvi.(encoding.TextUnmarshaler); ok {
		return true
	}
	if _, ok := rvi.(Unmarshaler); ok {
		return true
	}
	return false
}

// fmt %T with "interface {}" replaced with "any", which is far more readable.
func fmtType(t any) string {
	return strings.ReplaceAll(fmt.Sprintf("%T", t), "interface {}", "any")
}
