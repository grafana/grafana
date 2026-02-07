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

// GeomColl is a function that returns a GeometryCollection.
type GeomColl struct {
	expression.NaryExpression
}

var _ sql.FunctionExpression = (*GeomColl)(nil)
var _ sql.CollationCoercible = (*GeomColl)(nil)

// NewGeomColl creates a new geometrycollection expression.
func NewGeomColl(args ...sql.Expression) (sql.Expression, error) {
	return &GeomColl{expression.NaryExpression{ChildExpressions: args}}, nil
}

// FunctionName implements sql.FunctionExpression
func (g *GeomColl) FunctionName() string {
	return "geometrycollection"
}

// Description implements sql.FunctionExpression
func (g *GeomColl) Description() string {
	return "returns a new geometrycollection."
}

// Type implements the sql.Expression interface.
func (g *GeomColl) Type() sql.Type {
	return types.GeomCollType{}
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*GeomColl) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

func (g *GeomColl) String() string {
	var args = make([]string, len(g.ChildExpressions))
	for i, arg := range g.ChildExpressions {
		args[i] = arg.String()
	}
	return fmt.Sprintf("geomcoll(%s)", strings.Join(args, ","))
}

// WithChildren implements the Expression interface.
func (g *GeomColl) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return NewGeomColl(children...)
}

// Eval implements the sql.Expression interface.
func (g *GeomColl) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	var geoms = make([]types.GeometryValue, len(g.ChildExpressions))
	for i, arg := range g.ChildExpressions {
		val, err := arg.Eval(ctx, row)
		if err != nil {
			return nil, err
		}
		switch v := val.(type) {
		case types.GeometryValue:
			geoms[i] = v
		default:
			return nil, sql.ErrIllegalGISValue.New(v)
		}
	}

	return types.GeomColl{Geoms: geoms}, nil
}
