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

var systemIntValueType = reflect.TypeOf(int64(0))

// systemIntType is an internal integer type ONLY for system variables.
type systemIntType struct {
	varName     string
	lowerbound  int64
	upperbound  int64
	negativeOne bool
}

var _ sql.SystemVariableType = systemIntType{}
var _ sql.CollationCoercible = systemIntType{}

// NewSystemIntType returns a new systemIntType.
func NewSystemIntType(varName string, lowerbound, upperbound int64, negativeOne bool) sql.SystemVariableType {
	return systemIntType{varName, lowerbound, upperbound, negativeOne}
}

// Compare implements Type interface.
func (t systemIntType) Compare(ctx context.Context, a interface{}, b interface{}) (int, error) {
	as, _, err := t.Convert(ctx, a)
	if err != nil {
		return 0, err
	}
	bs, _, err := t.Convert(ctx, b)
	if err != nil {
		return 0, err
	}
	ai := as.(int64)
	bi := bs.(int64)

	if ai == bi {
		return 0, nil
	}
	if ai < bi {
		return -1, nil
	}
	return 1, nil
}

// Convert implements Type interface.
func (t systemIntType) Convert(ctx context.Context, v interface{}) (interface{}, sql.ConvertInRange, error) {
	// String nor nil values are accepted
	switch value := v.(type) {
	case int:
		return t.Convert(ctx, int64(value))
	case uint:
		return t.Convert(ctx, int64(value))
	case int8:
		return t.Convert(ctx, int64(value))
	case uint8:
		return t.Convert(ctx, int64(value))
	case int16:
		return t.Convert(ctx, int64(value))
	case uint16:
		return t.Convert(ctx, int64(value))
	case int32:
		return t.Convert(ctx, int64(value))
	case uint32:
		return t.Convert(ctx, int64(value))
	case int64:
		if value >= t.lowerbound && value <= t.upperbound {
			return value, sql.InRange, nil
		}
		if t.negativeOne && value == -1 {
			return value, sql.InRange, nil
		}
	case uint64:
		return t.Convert(ctx, int64(value))
	case float32:
		return t.Convert(ctx, float64(value))
	case float64:
		// Float values aren't truly accepted, but the engine will give them when it should give ints.
		// Therefore, if the float doesn't have a fractional portion, we treat it as an int.
		if value == float64(int64(value)) {
			return t.Convert(ctx, int64(value))
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
		// try getting int out of string value
		i, err := strconv.ParseInt(value, 10, 64)
		if err != nil {
			return nil, sql.OutOfRange, sql.ErrInvalidSystemVariableValue.New(t.varName, v)
		}
		return t.Convert(ctx, i)
	}

	return nil, sql.OutOfRange, sql.ErrInvalidSystemVariableValue.New(t.varName, v)
}

// Equals implements the Type interface.
func (t systemIntType) Equals(otherType sql.Type) bool {
	if ot, ok := otherType.(systemIntType); ok {
		return t.varName == ot.varName && t.lowerbound == ot.lowerbound && t.upperbound == ot.upperbound && t.negativeOne == ot.negativeOne
	}
	return false
}

// MaxTextResponseByteLength implements the Type interface
func (t systemIntType) MaxTextResponseByteLength(ctx *sql.Context) uint32 {
	return t.UnderlyingType().MaxTextResponseByteLength(ctx)
}

// Promote implements the Type interface.
func (t systemIntType) Promote() sql.Type {
	return t
}

// SQL implements Type interface.
func (t systemIntType) SQL(ctx *sql.Context, dest []byte, v interface{}) (sqltypes.Value, error) {
	if v == nil {
		return sqltypes.NULL, nil
	}

	v, _, err := t.Convert(ctx, v)
	if err != nil {
		return sqltypes.Value{}, err
	}

	stop := len(dest)
	dest = strconv.AppendInt(dest, v.(int64), 10)
	val := dest[stop:]

	return sqltypes.MakeTrusted(t.Type(), val), nil
}

// String implements Type interface.
func (t systemIntType) String() string {
	return "system_int"
}

// Type implements Type interface.
func (t systemIntType) Type() query.Type {
	return sqltypes.Int64
}

// ValueType implements Type interface.
func (t systemIntType) ValueType() reflect.Type {
	return systemIntValueType
}

// Zero implements Type interface.
func (t systemIntType) Zero() interface{} {
	return int64(0)
}

// CollationCoercibility implements sql.CollationCoercible interface.
func (systemIntType) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// EncodeValue implements SystemVariableType interface.
func (t systemIntType) EncodeValue(val interface{}) (string, error) {
	expectedVal, ok := val.(int64)
	if !ok {
		return "", sql.ErrSystemVariableCodeFail.New(val, t.String())
	}
	return strconv.FormatInt(expectedVal, 10), nil
}

// DecodeValue implements SystemVariableType interface.
func (t systemIntType) DecodeValue(val string) (interface{}, error) {
	parsedVal, err := strconv.ParseInt(val, 10, 64)
	if err != nil {
		return nil, err
	}
	if parsedVal >= t.lowerbound && parsedVal <= t.upperbound {
		return parsedVal, nil
	}
	return nil, sql.ErrSystemVariableCodeFail.New(val, t.String())
}

func (t systemIntType) UnderlyingType() sql.Type {
	return Int64
}
