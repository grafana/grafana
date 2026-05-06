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

package spatial

import (
	"fmt"
	"strings"

	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/types"

	"github.com/dolthub/go-mysql-server/sql"
)

// MultiPoint is a function that returns a set of Points.
type MultiPoint struct {
	expression.NaryExpression
}

var _ sql.FunctionExpression = (*MultiPoint)(nil)
var _ sql.CollationCoercible = (*MultiPoint)(nil)

// NewMultiPoint creates a new MultiPoint.
func NewMultiPoint(args ...sql.Expression) (sql.Expression, error) {
	if len(args) < 1 {
		return nil, sql.ErrInvalidArgumentNumber.New("MultiPoint", "1 or more", len(args))
	}
	return &MultiPoint{expression.NaryExpression{ChildExpressions: args}}, nil
}

// FunctionName implements sql.FunctionExpression
func (l *MultiPoint) FunctionName() string {
	return "multipoint"
}

// Description implements sql.FunctionExpression
func (l *MultiPoint) Description() string {
	return "returns a new multipoint."
}

// Type implements the sql.Expression interface.
func (l *MultiPoint) Type() sql.Type {
	return types.MultiPointType{}
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*MultiPoint) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

func (l *MultiPoint) String() string {
	var args = make([]string, len(l.ChildExpressions))
	for i, arg := range l.ChildExpressions {
		args[i] = arg.String()
	}
	return fmt.Sprintf("%s(%s)", l.FunctionName(), strings.Join(args, ","))
}

// WithChildren implements the Expression interface.
func (l *MultiPoint) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return NewMultiPoint(children...)
}

// Eval implements the sql.Expression interface.
func (l *MultiPoint) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	var points = make([]types.Point, len(l.ChildExpressions))
	for i, arg := range l.ChildExpressions {
		val, err := arg.Eval(ctx, row)
		if err != nil {
			return nil, err
		}
		switch v := val.(type) {
		case types.Point:
			points[i] = v
		case types.GeometryValue:
			return nil, sql.ErrInvalidArgumentDetails.New(l.FunctionName(), v)
		default:
			return nil, sql.ErrIllegalGISValue.New(v)
		}
	}

	return types.MultiPoint{Points: points}, nil
}
