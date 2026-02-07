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

package extensions

import (
	"fmt"
	"reflect"
	"strconv"
	"strings"
	"unsafe"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/array"
	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/internal/json"
)

// Bool8Type represents a logical boolean that is stored using 8 bits.
type Bool8Type struct {
	arrow.ExtensionBase
}

// NewBool8Type creates a new Bool8Type with the underlying storage type set correctly to Int8.
func NewBool8Type() *Bool8Type {
	return &Bool8Type{ExtensionBase: arrow.ExtensionBase{Storage: arrow.PrimitiveTypes.Int8}}
}

func (b *Bool8Type) ArrayType() reflect.Type { return reflect.TypeOf(Bool8Array{}) }

func (b *Bool8Type) Deserialize(storageType arrow.DataType, data string) (arrow.ExtensionType, error) {
	if !arrow.TypeEqual(storageType, arrow.PrimitiveTypes.Int8) {
		return nil, fmt.Errorf("invalid storage type for Bool8Type: %s", storageType.Name())
	}
	return NewBool8Type(), nil
}

func (b *Bool8Type) ExtensionEquals(other arrow.ExtensionType) bool {
	return b.ExtensionName() == other.ExtensionName()
}

func (b *Bool8Type) ExtensionName() string { return "arrow.bool8" }

func (b *Bool8Type) Serialize() string { return "" }

func (b *Bool8Type) String() string { return fmt.Sprintf("extension<%s>", b.ExtensionName()) }

func (*Bool8Type) NewBuilder(mem memory.Allocator) array.Builder {
	return NewBool8Builder(mem)
}

// Bool8Array is logically an array of boolean values but uses
// 8 bits to store values instead of 1 bit as in the native BooleanArray.
type Bool8Array struct {
	array.ExtensionArrayBase
}

func (a *Bool8Array) String() string {
	var o strings.Builder
	o.WriteString("[")
	for i := 0; i < a.Len(); i++ {
		if i > 0 {
			o.WriteString(" ")
		}
		switch {
		case a.IsNull(i):
			o.WriteString(array.NullValueStr)
		default:
			fmt.Fprintf(&o, "%v", a.Value(i))
		}
	}
	o.WriteString("]")
	return o.String()
}

func (a *Bool8Array) Value(i int) bool {
	return a.Storage().(*array.Int8).Value(i) != 0
}

func (a *Bool8Array) BoolValues() []bool {
	int8s := a.Storage().(*array.Int8).Int8Values()
	return unsafe.Slice((*bool)(unsafe.Pointer(unsafe.SliceData(int8s))), len(int8s))
}

func (a *Bool8Array) ValueStr(i int) string {
	switch {
	case a.IsNull(i):
		return array.NullValueStr
	default:
		return fmt.Sprint(a.Value(i))
	}
}

func (a *Bool8Array) MarshalJSON() ([]byte, error) {
	values := make([]interface{}, a.Len())
	for i := 0; i < a.Len(); i++ {
		if a.IsValid(i) {
			values[i] = a.Value(i)
		}
	}
	return json.Marshal(values)
}

func (a *Bool8Array) GetOneForMarshal(i int) interface{} {
	if a.IsNull(i) {
		return nil
	}
	return a.Value(i)
}

// boolToInt8 performs the simple scalar conversion of bool to the canonical int8
// value for the Bool8Type.
func boolToInt8(v bool) int8 {
	var res int8
	if v {
		res = 1
	}
	return res
}

// Bool8Builder is a convenience builder for the Bool8 extension type,
// allowing arrays to be built with boolean values rather than the underlying storage type.
type Bool8Builder struct {
	*array.ExtensionBuilder
}

// NewBool8Builder creates a new Bool8Builder, exposing a convenient and efficient interface
// for writing boolean values to the underlying int8 storage array.
func NewBool8Builder(mem memory.Allocator) *Bool8Builder {
	return &Bool8Builder{ExtensionBuilder: array.NewExtensionBuilder(mem, NewBool8Type())}
}

func (b *Bool8Builder) Append(v bool) {
	b.ExtensionBuilder.Builder.(*array.Int8Builder).Append(boolToInt8(v))
}

func (b *Bool8Builder) UnsafeAppend(v bool) {
	b.ExtensionBuilder.Builder.(*array.Int8Builder).UnsafeAppend(boolToInt8(v))
}

func (b *Bool8Builder) AppendValueFromString(s string) error {
	if s == array.NullValueStr {
		b.AppendNull()
		return nil
	}

	val, err := strconv.ParseBool(s)
	if err != nil {
		return err
	}

	b.Append(val)
	return nil
}

func (b *Bool8Builder) AppendValues(v []bool, valid []bool) {
	boolsAsInt8s := unsafe.Slice((*int8)(unsafe.Pointer(unsafe.SliceData(v))), len(v))
	b.ExtensionBuilder.Builder.(*array.Int8Builder).AppendValues(boolsAsInt8s, valid)
}

func (b *Bool8Builder) UnmarshalOne(dec *json.Decoder) error {
	t, err := dec.Token()
	if err != nil {
		return err
	}

	switch v := t.(type) {
	case bool:
		b.Append(v)
		return nil
	case string:
		return b.AppendValueFromString(v)
	case int8:
		b.ExtensionBuilder.Builder.(*array.Int8Builder).Append(v)
		return nil
	case nil:
		b.AppendNull()
		return nil
	default:
		return &json.UnmarshalTypeError{
			Value:  fmt.Sprint(t),
			Type:   reflect.TypeOf([]byte{}),
			Offset: dec.InputOffset(),
			Struct: "Bool8Builder",
		}
	}
}

func (b *Bool8Builder) Unmarshal(dec *json.Decoder) error {
	for dec.More() {
		if err := b.UnmarshalOne(dec); err != nil {
			return err
		}
	}
	return nil
}

var (
	_ arrow.ExtensionType          = (*Bool8Type)(nil)
	_ array.CustomExtensionBuilder = (*Bool8Type)(nil)
	_ array.ExtensionArray         = (*Bool8Array)(nil)
	_ array.Builder                = (*Bool8Builder)(nil)
)
