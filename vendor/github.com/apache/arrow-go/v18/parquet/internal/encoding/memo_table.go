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

package encoding

import (
	"math"
	"unsafe"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/array"
	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/internal/hashing"
	"github.com/apache/arrow-go/v18/parquet"
)

//go:generate go run ../../../arrow/_tools/tmpl/main.go -i -data=physical_types.tmpldata memo_table_types.gen.go.tmpl

// MemoTable interface that can be used to swap out implementations of the hash table
// used for handling dictionary encoding. Dictionary encoding is built against this interface
// to make it easy for code generation and changing implementations.
//
// Values should remember the order they are inserted to generate a valid dictionary index
type MemoTable interface {
	// Reset drops everything in the table allowing it to be reused
	Reset()
	// Size returns the current number of unique values stored in the table
	// including whether or not a null value has been passed in using GetOrInsertNull
	Size() int
	// CopyValues populates out with the values currently in the table, out must
	// be a slice of the appropriate type for the table type.
	CopyValues(out interface{})
	// CopyValuesSubset is like CopyValues but only copies a subset of values starting
	// at the indicated index.
	CopyValuesSubset(start int, out interface{})

	WriteOut(out []byte)
	WriteOutSubset(start int, out []byte)
	// Get returns the index of the table the specified value is, and a boolean indicating
	// whether or not the value was found in the table. Will panic if val is not the appropriate
	// type for the underlying table.
	Get(val interface{}) (int, bool)
	// GetOrInsert is the same as Get, except if the value is not currently in the table it will
	// be inserted into the table.
	GetOrInsert(val interface{}) (idx int, existed bool, err error)
	// GetNull returns the index of the null value and whether or not it was found in the table
	GetNull() (int, bool)
	// GetOrInsertNull returns the index of the null value, if it didn't already exist in the table,
	// it is inserted.
	GetOrInsertNull() (idx int, existed bool)
}

type NumericMemoTable interface {
	MemoTable
	// WriteOutLE writes the contents of the memo table out to the byteslice
	// but ensures the values are little-endian before writing them (converting
	// if on a big endian system).
	WriteOutLE(out []byte)
	// WriteOutSubsetLE writes the contents of the memo table out to the byteslice
	// starting with the index indicated by start, but ensures the values are little
	// endian before writing them (converting if on a big-endian system).
	WriteOutSubsetLE(start int, out []byte)
}

// using a generic type alias would require go1.24, so for now we'll just create
// a new interface that we can later on replace as an alias.
type TypedMemoTable[T hashing.MemoTypes] interface {
	MemoTable
	Exists(T) bool
	InsertOrGet(val T) (idx int, found bool, err error)
}

// BinaryMemoTable is an extension of the MemoTable interface adding extra methods
// for handling byte arrays/strings/fixed length byte arrays.
type BinaryMemoTable interface {
	MemoTable
	// ValuesSize returns the total number of bytes needed to copy all of the values
	// from this table.
	ValuesSize() int
	// CopyOffsets populates out with the start and end offsets of each value in the
	// table data. Out should be sized to Size()+1 to accomodate all of the offsets.
	CopyOffsets(out []int32)
	// CopyOffsetsSubset is like CopyOffsets but only gets a subset of the offsets
	// starting at the specified index.
	CopyOffsetsSubset(start int, out []int32)
	// CopyFixedWidthValues exists to cope with the fact that the table doesn't track
	// the fixed width when inserting the null value into the databuffer populating
	// a zero length byte slice for the null value (if found).
	CopyFixedWidthValues(start int, width int, out []byte)
	// VisitValues calls visitFn on each value in the table starting with the index specified
	VisitValues(start int, visitFn func([]byte))
	// Retain increases the reference count of the separately stored binary data that is
	// kept alongside the table which contains all of the values in the table. This is
	// safe to call simultaneously across multiple goroutines.
	Retain()
	// Release decreases the reference count by 1 of the separately stored binary data
	// kept alongside the table containing the values. When the reference count goes to
	// 0, the memory is freed. This is safe to call across multiple goroutines simultaneously.
	Release()
}

func NewDictionary[T int32 | int64 | float32 | float64]() TypedMemoTable[T] {
	return hashing.NewMemoTable[T](0)
}

// NewInt32Dictionary returns a memotable interface for use with Int32 values only
func NewInt32Dictionary() MemoTable {
	return hashing.NewMemoTable[int32](0)
}

// NewInt64Dictionary returns a memotable interface for use with Int64 values only
func NewInt64Dictionary() MemoTable {
	return hashing.NewMemoTable[int64](0)
}

// NewFloat32Dictionary returns a memotable interface for use with Float32 values only
func NewFloat32Dictionary() MemoTable {
	return hashing.NewMemoTable[float32](0)
}

// NewFloat64Dictionary returns a memotable interface for use with Float64 values only
func NewFloat64Dictionary() MemoTable {
	return hashing.NewMemoTable[float64](0)
}

// NewBinaryDictionary returns a memotable interface for use with strings, byte slices,
// parquet.ByteArray and parquet.FixedLengthByteArray only.
func NewBinaryDictionary(mem memory.Allocator) BinaryMemoTable {
	return hashing.NewBinaryMemoTable(0, -1, array.NewBinaryBuilder(mem, arrow.BinaryTypes.Binary))
}

const keyNotFound = hashing.KeyNotFound

// standard map based implementation of a binary memotable which is only kept around
// currently to be used as a benchmark against the memotables in the internal/hashing
// module as a baseline comparison.

func NewBinaryMemoTable(mem memory.Allocator) BinaryMemoTable {
	return &binaryMemoTableImpl{
		table:     make(map[string]int),
		nullIndex: keyNotFound,
		builder:   array.NewBinaryBuilder(mem, arrow.BinaryTypes.Binary),
	}
}

type binaryMemoTableImpl struct {
	table     map[string]int
	builder   *array.BinaryBuilder
	nullIndex int
}

func (m *binaryMemoTableImpl) Reset() {
	m.table = make(map[string]int)
	m.nullIndex = keyNotFound
	m.builder.NewArray().Release()
}

func (m *binaryMemoTableImpl) CopyValues(out interface{}) {
	m.CopyValuesSubset(0, out)
}

func (m *binaryMemoTableImpl) GetNull() (int, bool) {
	return m.nullIndex, m.nullIndex != keyNotFound
}

func (m *binaryMemoTableImpl) ValuesSize() int {
	return m.builder.DataLen()
}

func (m *binaryMemoTableImpl) Size() int {
	sz := len(m.table)
	if _, ok := m.GetNull(); ok {
		sz++
	}
	return sz
}

func (m *binaryMemoTableImpl) valAsString(val interface{}) string {
	switch v := val.(type) {
	case string:
		return v
	case []byte:
		return *(*string)(unsafe.Pointer(&v))
	case parquet.ByteArray:
		return *(*string)(unsafe.Pointer(&v))
	case parquet.FixedLenByteArray:
		return *(*string)(unsafe.Pointer(&v))
	default:
		panic("invalid type for value in binarymemotable")
	}
}

func (m *binaryMemoTableImpl) Get(val interface{}) (int, bool) {
	key := m.valAsString(val)
	if p, ok := m.table[key]; ok {
		return p, true
	}
	return keyNotFound, false
}

func (m *binaryMemoTableImpl) GetOrInsert(val interface{}) (idx int, found bool, err error) {
	key := m.valAsString(val)
	idx, found = m.table[key]
	if !found {
		idx = m.Size()
		m.builder.AppendString(key)
		m.table[key] = idx
	}
	return
}

func (m *binaryMemoTableImpl) GetOrInsertNull() (idx int, found bool) {
	idx, found = m.GetNull()
	if !found {
		idx = m.Size()
		m.nullIndex = idx
		m.builder.AppendNull()
	}
	return
}

func (m *binaryMemoTableImpl) findOffset(idx int) uintptr {
	val := m.builder.Value(idx)
	for len(val) == 0 {
		idx++
		if idx >= m.builder.Len() {
			break
		}
		val = m.builder.Value(idx)
	}
	if len(val) != 0 {
		return uintptr(unsafe.Pointer(&val[0]))
	}
	return uintptr(m.builder.DataLen()) + m.findOffset(0)
}

func (m *binaryMemoTableImpl) CopyValuesSubset(start int, out interface{}) {
	var (
		first  = m.findOffset(0)
		offset = m.findOffset(int(start))
		length = m.builder.DataLen() - int(offset-first)
	)

	outval := out.([]byte)
	copy(outval, m.builder.Value(start)[0:length])
}

func (m *binaryMemoTableImpl) WriteOut(out []byte) {
	m.CopyValues(out)
}

func (m *binaryMemoTableImpl) WriteOutSubset(start int, out []byte) {
	m.CopyValuesSubset(start, out)
}

func (m *binaryMemoTableImpl) CopyFixedWidthValues(start, width int, out []byte) {

}

func (m *binaryMemoTableImpl) CopyOffsetsSubset(start int, out []int32) {
	if m.builder.Len() <= start {
		return
	}

	first := m.findOffset(0)
	delta := m.findOffset(start)
	for i := start; i < m.Size(); i++ {
		offset := int32(m.findOffset(i) - delta)
		out[i-start] = offset
	}

	out[m.Size()-start] = int32(m.builder.DataLen() - int(delta) - int(first))
}

func (m *binaryMemoTableImpl) CopyOffsets(out []int32) {
	m.CopyOffsetsSubset(0, out)
}

func (m *binaryMemoTableImpl) VisitValues(start int, visitFn func([]byte)) {
	for i := int(start); i < m.Size(); i++ {
		visitFn(m.builder.Value(i))
	}
}

func (m *binaryMemoTableImpl) Release() {
	m.builder.Release()
}

func (m *binaryMemoTableImpl) Retain() {
	m.builder.Retain()
}

// standard map based implementation of a float64 memotable which is only kept around
// currently to be used as a benchmark against the memotables in the internal/hashing
// module as a baseline comparison.

func NewFloat64MemoTable(memory.Allocator) MemoTable {
	return &float64MemoTableImpl{
		table: make(map[float64]struct {
			value     float64
			memoIndex int
		}),
		nullIndex: keyNotFound,
		nanIndex:  keyNotFound,
	}
}

type float64MemoTableImpl struct {
	table map[float64]struct {
		value     float64
		memoIndex int
	}
	nullIndex int
	nanIndex  int
}

func (m *float64MemoTableImpl) Reset() {
	m.table = make(map[float64]struct {
		value     float64
		memoIndex int
	})
	m.nullIndex = keyNotFound
	m.nanIndex = keyNotFound
}

func (m *float64MemoTableImpl) GetNull() (int, bool) {
	return m.nullIndex, m.nullIndex != keyNotFound
}

func (m *float64MemoTableImpl) Size() int {
	sz := len(m.table)
	if _, ok := m.GetNull(); ok {
		sz++
	}
	if m.nanIndex != keyNotFound {
		sz++
	}
	return sz
}

func (m *float64MemoTableImpl) GetOrInsertNull() (idx int, found bool) {
	idx, found = m.GetNull()
	if !found {
		idx = m.Size()
		m.nullIndex = idx
	}
	return
}

func (m *float64MemoTableImpl) Get(val interface{}) (int, bool) {
	v := val.(float64)
	if p, ok := m.table[v]; ok {
		return p.memoIndex, true
	}
	if math.IsNaN(v) && m.nanIndex != keyNotFound {
		return m.nanIndex, true
	}
	return keyNotFound, false
}

func (m *float64MemoTableImpl) GetOrInsert(val interface{}) (idx int, found bool, err error) {
	v := val.(float64)
	if math.IsNaN(v) {
		if m.nanIndex == keyNotFound {
			idx = m.Size()
			m.nanIndex = idx
		} else {
			idx = m.nanIndex
			found = true
		}
		return
	}

	p, ok := m.table[v]
	if ok {
		idx = p.memoIndex
	} else {
		idx = m.Size()
		p.value = v
		p.memoIndex = idx
		m.table[v] = p
		found = true
	}
	return
}

func (m *float64MemoTableImpl) CopyValues(out interface{}) {
	m.CopyValuesSubset(0, out)
}

func (m *float64MemoTableImpl) CopyValuesSubset(start int, out interface{}) {
	outval := out.([]float64)
	for _, v := range m.table {
		idx := v.memoIndex - start
		if idx >= 0 {
			outval[idx] = v.value
		}
	}
	if m.nanIndex != keyNotFound {
		outval[m.nanIndex] = math.NaN()
	}
}

func (m *float64MemoTableImpl) WriteOut(out []byte) {
	m.CopyValuesSubset(0, arrow.Float64Traits.CastFromBytes(out))
}

func (m *float64MemoTableImpl) WriteOutSubset(start int, out []byte) {
	m.CopyValuesSubset(start, arrow.Float64Traits.CastFromBytes(out))
}
