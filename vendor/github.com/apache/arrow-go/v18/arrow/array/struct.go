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
	"strings"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/bitutil"
	"github.com/apache/arrow-go/v18/arrow/internal/debug"
	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/internal/json"
)

// Struct represents an ordered sequence of relative types.
type Struct struct {
	array
	fields []arrow.Array
}

// NewStructArray constructs a new Struct Array out of the columns passed
// in and the field names. The length of all cols must be the same and
// there should be the same number of columns as names.
func NewStructArray(cols []arrow.Array, names []string) (*Struct, error) {
	return NewStructArrayWithNulls(cols, names, nil, 0, 0)
}

// NewStructArrayWithFields builds a new Struct Array using the passed columns
// and provided fields. As opposed to NewStructArray, this allows you to provide
// the full fields to utilize for the struct column instead of just the names.
func NewStructArrayWithFields(cols []arrow.Array, fields []arrow.Field) (*Struct, error) {
	return NewStructArrayWithFieldsAndNulls(cols, fields, nil, 0, 0)
}

// NewStructArrayWithFieldsAndNulls is like NewStructArrayWithFields as a convenience function,
// but also takes in a null bitmap, the number of nulls, and an optional offset
// to use for creating the Struct Array.
func NewStructArrayWithFieldsAndNulls(cols []arrow.Array, fields []arrow.Field, nullBitmap *memory.Buffer, nullCount int, offset int) (*Struct, error) {
	if len(cols) != len(fields) {
		return nil, fmt.Errorf("%w: mismatching number of fields and child arrays", arrow.ErrInvalid)
	}
	if len(cols) == 0 {
		return nil, fmt.Errorf("%w: can't infer struct array length with 0 child arrays", arrow.ErrInvalid)
	}

	length := cols[0].Len()
	children := make([]arrow.ArrayData, len(cols))
	for i, c := range cols {
		if length != c.Len() {
			return nil, fmt.Errorf("%w: mismatching child array lengths", arrow.ErrInvalid)
		}
		if !arrow.TypeEqual(fields[i].Type, c.DataType()) {
			return nil, fmt.Errorf("%w: mismatching data type for child #%d, field says '%s', got '%s'",
				arrow.ErrInvalid, i, fields[i].Type, c.DataType())
		}

		children[i] = c.Data()
	}

	if nullBitmap == nil {
		if nullCount > 0 {
			return nil, fmt.Errorf("%w: null count is greater than 0 but null bitmap is nil", arrow.ErrInvalid)
		}
		nullCount = 0
	}

	data := NewData(arrow.StructOf(fields...), length-offset, []*memory.Buffer{nullBitmap}, children, nullCount, offset)
	defer data.Release()
	return NewStructData(data), nil
}

// NewStructArrayWithNulls is like NewStructArray as a convenience function,
// but also takes in a null bitmap, the number of nulls, and an optional offset
// to use for creating the Struct Array.
func NewStructArrayWithNulls(cols []arrow.Array, names []string, nullBitmap *memory.Buffer, nullCount int, offset int) (*Struct, error) {
	if len(cols) != len(names) {
		return nil, fmt.Errorf("%w: mismatching number of fields and child arrays", arrow.ErrInvalid)
	}
	if len(cols) == 0 {
		return nil, fmt.Errorf("%w: can't infer struct array length with 0 child arrays", arrow.ErrInvalid)
	}
	length := cols[0].Len()
	children := make([]arrow.ArrayData, len(cols))
	fields := make([]arrow.Field, len(cols))
	for i, c := range cols {
		if length != c.Len() {
			return nil, fmt.Errorf("%w: mismatching child array lengths", arrow.ErrInvalid)
		}
		children[i] = c.Data()
		fields[i].Name = names[i]
		fields[i].Type = c.DataType()
		fields[i].Nullable = true
	}
	data := NewData(arrow.StructOf(fields...), length, []*memory.Buffer{nullBitmap}, children, nullCount, offset)
	defer data.Release()
	return NewStructData(data), nil
}

// NewStructData returns a new Struct array value from data.
func NewStructData(data arrow.ArrayData) *Struct {
	a := &Struct{}
	a.refCount.Add(1)
	a.setData(data.(*Data))
	return a
}

func (a *Struct) NumField() int           { return len(a.fields) }
func (a *Struct) Field(i int) arrow.Array { return a.fields[i] }

// ValueStr returns the string representation (as json) of the value at index i.
func (a *Struct) ValueStr(i int) string {
	if a.IsNull(i) {
		return NullValueStr
	}

	data, err := json.Marshal(a.GetOneForMarshal(i))
	if err != nil {
		panic(err)
	}
	return string(data)
}

func (a *Struct) String() string {
	o := new(strings.Builder)
	o.WriteString("{")

	structBitmap := a.NullBitmapBytes()
	for i, v := range a.fields {
		if i > 0 {
			o.WriteString(" ")
		}
		if arrow.IsUnion(v.DataType().ID()) {
			fmt.Fprintf(o, "%v", v)
			continue
		} else if !bytes.Equal(structBitmap, v.NullBitmapBytes()) {
			masked := a.newStructFieldWithParentValidityMask(i)
			fmt.Fprintf(o, "%v", masked)
			masked.Release()
			continue
		}
		fmt.Fprintf(o, "%v", v)
	}
	o.WriteString("}")
	return o.String()
}

// newStructFieldWithParentValidityMask returns the Interface at fieldIndex
// with a nullBitmapBytes adjusted according on the parent struct nullBitmapBytes.
// From the docs:
//
//	"When reading the struct array the parent validity bitmap takes priority."
func (a *Struct) newStructFieldWithParentValidityMask(fieldIndex int) arrow.Array {
	field := a.Field(fieldIndex)
	nullBitmapBytes := field.NullBitmapBytes()
	maskedNullBitmapBytes := make([]byte, len(nullBitmapBytes))
	copy(maskedNullBitmapBytes, nullBitmapBytes)
	for i := 0; i < field.Len(); i++ {
		if a.IsNull(i) {
			bitutil.ClearBit(maskedNullBitmapBytes, i)
		}
	}
	data := NewSliceData(field.Data(), 0, int64(field.Len())).(*Data)
	defer data.Release()
	bufs := make([]*memory.Buffer, len(data.Buffers()))
	copy(bufs, data.buffers)
	bufs[0].Release()
	bufs[0] = memory.NewBufferBytes(maskedNullBitmapBytes)
	data.buffers = bufs
	maskedField := MakeFromData(data)
	return maskedField
}

func (a *Struct) setData(data *Data) {
	a.array.setData(data)
	a.fields = make([]arrow.Array, len(data.childData))
	for i, child := range data.childData {
		if data.offset != 0 || child.Len() != data.length {
			sub := NewSliceData(child, int64(data.offset), int64(data.offset+data.length))
			a.fields[i] = MakeFromData(sub)
			sub.Release()
		} else {
			a.fields[i] = MakeFromData(child)
		}
	}
}

func (a *Struct) GetOneForMarshal(i int) interface{} {
	if a.IsNull(i) {
		return nil
	}

	tmp := make(map[string]interface{})
	fieldList := a.data.dtype.(*arrow.StructType).Fields()
	for j, d := range a.fields {
		tmp[fieldList[j].Name] = d.GetOneForMarshal(i)
	}
	return tmp
}

func (a *Struct) MarshalJSON() ([]byte, error) {
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

func arrayEqualStruct(left, right *Struct) bool {
	for i, lf := range left.fields {
		rf := right.fields[i]
		if !Equal(lf, rf) {
			return false
		}
	}
	return true
}

func (a *Struct) Retain() {
	a.array.Retain()
	for _, f := range a.fields {
		f.Retain()
	}
}

func (a *Struct) Release() {
	a.array.Release()
	for _, f := range a.fields {
		f.Release()
	}
}

type StructBuilder struct {
	builder

	dtype  arrow.DataType
	fields []Builder
}

// NewStructBuilder returns a builder, using the provided memory allocator.
func NewStructBuilder(mem memory.Allocator, dtype *arrow.StructType) *StructBuilder {
	b := &StructBuilder{
		builder: builder{mem: mem},
		dtype:   dtype,
		fields:  make([]Builder, dtype.NumFields()),
	}
	b.refCount.Add(1)

	for i, f := range dtype.Fields() {
		b.fields[i] = NewBuilder(b.mem, f.Type)
	}
	return b
}

func (b *StructBuilder) Type() arrow.DataType {
	fields := make([]arrow.Field, len(b.fields))
	copy(fields, b.dtype.(*arrow.StructType).Fields())
	for i, b := range b.fields {
		fields[i].Type = b.Type()
	}
	return arrow.StructOf(fields...)
}

// Release decreases the reference count by 1.
// When the reference count goes to zero, the memory is freed.
func (b *StructBuilder) Release() {
	debug.Assert(b.refCount.Load() > 0, "too many releases")

	if b.refCount.Add(-1) == 0 {
		if b.nullBitmap != nil {
			b.nullBitmap.Release()
			b.nullBitmap = nil
		}

		for _, f := range b.fields {
			f.Release()
		}
	}
}

func (b *StructBuilder) Append(v bool) {
	// Intentionally not calling `Reserve` as it will recursively call
	// `Reserve` on the child builders, which during profiling has shown to be
	// very expensive due to iterating over children, dynamic dispatch and all
	// other code that gets executed even if previously `Reserve` was called to
	// preallocate. Not calling `Reserve` has no downsides as when appending to
	// the underlying children they already ensure they have enough space
	// reserved. The only thing we must do is ensure we have enough space in
	// the validity bitmap of the struct builder itself.
	b.reserve(1, b.resizeHelper)
	b.unsafeAppendBoolToBitmap(v)
	if !v {
		for _, f := range b.fields {
			f.AppendNull()
		}
	}
}

func (b *StructBuilder) AppendValues(valids []bool) {
	b.Reserve(len(valids))
	b.unsafeAppendBoolsToBitmap(valids, len(valids))
}

func (b *StructBuilder) AppendNull() { b.Append(false) }

func (b *StructBuilder) AppendNulls(n int) {
	for i := 0; i < n; i++ {
		b.AppendNull()
	}
}

func (b *StructBuilder) AppendEmptyValue() {
	b.Append(true)
	for _, f := range b.fields {
		f.AppendEmptyValue()
	}
}

func (b *StructBuilder) AppendEmptyValues(n int) {
	for i := 0; i < n; i++ {
		b.AppendEmptyValue()
	}
}

func (b *StructBuilder) unsafeAppendBoolToBitmap(isValid bool) {
	if isValid {
		bitutil.SetBit(b.nullBitmap.Bytes(), b.length)
	} else {
		b.nulls++
	}
	b.length++
}

func (b *StructBuilder) init(capacity int) {
	b.builder.init(capacity)
}

// Reserve ensures there is enough space for appending n elements
// by checking the capacity and calling Resize if necessary.
func (b *StructBuilder) Reserve(n int) {
	b.reserve(n, b.resizeHelper)
	for _, f := range b.fields {
		f.Reserve(n)
	}
}

// Resize adjusts the space allocated by b to n elements. If n is greater than b.Cap(),
// additional memory will be allocated. If n is smaller, the allocated memory may reduced.
func (b *StructBuilder) Resize(n int) {
	b.resizeHelper(n)
	for _, f := range b.fields {
		f.Resize(n)
	}
}

func (b *StructBuilder) resizeHelper(n int) {
	if n < minBuilderCapacity {
		n = minBuilderCapacity
	}

	if b.capacity == 0 {
		b.init(n)
	} else {
		b.resize(n, b.builder.init)
	}
}

func (b *StructBuilder) NumField() int              { return len(b.fields) }
func (b *StructBuilder) FieldBuilder(i int) Builder { return b.fields[i] }

// NewArray creates a Struct array from the memory buffers used by the builder and resets the StructBuilder
// so it can be used to build a new array.
func (b *StructBuilder) NewArray() arrow.Array {
	return b.NewStructArray()
}

// NewStructArray creates a Struct array from the memory buffers used by the builder and resets the StructBuilder
// so it can be used to build a new array.
func (b *StructBuilder) NewStructArray() (a *Struct) {
	data := b.newData()
	a = NewStructData(data)
	data.Release()
	return
}

func (b *StructBuilder) newData() (data *Data) {
	fields := make([]arrow.ArrayData, len(b.fields))
	for i, f := range b.fields {
		arr := f.NewArray()
		defer arr.Release()
		fields[i] = arr.Data()
	}

	data = NewData(
		b.Type(), b.length,
		[]*memory.Buffer{
			b.nullBitmap,
		},
		fields,
		b.nulls,
		0,
	)
	b.reset()

	return
}

func (b *StructBuilder) AppendValueFromString(s string) error {
	if s == NullValueStr {
		b.AppendNull()
		return nil
	}

	if !strings.HasPrefix(s, "{") && !strings.HasSuffix(s, "}") {
		return fmt.Errorf("%w: invalid string for struct should be be of form: {*}", arrow.ErrInvalid)
	}
	dec := json.NewDecoder(strings.NewReader(s))
	return b.UnmarshalOne(dec)
}

func (b *StructBuilder) UnmarshalOne(dec *json.Decoder) error {
	t, err := dec.Token()
	if err != nil {
		return err
	}

	switch t {
	case json.Delim('{'):
		b.Append(true)
		keylist := make(map[string]bool)
		for dec.More() {
			keyTok, err := dec.Token()
			if err != nil {
				return err
			}

			key, ok := keyTok.(string)
			if !ok {
				return errors.New("missing key")
			}

			if keylist[key] {
				return fmt.Errorf("key %s is specified twice", key)
			}

			keylist[key] = true

			idx, ok := b.dtype.(*arrow.StructType).FieldIdx(key)
			if !ok {
				var extra interface{}
				if err := dec.Decode(&extra); err != nil {
					return err
				}
				continue
			}

			if err := b.fields[idx].UnmarshalOne(dec); err != nil {
				return err
			}
		}

		// Append null values to all optional fields that were not presented in the json input
		for _, field := range b.dtype.(*arrow.StructType).Fields() {
			if !field.Nullable {
				continue
			}
			idx, _ := b.dtype.(*arrow.StructType).FieldIdx(field.Name)
			if _, hasKey := keylist[field.Name]; !hasKey {
				b.fields[idx].AppendNull()
			}
		}

		// consume '}'
		_, err := dec.Token()
		return err
	case nil:
		b.AppendNull()
	default:
		return &json.UnmarshalTypeError{
			Offset: dec.InputOffset(),
			Struct: fmt.Sprint(b.dtype),
		}
	}
	return nil
}

func (b *StructBuilder) Unmarshal(dec *json.Decoder) error {
	for dec.More() {
		if err := b.UnmarshalOne(dec); err != nil {
			return err
		}
	}
	return nil
}

func (b *StructBuilder) UnmarshalJSON(data []byte) error {
	dec := json.NewDecoder(bytes.NewReader(data))
	t, err := dec.Token()
	if err != nil {
		return err
	}

	if delim, ok := t.(json.Delim); !ok || delim != '[' {
		return fmt.Errorf("struct builder must unpack from json array, found %s", delim)
	}

	return b.Unmarshal(dec)
}

var (
	_ arrow.Array = (*Struct)(nil)
	_ Builder     = (*StructBuilder)(nil)
)
