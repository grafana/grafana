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
	"reflect"
	"strings"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/bitutil"
	"github.com/apache/arrow-go/v18/arrow/internal/debug"
	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/internal/bitutils"
	"github.com/apache/arrow-go/v18/internal/json"
)

// Union is a convenience interface to encompass both Sparse and Dense
// union array types.
type Union interface {
	arrow.Array
	// NumFields returns the number of child fields in this union.
	// Equivalent to len(UnionType().Fields())
	NumFields() int
	// Validate returns an error if there are any issues with the lengths
	// or types of the children arrays mismatching with the Type of the
	// Union Array. nil is returned if there are no problems.
	Validate() error
	// ValidateFull runs the same checks that Validate() does, but additionally
	// checks that all childIDs are valid (>= 0 || ==InvalidID) and for
	// dense unions validates that all offsets are within the bounds of their
	// respective child.
	ValidateFull() error
	// TypeCodes returns the type id buffer for the union Array, equivalent to
	// Data().Buffers()[1]. Note: This will not account for any slice offset.
	TypeCodes() *memory.Buffer
	// RawTypeCodes returns a slice of UnionTypeCodes properly accounting for
	// any slice offset.
	RawTypeCodes() []arrow.UnionTypeCode
	// TypeCode returns the logical type code of the value at the requested index
	TypeCode(i int) arrow.UnionTypeCode
	// ChildID returns the index of the physical child containing the value
	// at the requested index. Equivalent to:
	//
	// 	arr.UnionType().ChildIDs()[arr.RawTypeCodes()[i+arr.Data().Offset()]]
	ChildID(i int) int
	// UnionType is a convenience function to retrieve the properly typed UnionType
	// instead of having to call DataType() and manually assert the type.
	UnionType() arrow.UnionType
	// Mode returns the union mode of the underlying Array, either arrow.SparseMode
	// or arrow.DenseMode.
	Mode() arrow.UnionMode
	// Field returns the requested child array for this union. Returns nil if a
	// nonexistent position is passed in.
	//
	// The appropriate child for an index can be retrieved with Field(ChildID(index))
	Field(pos int) arrow.Array
}

const kMaxElems = math.MaxInt32

type union struct {
	array

	unionType arrow.UnionType
	typecodes []arrow.UnionTypeCode

	children []arrow.Array
}

func (a *union) Retain() {
	a.array.Retain()
	for _, c := range a.children {
		c.Retain()
	}
}

func (a *union) Release() {
	a.array.Release()
	for _, c := range a.children {
		c.Release()
	}
}

func (a *union) NumFields() int { return len(a.unionType.Fields()) }

func (a *union) Mode() arrow.UnionMode { return a.unionType.Mode() }

func (a *union) UnionType() arrow.UnionType { return a.unionType }

func (a *union) TypeCodes() *memory.Buffer {
	return a.data.buffers[1]
}

func (a *union) RawTypeCodes() []arrow.UnionTypeCode {
	if a.data.length > 0 {
		return a.typecodes[a.data.offset:]
	}
	return []arrow.UnionTypeCode{}
}

func (a *union) TypeCode(i int) arrow.UnionTypeCode {
	return a.typecodes[i+a.data.offset]
}

func (a *union) ChildID(i int) int {
	return a.unionType.ChildIDs()[a.typecodes[i+a.data.offset]]
}

func (a *union) setData(data *Data) {
	a.unionType = data.dtype.(arrow.UnionType)
	debug.Assert(len(data.buffers) >= 2, "arrow/array: invalid number of union array buffers")

	if data.length > 0 {
		a.typecodes = arrow.Int8Traits.CastFromBytes(data.buffers[1].Bytes())
	} else {
		a.typecodes = []int8{}
	}
	a.children = make([]arrow.Array, len(data.childData))
	for i, child := range data.childData {
		if a.unionType.Mode() == arrow.SparseMode && (data.offset != 0 || child.Len() != data.length) {
			child = NewSliceData(child, int64(data.offset), int64(data.offset+data.length))
			defer child.Release()
		}
		a.children[i] = MakeFromData(child)
	}
	a.array.setData(data)
}

func (a *union) Field(pos int) (result arrow.Array) {
	if pos < 0 || pos >= len(a.children) {
		return nil
	}

	return a.children[pos]
}

func (a *union) Validate() error {
	fields := a.unionType.Fields()
	for i, f := range fields {
		fieldData := a.data.childData[i]
		if a.unionType.Mode() == arrow.SparseMode && fieldData.Len() < a.data.length+a.data.offset {
			return fmt.Errorf("arrow/array: sparse union child array #%d has length smaller than expected for union array (%d < %d)",
				i, fieldData.Len(), a.data.length+a.data.offset)
		}

		if !arrow.TypeEqual(f.Type, fieldData.DataType()) {
			return fmt.Errorf("arrow/array: union child array #%d does not match type field %s vs %s",
				i, fieldData.DataType(), f.Type)
		}
	}
	return nil
}

func (a *union) ValidateFull() error {
	if err := a.Validate(); err != nil {
		return err
	}

	childIDs := a.unionType.ChildIDs()
	codesMap := a.unionType.TypeCodes()
	codes := a.RawTypeCodes()

	for i := 0; i < a.data.length; i++ {
		code := codes[i]
		if code < 0 || childIDs[code] == arrow.InvalidUnionChildID {
			return fmt.Errorf("arrow/array: union value at position %d has invalid type id %d", i, code)
		}
	}

	if a.unionType.Mode() == arrow.DenseMode {
		// validate offsets

		// map logical typeid to child length
		var childLengths [256]int64
		for i := range a.unionType.Fields() {
			childLengths[codesMap[i]] = int64(a.data.childData[i].Len())
		}

		// check offsets are in bounds
		var lastOffsets [256]int64
		offsets := arrow.Int32Traits.CastFromBytes(a.data.buffers[2].Bytes())[a.data.offset:]
		for i := int64(0); i < int64(a.data.length); i++ {
			code := codes[i]
			offset := offsets[i]
			switch {
			case offset < 0:
				return fmt.Errorf("arrow/array: union value at position %d has negative offset %d", i, offset)
			case offset >= int32(childLengths[code]):
				return fmt.Errorf("arrow/array: union value at position %d has offset larger than child length (%d >= %d)",
					i, offset, childLengths[code])
			case offset < int32(lastOffsets[code]):
				return fmt.Errorf("arrow/array: union value at position %d has non-monotonic offset %d", i, offset)
			}
			lastOffsets[code] = int64(offset)
		}
	}

	return nil
}

// SparseUnion represents an array where each logical value is taken from
// a single child. A buffer of 8-bit type ids indicates which child a given
// logical value is to be taken from. This is represented as the ChildID,
// which is the index into the list of children.
//
// In a sparse union, each child array will have the same length as the
// union array itself, regardless of how many values in the union actually
// refer to it.
//
// Unlike most other arrays, unions do not have a top-level validity bitmap.
type SparseUnion struct {
	union
}

// NewSparseUnion constructs a union array using the given type, length, list of
// children and buffer of typeIDs with the given offset.
func NewSparseUnion(dt *arrow.SparseUnionType, length int, children []arrow.Array, typeIDs *memory.Buffer, offset int) *SparseUnion {
	childData := make([]arrow.ArrayData, len(children))
	for i, c := range children {
		childData[i] = c.Data()
	}
	data := NewData(dt, length, []*memory.Buffer{nil, typeIDs}, childData, 0, offset)
	defer data.Release()
	return NewSparseUnionData(data)
}

// NewSparseUnionData constructs a SparseUnion array from the given ArrayData object.
func NewSparseUnionData(data arrow.ArrayData) *SparseUnion {
	a := &SparseUnion{}
	a.refCount.Add(1)
	a.setData(data.(*Data))
	return a
}

// NewSparseUnionFromArrays constructs a new SparseUnion array with the provided
// values.
//
// typeIDs *must* be an INT8 array with no nulls
// len(codes) *must* be either 0 or equal to len(children). If len(codes) is 0,
// the type codes used will be sequentially numeric starting at 0.
func NewSparseUnionFromArrays(typeIDs arrow.Array, children []arrow.Array, codes ...arrow.UnionTypeCode) (*SparseUnion, error) {
	return NewSparseUnionFromArraysWithFieldCodes(typeIDs, children, []string{}, codes)
}

// NewSparseUnionFromArrayWithFields constructs a new SparseUnion array like
// NewSparseUnionFromArrays, but allows specifying the field names. Type codes
// will be auto-generated sequentially starting at 0.
//
// typeIDs *must* be an INT8 array with no nulls.
// len(fields) *must* either be 0 or equal to len(children). If len(fields) is 0,
// then the fields will be named sequentially starting at "0".
func NewSparseUnionFromArraysWithFields(typeIDs arrow.Array, children []arrow.Array, fields []string) (*SparseUnion, error) {
	return NewSparseUnionFromArraysWithFieldCodes(typeIDs, children, fields, []arrow.UnionTypeCode{})
}

// NewSparseUnionFromArraysWithFieldCodes combines the other constructors
// for constructing a new SparseUnion array with the provided field names
// and type codes, along with children and type ids.
//
// All the requirements mentioned in NewSparseUnionFromArrays and
// NewSparseUnionFromArraysWithFields apply.
func NewSparseUnionFromArraysWithFieldCodes(typeIDs arrow.Array, children []arrow.Array, fields []string, codes []arrow.UnionTypeCode) (*SparseUnion, error) {
	switch {
	case typeIDs.DataType().ID() != arrow.INT8:
		return nil, errors.New("arrow/array: union array type ids must be signed int8")
	case typeIDs.NullN() != 0:
		return nil, errors.New("arrow/array: union type ids may not have nulls")
	case len(fields) > 0 && len(fields) != len(children):
		return nil, errors.New("arrow/array: field names must have the same length as children")
	case len(codes) > 0 && len(codes) != len(children):
		return nil, errors.New("arrow/array: type codes must have same length as children")
	}

	buffers := []*memory.Buffer{nil, typeIDs.Data().Buffers()[1]}
	ty := arrow.SparseUnionFromArrays(children, fields, codes)

	childData := make([]arrow.ArrayData, len(children))
	for i, c := range children {
		childData[i] = c.Data()
		if c.Len() != typeIDs.Len() {
			return nil, errors.New("arrow/array: sparse union array must have len(child) == len(typeids) for all children")
		}
	}

	data := NewData(ty, typeIDs.Len(), buffers, childData, 0, typeIDs.Data().Offset())
	defer data.Release()
	return NewSparseUnionData(data), nil
}

func (a *SparseUnion) setData(data *Data) {
	a.union.setData(data)
	debug.Assert(a.data.dtype.ID() == arrow.SPARSE_UNION, "arrow/array: invalid data type for SparseUnion")
	debug.Assert(len(a.data.buffers) == 2, "arrow/array: sparse unions should have exactly 2 buffers")
	debug.Assert(a.data.buffers[0] == nil, "arrow/array: validity bitmap for sparse unions should be nil")
}

func (a *SparseUnion) GetOneForMarshal(i int) interface{} {
	typeID := a.RawTypeCodes()[i]

	childID := a.ChildID(i)
	data := a.Field(childID)

	if data.IsNull(i) {
		return nil
	}

	return []interface{}{typeID, data.GetOneForMarshal(i)}
}

func (a *SparseUnion) MarshalJSON() ([]byte, error) {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)

	buf.WriteByte('[')
	for i := 0; i < a.Len(); i++ {
		if i != 0 {
			buf.WriteByte(',')
		}
		if err := enc.Encode(a.GetOneForMarshal(i)); err != nil {
			return nil, err
		}
	}
	buf.WriteByte(']')
	return buf.Bytes(), nil
}

func (a *SparseUnion) ValueStr(i int) string {
	if a.IsNull(i) {
		return NullValueStr
	}

	val := a.GetOneForMarshal(i)
	if val == nil {
		// child is nil
		return NullValueStr
	}

	data, err := json.Marshal(val)
	if err != nil {
		panic(err)
	}
	return string(data)
}

func (a *SparseUnion) String() string {
	var b strings.Builder
	b.WriteByte('[')

	fieldList := a.unionType.Fields()
	for i := 0; i < a.Len(); i++ {
		if i > 0 {
			b.WriteString(" ")
		}

		field := fieldList[a.ChildID(i)]
		f := a.Field(a.ChildID(i))
		fmt.Fprintf(&b, "{%s=%v}", field.Name, f.GetOneForMarshal(i))
	}
	b.WriteByte(']')
	return b.String()
}

// GetFlattenedField returns a child array, adjusting its validity bitmap
// where the union array type codes don't match.
//
// ie: the returned array will have a null in every index that it is
// not referenced by union.
func (a *SparseUnion) GetFlattenedField(mem memory.Allocator, index int) (arrow.Array, error) {
	if index < 0 || index >= a.NumFields() {
		return nil, fmt.Errorf("arrow/array: index out of range: %d", index)
	}

	childData := a.data.childData[index]
	if a.data.offset != 0 || a.data.length != childData.Len() {
		childData = NewSliceData(childData, int64(a.data.offset), int64(a.data.offset+a.data.length))
		// NewSliceData doesn't break the slice reference for buffers
		// since we're going to replace the null bitmap buffer we need to break the
		// slice reference so that we don't affect a.children's references
		newBufs := make([]*memory.Buffer, len(childData.Buffers()))
		copy(newBufs, childData.(*Data).buffers)
		childData.(*Data).buffers = newBufs
	} else {
		childData = childData.(*Data).Copy()
	}
	defer childData.Release()

	// synthesize a null bitmap based on the union discriminant
	// make sure the bitmap has extra bits corresponding to the child's offset
	flattenedNullBitmap := memory.NewResizableBuffer(mem)
	flattenedNullBitmap.Resize(childData.Len() + childData.Offset())

	var (
		childNullBitmap       = childData.Buffers()[0]
		childOffset           = childData.Offset()
		typeCode              = a.unionType.TypeCodes()[index]
		codes                 = a.RawTypeCodes()
		offset          int64 = 0
	)
	bitutils.GenerateBitsUnrolled(flattenedNullBitmap.Bytes(), int64(childOffset), int64(a.data.length),
		func() bool {
			b := codes[offset] == typeCode
			offset++
			return b
		})

	if childNullBitmap != nil {
		defer childNullBitmap.Release()
		bitutil.BitmapAnd(flattenedNullBitmap.Bytes(), childNullBitmap.Bytes(),
			int64(childOffset), int64(childOffset), flattenedNullBitmap.Bytes(),
			int64(childOffset), int64(childData.Len()))
	}
	childData.(*Data).buffers[0] = flattenedNullBitmap
	childData.(*Data).nulls = childData.Len() - bitutil.CountSetBits(flattenedNullBitmap.Bytes(), childOffset, childData.Len())
	return MakeFromData(childData), nil
}

func arraySparseUnionEqual(l, r *SparseUnion) bool {
	childIDs := l.unionType.ChildIDs()
	leftCodes, rightCodes := l.RawTypeCodes(), r.RawTypeCodes()

	for i := 0; i < l.data.length; i++ {
		typeID := leftCodes[i]
		if typeID != rightCodes[i] {
			return false
		}

		childNum := childIDs[typeID]
		eq := SliceEqual(l.children[childNum], int64(i), int64(i+1),
			r.children[childNum], int64(i), int64(i+1))
		if !eq {
			return false
		}
	}
	return true
}

func arraySparseUnionApproxEqual(l, r *SparseUnion, opt equalOption) bool {
	childIDs := l.unionType.ChildIDs()
	leftCodes, rightCodes := l.RawTypeCodes(), r.RawTypeCodes()

	for i := 0; i < l.data.length; i++ {
		typeID := leftCodes[i]
		if typeID != rightCodes[i] {
			return false
		}

		childNum := childIDs[typeID]
		eq := sliceApproxEqual(l.children[childNum], int64(i+l.data.offset), int64(i+l.data.offset+1),
			r.children[childNum], int64(i+r.data.offset), int64(i+r.data.offset+1), opt)
		if !eq {
			return false
		}
	}
	return true
}

// DenseUnion represents an array where each logical value is taken from
// a single child, at a specific offset. A buffer of 8-bit type ids
// indicates which child a given logical value is to be taken from and
// a buffer of 32-bit offsets indicating which physical position in the
// given child array has the logical value for that index.
//
// Unlike a sparse union, a dense union allows encoding only the child values
// which are actually referred to by the union array. This is counterbalanced
// by the additional footprint of the offsets buffer, and the additional
// indirection cost when looking up values.
//
// Unlike most other arrays, unions do not have a top-level validity bitmap.
type DenseUnion struct {
	union
	offsets []int32
}

// NewDenseUnion constructs a union array using the given type, length, list of
// children and buffers of typeIDs and offsets, with the given array offset.
func NewDenseUnion(dt *arrow.DenseUnionType, length int, children []arrow.Array, typeIDs, valueOffsets *memory.Buffer, offset int) *DenseUnion {
	childData := make([]arrow.ArrayData, len(children))
	for i, c := range children {
		childData[i] = c.Data()
	}

	data := NewData(dt, length, []*memory.Buffer{nil, typeIDs, valueOffsets}, childData, 0, offset)
	defer data.Release()
	return NewDenseUnionData(data)
}

// NewDenseUnionData constructs a DenseUnion array from the given ArrayData object.
func NewDenseUnionData(data arrow.ArrayData) *DenseUnion {
	a := &DenseUnion{}
	a.refCount.Add(1)
	a.setData(data.(*Data))
	return a
}

// NewDenseUnionFromArrays constructs a new DenseUnion array with the provided
// values.
//
// typeIDs *must* be an INT8 array with no nulls
// offsets *must* be an INT32 array with no nulls
// len(codes) *must* be either 0 or equal to len(children). If len(codes) is 0,
// the type codes used will be sequentially numeric starting at 0.
func NewDenseUnionFromArrays(typeIDs, offsets arrow.Array, children []arrow.Array, codes ...arrow.UnionTypeCode) (*DenseUnion, error) {
	return NewDenseUnionFromArraysWithFieldCodes(typeIDs, offsets, children, []string{}, codes)
}

// NewDenseUnionFromArrayWithFields constructs a new DenseUnion array like
// NewDenseUnionFromArrays, but allows specifying the field names. Type codes
// will be auto-generated sequentially starting at 0.
//
// typeIDs *must* be an INT8 array with no nulls.
// offsets *must* be an INT32 array with no nulls.
// len(fields) *must* either be 0 or equal to len(children). If len(fields) is 0,
// then the fields will be named sequentially starting at "0".
func NewDenseUnionFromArraysWithFields(typeIDs, offsets arrow.Array, children []arrow.Array, fields []string) (*DenseUnion, error) {
	return NewDenseUnionFromArraysWithFieldCodes(typeIDs, offsets, children, fields, []arrow.UnionTypeCode{})
}

// NewDenseUnionFromArraysWithFieldCodes combines the other constructors
// for constructing a new DenseUnion array with the provided field names
// and type codes, along with children and type ids.
//
// All the requirements mentioned in NewDenseUnionFromArrays and
// NewDenseUnionFromArraysWithFields apply.
func NewDenseUnionFromArraysWithFieldCodes(typeIDs, offsets arrow.Array, children []arrow.Array, fields []string, codes []arrow.UnionTypeCode) (*DenseUnion, error) {
	switch {
	case offsets.DataType().ID() != arrow.INT32:
		return nil, errors.New("arrow/array: union offsets must be signed int32")
	case typeIDs.DataType().ID() != arrow.INT8:
		return nil, errors.New("arrow/array: union type_ids must be signed int8")
	case typeIDs.NullN() != 0:
		return nil, errors.New("arrow/array: union typeIDs may not have nulls")
	case offsets.NullN() != 0:
		return nil, errors.New("arrow/array: nulls are not allowed in offsets for NewDenseUnionFromArrays*")
	case len(fields) > 0 && len(fields) != len(children):
		return nil, errors.New("arrow/array: fields must be the same length as children")
	case len(codes) > 0 && len(codes) != len(children):
		return nil, errors.New("arrow/array: typecodes must have the same length as children")
	}

	ty := arrow.DenseUnionFromArrays(children, fields, codes)
	buffers := []*memory.Buffer{nil, typeIDs.Data().Buffers()[1], offsets.Data().Buffers()[1]}

	childData := make([]arrow.ArrayData, len(children))
	for i, c := range children {
		childData[i] = c.Data()
	}

	data := NewData(ty, typeIDs.Len(), buffers, childData, 0, typeIDs.Data().Offset())
	defer data.Release()
	return NewDenseUnionData(data), nil
}

func (a *DenseUnion) ValueOffsets() *memory.Buffer { return a.data.buffers[2] }

func (a *DenseUnion) ValueOffset(i int) int32 { return a.offsets[i+a.data.offset] }

func (a *DenseUnion) RawValueOffsets() []int32 { return a.offsets[a.data.offset:] }

func (a *DenseUnion) setData(data *Data) {
	a.union.setData(data)
	debug.Assert(a.data.dtype.ID() == arrow.DENSE_UNION, "arrow/array: invalid data type for DenseUnion")
	debug.Assert(len(a.data.buffers) == 3, "arrow/array: dense unions should have exactly 3 buffers")
	debug.Assert(a.data.buffers[0] == nil, "arrow/array: validity bitmap for dense unions should be nil")

	if data.length > 0 {
		a.offsets = arrow.Int32Traits.CastFromBytes(a.data.buffers[2].Bytes())
	} else {
		a.offsets = []int32{}
	}
}

func (a *DenseUnion) GetOneForMarshal(i int) interface{} {
	typeID := a.RawTypeCodes()[i]

	childID := a.ChildID(i)
	data := a.Field(childID)

	offset := int(a.RawValueOffsets()[i])
	if data.IsNull(offset) {
		return nil
	}

	return []interface{}{typeID, data.GetOneForMarshal(offset)}
}

func (a *DenseUnion) MarshalJSON() ([]byte, error) {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)

	buf.WriteByte('[')
	for i := 0; i < a.Len(); i++ {
		if i != 0 {
			buf.WriteByte(',')
		}
		if err := enc.Encode(a.GetOneForMarshal(i)); err != nil {
			return nil, err
		}
	}
	buf.WriteByte(']')
	return buf.Bytes(), nil
}

func (a *DenseUnion) ValueStr(i int) string {
	if a.IsNull(i) {
		return NullValueStr
	}

	val := a.GetOneForMarshal(i)
	if val == nil {
		// child in nil
		return NullValueStr
	}

	data, err := json.Marshal(val)
	if err != nil {
		panic(err)
	}
	return string(data)
}

func (a *DenseUnion) String() string {
	var b strings.Builder
	b.WriteByte('[')

	offsets := a.RawValueOffsets()

	fieldList := a.unionType.Fields()
	for i := 0; i < a.Len(); i++ {
		if i > 0 {
			b.WriteString(" ")
		}

		field := fieldList[a.ChildID(i)]
		f := a.Field(a.ChildID(i))
		fmt.Fprintf(&b, "{%s=%v}", field.Name, f.GetOneForMarshal(int(offsets[i])))
	}
	b.WriteByte(']')
	return b.String()
}

func arrayDenseUnionEqual(l, r *DenseUnion) bool {
	childIDs := l.unionType.ChildIDs()
	leftCodes, rightCodes := l.RawTypeCodes(), r.RawTypeCodes()
	leftOffsets, rightOffsets := l.RawValueOffsets(), r.RawValueOffsets()

	for i := 0; i < l.data.length; i++ {
		typeID := leftCodes[i]
		if typeID != rightCodes[i] {
			return false
		}

		childNum := childIDs[typeID]
		eq := SliceEqual(l.children[childNum], int64(leftOffsets[i]), int64(leftOffsets[i]+1),
			r.children[childNum], int64(rightOffsets[i]), int64(rightOffsets[i]+1))
		if !eq {
			return false
		}
	}
	return true
}

func arrayDenseUnionApproxEqual(l, r *DenseUnion, opt equalOption) bool {
	childIDs := l.unionType.ChildIDs()
	leftCodes, rightCodes := l.RawTypeCodes(), r.RawTypeCodes()
	leftOffsets, rightOffsets := l.RawValueOffsets(), r.RawValueOffsets()

	for i := 0; i < l.data.length; i++ {
		typeID := leftCodes[i]
		if typeID != rightCodes[i] {
			return false
		}

		childNum := childIDs[typeID]
		eq := sliceApproxEqual(l.children[childNum], int64(leftOffsets[i]), int64(leftOffsets[i]+1),
			r.children[childNum], int64(rightOffsets[i]), int64(rightOffsets[i]+1), opt)
		if !eq {
			return false
		}
	}
	return true
}

// UnionBuilder is a convenience interface for building Union arrays of
// either Dense or Sparse mode.
type UnionBuilder interface {
	Builder
	// AppendChild allows constructing the union type on the fly by making new
	// new array builder available to the union builder. The type code (index)
	// of the new child is returned, which should be passed to the Append method
	// when adding a new element to the union array.
	AppendChild(newChild Builder, fieldName string) (newCode arrow.UnionTypeCode)
	// Append adds an element to the UnionArray indicating which typecode the
	// new element should use. This *must* be followed up by an append to the
	// appropriate child builder.
	Append(arrow.UnionTypeCode)
	// Mode returns what kind of Union is being built, either arrow.SparseMode
	// or arrow.DenseMode
	Mode() arrow.UnionMode
	// Child returns the builder for the requested child index.
	// If an invalid index is requested (e.g. <0 or >len(children))
	// then this will panic.
	Child(idx int) Builder
}

type unionBuilder struct {
	builder

	childFields []arrow.Field
	codes       []arrow.UnionTypeCode
	mode        arrow.UnionMode

	children        []Builder
	typeIDtoBuilder []Builder
	typeIDtoChildID []int
	// for all typeID < denseTypeID, typeIDtoBuilder[typeID] != nil
	denseTypeID  arrow.UnionTypeCode
	typesBuilder *int8BufferBuilder
}

func newUnionBuilder(mem memory.Allocator, children []Builder, typ arrow.UnionType) *unionBuilder {
	if children == nil {
		children = make([]Builder, 0)
	}
	b := unionBuilder{
		builder:         builder{mem: mem},
		mode:            typ.Mode(),
		codes:           typ.TypeCodes(),
		children:        children,
		typeIDtoChildID: make([]int, int(typ.MaxTypeCode())+1),     // convert to int as int8(127) +1 panics
		typeIDtoBuilder: make([]Builder, int(typ.MaxTypeCode())+1), // convert to int as int8(127) +1 panics
		childFields:     make([]arrow.Field, len(children)),
		typesBuilder:    newInt8BufferBuilder(mem),
	}
	b.refCount.Add(1)

	b.typeIDtoChildID[0] = arrow.InvalidUnionChildID
	for i := 1; i < len(b.typeIDtoChildID); i *= 2 {
		copy(b.typeIDtoChildID[i:], b.typeIDtoChildID[:i])
	}

	debug.Assert(len(children) == len(typ.TypeCodes()), "mismatched typecodes and children")
	debug.Assert(len(b.typeIDtoBuilder)-1 <= int(arrow.MaxUnionTypeCode), "too many typeids")

	copy(b.childFields, typ.Fields())
	for i, c := range children {
		c.Retain()
		typeID := typ.TypeCodes()[i]
		b.typeIDtoChildID[typeID] = i
		b.typeIDtoBuilder[typeID] = c
	}

	return &b
}

func (b *unionBuilder) NumChildren() int {
	return len(b.children)
}

func (b *unionBuilder) Child(idx int) Builder {
	if idx < 0 || idx > len(b.children) {
		panic("arrow/array: invalid child index for union builder")
	}
	return b.children[idx]
}

// Len returns the current number of elements in the builder.
func (b *unionBuilder) Len() int { return b.typesBuilder.Len() }

func (b *unionBuilder) Mode() arrow.UnionMode { return b.mode }

func (b *unionBuilder) reserve(elements int, resize func(int)) {
	// union has no null bitmap, ever so we can skip that handling
	if b.length+elements > b.capacity {
		b.capacity = bitutil.NextPowerOf2(b.length + elements)
		resize(b.capacity)
	}
}

func (b *unionBuilder) Release() {
	debug.Assert(b.refCount.Load() > 0, "too many releases")

	if b.refCount.Add(-1) == 0 {
		for _, c := range b.children {
			c.Release()
		}
		b.typesBuilder.Release()
	}
}

func (b *unionBuilder) Type() arrow.DataType {
	fields := make([]arrow.Field, len(b.childFields))
	for i, f := range b.childFields {
		fields[i] = f
		fields[i].Type = b.children[i].Type()
	}

	switch b.mode {
	case arrow.SparseMode:
		return arrow.SparseUnionOf(fields, b.codes)
	case arrow.DenseMode:
		return arrow.DenseUnionOf(fields, b.codes)
	default:
		panic("invalid union builder mode")
	}
}

func (b *unionBuilder) AppendChild(newChild Builder, fieldName string) arrow.UnionTypeCode {
	newChild.Retain()
	b.children = append(b.children, newChild)
	newType := b.nextTypeID()

	b.typeIDtoChildID[newType] = len(b.children) - 1
	b.typeIDtoBuilder[newType] = newChild
	b.childFields = append(b.childFields, arrow.Field{Name: fieldName, Nullable: true})
	b.codes = append(b.codes, newType)

	return newType
}

func (b *unionBuilder) nextTypeID() arrow.UnionTypeCode {
	// find typeID such that typeIDtoBuilder[typeID] == nil
	// use that for the new child. Start searching at denseTypeID
	// since typeIDtoBuilder is densely packed up at least to denseTypeID
	for ; int(b.denseTypeID) < len(b.typeIDtoBuilder); b.denseTypeID++ {
		if b.typeIDtoBuilder[b.denseTypeID] == nil {
			id := b.denseTypeID
			b.denseTypeID++
			return id
		}
	}

	debug.Assert(len(b.typeIDtoBuilder) < int(arrow.MaxUnionTypeCode), "too many children typeids")
	// typeIDtoBuilder is already densely packed, so just append the new child
	b.typeIDtoBuilder = append(b.typeIDtoBuilder, nil)
	b.typeIDtoChildID = append(b.typeIDtoChildID, arrow.InvalidUnionChildID)
	id := b.denseTypeID
	b.denseTypeID++
	return id
}

func (b *unionBuilder) newData() *Data {
	length := b.typesBuilder.Len()
	typesBuffer := b.typesBuilder.Finish()
	defer typesBuffer.Release()
	childData := make([]arrow.ArrayData, len(b.children))
	for i, b := range b.children {
		childData[i] = b.newData()
		defer childData[i].Release()
	}

	return NewData(b.Type(), length, []*memory.Buffer{nil, typesBuffer}, childData, 0, 0)
}

// SparseUnionBuilder is used to build a Sparse Union array using the Append
// methods. You can also add new types to the union on the fly by using
// AppendChild.
//
// Keep in mind: All children of a SparseUnion should be the same length
// as the union itself. If you add new children with AppendChild, ensure
// that they have the correct number of preceding elements that have been
// added to the builder beforehand.
type SparseUnionBuilder struct {
	*unionBuilder
}

// NewEmptySparseUnionBuilder is a helper to construct a SparseUnionBuilder
// without having to predefine the union types. It creates a builder with no
// children and AppendChild will have to be called before appending any
// elements to this builder.
func NewEmptySparseUnionBuilder(mem memory.Allocator) *SparseUnionBuilder {
	return &SparseUnionBuilder{
		unionBuilder: newUnionBuilder(mem, nil, arrow.SparseUnionOf([]arrow.Field{}, []arrow.UnionTypeCode{})),
	}
}

// NewSparseUnionBuilder constructs a new SparseUnionBuilder with the provided
// children and type codes. Builders will be constructed for each child
// using the fields in typ
func NewSparseUnionBuilder(mem memory.Allocator, typ *arrow.SparseUnionType) *SparseUnionBuilder {
	children := make([]Builder, typ.NumFields())
	for i, f := range typ.Fields() {
		children[i] = NewBuilder(mem, f.Type)
		defer children[i].Release()
	}
	return NewSparseUnionBuilderWithBuilders(mem, typ, children)
}

// NewSparseUnionWithBuilders returns a new SparseUnionBuilder using the
// provided type and builders.
func NewSparseUnionBuilderWithBuilders(mem memory.Allocator, typ *arrow.SparseUnionType, children []Builder) *SparseUnionBuilder {
	return &SparseUnionBuilder{
		unionBuilder: newUnionBuilder(mem, children, typ),
	}
}

func (b *SparseUnionBuilder) Reserve(n int) {
	b.reserve(n, b.Resize)
}

func (b *SparseUnionBuilder) Resize(n int) {
	b.typesBuilder.resize(n)
}

// AppendNull will append a null to the first child and an empty value
// (implementation-defined) to the rest of the children.
func (b *SparseUnionBuilder) AppendNull() {
	firstChildCode := b.codes[0]
	b.typesBuilder.AppendValue(firstChildCode)
	b.typeIDtoBuilder[firstChildCode].AppendNull()
	for _, c := range b.codes[1:] {
		b.typeIDtoBuilder[c].AppendEmptyValue()
	}
}

// AppendNulls is identical to calling AppendNull() n times, except
// it will pre-allocate with reserve for all the nulls beforehand.
func (b *SparseUnionBuilder) AppendNulls(n int) {
	firstChildCode := b.codes[0]
	b.Reserve(n)
	for _, c := range b.codes {
		b.typeIDtoBuilder[c].Reserve(n)
	}
	for i := 0; i < n; i++ {
		b.typesBuilder.AppendValue(firstChildCode)
		b.typeIDtoBuilder[firstChildCode].AppendNull()
		for _, c := range b.codes[1:] {
			b.typeIDtoBuilder[c].AppendEmptyValue()
		}
	}
}

// AppendEmptyValue appends an empty value (implementation defined)
// to each child, and appends the type of the first typecode to the typeid
// buffer.
func (b *SparseUnionBuilder) AppendEmptyValue() {
	b.typesBuilder.AppendValue(b.codes[0])
	for _, c := range b.codes {
		b.typeIDtoBuilder[c].AppendEmptyValue()
	}
}

// AppendEmptyValues is identical to calling AppendEmptyValue() n times,
// except it pre-allocates first so it is more efficient.
func (b *SparseUnionBuilder) AppendEmptyValues(n int) {
	b.Reserve(n)
	firstChildCode := b.codes[0]
	for _, c := range b.codes {
		b.typeIDtoBuilder[c].Reserve(n)
	}
	for i := 0; i < n; i++ {
		b.typesBuilder.AppendValue(firstChildCode)
		for _, c := range b.codes {
			b.typeIDtoBuilder[c].AppendEmptyValue()
		}
	}
}

// Append appends an element to the UnionArray and must be followed up
// by an append to the appropriate child builder. The parameter should
// be the type id of the child to which the next value will be appended.
//
// After appending to the corresponding child builder, all other child
// builders should have a null or empty value appended to them (although
// this is not enforced and any value is theoretically allowed and will be
// ignored).
func (b *SparseUnionBuilder) Append(nextType arrow.UnionTypeCode) {
	b.typesBuilder.AppendValue(nextType)
}

func (b *SparseUnionBuilder) NewArray() arrow.Array {
	return b.NewSparseUnionArray()
}

func (b *SparseUnionBuilder) NewSparseUnionArray() (a *SparseUnion) {
	data := b.newData()
	a = NewSparseUnionData(data)
	data.Release()
	return
}

func (b *SparseUnionBuilder) UnmarshalJSON(data []byte) (err error) {
	dec := json.NewDecoder(bytes.NewReader(data))
	t, err := dec.Token()
	if err != nil {
		return err
	}

	if delim, ok := t.(json.Delim); !ok || delim != '[' {
		return fmt.Errorf("sparse union builder must unpack from json array, found %s", t)
	}
	return b.Unmarshal(dec)
}

func (b *SparseUnionBuilder) Unmarshal(dec *json.Decoder) error {
	for dec.More() {
		if err := b.UnmarshalOne(dec); err != nil {
			return err
		}
	}
	return nil
}

func (b *SparseUnionBuilder) AppendValueFromString(s string) error {
	if s == NullValueStr {
		b.AppendNull()
		return nil
	}
	dec := json.NewDecoder(strings.NewReader(s))
	return b.UnmarshalOne(dec)
}

func (b *SparseUnionBuilder) UnmarshalOne(dec *json.Decoder) error {
	t, err := dec.Token()
	if err != nil {
		return err
	}

	switch t {
	case json.Delim('['):
		// should be [type_id, Value]
		typeID, err := dec.Token()
		if err != nil {
			return err
		}

		var typeCode int8

		switch tid := typeID.(type) {
		case json.Number:
			id, err := tid.Int64()
			if err != nil {
				return err
			}
			typeCode = int8(id)
		case float64:
			if tid != float64(int64(tid)) {
				return &json.UnmarshalTypeError{
					Offset: dec.InputOffset(),
					Type:   reflect.TypeOf(int8(0)),
					Struct: fmt.Sprint(b.Type()),
					Value:  "float",
				}
			}
			typeCode = int8(tid)
		}

		childNum := b.typeIDtoChildID[typeCode]
		if childNum == arrow.InvalidUnionChildID {
			return &json.UnmarshalTypeError{
				Offset: dec.InputOffset(),
				Value:  "invalid type code",
			}
		}

		for i, c := range b.children {
			if i != childNum {
				c.AppendNull()
			}
		}

		b.Append(typeCode)
		if err := b.children[childNum].UnmarshalOne(dec); err != nil {
			return err
		}

		endArr, err := dec.Token()
		if err != nil {
			return err
		}

		if endArr != json.Delim(']') {
			return &json.UnmarshalTypeError{
				Offset: dec.InputOffset(),
				Value:  "union value array should have exactly 2 elements",
			}
		}
	case nil:
		b.AppendNull()
	default:
		return &json.UnmarshalTypeError{
			Offset: dec.InputOffset(),
			Value:  fmt.Sprint(t),
			Struct: fmt.Sprint(b.Type()),
		}
	}
	return nil
}

// DenseUnionBuilder is used to build a Dense Union array using the Append
// methods. You can also add new types to the union on the fly by using
// AppendChild.
type DenseUnionBuilder struct {
	*unionBuilder

	offsetsBuilder *int32BufferBuilder
}

// NewEmptyDenseUnionBuilder is a helper to construct a DenseUnionBuilder
// without having to predefine the union types. It creates a builder with no
// children and AppendChild will have to be called before appending any
// elements to this builder.
func NewEmptyDenseUnionBuilder(mem memory.Allocator) *DenseUnionBuilder {
	return &DenseUnionBuilder{
		unionBuilder:   newUnionBuilder(mem, nil, arrow.DenseUnionOf([]arrow.Field{}, []arrow.UnionTypeCode{})),
		offsetsBuilder: newInt32BufferBuilder(mem),
	}
}

// NewDenseUnionBuilder constructs a new DenseUnionBuilder with the provided
// children and type codes. Builders will be constructed for each child
// using the fields in typ
func NewDenseUnionBuilder(mem memory.Allocator, typ *arrow.DenseUnionType) *DenseUnionBuilder {
	children := make([]Builder, 0, typ.NumFields())
	defer func() {
		for _, child := range children {
			child.Release()
		}
	}()

	for _, f := range typ.Fields() {
		children = append(children, NewBuilder(mem, f.Type))
	}
	return NewDenseUnionBuilderWithBuilders(mem, typ, children)
}

// NewDenseUnionWithBuilders returns a new DenseUnionBuilder using the
// provided type and builders.
func NewDenseUnionBuilderWithBuilders(mem memory.Allocator, typ *arrow.DenseUnionType, children []Builder) *DenseUnionBuilder {
	return &DenseUnionBuilder{
		unionBuilder:   newUnionBuilder(mem, children, typ),
		offsetsBuilder: newInt32BufferBuilder(mem),
	}
}

func (b *DenseUnionBuilder) Reserve(n int) {
	b.reserve(n, b.Resize)
}

func (b *DenseUnionBuilder) Resize(n int) {
	b.typesBuilder.resize(n)
	b.offsetsBuilder.resize(n * arrow.Int32SizeBytes)
}

// AppendNull will only append a null value arbitrarily to the first child
// and use that offset for this element of the array.
func (b *DenseUnionBuilder) AppendNull() {
	firstChildCode := b.codes[0]
	childBuilder := b.typeIDtoBuilder[firstChildCode]
	b.typesBuilder.AppendValue(firstChildCode)
	b.offsetsBuilder.AppendValue(int32(childBuilder.Len()))
	childBuilder.AppendNull()
}

// AppendNulls will only append a single null arbitrarily to the first child
// and use the same offset multiple times to point to it. The result is that
// for a DenseUnion this is more efficient than calling AppendNull multiple
// times in a loop
func (b *DenseUnionBuilder) AppendNulls(n int) {
	// only append 1 null to the child builder, use the same offset twice
	firstChildCode := b.codes[0]
	childBuilder := b.typeIDtoBuilder[firstChildCode]
	b.Reserve(n)
	for i := 0; i < n; i++ {
		b.typesBuilder.AppendValue(firstChildCode)
		b.offsetsBuilder.AppendValue(int32(childBuilder.Len()))
	}
	// only append a single null to the child builder, the offsets all refer to the same value
	childBuilder.AppendNull()
}

// AppendEmptyValue only appends an empty value arbitrarily to the first child,
// and then uses that offset to identify the value.
func (b *DenseUnionBuilder) AppendEmptyValue() {
	firstChildCode := b.codes[0]
	childBuilder := b.typeIDtoBuilder[firstChildCode]
	b.typesBuilder.AppendValue(firstChildCode)
	b.offsetsBuilder.AppendValue(int32(childBuilder.Len()))
	childBuilder.AppendEmptyValue()
}

// AppendEmptyValues, like AppendNulls, will only append a single empty value
// (implementation defined) to the first child arbitrarily, and then point
// at that value using the offsets n times. That makes this more efficient
// than calling AppendEmptyValue multiple times.
func (b *DenseUnionBuilder) AppendEmptyValues(n int) {
	// only append 1 null to the child builder, use the same offset twice
	firstChildCode := b.codes[0]
	childBuilder := b.typeIDtoBuilder[firstChildCode]
	b.Reserve(n)
	for i := 0; i < n; i++ {
		b.typesBuilder.AppendValue(firstChildCode)
		b.offsetsBuilder.AppendValue(int32(childBuilder.Len()))
	}
	// only append a single empty value to the child builder, the offsets all
	// refer to the same value
	childBuilder.AppendEmptyValue()
}

// Append appends the necessary offset and type code to the builder
// and must be followed up with an append to the appropriate child builder
func (b *DenseUnionBuilder) Append(nextType arrow.UnionTypeCode) {
	b.typesBuilder.AppendValue(nextType)
	bldr := b.typeIDtoBuilder[nextType]
	if bldr.Len() == kMaxElems {
		panic("a dense UnionArray cannot contain more than 2^31 - 1 elements from a single child")
	}

	b.offsetsBuilder.AppendValue(int32(bldr.Len()))
}

func (b *DenseUnionBuilder) Release() {
	debug.Assert(b.refCount.Load() > 0, "too many releases")

	if b.refCount.Add(-1) == 0 {
		for _, c := range b.children {
			c.Release()
		}
		b.typesBuilder.Release()
		b.offsetsBuilder.Release()
	}
}

func (b *DenseUnionBuilder) newData() *Data {
	data := b.unionBuilder.newData()
	data.buffers = append(data.buffers, b.offsetsBuilder.Finish())
	return data
}

func (b *DenseUnionBuilder) NewArray() arrow.Array {
	return b.NewDenseUnionArray()
}

func (b *DenseUnionBuilder) NewDenseUnionArray() (a *DenseUnion) {
	data := b.newData()
	a = NewDenseUnionData(data)
	data.Release()
	return
}

func (b *DenseUnionBuilder) UnmarshalJSON(data []byte) (err error) {
	dec := json.NewDecoder(bytes.NewReader(data))
	t, err := dec.Token()
	if err != nil {
		return err
	}

	if delim, ok := t.(json.Delim); !ok || delim != '[' {
		return fmt.Errorf("dense union builder must unpack from json array, found %s", t)
	}
	return b.Unmarshal(dec)
}

func (b *DenseUnionBuilder) Unmarshal(dec *json.Decoder) error {
	for dec.More() {
		if err := b.UnmarshalOne(dec); err != nil {
			return err
		}
	}
	return nil
}

func (d *DenseUnionBuilder) AppendValueFromString(s string) error {
	if s == NullValueStr {
		d.AppendNull()
		return nil
	}
	dec := json.NewDecoder(strings.NewReader(s))
	return d.UnmarshalOne(dec)
}

func (b *DenseUnionBuilder) UnmarshalOne(dec *json.Decoder) error {
	t, err := dec.Token()
	if err != nil {
		return err
	}

	switch t {
	case json.Delim('['):
		// should be [type_id, Value]
		typeID, err := dec.Token()
		if err != nil {
			return err
		}

		var typeCode int8

		switch tid := typeID.(type) {
		case json.Number:
			id, err := tid.Int64()
			if err != nil {
				return err
			}
			typeCode = int8(id)
		case float64:
			if tid != float64(int64(tid)) {
				return &json.UnmarshalTypeError{
					Offset: dec.InputOffset(),
					Type:   reflect.TypeOf(int8(0)),
					Struct: fmt.Sprint(b.Type()),
					Value:  "float",
				}
			}
			typeCode = int8(tid)
		}

		childNum := b.typeIDtoChildID[typeCode]
		if childNum == arrow.InvalidUnionChildID {
			return &json.UnmarshalTypeError{
				Offset: dec.InputOffset(),
				Value:  "invalid type code",
			}
		}

		b.Append(typeCode)
		if err := b.children[childNum].UnmarshalOne(dec); err != nil {
			return err
		}

		endArr, err := dec.Token()
		if err != nil {
			return err
		}

		if endArr != json.Delim(']') {
			return &json.UnmarshalTypeError{
				Offset: dec.InputOffset(),
				Value:  "union value array should have exactly 2 elements",
			}
		}
	case nil:
		b.AppendNull()
	default:
		return &json.UnmarshalTypeError{
			Offset: dec.InputOffset(),
			Value:  fmt.Sprint(t),
			Struct: fmt.Sprint(b.Type()),
		}
	}
	return nil
}

var (
	_ arrow.Array  = (*SparseUnion)(nil)
	_ arrow.Array  = (*DenseUnion)(nil)
	_ Union        = (*SparseUnion)(nil)
	_ Union        = (*DenseUnion)(nil)
	_ Builder      = (*SparseUnionBuilder)(nil)
	_ Builder      = (*DenseUnionBuilder)(nil)
	_ UnionBuilder = (*SparseUnionBuilder)(nil)
	_ UnionBuilder = (*DenseUnionBuilder)(nil)
)
