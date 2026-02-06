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
	"strings"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/internal/debug"
	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/internal/json"
)

// Null represents an immutable, degenerate array with no physical storage.
type Null struct {
	array
}

// NewNull returns a new Null array value of size n.
func NewNull(n int) *Null {
	a := &Null{}
	a.refCount.Add(1)
	data := NewData(
		arrow.Null, n,
		[]*memory.Buffer{nil},
		nil,
		n,
		0,
	)
	a.setData(data)
	data.Release()
	return a
}

// NewNullData returns a new Null array value, from data.
func NewNullData(data arrow.ArrayData) *Null {
	a := &Null{}
	a.refCount.Add(1)
	a.setData(data.(*Data))
	return a
}

func (a *Null) ValueStr(int) string { return NullValueStr }

func (a *Null) Value(int) interface{} { return nil }

func (a *Null) String() string {
	o := new(strings.Builder)
	o.WriteString("[")
	for i := 0; i < a.Len(); i++ {
		if i > 0 {
			o.WriteString(" ")
		}
		o.WriteString(NullValueStr)
	}
	o.WriteString("]")
	return o.String()
}

func (a *Null) setData(data *Data) {
	a.array.setData(data)
	a.nullBitmapBytes = nil
	a.data.nulls = a.data.length
}

func (a *Null) GetOneForMarshal(i int) interface{} {
	return nil
}

func (a *Null) MarshalJSON() ([]byte, error) {
	return json.Marshal(make([]interface{}, a.Len()))
}

type NullBuilder struct {
	builder
}

// NewNullBuilder returns a builder, using the provided memory allocator.
func NewNullBuilder(mem memory.Allocator) *NullBuilder {
	nb := &NullBuilder{builder: builder{mem: mem}}
	nb.refCount.Add(1)
	return nb
}

func (b *NullBuilder) Type() arrow.DataType { return arrow.Null }

// Release decreases the reference count by 1.
// When the reference count goes to zero, the memory is freed.
func (b *NullBuilder) Release() {
	debug.Assert(b.refCount.Load() > 0, "too many releases")

	if b.refCount.Add(-1) == 0 {
		if b.nullBitmap != nil {
			b.nullBitmap.Release()
			b.nullBitmap = nil
		}
	}
}

func (b *NullBuilder) AppendNull() {
	b.length++
	b.nulls++
}

func (b *NullBuilder) AppendNulls(n int) {
	for i := 0; i < n; i++ {
		b.AppendNull()
	}
}

func (b *NullBuilder) AppendValueFromString(s string) error {
	if s == NullValueStr {
		b.AppendNull()
		return nil
	}
	return fmt.Errorf("cannot convert %q to null", s)
}

func (b *NullBuilder) AppendEmptyValue() { b.AppendNull() }

func (b *NullBuilder) AppendEmptyValues(n int) { b.AppendNulls(n) }

func (*NullBuilder) Reserve(size int) {}
func (*NullBuilder) Resize(size int)  {}

func (*NullBuilder) init(cap int)                       {}
func (*NullBuilder) resize(newBits int, init func(int)) {}

// NewArray creates a Null array from the memory buffers used by the builder and resets the NullBuilder
// so it can be used to build a new array.
func (b *NullBuilder) NewArray() arrow.Array {
	return b.NewNullArray()
}

// NewNullArray creates a Null array from the memory buffers used by the builder and resets the NullBuilder
// so it can be used to build a new array.
func (b *NullBuilder) NewNullArray() (a *Null) {
	data := b.newData()
	a = NewNullData(data)
	data.Release()
	return
}

func (b *NullBuilder) newData() (data *Data) {
	data = NewData(
		arrow.Null, b.length,
		[]*memory.Buffer{nil},
		nil,
		b.nulls,
		0,
	)
	b.reset()

	return
}

func (b *NullBuilder) UnmarshalOne(dec *json.Decoder) error {
	t, err := dec.Token()
	if err != nil {
		return err
	}

	switch t.(type) {
	case nil:
		b.AppendNull()
	default:
		return &json.UnmarshalTypeError{
			Value:  fmt.Sprint(t),
			Type:   reflect.TypeOf(nil),
			Offset: dec.InputOffset(),
		}
	}
	return nil
}

func (b *NullBuilder) Unmarshal(dec *json.Decoder) error {
	for dec.More() {
		if err := b.UnmarshalOne(dec); err != nil {
			return err
		}
	}
	return nil
}

func (b *NullBuilder) UnmarshalJSON(data []byte) error {
	dec := json.NewDecoder(bytes.NewReader(data))
	t, err := dec.Token()
	if err != nil {
		return err
	}

	if delim, ok := t.(json.Delim); !ok || delim != '[' {
		return fmt.Errorf("null builder must unpack from json array, found %s", delim)
	}

	return b.Unmarshal(dec)
}

var (
	_ arrow.Array = (*Null)(nil)
	_ Builder     = (*NullBuilder)(nil)
)
