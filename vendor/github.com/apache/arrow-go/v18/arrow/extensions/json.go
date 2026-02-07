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
	"slices"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/array"
	"github.com/apache/arrow-go/v18/internal/json"
	"github.com/apache/arrow-go/v18/parquet/schema"
)

var jsonSupportedStorageTypes = []arrow.DataType{
	arrow.BinaryTypes.String,
	arrow.BinaryTypes.LargeString,
	arrow.BinaryTypes.StringView,
}

// JSONType represents a UTF-8 encoded JSON string as specified in RFC8259.
type JSONType struct {
	arrow.ExtensionBase
}

// ParquetLogicalType implements pqarrow.ExtensionCustomParquetType.
func (b *JSONType) ParquetLogicalType() schema.LogicalType {
	return schema.JSONLogicalType{}
}

// NewJSONType creates a new JSONType with the specified storage type.
// storageType must be one of String, LargeString, StringView.
func NewJSONType(storageType arrow.DataType) (*JSONType, error) {
	if !slices.Contains(jsonSupportedStorageTypes, storageType) {
		return nil, fmt.Errorf("unsupported storage type for JSON extension type: %s", storageType)
	}
	return &JSONType{ExtensionBase: arrow.ExtensionBase{Storage: storageType}}, nil
}

func (b *JSONType) ArrayType() reflect.Type { return reflect.TypeOf(JSONArray{}) }

func (b *JSONType) Deserialize(storageType arrow.DataType, data string) (arrow.ExtensionType, error) {
	if data != "" && data != "{}" {
		return nil, fmt.Errorf("serialized metadata for JSON extension type must be '' or '{}', found: %s", data)
	}
	return NewJSONType(storageType)
}

func (b *JSONType) ExtensionEquals(other arrow.ExtensionType) bool {
	return b.ExtensionName() == other.ExtensionName() && arrow.TypeEqual(b.Storage, other.StorageType())
}

func (b *JSONType) ExtensionName() string { return "arrow.json" }

func (b *JSONType) Serialize() string { return "" }

func (b *JSONType) String() string {
	return fmt.Sprintf("extension<%s[storage_type=%s]>", b.ExtensionName(), b.Storage)
}

// JSONArray is logically an array of UTF-8 encoded JSON strings.
// Its values are unmarshaled to native Go values.
type JSONArray struct {
	array.ExtensionArrayBase
}

func (a *JSONArray) String() string {
	b, err := a.MarshalJSON()
	if err != nil {
		panic(fmt.Sprintf("failed marshal JSONArray: %s", err))
	}

	return string(b)
}

func (a *JSONArray) Value(i int) any {
	val := a.ValueBytes(i)

	var res any
	if err := json.Unmarshal(val, &res); err != nil {
		panic(err)
	}

	return res
}

func (a *JSONArray) ValueStr(i int) string {
	return string(a.ValueBytes(i))
}

func (a *JSONArray) ValueBytes(i int) []byte {
	// convert to json.RawMessage, set to nil if elem isNull.
	val := a.ValueJSON(i)

	// simply returns wrapped bytes, or null if val is nil.
	b, err := val.MarshalJSON()
	if err != nil {
		panic(err)
	}

	return b
}

// ValueJSON wraps the underlying string value as a json.RawMessage,
// or returns nil if the array value is null.
func (a *JSONArray) ValueJSON(i int) json.RawMessage {
	var val json.RawMessage
	if a.IsValid(i) {
		val = json.RawMessage(a.Storage().(array.StringLike).Value(i))
	}
	return val
}

// MarshalJSON implements json.Marshaler.
// Marshaling json.RawMessage is a no-op, except that nil values will
// be marshaled as a JSON null.
func (a *JSONArray) MarshalJSON() ([]byte, error) {
	values := make([]json.RawMessage, a.Len())
	for i := 0; i < a.Len(); i++ {
		values[i] = a.ValueJSON(i)
	}
	return json.Marshal(values)
}

// GetOneForMarshal implements arrow.Array.
func (a *JSONArray) GetOneForMarshal(i int) interface{} {
	return a.ValueJSON(i)
}

var (
	_ arrow.ExtensionType  = (*JSONType)(nil)
	_ array.ExtensionArray = (*JSONArray)(nil)
)
