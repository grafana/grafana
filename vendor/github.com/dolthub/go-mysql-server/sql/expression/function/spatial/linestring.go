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

// LineString is a function that returns a point type containing values Y and Y.
type LineString struct {
	expression.NaryExpression
}

var _ sql.FunctionExpression = (*LineString)(nil)
var _ sql.CollationCoercible = (*LineString)(nil)

// NewLineString creates a new LineString.
func NewLineString(args ...sql.Expression) (sql.Expression, error) {
	if len(args) < 2 {
		return nil, sql.ErrInvalidArgumentNumber.New("LineString", "2 or more", len(args))
	}
	return &LineString{expression.NaryExpression{ChildExpressions: args}}, nil
}

// FunctionName implements sql.FunctionExpression
func (l *LineString) FunctionName() string {
	return "linestring"
}

// Description implements sql.FunctionExpression
func (l *LineString) Description() string {
	return "returns a new linestring."
}

// Type implements the sql.Expression interface.
func (l *LineString) Type() sql.Type {
	return types.LineStringType{}
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*LineString) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

func (l *LineString) String() string {
	var args = make([]string, len(l.ChildExpressions))
	for i, arg := range l.ChildExpressions {
		args[i] = arg.String()
	}
	return fmt.Sprintf("%s(%s)", l.FunctionName(), strings.Join(args, ","))
}

// WithChildren implements the Expression interface.
func (l *LineString) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return NewLineString(children...)
}

// Eval implements the sql.Expression interface.
func (l *LineString) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	// Allocate array of points
	var points = make([]types.Point, len(l.ChildExpressions))

	// Go through each argument
	for i, arg := range l.ChildExpressions {
		// Evaluate argument
		val, err := arg.Eval(ctx, row)
		if err != nil {
			return nil, err
		}
		// Must be of type point, throw error otherwise
		switch v := val.(type) {
		case types.Point:
			points[i] = v
		case types.GeometryValue:
			return nil, sql.ErrInvalidArgumentDetails.New(l.FunctionName(), v)
		default:
			return nil, sql.ErrIllegalGISValue.New(v)
		}
	}

	return types.LineString{Points: points}, nil
}
