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
	"encoding/binary"
	"fmt"
	"reflect"

	"github.com/dolthub/vitess/go/sqltypes"
	"github.com/dolthub/vitess/go/vt/proto/query"
	"github.com/shopspring/decimal"
	"gopkg.in/src-d/go-errors.v1"

	"github.com/dolthub/go-mysql-server/sql"
)

const (
	// BitTypeMinBits returns the minimum number of bits for Bit.
	BitTypeMinBits = 1
	// BitTypeMaxBits returns the maximum number of bits for Bit.
	BitTypeMaxBits = 64
)

var (
	promotedBitType = MustCreateBitType(BitTypeMaxBits)
	errBeyondMaxBit = errors.NewKind("%v is beyond the maximum value that can be held by %v bits")
	bitValueType    = reflect.TypeOf(uint64(0))
)

// BitType represents the BIT type.
// https://dev.mysql.com/doc/refman/8.0/en/bit-type.html
// The type of the returned value is uint64.
type BitType interface {
	sql.Type
	NumberOfBits() uint8
}

type BitType_ struct {
	numOfBits uint8
}

// CreateBitType creates a BitType.
func CreateBitType(numOfBits uint8) (BitType, error) {
	if numOfBits < BitTypeMinBits || numOfBits > BitTypeMaxBits {
		return nil, fmt.Errorf("%v is an invalid number of bits", numOfBits)
	}
	return BitType_{
		numOfBits: numOfBits,
	}, nil
}

// MustCreateBitType is the same as CreateBitType except it panics on errors.
func MustCreateBitType(numOfBits uint8) BitType {
	bt, err := CreateBitType(numOfBits)
	if err != nil {
		panic(err)
	}
	return bt
}

// MaxTextResponseByteLength implements Type interface
func (t BitType_) MaxTextResponseByteLength(*sql.Context) uint32 {
	// Because this is a text serialization format, each bit requires one byte in the text response format
	return uint32(t.numOfBits)
}

// Compare implements Type interface.
func (t BitType_) Compare(ctx context.Context, a interface{}, b interface{}) (int, error) {
	if hasNulls, res := CompareNulls(a, b); hasNulls {
		return res, nil
	}

	ac, _, err := t.Convert(ctx, a)
	if err != nil {
		return 0, err
	}
	bc, _, err := t.Convert(ctx, b)
	if err != nil {
		return 0, err
	}

	ai := ac.(uint64)
	bi := bc.(uint64)
	if ai < bi {
		return -1, nil
	} else if ai > bi {
		return 1, nil
	}
	return 0, nil
}

// Convert implements Type interface.
func (t BitType_) Convert(ctx context.Context, v interface{}) (interface{}, sql.ConvertInRange, error) {
	if v == nil {
		return nil, sql.InRange, nil
	}

	value := uint64(0)
	switch val := v.(type) {
	case bool:
		if val {
			value = 1
		} else {
			value = 0
		}
	case int:
		value = uint64(val)
	case uint:
		value = uint64(val)
	case int8:
		value = uint64(val)
	case uint8:
		value = uint64(val)
	case int16:
		value = uint64(val)
	case uint16:
		value = uint64(val)
	case int32:
		value = uint64(val)
	case uint32:
		value = uint64(val)
	case int64:
		value = uint64(val)
	case uint64:
		value = val
	case float32:
		return t.Convert(ctx, float64(val))
	case float64:
		if val < 0 {
			return nil, sql.InRange, fmt.Errorf(`negative floats cannot become bit values`)
		}
		value = uint64(val)
	case decimal.NullDecimal:
		if !val.Valid {
			return nil, sql.InRange, nil
		}
		return t.Convert(ctx, val.Decimal)
	case decimal.Decimal:
		val = val.Round(0)
		if val.GreaterThan(dec_uint64_max) {
			return nil, sql.OutOfRange, errBeyondMaxBit.New(val.String(), t.numOfBits)
		}
		if val.LessThan(dec_int64_min) {
			return nil, sql.OutOfRange, errBeyondMaxBit.New(val.String(), t.numOfBits)
		}
		value = uint64(val.IntPart())
	case string:
		return t.Convert(ctx, []byte(val))
	case []byte:
		if len(val) > 8 {
			return nil, sql.OutOfRange, errBeyondMaxBit.New(value, t.numOfBits)
		}
		value = binary.BigEndian.Uint64(append(make([]byte, 8-len(val)), val...))
	default:
		return nil, sql.OutOfRange, sql.ErrInvalidType.New(t)
	}

	if value > uint64(1<<t.numOfBits-1) {
		return nil, sql.OutOfRange, errBeyondMaxBit.New(value, t.numOfBits)
	}
	return value, sql.InRange, nil
}

// Equals implements the Type interface.
func (t BitType_) Equals(otherType sql.Type) bool {
	if ot, ok := otherType.(BitType_); ok {
		return t.numOfBits == ot.numOfBits
	}
	return false
}

// Promote implements the Type interface.
func (t BitType_) Promote() sql.Type {
	return promotedBitType
}

// SQL implements Type interface.
func (t BitType_) SQL(ctx *sql.Context, dest []byte, v interface{}) (sqltypes.Value, error) {
	if v == nil {
		return sqltypes.NULL, nil
	}
	value, _, err := t.Convert(ctx, v)
	if err != nil {
		return sqltypes.Value{}, err
	}
	bitVal := value.(uint64)

	var data []byte
	for i := uint64(0); i < uint64(t.numOfBits); i += 8 {
		data = append(data, byte(bitVal>>i))
	}
	for i, j := 0, len(data)-1; i < j; i, j = i+1, j-1 {
		data[i], data[j] = data[j], data[i]
	}
	val := data

	return sqltypes.MakeTrusted(sqltypes.Bit, val), nil
}

// String implements Type interface.
func (t BitType_) String() string {
	return fmt.Sprintf("bit(%v)", t.numOfBits)
}

// Type implements Type interface.
func (t BitType_) Type() query.Type {
	return sqltypes.Bit
}

// ValueType implements Type interface.
func (t BitType_) ValueType() reflect.Type {
	return bitValueType
}

// CollationCoercibility implements sql.CollationCoercible interface.
func (BitType_) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// Zero implements Type interface. Returns a uint64 value.
func (t BitType_) Zero() interface{} {
	return uint64(0)
}

// NumberOfBits returns the number of bits that this type may contain.
func (t BitType_) NumberOfBits() uint8 {
	return t.numOfBits
}
