// Copyright (C) MongoDB, Inc. 2017-present.
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

package bsoncodec

import (
	"errors"
	"fmt"
	"reflect"
	"sort"
	"strings"
	"sync"
	"time"

	"go.mongodb.org/mongo-driver/bson/bsonoptions"
	"go.mongodb.org/mongo-driver/bson/bsonrw"
	"go.mongodb.org/mongo-driver/bson/bsontype"
)

// DecodeError represents an error that occurs when unmarshalling BSON bytes into a native Go type.
type DecodeError struct {
	keys    []string
	wrapped error
}

// Unwrap returns the underlying error
func (de *DecodeError) Unwrap() error {
	return de.wrapped
}

// Error implements the error interface.
func (de *DecodeError) Error() string {
	// The keys are stored in reverse order because the de.keys slice is builtup while propagating the error up the
	// stack of BSON keys, so we call de.Keys(), which reverses them.
	keyPath := strings.Join(de.Keys(), ".")
	return fmt.Sprintf("error decoding key %s: %v", keyPath, de.wrapped)
}

// Keys returns the BSON key path that caused an error as a slice of strings. The keys in the slice are in top-down
// order. For example, if the document being unmarshalled was {a: {b: {c: 1}}} and the value for c was supposed to be
// a string, the keys slice will be ["a", "b", "c"].
func (de *DecodeError) Keys() []string {
	reversedKeys := make([]string, 0, len(de.keys))
	for idx := len(de.keys) - 1; idx >= 0; idx-- {
		reversedKeys = append(reversedKeys, de.keys[idx])
	}

	return reversedKeys
}

// Zeroer allows custom struct types to implement a report of zero
// state. All struct types that don't implement Zeroer or where IsZero
// returns false are considered to be not zero.
type Zeroer interface {
	IsZero() bool
}

// StructCodec is the Codec used for struct values.
//
// Deprecated: StructCodec will not be directly configurable in Go Driver 2.0.
// To configure the struct encode and decode behavior, use the configuration
// methods on a [go.mongodb.org/mongo-driver/bson.Encoder] or
// [go.mongodb.org/mongo-driver/bson.Decoder]. To configure the struct encode
// and decode behavior for a mongo.Client, use
// [go.mongodb.org/mongo-driver/mongo/options.ClientOptions.SetBSONOptions].
//
// For example, to configure a mongo.Client to omit zero-value structs when
// using the "omitempty" struct tag, use:
//
//	opt := options.Client().SetBSONOptions(&options.BSONOptions{
//	    OmitZeroStruct: true,
//	})
//
// See the deprecation notice for each field in StructCodec for the corresponding
// settings.
type StructCodec struct {
	cache  sync.Map // map[reflect.Type]*structDescription
	parser StructTagParser

	// DecodeZeroStruct causes DecodeValue to delete any existing values from Go structs in the
	// destination value passed to Decode before unmarshaling BSON documents into them.
	//
	// Deprecated: Use bson.Decoder.ZeroStructs or options.BSONOptions.ZeroStructs instead.
	DecodeZeroStruct bool

	// DecodeDeepZeroInline causes DecodeValue to delete any existing values from Go structs in the
	// destination value passed to Decode before unmarshaling BSON documents into them.
	//
	// Deprecated: DecodeDeepZeroInline will not be supported in Go Driver 2.0.
	DecodeDeepZeroInline bool

	// EncodeOmitDefaultStruct causes the Encoder to consider the zero value for a struct (e.g.
	// MyStruct{}) as empty and omit it from the marshaled BSON when the "omitempty" struct tag
	// option is set.
	//
	// Deprecated: Use bson.Encoder.OmitZeroStruct or options.BSONOptions.OmitZeroStruct instead.
	EncodeOmitDefaultStruct bool

	// AllowUnexportedFields allows encoding and decoding values from un-exported struct fields.
	//
	// Deprecated: AllowUnexportedFields does not work on recent versions of Go and will not be
	// supported in Go Driver 2.0.
	AllowUnexportedFields bool

	// OverwriteDuplicatedInlinedFields, if false, causes EncodeValue to return an error if there is
	// a duplicate field in the marshaled BSON when the "inline" struct tag option is set. The
	// default value is true.
	//
	// Deprecated: Use bson.Encoder.ErrorOnInlineDuplicates or
	// options.BSONOptions.ErrorOnInlineDuplicates instead.
	OverwriteDuplicatedInlinedFields bool
}

var _ ValueEncoder = &StructCodec{}
var _ ValueDecoder = &StructCodec{}

// NewStructCodec returns a StructCodec that uses p for struct tag parsing.
//
// Deprecated: NewStructCodec will not be available in Go Driver 2.0. See
// [StructCodec] for more details.
func NewStructCodec(p StructTagParser, opts ...*bsonoptions.StructCodecOptions) (*StructCodec, error) {
	if p == nil {
		return nil, errors.New("a StructTagParser must be provided to NewStructCodec")
	}

	structOpt := bsonoptions.MergeStructCodecOptions(opts...)

	codec := &StructCodec{
		parser: p,
	}

	if structOpt.DecodeZeroStruct != nil {
		codec.DecodeZeroStruct = *structOpt.DecodeZeroStruct
	}
	if structOpt.DecodeDeepZeroInline != nil {
		codec.DecodeDeepZeroInline = *structOpt.DecodeDeepZeroInline
	}
	if structOpt.EncodeOmitDefaultStruct != nil {
		codec.EncodeOmitDefaultStruct = *structOpt.EncodeOmitDefaultStruct
	}
	if structOpt.OverwriteDuplicatedInlinedFields != nil {
		codec.OverwriteDuplicatedInlinedFields = *structOpt.OverwriteDuplicatedInlinedFields
	}
	if structOpt.AllowUnexportedFields != nil {
		codec.AllowUnexportedFields = *structOpt.AllowUnexportedFields
	}

	return codec, nil
}

// EncodeValue handles encoding generic struct types.
func (sc *StructCodec) EncodeValue(ec EncodeContext, vw bsonrw.ValueWriter, val reflect.Value) error {
	if !val.IsValid() || val.Kind() != reflect.Struct {
		return ValueEncoderError{Name: "StructCodec.EncodeValue", Kinds: []reflect.Kind{reflect.Struct}, Received: val}
	}

	sd, err := sc.describeStruct(ec.Registry, val.Type(), ec.useJSONStructTags, ec.errorOnInlineDuplicates)
	if err != nil {
		return err
	}

	dw, err := vw.WriteDocument()
	if err != nil {
		return err
	}
	var rv reflect.Value
	for _, desc := range sd.fl {
		if desc.inline == nil {
			rv = val.Field(desc.idx)
		} else {
			rv, err = fieldByIndexErr(val, desc.inline)
			if err != nil {
				continue
			}
		}

		desc.encoder, rv, err = defaultValueEncoders.lookupElementEncoder(ec, desc.encoder, rv)

		if err != nil && !errors.Is(err, errInvalidValue) {
			return err
		}

		if errors.Is(err, errInvalidValue) {
			if desc.omitEmpty {
				continue
			}
			vw2, err := dw.WriteDocumentElement(desc.name)
			if err != nil {
				return err
			}
			err = vw2.WriteNull()
			if err != nil {
				return err
			}
			continue
		}

		if desc.encoder == nil {
			return ErrNoEncoder{Type: rv.Type()}
		}

		encoder := desc.encoder

		var empty bool
		if cz, ok := encoder.(CodecZeroer); ok {
			empty = cz.IsTypeZero(rv.Interface())
		} else if rv.Kind() == reflect.Interface {
			// isEmpty will not treat an interface rv as an interface, so we need to check for the
			// nil interface separately.
			empty = rv.IsNil()
		} else {
			empty = isEmpty(rv, sc.EncodeOmitDefaultStruct || ec.omitZeroStruct)
		}
		if desc.omitEmpty && empty {
			continue
		}

		vw2, err := dw.WriteDocumentElement(desc.name)
		if err != nil {
			return err
		}

		ectx := EncodeContext{
			Registry:                ec.Registry,
			MinSize:                 desc.minSize || ec.MinSize,
			errorOnInlineDuplicates: ec.errorOnInlineDuplicates,
			stringifyMapKeysWithFmt: ec.stringifyMapKeysWithFmt,
			nilMapAsEmpty:           ec.nilMapAsEmpty,
			nilSliceAsEmpty:         ec.nilSliceAsEmpty,
			nilByteSliceAsEmpty:     ec.nilByteSliceAsEmpty,
			omitZeroStruct:          ec.omitZeroStruct,
			useJSONStructTags:       ec.useJSONStructTags,
		}
		err = encoder.EncodeValue(ectx, vw2, rv)
		if err != nil {
			return err
		}
	}

	if sd.inlineMap >= 0 {
		rv := val.Field(sd.inlineMap)
		collisionFn := func(key string) bool {
			_, exists := sd.fm[key]
			return exists
		}

		return defaultMapCodec.mapEncodeValue(ec, dw, rv, collisionFn)
	}

	return dw.WriteDocumentEnd()
}

func newDecodeError(key string, original error) error {
	var de *DecodeError
	if !errors.As(original, &de) {
		return &DecodeError{
			keys:    []string{key},
			wrapped: original,
		}
	}

	de.keys = append(de.keys, key)
	return de
}

// DecodeValue implements the Codec interface.
// By default, map types in val will not be cleared. If a map has existing key/value pairs, it will be extended with the new ones from vr.
// For slices, the decoder will set the length of the slice to zero and append all elements. The underlying array will not be cleared.
func (sc *StructCodec) DecodeValue(dc DecodeContext, vr bsonrw.ValueReader, val reflect.Value) error {
	if !val.CanSet() || val.Kind() != reflect.Struct {
		return ValueDecoderError{Name: "StructCodec.DecodeValue", Kinds: []reflect.Kind{reflect.Struct}, Received: val}
	}

	switch vrType := vr.Type(); vrType {
	case bsontype.Type(0), bsontype.EmbeddedDocument:
	case bsontype.Null:
		if err := vr.ReadNull(); err != nil {
			return err
		}

		val.Set(reflect.Zero(val.Type()))
		return nil
	case bsontype.Undefined:
		if err := vr.ReadUndefined(); err != nil {
			return err
		}

		val.Set(reflect.Zero(val.Type()))
		return nil
	default:
		return fmt.Errorf("cannot decode %v into a %s", vrType, val.Type())
	}

	sd, err := sc.describeStruct(dc.Registry, val.Type(), dc.useJSONStructTags, false)
	if err != nil {
		return err
	}

	if sc.DecodeZeroStruct || dc.zeroStructs {
		val.Set(reflect.Zero(val.Type()))
	}
	if sc.DecodeDeepZeroInline && sd.inline {
		val.Set(deepZero(val.Type()))
	}

	var decoder ValueDecoder
	var inlineMap reflect.Value
	if sd.inlineMap >= 0 {
		inlineMap = val.Field(sd.inlineMap)
		decoder, err = dc.LookupDecoder(inlineMap.Type().Elem())
		if err != nil {
			return err
		}
	}

	dr, err := vr.ReadDocument()
	if err != nil {
		return err
	}

	for {
		name, vr, err := dr.ReadElement()
		if errors.Is(err, bsonrw.ErrEOD) {
			break
		}
		if err != nil {
			return err
		}

		fd, exists := sd.fm[name]
		if !exists {
			// if the original name isn't found in the struct description, try again with the name in lowercase
			// this could match if a BSON tag isn't specified because by default, describeStruct lowercases all field
			// names
			fd, exists = sd.fm[strings.ToLower(name)]
		}

		if !exists {
			if sd.inlineMap < 0 {
				// The encoding/json package requires a flag to return on error for non-existent fields.
				// This functionality seems appropriate for the struct codec.
				err = vr.Skip()
				if err != nil {
					return err
				}
				continue
			}

			if inlineMap.IsNil() {
				inlineMap.Set(reflect.MakeMap(inlineMap.Type()))
			}

			elem := reflect.New(inlineMap.Type().Elem()).Elem()
			dc.Ancestor = inlineMap.Type()
			err = decoder.DecodeValue(dc, vr, elem)
			if err != nil {
				return err
			}
			inlineMap.SetMapIndex(reflect.ValueOf(name), elem)
			continue
		}

		var field reflect.Value
		if fd.inline == nil {
			field = val.Field(fd.idx)
		} else {
			field, err = getInlineField(val, fd.inline)
			if err != nil {
				return err
			}
		}

		if !field.CanSet() { // Being settable is a super set of being addressable.
			innerErr := fmt.Errorf("field %v is not settable", field)
			return newDecodeError(fd.name, innerErr)
		}
		if field.Kind() == reflect.Ptr && field.IsNil() {
			field.Set(reflect.New(field.Type().Elem()))
		}
		field = field.Addr()

		dctx := DecodeContext{
			Registry:            dc.Registry,
			Truncate:            fd.truncate || dc.Truncate,
			defaultDocumentType: dc.defaultDocumentType,
			binaryAsSlice:       dc.binaryAsSlice,
			useJSONStructTags:   dc.useJSONStructTags,
			useLocalTimeZone:    dc.useLocalTimeZone,
			zeroMaps:            dc.zeroMaps,
			zeroStructs:         dc.zeroStructs,
		}

		if fd.decoder == nil {
			return newDecodeError(fd.name, ErrNoDecoder{Type: field.Elem().Type()})
		}

		err = fd.decoder.DecodeValue(dctx, vr, field.Elem())
		if err != nil {
			return newDecodeError(fd.name, err)
		}
	}

	return nil
}

func isEmpty(v reflect.Value, omitZeroStruct bool) bool {
	kind := v.Kind()
	if (kind != reflect.Ptr || !v.IsNil()) && v.Type().Implements(tZeroer) {
		return v.Interface().(Zeroer).IsZero()
	}
	switch kind {
	case reflect.Array, reflect.Map, reflect.Slice, reflect.String:
		return v.Len() == 0
	case reflect.Struct:
		if !omitZeroStruct {
			return false
		}
		vt := v.Type()
		if vt == tTime {
			return v.Interface().(time.Time).IsZero()
		}
		numField := vt.NumField()
		for i := 0; i < numField; i++ {
			ff := vt.Field(i)
			if ff.PkgPath != "" && !ff.Anonymous {
				continue // Private field
			}
			if !isEmpty(v.Field(i), omitZeroStruct) {
				return false
			}
		}
		return true
	}
	return !v.IsValid() || v.IsZero()
}

type structDescription struct {
	fm        map[string]fieldDescription
	fl        []fieldDescription
	inlineMap int
	inline    bool
}

type fieldDescription struct {
	name      string // BSON key name
	fieldName string // struct field name
	idx       int
	omitEmpty bool
	minSize   bool
	truncate  bool
	inline    []int
	encoder   ValueEncoder
	decoder   ValueDecoder
}

type byIndex []fieldDescription

func (bi byIndex) Len() int { return len(bi) }

func (bi byIndex) Swap(i, j int) { bi[i], bi[j] = bi[j], bi[i] }

func (bi byIndex) Less(i, j int) bool {
	// If a field is inlined, its index in the top level struct is stored at inline[0]
	iIdx, jIdx := bi[i].idx, bi[j].idx
	if len(bi[i].inline) > 0 {
		iIdx = bi[i].inline[0]
	}
	if len(bi[j].inline) > 0 {
		jIdx = bi[j].inline[0]
	}
	if iIdx != jIdx {
		return iIdx < jIdx
	}
	for k, biik := range bi[i].inline {
		if k >= len(bi[j].inline) {
			return false
		}
		if biik != bi[j].inline[k] {
			return biik < bi[j].inline[k]
		}
	}
	return len(bi[i].inline) < len(bi[j].inline)
}

func (sc *StructCodec) describeStruct(
	r *Registry,
	t reflect.Type,
	useJSONStructTags bool,
	errorOnDuplicates bool,
) (*structDescription, error) {
	// We need to analyze the struct, including getting the tags, collecting
	// information about inlining, and create a map of the field name to the field.
	if v, ok := sc.cache.Load(t); ok {
		return v.(*structDescription), nil
	}
	// TODO(charlie): Only describe the struct once when called
	// concurrently with the same type.
	ds, err := sc.describeStructSlow(r, t, useJSONStructTags, errorOnDuplicates)
	if err != nil {
		return nil, err
	}
	if v, loaded := sc.cache.LoadOrStore(t, ds); loaded {
		ds = v.(*structDescription)
	}
	return ds, nil
}

func (sc *StructCodec) describeStructSlow(
	r *Registry,
	t reflect.Type,
	useJSONStructTags bool,
	errorOnDuplicates bool,
) (*structDescription, error) {
	numFields := t.NumField()
	sd := &structDescription{
		fm:        make(map[string]fieldDescription, numFields),
		fl:        make([]fieldDescription, 0, numFields),
		inlineMap: -1,
	}

	var fields []fieldDescription
	for i := 0; i < numFields; i++ {
		sf := t.Field(i)
		if sf.PkgPath != "" && (!sc.AllowUnexportedFields || !sf.Anonymous) {
			// field is private or unexported fields aren't allowed, ignore
			continue
		}

		sfType := sf.Type
		encoder, err := r.LookupEncoder(sfType)
		if err != nil {
			encoder = nil
		}
		decoder, err := r.LookupDecoder(sfType)
		if err != nil {
			decoder = nil
		}

		description := fieldDescription{
			fieldName: sf.Name,
			idx:       i,
			encoder:   encoder,
			decoder:   decoder,
		}

		var stags StructTags
		// If the caller requested that we use JSON struct tags, use the JSONFallbackStructTagParser
		// instead of the parser defined on the codec.
		if useJSONStructTags {
			stags, err = JSONFallbackStructTagParser.ParseStructTags(sf)
		} else {
			stags, err = sc.parser.ParseStructTags(sf)
		}
		if err != nil {
			return nil, err
		}
		if stags.Skip {
			continue
		}
		description.name = stags.Name
		description.omitEmpty = stags.OmitEmpty
		description.minSize = stags.MinSize
		description.truncate = stags.Truncate

		if stags.Inline {
			sd.inline = true
			switch sfType.Kind() {
			case reflect.Map:
				if sd.inlineMap >= 0 {
					return nil, errors.New("(struct " + t.String() + ") multiple inline maps")
				}
				if sfType.Key() != tString {
					return nil, errors.New("(struct " + t.String() + ") inline map must have a string keys")
				}
				sd.inlineMap = description.idx
			case reflect.Ptr:
				sfType = sfType.Elem()
				if sfType.Kind() != reflect.Struct {
					return nil, fmt.Errorf("(struct %s) inline fields must be a struct, a struct pointer, or a map", t.String())
				}
				fallthrough
			case reflect.Struct:
				inlinesf, err := sc.describeStruct(r, sfType, useJSONStructTags, errorOnDuplicates)
				if err != nil {
					return nil, err
				}
				for _, fd := range inlinesf.fl {
					if fd.inline == nil {
						fd.inline = []int{i, fd.idx}
					} else {
						fd.inline = append([]int{i}, fd.inline...)
					}
					fields = append(fields, fd)

				}
			default:
				return nil, fmt.Errorf("(struct %s) inline fields must be a struct, a struct pointer, or a map", t.String())
			}
			continue
		}
		fields = append(fields, description)
	}

	// Sort fieldDescriptions by name and use dominance rules to determine which should be added for each name
	sort.Slice(fields, func(i, j int) bool {
		x := fields
		// sort field by name, breaking ties with depth, then
		// breaking ties with index sequence.
		if x[i].name != x[j].name {
			return x[i].name < x[j].name
		}
		if len(x[i].inline) != len(x[j].inline) {
			return len(x[i].inline) < len(x[j].inline)
		}
		return byIndex(x).Less(i, j)
	})

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
			sd.fl = append(sd.fl, fi)
			sd.fm[name] = fi
			continue
		}
		dominant, ok := dominantField(fields[i : i+advance])
		if !ok || !sc.OverwriteDuplicatedInlinedFields || errorOnDuplicates {
			return nil, fmt.Errorf("struct %s has duplicated key %s", t.String(), name)
		}
		sd.fl = append(sd.fl, dominant)
		sd.fm[name] = dominant
	}

	sort.Sort(byIndex(sd.fl))

	return sd, nil
}

// dominantField looks through the fields, all of which are known to
// have the same name, to find the single field that dominates the
// others using Go's inlining rules. If there are multiple top-level
// fields, the boolean will be false: This condition is an error in Go
// and we skip all the fields.
func dominantField(fields []fieldDescription) (fieldDescription, bool) {
	// The fields are sorted in increasing index-length order, then by presence of tag.
	// That means that the first field is the dominant one. We need only check
	// for error cases: two fields at top level.
	if len(fields) > 1 &&
		len(fields[0].inline) == len(fields[1].inline) {
		return fieldDescription{}, false
	}
	return fields[0], true
}

func fieldByIndexErr(v reflect.Value, index []int) (result reflect.Value, err error) {
	defer func() {
		if recovered := recover(); recovered != nil {
			switch r := recovered.(type) {
			case string:
				err = fmt.Errorf("%s", r)
			case error:
				err = r
			}
		}
	}()

	result = v.FieldByIndex(index)
	return
}

func getInlineField(val reflect.Value, index []int) (reflect.Value, error) {
	field, err := fieldByIndexErr(val, index)
	if err == nil {
		return field, nil
	}

	// if parent of this element doesn't exist, fix its parent
	inlineParent := index[:len(index)-1]
	var fParent reflect.Value
	if fParent, err = fieldByIndexErr(val, inlineParent); err != nil {
		fParent, err = getInlineField(val, inlineParent)
		if err != nil {
			return fParent, err
		}
	}
	fParent.Set(reflect.New(fParent.Type().Elem()))

	return fieldByIndexErr(val, index)
}

// DeepZero returns recursive zero object
func deepZero(st reflect.Type) (result reflect.Value) {
	if st.Kind() == reflect.Struct {
		numField := st.NumField()
		for i := 0; i < numField; i++ {
			if result == emptyValue {
				result = reflect.Indirect(reflect.New(st))
			}
			f := result.Field(i)
			if f.CanInterface() {
				if f.Type().Kind() == reflect.Struct {
					result.Field(i).Set(recursivePointerTo(deepZero(f.Type().Elem())))
				}
			}
		}
	}
	return result
}

// recursivePointerTo calls reflect.New(v.Type) but recursively for its fields inside
func recursivePointerTo(v reflect.Value) reflect.Value {
	v = reflect.Indirect(v)
	result := reflect.New(v.Type())
	if v.Kind() == reflect.Struct {
		for i := 0; i < v.NumField(); i++ {
			if f := v.Field(i); f.Kind() == reflect.Ptr {
				if f.Elem().Kind() == reflect.Struct {
					result.Elem().Field(i).Set(recursivePointerTo(f))
				}
			}
		}
	}

	return result
}
