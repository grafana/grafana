// Copyright 2014 Google Inc. All Rights Reserved.
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
	"fmt"
	"reflect"
	"strings"
	"time"

	"cloud.google.com/go/internal/fields"
	pb "google.golang.org/genproto/googleapis/datastore/v1"
)

var (
	typeOfByteSlice = reflect.TypeOf([]byte(nil))
	typeOfTime      = reflect.TypeOf(time.Time{})
	typeOfGeoPoint  = reflect.TypeOf(GeoPoint{})
	typeOfKeyPtr    = reflect.TypeOf(&Key{})
	typeOfEntityPtr = reflect.TypeOf(&Entity{})
)

// typeMismatchReason returns a string explaining why the property p could not
// be stored in an entity field of type v.Type().
func typeMismatchReason(p Property, v reflect.Value) string {
	entityType := "empty"
	switch p.Value.(type) {
	case int64:
		entityType = "int"
	case bool:
		entityType = "bool"
	case string:
		entityType = "string"
	case float64:
		entityType = "float"
	case *Key:
		entityType = "*datastore.Key"
	case *Entity:
		entityType = "*datastore.Entity"
	case GeoPoint:
		entityType = "GeoPoint"
	case time.Time:
		entityType = "time.Time"
	case []byte:
		entityType = "[]byte"
	}

	return fmt.Sprintf("type mismatch: %s versus %v", entityType, v.Type())
}

type propertyLoader struct {
	// m holds the number of times a substruct field like "Foo.Bar.Baz" has
	// been seen so far. The map is constructed lazily.
	m map[string]int
}

func (l *propertyLoader) load(codec fields.List, structValue reflect.Value, p Property, prev map[string]struct{}) string {
	sl, ok := p.Value.([]interface{})
	if !ok {
		return l.loadOneElement(codec, structValue, p, prev)
	}
	for _, val := range sl {
		p.Value = val
		if errStr := l.loadOneElement(codec, structValue, p, prev); errStr != "" {
			return errStr
		}
	}
	return ""
}

// loadOneElement loads the value of Property p into structValue based on the provided
// codec. codec is used to find the field in structValue into which p should be loaded.
// prev is the set of property names already seen for structValue.
func (l *propertyLoader) loadOneElement(codec fields.List, structValue reflect.Value, p Property, prev map[string]struct{}) string {
	var sliceOk bool
	var sliceIndex int
	var v reflect.Value

	name := p.Name
	fieldNames := strings.Split(name, ".")

	for len(fieldNames) > 0 {
		var field *fields.Field

		// Start by trying to find a field with name. If none found,
		// cut off the last field (delimited by ".") and find its parent
		// in the codec.
		// eg. for name "A.B.C.D", split off "A.B.C" and try to
		// find a field in the codec with this name.
		// Loop again with "A.B", etc.
		for i := len(fieldNames); i > 0; i-- {
			parent := strings.Join(fieldNames[:i], ".")
			field = codec.Match(parent)
			if field != nil {
				fieldNames = fieldNames[i:]
				break
			}
		}

		// If we never found a matching field in the codec, return
		// error message.
		if field == nil {
			return "no such struct field"
		}

		v = initField(structValue, field.Index)
		if !v.IsValid() {
			return "no such struct field"
		}
		if !v.CanSet() {
			return "cannot set struct field"
		}

		// If field implements PLS, we delegate loading to the PLS's Load early,
		// and stop iterating through fields.
		ok, err := plsFieldLoad(v, p, fieldNames)
		if err != nil {
			return err.Error()
		}
		if ok {
			return ""
		}

		if field.Type.Kind() == reflect.Struct {
			codec, err = structCache.Fields(field.Type)
			if err != nil {
				return err.Error()
			}
			structValue = v
		}

		// If the element is a slice, we need to accommodate it.
		if v.Kind() == reflect.Slice && v.Type() != typeOfByteSlice {
			if l.m == nil {
				l.m = make(map[string]int)
			}
			sliceIndex = l.m[p.Name]
			l.m[p.Name] = sliceIndex + 1
			for v.Len() <= sliceIndex {
				v.Set(reflect.Append(v, reflect.New(v.Type().Elem()).Elem()))
			}
			structValue = v.Index(sliceIndex)

			// If structValue implements PLS, we delegate loading to the PLS's
			// Load early, and stop iterating through fields.
			ok, err := plsFieldLoad(structValue, p, fieldNames)
			if err != nil {
				return err.Error()
			}
			if ok {
				return ""
			}

			if structValue.Type().Kind() == reflect.Struct {
				codec, err = structCache.Fields(structValue.Type())
				if err != nil {
					return err.Error()
				}
			}
			sliceOk = true
		}
	}

	var slice reflect.Value
	if v.Kind() == reflect.Slice && v.Type().Elem().Kind() != reflect.Uint8 {
		slice = v
		v = reflect.New(v.Type().Elem()).Elem()
	} else if _, ok := prev[p.Name]; ok && !sliceOk {
		// Zero the field back out that was set previously, turns out
		// it's a slice and we don't know what to do with it
		v.Set(reflect.Zero(v.Type()))
		return "multiple-valued property requires a slice field type"
	}

	prev[p.Name] = struct{}{}

	if errReason := setVal(v, p); errReason != "" {
		// Set the slice back to its zero value.
		if slice.IsValid() {
			slice.Set(reflect.Zero(slice.Type()))
		}
		return errReason
	}

	if slice.IsValid() {
		slice.Index(sliceIndex).Set(v)
	}

	return ""
}

// plsFieldLoad first tries to converts v's value to a PLS, then v's addressed
// value to a PLS. If neither succeeds, plsFieldLoad returns false for first return
// value. Otherwise, the first return value will be true.
// If v is successfully converted to a PLS, plsFieldLoad will then try to Load
// the property p into v (by way of the PLS's Load method).
//
// If the field v has been flattened, the Property's name must be altered
// before calling Load to reflect the field v.
// For example, if our original field name was "A.B.C.D",
// and at this point in iteration we had initialized the field
// corresponding to "A" and have moved into the struct, so that now
// v corresponds to the field named "B", then we want to let the
// PLS handle this field (B)'s subfields ("C", "D"),
// so we send the property to the PLS's Load, renamed to "C.D".
//
// If subfields are present, the field v has been flattened.
func plsFieldLoad(v reflect.Value, p Property, subfields []string) (ok bool, err error) {
	vpls, err := plsForLoad(v)
	if err != nil {
		return false, err
	}

	if vpls == nil {
		return false, nil
	}

	// If Entity, load properties as well as key.
	if e, ok := p.Value.(*Entity); ok {
		err = loadEntity(vpls, e)
		return true, err
	}

	// If flattened, we must alter the property's name to reflect
	// the field v.
	if len(subfields) > 0 {
		p.Name = strings.Join(subfields, ".")
	}

	return true, vpls.Load([]Property{p})
}

// setVal sets 'v' to the value of the Property 'p'.
func setVal(v reflect.Value, p Property) string {
	pValue := p.Value
	switch v.Kind() {
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		x, ok := pValue.(int64)
		if !ok && pValue != nil {
			return typeMismatchReason(p, v)
		}
		if v.OverflowInt(x) {
			return fmt.Sprintf("value %v overflows struct field of type %v", x, v.Type())
		}
		v.SetInt(x)
	case reflect.Bool:
		x, ok := pValue.(bool)
		if !ok && pValue != nil {
			return typeMismatchReason(p, v)
		}
		v.SetBool(x)
	case reflect.String:
		x, ok := pValue.(string)
		if !ok && pValue != nil {
			return typeMismatchReason(p, v)
		}
		v.SetString(x)
	case reflect.Float32, reflect.Float64:
		x, ok := pValue.(float64)
		if !ok && pValue != nil {
			return typeMismatchReason(p, v)
		}
		if v.OverflowFloat(x) {
			return fmt.Sprintf("value %v overflows struct field of type %v", x, v.Type())
		}
		v.SetFloat(x)
	case reflect.Ptr:
		// v must be either a pointer to a Key or Entity.
		if v.Type() != typeOfKeyPtr && v.Type().Elem().Kind() != reflect.Struct {
			return typeMismatchReason(p, v)
		}

		if pValue == nil {
			// If v is populated already, set it to nil.
			if !v.IsNil() {
				v.Set(reflect.New(v.Type()).Elem())
			}
			return ""
		}

		switch x := pValue.(type) {
		case *Key:
			if _, ok := v.Interface().(*Key); !ok {
				return typeMismatchReason(p, v)
			}
			v.Set(reflect.ValueOf(x))
		case *Entity:
			if v.IsNil() {
				v.Set(reflect.New(v.Type().Elem()))
			}
			err := loadEntity(v.Interface(), x)
			if err != nil {
				return err.Error()
			}

		default:
			return typeMismatchReason(p, v)
		}
	case reflect.Struct:
		switch v.Type() {
		case typeOfTime:
			x, ok := pValue.(time.Time)
			if !ok && pValue != nil {
				return typeMismatchReason(p, v)
			}
			v.Set(reflect.ValueOf(x))
		case typeOfGeoPoint:
			x, ok := pValue.(GeoPoint)
			if !ok && pValue != nil {
				return typeMismatchReason(p, v)
			}
			v.Set(reflect.ValueOf(x))
		default:
			ent, ok := pValue.(*Entity)
			if !ok {
				return typeMismatchReason(p, v)
			}
			err := loadEntity(v.Addr().Interface(), ent)
			if err != nil {
				return err.Error()
			}
		}
	case reflect.Slice:
		x, ok := pValue.([]byte)
		if !ok && pValue != nil {
			return typeMismatchReason(p, v)
		}
		if v.Type().Elem().Kind() != reflect.Uint8 {
			return typeMismatchReason(p, v)
		}
		v.SetBytes(x)
	default:
		return typeMismatchReason(p, v)
	}
	return ""
}

// initField is similar to reflect's Value.FieldByIndex, in that it
// returns the nested struct field corresponding to index, but it
// initialises any nil pointers encountered when traversing the structure.
func initField(val reflect.Value, index []int) reflect.Value {
	for _, i := range index[:len(index)-1] {
		val = val.Field(i)
		if val.Kind() == reflect.Ptr {
			if val.IsNil() {
				val.Set(reflect.New(val.Type().Elem()))
			}
			val = val.Elem()
		}
	}
	return val.Field(index[len(index)-1])
}

// loadEntityProto loads an EntityProto into PropertyLoadSaver or struct pointer.
func loadEntityProto(dst interface{}, src *pb.Entity) error {
	ent, err := protoToEntity(src)
	if err != nil {
		return err
	}
	return loadEntity(dst, ent)
}

func loadEntity(dst interface{}, ent *Entity) error {
	if pls, ok := dst.(PropertyLoadSaver); ok {
		err := pls.Load(ent.Properties)
		if err != nil {
			return err
		}
		if e, ok := dst.(KeyLoader); ok {
			err = e.LoadKey(ent.Key)
		}
		return err
	}
	return loadEntityToStruct(dst, ent)
}

func loadEntityToStruct(dst interface{}, ent *Entity) error {
	pls, err := newStructPLS(dst)
	if err != nil {
		return err
	}
	// Load properties.
	err = pls.Load(ent.Properties)
	if err != nil {
		return err
	}
	// Load key.
	keyField := pls.codec.Match(keyFieldName)
	if keyField != nil && ent.Key != nil {
		pls.v.FieldByIndex(keyField.Index).Set(reflect.ValueOf(ent.Key))
	}

	return nil
}

func (s structPLS) Load(props []Property) error {
	var fieldName, errReason string
	var l propertyLoader

	prev := make(map[string]struct{})
	for _, p := range props {
		if errStr := l.load(s.codec, s.v, p, prev); errStr != "" {
			// We don't return early, as we try to load as many properties as possible.
			// It is valid to load an entity into a struct that cannot fully represent it.
			// That case returns an error, but the caller is free to ignore it.
			fieldName, errReason = p.Name, errStr
		}
	}
	if errReason != "" {
		return &ErrFieldMismatch{
			StructType: s.v.Type(),
			FieldName:  fieldName,
			Reason:     errReason,
		}
	}
	return nil
}

func protoToEntity(src *pb.Entity) (*Entity, error) {
	props := make([]Property, 0, len(src.Properties))
	for name, val := range src.Properties {
		v, err := propToValue(val)
		if err != nil {
			return nil, err
		}
		props = append(props, Property{
			Name:    name,
			Value:   v,
			NoIndex: val.ExcludeFromIndexes,
		})
	}
	var key *Key
	if src.Key != nil {
		// Ignore any error, since nested entity values
		// are allowed to have an invalid key.
		key, _ = protoToKey(src.Key)
	}

	return &Entity{key, props}, nil
}

// propToValue returns a Go value that represents the PropertyValue. For
// example, a TimestampValue becomes a time.Time.
func propToValue(v *pb.Value) (interface{}, error) {
	switch v := v.ValueType.(type) {
	case *pb.Value_NullValue:
		return nil, nil
	case *pb.Value_BooleanValue:
		return v.BooleanValue, nil
	case *pb.Value_IntegerValue:
		return v.IntegerValue, nil
	case *pb.Value_DoubleValue:
		return v.DoubleValue, nil
	case *pb.Value_TimestampValue:
		return time.Unix(v.TimestampValue.Seconds, int64(v.TimestampValue.Nanos)), nil
	case *pb.Value_KeyValue:
		return protoToKey(v.KeyValue)
	case *pb.Value_StringValue:
		return v.StringValue, nil
	case *pb.Value_BlobValue:
		return []byte(v.BlobValue), nil
	case *pb.Value_GeoPointValue:
		return GeoPoint{Lat: v.GeoPointValue.Latitude, Lng: v.GeoPointValue.Longitude}, nil
	case *pb.Value_EntityValue:
		return protoToEntity(v.EntityValue)
	case *pb.Value_ArrayValue:
		arr := make([]interface{}, 0, len(v.ArrayValue.Values))
		for _, v := range v.ArrayValue.Values {
			vv, err := propToValue(v)
			if err != nil {
				return nil, err
			}
			arr = append(arr, vv)
		}
		return arr, nil
	default:
		return nil, nil
	}
}
