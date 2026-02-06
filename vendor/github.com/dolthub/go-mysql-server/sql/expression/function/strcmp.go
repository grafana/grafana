// Copyright 2020-2022 Dolthub, Inc.
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

package function

import (
	"fmt"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// StrCmp compares two strings
type StrCmp struct {
	expression.BinaryExpressionStub
}

var _ sql.FunctionExpression = (*StrCmp)(nil)
var _ sql.CollationCoercible = (*StrCmp)(nil)

// NewStrCmp creates a new NewStrCmp UDF.
func NewStrCmp(e1, e2 sql.Expression) sql.Expression {
	return &StrCmp{
		expression.BinaryExpressionStub{
			LeftChild:  e1,
			RightChild: e2,
		},
	}
}

// FunctionName implements sql.FunctionExpression
func (s *StrCmp) FunctionName() string {
	return "strcmp"
}

// Description implements sql.FunctionExpression
func (s *StrCmp) Description() string {
	return "compares two strings"
}

// Type implements the Expression interface.
func (s *StrCmp) Type() sql.Type {
	return types.Int8
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (s *StrCmp) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	leftCollation, leftCoercibility := sql.GetCoercibility(ctx, s.LeftChild)
	rightCollation, rightCoercibility := sql.GetCoercibility(ctx, s.RightChild)
	return sql.ResolveCoercibility(leftCollation, leftCoercibility, rightCollation, rightCoercibility)
}

func (s *StrCmp) String() string {
	return fmt.Sprintf("%s(%s,%s)", s.FunctionName(), s.LeftChild, s.RightChild)
}

// WithChildren implements the Expression interface.
func (s *StrCmp) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 2 {
		return nil, sql.ErrInvalidChildrenNumber.New(s, len(children), 2)
	}
	return NewStrCmp(children[0], children[1]), nil
}

func (s *StrCmp) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	if s.LeftChild == nil || s.RightChild == nil {
		return nil, nil
	}

	expr1, err := s.LeftChild.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	if expr1 == nil {
		return nil, nil
	}

	expr2, err := s.RightChild.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	if expr2 == nil {
		return nil, nil
	}

	collationPreference, _ := s.CollationCoercibility(ctx)
	if err != nil {
		return nil, err
	}

	strType := types.CreateLongText(collationPreference)
	return strType.Compare(ctx, expr1, expr2)
}
