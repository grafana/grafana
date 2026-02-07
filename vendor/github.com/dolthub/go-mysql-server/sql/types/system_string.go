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

	"github.com/dolthub/go-mysql-server/sql"
)

var systemStringValueType = reflect.TypeOf(string(""))

// systemStringType is an internal string type ONLY for system variables.
type systemStringType struct {
	varName string
}

var _ sql.SystemVariableType = systemStringType{}
var _ sql.CollationCoercible = systemStringType{}

// NewSystemStringType returns a new systemStringType.
func NewSystemStringType(varName string) sql.SystemVariableType {
	return systemStringType{varName}
}

// Compare implements Type interface.
func (t systemStringType) Compare(ctx context.Context, a interface{}, b interface{}) (int, error) {
	as, _, err := t.Convert(ctx, a)
	if err != nil {
		return 0, err
	}
	bs, _, err := t.Convert(ctx, b)
	if err != nil {
		return 0, err
	}
	ai := as.(string)
	bi := bs.(string)

	if ai == bi {
		return 0, nil
	}
	if ai < bi {
		return -1, nil
	}
	return 1, nil
}

// Convert implements Type interface.
func (t systemStringType) Convert(c context.Context, v interface{}) (interface{}, sql.ConvertInRange, error) {
	if v == nil {
		return "", sql.InRange, nil
	}
	if value, ok := v.(string); ok {
		return value, sql.InRange, nil
	}

	return nil, sql.OutOfRange, sql.ErrInvalidSystemVariableValue.New(t.varName, v)
}

// Equals implements the Type interface.
func (t systemStringType) Equals(otherType sql.Type) bool {
	if ot, ok := otherType.(systemStringType); ok {
		return t.varName == ot.varName
	}
	return false
}

// MaxTextResponseByteLength implements the Type interface
func (t systemStringType) MaxTextResponseByteLength(ctx *sql.Context) uint32 {
	return t.UnderlyingType().MaxTextResponseByteLength(ctx)
}

// Promote implements the Type interface.
func (t systemStringType) Promote() sql.Type {
	return t
}

// SQL implements Type interface.
func (t systemStringType) SQL(ctx *sql.Context, dest []byte, v interface{}) (sqltypes.Value, error) {
	if v == nil {
		return sqltypes.NULL, nil
	}

	v, _, err := t.Convert(ctx, v)
	if err != nil {
		return sqltypes.Value{}, err
	}

	val := AppendAndSliceString(dest, v.(string))

	return sqltypes.MakeTrusted(t.Type(), val), nil
}

// String implements Type interface.
func (t systemStringType) String() string {
	return "system_string"
}

// Type implements Type interface.
func (t systemStringType) Type() query.Type {
	return sqltypes.VarChar
}

// ValueType implements Type interface.
func (t systemStringType) ValueType() reflect.Type {
	return systemStringValueType
}

// Zero implements Type interface.
func (t systemStringType) Zero() interface{} {
	return ""
}

// CollationCoercibility implements sql.CollationCoercible interface.
func (t systemStringType) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_utf8mb3_general_ci, 3
}

// EncodeValue implements SystemVariableType interface.
func (t systemStringType) EncodeValue(val interface{}) (string, error) {
	expectedVal, ok := val.(string)
	if !ok {
		return "", sql.ErrSystemVariableCodeFail.New(val, t.String())
	}
	return expectedVal, nil
}

// DecodeValue implements SystemVariableType interface.
func (t systemStringType) DecodeValue(val string) (interface{}, error) {
	return val, nil
}

func (t systemStringType) UnderlyingType() sql.Type {
	return LongText
}
