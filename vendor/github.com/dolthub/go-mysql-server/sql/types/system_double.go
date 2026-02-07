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
	"strconv"

	"github.com/dolthub/vitess/go/sqltypes"
	"github.com/dolthub/vitess/go/vt/proto/query"
	"github.com/shopspring/decimal"

	"github.com/dolthub/go-mysql-server/sql"
)

var systemDoubleValueType = reflect.TypeOf(float64(0))

// systemDoubleType is an internal double type ONLY for system variables.
type systemDoubleType struct {
	varName    string
	lowerbound float64
	upperbound float64
}

var _ sql.SystemVariableType = systemDoubleType{}
var _ sql.CollationCoercible = systemDoubleType{}

// NewSystemDoubleType returns a new systemDoubleType.
func NewSystemDoubleType(varName string, lowerbound, upperbound float64) sql.SystemVariableType {
	return systemDoubleType{varName, lowerbound, upperbound}
}

// Compare implements Type interface.
func (t systemDoubleType) Compare(ctx context.Context, a interface{}, b interface{}) (int, error) {
	as, _, err := t.Convert(ctx, a)
	if err != nil {
		return 0, err
	}
	bs, _, err := t.Convert(ctx, b)
	if err != nil {
		return 0, err
	}
	ai := as.(float64)
	bi := bs.(float64)

	if ai == bi {
		return 0, nil
	}
	if ai < bi {
		return -1, nil
	}
	return 1, nil
}

// Convert implements Type interface.
func (t systemDoubleType) Convert(ctx context.Context, v interface{}) (interface{}, sql.ConvertInRange, error) {
	// String nor nil values are accepted
	switch value := v.(type) {
	case int:
		return t.Convert(ctx, float64(value))
	case uint:
		return t.Convert(ctx, float64(value))
	case int8:
		return t.Convert(ctx, float64(value))
	case uint8:
		return t.Convert(ctx, float64(value))
	case int16:
		return t.Convert(ctx, float64(value))
	case uint16:
		return t.Convert(ctx, float64(value))
	case int32:
		return t.Convert(ctx, float64(value))
	case uint32:
		return t.Convert(ctx, float64(value))
	case int64:
		return t.Convert(ctx, float64(value))
	case uint64:
		return t.Convert(ctx, float64(value))
	case float32:
		return t.Convert(ctx, float64(value))
	case float64:
		if value >= t.lowerbound && value <= t.upperbound {
			return value, sql.InRange, nil
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
		f, err := strconv.ParseFloat(value, 64)
		if err == nil {
			return t.Convert(ctx, f)
		}
	}

	return nil, sql.OutOfRange, sql.ErrInvalidSystemVariableValue.New(t.varName, v)
}

// Equals implements the Type interface.
func (t systemDoubleType) Equals(otherType sql.Type) bool {
	if ot, ok := otherType.(systemDoubleType); ok {
		return t.varName == ot.varName && t.lowerbound == ot.lowerbound && t.upperbound == ot.upperbound
	}
	return false
}

// MaxTextResponseByteLength implements the Type interface
func (t systemDoubleType) MaxTextResponseByteLength(ctx *sql.Context) uint32 {
	return t.UnderlyingType().MaxTextResponseByteLength(ctx)
}

// Promote implements the Type interface.
func (t systemDoubleType) Promote() sql.Type {
	return t
}

// SQL implements Type interface.
func (t systemDoubleType) SQL(ctx *sql.Context, dest []byte, v interface{}) (sqltypes.Value, error) {
	if v == nil {
		return sqltypes.NULL, nil
	}

	v, _, err := t.Convert(ctx, v)
	if err != nil {
		return sqltypes.Value{}, err
	}

	stop := len(dest)
	dest = strconv.AppendFloat(dest, v.(float64), 'f', -1, 64)
	val := dest[stop:]

	return sqltypes.MakeTrusted(t.Type(), val), nil
}

// String implements Type interface.
func (t systemDoubleType) String() string {
	return "system_double"
}

// Type implements Type interface.
func (t systemDoubleType) Type() query.Type {
	return sqltypes.Float64
}

// ValueType implements Type interface.
func (t systemDoubleType) ValueType() reflect.Type {
	return systemDoubleValueType
}

// Zero implements Type interface.
func (t systemDoubleType) Zero() interface{} {
	return float64(0)
}

// CollationCoercibility implements sql.CollationCoercible interface.
func (systemDoubleType) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// EncodeValue implements SystemVariableType interface.
func (t systemDoubleType) EncodeValue(val interface{}) (string, error) {
	expectedVal, ok := val.(float64)
	if !ok {
		return "", sql.ErrSystemVariableCodeFail.New(val, t.String())
	}
	return strconv.FormatFloat(expectedVal, 'f', -1, 64), nil
}

// DecodeValue implements SystemVariableType interface.
func (t systemDoubleType) DecodeValue(val string) (interface{}, error) {
	parsedVal, err := strconv.ParseFloat(val, 64)
	if err != nil {
		return nil, err
	}
	if parsedVal >= t.lowerbound && parsedVal <= t.upperbound {
		return parsedVal, nil
	}
	return nil, sql.ErrSystemVariableCodeFail.New(val, t.String())
}

func (t systemDoubleType) UnderlyingType() sql.Type {
	return Float64
}
