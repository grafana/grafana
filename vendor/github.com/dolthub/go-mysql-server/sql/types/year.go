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
	"time"

	"github.com/dolthub/vitess/go/sqltypes"
	"github.com/dolthub/vitess/go/vt/proto/query"
	"github.com/shopspring/decimal"
	"gopkg.in/src-d/go-errors.v1"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/values"
)

var (
	Year sql.YearType = YearType_{}

	ErrConvertingToYear = errors.NewKind("value %v is not a valid Year")

	yearValueType = reflect.TypeOf(int16(0))
)

type YearType_ struct{}

// Compare implements Type interface.
func (t YearType_) Compare(ctx context.Context, a interface{}, b interface{}) (int, error) {
	if hasNulls, res := CompareNulls(a, b); hasNulls {
		return res, nil
	}

	as, _, err := t.Convert(ctx, a)
	if err != nil {
		return 0, err
	}
	bs, _, err := t.Convert(ctx, b)
	if err != nil {
		return 0, err
	}
	ai := as.(int16)
	bi := bs.(int16)

	if ai == bi {
		return 0, nil
	}
	if ai < bi {
		return -1, nil
	}
	return 1, nil
}

// CompareValue implements the ValueType interface.
func (t YearType_) CompareValue(ctx *sql.Context, a, b sql.Value) (int, error) {
	if hasNulls, res := CompareNullValues(a, b); hasNulls {
		return res, nil
	}
	ay, err := ConvertValueToYear(ctx, a)
	if err != nil {
		return 0, err
	}
	by, err := ConvertValueToYear(ctx, b)
	if err != nil {
		return 0, err
	}
	switch {
	case ay < by:
		return -1, nil
	case ay > by:
		return 1, nil
	default:
		return 0, nil
	}
}

// Convert implements Type interface.
func (t YearType_) Convert(ctx context.Context, v interface{}) (interface{}, sql.ConvertInRange, error) {
	if v == nil {
		return nil, sql.InRange, nil
	}

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
		if value == 0 {
			return int16(0), sql.InRange, nil
		}
		if value >= 1 && value <= 69 {
			return int16(value + 2000), sql.InRange, nil
		}
		if value >= 70 && value <= 99 {
			return int16(value + 1900), sql.InRange, nil
		}
		if value >= 1901 && value <= 2155 {
			return int16(value), sql.InRange, nil
		}
	case uint64:
		return t.Convert(ctx, int64(value))
	case float32:
		return t.Convert(ctx, int64(value))
	case float64:
		return t.Convert(ctx, int64(value))
	case decimal.Decimal:
		return t.Convert(ctx, value.IntPart())
	case decimal.NullDecimal:
		if !value.Valid {
			return nil, sql.InRange, nil
		}
		return t.Convert(ctx, value.Decimal.IntPart())
	case string:
		valueLength := len(value)
		if valueLength == 1 || valueLength == 2 || valueLength == 4 {
			i, err := strconv.ParseInt(value, 10, 64)
			if err != nil {
				return nil, sql.InRange, err
			}
			if i == 0 {
				return int16(2000), sql.InRange, nil
			}
			return t.Convert(ctx, i)
		} else if f, err := strconv.ParseFloat(value, 64); err == nil {
			return t.Convert(ctx, f)
		}
	case time.Time:
		year := value.Year()
		if year == 0 || (year >= 1901 && year <= 2155) {
			return int16(year), sql.InRange, nil
		}
	}

	return nil, sql.InRange, ErrConvertingToYear.New(v)
}

// Equals implements the Type interface.
func (t YearType_) Equals(otherType sql.Type) bool {
	_, ok := otherType.(YearType_)
	return ok
}

// MaxTextResponseByteLength implements the Type interface
func (t YearType_) MaxTextResponseByteLength(*sql.Context) uint32 {
	return 4
}

// Promote implements the Type interface.
func (t YearType_) Promote() sql.Type {
	return t
}

// SQL implements Type interface.
func (t YearType_) SQL(ctx *sql.Context, dest []byte, v interface{}) (sqltypes.Value, error) {
	if v == nil {
		return sqltypes.NULL, nil
	}

	v, _, err := t.Convert(ctx, v)
	if err != nil {
		return sqltypes.Value{}, err
	}

	stop := len(dest)
	dest = strconv.AppendInt(dest, int64(v.(int16)), 10)
	val := dest[stop:]

	return sqltypes.MakeTrusted(sqltypes.Year, val), nil
}

// SQLValue implements ValueType interface.
func (t YearType_) SQLValue(ctx *sql.Context, v sql.Value, dest []byte) (sqltypes.Value, error) {
	if v.IsNull() {
		return sqltypes.NULL, nil
	}
	x := values.ReadUint16(v.Val)
	dest = strconv.AppendInt(dest, int64(x), 10)
	return sqltypes.MakeTrusted(sqltypes.Year, dest), nil
}

// String implements Type interface.
func (t YearType_) String() string {
	return "year"
}

// Type implements Type interface.
func (t YearType_) Type() query.Type {
	return sqltypes.Year
}

// ValueType implements Type interface.
func (t YearType_) ValueType() reflect.Type {
	return yearValueType
}

// Zero implements Type interface.
func (t YearType_) Zero() interface{} {
	return int16(0)
}

// CollationCoercibility implements sql.CollationCoercible interface.
func (YearType_) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

func ConvertValueToYear(ctx *sql.Context, v sql.Value) (uint16, error) {
	switch v.Typ {
	case sqltypes.Int8:
		x := values.ReadInt8(v.Val)
		return uint16(x), nil
	case sqltypes.Int16:
		x := values.ReadInt16(v.Val)
		return uint16(x), nil
	case sqltypes.Int32:
		x := values.ReadInt32(v.Val)
		return uint16(x), nil
	case sqltypes.Int64:
		x := values.ReadInt64(v.Val)
		return uint16(x), nil
	case sqltypes.Uint8:
		x := values.ReadUint8(v.Val)
		return uint16(x), nil
	case sqltypes.Uint16:
		x := values.ReadUint16(v.Val)
		return x, nil
	case sqltypes.Uint32:
		x := values.ReadUint32(v.Val)
		return uint16(x), nil
	case sqltypes.Uint64:
		x := values.ReadUint64(v.Val)
		return uint16(x), nil
	case sqltypes.Float32:
		x := values.ReadFloat32(v.Val)
		return uint16(x), nil
	case sqltypes.Float64:
		x := values.ReadFloat64(v.Val)
		return uint16(x), nil
	case sqltypes.Decimal:
		x := values.ReadDecimal(v.Val)
		return uint16(x.IntPart()), nil
	case sqltypes.Year:
		x := values.ReadUint16(v.Val)
		return x, nil
	case sqltypes.Date:
		x := values.ReadDate(v.Val)
		return uint16(x.UTC().Unix()), nil
	case sqltypes.Time:
		x := values.ReadInt64(v.Val)
		return uint16(x), nil
	case sqltypes.Datetime, sqltypes.Timestamp:
		x := values.ReadDatetime(v.Val)
		return uint16(x.UTC().Unix()), nil
	case sqltypes.Text, sqltypes.Blob:
		var err error
		if v.Val == nil {
			v.Val, err = v.WrappedVal.Unwrap(ctx)
			if err != nil {
				return 0, err
			}
		}
		val := values.ReadString(v.Val)
		truncStr, didTrunc := TruncateStringToInt(val)
		if didTrunc {
			err = sql.ErrTruncatedIncorrect.New(v.Typ, val)
		}
		i, pErr := strconv.ParseInt(truncStr, 10, 64)
		if pErr != nil {
			return 0, sql.ErrInvalidValue.New(v, v.Typ.String())
		}
		return uint16(i), err
	default:
		return 0, ErrConvertingToYear.New(v)
	}
}
