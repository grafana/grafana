// Copyright 2021 CUE Authors
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

package cue

import (
	"bytes"
	"encoding"
	"encoding/json"
	"reflect"
	"sort"
	"strconv"
	"strings"
	"sync"
	"unicode"
	"unicode/utf8"

	"cuelang.org/go/cue/errors"
	"cuelang.org/go/internal/core/adt"
)

// Decode initializes x with Value v. If x is a struct, it will validate the
// constraints specified in the field tags.
func (v Value) Decode(x interface{}) error {
	var d decoder
	w := reflect.ValueOf(x)
	switch {
	case !reflect.Indirect(w).CanSet():
		d.addErr(errors.Newf(v.Pos(), "cannot decode into unsettable value"))

	default:
		if w.Kind() == reflect.Ptr {
			w = w.Elem()
		}
		d.decode(w, v, false)
	}
	return d.errs
}

type decoder struct {
	errs errors.Error
}

func (d *decoder) addErr(err error) {
	if err != nil {
		d.errs = errors.Append(d.errs, errors.Promote(err, ""))
	}
}

func incompleteError(v Value) errors.Error {
	return &valueError{
		v: v,
		err: &adt.Bottom{
			Code: adt.IncompleteError,
			Err: errors.Newf(v.Pos(),
				"cannot convert non-concrete value %v", v)},
	}
}

func (d *decoder) clear(x reflect.Value) {
	if x.CanSet() {
		x.Set(reflect.Zero(x.Type()))
	}
}

func (d *decoder) decode(x reflect.Value, v Value, isPtr bool) {
	if !x.IsValid() {
		d.addErr(errors.Newf(v.Pos(), "cannot decode into invalid value"))
		return
	}

	v, _ = v.Default()
	if v.v == nil {
		d.clear(x)
		return
	}

	if err := v.Err(); err != nil {
		d.addErr(err)
		return
	}

	switch x.Kind() {
	case reflect.Ptr, reflect.Map, reflect.Slice, reflect.Interface:
		// nullable types
		if v.Null() == nil || !v.IsConcrete() {
			d.clear(x)
			return
		}

	default:
		// TODO: allow incomplete values.
		if !v.IsConcrete() {
			d.addErr(incompleteError(v))
			return
		}
	}

	ij, it, x := indirect(x, v.Null() == nil)

	if ij != nil {
		b, err := v.marshalJSON()
		d.addErr(err)
		d.addErr(ij.UnmarshalJSON(b))
		return
	}

	if it != nil {
		b, err := v.Bytes()
		if err != nil {
			err = errors.Wrapf(err, v.Pos(), "Decode")
			d.addErr(err)
			return
		}
		d.addErr(it.UnmarshalText(b))
		return
	}

	kind := x.Kind()

	if kind == reflect.Interface {
		value := d.interfaceValue(v)
		x.Set(reflect.ValueOf(value))
		return
	}

	switch kind {
	case reflect.Ptr:
		d.decode(x.Elem(), v, true)

	case reflect.Bool:
		b, err := v.Bool()
		d.addErr(err)
		x.SetBool(b)

	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		i, err := v.Int64()
		d.addErr(err)
		if x.OverflowInt(i) {
			d.addErr(errors.Newf(v.Pos(), "integer %d overflows %s", i, kind))
			break
		}
		x.SetInt(i)

	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		i, err := v.Uint64()
		d.addErr(err)
		if x.OverflowUint(i) {
			d.addErr(errors.Newf(v.Pos(), "integer %d overflows %s", i, kind))
			break
		}
		x.SetUint(i)

	case reflect.Float32, reflect.Float64:
		f, err := v.Float64()
		d.addErr(err)
		if x.OverflowFloat(f) {
			d.addErr(errors.Newf(v.Pos(), "float %g overflows %s", f, kind))
			break
		}
		x.SetFloat(f)

	case reflect.String:
		s, err := v.String()
		d.addErr(err)
		x.SetString(s)

	case reflect.Array:
		d.clear(x)

		t := x.Type()
		n := x.Len()

		if t.Elem().Kind() == reflect.Uint8 && v.Kind() == BytesKind {
			b, err := v.Bytes()
			d.addErr(err)
			for i, c := range b {
				if i >= n {
					break
				}
				x.Index(i).SetUint(uint64(c))
			}
			break
		}

		var a []Value
		list, err := v.List()
		d.addErr(err)
		for list.Next() {
			a = append(a, list.Value())
		}

		for i, v := range a {
			if i >= n {
				break
			}
			d.decode(x.Index(i), v, false)
		}

	case reflect.Slice:
		t := x.Type()
		if t.Elem().Kind() == reflect.Uint8 && v.Kind() == BytesKind {
			b, err := v.Bytes()
			d.addErr(err)
			x.SetBytes(b)
			break
		}

		var a []Value
		list, err := v.List()
		d.addErr(err)
		for list.Next() {
			a = append(a, list.Value())
		}

		switch cap := x.Cap(); {
		case cap == 0, // force a non-nil list
			cap < len(a):
			x.Set(reflect.MakeSlice(t, len(a), len(a)))

		default:
			x.SetLen(len(a))
		}

		for i, v := range a {
			d.decode(x.Index(i), v, false)
		}

	case reflect.Struct:
		d.convertStruct(x, v)

	case reflect.Map:
		d.convertMap(x, v)

	default:
		d.clear(x)
	}
}

func (d *decoder) interfaceValue(v Value) (x interface{}) {
	var err error
	v, _ = v.Default()
	switch v.Kind() {
	case NullKind:
		return nil

	case BoolKind:
		x, err = v.Bool()

	case IntKind:
		if i, err := v.Int64(); err == nil {
			return int(i)
		}
		x, err = v.Int(nil)

	case FloatKind:
		x, err = v.Float64() // or big int or

	case StringKind:
		x, err = v.String()

	case BytesKind:
		x, err = v.Bytes()

	case ListKind:
		var a []interface{}
		list, err := v.List()
		d.addErr(err)
		for list.Next() {
			a = append(a, d.interfaceValue(list.Value()))
		}
		x = a

	case StructKind:
		m := map[string]interface{}{}
		iter, err := v.Fields()
		d.addErr(err)
		for iter.Next() {
			m[iter.Label()] = d.interfaceValue(iter.Value())
		}
		x = m

	default:
		err = incompleteError(v)
	}

	d.addErr(err)
	return x
}

var textUnmarshalerType = reflect.TypeOf((*encoding.TextUnmarshaler)(nil)).Elem()

// convertMap keeps an existing map and overwrites any entry found in v,
// keeping other preexisting entries.
func (d *decoder) convertMap(x reflect.Value, v Value) {
	// Delete existing elements
	t := x.Type()

	// Map key must either have string kind, have an integer kind,
	// or be an encoding.TextUnmarshaler.
	switch t.Key().Kind() {
	case reflect.String,
		reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64,
		reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Uintptr:
	default:
		if !reflect.PtrTo(t.Key()).Implements(textUnmarshalerType) {
			d.addErr(errors.Newf(v.Pos(), "unsupported key type %v", t.Key()))
			return
		}
	}

	if x.IsNil() {
		x.Set(reflect.MakeMap(t))
	}

	var mapElem reflect.Value

	iter, err := v.Fields()
	d.addErr(err)
	for iter.Next() {
		key := iter.Label()

		var kv reflect.Value
		kt := t.Key()
		switch {
		case reflect.PtrTo(kt).Implements(textUnmarshalerType):
			kv = reflect.New(kt)
			err := kv.Interface().(encoding.TextUnmarshaler).UnmarshalText([]byte(key))
			d.addErr(err)
			kv = kv.Elem()

		case kt.Kind() == reflect.String:
			kv = reflect.ValueOf(key).Convert(kt)

		default:
			switch kt.Kind() {
			case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
				s := string(key)
				n, err := strconv.ParseInt(s, 10, 64)
				d.addErr(err)
				if reflect.Zero(kt).OverflowInt(n) {
					d.addErr(errors.Newf(v.Pos(), "key integer %d overflows %s", n, kt))
					break
				}
				kv = reflect.ValueOf(n).Convert(kt)

			case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Uintptr:
				s := string(key)
				n, err := strconv.ParseUint(s, 10, 64)
				d.addErr(err)
				if reflect.Zero(kt).OverflowUint(n) {
					d.addErr(errors.Newf(v.Pos(), "key integer %d overflows %s", n, kt))
					break
				}
				kv = reflect.ValueOf(n).Convert(kt)

			default:
				panic("json: Unexpected key type") // should never occur
			}
		}

		elemType := t.Elem()
		if !mapElem.IsValid() {
			mapElem = reflect.New(elemType).Elem()
		} else {
			mapElem.Set(reflect.Zero(elemType))
		}
		d.decode(mapElem, iter.Value(), false)

		if kv.IsValid() {
			x.SetMapIndex(kv, mapElem)
		}
	}
}

func (d *decoder) convertStruct(x reflect.Value, v Value) {
	t := x.Type()
	fields := cachedTypeFields(t)

	iter, err := v.Fields()
	d.addErr(err)
	for iter.Next() {

		var f *goField
		key := iter.Label()
		if i, ok := fields.nameIndex[key]; ok {
			// Found an exact name match.
			f = &fields.list[i]
		} else {
			// Fall back to the expensive case-insensitive
			// linear search.
			key := []byte(key)
			for i := range fields.list {
				ff := &fields.list[i]
				if ff.equalFold(ff.nameBytes, key) {
					f = ff
					break
				}
			}
		}

		if f == nil {
			continue
		}

		// Figure out field corresponding to key.
		subv := x
		for _, i := range f.index {
			if subv.Kind() == reflect.Ptr {
				if subv.IsNil() {
					// If a struct embeds a pointer to an unexported type,
					// it is not possible to set a newly allocated value
					// since the field is unexported.
					//
					// See https://golang.org/issue/21357
					if !subv.CanSet() {
						d.addErr(errors.Newf(v.Pos(),
							"cannot set embedded pointer to unexported struct: %v",
							subv.Type().Elem()))
						subv = reflect.Value{}
						break
					}
					subv.Set(reflect.New(subv.Type().Elem()))
				}
				subv = subv.Elem()
			}
			subv = subv.Field(i)
		}

		// TODO: make this an option
		//  else if d.disallowUnknownFields {
		// 	d.saveError(fmt.Errorf("json: unknown field %q", key))
		// }

		d.decode(subv, iter.Value(), false)
	}
}

type structFields struct {
	list      []goField
	nameIndex map[string]int
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
		case !unicode.IsLetter(c) && !unicode.IsDigit(c):
			return false
		}
	}
	return true
}

// A field represents a single Go field found in a struct.
type goField struct {
	name      string
	nameBytes []byte                 // []byte(name)
	equalFold func(s, t []byte) bool // bytes.EqualFold or equivalent

	nameNonEsc  string // `"` + name + `":`
	nameEscHTML string // `"` + HTMLEscape(name) + `":`

	tag       bool
	index     []int
	typ       reflect.Type
	omitEmpty bool
}

// byIndex sorts goField by index sequence.
type byIndex []goField

func (x byIndex) Len() int { return len(x) }

func (x byIndex) Swap(i, j int) { x[i], x[j] = x[j], x[i] }

func (x byIndex) Less(i, j int) bool {
	for k, xik := range x[i].index {
		if k >= len(x[j].index) {
			return false
		}
		if xik != x[j].index[k] {
			return xik < x[j].index[k]
		}
	}
	return len(x[i].index) < len(x[j].index)
}

// typeFields returns a list of fields that JSON should recognize for the given type.
// The algorithm is breadth-first search over the set of structs to include - the top struct
// and then any reachable anonymous structs.
func typeFields(t reflect.Type) structFields {
	// Anonymous fields to explore at the current level and the next.
	current := []goField{}
	next := []goField{{typ: t}}

	// Count of queued names for current level and the next.
	var count, nextCount map[reflect.Type]int

	// Types already visited at an earlier level.
	visited := map[reflect.Type]bool{}

	// Fields found.
	var fields []goField

	// Buffer to run HTMLEscape on field names.
	var nameEscBuf bytes.Buffer

	for len(next) > 0 {
		current, next = next, current[:0]
		count, nextCount = nextCount, map[reflect.Type]int{}

		for _, f := range current {
			if visited[f.typ] {
				continue
			}
			visited[f.typ] = true

			// Scan f.typ for fields to include.
			for i := 0; i < f.typ.NumField(); i++ {
				sf := f.typ.Field(i)
				isUnexported := sf.PkgPath != ""
				if sf.Anonymous {
					t := sf.Type
					if t.Kind() == reflect.Ptr {
						t = t.Elem()
					}
					if isUnexported && t.Kind() != reflect.Struct {
						// Ignore embedded fields of unexported non-struct types.
						continue
					}
					// Do not ignore embedded fields of unexported struct types
					// since they may have exported fields.
				} else if isUnexported {
					// Ignore unexported non-embedded fields.
					continue
				}
				tag := sf.Tag.Get("json")
				if tag == "-" {
					continue
				}
				name, opts := parseTag(tag)
				if !isValidTag(name) {
					name = ""
				}
				index := make([]int, len(f.index)+1)
				copy(index, f.index)
				index[len(f.index)] = i

				ft := sf.Type
				if ft.Name() == "" && ft.Kind() == reflect.Ptr {
					// Follow pointer.
					ft = ft.Elem()
				}

				// Record found field and index sequence.
				if name != "" || !sf.Anonymous || ft.Kind() != reflect.Struct {
					tagged := name != ""
					if name == "" {
						name = sf.Name
					}
					field := goField{
						name:      name,
						tag:       tagged,
						index:     index,
						typ:       ft,
						omitEmpty: opts.Contains("omitempty"),
					}
					field.nameBytes = []byte(field.name)
					field.equalFold = foldFunc(field.nameBytes)

					// Build nameEscHTML and nameNonEsc ahead of time.
					nameEscBuf.Reset()
					nameEscBuf.WriteString(`"`)
					json.HTMLEscape(&nameEscBuf, field.nameBytes)
					nameEscBuf.WriteString(`":`)
					field.nameEscHTML = nameEscBuf.String()
					field.nameNonEsc = `"` + field.name + `":`

					fields = append(fields, field)
					if count[f.typ] > 1 {
						// If there were multiple instances, add a second,
						// so that the annihilation code will see a duplicate.
						// It only cares about the distinction between 1 or 2,
						// so don't bother generating any more copies.
						fields = append(fields, fields[len(fields)-1])
					}
					continue
				}

				// Record new anonymous struct to explore in next round.
				nextCount[ft]++
				if nextCount[ft] == 1 {
					next = append(next, goField{name: ft.Name(), index: index, typ: ft})
				}
			}
		}
	}

	sort.Slice(fields, func(i, j int) bool {
		x := fields
		// sort field by name, breaking ties with depth, then
		// breaking ties with "name came from json tag", then
		// breaking ties with index sequence.
		if x[i].name != x[j].name {
			return x[i].name < x[j].name
		}
		if len(x[i].index) != len(x[j].index) {
			return len(x[i].index) < len(x[j].index)
		}
		if x[i].tag != x[j].tag {
			return x[i].tag
		}
		return byIndex(x).Less(i, j)
	})

	// Delete all fields that are hidden by the Go rules for embedded fields,
	// except that fields with JSON tags are promoted.

	// The fields are sorted in primary order of name, secondary order
	// of field index length. Loop over names; for each name, delete
	// hidden fields by choosing the one dominant field that survives.
	out := fields[:0]
	for advance, i := 0, 0; i < len(fields); i += advance {
		// One iteration per name.
		// Find the sequence of fields with the name of this first field.
		fi := fields[i]
		name := fi.name
		for advance = 1; i+advance < len(fields); advance++ {
			fj := fields[i+advance]
			if fj.name != name {
				break
			}
		}
		if advance == 1 { // Only one field with this name
			out = append(out, fi)
			continue
		}
		dominant, ok := dominantField(fields[i : i+advance])
		if ok {
			out = append(out, dominant)
		}
	}

	fields = out
	sort.Sort(byIndex(fields))

	nameIndex := make(map[string]int, len(fields))
	for i, field := range fields {
		nameIndex[field.name] = i
	}
	return structFields{fields, nameIndex}
}

// dominantField looks through the fields, all of which are known to
// have the same name, to find the single field that dominates the
// others using Go's embedding rules, modified by the presence of
// JSON tags. If there are multiple top-level fields, the boolean
// will be false: This condition is an error in Go and we skip all
// the fields.
func dominantField(fields []goField) (goField, bool) {
	// The fields are sorted in increasing index-length order, then by presence of tag.
	// That means that the first field is the dominant one. We need only check
	// for error cases: two fields at top level, either both tagged or neither tagged.
	if len(fields) > 1 && len(fields[0].index) == len(fields[1].index) && fields[0].tag == fields[1].tag {
		return goField{}, false
	}
	return fields[0], true
}

var fieldCache sync.Map // map[reflect.Type]structFields

// cachedTypeFields is like typeFields but uses a cache to avoid repeated work.
func cachedTypeFields(t reflect.Type) structFields {
	if f, ok := fieldCache.Load(t); ok {
		return f.(structFields)
	}
	f, _ := fieldCache.LoadOrStore(t, typeFields(t))
	return f.(structFields)
}

// tagOptions is the string following a comma in a struct field's "json"
// tag, or the empty string. It does not include the leading comma.
type tagOptions string

// parseTag splits a struct field's json tag into its name and
// comma-separated options.
func parseTag(tag string) (string, tagOptions) {
	if idx := strings.Index(tag, ","); idx != -1 {
		return tag[:idx], tagOptions(tag[idx+1:])
	}
	return tag, tagOptions("")
}

// Contains reports whether a comma-separated list of options
// contains a particular substr flag. substr must be surrounded by a
// string boundary or commas.
func (o tagOptions) Contains(optionName string) bool {
	if len(o) == 0 {
		return false
	}
	s := string(o)
	for s != "" {
		var next string
		i := strings.Index(s, ",")
		if i >= 0 {
			s, next = s[:i], s[i+1:]
		}
		if s == optionName {
			return true
		}
		s = next
	}
	return false
}

// foldFunc returns one of four different case folding equivalence
// functions, from most general (and slow) to fastest:
//
// 1) bytes.EqualFold, if the key s contains any non-ASCII UTF-8
// 2) equalFoldRight, if s contains special folding ASCII ('k', 'K', 's', 'S')
// 3) asciiEqualFold, no special, but includes non-letters (including _)
// 4) simpleLetterEqualFold, no specials, no non-letters.
//
// The letters S and K are special because they map to 3 runes, not just 2:
//   - S maps to s and to U+017F 'ſ' Latin small letter long s
//   - k maps to K and to U+212A 'K' Kelvin sign
//
// See https://play.golang.org/p/tTxjOc0OGo
//
// The returned function is specialized for matching against s and
// should only be given s. It's not curried for performance reasons.
func foldFunc(s []byte) func(s, t []byte) bool {
	nonLetter := false
	special := false // special letter
	for _, b := range s {
		if b >= utf8.RuneSelf {
			return bytes.EqualFold
		}
		upper := b & caseMask
		if upper < 'A' || upper > 'Z' {
			nonLetter = true
		} else if upper == 'K' || upper == 'S' {
			// See above for why these letters are special.
			special = true
		}
	}
	if special {
		return equalFoldRight
	}
	if nonLetter {
		return asciiEqualFold
	}
	return simpleLetterEqualFold
}

const (
	caseMask     = ^byte(0x20) // Mask to ignore case in ASCII.
	kelvin       = '\u212a'
	smallLongEss = '\u017f'
)

// equalFoldRight is a specialization of bytes.EqualFold when s is
// known to be all ASCII (including punctuation), but contains an 's',
// 'S', 'k', or 'K', requiring a Unicode fold on the bytes in t.
// See comments on foldFunc.
func equalFoldRight(s, t []byte) bool {
	for _, sb := range s {
		if len(t) == 0 {
			return false
		}
		tb := t[0]
		if tb < utf8.RuneSelf {
			if sb != tb {
				sbUpper := sb & caseMask
				if 'A' <= sbUpper && sbUpper <= 'Z' {
					if sbUpper != tb&caseMask {
						return false
					}
				} else {
					return false
				}
			}
			t = t[1:]
			continue
		}
		// sb is ASCII and t is not. t must be either kelvin
		// sign or long s; sb must be s, S, k, or K.
		tr, size := utf8.DecodeRune(t)
		switch sb {
		case 's', 'S':
			if tr != smallLongEss {
				return false
			}
		case 'k', 'K':
			if tr != kelvin {
				return false
			}
		default:
			return false
		}
		t = t[size:]

	}
	if len(t) > 0 {
		return false
	}
	return true
}

// asciiEqualFold is a specialization of bytes.EqualFold for use when
// s is all ASCII (but may contain non-letters) and contains no
// special-folding letters.
// See comments on foldFunc.
func asciiEqualFold(s, t []byte) bool {
	if len(s) != len(t) {
		return false
	}
	for i, sb := range s {
		tb := t[i]
		if sb == tb {
			continue
		}
		if ('a' <= sb && sb <= 'z') || ('A' <= sb && sb <= 'Z') {
			if sb&caseMask != tb&caseMask {
				return false
			}
		} else {
			return false
		}
	}
	return true
}

// simpleLetterEqualFold is a specialization of bytes.EqualFold for
// use when s is all ASCII letters (no underscores, etc) and also
// doesn't contain 'k', 'K', 's', or 'S'.
// See comments on foldFunc.
func simpleLetterEqualFold(s, t []byte) bool {
	if len(s) != len(t) {
		return false
	}
	for i, b := range s {
		if b&caseMask != t[i]&caseMask {
			return false
		}
	}
	return true
}

// indirect walks down v allocating pointers as needed,
// until it gets to a non-pointer.
// If it encounters an Unmarshaler, indirect stops and returns that.
// If decodingNull is true, indirect stops at the first settable pointer so it
// can be set to nil.
func indirect(v reflect.Value, decodingNull bool) (json.Unmarshaler, encoding.TextUnmarshaler, reflect.Value) {
	// Issue #24153 indicates that it is generally not a guaranteed property
	// that you may round-trip a reflect.Value by calling Value.Addr().Elem()
	// and expect the value to still be settable for values derived from
	// unexported embedded struct fields.
	//
	// The logic below effectively does this when it first addresses the value
	// (to satisfy possible pointer methods) and continues to dereference
	// subsequent pointers as necessary.
	//
	// After the first round-trip, we set v back to the original value to
	// preserve the original RW flags contained in reflect.Value.
	v0 := v
	haveAddr := false

	// If v is a named type and is addressable,
	// start with its address, so that if the type has pointer methods,
	// we find them.
	if v.Kind() != reflect.Ptr && v.Type().Name() != "" && v.CanAddr() {
		haveAddr = true
		v = v.Addr()
	}
	for {
		// Load value from interface, but only if the result will be
		// usefully addressable.
		if v.Kind() == reflect.Interface && !v.IsNil() {
			e := v.Elem()
			if e.Kind() == reflect.Ptr && !e.IsNil() && (!decodingNull || e.Elem().Kind() == reflect.Ptr) {
				haveAddr = false
				v = e
				continue
			}
		}

		if v.Kind() != reflect.Ptr {
			break
		}

		if decodingNull && v.CanSet() {
			break
		}

		// Prevent infinite loop if v is an interface pointing to its own address:
		//     var v interface{}
		//     v = &v
		if v.Elem().Kind() == reflect.Interface && v.Elem().Elem() == v {
			v = v.Elem()
			break
		}
		if v.IsNil() {
			v.Set(reflect.New(v.Type().Elem()))
		}
		if v.Type().NumMethod() > 0 && v.CanInterface() {
			if u, ok := v.Interface().(json.Unmarshaler); ok {
				return u, nil, reflect.Value{}
			}
			if !decodingNull {
				if u, ok := v.Interface().(encoding.TextUnmarshaler); ok {
					return nil, u, reflect.Value{}
				}
			}
		}

		if haveAddr {
			v = v0 // restore original value after round-trip Value.Addr().Elem()
			haveAddr = false
		} else {
			v = v.Elem()
		}
	}
	return nil, nil, v
}
