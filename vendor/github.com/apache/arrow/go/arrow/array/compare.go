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

package array

import (
	"math"

	"github.com/apache/arrow/go/arrow"
	"github.com/apache/arrow/go/arrow/float16"
	"golang.org/x/xerrors"
)

// RecordEqual reports whether the two provided records are equal.
func RecordEqual(left, right Record) bool {
	switch {
	case left.NumCols() != right.NumCols():
		return false
	case left.NumRows() != right.NumRows():
		return false
	}

	for i := range left.Columns() {
		lc := left.Column(i)
		rc := right.Column(i)
		if !ArrayEqual(lc, rc) {
			return false
		}
	}
	return true
}

// RecordApproxEqual reports whether the two provided records are approximately equal.
// For non-floating point columns, it is equivalent to RecordEqual.
func RecordApproxEqual(left, right Record, opts ...EqualOption) bool {
	switch {
	case left.NumCols() != right.NumCols():
		return false
	case left.NumRows() != right.NumRows():
		return false
	}

	opt := newEqualOption(opts...)

	for i := range left.Columns() {
		lc := left.Column(i)
		rc := right.Column(i)
		if !arrayApproxEqual(lc, rc, opt) {
			return false
		}
	}
	return true
}

// ArrayEqual reports whether the two provided arrays are equal.
func ArrayEqual(left, right Interface) bool {
	switch {
	case !baseArrayEqual(left, right):
		return false
	case left.Len() == 0:
		return true
	case left.NullN() == left.Len():
		return true
	}

	// at this point, we know both arrays have same type, same length, same number of nulls
	// and nulls at the same place.
	// compare the values.

	switch l := left.(type) {
	case *Null:
		return true
	case *Boolean:
		r := right.(*Boolean)
		return arrayEqualBoolean(l, r)
	case *FixedSizeBinary:
		r := right.(*FixedSizeBinary)
		return arrayEqualFixedSizeBinary(l, r)
	case *Binary:
		r := right.(*Binary)
		return arrayEqualBinary(l, r)
	case *String:
		r := right.(*String)
		return arrayEqualString(l, r)
	case *Int8:
		r := right.(*Int8)
		return arrayEqualInt8(l, r)
	case *Int16:
		r := right.(*Int16)
		return arrayEqualInt16(l, r)
	case *Int32:
		r := right.(*Int32)
		return arrayEqualInt32(l, r)
	case *Int64:
		r := right.(*Int64)
		return arrayEqualInt64(l, r)
	case *Uint8:
		r := right.(*Uint8)
		return arrayEqualUint8(l, r)
	case *Uint16:
		r := right.(*Uint16)
		return arrayEqualUint16(l, r)
	case *Uint32:
		r := right.(*Uint32)
		return arrayEqualUint32(l, r)
	case *Uint64:
		r := right.(*Uint64)
		return arrayEqualUint64(l, r)
	case *Float16:
		r := right.(*Float16)
		return arrayEqualFloat16(l, r)
	case *Float32:
		r := right.(*Float32)
		return arrayEqualFloat32(l, r)
	case *Float64:
		r := right.(*Float64)
		return arrayEqualFloat64(l, r)
	case *Decimal128:
		r := right.(*Decimal128)
		return arrayEqualDecimal128(l, r)
	case *Date32:
		r := right.(*Date32)
		return arrayEqualDate32(l, r)
	case *Date64:
		r := right.(*Date64)
		return arrayEqualDate64(l, r)
	case *Time32:
		r := right.(*Time32)
		return arrayEqualTime32(l, r)
	case *Time64:
		r := right.(*Time64)
		return arrayEqualTime64(l, r)
	case *Timestamp:
		r := right.(*Timestamp)
		return arrayEqualTimestamp(l, r)
	case *List:
		r := right.(*List)
		return arrayEqualList(l, r)
	case *FixedSizeList:
		r := right.(*FixedSizeList)
		return arrayEqualFixedSizeList(l, r)
	case *Struct:
		r := right.(*Struct)
		return arrayEqualStruct(l, r)
	case *MonthInterval:
		r := right.(*MonthInterval)
		return arrayEqualMonthInterval(l, r)
	case *DayTimeInterval:
		r := right.(*DayTimeInterval)
		return arrayEqualDayTimeInterval(l, r)
	case *Duration:
		r := right.(*Duration)
		return arrayEqualDuration(l, r)

	default:
		panic(xerrors.Errorf("arrow/array: unknown array type %T", l))
	}
}

// ArraySliceEqual reports whether slices left[lbeg:lend] and right[rbeg:rend] are equal.
func ArraySliceEqual(left Interface, lbeg, lend int64, right Interface, rbeg, rend int64) bool {
	l := NewSlice(left, lbeg, lend)
	defer l.Release()
	r := NewSlice(right, rbeg, rend)
	defer r.Release()

	return ArrayEqual(l, r)
}

const defaultAbsoluteTolerance = 1e-5

type equalOption struct {
	atol   float64 // absolute tolerance
	nansEq bool    // whether NaNs are considered equal.
}

func (eq equalOption) f16(f1, f2 float16.Num) bool {
	v1 := float64(f1.Float32())
	v2 := float64(f2.Float32())
	switch {
	case eq.nansEq:
		return math.Abs(v1-v2) <= eq.atol || (math.IsNaN(v1) && math.IsNaN(v2))
	default:
		return math.Abs(v1-v2) <= eq.atol
	}
}

func (eq equalOption) f32(f1, f2 float32) bool {
	v1 := float64(f1)
	v2 := float64(f2)
	switch {
	case eq.nansEq:
		return math.Abs(v1-v2) <= eq.atol || (math.IsNaN(v1) && math.IsNaN(v2))
	default:
		return math.Abs(v1-v2) <= eq.atol
	}
}

func (eq equalOption) f64(v1, v2 float64) bool {
	switch {
	case eq.nansEq:
		return math.Abs(v1-v2) <= eq.atol || (math.IsNaN(v1) && math.IsNaN(v2))
	default:
		return math.Abs(v1-v2) <= eq.atol
	}
}

func newEqualOption(opts ...EqualOption) equalOption {
	eq := equalOption{
		atol:   defaultAbsoluteTolerance,
		nansEq: false,
	}
	for _, opt := range opts {
		opt(&eq)
	}

	return eq
}

// EqualOption is a functional option type used to configure how Records and Arrays are compared.
type EqualOption func(*equalOption)

// WithNaNsEqual configures the comparison functions so that NaNs are considered equal.
func WithNaNsEqual(v bool) EqualOption {
	return func(o *equalOption) {
		o.nansEq = v
	}
}

// WithAbsTolerance configures the comparison functions so that 2 floating point values
// v1 and v2 are considered equal if |v1-v2| <= atol.
func WithAbsTolerance(atol float64) EqualOption {
	return func(o *equalOption) {
		o.atol = atol
	}
}

// ArrayApproxEqual reports whether the two provided arrays are approximately equal.
// For non-floating point arrays, it is equivalent to ArrayEqual.
func ArrayApproxEqual(left, right Interface, opts ...EqualOption) bool {
	opt := newEqualOption(opts...)
	return arrayApproxEqual(left, right, opt)
}

func arrayApproxEqual(left, right Interface, opt equalOption) bool {
	switch {
	case !baseArrayEqual(left, right):
		return false
	case left.Len() == 0:
		return true
	case left.NullN() == left.Len():
		return true
	}

	// at this point, we know both arrays have same type, same length, same number of nulls
	// and nulls at the same place.
	// compare the values.

	switch l := left.(type) {
	case *Null:
		return true
	case *Boolean:
		r := right.(*Boolean)
		return arrayEqualBoolean(l, r)
	case *FixedSizeBinary:
		r := right.(*FixedSizeBinary)
		return arrayEqualFixedSizeBinary(l, r)
	case *Binary:
		r := right.(*Binary)
		return arrayEqualBinary(l, r)
	case *String:
		r := right.(*String)
		return arrayEqualString(l, r)
	case *Int8:
		r := right.(*Int8)
		return arrayEqualInt8(l, r)
	case *Int16:
		r := right.(*Int16)
		return arrayEqualInt16(l, r)
	case *Int32:
		r := right.(*Int32)
		return arrayEqualInt32(l, r)
	case *Int64:
		r := right.(*Int64)
		return arrayEqualInt64(l, r)
	case *Uint8:
		r := right.(*Uint8)
		return arrayEqualUint8(l, r)
	case *Uint16:
		r := right.(*Uint16)
		return arrayEqualUint16(l, r)
	case *Uint32:
		r := right.(*Uint32)
		return arrayEqualUint32(l, r)
	case *Uint64:
		r := right.(*Uint64)
		return arrayEqualUint64(l, r)
	case *Float16:
		r := right.(*Float16)
		return arrayApproxEqualFloat16(l, r, opt)
	case *Float32:
		r := right.(*Float32)
		return arrayApproxEqualFloat32(l, r, opt)
	case *Float64:
		r := right.(*Float64)
		return arrayApproxEqualFloat64(l, r, opt)
	case *Decimal128:
		r := right.(*Decimal128)
		return arrayEqualDecimal128(l, r)
	case *Date32:
		r := right.(*Date32)
		return arrayEqualDate32(l, r)
	case *Date64:
		r := right.(*Date64)
		return arrayEqualDate64(l, r)
	case *Time32:
		r := right.(*Time32)
		return arrayEqualTime32(l, r)
	case *Time64:
		r := right.(*Time64)
		return arrayEqualTime64(l, r)
	case *Timestamp:
		r := right.(*Timestamp)
		return arrayEqualTimestamp(l, r)
	case *List:
		r := right.(*List)
		return arrayApproxEqualList(l, r, opt)
	case *FixedSizeList:
		r := right.(*FixedSizeList)
		return arrayApproxEqualFixedSizeList(l, r, opt)
	case *Struct:
		r := right.(*Struct)
		return arrayApproxEqualStruct(l, r, opt)
	case *MonthInterval:
		r := right.(*MonthInterval)
		return arrayEqualMonthInterval(l, r)
	case *DayTimeInterval:
		r := right.(*DayTimeInterval)
		return arrayEqualDayTimeInterval(l, r)
	case *Duration:
		r := right.(*Duration)
		return arrayEqualDuration(l, r)

	default:
		panic(xerrors.Errorf("arrow/array: unknown array type %T", l))
	}

	return false
}

func baseArrayEqual(left, right Interface) bool {
	switch {
	case left.Len() != right.Len():
		return false
	case left.NullN() != right.NullN():
		return false
	case !arrow.TypeEqual(left.DataType(), right.DataType()): // We do not check for metadata as in the C++ implementation.
		return false
	case !validityBitmapEqual(left, right):
		return false
	}
	return true
}

func validityBitmapEqual(left, right Interface) bool {
	// TODO(alexandreyc): make it faster by comparing byte slices of the validity bitmap?
	n := left.Len()
	if n != right.Len() {
		return false
	}
	for i := 0; i < n; i++ {
		if left.IsNull(i) != right.IsNull(i) {
			return false
		}
	}
	return true
}

func arrayApproxEqualFloat16(left, right *Float16, opt equalOption) bool {
	for i := 0; i < left.Len(); i++ {
		if left.IsNull(i) {
			continue
		}
		if !opt.f16(left.Value(i), right.Value(i)) {
			return false
		}
	}
	return true
}

func arrayApproxEqualFloat32(left, right *Float32, opt equalOption) bool {
	for i := 0; i < left.Len(); i++ {
		if left.IsNull(i) {
			continue
		}
		if !opt.f32(left.Value(i), right.Value(i)) {
			return false
		}
	}
	return true
}

func arrayApproxEqualFloat64(left, right *Float64, opt equalOption) bool {
	for i := 0; i < left.Len(); i++ {
		if left.IsNull(i) {
			continue
		}
		if !opt.f64(left.Value(i), right.Value(i)) {
			return false
		}
	}
	return true
}

func arrayApproxEqualList(left, right *List, opt equalOption) bool {
	for i := 0; i < left.Len(); i++ {
		if left.IsNull(i) {
			continue
		}
		o := func() bool {
			l := left.newListValue(i)
			defer l.Release()
			r := right.newListValue(i)
			defer r.Release()
			return arrayApproxEqual(l, r, opt)
		}()
		if !o {
			return false
		}
	}
	return true
}

func arrayApproxEqualFixedSizeList(left, right *FixedSizeList, opt equalOption) bool {
	for i := 0; i < left.Len(); i++ {
		if left.IsNull(i) {
			continue
		}
		o := func() bool {
			l := left.newListValue(i)
			defer l.Release()
			r := right.newListValue(i)
			defer r.Release()
			return arrayApproxEqual(l, r, opt)
		}()
		if !o {
			return false
		}
	}
	return true
}

func arrayApproxEqualStruct(left, right *Struct, opt equalOption) bool {
	for i, lf := range left.fields {
		rf := right.fields[i]
		if !arrayApproxEqual(lf, rf, opt) {
			return false
		}
	}
	return true
}
