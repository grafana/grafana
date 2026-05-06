// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

//go:build go1.18

package compute

import (
	"fmt"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/array"
	"github.com/apache/arrow-go/v18/arrow/scalar"
)

//go:generate go run golang.org/x/tools/cmd/stringer -type=DatumKind -linecomment

// DatumKind is an enum used for denoting which kind of type a datum is encapsulating
type DatumKind int

const (
	KindNone    DatumKind = iota // none
	KindScalar                   // scalar
	KindArray                    // array
	KindChunked                  // chunked_array
	KindRecord                   // record_batch
	KindTable                    // table
)

const UnknownLength int64 = -1

// DatumIsValue returns true if the datum passed is a Scalar, Array
// or ChunkedArray type (e.g. it contains a specific value not a
// group of values)
func DatumIsValue(d Datum) bool {
	switch d.Kind() {
	case KindScalar, KindArray, KindChunked:
		return true
	}
	return false
}

// Datum is a variant interface for wrapping the various Arrow data structures
// for now the various Datum types just hold a Value which is the type they
// are wrapping, but it might make sense in the future for those types
// to actually be aliases or embed their types instead. Not sure yet.
type Datum interface {
	fmt.Stringer
	Kind() DatumKind
	Len() int64
	Equals(Datum) bool
	Release()

	data() any
}

// ArrayLikeDatum is an interface for treating a Datum similarly to an Array,
// so that it is easy to differentiate between Record/Table/Collection and Scalar,
// Array/ChunkedArray for ease of use. Chunks will return an empty slice for Scalar,
// a slice with 1 element for Array, and the slice of chunks for a chunked array.
type ArrayLikeDatum interface {
	Datum
	NullN() int64
	Type() arrow.DataType
	Chunks() []arrow.Array
}

// TableLikeDatum is an interface type for specifying either a RecordBatch or a
// Table as both contain a schema as opposed to just a single data type.
type TableLikeDatum interface {
	Datum
	Schema() *arrow.Schema
}

// EmptyDatum is the null case, a Datum with nothing in it.
type EmptyDatum struct{}

func (EmptyDatum) String() string  { return "nullptr" }
func (EmptyDatum) Kind() DatumKind { return KindNone }
func (EmptyDatum) Len() int64      { return UnknownLength }
func (EmptyDatum) Release()        {}
func (EmptyDatum) Equals(other Datum) bool {
	_, ok := other.(EmptyDatum)
	return ok
}
func (EmptyDatum) data() any { return nil }

// ScalarDatum contains a scalar value
type ScalarDatum struct {
	Value scalar.Scalar
}

func (ScalarDatum) Kind() DatumKind         { return KindScalar }
func (ScalarDatum) Len() int64              { return 1 }
func (ScalarDatum) Chunks() []arrow.Array   { return nil }
func (d *ScalarDatum) Type() arrow.DataType { return d.Value.DataType() }
func (d *ScalarDatum) String() string       { return d.Value.String() }
func (d *ScalarDatum) ToScalar() (scalar.Scalar, error) {
	return d.Value, nil
}
func (d *ScalarDatum) data() any { return d.Value }
func (d *ScalarDatum) NullN() int64 {
	if d.Value.IsValid() {
		return 0
	}
	return 1
}

type releasable interface {
	Release()
}

func (d *ScalarDatum) Release() {
	if v, ok := d.Value.(releasable); ok {
		v.Release()
	}
}

func (d *ScalarDatum) Equals(other Datum) bool {
	if rhs, ok := other.(*ScalarDatum); ok {
		return scalar.Equals(d.Value, rhs.Value)
	}
	return false
}

// ArrayDatum references an array.Data object which can be used to create
// array instances from if needed.
type ArrayDatum struct {
	Value arrow.ArrayData
}

func (ArrayDatum) Kind() DatumKind           { return KindArray }
func (d *ArrayDatum) Type() arrow.DataType   { return d.Value.DataType() }
func (d *ArrayDatum) Len() int64             { return int64(d.Value.Len()) }
func (d *ArrayDatum) NullN() int64           { return int64(d.Value.NullN()) }
func (d *ArrayDatum) String() string         { return fmt.Sprintf("Array:{%s}", d.Value.DataType()) }
func (d *ArrayDatum) MakeArray() arrow.Array { return array.MakeFromData(d.Value) }
func (d *ArrayDatum) Chunks() []arrow.Array  { return []arrow.Array{d.MakeArray()} }
func (d *ArrayDatum) ToScalar() (scalar.Scalar, error) {
	return scalar.NewListScalarData(d.Value), nil
}
func (d *ArrayDatum) Release() {
	d.Value.Release()
	d.Value = nil
}
func (d *ArrayDatum) data() any { return d.Value }
func (d *ArrayDatum) Equals(other Datum) bool {
	rhs, ok := other.(*ArrayDatum)
	if !ok {
		return false
	}

	left := d.MakeArray()
	defer left.Release()
	right := rhs.MakeArray()
	defer right.Release()

	return array.Equal(left, right)
}

// ChunkedDatum contains a chunked array for use with expressions and compute.
type ChunkedDatum struct {
	Value *arrow.Chunked
}

func (ChunkedDatum) Kind() DatumKind          { return KindChunked }
func (d *ChunkedDatum) Type() arrow.DataType  { return d.Value.DataType() }
func (d *ChunkedDatum) Len() int64            { return int64(d.Value.Len()) }
func (d *ChunkedDatum) NullN() int64          { return int64(d.Value.NullN()) }
func (d *ChunkedDatum) String() string        { return fmt.Sprintf("Array:{%s}", d.Value.DataType()) }
func (d *ChunkedDatum) Chunks() []arrow.Array { return d.Value.Chunks() }
func (d *ChunkedDatum) data() any             { return d.Value }
func (d *ChunkedDatum) Release() {
	d.Value.Release()
	d.Value = nil
}

func (d *ChunkedDatum) Equals(other Datum) bool {
	if rhs, ok := other.(*ChunkedDatum); ok {
		return array.ChunkedEqual(d.Value, rhs.Value)
	}
	return false
}

// RecordDatum contains an array.Record for passing a full record to an expression
// or to compute.
type RecordDatum struct {
	Value arrow.Record
}

func (RecordDatum) Kind() DatumKind          { return KindRecord }
func (RecordDatum) String() string           { return "RecordBatch" }
func (r *RecordDatum) Len() int64            { return r.Value.NumRows() }
func (r *RecordDatum) Schema() *arrow.Schema { return r.Value.Schema() }
func (r *RecordDatum) data() any             { return r.Value }
func (r *RecordDatum) Release() {
	r.Value.Release()
	r.Value = nil
}

func (r *RecordDatum) Equals(other Datum) bool {
	if rhs, ok := other.(*RecordDatum); ok {
		return array.RecordEqual(r.Value, rhs.Value)
	}
	return false
}

// TableDatum contains a table so that multiple record batches can be worked with
// together as a single table for being passed to compute and expression handling.
type TableDatum struct {
	Value arrow.Table
}

func (TableDatum) Kind() DatumKind          { return KindTable }
func (TableDatum) String() string           { return "Table" }
func (d *TableDatum) Len() int64            { return d.Value.NumRows() }
func (d *TableDatum) Schema() *arrow.Schema { return d.Value.Schema() }
func (d *TableDatum) data() any             { return d.Value }
func (d *TableDatum) Release() {
	d.Value.Release()
	d.Value = nil
}

func (d *TableDatum) Equals(other Datum) bool {
	if rhs, ok := other.(*TableDatum); ok {
		return array.TableEqual(d.Value, rhs.Value)
	}
	return false
}

// NewDatum will construct the appropriate Datum type based on what is passed in
// as the argument.
//
// An arrow.Array gets an ArrayDatum
// An array.Chunked gets a ChunkedDatum
// An array.Record gets a RecordDatum
// an array.Table gets a TableDatum
// a scalar.Scalar gets a ScalarDatum
//
// Anything else is passed to scalar.MakeScalar and receives a scalar
// datum of that appropriate type.
func NewDatum(value interface{}) Datum {
	switch v := value.(type) {
	case Datum:
		return NewDatum(v.data())
	case arrow.Array:
		v.Data().Retain()
		return &ArrayDatum{v.Data()}
	case scalar.Releasable:
		v.Retain()
		return NewDatumWithoutOwning(v)
	case scalar.Scalar:
		return &ScalarDatum{v}
	default:
		return &ScalarDatum{scalar.MakeScalar(value)}
	}
}

// NewDatumWithoutOwning is like NewDatum only it does not call Retain on
// the passed in value (if applicable). This means that if the resulting
// Datum should not have Release called on it and the original value needs
// to outlive the Datum.
//
// Only use this if you know what you're doing. For the most part this is
// just a convenience function.+-

func NewDatumWithoutOwning(value interface{}) Datum {
	switch v := value.(type) {
	case arrow.Array:
		return &ArrayDatum{v.Data()}
	case arrow.ArrayData:
		return &ArrayDatum{v}
	case *arrow.Chunked:
		return &ChunkedDatum{v}
	case arrow.Record:
		return &RecordDatum{v}
	case arrow.Table:
		return &TableDatum{v}
	case scalar.Scalar:
		return &ScalarDatum{v}
	default:
		return &ScalarDatum{scalar.MakeScalar(value)}
	}
}

var (
	_ ArrayLikeDatum = (*ScalarDatum)(nil)
	_ ArrayLikeDatum = (*ArrayDatum)(nil)
	_ ArrayLikeDatum = (*ChunkedDatum)(nil)
	_ TableLikeDatum = (*RecordDatum)(nil)
	_ TableLikeDatum = (*TableDatum)(nil)
)
