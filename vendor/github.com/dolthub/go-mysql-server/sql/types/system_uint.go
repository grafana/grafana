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

var systemUintValueType = reflect.TypeOf(uint64(0))

// systemUintType is an internal unsigned integer type ONLY for system variables.
type systemUintType struct {
	varName    string
	lowerbound uint64
	upperbound uint64
}

var _ sql.SystemVariableType = systemUintType{}
var _ sql.CollationCoercible = systemUintType{}

// NewSystemUintType returns a new systemUintType.
func NewSystemUintType(varName string, lowerbound, upperbound uint64) sql.SystemVariableType {
	return systemUintType{varName, lowerbound, upperbound}
}

// Compare implements Type interface.
func (t systemUintType) Compare(ctx context.Context, a interface{}, b interface{}) (int, error) {
	as, _, err := t.Convert(ctx, a)
	if err != nil {
		return 0, err
	}
	bs, _, err := t.Convert(ctx, b)
	if err != nil {
		return 0, err
	}
	ai := as.(uint64)
	bi := bs.(uint64)

	if ai == bi {
		return 0, nil
	}
	if ai < bi {
		return -1, nil
	}
	return 1, nil
}

// Convert implements Type interface.
func (t systemUintType) Convert(ctx context.Context, v interface{}) (interface{}, sql.ConvertInRange, error) {
	// Float, string, nor nil values are accepted
	switch value := v.(type) {
	case int:
		return t.Convert(ctx, uint64(value))
	case uint:
		return t.Convert(ctx, uint64(value))
	case int8:
		return t.Convert(ctx, uint64(value))
	case uint8:
		return t.Convert(ctx, uint64(value))
	case int16:
		return t.Convert(ctx, uint64(value))
	case uint16:
		return t.Convert(ctx, uint64(value))
	case int32:
		return t.Convert(ctx, uint64(value))
	case uint32:
		return t.Convert(ctx, uint64(value))
	case int64:
		return t.Convert(ctx, uint64(value))
	case uint64:
		if value >= t.lowerbound && value <= t.upperbound {
			return value, sql.InRange, nil
		}
	case float32:
		return t.Convert(ctx, float64(value))
	case float64:
		// Float values aren't truly accepted, but the engine will give them when it should give ints.
		// Therefore, if the float doesn't have a fractional portion, we treat it as an int.
		if value == float64(uint64(value)) {
			return t.Convert(ctx, uint64(value))
		}
	case decimal.Decimal:
		f, _ := value.Float64()
		return t.Convert(ctx, f)
	case decimal.NullDecimal:
		if value.Valid {
			f, _ := value.Decimal.Float64()
			return t.Convert(ctx, f)
		}
	}

	return nil, sql.OutOfRange, sql.ErrInvalidSystemVariableValue.New(t.varName, v)
}

// Equals implements the Type interface.
func (t systemUintType) Equals(otherType sql.Type) bool {
	if ot, ok := otherType.(systemUintType); ok {
		return t.varName == ot.varName && t.lowerbound == ot.lowerbound && t.upperbound == ot.upperbound
	}
	return false
}

// MaxTextResponseByteLength implements the Type interface
func (t systemUintType) MaxTextResponseByteLength(ctx *sql.Context) uint32 {
	return t.UnderlyingType().MaxTextResponseByteLength(ctx)
}

// Promote implements the Type interface.
func (t systemUintType) Promote() sql.Type {
	return t
}

// SQL implements Type interface.
func (t systemUintType) SQL(ctx *sql.Context, dest []byte, v interface{}) (sqltypes.Value, error) {
	if v == nil {
		return sqltypes.NULL, nil
	}

	v, _, err := t.Convert(ctx, v)
	if err != nil {
		return sqltypes.Value{}, err
	}

	stop := len(dest)
	dest = strconv.AppendUint(dest, v.(uint64), 10)
	val := dest[stop:]

	return sqltypes.MakeTrusted(t.Type(), val), nil
}

// String implements Type interface.
func (t systemUintType) String() string {
	return "system_uint"
}

// Type implements Type interface.
func (t systemUintType) Type() query.Type {
	return sqltypes.Uint64
}

// ValueType implements Type interface.
func (t systemUintType) ValueType() reflect.Type {
	return systemUintValueType
}

// Zero implements Type interface.
func (t systemUintType) Zero() interface{} {
	return uint64(0)
}

// CollationCoercibility implements sql.CollationCoercible interface.
func (systemUintType) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// EncodeValue implements SystemVariableType interface.
func (t systemUintType) EncodeValue(val interface{}) (string, error) {
	expectedVal, ok := val.(uint64)
	if !ok {
		return "", sql.ErrSystemVariableCodeFail.New(val, t.String())
	}
	return strconv.FormatUint(expectedVal, 10), nil
}

// DecodeValue implements SystemVariableType interface.
func (t systemUintType) DecodeValue(val string) (interface{}, error) {
	parsedVal, err := strconv.ParseUint(val, 10, 64)
	if err != nil {
		return nil, err
	}
	if parsedVal >= t.lowerbound && parsedVal <= t.upperbound {
		return parsedVal, nil
	}
	return nil, sql.ErrSystemVariableCodeFail.New(val, t.String())
}

func (t systemUintType) UnderlyingType() sql.Type {
	return Uint64
}
