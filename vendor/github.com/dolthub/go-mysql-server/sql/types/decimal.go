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
	"fmt"
	"math/big"
	"reflect"
	"strings"

	"github.com/dolthub/vitess/go/sqltypes"
	"github.com/dolthub/vitess/go/vt/proto/query"
	"github.com/shopspring/decimal"
	"gopkg.in/src-d/go-errors.v1"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/encodings"
	"github.com/dolthub/go-mysql-server/sql/values"
)

const (
	// DecimalTypeMaxPrecision returns the maximum precision allowed for the Decimal type.
	DecimalTypeMaxPrecision = 65
	// DecimalTypeMaxScale returns the maximum scale allowed for the Decimal type, assuming the
	// maximum precision is used. For a maximum scale that is relative to the precision of a given
	// decimal type, use its MaximumScale function.
	DecimalTypeMaxScale = 30
)

var (
	ErrConvertingToDecimal   = errors.NewKind("value %v is not a valid Decimal")
	ErrConvertToDecimalLimit = errors.NewKind("Out of range value for column of Decimal type ")
	ErrMarshalNullDecimal    = errors.NewKind("Decimal cannot marshal a null value")

	decimalValueType = reflect.TypeOf(decimal.Decimal{})
)

type DecimalType_ struct {
	exclusiveUpperBound decimal.Decimal
	definesColumn       bool
	precision           uint8
	scale               uint8
}

// InternalDecimalType is a special DecimalType that is used internally for Decimal comparisons. Not intended for usage
// from integrators.
var InternalDecimalType sql.DecimalType = DecimalType_{
	exclusiveUpperBound: decimal.New(1, int32(65)),
	definesColumn:       false,
	precision:           65,
	scale:               30,
}

// CreateDecimalType creates a DecimalType for NON-TABLE-COLUMN.
func CreateDecimalType(precision uint8, scale uint8) (sql.DecimalType, error) {
	return createDecimalType(precision, scale, false)
}

// CreateColumnDecimalType creates a DecimalType for VALID-TABLE-COLUMN. Creating a decimal type for a column ensures that
// when operating on instances of this type, the result will be restricted to the defined precision and scale.
func CreateColumnDecimalType(precision uint8, scale uint8) (sql.DecimalType, error) {
	return createDecimalType(precision, scale, true)
}

// createDecimalType creates a DecimalType using given precision, scale
// and whether this type defines a valid table column.
func createDecimalType(precision uint8, scale uint8, definesColumn bool) (sql.DecimalType, error) {
	if scale > DecimalTypeMaxScale {
		return nil, fmt.Errorf("Too big scale %v specified. Maximum is %v.", scale, DecimalTypeMaxScale)
	}
	if precision > DecimalTypeMaxPrecision {
		return nil, fmt.Errorf("Too big precision %v specified. Maximum is %v.", precision, DecimalTypeMaxPrecision)
	}
	if scale > precision {
		return nil, fmt.Errorf("Scale %v cannot be larger than the precision %v", scale, precision)
	}

	if precision == 0 {
		precision = 10
	}
	return DecimalType_{
		exclusiveUpperBound: decimal.New(1, int32(precision-scale)),
		definesColumn:       definesColumn,
		precision:           precision,
		scale:               scale,
	}, nil
}

// MustCreateDecimalType is the same as CreateDecimalType except it panics on errors and for NON-TABLE-COLUMN.
func MustCreateDecimalType(precision uint8, scale uint8) sql.DecimalType {
	dt, err := CreateDecimalType(precision, scale)
	if err != nil {
		panic(err)
	}
	return dt
}

// MustCreateColumnDecimalType is the same as CreateDecimalType except it panics on errors and for VALID-TABLE-COLUMN.
func MustCreateColumnDecimalType(precision uint8, scale uint8) sql.DecimalType {
	dt, err := CreateColumnDecimalType(precision, scale)
	if err != nil {
		panic(err)
	}
	return dt
}

// Type implements Type interface.
func (t DecimalType_) Type() query.Type {
	return sqltypes.Decimal
}

// Compare implements Type interface.
func (t DecimalType_) Compare(s context.Context, a interface{}, b interface{}) (int, error) {
	if hasNulls, res := CompareNulls(a, b); hasNulls {
		return res, nil
	}

	af, err := t.ConvertToNullDecimal(a)
	if err != nil {
		return 0, err
	}
	bf, err := t.ConvertToNullDecimal(b)
	if err != nil {
		return 0, err
	}

	return af.Decimal.Cmp(bf.Decimal), nil
}

// CompareValue implements the ValueType interface
func (t DecimalType_) CompareValue(ctx *sql.Context, a, b sql.Value) (int, error) {
	if hasNulls, res := CompareNullValues(a, b); hasNulls {
		return res, nil
	}
	aDec, err := convertValueToDecimal(ctx, a)
	if err != nil {
		return 0, err
	}
	bDec, err := convertValueToDecimal(ctx, b)
	if err != nil {
		return 0, err
	}
	return aDec.Cmp(bDec), nil
}

// Convert implements Type interface.
func (t DecimalType_) Convert(c context.Context, v interface{}) (interface{}, sql.ConvertInRange, error) {
	dec, err := t.ConvertToNullDecimal(v)
	if err != nil && !sql.ErrTruncatedIncorrect.Is(err) {
		return nil, sql.InRange, err
	}
	if !dec.Valid {
		return nil, sql.InRange, nil
	}
	res, inRange, cErr := t.BoundsCheck(dec.Decimal)
	if cErr != nil {
		return nil, inRange, cErr
	}
	return res, inRange, err
}

func (t DecimalType_) ConvertNoBoundsCheck(v interface{}) (decimal.Decimal, error) {
	dec, err := t.ConvertToNullDecimal(v)
	if err != nil {
		return decimal.Decimal{}, err
	}
	if !dec.Valid {
		return decimal.Decimal{}, nil
	}
	return dec.Decimal, nil
}

// ConvertToNullDecimal implements DecimalType interface.
func (t DecimalType_) ConvertToNullDecimal(v interface{}) (decimal.NullDecimal, error) {
	if v == nil {
		return decimal.NullDecimal{}, nil
	}

	var res decimal.Decimal

	switch value := v.(type) {
	case bool:
		if value {
			return t.ConvertToNullDecimal(decimal.NewFromInt(1))
		} else {
			return t.ConvertToNullDecimal(decimal.NewFromInt(0))
		}
	case int:
		return t.ConvertToNullDecimal(int64(value))
	case uint:
		return t.ConvertToNullDecimal(uint64(value))
	case int8:
		return t.ConvertToNullDecimal(int64(value))
	case uint8:
		return t.ConvertToNullDecimal(uint64(value))
	case int16:
		return t.ConvertToNullDecimal(int64(value))
	case uint16:
		return t.ConvertToNullDecimal(uint64(value))
	case int32:
		return t.ConvertToNullDecimal(decimal.NewFromInt32(value))
	case uint32:
		return t.ConvertToNullDecimal(uint64(value))
	case int64:
		return t.ConvertToNullDecimal(decimal.NewFromInt(value))
	case uint64:
		return t.ConvertToNullDecimal(decimal.NewFromUint64(value))
	case float32:
		return t.ConvertToNullDecimal(decimal.NewFromFloat32(value))
	case float64:
		if !IsValidFloat(value) {
			return decimal.NullDecimal{}, ErrConvertingToDecimal.New(value)
		}
		return t.ConvertToNullDecimal(decimal.NewFromFloat(value))
	case string:
		var err error
		truncStr := strings.Trim(value, sql.NumericCutSet)
		res, err = decimal.NewFromString(truncStr)
		if err == nil {
			return t.ConvertToNullDecimal(res)
		}
		// The decimal library cannot handle all the different formats
		bf, _, err := new(big.Float).SetPrec(217).Parse(truncStr, 0)
		if err == nil {
			res, err = decimal.NewFromString(bf.Text('f', -1))
			if err == nil {
				return t.ConvertToNullDecimal(res)
			}
		}
		truncStr, didTrunc := TruncateStringToDouble(value)
		if truncStr == "0" {
			nullDec, cErr := t.ConvertToNullDecimal(decimal.NewFromInt(0))
			if cErr != nil {
				return decimal.NullDecimal{}, cErr
			}
			if didTrunc {
				return nullDec, sql.ErrTruncatedIncorrect.New(t, value)
			}
			return nullDec, nil
		}
		res, _ = decimal.NewFromString(truncStr)
		nullDec, cErr := t.ConvertToNullDecimal(res)
		if cErr != nil {
			return decimal.NullDecimal{}, cErr
		}
		if didTrunc {
			err = sql.ErrTruncatedIncorrect.New(t, value)
		}
		return nullDec, err
	case *big.Float:
		return t.ConvertToNullDecimal(value.Text('f', -1))
	case *big.Int:
		return t.ConvertToNullDecimal(value.Text(10))
	case *big.Rat:
		return t.ConvertToNullDecimal(new(big.Float).SetRat(value))
	case decimal.Decimal:
		if t.definesColumn && value.Exponent() != int32(t.scale) {
			val, err := decimal.NewFromString(value.StringFixed(int32(t.scale)))
			if err != nil {
				return decimal.NullDecimal{}, err
			}
			res = val
		} else {
			res = value
		}
	case []uint8:
		return t.ConvertToNullDecimal(string(value))
	case decimal.NullDecimal:
		// This is the equivalent of passing in a nil
		if !value.Valid {
			return decimal.NullDecimal{}, nil
		}
		return t.ConvertToNullDecimal(value.Decimal)
	case JSONDocument:
		return t.ConvertToNullDecimal(value.Val)
	default:
		return decimal.NullDecimal{}, ErrConvertingToDecimal.New(v)
	}

	return decimal.NullDecimal{Decimal: res, Valid: true}, nil
}

func (t DecimalType_) BoundsCheck(v decimal.Decimal) (decimal.Decimal, sql.ConvertInRange, error) {
	if -v.Exponent() > int32(t.scale) {
		// TODO : add 'Data truncated' warning
		v = v.Round(int32(t.scale))
	}
	// TODO add shortcut for common case
	// ex: certain num of bits fast tracks OK
	if !v.Abs().LessThan(t.exclusiveUpperBound) {
		return decimal.Decimal{}, sql.InRange, ErrConvertToDecimalLimit.New()
	}
	return v, sql.InRange, nil
}

// Equals implements the Type interface.
func (t DecimalType_) Equals(otherType sql.Type) bool {
	if ot, ok := otherType.(DecimalType_); ok {
		return t.precision == ot.precision && t.scale == ot.scale
	}
	return false
}

// MaxTextResponseByteLength implements the Type interface
func (t DecimalType_) MaxTextResponseByteLength(*sql.Context) uint32 {
	if t.scale == 0 {
		// if no digits are reserved for the right-hand side of the decimal point,
		// just return precision plus one byte for sign
		return uint32(t.precision + 1)
	} else {
		// otherwise return precision plus one byte for sign plus one byte for the decimal point
		return uint32(t.precision + 2)
	}
}

// Promote implements the Type interface.
func (t DecimalType_) Promote() sql.Type {
	if t.definesColumn {
		return MustCreateColumnDecimalType(DecimalTypeMaxPrecision, t.scale)
	}
	return MustCreateDecimalType(DecimalTypeMaxPrecision, t.scale)
}

// SQL implements Type interface.
func (t DecimalType_) SQL(ctx *sql.Context, dest []byte, v interface{}) (sqltypes.Value, error) {
	if v == nil {
		return sqltypes.NULL, nil
	}
	value, err := t.ConvertToNullDecimal(v)
	if err != nil {
		return sqltypes.Value{}, err
	}
	val := encodings.StringToBytes(t.DecimalValueStringFixed(value.Decimal))
	return sqltypes.MakeTrusted(sqltypes.Decimal, val), nil
}

func (t DecimalType_) SQLValue(ctx *sql.Context, v sql.Value, dest []byte) (sqltypes.Value, error) {
	if v.IsNull() {
		return sqltypes.NULL, nil
	}
	d := values.ReadDecimal(v.Val)
	return sqltypes.MakeTrusted(sqltypes.Decimal, encodings.StringToBytes(t.DecimalValueStringFixed(d))), nil
}

// String implements Type interface.
func (t DecimalType_) String() string {
	return fmt.Sprintf("decimal(%v,%v)", t.precision, t.scale)
}

// ValueType implements Type interface.
func (t DecimalType_) ValueType() reflect.Type {
	return decimalValueType
}

// Zero implements Type interface.
func (t DecimalType_) Zero() interface{} {
	// The zero value should have the same scale as the type
	return decimal.New(0, -int32(t.scale))
}

// CollationCoercibility implements sql.CollationCoercible interface.
func (DecimalType_) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// ExclusiveUpperBound implements DecimalType interface.
func (t DecimalType_) ExclusiveUpperBound() decimal.Decimal {
	return t.exclusiveUpperBound
}

// MaximumScale implements DecimalType interface.
func (t DecimalType_) MaximumScale() uint8 {
	if t.precision >= DecimalTypeMaxScale {
		return DecimalTypeMaxScale
	}
	return t.precision
}

// Precision implements DecimalType interface.
func (t DecimalType_) Precision() uint8 {
	return t.precision
}

// Scale implements DecimalType interface.
func (t DecimalType_) Scale() uint8 {
	return t.scale
}

// DecimalValueStringFixed returns string value for the given decimal value. If decimal type value is for valid table column only,
// it should use scale defined by the column. Otherwise, the result value should use its own precision and scale.
func (t DecimalType_) DecimalValueStringFixed(v decimal.Decimal) string {
	if t.definesColumn {
		if int32(t.scale) != v.Exponent() {
			return v.StringFixed(int32(t.scale))
		}
		return v.String()
	} else {
		return v.StringFixed(v.Exponent() * -1)
	}
}

func convertValueToDecimal(ctx *sql.Context, v sql.Value) (decimal.Decimal, error) {
	switch v.Typ {
	case sqltypes.Int8:
		x := values.ReadInt8(v.Val)
		return decimal.NewFromInt(int64(x)), nil
	case sqltypes.Int16:
		x := values.ReadInt16(v.Val)
		return decimal.NewFromInt(int64(x)), nil
	case sqltypes.Int32:
		x := values.ReadInt32(v.Val)
		return decimal.NewFromInt(int64(x)), nil
	case sqltypes.Int64:
		x := values.ReadInt64(v.Val)
		return decimal.NewFromInt(x), nil
	case sqltypes.Uint8:
		x := values.ReadUint8(v.Val)
		return decimal.NewFromInt(int64(x)), nil
	case sqltypes.Uint16:
		x := values.ReadUint16(v.Val)
		return decimal.NewFromInt(int64(x)), nil
	case sqltypes.Uint32:
		x := values.ReadUint32(v.Val)
		return decimal.NewFromInt(int64(x)), nil
	case sqltypes.Uint64:
		x := values.ReadUint64(v.Val)
		return decimal.NewFromUint64(x), nil
	case sqltypes.Float32:
		x := values.ReadFloat32(v.Val)
		return decimal.NewFromFloat32(x), nil
	case sqltypes.Float64:
		x := values.ReadFloat64(v.Val)
		return decimal.NewFromFloat(x), nil
	case sqltypes.Decimal:
		x := values.ReadDecimal(v.Val)
		return x, nil
	case sqltypes.Bit:
		x := values.ReadUint64(v.Val)
		return decimal.NewFromUint64(x), nil
	case sqltypes.Year:
		x := values.ReadUint16(v.Val)
		return decimal.NewFromInt(int64(x)), nil
	case sqltypes.Date:
		x := values.ReadDate(v.Val)
		s := x.UTC().Unix()
		return decimal.NewFromInt(s), nil
	case sqltypes.Time:
		x := values.ReadInt64(v.Val)
		return decimal.NewFromInt(x), nil
	case sqltypes.Datetime, sqltypes.Timestamp:
		x := values.ReadDatetime(v.Val)
		return decimal.NewFromInt(x.UTC().Unix()), nil
	case sqltypes.Text, sqltypes.Blob:
		var err error
		if v.Val == nil {
			v.Val, err = v.WrappedVal.Unwrap(ctx)
			if err != nil {
				return decimal.Decimal{}, err
			}
		}
		x := values.ReadString(v.Val)
		res, err := decimal.NewFromString(x)
		if err != nil {
			return decimal.Decimal{}, err
		}
		return res, nil
	default:
		return decimal.Decimal{}, ErrConvertingToDecimal.New(v)
	}
}

// IsDecimalType implements the sql.DecimalType
func (t DecimalType_) IsDecimalType() bool {
	return true
}
