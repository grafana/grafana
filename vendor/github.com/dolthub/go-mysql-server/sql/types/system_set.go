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
	"reflect"

	"github.com/dolthub/vitess/go/sqltypes"
	"github.com/dolthub/vitess/go/vt/proto/query"
	"github.com/shopspring/decimal"

	"github.com/dolthub/go-mysql-server/sql"
)

// systemSetType is an internal set type ONLY for system variables.
type systemSetType struct {
	sql.SetType
	varName string
}

var _ sql.SystemVariableType = systemSetType{}
var _ sql.CollationCoercible = systemSetType{}

// NewSystemSetType returns a new systemSetType.
func NewSystemSetType(varName string, collation sql.CollationID, values ...string) sql.SystemVariableType {
	return systemSetType{MustCreateSetType(values, collation), varName}
}

// Compare implements Type interface.
func (t systemSetType) Compare(ctx context.Context, a interface{}, b interface{}) (int, error) {
	if a == nil || b == nil {
		return 0, sql.ErrInvalidSystemVariableValue.New(t.varName, nil)
	}
	ai, _, err := t.Convert(ctx, a)
	if err != nil {
		return 0, err
	}
	bi, _, err := t.Convert(ctx, b)
	if err != nil {
		return 0, err
	}
	au := ai.(uint64)
	bu := bi.(uint64)

	if au == bu {
		return 0, nil
	}
	if au < bu {
		return -1, nil
	}
	return 1, nil
}

// Convert implements Type interface.
func (t systemSetType) Convert(ctx context.Context, v interface{}) (interface{}, sql.ConvertInRange, error) {
	// Nil values are not accepted
	switch value := v.(type) {
	case int:
		return t.SetType.Convert(ctx, value)
	case uint:
		return t.SetType.Convert(ctx, value)
	case int8:
		return t.SetType.Convert(ctx, value)
	case uint8:
		return t.SetType.Convert(ctx, value)
	case int16:
		return t.SetType.Convert(ctx, value)
	case uint16:
		return t.SetType.Convert(ctx, value)
	case int32:
		return t.SetType.Convert(ctx, value)
	case uint32:
		return t.SetType.Convert(ctx, value)
	case int64:
		return t.SetType.Convert(ctx, value)
	case uint64:
		return t.SetType.Convert(ctx, value)
	case float32:
		return t.Convert(ctx, float64(value))
	case float64:
		// Float values aren't truly accepted, but the engine will give them when it should give ints.
		// Therefore, if the float doesn't have a fractional portion, we treat it as an int.
		if value == float64(int64(value)) {
			return t.SetType.Convert(ctx, int64(value))
		}
	case decimal.Decimal:
		f, _ := value.Float64()
		return t.Convert(ctx, f)
	case decimal.NullDecimal:
		if value.Valid {
			f, _ := value.Decimal.Float64()
			return t.Convert(ctx, f)
		}
	case string:
		return t.SetType.Convert(ctx, value)
	}

	return nil, sql.OutOfRange, sql.ErrInvalidSystemVariableValue.New(t.varName, v)
}

// Equals implements the Type interface.
func (t systemSetType) Equals(otherType sql.Type) bool {
	if ot, ok := otherType.(systemSetType); ok {
		return t.varName == ot.varName && t.SetType.Equals(ot.SetType)
	}
	return false
}

// MaxTextResponseByteLength implements the Type interface
func (t systemSetType) MaxTextResponseByteLength(ctx *sql.Context) uint32 {
	return t.UnderlyingType().MaxTextResponseByteLength(ctx)
}

// Promote implements the Type interface.
func (t systemSetType) Promote() sql.Type {
	return t
}

// SQL implements Type interface.
func (t systemSetType) SQL(ctx *sql.Context, dest []byte, v interface{}) (sqltypes.Value, error) {
	if v == nil {
		return sqltypes.NULL, nil
	}
	convertedValue, _, err := t.Convert(ctx, v)
	if err != nil {
		return sqltypes.Value{}, err
	}
	value, err := t.BitsToString(convertedValue.(uint64))
	if err != nil {
		return sqltypes.Value{}, err
	}

	val := AppendAndSliceString(dest, value)

	return sqltypes.MakeTrusted(t.Type(), val), nil
}

// String implements Type interface.
func (t systemSetType) String() string {
	return "system_set"
}

// Type implements Type interface.
func (t systemSetType) Type() query.Type {
	return sqltypes.VarChar
}

// ValueType implements Type interface.
func (t systemSetType) ValueType() reflect.Type {
	return t.SetType.ValueType()
}

// Zero implements Type interface.
func (t systemSetType) Zero() interface{} {
	return ""
}

// CollationCoercibility implements sql.CollationCoercible interface.
func (systemSetType) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_utf8mb3_general_ci, 3
}

// EncodeValue implements SystemVariableType interface.
func (t systemSetType) EncodeValue(val interface{}) (string, error) {
	expectedVal, ok := val.(uint64)
	if !ok {
		return "", sql.ErrSystemVariableCodeFail.New(val, t.String())
	}
	return t.BitsToString(expectedVal)
}

// DecodeValue implements SystemVariableType interface.
func (t systemSetType) DecodeValue(val string) (interface{}, error) {
	outVal, _, err := t.Convert(context.Background(), val)
	if err != nil {
		return nil, sql.ErrSystemVariableCodeFail.New(val, t.String())
	}
	return outVal, nil
}

func (t systemSetType) UnderlyingType() sql.Type {
	return t.SetType
}
