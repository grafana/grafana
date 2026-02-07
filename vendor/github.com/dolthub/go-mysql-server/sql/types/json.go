// Copyright 2022 Dolthub, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package types

import (
	"context"
	"encoding/json"
	"reflect"

	"github.com/dolthub/vitess/go/sqltypes"
	"github.com/dolthub/vitess/go/vt/proto/query"
	"github.com/shopspring/decimal"

	"github.com/dolthub/go-mysql-server/sql"
)

var (
	jsonValueType = reflect.TypeOf((*sql.JSONWrapper)(nil)).Elem()

	MaxJsonFieldByteLength = int64(1024) * int64(1024) * int64(1024)
)

var JSON sql.Type = JsonType{}
var _ sql.CollationCoercible = JsonType{}

type JsonType struct{}

// Compare implements Type interface.
func (t JsonType) Compare(ctx context.Context, a interface{}, b interface{}) (int, error) {
	if hasNulls, res := CompareNulls(a, b); hasNulls {
		return res, nil
	}
	return CompareJSON(ctx, a, b)
}

// Convert implements Type interface.
func (t JsonType) Convert(c context.Context, v interface{}) (doc interface{}, inRange sql.ConvertInRange, err error) {
	switch v := v.(type) {
	case sql.JSONWrapper:
		return v, sql.InRange, nil
	case []byte:
		if int64(len(v)) > MaxJsonFieldByteLength {
			return nil, sql.InRange, ErrLengthTooLarge.New(len(v), MaxJsonFieldByteLength)
		}
		err = json.Unmarshal(v, &doc)
		if err != nil {
			return nil, sql.OutOfRange, sql.ErrInvalidJson.New(err.Error())
		}
	case string:
		charsetMaxLength := sql.Collation_Default.CharacterSet().MaxLength()
		length := int64(len(v)) * charsetMaxLength
		if length > MaxJsonFieldByteLength {
			return nil, sql.InRange, ErrLengthTooLarge.New(length, MaxJsonFieldByteLength)
		}
		err = json.Unmarshal([]byte(v), &doc)
		if err != nil {
			return nil, sql.OutOfRange, sql.ErrInvalidJson.New(err.Error())
		}
	case int8:
		return JSONDocument{Val: int64(v)}, sql.InRange, nil
	case int16:
		return JSONDocument{Val: int64(v)}, sql.InRange, nil
	case int32:
		return JSONDocument{Val: int64(v)}, sql.InRange, nil
	case int64:
		return JSONDocument{Val: v}, sql.InRange, nil
	case uint8:
		return JSONDocument{Val: uint64(v)}, sql.InRange, nil
	case uint16:
		return JSONDocument{Val: uint64(v)}, sql.InRange, nil
	case uint32:
		return JSONDocument{Val: uint64(v)}, sql.InRange, nil
	case uint64:
		return JSONDocument{Val: v}, sql.InRange, nil
	case float32:
		return JSONDocument{Val: float64(v)}, sql.InRange, nil
	case float64:
		return JSONDocument{Val: v}, sql.InRange, nil
	case decimal.Decimal:
		return JSONDocument{Val: v}, sql.InRange, nil
	default:
		// if |v| can be marshalled, it contains
		// a valid JSON document representation
		if b, berr := json.Marshal(v); berr == nil {
			if int64(len(b)) > MaxJsonFieldByteLength {
				return nil, sql.InRange, ErrLengthTooLarge.New(len(b), MaxJsonFieldByteLength)
			}
			err = json.Unmarshal(b, &doc)
			if err != nil {
				return nil, sql.OutOfRange, sql.ErrInvalidJson.New(err.Error())
			}
		}
	}
	if err != nil {
		return nil, sql.OutOfRange, err
	}
	return JSONDocument{Val: doc}, sql.InRange, nil
}

// Equals implements the Type interface.
func (t JsonType) Equals(otherType sql.Type) bool {
	_, ok := otherType.(JsonType)
	return ok
}

// MaxTextResponseByteLength implements the Type interface
func (t JsonType) MaxTextResponseByteLength(*sql.Context) uint32 {
	return uint32(MaxJsonFieldByteLength*sql.Collation_Default.CharacterSet().MaxLength()) - 1
}

// Promote implements the Type interface.
func (t JsonType) Promote() sql.Type {
	return t
}

// SQL implements Type interface.
func (t JsonType) SQL(ctx *sql.Context, dest []byte, v interface{}) (sqltypes.Value, error) {
	if v == nil {
		return sqltypes.NULL, nil
	}

	var val []byte

	// If we read the JSON from a table, pass through the bytes to avoid a deserialization and reserialization round-trip.
	// This is kind of a hack, and it means that reading JSON from tables no longer matches MySQL byte-for-byte.
	// But its worth it to avoid the round-trip, which can be very slow.
	if j, ok := v.(JSONBytes); ok {
		str, err := MarshallJson(ctx, j)
		if err != nil {
			return sqltypes.NULL, err
		}
		val = str
	} else {
		// Convert to jsonType
		jsVal, _, err := t.Convert(ctx, v)
		if err != nil {
			return sqltypes.NULL, err
		}
		js := jsVal.(sql.JSONWrapper)

		str, err := JsonToMySqlString(ctx, js)
		if err != nil {
			return sqltypes.NULL, err
		}
		val = AppendAndSliceString(dest, str)
	}

	return sqltypes.MakeTrusted(sqltypes.TypeJSON, val), nil
}

// String implements Type interface.
func (t JsonType) String() string {
	return "json"
}

// Type implements Type interface.
func (t JsonType) Type() query.Type {
	return sqltypes.TypeJSON
}

// ValueType implements Type interface.
func (t JsonType) ValueType() reflect.Type {
	return jsonValueType
}

// Zero implements Type interface.
func (t JsonType) Zero() interface{} {
	// MySQL throws an error for INSERT IGNORE, UPDATE IGNORE, etc. when bad json is encountered:
	// ERROR 3140 (22032): Invalid JSON text: "Invalid value." at position 0 in value for column 'table.column'.
	return nil
}

// CollationCoercibility implements sql.CollationCoercible interface.
func (JsonType) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_Default, 5
}

// DeepCopyJson implements deep copy of JSON document
func DeepCopyJson(v interface{}) interface{} {
	if v == nil {
		return nil
	}

	switch v.(type) {
	case map[string]interface{}:
		m := v.(map[string]interface{})
		newMap := make(map[string]interface{})
		for k, value := range m {
			newMap[k] = DeepCopyJson(value)
		}
		return newMap
	case []interface{}:
		arr := v.([]interface{})
		newArray := make([]interface{}, len(arr))
		for i, doc := range arr {
			newArray[i] = DeepCopyJson(doc)
		}
		return newArray
	case bool, string, float64, float32,
		int, int8, int16, int32, int64,
		uint, uint8, uint16, uint32, uint64:
		return v
	default:
		return nil
	}
}

func MustJSON(s string) JSONDocument {
	var doc interface{}
	if err := json.Unmarshal([]byte(s), &doc); err != nil {
		panic(err)
	}
	return JSONDocument{Val: doc}
}
