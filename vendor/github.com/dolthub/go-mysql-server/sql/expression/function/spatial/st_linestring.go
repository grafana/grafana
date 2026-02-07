// Copyright 2023 Dolthub, Inc.
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

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// StartPoint is a function that returns the first point of a LineString
type StartPoint struct {
	expression.UnaryExpression
}

var _ sql.FunctionExpression = (*StartPoint)(nil)
var _ sql.CollationCoercible = (*StartPoint)(nil)

// NewStartPoint creates a new StartPoint expression.
func NewStartPoint(arg sql.Expression) sql.Expression {
	return &StartPoint{expression.UnaryExpression{Child: arg}}
}

// FunctionName implements sql.FunctionExpression
func (s *StartPoint) FunctionName() string {
	return "st_startpoint"
}

// Description implements sql.FunctionExpression
func (s *StartPoint) Description() string {
	return "returns the first point of a linestring."
}

// Type implements the sql.Expression interface.
func (s *StartPoint) Type() sql.Type {
	return types.PointType{}
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*StartPoint) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 4
}

func (s *StartPoint) String() string {
	return fmt.Sprintf("%s(%s)", s.FunctionName(), s.Child.String())
}

// WithChildren implements the Expression interface.
func (s *StartPoint) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidArgumentNumber.New(s.FunctionName(), "1", len(children))
	}
	return NewStartPoint(children[0]), nil
}

func startPoint(l types.LineString) types.Point {
	return l.Points[0]
}

// Eval implements the sql.Expression interface.
func (s *StartPoint) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	g, err := s.Child.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	if g == nil {
		return nil, nil
	}

	if _, ok := g.(types.GeometryValue); !ok {
		return nil, sql.ErrInvalidGISData.New(s.FunctionName())
	}

	l, ok := g.(types.LineString)
	if !ok {
		return nil, nil
	}

	return startPoint(l), nil
}

// EndPoint is a function that returns the last point of a LineString
type EndPoint struct {
	expression.UnaryExpression
}

var _ sql.FunctionExpression = (*EndPoint)(nil)
var _ sql.CollationCoercible = (*EndPoint)(nil)

// NewEndPoint creates a new EndPoint expression.
func NewEndPoint(arg sql.Expression) sql.Expression {
	return &EndPoint{expression.UnaryExpression{Child: arg}}
}

// FunctionName implements sql.FunctionExpression
func (e *EndPoint) FunctionName() string {
	return "st_endpoint"
}

// Description implements sql.FunctionExpression
func (e *EndPoint) Description() string {
	return "returns the last point of a linestring."
}

// Type implements the sql.Expression interface.
func (e *EndPoint) Type() sql.Type {
	return types.PointType{}
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*EndPoint) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 4
}

func (e *EndPoint) String() string {
	return fmt.Sprintf("%s(%s)", e.FunctionName(), e.Child.String())
}

// WithChildren implements the Expression interface.
func (e *EndPoint) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidArgumentNumber.New(e.FunctionName(), "1", len(children))
	}
	return NewEndPoint(children[0]), nil
}

func endPoint(l types.LineString) types.Point {
	return l.Points[len(l.Points)-1]
}

// Eval implements the sql.Expression interface.
func (e *EndPoint) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	g, err := e.Child.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	if g == nil {
		return nil, nil
	}

	if _, ok := g.(types.GeometryValue); !ok {
		return nil, sql.ErrInvalidGISData.New(e.FunctionName())
	}

	l, ok := g.(types.LineString)
	if !ok {
		return nil, nil
	}

	return endPoint(l), nil
}

// IsClosed is a function that checks if a LineString or MultiLineString is close
type IsClosed struct {
	expression.UnaryExpression
}

var _ sql.FunctionExpression = (*IsClosed)(nil)
var _ sql.CollationCoercible = (*IsClosed)(nil)

// NewIsClosed creates a new EndPoint expression.
func NewIsClosed(arg sql.Expression) sql.Expression {
	return &IsClosed{expression.UnaryExpression{Child: arg}}
}

// FunctionName implements sql.FunctionExpression
func (i *IsClosed) FunctionName() string {
	return "st_isclosed"
}

// Description implements sql.FunctionExpression
func (i *IsClosed) Description() string {
	return "returns whether or not all LineStrings' start and end points are equal."
}

// Type implements the sql.Expression interface.
func (i *IsClosed) Type() sql.Type {
	return types.Boolean
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*IsClosed) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

func (i *IsClosed) String() string {
	return fmt.Sprintf("%s(%s)", i.FunctionName(), i.Child.String())
}

// WithChildren implements the Expression interface.
func (i *IsClosed) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidArgumentNumber.New(i.FunctionName(), "1", len(children))
	}
	return NewIsClosed(children[0]), nil
}

func isPointEqual(a, b types.Point) bool {
	return a.X == b.X && a.Y == b.Y
}

func isClosed(l types.LineString) bool {
	return isPointEqual(startPoint(l), endPoint(l))
}

// Eval implements the sql.Expression interface.
func (i *IsClosed) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	g, err := i.Child.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	if g == nil {
		return nil, nil
	}

	if _, ok := g.(types.GeometryValue); !ok {
		return nil, sql.ErrInvalidGISData.New(i.FunctionName())
	}

	switch g := g.(type) {
	case types.LineString:
		return isClosed(g), nil
	case types.MultiLineString:
		for _, l := range g.Lines {
			if !isClosed(l) {
				return false, nil
			}
		}
		return true, nil
	default:
		return nil, nil
	}
}
