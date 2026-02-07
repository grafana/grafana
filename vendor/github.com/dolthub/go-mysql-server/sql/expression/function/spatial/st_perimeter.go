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

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// Perimeter is a function that returns the Perimeter of a Polygon
// Not in MySQL, basing off: https://postgis.net/docs/ST_Perimeter.html
type Perimeter struct {
	expression.NaryExpression
}

var _ sql.FunctionExpression = (*Perimeter)(nil)
var _ sql.CollationCoercible = (*Perimeter)(nil)

// NewSTLength creates a new STX expression.
func NewPerimeter(args ...sql.Expression) (sql.Expression, error) {
	if len(args) != 1 && len(args) != 2 {
		return nil, sql.ErrInvalidArgumentNumber.New("ST_PERIMETER", "1 or 2", len(args))
	}
	return &Perimeter{expression.NaryExpression{ChildExpressions: args}}, nil
}

// FunctionName implements sql.FunctionExpression
func (p *Perimeter) FunctionName() string {
	return "st_perimeter"
}

// Description implements sql.FunctionExpression
func (p *Perimeter) Description() string {
	return "returns the perimeter of the given polygon. If given a second argument, will find perimeter projected on spheroid."
}

// Type implements the sql.Expression interface.
func (p *Perimeter) Type() sql.Type {
	return types.Float64
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*Perimeter) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

func (p *Perimeter) String() string {
	var args = make([]string, len(p.ChildExpressions))
	for i, arg := range p.ChildExpressions {
		args[i] = arg.String()
	}
	return fmt.Sprintf("%s(%s)", p.FunctionName(), strings.Join(args, ","))
}

// WithChildren implements the Expression interface.
func (p *Perimeter) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return NewPerimeter(children...)
}

// Eval implements the sql.Expression interface.
func (p *Perimeter) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	// Evaluate argument
	v1, err := p.ChildExpressions[0].Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	// Return nil if argument is nil
	if v1 == nil {
		return nil, nil
	}

	// Argument must be a polygon
	poly, ok := v1.(types.Polygon)
	if !ok {
		return nil, sql.ErrInvalidArgument.New(p.FunctionName())
	}

	// TODO: if SRID is not 0, find geodetic distance
	// If just one argument, return length
	if len(p.ChildExpressions) == 1 {
		var perimeter float64
		for _, l := range poly.Lines {
			perimeter += calculateLength(l)
		}
		return perimeter, nil
	}

	// TODO: support perimeter along spheroid
	return nil, sql.ErrUnsupportedFeature.New("st_perimeter on spheroid")
}
