/*
Copyright 2017 Google Inc. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package spanner

import (
	"fmt"
	"reflect"

	proto3 "github.com/golang/protobuf/ptypes/struct"

	sppb "google.golang.org/genproto/googleapis/spanner/v1"
	"google.golang.org/grpc/codes"
)

// A Row is a view of a row of data returned by a Cloud Spanner read.
// It consists of a number of columns; the number depends on the columns
// used to construct the read.
//
// The column values can be accessed by index. For instance, if the read specified
// []string{"photo_id", "caption"}, then each row will contain two
// columns: "photo_id" with index 0, and "caption" with index 1.
//
// Column values are decoded by using one of the Column, ColumnByName, or
// Columns methods. The valid values passed to these methods depend on the
// column type. For example:
//
//	var photoID int64
//	err := row.Column(0, &photoID) // Decode column 0 as an integer.
//
//	var caption string
//	err := row.Column(1, &caption) // Decode column 1 as a string.
//
//	// Decode all the columns.
//	err := row.Columns(&photoID, &caption)
//
// Supported types and their corresponding Cloud Spanner column type(s) are:
//
//	*string(not NULL), *NullString - STRING
//	*[]string, *[]NullString - STRING ARRAY
//	*[]byte - BYTES
//	*[][]byte - BYTES ARRAY
//	*int64(not NULL), *NullInt64 - INT64
//	*[]int64, *[]NullInt64 - INT64 ARRAY
//	*bool(not NULL), *NullBool - BOOL
//	*[]bool, *[]NullBool - BOOL ARRAY
//	*float64(not NULL), *NullFloat64 - FLOAT64
//	*[]float64, *[]NullFloat64 - FLOAT64 ARRAY
//	*time.Time(not NULL), *NullTime - TIMESTAMP
//	*[]time.Time, *[]NullTime - TIMESTAMP ARRAY
//	*Date(not NULL), *NullDate - DATE
//	*[]civil.Date, *[]NullDate - DATE ARRAY
//	*[]*some_go_struct, *[]NullRow - STRUCT ARRAY
//	*GenericColumnValue - any Cloud Spanner type
//
// For TIMESTAMP columns, the returned time.Time object will be in UTC.
//
// To fetch an array of BYTES, pass a *[][]byte. To fetch an array of (sub)rows, pass
// a *[]spanner.NullRow or a *[]*some_go_struct where some_go_struct holds all
// information of the subrow, see spanner.Row.ToStruct for the mapping between a
// Cloud Spanner row and a Go struct. To fetch an array of other types, pass a
// *[]spanner.NullXXX type of the appropriate type. Use GenericColumnValue when you
// don't know in advance what column type to expect.
//
// Row decodes the row contents lazily; as a result, each call to a getter has
// a chance of returning an error.
//
// A column value may be NULL if the corresponding value is not present in
// Cloud Spanner. The spanner.NullXXX types (spanner.NullInt64 et al.) allow fetching
// values that may be null. A NULL BYTES can be fetched into a *[]byte as nil.
// It is an error to fetch a NULL value into any other type.
type Row struct {
	fields []*sppb.StructType_Field
	vals   []*proto3.Value // keep decoded for now
}

// errNamesValuesMismatch returns error for when columnNames count is not equal
// to columnValues count.
func errNamesValuesMismatch(columnNames []string, columnValues []interface{}) error {
	return spannerErrorf(codes.FailedPrecondition,
		"different number of names(%v) and values(%v)", len(columnNames), len(columnValues))
}

// NewRow returns a Row containing the supplied data.  This can be useful for
// mocking Cloud Spanner Read and Query responses for unit testing.
func NewRow(columnNames []string, columnValues []interface{}) (*Row, error) {
	if len(columnValues) != len(columnNames) {
		return nil, errNamesValuesMismatch(columnNames, columnValues)
	}
	r := Row{
		fields: make([]*sppb.StructType_Field, len(columnValues)),
		vals:   make([]*proto3.Value, len(columnValues)),
	}
	for i := range columnValues {
		val, typ, err := encodeValue(columnValues[i])
		if err != nil {
			return nil, err
		}
		r.fields[i] = &sppb.StructType_Field{
			Name: columnNames[i],
			Type: typ,
		}
		r.vals[i] = val
	}
	return &r, nil
}

// Size is the number of columns in the row.
func (r *Row) Size() int {
	return len(r.fields)
}

// ColumnName returns the name of column i, or empty string for invalid column.
func (r *Row) ColumnName(i int) string {
	if i < 0 || i >= len(r.fields) {
		return ""
	}
	return r.fields[i].Name
}

// ColumnIndex returns the index of the column with the given name. The
// comparison is case-sensitive.
func (r *Row) ColumnIndex(name string) (int, error) {
	found := false
	var index int
	if len(r.vals) != len(r.fields) {
		return 0, errFieldsMismatchVals(r)
	}
	for i, f := range r.fields {
		if f == nil {
			return 0, errNilColType(i)
		}
		if name == f.Name {
			if found {
				return 0, errDupColName(name)
			}
			found = true
			index = i
		}
	}
	if !found {
		return 0, errColNotFound(name)
	}
	return index, nil
}

// ColumnNames returns all column names of the row.
func (r *Row) ColumnNames() []string {
	var n []string
	for _, c := range r.fields {
		n = append(n, c.Name)
	}
	return n
}

// errColIdxOutOfRange returns error for requested column index is out of the
// range of the target Row's columns.
func errColIdxOutOfRange(i int, r *Row) error {
	return spannerErrorf(codes.OutOfRange, "column index %d out of range [0,%d)", i, len(r.vals))
}

// errDecodeColumn returns error for not being able to decode a indexed column.
func errDecodeColumn(i int, err error) error {
	if err == nil {
		return nil
	}
	se, ok := toSpannerError(err).(*Error)
	if !ok {
		return spannerErrorf(codes.InvalidArgument, "failed to decode column %v, error = <%v>", i, err)
	}
	se.decorate(fmt.Sprintf("failed to decode column %v", i))
	return se
}

// errFieldsMismatchVals returns error for field count isn't equal to value count in a Row.
func errFieldsMismatchVals(r *Row) error {
	return spannerErrorf(codes.FailedPrecondition, "row has different number of fields(%v) and values(%v)",
		len(r.fields), len(r.vals))
}

// errNilColType returns error for column type for column i being nil in the row.
func errNilColType(i int) error {
	return spannerErrorf(codes.FailedPrecondition, "column(%v)'s type is nil", i)
}

// Column fetches the value from the ith column, decoding it into ptr.
// See the Row documentation for the list of acceptable argument types.
// see Client.ReadWriteTransaction for an example.
func (r *Row) Column(i int, ptr interface{}) error {
	if len(r.vals) != len(r.fields) {
		return errFieldsMismatchVals(r)
	}
	if i < 0 || i >= len(r.fields) {
		return errColIdxOutOfRange(i, r)
	}
	if r.fields[i] == nil {
		return errNilColType(i)
	}
	if err := decodeValue(r.vals[i], r.fields[i].Type, ptr); err != nil {
		return errDecodeColumn(i, err)
	}
	return nil
}

// errDupColName returns error for duplicated column name in the same row.
func errDupColName(n string) error {
	return spannerErrorf(codes.FailedPrecondition, "ambiguous column name %q", n)
}

// errColNotFound returns error for not being able to find a named column.
func errColNotFound(n string) error {
	return spannerErrorf(codes.NotFound, "column %q not found", n)
}

// ColumnByName fetches the value from the named column, decoding it into ptr.
// See the Row documentation for the list of acceptable argument types.
func (r *Row) ColumnByName(name string, ptr interface{}) error {
	index, err := r.ColumnIndex(name)
	if err != nil {
		return err
	}
	return r.Column(index, ptr)
}

// errNumOfColValue returns error for providing wrong number of values to Columns.
func errNumOfColValue(n int, r *Row) error {
	return spannerErrorf(codes.InvalidArgument,
		"Columns(): number of arguments (%d) does not match row size (%d)", n, len(r.vals))
}

// Columns fetches all the columns in the row at once.
//
// The value of the kth column will be decoded into the kth argument to Columns. See
// Row for the list of acceptable argument types. The number of arguments must be
// equal to the number of columns. Pass nil to specify that a column should be
// ignored.
func (r *Row) Columns(ptrs ...interface{}) error {
	if len(ptrs) != len(r.vals) {
		return errNumOfColValue(len(ptrs), r)
	}
	if len(r.vals) != len(r.fields) {
		return errFieldsMismatchVals(r)
	}
	for i, p := range ptrs {
		if p == nil {
			continue
		}
		if err := r.Column(i, p); err != nil {
			return err
		}
	}
	return nil
}

// errToStructArgType returns error for p not having the correct data type(pointer to Go struct) to
// be the argument of Row.ToStruct.
func errToStructArgType(p interface{}) error {
	return spannerErrorf(codes.InvalidArgument, "ToStruct(): type %T is not a valid pointer to Go struct", p)
}

// ToStruct fetches the columns in a row into the fields of a struct.
// The rules for mapping a row's columns into a struct's exported fields
// are as the following:
// 1. If a field has a `spanner: "column_name"` tag, then decode column
//    'column_name' into the field. A special case is the `spanner: "-"`
//    tag, which instructs ToStruct to ignore the field during decoding.
// 2. Otherwise, if the name of a field matches the name of a column (ignoring case),
//    decode the column into the field.
//
// The fields of the destination struct can be of any type that is acceptable
// to spanner.Row.Column.
//
// Slice and pointer fields will be set to nil if the source column is NULL, and a
// non-nil value if the column is not NULL. To decode NULL values of other types, use
// one of the spanner.NullXXX types as the type of the destination field.
func (r *Row) ToStruct(p interface{}) error {
	// Check if p is a pointer to a struct
	if t := reflect.TypeOf(p); t == nil || t.Kind() != reflect.Ptr || t.Elem().Kind() != reflect.Struct {
		return errToStructArgType(p)
	}
	if len(r.vals) != len(r.fields) {
		return errFieldsMismatchVals(r)
	}
	// Call decodeStruct directly to decode the row as a typed proto.ListValue.
	return decodeStruct(
		&sppb.StructType{Fields: r.fields},
		&proto3.ListValue{Values: r.vals},
		p,
	)
}
