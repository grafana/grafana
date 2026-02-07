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
	"bytes"
	"context"
	"fmt"
	"reflect"
	"strconv"

	"github.com/dolthub/vitess/go/sqltypes"
	"github.com/dolthub/vitess/go/vt/proto/query"
	"gopkg.in/src-d/go-errors.v1"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/values"
)

// VectorType represents the VECTOR(N) type.
// It stores a fixed-length array of N floating point numbers.
type VectorType struct {
	// The number of floats in the vector.
	// If Dimensions is 0, then the type can hold a variable number of floats, but this is only used
	// as the return type of some functions, and in values sent over the wire.
	Dimensions int
}

var _ sql.Type = VectorType{}
var _ sql.CollationCoercible = VectorType{}

const DefaultVectorDimensions = 2048
const MaxVectorDimensions = 16383

var ErrVectorWrongDimensions = errors.NewKind("VECTOR dimension mismatch: expected %d, got %d")

// CreateVectorType creates a VECTOR type with the specified number of dimensions.
func CreateVectorType(dimensions int) (VectorType, error) {
	if dimensions < 1 || dimensions > MaxVectorDimensions {
		return VectorType{}, fmt.Errorf("VECTOR dimension must be between 1 and %d, got %d", MaxVectorDimensions, dimensions)
	}
	return VectorType{Dimensions: dimensions}, nil
}

// Compare implements Type interface.
func (t VectorType) Compare(ctx context.Context, a interface{}, b interface{}) (int, error) {
	if hasNulls, res := CompareNulls(a, b); hasNulls {
		return res, nil
	}

	av, _, err := t.Convert(ctx, a)
	if err != nil {
		return 0, err
	}
	bv, _, err := t.Convert(ctx, b)
	if err != nil {
		return 0, err
	}

	avec := av.([]byte)
	bvec := bv.([]byte)

	return bytes.Compare(avec, bvec), nil
}

// Convert implements Type interface.
func (t VectorType) Convert(ctx context.Context, v interface{}) (interface{}, sql.ConvertInRange, error) {
	if v == nil {
		return nil, sql.InRange, nil
	}

	var err error
	v, err = sql.UnwrapAny(ctx, v)
	if err != nil {
		return nil, sql.OutOfRange, err
	}

	switch val := v.(type) {
	case []byte:
		if t.Dimensions != 0 && len(val) != int(values.Float32Size)*t.Dimensions {
			if len(val)%int(values.Float32Size) != 0 {
				return nil, sql.OutOfRange, sql.ErrVectorInvalidBinaryLength.New(len(val))
			}
			return nil, sql.OutOfRange, ErrVectorWrongDimensions.New(t.Dimensions, len(val)/int(values.Float32Size))
		}
		return val, sql.InRange, nil
	case sql.JSONWrapper:
		unwrapped, err := val.ToInterface(ctx)
		if err != nil {
			return nil, sql.OutOfRange, err
		}
		return t.Convert(ctx, unwrapped)
	case []interface{}:
		if t.Dimensions != 0 && len(val) != t.Dimensions {
			return nil, sql.OutOfRange, ErrVectorWrongDimensions.New(t.Dimensions, len(val))
		}
		result := make([]float32, len(val))
		for i, elem := range val {
			switch e := elem.(type) {
			case float64:
				result[i] = float32(e)
			case float32:
				result[i] = e
			case int:
				result[i] = float32(e)
			case int64:
				result[i] = float32(e)
			case int32:
				result[i] = float32(e)
			default:
				if str, ok := elem.(string); ok {
					f, err := strconv.ParseFloat(str, 64)
					if err != nil {
						return nil, sql.OutOfRange, fmt.Errorf("invalid vector element: %v", elem)
					}
					result[i] = float32(f)
				} else {
					return nil, sql.OutOfRange, fmt.Errorf("invalid vector element: %v", elem)
				}
			}
		}
		return sql.EncodeVector(result), sql.InRange, nil
	default:
		return nil, sql.OutOfRange, fmt.Errorf("value of type %T cannot be converted to 'vector' type", v)
	}
}

// MustConvert implements Type interface.
func (t VectorType) MustConvert(ctx context.Context, v interface{}) interface{} {
	value, _, err := t.Convert(ctx, v)
	if err != nil {
		panic(err)
	}
	return value
}

// Equals implements Type interface.
func (t VectorType) Equals(otherType sql.Type) bool {
	if otherVector, ok := otherType.(VectorType); ok {
		return t.Dimensions == otherVector.Dimensions
	}
	return false
}

// MaxTextResponseByteLength implements Type interface.
func (t VectorType) MaxTextResponseByteLength(ctx *sql.Context) uint32 {
	return uint32(t.Dimensions * 4)
}

// Promote implements Type interface.
func (t VectorType) Promote() sql.Type {
	return t
}

// SQL implements Type interface.
func (t VectorType) SQL(ctx *sql.Context, dest []byte, v interface{}) (sqltypes.Value, error) {
	val, err := ConvertToBytes(ctx, v, LongBlob, dest)
	if err != nil {
		return sqltypes.Value{}, err
	}

	return sqltypes.MakeTrusted(sqltypes.Vector, val), nil
}

// String implements Type interface.
func (t VectorType) String() string {
	return fmt.Sprintf("VECTOR(%d)", t.Dimensions)
}

// Type implements Type interface.
func (t VectorType) Type() query.Type {
	return sqltypes.Vector
}

// ValueType implements Type interface.
func (t VectorType) ValueType() reflect.Type {
	return byteValueType
}

// Zero implements Type interface.
func (t VectorType) Zero() interface{} {
	return make([]float32, t.Dimensions)
}

// CollationCoercibility implements sql.CollationCoercible interface.
func (VectorType) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

var _ sql.TypeWithCollation = VectorType{}

func (VectorType) Collation() sql.CollationID {
	return sql.Collation_binary
}

func (VectorType) WithNewCollation(sql.CollationID) (sql.Type, error) {
	return nil, fmt.Errorf("cannot change collation of binary types")
}

func (t VectorType) StringWithTableCollation(sql.CollationID) string {
	return fmt.Sprintf("VECTOR(%d)", t.Dimensions)
}
