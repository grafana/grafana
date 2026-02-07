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
	"fmt"
	"reflect"
	"strconv"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/bitutil"
	"github.com/apache/arrow-go/v18/arrow/float16"
	"github.com/apache/arrow-go/v18/arrow/internal/debug"
	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/internal/json"
)

type Float16Builder struct {
	builder

	data    *memory.Buffer
	rawData []float16.Num
}

func NewFloat16Builder(mem memory.Allocator) *Float16Builder {
	fb := &Float16Builder{builder: builder{mem: mem}}
	fb.refCount.Add(1)
	return fb
}

func (b *Float16Builder) Type() arrow.DataType { return arrow.FixedWidthTypes.Float16 }

// Release decreases the reference count by 1.
// When the reference count goes to zero, the memory is freed.
func (b *Float16Builder) Release() {
	debug.Assert(b.refCount.Load() > 0, "too many releases")

	if b.refCount.Add(-1) == 0 {
		if b.nullBitmap != nil {
			b.nullBitmap.Release()
			b.nullBitmap = nil
		}
		if b.data != nil {
			b.data.Release()
			b.data = nil
			b.rawData = nil
		}
	}
}

func (b *Float16Builder) Append(v float16.Num) {
	b.Reserve(1)
	b.UnsafeAppend(v)
}

func (b *Float16Builder) UnsafeAppend(v float16.Num) {
	bitutil.SetBit(b.nullBitmap.Bytes(), b.length)
	b.rawData[b.length] = v
	b.length++
}

func (b *Float16Builder) AppendNull() {
	b.Reserve(1)
	b.UnsafeAppendBoolToBitmap(false)
}

func (b *Float16Builder) AppendNulls(n int) {
	for i := 0; i < n; i++ {
		b.AppendNull()
	}
}

func (b *Float16Builder) AppendEmptyValue() {
	b.Reserve(1)
	b.UnsafeAppend(float16.Num{})
}

func (b *Float16Builder) AppendEmptyValues(n int) {
	for i := 0; i < n; i++ {
		b.AppendEmptyValue()
	}
}

func (b *Float16Builder) UnsafeAppendBoolToBitmap(isValid bool) {
	if isValid {
		bitutil.SetBit(b.nullBitmap.Bytes(), b.length)
	} else {
		b.nulls++
	}
	b.length++
}

// AppendValues will append the values in the v slice. The valid slice determines which values
// in v are valid (not null). The valid slice must either be empty or be equal in length to v. If empty,
// all values in v are appended and considered valid.
func (b *Float16Builder) AppendValues(v []float16.Num, valid []bool) {
	if len(v) != len(valid) && len(valid) != 0 {
		panic("len(v) != len(valid) && len(valid) != 0")
	}

	if len(v) == 0 {
		return
	}

	b.Reserve(len(v))
	if len(v) > 0 {
		arrow.Float16Traits.Copy(b.rawData[b.length:], v)
	}
	b.unsafeAppendBoolsToBitmap(valid, len(v))
}

func (b *Float16Builder) init(capacity int) {
	b.builder.init(capacity)

	b.data = memory.NewResizableBuffer(b.mem)
	bytesN := arrow.Uint16Traits.BytesRequired(capacity)
	b.data.Resize(bytesN)
	b.rawData = arrow.Float16Traits.CastFromBytes(b.data.Bytes())
}

// Reserve ensures there is enough space for appending n elements
// by checking the capacity and calling Resize if necessary.
func (b *Float16Builder) Reserve(n int) {
	b.reserve(n, b.Resize)
}

// Resize adjusts the space allocated by b to n elements. If n is greater than b.Cap(),
// additional memory will be allocated. If n is smaller, the allocated memory may reduced.
func (b *Float16Builder) Resize(n int) {
	nBuilder := n
	if n < minBuilderCapacity {
		n = minBuilderCapacity
	}

	if b.capacity == 0 {
		b.init(n)
	} else {
		b.resize(nBuilder, b.init)
		b.data.Resize(arrow.Float16Traits.BytesRequired(n))
		b.rawData = arrow.Float16Traits.CastFromBytes(b.data.Bytes())
	}
}

// NewArray creates a Float16 array from the memory buffers used by the builder and resets the Float16Builder
// so it can be used to build a new array.
func (b *Float16Builder) NewArray() arrow.Array {
	return b.NewFloat16Array()
}

// NewFloat16Array creates a Float16 array from the memory buffers used by the builder and resets the Float16Builder
// so it can be used to build a new array.
func (b *Float16Builder) NewFloat16Array() (a *Float16) {
	data := b.newData()
	a = NewFloat16Data(data)
	data.Release()
	return
}

func (b *Float16Builder) newData() (data *Data) {
	bytesRequired := arrow.Float16Traits.BytesRequired(b.length)
	if bytesRequired > 0 && bytesRequired < b.data.Len() {
		// trim buffers
		b.data.Resize(bytesRequired)
	}
	data = NewData(arrow.FixedWidthTypes.Float16, b.length, []*memory.Buffer{b.nullBitmap, b.data}, nil, b.nulls, 0)
	b.reset()

	if b.data != nil {
		b.data.Release()
		b.data = nil
		b.rawData = nil
	}

	return
}

func (b *Float16Builder) AppendValueFromString(s string) error {
	if s == NullValueStr {
		b.AppendNull()
		return nil
	}
	v, err := strconv.ParseFloat(s, 32)
	if err != nil {
		b.AppendNull()
		return err
	}
	b.Append(float16.New(float32(v)))
	return nil
}

func (b *Float16Builder) UnmarshalOne(dec *json.Decoder) error {
	t, err := dec.Token()
	if err != nil {
		return err
	}

	switch v := t.(type) {
	case float64:
		b.Append(float16.New(float32(v)))
	case string:
		f, err := strconv.ParseFloat(v, 32)
		if err != nil {
			return err
		}
		// this will currently silently truncate if it is too large
		b.Append(float16.New(float32(f)))
	case json.Number:
		f, err := v.Float64()
		if err != nil {
			return err
		}
		b.Append(float16.New(float32(f)))
	case nil:
		b.AppendNull()
	default:
		return &json.UnmarshalTypeError{
			Value:  fmt.Sprint(t),
			Type:   reflect.TypeOf(float16.Num{}),
			Offset: dec.InputOffset(),
		}
	}
	return nil
}

func (b *Float16Builder) Unmarshal(dec *json.Decoder) error {
	for dec.More() {
		if err := b.UnmarshalOne(dec); err != nil {
			return err
		}
	}
	return nil
}

// UnmarshalJSON will add values to this builder from unmarshalling the
// array of values. Currently values that are larger than a float16 will
// be silently truncated.
func (b *Float16Builder) UnmarshalJSON(data []byte) error {
	dec := json.NewDecoder(bytes.NewReader(data))
	t, err := dec.Token()
	if err != nil {
		return err
	}

	if delim, ok := t.(json.Delim); !ok || delim != '[' {
		return fmt.Errorf("float16 builder must unpack from json array, found %s", delim)
	}

	return b.Unmarshal(dec)
}
