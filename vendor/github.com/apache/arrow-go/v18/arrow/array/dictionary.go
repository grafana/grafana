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
	"bytes"
	"errors"
	"fmt"
	"math"
	"math/bits"
	"unsafe"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/bitutil"
	"github.com/apache/arrow-go/v18/arrow/decimal"
	"github.com/apache/arrow-go/v18/arrow/float16"
	"github.com/apache/arrow-go/v18/arrow/internal/debug"
	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/internal/hashing"
	"github.com/apache/arrow-go/v18/internal/json"
	"github.com/apache/arrow-go/v18/internal/utils"
)

// Dictionary represents the type for dictionary-encoded data with a data
// dependent dictionary.
//
// A dictionary array contains an array of non-negative integers (the "dictionary"
// indices") along with a data type containing a "dictionary" corresponding to
// the distinct values represented in the data.
//
// For example, the array:
//
//	["foo", "bar", "foo", "bar", "foo", "bar"]
//
// with dictionary ["bar", "foo"], would have the representation of:
//
//	indices: [1, 0, 1, 0, 1, 0]
//	dictionary: ["bar", "foo"]
//
// The indices in principle may be any integer type.
type Dictionary struct {
	array

	indices arrow.Array
	dict    arrow.Array
}

// NewDictionaryArray constructs a dictionary array with the provided indices
// and dictionary using the given type.
func NewDictionaryArray(typ arrow.DataType, indices, dict arrow.Array) *Dictionary {
	a := &Dictionary{}
	a.refCount.Add(1)
	dictdata := NewData(typ, indices.Len(), indices.Data().Buffers(), indices.Data().Children(), indices.NullN(), indices.Data().Offset())
	dictdata.dictionary = dict.Data().(*Data)
	dict.Data().Retain()

	defer dictdata.Release()
	a.setData(dictdata)
	return a
}

// checkIndexBounds returns an error if any value in the provided integer
// arraydata is >= the passed upperlimit or < 0. otherwise nil
func checkIndexBounds(indices *Data, upperlimit uint64) error {
	if indices.length == 0 {
		return nil
	}

	var maxval uint64
	switch indices.dtype.ID() {
	case arrow.UINT8:
		maxval = math.MaxUint8
	case arrow.UINT16:
		maxval = math.MaxUint16
	case arrow.UINT32:
		maxval = math.MaxUint32
	case arrow.UINT64:
		maxval = math.MaxUint64
	}
	// for unsigned integers, if the values array is larger than the maximum
	// index value (especially for UINT8/UINT16), then there's no need to
	// boundscheck. for signed integers we still need to bounds check
	// because a value could be < 0.
	isSigned := maxval == 0
	if !isSigned && upperlimit > maxval {
		return nil
	}

	start := indices.offset
	end := indices.offset + indices.length

	// TODO(ARROW-15950): lift BitSetRunReader from parquet to utils
	// and use it here for performance improvement.

	switch indices.dtype.ID() {
	case arrow.INT8:
		data := arrow.Int8Traits.CastFromBytes(indices.buffers[1].Bytes())
		min, max := utils.GetMinMaxInt8(data[start:end])
		if min < 0 || max >= int8(upperlimit) {
			return fmt.Errorf("contains out of bounds index: min: %d, max: %d", min, max)
		}
	case arrow.UINT8:
		data := arrow.Uint8Traits.CastFromBytes(indices.buffers[1].Bytes())
		_, max := utils.GetMinMaxUint8(data[start:end])
		if max >= uint8(upperlimit) {
			return fmt.Errorf("contains out of bounds index: max: %d", max)
		}
	case arrow.INT16:
		data := arrow.Int16Traits.CastFromBytes(indices.buffers[1].Bytes())
		min, max := utils.GetMinMaxInt16(data[start:end])
		if min < 0 || max >= int16(upperlimit) {
			return fmt.Errorf("contains out of bounds index: min: %d, max: %d", min, max)
		}
	case arrow.UINT16:
		data := arrow.Uint16Traits.CastFromBytes(indices.buffers[1].Bytes())
		_, max := utils.GetMinMaxUint16(data[start:end])
		if max >= uint16(upperlimit) {
			return fmt.Errorf("contains out of bounds index: max: %d", max)
		}
	case arrow.INT32:
		data := arrow.Int32Traits.CastFromBytes(indices.buffers[1].Bytes())
		min, max := utils.GetMinMaxInt32(data[start:end])
		if min < 0 || max >= int32(upperlimit) {
			return fmt.Errorf("contains out of bounds index: min: %d, max: %d", min, max)
		}
	case arrow.UINT32:
		data := arrow.Uint32Traits.CastFromBytes(indices.buffers[1].Bytes())
		_, max := utils.GetMinMaxUint32(data[start:end])
		if max >= uint32(upperlimit) {
			return fmt.Errorf("contains out of bounds index: max: %d", max)
		}
	case arrow.INT64:
		data := arrow.Int64Traits.CastFromBytes(indices.buffers[1].Bytes())
		min, max := utils.GetMinMaxInt64(data[start:end])
		if min < 0 || max >= int64(upperlimit) {
			return fmt.Errorf("contains out of bounds index: min: %d, max: %d", min, max)
		}
	case arrow.UINT64:
		data := arrow.Uint64Traits.CastFromBytes(indices.buffers[1].Bytes())
		_, max := utils.GetMinMaxUint64(data[indices.offset : indices.offset+indices.length])
		if max >= upperlimit {
			return fmt.Errorf("contains out of bounds value: max: %d", max)
		}
	default:
		return fmt.Errorf("invalid type for bounds checking: %T", indices.dtype)
	}

	return nil
}

// NewValidatedDictionaryArray constructs a dictionary array from the provided indices
// and dictionary arrays, while also performing validation checks to ensure correctness
// such as bounds checking at are usually skipped for performance.
func NewValidatedDictionaryArray(typ *arrow.DictionaryType, indices, dict arrow.Array) (*Dictionary, error) {
	if indices.DataType().ID() != typ.IndexType.ID() {
		return nil, fmt.Errorf("dictionary type index (%T) does not match indices array type (%T)", typ.IndexType, indices.DataType())
	}

	if !arrow.TypeEqual(typ.ValueType, dict.DataType()) {
		return nil, fmt.Errorf("dictionary value type (%T) does not match dict array type (%T)", typ.ValueType, dict.DataType())
	}

	if err := checkIndexBounds(indices.Data().(*Data), uint64(dict.Len())); err != nil {
		return nil, err
	}

	return NewDictionaryArray(typ, indices, dict), nil
}

// NewDictionaryData creates a strongly typed Dictionary array from
// an ArrayData object with a datatype of arrow.Dictionary and a dictionary
func NewDictionaryData(data arrow.ArrayData) *Dictionary {
	a := &Dictionary{}
	a.refCount.Add(1)
	a.setData(data.(*Data))
	return a
}

func (d *Dictionary) Retain() {
	d.refCount.Add(1)
}

func (d *Dictionary) Release() {
	debug.Assert(d.refCount.Load() > 0, "too many releases")

	if d.refCount.Add(-1) == 0 {
		d.data.Release()
		d.data, d.nullBitmapBytes = nil, nil
		d.indices.Release()
		d.indices = nil
		if d.dict != nil {
			d.dict.Release()
			d.dict = nil
		}
	}
}

func (d *Dictionary) setData(data *Data) {
	d.array.setData(data)

	dictType := data.dtype.(*arrow.DictionaryType)
	if data.dictionary == nil {
		if data.length > 0 {
			panic("arrow/array: no dictionary set in Data for Dictionary array")
		}
	} else {
		debug.Assert(arrow.TypeEqual(dictType.ValueType, data.dictionary.DataType()), "mismatched dictionary value types")
	}

	indexData := NewData(dictType.IndexType, data.length, data.buffers, data.childData, data.nulls, data.offset)
	defer indexData.Release()
	d.indices = MakeFromData(indexData)
}

// Dictionary returns the values array that makes up the dictionary for this
// array.
func (d *Dictionary) Dictionary() arrow.Array {
	if d.dict == nil {
		d.dict = MakeFromData(d.data.dictionary)
	}
	return d.dict
}

// Indices returns the underlying array of indices as it's own array
func (d *Dictionary) Indices() arrow.Array {
	return d.indices
}

// CanCompareIndices returns true if the dictionary arrays can be compared
// without having to unify the dictionaries themselves first.
// This means that the index types are equal too.
func (d *Dictionary) CanCompareIndices(other *Dictionary) bool {
	if !arrow.TypeEqual(d.indices.DataType(), other.indices.DataType()) {
		return false
	}

	minlen := int64(min(d.data.dictionary.length, other.data.dictionary.length))
	return SliceEqual(d.Dictionary(), 0, minlen, other.Dictionary(), 0, minlen)
}

func (d *Dictionary) ValueStr(i int) string {
	if d.IsNull(i) {
		return NullValueStr
	}
	return d.Dictionary().ValueStr(d.GetValueIndex(i))
}

func (d *Dictionary) String() string {
	return fmt.Sprintf("{ dictionary: %v\n  indices: %v }", d.Dictionary(), d.Indices())
}

// GetValueIndex returns the dictionary index for the value at index i of the array.
// The actual value can be retrieved by using d.Dictionary().(valuetype).Value(d.GetValueIndex(i))
func (d *Dictionary) GetValueIndex(i int) int {
	indiceData := d.data.buffers[1].Bytes()
	// we know the value is non-negative per the spec, so
	// we can use the unsigned value regardless.
	switch d.indices.DataType().ID() {
	case arrow.UINT8, arrow.INT8:
		return int(uint8(indiceData[d.data.offset+i]))
	case arrow.UINT16, arrow.INT16:
		return int(arrow.Uint16Traits.CastFromBytes(indiceData)[d.data.offset+i])
	case arrow.UINT32, arrow.INT32:
		idx := arrow.Uint32Traits.CastFromBytes(indiceData)[d.data.offset+i]
		debug.Assert(bits.UintSize == 64 || idx <= math.MaxInt32, "arrow/dictionary: truncation of index value")
		return int(idx)
	case arrow.UINT64, arrow.INT64:
		idx := arrow.Uint64Traits.CastFromBytes(indiceData)[d.data.offset+i]
		debug.Assert((bits.UintSize == 32 && idx <= math.MaxInt32) || (bits.UintSize == 64 && idx <= math.MaxInt64), "arrow/dictionary: truncation of index value")
		return int(idx)
	}
	debug.Assert(false, "unreachable dictionary index")
	return -1
}

func (d *Dictionary) GetOneForMarshal(i int) interface{} {
	if d.IsNull(i) {
		return nil
	}
	vidx := d.GetValueIndex(i)
	return d.Dictionary().GetOneForMarshal(vidx)
}

func (d *Dictionary) MarshalJSON() ([]byte, error) {
	vals := make([]any, d.Len())
	for i := range d.Len() {
		vals[i] = d.GetOneForMarshal(i)
	}
	return json.Marshal(vals)
}

func arrayEqualDict(l, r *Dictionary) bool {
	return Equal(l.Dictionary(), r.Dictionary()) && Equal(l.indices, r.indices)
}

func arrayApproxEqualDict(l, r *Dictionary, opt equalOption) bool {
	return arrayApproxEqual(l.Dictionary(), r.Dictionary(), opt) && arrayApproxEqual(l.indices, r.indices, opt)
}

// helper for building the properly typed indices of the dictionary builder
type IndexBuilder struct {
	Builder
	Append func(int)
}

func createIndexBuilder(mem memory.Allocator, dt arrow.FixedWidthDataType) (ret IndexBuilder, err error) {
	ret = IndexBuilder{Builder: NewBuilder(mem, dt)}
	switch dt.ID() {
	case arrow.INT8:
		ret.Append = func(idx int) {
			ret.Builder.(*Int8Builder).Append(int8(idx))
		}
	case arrow.UINT8:
		ret.Append = func(idx int) {
			ret.Builder.(*Uint8Builder).Append(uint8(idx))
		}
	case arrow.INT16:
		ret.Append = func(idx int) {
			ret.Builder.(*Int16Builder).Append(int16(idx))
		}
	case arrow.UINT16:
		ret.Append = func(idx int) {
			ret.Builder.(*Uint16Builder).Append(uint16(idx))
		}
	case arrow.INT32:
		ret.Append = func(idx int) {
			ret.Builder.(*Int32Builder).Append(int32(idx))
		}
	case arrow.UINT32:
		ret.Append = func(idx int) {
			ret.Builder.(*Uint32Builder).Append(uint32(idx))
		}
	case arrow.INT64:
		ret.Append = func(idx int) {
			ret.Builder.(*Int64Builder).Append(int64(idx))
		}
	case arrow.UINT64:
		ret.Append = func(idx int) {
			ret.Builder.(*Uint64Builder).Append(uint64(idx))
		}
	default:
		debug.Assert(false, "dictionary index type must be integral")
		err = fmt.Errorf("dictionary index type must be integral, not %s", dt)
	}

	return
}

// helper function to construct an appropriately typed memo table based on
// the value type for the dictionary
func createMemoTable(mem memory.Allocator, dt arrow.DataType) (ret hashing.MemoTable, err error) {
	switch dt.ID() {
	case arrow.INT8:
		ret = hashing.NewMemoTable[int8](0)
	case arrow.UINT8:
		ret = hashing.NewMemoTable[uint8](0)
	case arrow.INT16:
		ret = hashing.NewMemoTable[int16](0)
	case arrow.UINT16:
		ret = hashing.NewMemoTable[uint16](0)
	case arrow.INT32:
		ret = hashing.NewMemoTable[int32](0)
	case arrow.UINT32:
		ret = hashing.NewMemoTable[uint32](0)
	case arrow.INT64:
		ret = hashing.NewMemoTable[int64](0)
	case arrow.UINT64:
		ret = hashing.NewMemoTable[uint64](0)
	case arrow.DURATION, arrow.TIMESTAMP, arrow.DATE64, arrow.TIME64:
		ret = hashing.NewMemoTable[int64](0)
	case arrow.TIME32, arrow.DATE32, arrow.INTERVAL_MONTHS:
		ret = hashing.NewMemoTable[int32](0)
	case arrow.FLOAT16:
		ret = hashing.NewMemoTable[uint16](0)
	case arrow.FLOAT32:
		ret = hashing.NewMemoTable[float32](0)
	case arrow.FLOAT64:
		ret = hashing.NewMemoTable[float64](0)
	case arrow.BINARY, arrow.FIXED_SIZE_BINARY, arrow.DECIMAL32, arrow.DECIMAL64,
		arrow.DECIMAL128, arrow.DECIMAL256, arrow.INTERVAL_DAY_TIME, arrow.INTERVAL_MONTH_DAY_NANO:
		ret = hashing.NewBinaryMemoTable(0, 0, NewBinaryBuilder(mem, arrow.BinaryTypes.Binary))
	case arrow.STRING:
		ret = hashing.NewBinaryMemoTable(0, 0, NewBinaryBuilder(mem, arrow.BinaryTypes.String))
	case arrow.NULL:
	default:
		err = fmt.Errorf("unimplemented dictionary value type, %s", dt)
	}

	return
}

type DictionaryBuilder interface {
	Builder

	NewDictionaryArray() *Dictionary
	NewDelta() (indices, delta arrow.Array, err error)
	AppendArray(arrow.Array) error
	AppendIndices([]int, []bool)
	ResetFull()
	DictionarySize() int
}

type dictionaryBuilder struct {
	builder

	dt          *arrow.DictionaryType
	deltaOffset int
	memoTable   hashing.MemoTable
	idxBuilder  IndexBuilder
}

func createDictBuilder[T arrow.ValueType](mem memory.Allocator, idxbldr IndexBuilder, memo hashing.MemoTable, dt *arrow.DictionaryType, init arrow.Array) DictionaryBuilder {
	ret := &dictBuilder[T]{
		dictionaryBuilder: dictionaryBuilder{
			builder:    builder{mem: mem},
			idxBuilder: idxbldr,
			memoTable:  memo,
			dt:         dt,
		},
	}
	ret.refCount.Add(1)

	if init != nil {
		if err := ret.InsertDictValues(init.(arrValues[T])); err != nil {
			panic(err)
		}
	}
	return ret
}

func createBinaryDictBuilder(mem memory.Allocator, idxbldr IndexBuilder, memo hashing.MemoTable, dt *arrow.DictionaryType, init arrow.Array) DictionaryBuilder {
	ret := &BinaryDictionaryBuilder{
		dictionaryBuilder: dictionaryBuilder{
			builder:    builder{mem: mem},
			idxBuilder: idxbldr,
			memoTable:  memo,
			dt:         dt,
		},
	}
	ret.refCount.Add(1)

	if init != nil {
		switch v := init.(type) {
		case *String:
			if err := ret.InsertStringDictValues(v); err != nil {
				panic(err)
			}
		case *Binary:
			if err := ret.InsertDictValues(v); err != nil {
				panic(err)
			}
		}
	}
	return ret
}

func createFixedSizeDictBuilder[T fsbType](mem memory.Allocator, idxbldr IndexBuilder, memo hashing.MemoTable, dt *arrow.DictionaryType, init arrow.Array) DictionaryBuilder {
	var z T
	ret := &fixedSizeDictionaryBuilder[T]{
		dictionaryBuilder: dictionaryBuilder{
			builder:    builder{mem: mem},
			idxBuilder: idxbldr,
			memoTable:  memo,
			dt:         dt,
		},
		byteWidth: int(unsafe.Sizeof(z)),
	}
	ret.refCount.Add(1)

	if init != nil {
		if err := ret.InsertDictValues(init.(arrValues[T])); err != nil {
			panic(err)
		}
	}

	return ret
}

// NewDictionaryBuilderWithDict initializes a dictionary builder and inserts the values from `init` as the first
// values in the dictionary, but does not insert them as values into the array.
func NewDictionaryBuilderWithDict(mem memory.Allocator, dt *arrow.DictionaryType, init arrow.Array) DictionaryBuilder {
	if init != nil && !arrow.TypeEqual(dt.ValueType, init.DataType()) {
		panic(fmt.Errorf("arrow/array: cannot initialize dictionary type %T with array of type %T", dt.ValueType, init.DataType()))
	}

	idxbldr, err := createIndexBuilder(mem, dt.IndexType.(arrow.FixedWidthDataType))
	if err != nil {
		panic(fmt.Errorf("arrow/array: unsupported builder for index type of %T", dt))
	}

	memo, err := createMemoTable(mem, dt.ValueType)
	if err != nil {
		panic(fmt.Errorf("arrow/array: unsupported builder for value type of %T", dt))
	}

	switch dt.ValueType.ID() {
	case arrow.NULL:
		ret := &NullDictionaryBuilder{
			dictionaryBuilder: dictionaryBuilder{
				builder:    builder{mem: mem},
				idxBuilder: idxbldr,
				memoTable:  memo,
				dt:         dt,
			},
		}
		ret.refCount.Add(1)
		debug.Assert(init == nil, "arrow/array: doesn't make sense to init a null dictionary")
		return ret
	case arrow.UINT8:
		return createDictBuilder[uint8](mem, idxbldr, memo, dt, init)
	case arrow.INT8:
		return createDictBuilder[int8](mem, idxbldr, memo, dt, init)
	case arrow.UINT16:
		return createDictBuilder[uint16](mem, idxbldr, memo, dt, init)
	case arrow.INT16:
		return createDictBuilder[int16](mem, idxbldr, memo, dt, init)
	case arrow.UINT32:
		return createDictBuilder[uint32](mem, idxbldr, memo, dt, init)
	case arrow.INT32:
		return createDictBuilder[int32](mem, idxbldr, memo, dt, init)
	case arrow.UINT64:
		return createDictBuilder[uint64](mem, idxbldr, memo, dt, init)
	case arrow.INT64:
		return createDictBuilder[int64](mem, idxbldr, memo, dt, init)
	case arrow.FLOAT16:
		return createDictBuilder[float16.Num](mem, idxbldr, memo, dt, init)
	case arrow.FLOAT32:
		return createDictBuilder[float32](mem, idxbldr, memo, dt, init)
	case arrow.FLOAT64:
		return createDictBuilder[float64](mem, idxbldr, memo, dt, init)
	case arrow.STRING, arrow.BINARY:
		return createBinaryDictBuilder(mem, idxbldr, memo, dt, init)
	case arrow.FIXED_SIZE_BINARY:
		ret := &FixedSizeBinaryDictionaryBuilder{
			dictionaryBuilder: dictionaryBuilder{
				builder:    builder{mem: mem},
				idxBuilder: idxbldr,
				memoTable:  memo,
				dt:         dt,
			},
			byteWidth: dt.ValueType.(*arrow.FixedSizeBinaryType).ByteWidth,
		}
		ret.refCount.Add(1)

		if init != nil {
			if err = ret.InsertDictValues(init.(*FixedSizeBinary)); err != nil {
				panic(err)
			}
		}
		return ret
	case arrow.DATE32:
		return createDictBuilder[arrow.Date32](mem, idxbldr, memo, dt, init)
	case arrow.DATE64:
		return createDictBuilder[arrow.Date64](mem, idxbldr, memo, dt, init)
	case arrow.TIMESTAMP:
		return createDictBuilder[arrow.Timestamp](mem, idxbldr, memo, dt, init)
	case arrow.TIME32:
		return createDictBuilder[arrow.Time32](mem, idxbldr, memo, dt, init)
	case arrow.TIME64:
		return createDictBuilder[arrow.Time64](mem, idxbldr, memo, dt, init)
	case arrow.INTERVAL_MONTHS:
		return createDictBuilder[arrow.MonthInterval](mem, idxbldr, memo, dt, init)
	case arrow.INTERVAL_DAY_TIME:
		return createFixedSizeDictBuilder[arrow.DayTimeInterval](mem, idxbldr, memo, dt, init)
	case arrow.DECIMAL32:
		return createFixedSizeDictBuilder[decimal.Decimal32](mem, idxbldr, memo, dt, init)
	case arrow.DECIMAL64:
		return createFixedSizeDictBuilder[decimal.Decimal64](mem, idxbldr, memo, dt, init)
	case arrow.DECIMAL128:
		return createFixedSizeDictBuilder[decimal.Decimal128](mem, idxbldr, memo, dt, init)
	case arrow.DECIMAL256:
		return createFixedSizeDictBuilder[decimal.Decimal256](mem, idxbldr, memo, dt, init)
	case arrow.LIST:
	case arrow.STRUCT:
	case arrow.SPARSE_UNION:
	case arrow.DENSE_UNION:
	case arrow.DICTIONARY:
	case arrow.MAP:
	case arrow.EXTENSION:
	case arrow.FIXED_SIZE_LIST:
	case arrow.DURATION:
		return createDictBuilder[arrow.Duration](mem, idxbldr, memo, dt, init)
	case arrow.LARGE_STRING:
	case arrow.LARGE_BINARY:
	case arrow.LARGE_LIST:
	case arrow.INTERVAL_MONTH_DAY_NANO:
		return createFixedSizeDictBuilder[arrow.MonthDayNanoInterval](mem, idxbldr, memo, dt, init)
	}

	panic("arrow/array: unimplemented dictionary key type")
}

func NewDictionaryBuilder(mem memory.Allocator, dt *arrow.DictionaryType) DictionaryBuilder {
	return NewDictionaryBuilderWithDict(mem, dt, nil)
}

func (b *dictionaryBuilder) Type() arrow.DataType { return b.dt }

func (b *dictionaryBuilder) Release() {
	debug.Assert(b.refCount.Load() > 0, "too many releases")

	if b.refCount.Add(-1) == 0 {
		b.idxBuilder.Release()
		b.idxBuilder.Builder = nil
		if binmemo, ok := b.memoTable.(*hashing.BinaryMemoTable); ok {
			binmemo.Release()
		}
		b.memoTable = nil
	}
}

func (b *dictionaryBuilder) AppendNull() {
	b.length += 1
	b.nulls += 1
	b.idxBuilder.AppendNull()
}

func (b *dictionaryBuilder) AppendNulls(n int) {
	for i := 0; i < n; i++ {
		b.AppendNull()
	}
}

func (b *dictionaryBuilder) AppendEmptyValue() {
	b.length += 1
	b.idxBuilder.AppendEmptyValue()
}

func (b *dictionaryBuilder) AppendEmptyValues(n int) {
	for i := 0; i < n; i++ {
		b.AppendEmptyValue()
	}
}

func (b *dictionaryBuilder) Reserve(n int) {
	b.idxBuilder.Reserve(n)
}

func (b *dictionaryBuilder) Resize(n int) {
	b.idxBuilder.Resize(n)
	b.length = b.idxBuilder.Len()
}

func (b *dictionaryBuilder) ResetFull() {
	b.reset()
	b.idxBuilder.NewArray().Release()
	b.memoTable.Reset()
}

func (b *dictionaryBuilder) Cap() int { return b.idxBuilder.Cap() }

func (b *dictionaryBuilder) IsNull(i int) bool { return b.idxBuilder.IsNull(i) }

func (b *dictionaryBuilder) UnmarshalJSON(data []byte) error {
	dec := json.NewDecoder(bytes.NewReader(data))
	t, err := dec.Token()
	if err != nil {
		return err
	}

	if delim, ok := t.(json.Delim); !ok || delim != '[' {
		return fmt.Errorf("dictionary builder must unpack from json array, found %s", delim)
	}

	return b.Unmarshal(dec)
}

func (b *dictionaryBuilder) Unmarshal(dec *json.Decoder) error {
	bldr := NewBuilder(b.mem, b.dt.ValueType)
	defer bldr.Release()

	if err := bldr.Unmarshal(dec); err != nil {
		return err
	}

	arr := bldr.NewArray()
	defer arr.Release()
	return b.AppendArray(arr)
}

func (b *dictionaryBuilder) AppendValueFromString(s string) error {
	bldr := NewBuilder(b.mem, b.dt.ValueType)
	defer bldr.Release()

	if err := bldr.AppendValueFromString(s); err != nil {
		return err
	}

	arr := bldr.NewArray()
	defer arr.Release()
	return b.AppendArray(arr)
}

func (b *dictionaryBuilder) UnmarshalOne(dec *json.Decoder) error {
	bldr := NewBuilder(b.mem, b.dt.ValueType)
	defer bldr.Release()

	if err := bldr.UnmarshalOne(dec); err != nil {
		return err
	}

	arr := bldr.NewArray()
	defer arr.Release()
	return b.AppendArray(arr)
}

func (b *dictionaryBuilder) NewArray() arrow.Array {
	return b.NewDictionaryArray()
}

func (b *dictionaryBuilder) newData() *Data {
	indices, dict, err := b.newWithDictOffset(0)
	if err != nil {
		panic(err)
	}

	indices.dtype = b.dt
	indices.dictionary = dict
	return indices
}

func (b *dictionaryBuilder) NewDictionaryArray() *Dictionary {
	a := &Dictionary{}
	a.refCount.Add(1)

	indices := b.newData()
	a.setData(indices)
	indices.Release()
	return a
}

func (b *dictionaryBuilder) newWithDictOffset(offset int) (indices, dict *Data, err error) {
	idxarr := b.idxBuilder.NewArray()
	defer idxarr.Release()

	indices = idxarr.Data().(*Data)

	b.deltaOffset = b.memoTable.Size()
	dict, err = GetDictArrayData(b.mem, b.dt.ValueType, b.memoTable, offset)
	b.reset()
	indices.Retain()
	return
}

// NewDelta returns the dictionary indices and a delta dictionary since the
// last time NewArray or NewDictionaryArray were called, and resets the state
// of the builder (except for the dictionary / memotable)
func (b *dictionaryBuilder) NewDelta() (indices, delta arrow.Array, err error) {
	indicesData, deltaData, err := b.newWithDictOffset(b.deltaOffset)
	if err != nil {
		return nil, nil, err
	}

	defer indicesData.Release()
	defer deltaData.Release()
	indices, delta = MakeFromData(indicesData), MakeFromData(deltaData)
	return
}

func (b *dictionaryBuilder) insertDictValue(val interface{}) error {
	_, _, err := b.memoTable.GetOrInsert(val)
	return err
}

func (b *dictionaryBuilder) insertDictBytes(val []byte) error {
	_, _, err := b.memoTable.GetOrInsertBytes(val)
	return err
}

func (b *dictionaryBuilder) appendValue(val interface{}) error {
	idx, _, err := b.memoTable.GetOrInsert(val)
	b.idxBuilder.Append(idx)
	b.length += 1
	return err
}

func (b *dictionaryBuilder) appendBytes(val []byte) error {
	idx, _, err := b.memoTable.GetOrInsertBytes(val)
	b.idxBuilder.Append(idx)
	b.length += 1
	return err
}

func getvalFn(arr arrow.Array) func(i int) interface{} {
	switch typedarr := arr.(type) {
	case *Int8:
		return func(i int) interface{} { return typedarr.Value(i) }
	case *Uint8:
		return func(i int) interface{} { return typedarr.Value(i) }
	case *Int16:
		return func(i int) interface{} { return typedarr.Value(i) }
	case *Uint16:
		return func(i int) interface{} { return typedarr.Value(i) }
	case *Int32:
		return func(i int) interface{} { return typedarr.Value(i) }
	case *Uint32:
		return func(i int) interface{} { return typedarr.Value(i) }
	case *Int64:
		return func(i int) interface{} { return typedarr.Value(i) }
	case *Uint64:
		return func(i int) interface{} { return typedarr.Value(i) }
	case *Float16:
		return func(i int) interface{} { return typedarr.Value(i).Uint16() }
	case *Float32:
		return func(i int) interface{} { return typedarr.Value(i) }
	case *Float64:
		return func(i int) interface{} { return typedarr.Value(i) }
	case *Duration:
		return func(i int) interface{} { return int64(typedarr.Value(i)) }
	case *Timestamp:
		return func(i int) interface{} { return int64(typedarr.Value(i)) }
	case *Date64:
		return func(i int) interface{} { return int64(typedarr.Value(i)) }
	case *Time64:
		return func(i int) interface{} { return int64(typedarr.Value(i)) }
	case *Time32:
		return func(i int) interface{} { return int32(typedarr.Value(i)) }
	case *Date32:
		return func(i int) interface{} { return int32(typedarr.Value(i)) }
	case *MonthInterval:
		return func(i int) interface{} { return int32(typedarr.Value(i)) }
	case *Binary:
		return func(i int) interface{} { return typedarr.Value(i) }
	case *FixedSizeBinary:
		return func(i int) interface{} { return typedarr.Value(i) }
	case *String:
		return func(i int) interface{} { return typedarr.Value(i) }
	case *Decimal32:
		return func(i int) interface{} {
			val := typedarr.Value(i)
			return (*(*[arrow.Decimal32SizeBytes]byte)(unsafe.Pointer(&val)))[:]
		}
	case *Decimal64:
		return func(i int) interface{} {
			val := typedarr.Value(i)
			return (*(*[arrow.Decimal64SizeBytes]byte)(unsafe.Pointer(&val)))[:]
		}
	case *Decimal128:
		return func(i int) interface{} {
			val := typedarr.Value(i)
			return (*(*[arrow.Decimal128SizeBytes]byte)(unsafe.Pointer(&val)))[:]
		}
	case *Decimal256:
		return func(i int) interface{} {
			val := typedarr.Value(i)
			return (*(*[arrow.Decimal256SizeBytes]byte)(unsafe.Pointer(&val)))[:]
		}
	case *DayTimeInterval:
		return func(i int) interface{} {
			val := typedarr.Value(i)
			return (*(*[arrow.DayTimeIntervalSizeBytes]byte)(unsafe.Pointer(&val)))[:]
		}
	case *MonthDayNanoInterval:
		return func(i int) interface{} {
			val := typedarr.Value(i)
			return (*(*[arrow.MonthDayNanoIntervalSizeBytes]byte)(unsafe.Pointer(&val)))[:]
		}
	}

	panic("arrow/array: invalid dictionary value type")
}

func (b *dictionaryBuilder) AppendArray(arr arrow.Array) error {
	debug.Assert(arrow.TypeEqual(b.dt.ValueType, arr.DataType()), "wrong value type of array to append to dict")

	valfn := getvalFn(arr)
	for i := 0; i < arr.Len(); i++ {
		if arr.IsNull(i) {
			b.AppendNull()
		} else {
			if err := b.appendValue(valfn(i)); err != nil {
				return err
			}
		}
	}
	return nil
}

func (b *dictionaryBuilder) IndexBuilder() IndexBuilder {
	return b.idxBuilder
}

func (b *dictionaryBuilder) AppendIndices(indices []int, valid []bool) {
	b.length += len(indices)
	switch idxbldr := b.idxBuilder.Builder.(type) {
	case *Int8Builder:
		vals := make([]int8, len(indices))
		for i, v := range indices {
			vals[i] = int8(v)
		}
		idxbldr.AppendValues(vals, valid)
	case *Int16Builder:
		vals := make([]int16, len(indices))
		for i, v := range indices {
			vals[i] = int16(v)
		}
		idxbldr.AppendValues(vals, valid)
	case *Int32Builder:
		vals := make([]int32, len(indices))
		for i, v := range indices {
			vals[i] = int32(v)
		}
		idxbldr.AppendValues(vals, valid)
	case *Int64Builder:
		vals := make([]int64, len(indices))
		for i, v := range indices {
			vals[i] = int64(v)
		}
		idxbldr.AppendValues(vals, valid)
	case *Uint8Builder:
		vals := make([]uint8, len(indices))
		for i, v := range indices {
			vals[i] = uint8(v)
		}
		idxbldr.AppendValues(vals, valid)
	case *Uint16Builder:
		vals := make([]uint16, len(indices))
		for i, v := range indices {
			vals[i] = uint16(v)
		}
		idxbldr.AppendValues(vals, valid)
	case *Uint32Builder:
		vals := make([]uint32, len(indices))
		for i, v := range indices {
			vals[i] = uint32(v)
		}
		idxbldr.AppendValues(vals, valid)
	case *Uint64Builder:
		vals := make([]uint64, len(indices))
		for i, v := range indices {
			vals[i] = uint64(v)
		}
		idxbldr.AppendValues(vals, valid)
	}
}

func (b *dictionaryBuilder) DictionarySize() int {
	return b.memoTable.Size()
}

type NullDictionaryBuilder struct {
	dictionaryBuilder
}

func (b *NullDictionaryBuilder) NewArray() arrow.Array {
	return b.NewDictionaryArray()
}

func (b *NullDictionaryBuilder) NewDictionaryArray() *Dictionary {
	idxarr := b.idxBuilder.NewArray()
	defer idxarr.Release()

	out := idxarr.Data().(*Data)
	dictarr := NewNull(0)
	defer dictarr.Release()

	dictarr.data.Retain()
	out.dtype = b.dt
	out.dictionary = dictarr.data

	return NewDictionaryData(out)
}

func (b *NullDictionaryBuilder) AppendArray(arr arrow.Array) error {
	if arr.DataType().ID() != arrow.NULL {
		return fmt.Errorf("cannot append non-null array to null dictionary")
	}

	for i := 0; i < arr.(*Null).Len(); i++ {
		b.AppendNull()
	}
	return nil
}

type dictBuilder[T arrow.ValueType] struct {
	dictionaryBuilder
}

func (b *dictBuilder[T]) Append(v T) error {
	switch val := any(v).(type) {
	case arrow.Duration:
		return b.appendValue(int64(val))
	case arrow.Timestamp:
		return b.appendValue(int64(val))
	case arrow.Time32:
		return b.appendValue(int32(val))
	case arrow.Time64:
		return b.appendValue(int64(val))
	case arrow.Date32:
		return b.appendValue(int32(val))
	case arrow.Date64:
		return b.appendValue(int64(val))
	case arrow.MonthInterval:
		return b.appendValue(int32(val))
	}
	return b.appendValue(v)
}

type arrValues[T arrow.ValueType] interface {
	Values() []T
}

func (b *dictBuilder[T]) InsertDictValues(arr arrValues[T]) (err error) {
	for _, v := range arr.Values() {
		if err = b.insertDictValue(v); err != nil {
			break
		}
	}
	return
}

type Int8DictionaryBuilder = dictBuilder[int8]
type Uint8DictionaryBuilder = dictBuilder[uint8]
type Int16DictionaryBuilder = dictBuilder[int16]
type Uint16DictionaryBuilder = dictBuilder[uint16]
type Int32DictionaryBuilder = dictBuilder[int32]
type Uint32DictionaryBuilder = dictBuilder[uint32]
type Int64DictionaryBuilder = dictBuilder[int64]
type Uint64DictionaryBuilder = dictBuilder[uint64]
type Float16DictionaryBuilder = dictBuilder[float16.Num]
type Float32DictionaryBuilder = dictBuilder[float32]
type Float64DictionaryBuilder = dictBuilder[float64]
type DurationDictionaryBuilder = dictBuilder[arrow.Duration]
type TimestampDictionaryBuilder = dictBuilder[arrow.Timestamp]
type Time32DictionaryBuilder = dictBuilder[arrow.Time32]
type Time64DictionaryBuilder = dictBuilder[arrow.Time64]
type Date32DictionaryBuilder = dictBuilder[arrow.Date32]
type Date64DictionaryBuilder = dictBuilder[arrow.Date64]
type MonthIntervalDictionaryBuilder = dictBuilder[arrow.MonthInterval]
type DayTimeDictionaryBuilder = fixedSizeDictionaryBuilder[arrow.DayTimeInterval]
type Decimal32DictionaryBuilder = fixedSizeDictionaryBuilder[decimal.Decimal32]
type Decimal64DictionaryBuilder = fixedSizeDictionaryBuilder[decimal.Decimal64]
type Decimal128DictionaryBuilder = fixedSizeDictionaryBuilder[decimal.Decimal128]
type Decimal256DictionaryBuilder = fixedSizeDictionaryBuilder[decimal.Decimal256]
type MonthDayNanoDictionaryBuilder = fixedSizeDictionaryBuilder[arrow.MonthDayNanoInterval]

type BinaryDictionaryBuilder struct {
	dictionaryBuilder
}

func (b *BinaryDictionaryBuilder) Append(v []byte) error {
	if v == nil {
		b.AppendNull()
		return nil
	}

	return b.appendBytes(v)
}

func (b *BinaryDictionaryBuilder) AppendString(v string) error { return b.appendBytes([]byte(v)) }
func (b *BinaryDictionaryBuilder) InsertDictValues(arr *Binary) (err error) {
	if !arrow.TypeEqual(arr.DataType(), b.dt.ValueType) {
		return fmt.Errorf("dictionary insert type mismatch: cannot insert values of type %T to dictionary type %T", arr.DataType(), b.dt.ValueType)
	}

	for i := 0; i < arr.Len(); i++ {
		if err = b.insertDictBytes(arr.Value(i)); err != nil {
			break
		}
	}
	return
}

func (b *BinaryDictionaryBuilder) InsertStringDictValues(arr *String) (err error) {
	if !arrow.TypeEqual(arr.DataType(), b.dt.ValueType) {
		return fmt.Errorf("dictionary insert type mismatch: cannot insert values of type %T to dictionary type %T", arr.DataType(), b.dt.ValueType)
	}

	for i := 0; i < arr.Len(); i++ {
		if err = b.insertDictValue(arr.Value(i)); err != nil {
			break
		}
	}
	return
}

func (b *BinaryDictionaryBuilder) GetValueIndex(i int) int {
	switch b := b.idxBuilder.Builder.(type) {
	case *Uint8Builder:
		return int(b.Value(i))
	case *Int8Builder:
		return int(b.Value(i))
	case *Uint16Builder:
		return int(b.Value(i))
	case *Int16Builder:
		return int(b.Value(i))
	case *Uint32Builder:
		return int(b.Value(i))
	case *Int32Builder:
		return int(b.Value(i))
	case *Uint64Builder:
		return int(b.Value(i))
	case *Int64Builder:
		return int(b.Value(i))
	default:
		return -1
	}
}

func (b *BinaryDictionaryBuilder) Value(i int) []byte {
	switch mt := b.memoTable.(type) {
	case *hashing.BinaryMemoTable:
		return mt.Value(i)
	}
	return nil
}

func (b *BinaryDictionaryBuilder) ValueStr(i int) string {
	return string(b.Value(i))
}

type fsbType interface {
	arrow.DayTimeInterval | arrow.MonthDayNanoInterval |
		decimal.Decimal32 | decimal.Decimal64 | decimal.Decimal128 | decimal.Decimal256
}

type fixedSizeDictionaryBuilder[T fsbType] struct {
	dictionaryBuilder
	byteWidth int
}

func (b *fixedSizeDictionaryBuilder[T]) Append(v T) error {
	if v, ok := any(v).([]byte); ok {
		return b.appendBytes(v[:b.byteWidth])
	}

	sliceHdr := struct {
		Addr *T
		Len  int
		Cap  int
	}{&v, b.byteWidth, b.byteWidth}
	slice := *(*[]byte)(unsafe.Pointer(&sliceHdr))
	return b.appendValue(slice)
}

func (b *fixedSizeDictionaryBuilder[T]) InsertDictValues(arr arrValues[T]) (err error) {
	data := arrow.GetBytes(arr.Values())
	for len(data) > 0 {
		if err = b.insertDictBytes(data[:b.byteWidth]); err != nil {
			break
		}
		data = data[b.byteWidth:]
	}
	return
}

type FixedSizeBinaryDictionaryBuilder struct {
	dictionaryBuilder
	byteWidth int
}

func (b *FixedSizeBinaryDictionaryBuilder) Append(v []byte) error {
	return b.appendValue(v[:b.byteWidth])
}

func (b *FixedSizeBinaryDictionaryBuilder) InsertDictValues(arr *FixedSizeBinary) (err error) {
	var (
		beg = arr.data.offset * b.byteWidth
		end = (arr.data.offset + arr.data.length) * b.byteWidth
	)
	data := arr.valueBytes[beg:end]
	for len(data) > 0 {
		if err = b.insertDictValue(data[:b.byteWidth]); err != nil {
			break
		}
		data = data[b.byteWidth:]
	}
	return
}

func IsTrivialTransposition(transposeMap []int32) bool {
	for i, t := range transposeMap {
		if t != int32(i) {
			return false
		}
	}
	return true
}

func TransposeDictIndices(mem memory.Allocator, data arrow.ArrayData, inType, outType arrow.DataType, dict arrow.ArrayData, transposeMap []int32) (arrow.ArrayData, error) {
	// inType may be different from data->dtype if data is ExtensionType
	if inType.ID() != arrow.DICTIONARY || outType.ID() != arrow.DICTIONARY {
		return nil, errors.New("arrow/array: expected dictionary type")
	}

	var (
		inDictType   = inType.(*arrow.DictionaryType)
		outDictType  = outType.(*arrow.DictionaryType)
		inIndexType  = inDictType.IndexType
		outIndexType = outDictType.IndexType.(arrow.FixedWidthDataType)
	)

	if inIndexType.ID() == outIndexType.ID() && IsTrivialTransposition(transposeMap) {
		// index type and values will be identical, we can reuse the existing buffers
		return NewDataWithDictionary(outType, data.Len(), []*memory.Buffer{data.Buffers()[0], data.Buffers()[1]},
			data.NullN(), data.Offset(), dict.(*Data)), nil
	}

	// default path: compute the transposed indices as a new buffer
	outBuf := memory.NewResizableBuffer(mem)
	outBuf.Resize(data.Len() * int(bitutil.BytesForBits(int64(outIndexType.BitWidth()))))
	defer outBuf.Release()

	// shift null buffer if original offset is non-zero
	var nullBitmap *memory.Buffer
	if data.Offset() != 0 && data.NullN() != 0 {
		nullBitmap = memory.NewResizableBuffer(mem)
		nullBitmap.Resize(int(bitutil.BytesForBits(int64(data.Len()))))
		bitutil.CopyBitmap(data.Buffers()[0].Bytes(), data.Offset(), data.Len(), nullBitmap.Bytes(), 0)
		defer nullBitmap.Release()
	} else {
		nullBitmap = data.Buffers()[0]
	}

	outData := NewDataWithDictionary(outType, data.Len(),
		[]*memory.Buffer{nullBitmap, outBuf}, data.NullN(), 0, dict.(*Data))
	err := utils.TransposeIntsBuffers(inIndexType, outIndexType,
		data.Buffers()[1].Bytes(), outBuf.Bytes(), data.Offset(), outData.offset, data.Len(), transposeMap)
	return outData, err
}

// DictionaryUnifier defines the interface used for unifying, and optionally producing
// transposition maps for, multiple dictionary arrays incrementally.
type DictionaryUnifier interface {
	// Unify adds the provided array of dictionary values to be unified.
	Unify(arrow.Array) error
	// UnifyAndTranspose adds the provided array of dictionary values,
	// just like Unify but returns an allocated buffer containing a mapping
	// to transpose dictionary indices.
	UnifyAndTranspose(dict arrow.Array) (transposed *memory.Buffer, err error)
	// GetResult returns the dictionary type (choosing the smallest index type
	// that can represent all the values) and the new unified dictionary.
	//
	// Calling GetResult clears the existing dictionary from the unifier so it
	// can be reused by calling Unify/UnifyAndTranspose again with new arrays.
	GetResult() (outType arrow.DataType, outDict arrow.Array, err error)
	// GetResultWithIndexType is like GetResult, but allows specifying the type
	// of the dictionary indexes rather than letting the unifier pick. If the
	// passed in index type isn't large enough to represent all of the dictionary
	// values, an error will be returned instead. The new unified dictionary
	// is returned.
	GetResultWithIndexType(indexType arrow.DataType) (arrow.Array, error)
	// Release should be called to clean up any allocated scratch memo-table used
	// for building the unified dictionary.
	Release()
}

type unifier struct {
	mem       memory.Allocator
	valueType arrow.DataType
	memoTable hashing.MemoTable
}

// NewDictionaryUnifier constructs and returns a new dictionary unifier for dictionaries
// of valueType, using the provided allocator for allocating the unified dictionary
// and the memotable used for building it.
//
// This will only work for non-nested types currently. a nested valueType or dictionary type
// will result in an error.
func NewDictionaryUnifier(alloc memory.Allocator, valueType arrow.DataType) (DictionaryUnifier, error) {
	memoTable, err := createMemoTable(alloc, valueType)
	if err != nil {
		return nil, err
	}
	return &unifier{
		mem:       alloc,
		valueType: valueType,
		memoTable: memoTable,
	}, nil
}

func (u *unifier) Release() {
	if bin, ok := u.memoTable.(*hashing.BinaryMemoTable); ok {
		bin.Release()
	}
}

func (u *unifier) Unify(dict arrow.Array) (err error) {
	if !arrow.TypeEqual(u.valueType, dict.DataType()) {
		return fmt.Errorf("dictionary type different from unifier: %s, expected: %s", dict.DataType(), u.valueType)
	}

	valFn := getvalFn(dict)
	for i := 0; i < dict.Len(); i++ {
		if dict.IsNull(i) {
			u.memoTable.GetOrInsertNull()
			continue
		}

		if _, _, err = u.memoTable.GetOrInsert(valFn(i)); err != nil {
			return err
		}
	}
	return
}

func (u *unifier) UnifyAndTranspose(dict arrow.Array) (transposed *memory.Buffer, err error) {
	if !arrow.TypeEqual(u.valueType, dict.DataType()) {
		return nil, fmt.Errorf("dictionary type different from unifier: %s, expected: %s", dict.DataType(), u.valueType)
	}

	transposed = memory.NewResizableBuffer(u.mem)
	transposed.Resize(arrow.Int32Traits.BytesRequired(dict.Len()))

	newIdxes := arrow.Int32Traits.CastFromBytes(transposed.Bytes())
	valFn := getvalFn(dict)
	for i := 0; i < dict.Len(); i++ {
		if dict.IsNull(i) {
			idx, _ := u.memoTable.GetOrInsertNull()
			newIdxes[i] = int32(idx)
			continue
		}

		idx, _, err := u.memoTable.GetOrInsert(valFn(i))
		if err != nil {
			transposed.Release()
			return nil, err
		}
		newIdxes[i] = int32(idx)
	}
	return
}

func (u *unifier) GetResult() (outType arrow.DataType, outDict arrow.Array, err error) {
	dictLen := u.memoTable.Size()
	var indexType arrow.DataType
	switch {
	case dictLen <= math.MaxInt8:
		indexType = arrow.PrimitiveTypes.Int8
	case dictLen <= math.MaxInt16:
		indexType = arrow.PrimitiveTypes.Int16
	case dictLen <= math.MaxInt32:
		indexType = arrow.PrimitiveTypes.Int32
	default:
		indexType = arrow.PrimitiveTypes.Int64
	}
	outType = &arrow.DictionaryType{IndexType: indexType, ValueType: u.valueType}

	dictData, err := GetDictArrayData(u.mem, u.valueType, u.memoTable, 0)
	if err != nil {
		return nil, nil, err
	}

	u.memoTable.Reset()

	defer dictData.Release()
	outDict = MakeFromData(dictData)
	return
}

func (u *unifier) GetResultWithIndexType(indexType arrow.DataType) (arrow.Array, error) {
	dictLen := u.memoTable.Size()
	var toobig bool
	switch indexType.ID() {
	case arrow.UINT8:
		toobig = dictLen > math.MaxUint8
	case arrow.INT8:
		toobig = dictLen > math.MaxInt8
	case arrow.UINT16:
		toobig = dictLen > math.MaxUint16
	case arrow.INT16:
		toobig = dictLen > math.MaxInt16
	case arrow.UINT32:
		toobig = uint(dictLen) > math.MaxUint32
	case arrow.INT32:
		toobig = dictLen > math.MaxInt32
	case arrow.UINT64:
		toobig = uint64(dictLen) > uint64(math.MaxUint64)
	case arrow.INT64:
	default:
		return nil, fmt.Errorf("arrow/array: invalid dictionary index type: %s, must be integral", indexType)
	}
	if toobig {
		return nil, errors.New("arrow/array: cannot combine dictionaries. unified dictionary requires a larger index type")
	}

	dictData, err := GetDictArrayData(u.mem, u.valueType, u.memoTable, 0)
	if err != nil {
		return nil, err
	}

	u.memoTable.Reset()

	defer dictData.Release()
	return MakeFromData(dictData), nil
}

type binaryUnifier struct {
	mem       memory.Allocator
	memoTable *hashing.BinaryMemoTable
}

// NewBinaryDictionaryUnifier constructs and returns a new dictionary unifier for dictionaries
// of binary values, using the provided allocator for allocating the unified dictionary
// and the memotable used for building it.
func NewBinaryDictionaryUnifier(alloc memory.Allocator) DictionaryUnifier {
	return &binaryUnifier{
		mem:       alloc,
		memoTable: hashing.NewBinaryMemoTable(0, 0, NewBinaryBuilder(alloc, arrow.BinaryTypes.Binary)),
	}
}

func (u *binaryUnifier) Release() {
	u.memoTable.Release()
}

func (u *binaryUnifier) Unify(dict arrow.Array) (err error) {
	if !arrow.TypeEqual(arrow.BinaryTypes.Binary, dict.DataType()) {
		return fmt.Errorf("dictionary type different from unifier: %s, expected: %s", dict.DataType(), arrow.BinaryTypes.Binary)
	}

	typedDict := dict.(*Binary)
	for i := 0; i < dict.Len(); i++ {
		if dict.IsNull(i) {
			u.memoTable.GetOrInsertNull()
			continue
		}

		if _, _, err = u.memoTable.GetOrInsertBytes(typedDict.Value(i)); err != nil {
			return err
		}
	}
	return
}

func (u *binaryUnifier) UnifyAndTranspose(dict arrow.Array) (transposed *memory.Buffer, err error) {
	if !arrow.TypeEqual(arrow.BinaryTypes.Binary, dict.DataType()) {
		return nil, fmt.Errorf("dictionary type different from unifier: %s, expected: %s", dict.DataType(), arrow.BinaryTypes.Binary)
	}

	transposed = memory.NewResizableBuffer(u.mem)
	transposed.Resize(arrow.Int32Traits.BytesRequired(dict.Len()))

	newIdxes := arrow.Int32Traits.CastFromBytes(transposed.Bytes())
	typedDict := dict.(*Binary)
	for i := 0; i < dict.Len(); i++ {
		if dict.IsNull(i) {
			idx, _ := u.memoTable.GetOrInsertNull()
			newIdxes[i] = int32(idx)
			continue
		}

		idx, _, err := u.memoTable.GetOrInsertBytes(typedDict.Value(i))
		if err != nil {
			transposed.Release()
			return nil, err
		}
		newIdxes[i] = int32(idx)
	}
	return
}

func (u *binaryUnifier) GetResult() (outType arrow.DataType, outDict arrow.Array, err error) {
	dictLen := u.memoTable.Size()
	var indexType arrow.DataType
	switch {
	case dictLen <= math.MaxInt8:
		indexType = arrow.PrimitiveTypes.Int8
	case dictLen <= math.MaxInt16:
		indexType = arrow.PrimitiveTypes.Int16
	case dictLen <= math.MaxInt32:
		indexType = arrow.PrimitiveTypes.Int32
	default:
		indexType = arrow.PrimitiveTypes.Int64
	}
	outType = &arrow.DictionaryType{IndexType: indexType, ValueType: arrow.BinaryTypes.Binary}

	dictData, err := GetDictArrayData(u.mem, arrow.BinaryTypes.Binary, u.memoTable, 0)
	if err != nil {
		return nil, nil, err
	}

	u.memoTable.Reset()

	defer dictData.Release()
	outDict = MakeFromData(dictData)
	return
}

func (u *binaryUnifier) GetResultWithIndexType(indexType arrow.DataType) (arrow.Array, error) {
	dictLen := u.memoTable.Size()
	var toobig bool
	switch indexType.ID() {
	case arrow.UINT8:
		toobig = dictLen > math.MaxUint8
	case arrow.INT8:
		toobig = dictLen > math.MaxInt8
	case arrow.UINT16:
		toobig = dictLen > math.MaxUint16
	case arrow.INT16:
		toobig = dictLen > math.MaxInt16
	case arrow.UINT32:
		toobig = uint(dictLen) > math.MaxUint32
	case arrow.INT32:
		toobig = dictLen > math.MaxInt32
	case arrow.UINT64:
		toobig = uint64(dictLen) > uint64(math.MaxUint64)
	case arrow.INT64:
	default:
		return nil, fmt.Errorf("arrow/array: invalid dictionary index type: %s, must be integral", indexType)
	}
	if toobig {
		return nil, errors.New("arrow/array: cannot combine dictionaries. unified dictionary requires a larger index type")
	}

	dictData, err := GetDictArrayData(u.mem, arrow.BinaryTypes.Binary, u.memoTable, 0)
	if err != nil {
		return nil, err
	}

	u.memoTable.Reset()

	defer dictData.Release()
	return MakeFromData(dictData), nil
}

func unifyRecursive(mem memory.Allocator, typ arrow.DataType, chunks []*Data) (changed bool, err error) {
	debug.Assert(len(chunks) != 0, "must provide non-zero length chunk slice")
	var extType arrow.DataType

	if typ.ID() == arrow.EXTENSION {
		extType = typ
		typ = typ.(arrow.ExtensionType).StorageType()
	}

	if nestedTyp, ok := typ.(arrow.NestedType); ok {
		children := make([]*Data, len(chunks))
		for i, f := range nestedTyp.Fields() {
			for j, c := range chunks {
				children[j] = c.childData[i].(*Data)
			}

			childChanged, err := unifyRecursive(mem, f.Type, children)
			if err != nil {
				return false, err
			}
			if childChanged {
				// only when unification actually occurs
				for j := range chunks {
					chunks[j].childData[i] = children[j]
				}
				changed = true
			}
		}
	}

	if typ.ID() == arrow.DICTIONARY {
		dictType := typ.(*arrow.DictionaryType)
		var (
			uni     DictionaryUnifier
			newDict arrow.Array
		)
		// unify any nested dictionaries first, but the unifier doesn't support
		// nested dictionaries yet so this would fail.
		uni, err = NewDictionaryUnifier(mem, dictType.ValueType)
		if err != nil {
			return changed, err
		}
		defer uni.Release()
		transposeMaps := make([]*memory.Buffer, len(chunks))
		for i, c := range chunks {
			debug.Assert(c.dictionary != nil, "missing dictionary data for dictionary array")
			arr := MakeFromData(c.dictionary)
			defer arr.Release()
			if transposeMaps[i], err = uni.UnifyAndTranspose(arr); err != nil {
				return
			}
			defer transposeMaps[i].Release()
		}

		if newDict, err = uni.GetResultWithIndexType(dictType.IndexType); err != nil {
			return
		}
		defer newDict.Release()

		for j := range chunks {
			chnk, err := TransposeDictIndices(mem, chunks[j], typ, typ, newDict.Data(), arrow.Int32Traits.CastFromBytes(transposeMaps[j].Bytes()))
			if err != nil {
				return changed, err
			}
			chunks[j].Release()
			chunks[j] = chnk.(*Data)
			if extType != nil {
				chunks[j].dtype = extType
			}
		}
		changed = true
	}

	return
}

// UnifyChunkedDicts takes a chunked array of dictionary type and will unify
// the dictionary across all of the chunks with the returned chunked array
// having all chunks share the same dictionary.
//
// The return from this *must* have Release called on it unless an error is returned
// in which case the *arrow.Chunked will be nil.
//
// If there is 1 or fewer chunks, then nothing is modified and this function will just
// call Retain on the passed in Chunked array (so Release can safely be called on it).
// The same is true if the type of the array is not a dictionary or if no changes are
// needed for all of the chunks to be using the same dictionary.
func UnifyChunkedDicts(alloc memory.Allocator, chnkd *arrow.Chunked) (*arrow.Chunked, error) {
	if len(chnkd.Chunks()) <= 1 {
		chnkd.Retain()
		return chnkd, nil
	}

	chunksData := make([]*Data, len(chnkd.Chunks()))
	for i, c := range chnkd.Chunks() {
		c.Data().Retain()
		chunksData[i] = c.Data().(*Data)
	}
	changed, err := unifyRecursive(alloc, chnkd.DataType(), chunksData)
	if err != nil || !changed {
		for _, c := range chunksData {
			c.Release()
		}
		if err == nil {
			chnkd.Retain()
		} else {
			chnkd = nil
		}
		return chnkd, err
	}

	chunks := make([]arrow.Array, len(chunksData))
	for i, c := range chunksData {
		chunks[i] = MakeFromData(c)
		defer chunks[i].Release()
		c.Release()
	}

	return arrow.NewChunked(chnkd.DataType(), chunks), nil
}

// UnifyTableDicts performs UnifyChunkedDicts on each column of the table so that
// any dictionary column will have the dictionaries of its chunks unified.
//
// The returned Table should always be Release'd unless a non-nil error was returned,
// in which case the table returned will be nil.
func UnifyTableDicts(alloc memory.Allocator, table arrow.Table) (arrow.Table, error) {
	cols := make([]arrow.Column, table.NumCols())
	for i := 0; i < int(table.NumCols()); i++ {
		chnkd, err := UnifyChunkedDicts(alloc, table.Column(i).Data())
		if err != nil {
			return nil, err
		}
		defer chnkd.Release()
		cols[i] = *arrow.NewColumn(table.Schema().Field(i), chnkd)
		defer cols[i].Release()
	}
	return NewTable(table.Schema(), cols, table.NumRows()), nil
}

type dictWrapper[T arrow.ValueType] struct {
	*Dictionary

	typedDict arrow.TypedArray[T]
}

// NewDictWrapper creates a simple wrapper around a Dictionary array that provides
// a Value method which will use the underlying dictionary to return the value
// at the given index. This simplifies the interaction of a dictionary array to
// provide a typed interface as if it were a non-dictionary array.
func NewDictWrapper[T arrow.ValueType](dict *Dictionary) (arrow.TypedArray[T], error) {
	typed, ok := dict.Dictionary().(arrow.TypedArray[T])
	if !ok {
		return nil, fmt.Errorf("arrow/array: dictionary type %s is not a typed array of %T", dict.Dictionary().DataType(), (*T)(nil))
	}

	return &dictWrapper[T]{
		Dictionary: dict,
		typedDict:  typed,
	}, nil
}

func (dw *dictWrapper[T]) Value(i int) T {
	return dw.typedDict.Value(dw.GetValueIndex(i))
}

var (
	_ arrow.Array = (*Dictionary)(nil)
	_ Builder     = (*dictionaryBuilder)(nil)
)
