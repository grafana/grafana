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

	pb "google.golang.org/genproto/googleapis/firestore/v1beta1"

	"github.com/golang/protobuf/ptypes"
)

// A DocumentSnapshot contains document data and metadata.
type DocumentSnapshot struct {
	// The DocumentRef for this document.
	Ref *DocumentRef

	// Read-only. The time at which the document was created.
	// Increases monotonically when a document is deleted then
	// recreated. It can also be compared to values from other documents and
	// the read time of a query.
	CreateTime time.Time

	// Read-only. The time at which the document was last changed. This value
	// is initally set to CreateTime then increases monotonically with each
	// change to the document. It can also be compared to values from other
	// documents and the read time of a query.
	UpdateTime time.Time

	c     *Client
	proto *pb.Document
}

// Data returns the DocumentSnapshot's fields as a map.
// It is equivalent to
//     var m map[string]interface{}
//     d.DataTo(&m)
func (d *DocumentSnapshot) Data() map[string]interface{} {
	m, err := createMapFromValueMap(d.proto.Fields, d.c)
	// Any error here is a bug in the client.
	if err != nil {
		panic(fmt.Sprintf("firestore: %v", err))
	}
	return m
}

// DataTo uses the document's fields to populate p, which can be a pointer to a
// map[string]interface{} or a pointer to a struct.
//
// Firestore field values are converted to Go values as follows:
//   - Null converts to nil.
//   - Bool converts to bool.
//   - String converts to string.
//   - Integer converts int64. When setting a struct field, any signed or unsigned
//     integer type is permitted except uint64. Overflow is detected and results in
//     an error.
//   - Double converts to float64. When setting a struct field, float32 is permitted.
//     Overflow is detected and results in an error.
//   - Bytes is converted to []byte.
//   - Timestamp converts to time.Time.
//   - GeoPoint converts to latlng.LatLng, where latlng is the package
//     "google.golang.org/genproto/googleapis/type/latlng".
//   - Arrays convert to []interface{}. When setting a struct field, the field
//     may be a slice or array of any type and is populated recursively.
//     Slices are resized to the incoming value's size, while arrays that are too
//     long have excess elements filled with zero values. If the array is too short,
//     excess incoming values will be dropped.
//   - Maps convert to map[string]interface{}. When setting a struct field,
//     maps of key type string and any value type are permitted, and are populated
//     recursively.
//   - References are converted to DocumentRefs.
//
// Field names given by struct field tags are observed, as described in
// DocumentRef.Create.
func (d *DocumentSnapshot) DataTo(p interface{}) error {
	return setFromProtoValue(p, &pb.Value{&pb.Value_MapValue{&pb.MapValue{d.proto.Fields}}}, d.c)
}

// DataAt returns the data value denoted by path.
//
// The path argument can be a single field or a dot-separated sequence of
// fields, and must not contain any of the runes "˜*/[]". Use DataAtPath instead for
// such a path.
//
// See DocumentSnapshot.DataTo for how Firestore values are converted to Go values.
func (d *DocumentSnapshot) DataAt(path string) (interface{}, error) {
	fp, err := parseDotSeparatedString(path)
	if err != nil {
		return nil, err
	}
	return d.DataAtPath(fp)
}

// DataAtPath returns the data value denoted by the FieldPath fp.
func (d *DocumentSnapshot) DataAtPath(fp FieldPath) (interface{}, error) {
	v, err := valueAtPath(fp, d.proto.Fields)
	if err != nil {
		return nil, err
	}
	return createFromProtoValue(v, d.c)
}

// valueAtPath returns the value of m referred to by fp.
func valueAtPath(fp FieldPath, m map[string]*pb.Value) (*pb.Value, error) {
	for _, k := range fp[:len(fp)-1] {
		v := m[k]
		if v == nil {
			return nil, fmt.Errorf("firestore: no field %q", k)
		}
		mv := v.GetMapValue()
		if mv == nil {
			return nil, fmt.Errorf("firestore: value for field %q is not a map", k)
		}
		m = mv.Fields
	}
	k := fp[len(fp)-1]
	v := m[k]
	if v == nil {
		return nil, fmt.Errorf("firestore: no field %q", k)
	}
	return v, nil
}

// toProtoDocument converts a Go value to a Document proto.
// Valid values are: map[string]T, struct, or pointer to a valid value.
// It also returns a list of field paths for DocumentTransform (server timestamp).
func toProtoDocument(x interface{}) (*pb.Document, []FieldPath, error) {
	if x == nil {
		return nil, nil, errors.New("firestore: nil document contents")
	}
	v := reflect.ValueOf(x)
	pv, sawTransform, err := toProtoValue(v)
	if err != nil {
		return nil, nil, err
	}
	var fieldPaths []FieldPath
	if sawTransform {
		fieldPaths, err = extractTransformPaths(v, nil)
		if err != nil {
			return nil, nil, err
		}
	}
	var fields map[string]*pb.Value
	if pv != nil {
		m := pv.GetMapValue()
		if m == nil {
			return nil, nil, fmt.Errorf("firestore: cannot covert value of type %T into a map", x)
		}
		fields = m.Fields
	}
	return &pb.Document{Fields: fields}, fieldPaths, nil
}

func extractTransformPaths(v reflect.Value, prefix FieldPath) ([]FieldPath, error) {
	switch v.Kind() {
	case reflect.Map:
		return extractTransformPathsFromMap(v, prefix)
	case reflect.Struct:
		return extractTransformPathsFromStruct(v, prefix)
	case reflect.Ptr:
		if v.IsNil() {
			return nil, nil
		}
		return extractTransformPaths(v.Elem(), prefix)
	case reflect.Interface:
		if v.NumMethod() == 0 { // empty interface: recurse on its contents
			return extractTransformPaths(v.Elem(), prefix)
		}
		return nil, nil
	default:
		return nil, nil
	}
}

func extractTransformPathsFromMap(v reflect.Value, prefix FieldPath) ([]FieldPath, error) {
	var paths []FieldPath
	for _, k := range v.MapKeys() {
		sk := k.Interface().(string) // assume keys are strings; checked in toProtoValue
		path := prefix.with(sk)
		mi := v.MapIndex(k)
		if mi.Interface() == ServerTimestamp {
			paths = append(paths, path)
		} else {
			ps, err := extractTransformPaths(mi, path)
			if err != nil {
				return nil, err
			}
			paths = append(paths, ps...)
		}
	}
	return paths, nil
}

func extractTransformPathsFromStruct(v reflect.Value, prefix FieldPath) ([]FieldPath, error) {
	var paths []FieldPath
	fields, err := fieldCache.Fields(v.Type())
	if err != nil {
		return nil, err
	}
	for _, f := range fields {
		fv := v.FieldByIndex(f.Index)
		path := prefix.with(f.Name)
		opts := f.ParsedTag.(tagOptions)
		if opts.serverTimestamp {
			var isZero bool
			switch f.Type {
			case typeOfGoTime:
				isZero = fv.Interface().(time.Time).IsZero()
			case reflect.PtrTo(typeOfGoTime):
				isZero = fv.IsNil() || fv.Elem().Interface().(time.Time).IsZero()
			default:
				return nil, fmt.Errorf("firestore: field %s of struct %s with serverTimestamp tag must be of type time.Time or *time.Time",
					f.Name, v.Type())
			}
			if isZero {
				paths = append(paths, path)
			}
		} else {
			ps, err := extractTransformPaths(fv, path)
			if err != nil {
				return nil, err
			}
			paths = append(paths, ps...)
		}
	}
	return paths, nil
}

func newDocumentSnapshot(ref *DocumentRef, proto *pb.Document, c *Client) (*DocumentSnapshot, error) {
	d := &DocumentSnapshot{
		Ref:   ref,
		c:     c,
		proto: proto,
	}
	ts, err := ptypes.Timestamp(proto.CreateTime)
	if err != nil {
		return nil, err
	}
	d.CreateTime = ts
	ts, err = ptypes.Timestamp(proto.UpdateTime)
	if err != nil {
		return nil, err
	}
	d.UpdateTime = ts
	return d, nil
}
