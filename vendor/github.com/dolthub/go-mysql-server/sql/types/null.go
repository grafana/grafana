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
	"gopkg.in/src-d/go-errors.v1"

	"github.com/dolthub/go-mysql-server/sql"
)

var (
	Null sql.NullType = nullType{}

	// ErrValueNotNil is thrown when a value that was expected to be nil, is not
	ErrValueNotNil = errors.NewKind("value not nil: %#v")
)

type nullType struct{}

func (t nullType) IsNullType() bool {
	return true
}

// Compare implements Type interface. Note that while this returns 0 (equals)
// for ordering purposes, in SQL NULL != NULL.
func (t nullType) Compare(s context.Context, a interface{}, b interface{}) (int, error) {
	return 0, nil
}

// Convert implements Type interface.
func (t nullType) Convert(c context.Context, v interface{}) (interface{}, sql.ConvertInRange, error) {
	if v != nil {
		return nil, sql.InRange, ErrValueNotNil.New(v)
	}

	return nil, sql.InRange, nil
}

// MaxTextResponseByteLength implements the Type interface
func (t nullType) MaxTextResponseByteLength(*sql.Context) uint32 {
	return 0
}

// Equals implements the Type interface.
func (t nullType) Equals(otherType sql.Type) bool {
	_, ok := otherType.(nullType)
	return ok
}

// Promote implements the Type interface.
func (t nullType) Promote() sql.Type {
	return t
}

// SQL implements Type interface.
func (t nullType) SQL(*sql.Context, []byte, interface{}) (sqltypes.Value, error) {
	return sqltypes.NULL, nil
}

// String implements Type interface.
func (t nullType) String() string {
	return "null"
}

// Type implements Type interface.
func (t nullType) Type() query.Type {
	return sqltypes.Null
}

// ValueType implements Type interface.
func (t nullType) ValueType() reflect.Type {
	return nil
}

// Zero implements Type interface.
func (t nullType) Zero() interface{} {
	return nil
}

// CollationCoercibility implements sql.CollationCoercible interface.
func (nullType) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 6
}
