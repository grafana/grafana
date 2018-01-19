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
	"strings"

	pb "google.golang.org/genproto/googleapis/firestore/v1beta1"

	"github.com/golang/protobuf/ptypes"
)

func setFromProtoValue(x interface{}, vproto *pb.Value, c *Client) error {
	v := reflect.ValueOf(x)
	if v.Kind() != reflect.Ptr || v.IsNil() {
		return errors.New("firestore: nil or not a pointer")
	}
	return setReflectFromProtoValue(v.Elem(), vproto, c)
}

// setReflectFromProtoValue sets v from a Firestore Value.
// v must be a settable value.
func setReflectFromProtoValue(v reflect.Value, vproto *pb.Value, c *Client) error {
	typeErr := func() error {
		return fmt.Errorf("firestore: cannot set type %s to %s", v.Type(), typeString(vproto))
	}

	val := vproto.ValueType
	// A Null value sets anything nullable to nil, and has no effect
	// on anything else.
	if _, ok := val.(*pb.Value_NullValue); ok {
		switch v.Kind() {
		case reflect.Interface, reflect.Ptr, reflect.Map, reflect.Slice:
			v.Set(reflect.Zero(v.Type()))
		}
		return nil
	}

	// Handle special types first.
	switch v.Type() {
	case typeOfByteSlice:
		x, ok := val.(*pb.Value_BytesValue)
		if !ok {
			return typeErr()
		}
		v.SetBytes(x.BytesValue)
		return nil

	case typeOfGoTime:
		x, ok := val.(*pb.Value_TimestampValue)
		if !ok {
			return typeErr()
		}
		t, err := ptypes.Timestamp(x.TimestampValue)
		if err != nil {
			return err
		}
		v.Set(reflect.ValueOf(t))
		return nil

	case typeOfLatLng:
		x, ok := val.(*pb.Value_GeoPointValue)
		if !ok {
			return typeErr()
		}
		v.Set(reflect.ValueOf(x.GeoPointValue))
		return nil

	case typeOfDocumentRef:
		x, ok := val.(*pb.Value_ReferenceValue)
		if !ok {
			return typeErr()
		}
		dr, err := pathToDoc(x.ReferenceValue, c)
		if err != nil {
			return err
		}
		v.Set(reflect.ValueOf(dr))
		return nil
	}

	switch v.Kind() {
	case reflect.Bool:
		x, ok := val.(*pb.Value_BooleanValue)
		if !ok {
			return typeErr()
		}
		v.SetBool(x.BooleanValue)

	case reflect.String:
		x, ok := val.(*pb.Value_StringValue)
		if !ok {
			return typeErr()
		}
		v.SetString(x.StringValue)

	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		var i int64
		switch x := val.(type) {
		case *pb.Value_IntegerValue:
			i = x.IntegerValue
		case *pb.Value_DoubleValue:
			f := x.DoubleValue
			i = int64(f)
			if float64(i) != f {
				return fmt.Errorf("firestore: float %f does not fit into %s", f, v.Type())
			}
		default:
			return typeErr()
		}
		if v.OverflowInt(i) {
			return overflowErr(v, i)
		}
		v.SetInt(i)

	case reflect.Uint8, reflect.Uint16, reflect.Uint32:
		var u uint64
		switch x := val.(type) {
		case *pb.Value_IntegerValue:
			u = uint64(x.IntegerValue)
		case *pb.Value_DoubleValue:
			f := x.DoubleValue
			u = uint64(f)
			if float64(u) != f {
				return fmt.Errorf("firestore: float %f does not fit into %s", f, v.Type())
			}
		default:
			return typeErr()
		}
		if v.OverflowUint(u) {
			return overflowErr(v, u)
		}
		v.SetUint(u)

	case reflect.Float32, reflect.Float64:
		var f float64
		switch x := val.(type) {
		case *pb.Value_DoubleValue:
			f = x.DoubleValue
		case *pb.Value_IntegerValue:
			f = float64(x.IntegerValue)
			if int64(f) != x.IntegerValue {
				return overflowErr(v, x.IntegerValue)
			}
		default:
			return typeErr()
		}
		if v.OverflowFloat(f) {
			return overflowErr(v, f)
		}
		v.SetFloat(f)

	case reflect.Slice:
		x, ok := val.(*pb.Value_ArrayValue)
		if !ok {
			return typeErr()
		}
		vals := x.ArrayValue.Values
		vlen := v.Len()
		xlen := len(vals)
		// Make a slice of the right size, avoiding allocation if possible.
		switch {
		case vlen < xlen:
			v.Set(reflect.MakeSlice(v.Type(), xlen, xlen))
		case vlen > xlen:
			v.SetLen(xlen)
		}
		return populateRepeated(v, vals, xlen, c)

	case reflect.Array:
		x, ok := val.(*pb.Value_ArrayValue)
		if !ok {
			return typeErr()
		}
		vals := x.ArrayValue.Values
		xlen := len(vals)
		vlen := v.Len()
		minlen := vlen
		// Set extra elements to their zero value.
		if vlen > xlen {
			z := reflect.Zero(v.Type().Elem())
			for i := xlen; i < vlen; i++ {
				v.Index(i).Set(z)
			}
			minlen = xlen
		}
		return populateRepeated(v, vals, minlen, c)

	case reflect.Map:
		x, ok := val.(*pb.Value_MapValue)
		if !ok {
			return typeErr()
		}
		return populateMap(v, x.MapValue.Fields, c)

	case reflect.Ptr:
		// If the pointer is nil, set it to a zero value.
		if v.IsNil() {
			v.Set(reflect.New(v.Type().Elem()))
		}
		return setReflectFromProtoValue(v.Elem(), vproto, c)

	case reflect.Struct:
		x, ok := val.(*pb.Value_MapValue)
		if !ok {
			return typeErr()
		}
		return populateStruct(v, x.MapValue.Fields, c)

	case reflect.Interface:
		if v.NumMethod() == 0 { // empty interface
			// If v holds a pointer, set the pointer.
			if !v.IsNil() && v.Elem().Kind() == reflect.Ptr {
				return setReflectFromProtoValue(v.Elem(), vproto, c)
			}
			// Otherwise, create a fresh value.
			x, err := createFromProtoValue(vproto, c)
			if err != nil {
				return err
			}
			v.Set(reflect.ValueOf(x))
			return nil
		}
		// Any other kind of interface is an error.
		fallthrough

	default:
		return fmt.Errorf("firestore: cannot set type %s", v.Type())
	}
	return nil
}

// populateRepeated sets the first n elements of vr, which must be a slice or
// array, to the corresponding elements of vals.
func populateRepeated(vr reflect.Value, vals []*pb.Value, n int, c *Client) error {
	for i := 0; i < n; i++ {
		if err := setReflectFromProtoValue(vr.Index(i), vals[i], c); err != nil {
			return err
		}
	}
	return nil
}

// populateMap sets the elements of vm, which must be a map, from the
// corresponding elements of pm.
//
// Since a map value is not settable, this function always creates a new
// element for each corresponding map key. Existing values of vm are
// overwritten. This happens even if the map value is something like a pointer
// to a struct, where we could in theory populate the existing struct value
// instead of discarding it. This behavior matches encoding/json.
func populateMap(vm reflect.Value, pm map[string]*pb.Value, c *Client) error {
	t := vm.Type()
	if t.Key().Kind() != reflect.String {
		return errors.New("firestore: map key type is not string")
	}
	if vm.IsNil() {
		vm.Set(reflect.MakeMap(t))
	}
	et := t.Elem()
	for k, vproto := range pm {
		el := reflect.New(et).Elem()
		if err := setReflectFromProtoValue(el, vproto, c); err != nil {
			return err
		}
		vm.SetMapIndex(reflect.ValueOf(k), el)
	}
	return nil
}

// createMapFromValueMap creates a fresh map and populates it with pm.
func createMapFromValueMap(pm map[string]*pb.Value, c *Client) (map[string]interface{}, error) {
	m := map[string]interface{}{}
	for k, pv := range pm {
		v, err := createFromProtoValue(pv, c)
		if err != nil {
			return nil, err
		}
		m[k] = v
	}
	return m, nil
}

// populateStruct sets the fields of vs, which must be a struct, from
// the matching elements of pm.
func populateStruct(vs reflect.Value, pm map[string]*pb.Value, c *Client) error {
	fields, err := fieldCache.Fields(vs.Type())
	if err != nil {
		return err
	}
	for k, vproto := range pm {
		f := fields.Match(k)
		if f == nil {
			continue
		}
		if err := setReflectFromProtoValue(vs.FieldByIndex(f.Index), vproto, c); err != nil {
			return fmt.Errorf("%s.%s: %v", vs.Type(), f.Name, err)
		}
	}
	return nil
}

func createFromProtoValue(vproto *pb.Value, c *Client) (interface{}, error) {
	switch v := vproto.ValueType.(type) {
	case *pb.Value_NullValue:
		return nil, nil
	case *pb.Value_BooleanValue:
		return v.BooleanValue, nil
	case *pb.Value_IntegerValue:
		return v.IntegerValue, nil
	case *pb.Value_DoubleValue:
		return v.DoubleValue, nil
	case *pb.Value_TimestampValue:
		return ptypes.Timestamp(v.TimestampValue)
	case *pb.Value_StringValue:
		return v.StringValue, nil
	case *pb.Value_BytesValue:
		return v.BytesValue, nil
	case *pb.Value_ReferenceValue:
		return pathToDoc(v.ReferenceValue, c)
	case *pb.Value_GeoPointValue:
		return v.GeoPointValue, nil

	case *pb.Value_ArrayValue:
		vals := v.ArrayValue.Values
		ret := make([]interface{}, len(vals))
		for i, v := range vals {
			r, err := createFromProtoValue(v, c)
			if err != nil {
				return nil, err
			}
			ret[i] = r
		}
		return ret, nil

	case *pb.Value_MapValue:
		fields := v.MapValue.Fields
		ret := make(map[string]interface{}, len(fields))
		for k, v := range fields {
			r, err := createFromProtoValue(v, c)
			if err != nil {
				return nil, err
			}
			ret[k] = r
		}
		return ret, nil

	default:
		return nil, fmt.Errorf("firestore: unknown value type %T", v)
	}
}

// Convert a document path to a DocumentRef.
func pathToDoc(docPath string, c *Client) (*DocumentRef, error) {
	projID, dbID, docIDs, err := parseDocumentPath(docPath)
	if err != nil {
		return nil, err
	}
	parentResourceName := fmt.Sprintf("projects/%s/databases/%s", projID, dbID)
	_, doc := c.idsToRef(docIDs, parentResourceName)
	return doc, nil
}

// A document path should be of the form "projects/P/databases/D/documents/coll1/doc1/coll2/doc2/...".
func parseDocumentPath(path string) (projectID, databaseID string, docPath []string, err error) {
	parts := strings.Split(path, "/")
	if len(parts) < 6 || parts[0] != "projects" || parts[2] != "databases" || parts[4] != "documents" {
		return "", "", nil, fmt.Errorf("firestore: malformed document path %q", path)
	}
	docp := parts[5:]
	if len(docp)%2 != 0 {
		return "", "", nil, fmt.Errorf("firestore: path %q refers to collection, not document", path)
	}
	return parts[1], parts[3], docp, nil
}

func typeString(vproto *pb.Value) string {
	switch vproto.ValueType.(type) {
	case *pb.Value_NullValue:
		return "null"
	case *pb.Value_BooleanValue:
		return "bool"
	case *pb.Value_IntegerValue:
		return "int"
	case *pb.Value_DoubleValue:
		return "float"
	case *pb.Value_TimestampValue:
		return "timestamp"
	case *pb.Value_StringValue:
		return "string"
	case *pb.Value_BytesValue:
		return "bytes"
	case *pb.Value_ReferenceValue:
		return "reference"
	case *pb.Value_GeoPointValue:
		return "GeoPoint"
	case *pb.Value_MapValue:
		return "map"
	case *pb.Value_ArrayValue:
		return "array"
	default:
		return "<unknown Value type>"
	}
}

func overflowErr(v reflect.Value, x interface{}) error {
	return fmt.Errorf("firestore: value %v overflows type %s", x, v.Type())
}
