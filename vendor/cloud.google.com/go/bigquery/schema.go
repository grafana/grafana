// Copyright 2015 Google Inc. All Rights Reserved.
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

package bigquery

import (
	"errors"
	"fmt"
	"reflect"

	"cloud.google.com/go/internal/atomiccache"

	bq "google.golang.org/api/bigquery/v2"
)

// Schema describes the fields in a table or query result.
type Schema []*FieldSchema

type FieldSchema struct {
	// The field name.
	// Must contain only letters (a-z, A-Z), numbers (0-9), or underscores (_),
	// and must start with a letter or underscore.
	// The maximum length is 128 characters.
	Name string

	// A description of the field. The maximum length is 16,384 characters.
	Description string

	// Whether the field may contain multiple values.
	Repeated bool
	// Whether the field is required.  Ignored if Repeated is true.
	Required bool

	// The field data type.  If Type is Record, then this field contains a nested schema,
	// which is described by Schema.
	Type FieldType
	// Describes the nested schema if Type is set to Record.
	Schema Schema
}

func (fs *FieldSchema) toBQ() *bq.TableFieldSchema {
	tfs := &bq.TableFieldSchema{
		Description: fs.Description,
		Name:        fs.Name,
		Type:        string(fs.Type),
	}

	if fs.Repeated {
		tfs.Mode = "REPEATED"
	} else if fs.Required {
		tfs.Mode = "REQUIRED"
	} // else leave as default, which is interpreted as NULLABLE.

	for _, f := range fs.Schema {
		tfs.Fields = append(tfs.Fields, f.toBQ())
	}

	return tfs
}

func (s Schema) toBQ() *bq.TableSchema {
	var fields []*bq.TableFieldSchema
	for _, f := range s {
		fields = append(fields, f.toBQ())
	}
	return &bq.TableSchema{Fields: fields}
}

func bqToFieldSchema(tfs *bq.TableFieldSchema) *FieldSchema {
	fs := &FieldSchema{
		Description: tfs.Description,
		Name:        tfs.Name,
		Repeated:    tfs.Mode == "REPEATED",
		Required:    tfs.Mode == "REQUIRED",
		Type:        FieldType(tfs.Type),
	}

	for _, f := range tfs.Fields {
		fs.Schema = append(fs.Schema, bqToFieldSchema(f))
	}
	return fs
}

func bqToSchema(ts *bq.TableSchema) Schema {
	if ts == nil {
		return nil
	}
	var s Schema
	for _, f := range ts.Fields {
		s = append(s, bqToFieldSchema(f))
	}
	return s
}

type FieldType string

const (
	StringFieldType    FieldType = "STRING"
	BytesFieldType     FieldType = "BYTES"
	IntegerFieldType   FieldType = "INTEGER"
	FloatFieldType     FieldType = "FLOAT"
	BooleanFieldType   FieldType = "BOOLEAN"
	TimestampFieldType FieldType = "TIMESTAMP"
	RecordFieldType    FieldType = "RECORD"
	DateFieldType      FieldType = "DATE"
	TimeFieldType      FieldType = "TIME"
	DateTimeFieldType  FieldType = "DATETIME"
)

var (
	errNoStruct             = errors.New("bigquery: can only infer schema from struct or pointer to struct")
	errUnsupportedFieldType = errors.New("bigquery: unsupported type of field in struct")
	errInvalidFieldName     = errors.New("bigquery: invalid name of field in struct")
)

var typeOfByteSlice = reflect.TypeOf([]byte{})

// InferSchema tries to derive a BigQuery schema from the supplied struct value.
// NOTE: All fields in the returned Schema are configured to be required,
// unless the corresponding field in the supplied struct is a slice or array.
//
// It is considered an error if the struct (including nested structs) contains
// any exported fields that are pointers or one of the following types:
// uint, uint64, uintptr, map, interface, complex64, complex128, func, chan.
// In these cases, an error will be returned.
// Future versions may handle these cases without error.
//
// Recursively defined structs are also disallowed.
func InferSchema(st interface{}) (Schema, error) {
	return inferSchemaReflectCached(reflect.TypeOf(st))
}

// TODO(jba): replace with sync.Map for Go 1.9.
var schemaCache atomiccache.Cache

type cacheVal struct {
	schema Schema
	err    error
}

func inferSchemaReflectCached(t reflect.Type) (Schema, error) {
	cv := schemaCache.Get(t, func() interface{} {
		s, err := inferSchemaReflect(t)
		return cacheVal{s, err}
	}).(cacheVal)
	return cv.schema, cv.err
}

func inferSchemaReflect(t reflect.Type) (Schema, error) {
	rec, err := hasRecursiveType(t, nil)
	if err != nil {
		return nil, err
	}
	if rec {
		return nil, fmt.Errorf("bigquery: schema inference for recursive type %s", t)
	}
	return inferStruct(t)
}

func inferStruct(t reflect.Type) (Schema, error) {
	switch t.Kind() {
	case reflect.Ptr:
		if t.Elem().Kind() != reflect.Struct {
			return nil, errNoStruct
		}
		t = t.Elem()
		fallthrough

	case reflect.Struct:
		return inferFields(t)
	default:
		return nil, errNoStruct
	}
}

// inferFieldSchema infers the FieldSchema for a Go type
func inferFieldSchema(rt reflect.Type, nullable bool) (*FieldSchema, error) {
	switch rt {
	case typeOfByteSlice:
		return &FieldSchema{Required: !nullable, Type: BytesFieldType}, nil
	case typeOfGoTime:
		return &FieldSchema{Required: !nullable, Type: TimestampFieldType}, nil
	case typeOfDate:
		return &FieldSchema{Required: !nullable, Type: DateFieldType}, nil
	case typeOfTime:
		return &FieldSchema{Required: !nullable, Type: TimeFieldType}, nil
	case typeOfDateTime:
		return &FieldSchema{Required: !nullable, Type: DateTimeFieldType}, nil
	}
	if isSupportedIntType(rt) {
		return &FieldSchema{Required: !nullable, Type: IntegerFieldType}, nil
	}
	switch rt.Kind() {
	case reflect.Slice, reflect.Array:
		et := rt.Elem()
		if et != typeOfByteSlice && (et.Kind() == reflect.Slice || et.Kind() == reflect.Array) {
			// Multi dimensional slices/arrays are not supported by BigQuery
			return nil, errUnsupportedFieldType
		}

		f, err := inferFieldSchema(et, false)
		if err != nil {
			return nil, err
		}
		f.Repeated = true
		f.Required = false
		return f, nil
	case reflect.Struct, reflect.Ptr:
		nested, err := inferStruct(rt)
		if err != nil {
			return nil, err
		}
		return &FieldSchema{Required: !nullable, Type: RecordFieldType, Schema: nested}, nil
	case reflect.String:
		return &FieldSchema{Required: !nullable, Type: StringFieldType}, nil
	case reflect.Bool:
		return &FieldSchema{Required: !nullable, Type: BooleanFieldType}, nil
	case reflect.Float32, reflect.Float64:
		return &FieldSchema{Required: !nullable, Type: FloatFieldType}, nil
	default:
		return nil, errUnsupportedFieldType
	}
}

// inferFields extracts all exported field types from struct type.
func inferFields(rt reflect.Type) (Schema, error) {
	var s Schema
	fields, err := fieldCache.Fields(rt)
	if err != nil {
		return nil, err
	}
	for _, field := range fields {
		var nullable bool
		for _, opt := range field.ParsedTag.([]string) {
			if opt == nullableTagOption {
				nullable = true
				break
			}
		}
		f, err := inferFieldSchema(field.Type, nullable)
		if err != nil {
			return nil, err
		}
		f.Name = field.Name
		s = append(s, f)
	}
	return s, nil
}

// isSupportedIntType reports whether t can be properly represented by the
// BigQuery INTEGER/INT64 type.
func isSupportedIntType(t reflect.Type) bool {
	switch t.Kind() {
	case reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64, reflect.Int,
		reflect.Uint8, reflect.Uint16, reflect.Uint32:
		return true
	default:
		return false
	}
}

// typeList is a linked list of reflect.Types.
type typeList struct {
	t    reflect.Type
	next *typeList
}

func (l *typeList) has(t reflect.Type) bool {
	for l != nil {
		if l.t == t {
			return true
		}
		l = l.next
	}
	return false
}

// hasRecursiveType reports whether t or any type inside t refers to itself, directly or indirectly,
// via exported fields. (Schema inference ignores unexported fields.)
func hasRecursiveType(t reflect.Type, seen *typeList) (bool, error) {
	for t.Kind() == reflect.Ptr || t.Kind() == reflect.Slice || t.Kind() == reflect.Array {
		t = t.Elem()
	}
	if t.Kind() != reflect.Struct {
		return false, nil
	}
	if seen.has(t) {
		return true, nil
	}
	fields, err := fieldCache.Fields(t)
	if err != nil {
		return false, err
	}
	seen = &typeList{t, seen}
	// Because seen is a linked list, additions to it from one field's
	// recursive call will not affect the value for subsequent fields' calls.
	for _, field := range fields {
		ok, err := hasRecursiveType(field.Type, seen)
		if err != nil {
			return false, err
		}
		if ok {
			return true, nil
		}
	}
	return false, nil
}
