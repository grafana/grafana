// Copyright 2020-2021 Dolthub, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package sql

import (
	"sync"

	querypb "github.com/dolthub/vitess/go/vt/proto/query"
)

const (
	valueArrSize = 64
	fieldArrSize = 2048
)

// Row2 is a slice of values
type Row2 []Value

// GetField returns the Value for the ith field in this row.
func (r Row2) GetField(i int) Value {
	return r[i]
}

// Len returns the number of fields of this row
func (r Row2) Len() int {
	return len(r)
}

// Value is a logical index into a Row2. For efficiency reasons, use sparingly.
type Value struct {
	Val ValueBytes
	Typ querypb.Type
}

// IsNull returns whether this value represents NULL
func (v Value) IsNull() bool {
	return v.Val == nil || v.Typ == querypb.Type_NULL_TYPE
}

type ValueBytes []byte

type RowFrame struct {
	Types []querypb.Type

	// Values are the values this row.
	Values []ValueBytes

	// varr is used as the backing array for the |Values|
	// slice when len(Values) <= valueArrSize
	varr [valueArrSize][]ValueBytes

	// farr is used as the backing array for |Value.Val|
	// slices when there is capacity
	farr [fieldArrSize]byte

	// off tracks the next available position in |farr|
	off uint16
}

func NewRowFrame(vals ...Value) (f *RowFrame) {
	f = framePool.Get().(*RowFrame)
	f.Append(vals...)
	return
}

var framePool = sync.Pool{New: makeRowFrame}

func makeRowFrame() interface{} {
	return &RowFrame{}
}

// Recycle returns this row frame to the shared pool. Further use will result in concurrency errors. All RowFrames
// should be recycled when they are no longer being used to prevent resource leaks.
func (f *RowFrame) Recycle() {
	f.Clear()
	framePool.Put(f)
}

// Row2 returns the underlying row value in this frame. Does not make a deep copy of underlying byte arrays, so
// further modification to this frame may result in the returned value changing as well.
func (f *RowFrame) Row2() Row2 {
	if f == nil {
		return nil
	}

	rs := make(Row2, len(f.Values))
	for i := range f.Values {
		rs[i] = Value{
			Typ: f.Types[i],
			Val: f.Values[i],
		}
	}
	return rs
}

// Row2Copy returns the row in this frame as a deep copy of the underlying byte arrays. Useful when reusing the
// RowFrame object via Clear()
func (f *RowFrame) Row2Copy() Row2 {
	rs := make(Row2, len(f.Values))
	// TODO: it would be faster here to just copy the entire value backing array in one pass
	for i := range f.Values {
		v := make(ValueBytes, len(f.Values[i]))
		copy(v, f.Values[i])
		rs[i] = Value{
			Typ: f.Types[i],
			Val: v,
		}
	}
	return rs
}

// Clear clears this row frame for reuse. The underlying byte arrays are not zeroed out or discarded, but will be
// overwritten by future calls to Append.
func (f *RowFrame) Clear() {
	f.Types = f.Types[:0]
	f.Values = f.Values[:0]
	f.off = 0
}

// Append appends the values given into this frame.
func (f *RowFrame) Append(vals ...Value) {
	for _, v := range vals {
		f.append(v)
	}
}

// AppendMany appends the types and values given, as two parallel arrays, into this frame.
func (f *RowFrame) AppendMany(types []querypb.Type, vals []ValueBytes) {
	// TODO: one big copy here would be better probably, need to benchmark
	for i := range vals {
		f.appendTypeAndVal(types[i], vals[i])
	}
}

func (f *RowFrame) append(v Value) {
	buf := f.getBuffer(v)
	copy(buf, v.Val)
	v.Val = buf

	f.Types = append(f.Types, v.Typ)

	// if |f.Values| grows past |len(f.varr)|
	// we'll allocate a new backing array here
	f.Values = append(f.Values, v.Val)
}

func (f *RowFrame) appendTypeAndVal(typ querypb.Type, val ValueBytes) {
	v := f.bufferForBytes(val)
	copy(v, val)

	f.Types = append(f.Types, typ)

	// if |f.Values| grows past |len(f.varr)|
	// we'll allocate a new backing array here
	f.Values = append(f.Values, v)
}

func (f *RowFrame) getBuffer(v Value) (buf []byte) {
	return f.bufferForBytes(v.Val)
}

func (f *RowFrame) bufferForBytes(v ValueBytes) (buf []byte) {
	if f.checkCapacity(v) {
		start := f.off
		f.off += uint16(len(v))
		stop := f.off
		buf = f.farr[start:stop]
	} else {
		buf = make([]byte, len(v))
	}

	return
}

func (f *RowFrame) checkCapacity(v ValueBytes) bool {
	return len(v) <= (len(f.farr) - int(f.off))
}
