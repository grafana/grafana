// Copyright 2020-2021 Dolthub, Inc.
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

package expression

import (
	"fmt"

	"gopkg.in/src-d/go-errors.v1"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

var errCannotSetField = errors.NewKind("Expected GetField expression on left but got %T")

// SetField updates the value of a field or a system variable
type SetField struct {
	BinaryExpressionStub
}

var _ sql.Expression = (*SetField)(nil)
var _ sql.CollationCoercible = (*SetField)(nil)

// NewSetField creates a new SetField expression.
func NewSetField(left, expr sql.Expression) sql.Expression {
	return &SetField{BinaryExpressionStub{LeftChild: left, RightChild: expr}}
}

func (s *SetField) String() string {
	return fmt.Sprintf("SET %s = %s", s.LeftChild, s.RightChild)
}

func (s *SetField) DebugString() string {
	return fmt.Sprintf("SET %s = %s", sql.DebugString(s.LeftChild), sql.DebugString(s.RightChild))
}

// Type implements the Expression interface.
func (s *SetField) Type() sql.Type {
	return s.LeftChild.Type()
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (s *SetField) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.GetCoercibility(ctx, s.LeftChild)
}

// Eval implements the Expression interface.
// Returns a copy of the given row with an updated value.
func (s *SetField) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	getField, ok := s.LeftChild.(*GetField)
	if !ok {
		return nil, errCannotSetField.New(s.LeftChild)
	}

	if getField.fieldIndex < 0 || getField.fieldIndex >= len(row) {
		return nil, ErrIndexOutOfBounds.New(getField.fieldIndex, len(row))
	}
	val, err := s.RightChild.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	if val != nil {
		convertedVal, _, err := getField.fieldType.Convert(ctx, val)
		if err != nil {
			// Fill in error with information
			if types.ErrLengthBeyondLimit.Is(err) {
				return nil, sql.NewWrappedTypeConversionError(val, getField.fieldIndex, types.ErrLengthBeyondLimit.New(val, getField.Name()))
			}
			if sql.ErrTruncatedIncorrect.Is(err) {
				err = sql.ErrInvalidValue.New(val, getField.fieldType)
			}
			return nil, sql.NewWrappedTypeConversionError(val, getField.fieldIndex, err)
		}
		val = convertedVal
	}
	updatedRow := row.Copy()
	updatedRow[getField.fieldIndex] = val
	return updatedRow, nil
}

// WithChildren implements the Expression interface.
func (s *SetField) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 2 {
		return nil, sql.ErrInvalidChildrenNumber.New(s, len(children), 2)
	}
	return NewSetField(children[0], children[1]), nil
}
