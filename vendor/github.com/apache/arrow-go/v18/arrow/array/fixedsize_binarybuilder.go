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
	"encoding/base64"
	"fmt"
	"reflect"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/internal/debug"
	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/internal/json"
)

// A FixedSizeBinaryBuilder is used to build a FixedSizeBinary array using the Append methods.
type FixedSizeBinaryBuilder struct {
	builder

	dtype  *arrow.FixedSizeBinaryType
	values *byteBufferBuilder
}

func NewFixedSizeBinaryBuilder(mem memory.Allocator, dtype *arrow.FixedSizeBinaryType) *FixedSizeBinaryBuilder {
	b := &FixedSizeBinaryBuilder{
		builder: builder{mem: mem},
		dtype:   dtype,
		values:  newByteBufferBuilder(mem),
	}
	b.refCount.Add(1)
	return b
}

func (b *FixedSizeBinaryBuilder) Type() arrow.DataType { return b.dtype }

// Release decreases the reference count by 1.
// When the reference count goes to zero, the memory is freed.
// Release may be called simultaneously from multiple goroutines.
func (b *FixedSizeBinaryBuilder) Release() {
	debug.Assert(b.refCount.Load() > 0, "too many releases")

	if b.refCount.Add(-1) == 0 {
		if b.nullBitmap != nil {
			b.nullBitmap.Release()
			b.nullBitmap = nil
		}
		if b.values != nil {
			b.values.Release()
			b.values = nil
		}
	}
}

func (b *FixedSizeBinaryBuilder) Append(v []byte) {
	if len(v) != b.dtype.ByteWidth {
		// TODO(alexandre): should we return an error instead?
		panic("len(v) != b.dtype.ByteWidth")
	}

	b.Reserve(1)
	b.values.Append(v)
	b.UnsafeAppendBoolToBitmap(true)
}

func (b *FixedSizeBinaryBuilder) AppendNull() {
	b.Reserve(1)
	b.values.Advance(b.dtype.ByteWidth)
	b.UnsafeAppendBoolToBitmap(false)
}

func (b *FixedSizeBinaryBuilder) AppendNulls(n int) {
	for i := 0; i < n; i++ {
		b.AppendNull()
	}
}

func (b *FixedSizeBinaryBuilder) AppendEmptyValue() {
	b.Reserve(1)
	b.values.Advance(b.dtype.ByteWidth)
	b.UnsafeAppendBoolToBitmap(true)
}

func (b *FixedSizeBinaryBuilder) AppendEmptyValues(n int) {
	for i := 0; i < n; i++ {
		b.AppendEmptyValue()
	}
}

func (b *FixedSizeBinaryBuilder) UnsafeAppend(v []byte) {
	b.values.unsafeAppend(v)
	b.UnsafeAppendBoolToBitmap(true)
}

// AppendValues will append the values in the v slice. The valid slice determines which values
// in v are valid (not null). The valid slice must either be empty or be equal in length to v. If empty,
// all values in v are appended and considered valid.
func (b *FixedSizeBinaryBuilder) AppendValues(v [][]byte, valid []bool) {
	if len(v) != len(valid) && len(valid) != 0 {
		panic("len(v) != len(valid) && len(valid) != 0")
	}

	if len(v) == 0 {
		return
	}

	b.Reserve(len(v))
	for _, vv := range v {
		switch len(vv) {
		case 0:
			b.values.Advance(b.dtype.ByteWidth)
		case b.dtype.ByteWidth:
			b.values.Append(vv)
		default:
			panic(fmt.Errorf("array: invalid binary length (got=%d, want=%d)", len(vv), b.dtype.ByteWidth))
		}
	}

	b.unsafeAppendBoolsToBitmap(valid, len(v))
}

func (b *FixedSizeBinaryBuilder) init(capacity int) {
	b.builder.init(capacity)
	b.values.resize(capacity * b.dtype.ByteWidth)
}

// Reserve ensures there is enough space for appending n elements
// by checking the capacity and calling Resize if necessary.
func (b *FixedSizeBinaryBuilder) Reserve(n int) {
	b.reserve(n, b.Resize)
}

// Resize adjusts the space allocated by b to n elements. If n is greater than b.Cap(),
// additional memory will be allocated. If n is smaller, the allocated memory may reduced.
func (b *FixedSizeBinaryBuilder) Resize(n int) {
	b.resize(n, b.init)
}

// NewArray creates a FixedSizeBinary array from the memory buffers used by the
// builder and resets the FixedSizeBinaryBuilder so it can be used to build a new array.
func (b *FixedSizeBinaryBuilder) NewArray() arrow.Array {
	return b.NewFixedSizeBinaryArray()
}

// NewFixedSizeBinaryArray creates a FixedSizeBinary array from the memory buffers used by the builder and resets the FixedSizeBinaryBuilder
// so it can be used to build a new array.
func (b *FixedSizeBinaryBuilder) NewFixedSizeBinaryArray() (a *FixedSizeBinary) {
	data := b.newData()
	a = NewFixedSizeBinaryData(data)
	data.Release()
	return
}

func (b *FixedSizeBinaryBuilder) newData() (data *Data) {
	values := b.values.Finish()
	data = NewData(b.dtype, b.length, []*memory.Buffer{b.nullBitmap, values}, nil, b.nulls, 0)

	if values != nil {
		values.Release()
	}

	b.reset()

	return
}

func (b *FixedSizeBinaryBuilder) AppendValueFromString(s string) error {
	if s == NullValueStr {
		b.AppendNull()
		return nil
	}

	data, err := base64.StdEncoding.DecodeString(s)
	if err != nil {
		b.AppendNull()
		return err
	}
	b.Append(data)
	return nil
}

func (b *FixedSizeBinaryBuilder) UnmarshalOne(dec *json.Decoder) error {
	t, err := dec.Token()
	if err != nil {
		return err
	}

	var val []byte
	switch v := t.(type) {
	case string:
		data, err := base64.StdEncoding.DecodeString(v)
		if err != nil {
			return err
		}
		val = data
	case []byte:
		val = v
	case nil:
		b.AppendNull()
		return nil
	default:
		return &json.UnmarshalTypeError{
			Value:  fmt.Sprint(t),
			Type:   reflect.TypeOf([]byte{}),
			Offset: dec.InputOffset(),
			Struct: fmt.Sprintf("FixedSizeBinary[%d]", b.dtype.ByteWidth),
		}
	}

	if len(val) != b.dtype.ByteWidth {
		return &json.UnmarshalTypeError{
			Value:  fmt.Sprint(string(val)),
			Type:   reflect.TypeOf([]byte{}),
			Offset: dec.InputOffset(),
			Struct: fmt.Sprintf("FixedSizeBinary[%d]", b.dtype.ByteWidth),
		}
	}
	b.Append(val)
	return nil
}

func (b *FixedSizeBinaryBuilder) Unmarshal(dec *json.Decoder) error {
	for dec.More() {
		if err := b.UnmarshalOne(dec); err != nil {
			return err
		}
	}
	return nil
}

func (b *FixedSizeBinaryBuilder) UnmarshalJSON(data []byte) error {
	dec := json.NewDecoder(bytes.NewReader(data))
	t, err := dec.Token()
	if err != nil {
		return err
	}

	if delim, ok := t.(json.Delim); !ok || delim != '[' {
		return fmt.Errorf("fixed size binary builder must unpack from json array, found %s", delim)
	}

	return b.Unmarshal(dec)
}

var _ Builder = (*FixedSizeBinaryBuilder)(nil)
