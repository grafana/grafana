// Copyright 4 Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package datastore

import (
	"errors"
	"fmt"
	"reflect"
	"time"
	"unicode/utf8"

	timepb "github.com/golang/protobuf/ptypes/timestamp"
	pb "google.golang.org/genproto/googleapis/datastore/v1"
	llpb "google.golang.org/genproto/googleapis/type/latlng"
)

type saveOpts struct {
	noIndex   bool
	flatten   bool
	omitEmpty bool
}

// saveEntity saves an EntityProto into a PropertyLoadSaver or struct pointer.
func saveEntity(key *Key, src interface{}) (*pb.Entity, error) {
	var err error
	var props []Property
	if e, ok := src.(PropertyLoadSaver); ok {
		props, err = e.Save()
	} else {
		props, err = SaveStruct(src)
	}
	if err != nil {
		return nil, err
	}
	return propertiesToProto(key, props)
}

// TODO(djd): Convert this and below to return ([]Property, error).
func saveStructProperty(props *[]Property, name string, opts saveOpts, v reflect.Value) error {
	p := Property{
		Name:    name,
		NoIndex: opts.noIndex,
	}

	if opts.omitEmpty && isEmptyValue(v) {
		return nil
	}

	// First check if field type implements PLS. If so, use PLS to
	// save.
	ok, err := plsFieldSave(props, p, name, opts, v)
	if err != nil {
		return err
	}
	if ok {
		return nil
	}

	switch x := v.Interface().(type) {
	case *Key, time.Time, GeoPoint:
		p.Value = x
	default:
		switch v.Kind() {
		case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
			p.Value = v.Int()
		case reflect.Bool:
			p.Value = v.Bool()
		case reflect.String:
			p.Value = v.String()
		case reflect.Float32, reflect.Float64:
			p.Value = v.Float()
		case reflect.Slice:
			if v.Type().Elem().Kind() == reflect.Uint8 {
				p.Value = v.Bytes()
			} else {
				return saveSliceProperty(props, name, opts, v)
			}
		case reflect.Ptr:
			if v.Type().Elem().Kind() != reflect.Struct {
				return fmt.Errorf("datastore: unsupported struct field type: %s", v.Type())
			}
			if v.IsNil() {
				return nil
			}
			v = v.Elem()
			fallthrough
		case reflect.Struct:
			if !v.CanAddr() {
				return fmt.Errorf("datastore: unsupported struct field: value is unaddressable")
			}
			vi := v.Addr().Interface()

			sub, err := newStructPLS(vi)
			if err != nil {
				return fmt.Errorf("datastore: unsupported struct field: %v", err)
			}

			if opts.flatten {
				return sub.save(props, opts, name+".")
			}

			var subProps []Property
			err = sub.save(&subProps, opts, "")
			if err != nil {
				return err
			}
			subKey, err := sub.key(v)
			if err != nil {
				return err
			}

			p.Value = &Entity{
				Key:        subKey,
				Properties: subProps,
			}
		}
	}
	if p.Value == nil {
		return fmt.Errorf("datastore: unsupported struct field type: %v", v.Type())
	}
	*props = append(*props, p)
	return nil
}

// plsFieldSave first tries to converts v's value to a PLS, then v's addressed
// value to a PLS. If neither succeeds, plsFieldSave returns false for first return
// value.
// If v is successfully converted to a PLS, plsFieldSave will then add the
// Value to property p by way of the PLS's Save method, and append it to props.
//
// If the flatten option is present in opts, name must be prepended to each property's
// name before it is appended to props. Eg. if name were "A" and a subproperty's name
// were "B", the resultant name of the property to be appended to props would be "A.B".
func plsFieldSave(props *[]Property, p Property, name string, opts saveOpts, v reflect.Value) (ok bool, err error) {
	vpls, err := plsForSave(v)
	if err != nil {
		return false, err
	}

	if vpls == nil {
		return false, nil
	}

	subProps, err := vpls.Save()
	if err != nil {
		return true, err
	}

	if opts.flatten {
		for _, subp := range subProps {
			subp.Name = name + "." + subp.Name
			*props = append(*props, subp)
		}
		return true, nil
	}

	p.Value = &Entity{Properties: subProps}
	*props = append(*props, p)

	return true, nil
}

// key extracts the *Key struct field from struct v based on the structCodec of s.
func (s structPLS) key(v reflect.Value) (*Key, error) {
	if v.Kind() != reflect.Struct {
		return nil, errors.New("datastore: cannot save key of non-struct type")
	}

	keyField := s.codec.Match(keyFieldName)

	if keyField == nil {
		return nil, nil
	}

	f := v.FieldByIndex(keyField.Index)
	k, ok := f.Interface().(*Key)
	if !ok {
		return nil, fmt.Errorf("datastore: %s field on struct %T is not a *datastore.Key", keyFieldName, v.Interface())
	}

	return k, nil
}

func saveSliceProperty(props *[]Property, name string, opts saveOpts, v reflect.Value) error {
	// Easy case: if the slice is empty, we're done.
	if v.Len() == 0 {
		return nil
	}
	// Work out the properties generated by the first element in the slice. This will
	// usually be a single property, but will be more if this is a slice of structs.
	var headProps []Property
	if err := saveStructProperty(&headProps, name, opts, v.Index(0)); err != nil {
		return err
	}

	// Convert the first element's properties into slice properties, and
	// keep track of the values in a map.
	values := make(map[string][]interface{}, len(headProps))
	for _, p := range headProps {
		values[p.Name] = append(make([]interface{}, 0, v.Len()), p.Value)
	}

	// Find the elements for the subsequent elements.
	for i := 1; i < v.Len(); i++ {
		elemProps := make([]Property, 0, len(headProps))
		if err := saveStructProperty(&elemProps, name, opts, v.Index(i)); err != nil {
			return err
		}
		for _, p := range elemProps {
			v, ok := values[p.Name]
			if !ok {
				return fmt.Errorf("datastore: unexpected property %q in elem %d of slice", p.Name, i)
			}
			values[p.Name] = append(v, p.Value)
		}
	}

	// Convert to the final properties.
	for _, p := range headProps {
		p.Value = values[p.Name]
		*props = append(*props, p)
	}
	return nil
}

func (s structPLS) Save() ([]Property, error) {
	var props []Property
	if err := s.save(&props, saveOpts{}, ""); err != nil {
		return nil, err
	}
	return props, nil
}

func (s structPLS) save(props *[]Property, opts saveOpts, prefix string) error {
	for _, f := range s.codec {
		name := prefix + f.Name
		v := getField(s.v, f.Index)
		if !v.IsValid() || !v.CanSet() {
			continue
		}

		var tagOpts saveOpts
		if f.ParsedTag != nil {
			tagOpts = f.ParsedTag.(saveOpts)
		}

		var opts1 saveOpts
		opts1.noIndex = opts.noIndex || tagOpts.noIndex
		opts1.flatten = opts.flatten || tagOpts.flatten
		opts1.omitEmpty = tagOpts.omitEmpty // don't propagate
		if err := saveStructProperty(props, name, opts1, v); err != nil {
			return err
		}
	}
	return nil
}

// getField returns the field from v at the given index path.
// If it encounters a nil-valued field in the path, getField
// stops and returns a zero-valued reflect.Value, preventing the
// panic that would have been caused by reflect's FieldByIndex.
func getField(v reflect.Value, index []int) reflect.Value {
	var zero reflect.Value
	if v.Type().Kind() != reflect.Struct {
		return zero
	}

	for _, i := range index {
		if v.Kind() == reflect.Ptr && v.Type().Elem().Kind() == reflect.Struct {
			if v.IsNil() {
				return zero
			}
			v = v.Elem()
		}
		v = v.Field(i)
	}
	return v
}

func propertiesToProto(key *Key, props []Property) (*pb.Entity, error) {
	e := &pb.Entity{
		Key:        keyToProto(key),
		Properties: map[string]*pb.Value{},
	}
	indexedProps := 0
	for _, p := range props {
		// Do not send a Key value a a field to datastore.
		if p.Name == keyFieldName {
			continue
		}

		val, err := interfaceToProto(p.Value, p.NoIndex)
		if err != nil {
			return nil, fmt.Errorf("datastore: %v for a Property with Name %q", err, p.Name)
		}
		if !p.NoIndex {
			rVal := reflect.ValueOf(p.Value)
			if rVal.Kind() == reflect.Slice && rVal.Type().Elem().Kind() != reflect.Uint8 {
				indexedProps += rVal.Len()
			} else {
				indexedProps++
			}
		}
		if indexedProps > maxIndexedProperties {
			return nil, errors.New("datastore: too many indexed properties")
		}

		if _, ok := e.Properties[p.Name]; ok {
			return nil, fmt.Errorf("datastore: duplicate Property with Name %q", p.Name)
		}
		e.Properties[p.Name] = val
	}
	return e, nil
}

func interfaceToProto(iv interface{}, noIndex bool) (*pb.Value, error) {
	val := &pb.Value{ExcludeFromIndexes: noIndex}
	switch v := iv.(type) {
	case int:
		val.ValueType = &pb.Value_IntegerValue{IntegerValue: int64(v)}
	case int32:
		val.ValueType = &pb.Value_IntegerValue{IntegerValue: int64(v)}
	case int64:
		val.ValueType = &pb.Value_IntegerValue{IntegerValue: v}
	case bool:
		val.ValueType = &pb.Value_BooleanValue{BooleanValue: v}
	case string:
		if len(v) > 1500 && !noIndex {
			return nil, errors.New("string property too long to index")
		}
		if !utf8.ValidString(v) {
			return nil, fmt.Errorf("string is not valid utf8: %q", v)
		}
		val.ValueType = &pb.Value_StringValue{StringValue: v}
	case float32:
		val.ValueType = &pb.Value_DoubleValue{DoubleValue: float64(v)}
	case float64:
		val.ValueType = &pb.Value_DoubleValue{DoubleValue: v}
	case *Key:
		if v == nil {
			val.ValueType = &pb.Value_NullValue{}
		} else {
			val.ValueType = &pb.Value_KeyValue{KeyValue: keyToProto(v)}
		}
	case GeoPoint:
		if !v.Valid() {
			return nil, errors.New("invalid GeoPoint value")
		}
		val.ValueType = &pb.Value_GeoPointValue{GeoPointValue: &llpb.LatLng{
			Latitude:  v.Lat,
			Longitude: v.Lng,
		}}
	case time.Time:
		if v.Before(minTime) || v.After(maxTime) {
			return nil, errors.New("time value out of range")
		}
		val.ValueType = &pb.Value_TimestampValue{TimestampValue: &timepb.Timestamp{
			Seconds: v.Unix(),
			Nanos:   int32(v.Nanosecond()),
		}}
	case []byte:
		if len(v) > 1500 && !noIndex {
			return nil, errors.New("[]byte property too long to index")
		}
		val.ValueType = &pb.Value_BlobValue{BlobValue: v}
	case *Entity:
		e, err := propertiesToProto(v.Key, v.Properties)
		if err != nil {
			return nil, err
		}
		val.ValueType = &pb.Value_EntityValue{EntityValue: e}
	case []interface{}:
		arr := make([]*pb.Value, 0, len(v))
		for i, v := range v {
			elem, err := interfaceToProto(v, noIndex)
			if err != nil {
				return nil, fmt.Errorf("%v at index %d", err, i)
			}
			arr = append(arr, elem)
		}
		val.ValueType = &pb.Value_ArrayValue{ArrayValue: &pb.ArrayValue{Values: arr}}
		// ArrayValues have ExcludeFromIndexes set on the individual items, rather
		// than the top-level value.
		val.ExcludeFromIndexes = false
	default:
		if iv != nil {
			return nil, fmt.Errorf("invalid Value type %t", iv)
		}
		val.ValueType = &pb.Value_NullValue{}
	}
	// TODO(jbd): Support EntityValue.
	return val, nil
}

// isEmptyValue is taken from the encoding/json package in the
// standard library.
func isEmptyValue(v reflect.Value) bool {
	switch v.Kind() {
	case reflect.Array, reflect.Map, reflect.Slice, reflect.String:
		return v.Len() == 0
	case reflect.Bool:
		return !v.Bool()
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return v.Int() == 0
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Uintptr:
		return v.Uint() == 0
	case reflect.Float32, reflect.Float64:
		return v.Float() == 0
	case reflect.Interface, reflect.Ptr:
		return v.IsNil()
	}
	return false
}
