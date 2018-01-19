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
	"reflect"

	proto3 "github.com/golang/protobuf/ptypes/struct"

	sppb "google.golang.org/genproto/googleapis/spanner/v1"
	"google.golang.org/grpc/codes"
)

// op is the mutation operation.
type op int

const (
	// opDelete removes a row from a table.  Succeeds whether or not the
	// key was present.
	opDelete op = iota
	// opInsert inserts a row into a table.  If the row already exists, the
	// write or transaction fails.
	opInsert
	// opInsertOrUpdate inserts a row into a table. If the row already
	// exists, it updates it instead.  Any column values not explicitly
	// written are preserved.
	opInsertOrUpdate
	// opReplace inserts a row into a table, deleting any existing row.
	// Unlike InsertOrUpdate, this means any values not explicitly written
	// become NULL.
	opReplace
	// opUpdate updates a row in a table.  If the row does not already
	// exist, the write or transaction fails.
	opUpdate
)

// A Mutation describes a modification to one or more Cloud Spanner rows.  The
// mutation represents an insert, update, delete, etc on a table.
//
// Many mutations can be applied in a single atomic commit. For purposes of
// constraint checking (such as foreign key constraints), the operations can be
// viewed as applying in same order as the mutations are supplied in (so that
// e.g., a row and its logical "child" can be inserted in the same commit).
//
//	- The Apply function applies series of mutations.
//	- A ReadWriteTransaction applies a series of mutations as part of an
//	  atomic read-modify-write operation.
// Example:
//
//	m := spanner.Insert("User",
//		[]string{"user_id", "profile"},
//		[]interface{}{UserID, profile})
//	_, err := client.Apply(ctx, []*spanner.Mutation{m})
//
// In this example, we insert a new row into the User table. The primary key
// for the new row is UserID (presuming that "user_id" has been declared as the
// primary key of the "User" table).
//
// Updating a row
//
// Changing the values of columns in an existing row is very similar to
// inserting a new row:
//
//	m := spanner.Update("User",
//		[]string{"user_id", "profile"},
//		[]interface{}{UserID, profile})
//	_, err := client.Apply(ctx, []*spanner.Mutation{m})
//
// Deleting a row
//
// To delete a row, use spanner.Delete:
//
//	m := spanner.Delete("User", spanner.Key{UserId})
//	_, err := client.Apply(ctx, []*spanner.Mutation{m})
//
// spanner.Delete accepts a KeySet, so you can also pass in a KeyRange, or use the
// spanner.KeySets function to build any combination of Keys and KeyRanges.
//
// Note that deleting a row in a table may also delete rows from other tables
// if cascading deletes are specified in those tables' schemas. Delete does
// nothing if the named row does not exist (does not yield an error).
//
// Deleting a field
//
// To delete/clear a field within a row, use spanner.Update with the value nil:
//
//	m := spanner.Update("User",
//		[]string{"user_id", "profile"},
//		[]interface{}{UserID, nil})
//	_, err := client.Apply(ctx, []*spanner.Mutation{m})
//
// The valid Go types and their corresponding Cloud Spanner types that can be
// used in the Insert/Update/InsertOrUpdate functions are:
//
//     string, NullString - STRING
//     []string, []NullString - STRING ARRAY
//     []byte - BYTES
//     [][]byte - BYTES ARRAY
//     int, int64, NullInt64 - INT64
//     []int, []int64, []NullInt64 - INT64 ARRAY
//     bool, NullBool - BOOL
//     []bool, []NullBool - BOOL ARRAY
//     float64, NullFloat64 - FLOAT64
//     []float64, []NullFloat64 - FLOAT64 ARRAY
//     time.Time, NullTime - TIMESTAMP
//     []time.Time, []NullTime - TIMESTAMP ARRAY
//     Date, NullDate - DATE
//     []Date, []NullDate - DATE ARRAY
//
// To compare two Mutations for testing purposes, use reflect.DeepEqual.
type Mutation struct {
	// op is the operation type of the mutation.
	// See documentation for spanner.op for more details.
	op op
	// Table is the name of the target table to be modified.
	table string
	// keySet is a set of primary keys that names the rows
	// in a delete operation.
	keySet KeySet
	// columns names the set of columns that are going to be
	// modified by Insert, InsertOrUpdate, Replace or Update
	// operations.
	columns []string
	// values specifies the new values for the target columns
	// named by Columns.
	values []interface{}
}

// mapToMutationParams converts Go map into mutation parameters.
func mapToMutationParams(in map[string]interface{}) ([]string, []interface{}) {
	cols := []string{}
	vals := []interface{}{}
	for k, v := range in {
		cols = append(cols, k)
		vals = append(vals, v)
	}
	return cols, vals
}

// errNotStruct returns error for not getting a go struct type.
func errNotStruct(in interface{}) error {
	return spannerErrorf(codes.InvalidArgument, "%T is not a go struct type", in)
}

// structToMutationParams converts Go struct into mutation parameters.
// If the input is not a valid Go struct type, structToMutationParams
// returns error.
func structToMutationParams(in interface{}) ([]string, []interface{}, error) {
	if in == nil {
		return nil, nil, errNotStruct(in)
	}
	v := reflect.ValueOf(in)
	t := v.Type()
	if t.Kind() == reflect.Ptr && t.Elem().Kind() == reflect.Struct {
		// t is a pointer to a struct.
		if v.IsNil() {
			// Return empty results.
			return nil, nil, nil
		}
		// Get the struct value that in points to.
		v = v.Elem()
		t = t.Elem()
	}
	if t.Kind() != reflect.Struct {
		return nil, nil, errNotStruct(in)
	}
	fields, err := fieldCache.Fields(t)
	if err != nil {
		return nil, nil, toSpannerError(err)
	}
	var cols []string
	var vals []interface{}
	for _, f := range fields {
		cols = append(cols, f.Name)
		vals = append(vals, v.FieldByIndex(f.Index).Interface())
	}
	return cols, vals, nil
}

// Insert returns a Mutation to insert a row into a table. If the row already
// exists, the write or transaction fails.
func Insert(table string, cols []string, vals []interface{}) *Mutation {
	return &Mutation{
		op:      opInsert,
		table:   table,
		columns: cols,
		values:  vals,
	}
}

// InsertMap returns a Mutation to insert a row into a table, specified by
// a map of column name to value. If the row already exists, the write or
// transaction fails.
func InsertMap(table string, in map[string]interface{}) *Mutation {
	cols, vals := mapToMutationParams(in)
	return Insert(table, cols, vals)
}

// InsertStruct returns a Mutation to insert a row into a table, specified by
// a Go struct.  If the row already exists, the write or transaction fails.
//
// The in argument must be a struct or a pointer to a struct. Its exported
// fields specify the column names and values. Use a field tag like "spanner:name"
// to provide an alternative column name, or use "spanner:-" to ignore the field.
func InsertStruct(table string, in interface{}) (*Mutation, error) {
	cols, vals, err := structToMutationParams(in)
	if err != nil {
		return nil, err
	}
	return Insert(table, cols, vals), nil
}

// Update returns a Mutation to update a row in a table. If the row does not
// already exist, the write or transaction fails.
func Update(table string, cols []string, vals []interface{}) *Mutation {
	return &Mutation{
		op:      opUpdate,
		table:   table,
		columns: cols,
		values:  vals,
	}
}

// UpdateMap returns a Mutation to update a row in a table, specified by
// a map of column to value. If the row does not already exist, the write or
// transaction fails.
func UpdateMap(table string, in map[string]interface{}) *Mutation {
	cols, vals := mapToMutationParams(in)
	return Update(table, cols, vals)
}

// UpdateStruct returns a Mutation to update a row in a table, specified by a Go
// struct. If the row does not already exist, the write or transaction fails.
func UpdateStruct(table string, in interface{}) (*Mutation, error) {
	cols, vals, err := structToMutationParams(in)
	if err != nil {
		return nil, err
	}
	return Update(table, cols, vals), nil
}

// InsertOrUpdate returns a Mutation to insert a row into a table. If the row
// already exists, it updates it instead. Any column values not explicitly
// written are preserved.
//
// For a similar example, See Update.
func InsertOrUpdate(table string, cols []string, vals []interface{}) *Mutation {
	return &Mutation{
		op:      opInsertOrUpdate,
		table:   table,
		columns: cols,
		values:  vals,
	}
}

// InsertOrUpdateMap returns a Mutation to insert a row into a table,
// specified by a map of column to value. If the row already exists, it
// updates it instead. Any column values not explicitly written are preserved.
//
// For a similar example, See UpdateMap.
func InsertOrUpdateMap(table string, in map[string]interface{}) *Mutation {
	cols, vals := mapToMutationParams(in)
	return InsertOrUpdate(table, cols, vals)
}

// InsertOrUpdateStruct returns a Mutation to insert a row into a table,
// specified by a Go struct. If the row already exists, it updates it instead.
// Any column values not explicitly written are preserved.
//
// The in argument must be a struct or a pointer to a struct. Its exported
// fields specify the column names and values. Use a field tag like "spanner:name"
// to provide an alternative column name, or use "spanner:-" to ignore the field.
//
// For a similar example, See UpdateStruct.
func InsertOrUpdateStruct(table string, in interface{}) (*Mutation, error) {
	cols, vals, err := structToMutationParams(in)
	if err != nil {
		return nil, err
	}
	return InsertOrUpdate(table, cols, vals), nil
}

// Replace returns a Mutation to insert a row into a table, deleting any
// existing row. Unlike InsertOrUpdate, this means any values not explicitly
// written become NULL.
//
// For a similar example, See Update.
func Replace(table string, cols []string, vals []interface{}) *Mutation {
	return &Mutation{
		op:      opReplace,
		table:   table,
		columns: cols,
		values:  vals,
	}
}

// ReplaceMap returns a Mutation to insert a row into a table, deleting any
// existing row. Unlike InsertOrUpdateMap, this means any values not explicitly
// written become NULL.  The row is specified by a map of column to value.
//
// For a similar example, See UpdateMap.
func ReplaceMap(table string, in map[string]interface{}) *Mutation {
	cols, vals := mapToMutationParams(in)
	return Replace(table, cols, vals)
}

// ReplaceStruct returns a Mutation to insert a row into a table, deleting any
// existing row. Unlike InsertOrUpdateMap, this means any values not explicitly
// written become NULL.  The row is specified by a Go struct.
//
// The in argument must be a struct or a pointer to a struct. Its exported
// fields specify the column names and values. Use a field tag like "spanner:name"
// to provide an alternative column name, or use "spanner:-" to ignore the field.
//
// For a similar example, See UpdateStruct.
func ReplaceStruct(table string, in interface{}) (*Mutation, error) {
	cols, vals, err := structToMutationParams(in)
	if err != nil {
		return nil, err
	}
	return Replace(table, cols, vals), nil
}

// Delete removes the rows described by the KeySet from the table. It succeeds
// whether or not the keys were present.
func Delete(table string, ks KeySet) *Mutation {
	return &Mutation{
		op:     opDelete,
		table:  table,
		keySet: ks,
	}
}

// prepareWrite generates sppb.Mutation_Write from table name, column names
// and new column values.
func prepareWrite(table string, columns []string, vals []interface{}) (*sppb.Mutation_Write, error) {
	v, err := encodeValueArray(vals)
	if err != nil {
		return nil, err
	}
	return &sppb.Mutation_Write{
		Table:   table,
		Columns: columns,
		Values:  []*proto3.ListValue{v},
	}, nil
}

// errInvdMutationOp returns error for unrecognized mutation operation.
func errInvdMutationOp(m Mutation) error {
	return spannerErrorf(codes.InvalidArgument, "Unknown op type: %d", m.op)
}

// proto converts spanner.Mutation to sppb.Mutation, in preparation to send
// RPCs.
func (m Mutation) proto() (*sppb.Mutation, error) {
	var pb *sppb.Mutation
	switch m.op {
	case opDelete:
		var kp *sppb.KeySet
		if m.keySet != nil {
			var err error
			kp, err = m.keySet.keySetProto()
			if err != nil {
				return nil, err
			}
		}
		pb = &sppb.Mutation{
			Operation: &sppb.Mutation_Delete_{
				Delete: &sppb.Mutation_Delete{
					Table:  m.table,
					KeySet: kp,
				},
			},
		}
	case opInsert:
		w, err := prepareWrite(m.table, m.columns, m.values)
		if err != nil {
			return nil, err
		}
		pb = &sppb.Mutation{Operation: &sppb.Mutation_Insert{Insert: w}}
	case opInsertOrUpdate:
		w, err := prepareWrite(m.table, m.columns, m.values)
		if err != nil {
			return nil, err
		}
		pb = &sppb.Mutation{Operation: &sppb.Mutation_InsertOrUpdate{InsertOrUpdate: w}}
	case opReplace:
		w, err := prepareWrite(m.table, m.columns, m.values)
		if err != nil {
			return nil, err
		}
		pb = &sppb.Mutation{Operation: &sppb.Mutation_Replace{Replace: w}}
	case opUpdate:
		w, err := prepareWrite(m.table, m.columns, m.values)
		if err != nil {
			return nil, err
		}
		pb = &sppb.Mutation{Operation: &sppb.Mutation_Update{Update: w}}
	default:
		return nil, errInvdMutationOp(m)
	}
	return pb, nil
}

// mutationsProto turns a spanner.Mutation array into a sppb.Mutation array,
// it is convenient for sending batch mutations to Cloud Spanner.
func mutationsProto(ms []*Mutation) ([]*sppb.Mutation, error) {
	l := make([]*sppb.Mutation, 0, len(ms))
	for _, m := range ms {
		pb, err := m.proto()
		if err != nil {
			return nil, err
		}
		l = append(l, pb)
	}
	return l, nil
}
