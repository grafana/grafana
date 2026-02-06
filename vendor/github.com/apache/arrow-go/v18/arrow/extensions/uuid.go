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
	"bytes"
	"fmt"
	"reflect"
	"strings"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/array"
	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/internal/json"
	"github.com/apache/arrow-go/v18/parquet/schema"
	"github.com/google/uuid"
)

type UUIDBuilder struct {
	*array.ExtensionBuilder
}

// NewUUIDBuilder creates a new UUIDBuilder, exposing a convenient and efficient interface
// for writing uuid.UUID (or [16]byte) values to the underlying FixedSizeBinary storage array.
func NewUUIDBuilder(mem memory.Allocator) *UUIDBuilder {
	return &UUIDBuilder{ExtensionBuilder: array.NewExtensionBuilder(mem, NewUUIDType())}
}

func (b *UUIDBuilder) Append(v uuid.UUID) {
	b.AppendBytes(v)
}

func (b *UUIDBuilder) AppendBytes(v [16]byte) {
	b.ExtensionBuilder.Builder.(*array.FixedSizeBinaryBuilder).Append(v[:])
}

func (b *UUIDBuilder) UnsafeAppend(v uuid.UUID) {
	b.ExtensionBuilder.Builder.(*array.FixedSizeBinaryBuilder).UnsafeAppend(v[:])
}

func (b *UUIDBuilder) AppendValueFromString(s string) error {
	if s == array.NullValueStr {
		b.AppendNull()
		return nil
	}

	uid, err := uuid.Parse(s)
	if err != nil {
		return err
	}

	b.Append(uid)
	return nil
}

func (b *UUIDBuilder) AppendValues(v []uuid.UUID, valid []bool) {
	if len(v) != len(valid) && len(valid) != 0 {
		panic("len(v) != len(valid) && len(valid) != 0")
	}

	data := make([][]byte, len(v))
	for i := range v {
		if len(valid) > 0 && !valid[i] {
			continue
		}
		data[i] = v[i][:]
	}
	b.ExtensionBuilder.Builder.(*array.FixedSizeBinaryBuilder).AppendValues(data, valid)
}

func (b *UUIDBuilder) UnmarshalOne(dec *json.Decoder) error {
	t, err := dec.Token()
	if err != nil {
		return err
	}

	var val uuid.UUID
	switch v := t.(type) {
	case string:
		val, err = uuid.Parse(v)
		if err != nil {
			return err
		}
	case []byte:
		val, err = uuid.ParseBytes(v)
		if err != nil {
			return err
		}
	case nil:
		b.AppendNull()
		return nil
	default:
		return &json.UnmarshalTypeError{
			Value:  fmt.Sprint(t),
			Type:   reflect.TypeOf([]byte{}),
			Offset: dec.InputOffset(),
			Struct: fmt.Sprintf("FixedSizeBinary[%d]", 16),
		}
	}

	b.Append(val)
	return nil
}

func (b *UUIDBuilder) Unmarshal(dec *json.Decoder) error {
	for dec.More() {
		if err := b.UnmarshalOne(dec); err != nil {
			return err
		}
	}
	return nil
}

func (b *UUIDBuilder) UnmarshalJSON(data []byte) error {
	dec := json.NewDecoder(bytes.NewReader(data))
	t, err := dec.Token()
	if err != nil {
		return err
	}

	if delim, ok := t.(json.Delim); !ok || delim != '[' {
		return fmt.Errorf("uuid builder must unpack from json array, found %s", delim)
	}

	return b.Unmarshal(dec)
}

// UUIDArray is a simple array which is a FixedSizeBinary(16)
type UUIDArray struct {
	array.ExtensionArrayBase
}

func (a *UUIDArray) String() string {
	arr := a.Storage().(*array.FixedSizeBinary)
	o := new(strings.Builder)
	o.WriteString("[")
	for i := 0; i < arr.Len(); i++ {
		if i > 0 {
			o.WriteString(" ")
		}
		switch {
		case a.IsNull(i):
			o.WriteString(array.NullValueStr)
		default:
			fmt.Fprintf(o, "%q", a.Value(i))
		}
	}
	o.WriteString("]")
	return o.String()
}

func (a *UUIDArray) Value(i int) uuid.UUID {
	if a.IsNull(i) {
		return uuid.Nil
	}
	return uuid.Must(uuid.FromBytes(a.Storage().(*array.FixedSizeBinary).Value(i)))
}

func (a *UUIDArray) Values() []uuid.UUID {
	values := make([]uuid.UUID, a.Len())
	for i := range values {
		values[i] = a.Value(i)
	}
	return values
}

func (a *UUIDArray) ValueStr(i int) string {
	switch {
	case a.IsNull(i):
		return array.NullValueStr
	default:
		return a.Value(i).String()
	}
}

func (a *UUIDArray) MarshalJSON() ([]byte, error) {
	vals := make([]any, a.Len())
	for i := range vals {
		vals[i] = a.GetOneForMarshal(i)
	}
	return json.Marshal(vals)
}

func (a *UUIDArray) GetOneForMarshal(i int) interface{} {
	if a.IsValid(i) {
		return a.Value(i)
	}
	return nil
}

// UUIDType is a simple extension type that represents a FixedSizeBinary(16)
// to be used for representing UUIDs
type UUIDType struct {
	arrow.ExtensionBase
}

// ParquetLogicalType implements pqarrow.ExtensionCustomParquetType.
func (e *UUIDType) ParquetLogicalType() schema.LogicalType {
	return schema.UUIDLogicalType{}
}

// NewUUIDType is a convenience function to create an instance of UUIDType
// with the correct storage type
func NewUUIDType() *UUIDType {
	return &UUIDType{ExtensionBase: arrow.ExtensionBase{Storage: &arrow.FixedSizeBinaryType{ByteWidth: 16}}}
}

// ArrayType returns TypeOf(UUIDArray{}) for constructing UUID arrays
func (*UUIDType) ArrayType() reflect.Type {
	return reflect.TypeOf(UUIDArray{})
}

func (*UUIDType) ExtensionName() string {
	return "arrow.uuid"
}

func (*UUIDType) Bytes() int    { return 16 }
func (*UUIDType) BitWidth() int { return 128 }

func (e *UUIDType) String() string {
	return fmt.Sprintf("extension<%s>", e.ExtensionName())
}

func (e *UUIDType) MarshalJSON() ([]byte, error) {
	return []byte(fmt.Sprintf(`{"name":"%s","metadata":%s}`, e.ExtensionName(), e.Serialize())), nil
}

func (*UUIDType) Serialize() string {
	return ""
}

// Deserialize expects storageType to be FixedSizeBinaryType{ByteWidth: 16}
func (*UUIDType) Deserialize(storageType arrow.DataType, data string) (arrow.ExtensionType, error) {
	if !arrow.TypeEqual(storageType, &arrow.FixedSizeBinaryType{ByteWidth: 16}) {
		return nil, fmt.Errorf("invalid storage type for UUIDType: %s", storageType.Name())
	}
	return NewUUIDType(), nil
}

// ExtensionEquals returns true if both extensions have the same name
func (e *UUIDType) ExtensionEquals(other arrow.ExtensionType) bool {
	return e.ExtensionName() == other.ExtensionName()
}

func (*UUIDType) NewBuilder(mem memory.Allocator) array.Builder {
	return NewUUIDBuilder(mem)
}

var (
	_ arrow.ExtensionType          = (*UUIDType)(nil)
	_ array.CustomExtensionBuilder = (*UUIDType)(nil)
	_ array.ExtensionArray         = (*UUIDArray)(nil)
	_ array.Builder                = (*UUIDBuilder)(nil)

	_ arrow.FixedWidthDataType = (*UUIDType)(nil)
)
