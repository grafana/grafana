// Copyright 2017 Google Inc. All Rights Reserved.
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

package firestore

import (
	"errors"
	"fmt"
	"reflect"
	"time"

	"cloud.google.com/go/internal/fields"
	"github.com/golang/protobuf/ptypes"
	pb "google.golang.org/genproto/googleapis/firestore/v1beta1"
	"google.golang.org/genproto/googleapis/type/latlng"
)

var nullValue = &pb.Value{&pb.Value_NullValue{}}

var (
	typeOfByteSlice   = reflect.TypeOf([]byte{})
	typeOfGoTime      = reflect.TypeOf(time.Time{})
	typeOfLatLng      = reflect.TypeOf((*latlng.LatLng)(nil))
	typeOfDocumentRef = reflect.TypeOf((*DocumentRef)(nil))
)

// toProtoValue converts a Go value to a Firestore Value protobuf.
// Some corner cases:
// - All nils (nil interface, nil slice, nil map, nil pointer) are converted to
//   a NullValue (not a nil *pb.Value). toProtoValue never returns (nil, false, nil).
//   It returns (nil, true, nil) if everything in the value is ServerTimestamp.
// - An error is returned for uintptr, uint and uint64, because Firestore uses
//   an int64 to represent integral values, and those types can't be properly
//   represented in an int64.
// - An error is returned for the special Delete value.
func toProtoValue(v reflect.Value) (pbv *pb.Value, sawServerTimestamp bool, err error) {
	if !v.IsValid() {
		return nullValue, false, nil
	}
	vi := v.Interface()
	if vi == Delete {
		return nil, false, errors.New("firestore: cannot use Delete in value")
	}
	if vi == ServerTimestamp {
		return nil, false, errors.New("firestore: must use ServerTimestamp as a map value")
	}
	switch x := vi.(type) {
	case []byte:
		return &pb.Value{&pb.Value_BytesValue{x}}, false, nil
	case time.Time:
		ts, err := ptypes.TimestampProto(x)
		if err != nil {
			return nil, false, err
		}
		return &pb.Value{&pb.Value_TimestampValue{ts}}, false, nil
	case *latlng.LatLng:
		if x == nil {
			// gRPC doesn't like nil oneofs. Use NullValue.
			return nullValue, false, nil
		}
		return &pb.Value{&pb.Value_GeoPointValue{x}}, false, nil
	case *DocumentRef:
		if x == nil {
			// gRPC doesn't like nil oneofs. Use NullValue.
			return nullValue, false, nil
		}
		return &pb.Value{&pb.Value_ReferenceValue{x.Path}}, false, nil
		// Do not add bool, string, int, etc. to this switch; leave them in the
		// reflect-based switch below. Moving them here would drop support for
		// types whose underlying types are those primitives.
		// E.g. Given "type mybool bool", an ordinary type switch on bool will
		// not catch a mybool, but the reflect.Kind of a mybool is reflect.Bool.
	}
	switch v.Kind() {
	case reflect.Bool:
		return &pb.Value{&pb.Value_BooleanValue{v.Bool()}}, false, nil
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return &pb.Value{&pb.Value_IntegerValue{v.Int()}}, false, nil
	case reflect.Uint8, reflect.Uint16, reflect.Uint32:
		return &pb.Value{&pb.Value_IntegerValue{int64(v.Uint())}}, false, nil
	case reflect.Float32, reflect.Float64:
		return &pb.Value{&pb.Value_DoubleValue{v.Float()}}, false, nil
	case reflect.String:
		return &pb.Value{&pb.Value_StringValue{v.String()}}, false, nil
	case reflect.Slice:
		return sliceToProtoValue(v)
	case reflect.Map:
		return mapToProtoValue(v)
	case reflect.Struct:
		return structToProtoValue(v)
	case reflect.Ptr:
		if v.IsNil() {
			return nullValue, false, nil
		}
		return toProtoValue(v.Elem())
	case reflect.Interface:
		if v.NumMethod() == 0 { // empty interface: recurse on its contents
			return toProtoValue(v.Elem())
		}
		fallthrough // any other interface value is an error

	default:
		return nil, false, fmt.Errorf("firestore: cannot convert type %s to value", v.Type())
	}
}

func sliceToProtoValue(v reflect.Value) (*pb.Value, bool, error) {
	// A nil slice is converted to a null value.
	if v.IsNil() {
		return nullValue, false, nil
	}
	vals := make([]*pb.Value, v.Len())
	for i := 0; i < v.Len(); i++ {
		val, sawServerTimestamp, err := toProtoValue(v.Index(i))
		if err != nil {
			return nil, false, err
		}
		if sawServerTimestamp {
			return nil, false, errors.New("firestore: ServerTimestamp cannot occur in an array")
		}
		vals[i] = val
	}
	return &pb.Value{&pb.Value_ArrayValue{&pb.ArrayValue{vals}}}, false, nil
}

func mapToProtoValue(v reflect.Value) (*pb.Value, bool, error) {
	if v.Type().Key().Kind() != reflect.String {
		return nil, false, errors.New("firestore: map key type must be string")
	}
	// A nil map is converted to a null value.
	if v.IsNil() {
		return nullValue, false, nil
	}
	m := map[string]*pb.Value{}
	sawServerTimestamp := false
	for _, k := range v.MapKeys() {
		mi := v.MapIndex(k)
		if mi.Interface() == ServerTimestamp {
			sawServerTimestamp = true
			continue
		}
		val, sst, err := toProtoValue(mi)
		if err != nil {
			return nil, false, err
		}
		if sst {
			sawServerTimestamp = true
		}
		if val == nil { // value was a map with all ServerTimestamp values
			continue
		}
		m[k.String()] = val
	}
	var pv *pb.Value
	if len(m) == 0 && sawServerTimestamp {
		// The entire map consisted of ServerTimestamp values.
		pv = nil
	} else {
		pv = &pb.Value{&pb.Value_MapValue{&pb.MapValue{m}}}
	}
	return pv, sawServerTimestamp, nil
}

func structToProtoValue(v reflect.Value) (*pb.Value, bool, error) {
	m := map[string]*pb.Value{}
	fields, err := fieldCache.Fields(v.Type())
	if err != nil {
		return nil, false, err
	}
	sawServerTimestamp := false
	for _, f := range fields {
		fv := v.FieldByIndex(f.Index)
		opts := f.ParsedTag.(tagOptions)
		if opts.serverTimestamp {
			// TODO(jba): should we return a non-zero time?
			sawServerTimestamp = true
			continue
		}
		if opts.omitEmpty && isEmptyValue(fv) {
			continue
		}
		val, sst, err := toProtoValue(fv)
		if err != nil {
			return nil, false, err
		}
		if sst {
			sawServerTimestamp = true
		}
		if val == nil { // value was a map with all ServerTimestamp values
			continue
		}
		m[f.Name] = val
	}
	var pv *pb.Value
	if len(m) == 0 && sawServerTimestamp {
		// The entire struct consisted of ServerTimestamp or omitempty values.
		pv = nil
	} else {
		pv = &pb.Value{&pb.Value_MapValue{&pb.MapValue{m}}}
	}
	return pv, sawServerTimestamp, nil
}

type tagOptions struct {
	omitEmpty       bool // do not marshal value if empty
	serverTimestamp bool // set time.Time to server timestamp on write
}

// parseTag interprets firestore struct field tags.
func parseTag(t reflect.StructTag) (name string, keep bool, other interface{}, err error) {
	name, keep, opts, err := fields.ParseStandardTag("firestore", t)
	if err != nil {
		return "", false, nil, fmt.Errorf("firestore: %v", err)
	}
	tagOpts := tagOptions{}
	for _, opt := range opts {
		switch opt {
		case "omitempty":
			tagOpts.omitEmpty = true
		case "serverTimestamp":
			tagOpts.serverTimestamp = true
		default:
			return "", false, nil, fmt.Errorf("firestore: unknown tag option: %q", opt)
		}
	}
	return name, keep, tagOpts, nil
}

// isLeafType determines whether or not a type is a 'leaf type'
// and should not be recursed into, but considered one field.
func isLeafType(t reflect.Type) bool {
	return t == typeOfGoTime || t == typeOfLatLng
}

var fieldCache = fields.NewCache(parseTag, nil, isLeafType)

// isEmptyValue is taken from the encoding/json package in the
// standard library.
// TODO(jba): move to the fields package
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
	if v.Type() == typeOfGoTime {
		return v.Interface().(time.Time).IsZero()
	}
	return false
}
