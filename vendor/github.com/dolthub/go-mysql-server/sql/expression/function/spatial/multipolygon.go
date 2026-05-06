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

// MultiPolygon is a function that returns a MultiPolygon.
type MultiPolygon struct {
	expression.NaryExpression
}

var _ sql.FunctionExpression = (*MultiPolygon)(nil)
var _ sql.CollationCoercible = (*MultiPolygon)(nil)

// NewMultiPolygon creates a new multipolygon expression.
func NewMultiPolygon(args ...sql.Expression) (sql.Expression, error) {
	if len(args) < 1 {
		return nil, sql.ErrInvalidArgumentNumber.New("MultiPolygon", "1 or more", len(args))
	}
	return &MultiPolygon{expression.NaryExpression{ChildExpressions: args}}, nil
}

// FunctionName implements sql.FunctionExpression
func (p *MultiPolygon) FunctionName() string {
	return "multipolygon"
}

// Description implements sql.FunctionExpression
func (p *MultiPolygon) Description() string {
	return "returns a new multipolygon."
}

// Type implements the sql.Expression interface.
func (p *MultiPolygon) Type() sql.Type {
	return types.MultiPolygonType{}
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*MultiPolygon) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

func (p *MultiPolygon) String() string {
	var args = make([]string, len(p.ChildExpressions))
	for i, arg := range p.ChildExpressions {
		args[i] = arg.String()
	}
	return fmt.Sprintf("%s(%s)", p.FunctionName(), strings.Join(args, ","))
}

// WithChildren implements the Expression interface.
func (p *MultiPolygon) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return NewMultiPolygon(children...)
}

// Eval implements the sql.Expression interface.
func (p *MultiPolygon) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	var polys = make([]types.Polygon, len(p.ChildExpressions))
	for i, arg := range p.ChildExpressions {
		val, err := arg.Eval(ctx, row)
		if err != nil {
			return nil, err
		}
		switch v := val.(type) {
		case types.Polygon:
			polys[i] = v
		case types.GeometryValue:
			return nil, sql.ErrInvalidArgumentDetails.New(p.FunctionName(), v)
		default:
			return nil, sql.ErrIllegalGISValue.New(v)
		}
	}

	return types.MultiPolygon{Polygons: polys}, nil
}
