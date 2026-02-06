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

package spatial

import (
	"fmt"
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// SRID is a function that returns SRID of Geometry object or returns a new object with altered SRID.
type SRID struct {
	expression.NaryExpression
}

var _ sql.FunctionExpression = (*SRID)(nil)
var _ sql.CollationCoercible = (*SRID)(nil)

// NewSRID creates a new STX expression.
func NewSRID(args ...sql.Expression) (sql.Expression, error) {
	if len(args) != 1 && len(args) != 2 {
		return nil, sql.ErrInvalidArgumentNumber.New("ST_SRID", "1 or 2", len(args))
	}
	return &SRID{expression.NaryExpression{ChildExpressions: args}}, nil
}

// FunctionName implements sql.FunctionExpression
func (s *SRID) FunctionName() string {
	return "st_srid"
}

// Description implements sql.FunctionExpression
func (s *SRID) Description() string {
	return "returns the SRID value of given geometry object. If given a second argument, returns a new geometry object with second argument as SRID value."
}

// Type implements the sql.Expression interface.
func (s *SRID) Type() sql.Type {
	if len(s.ChildExpressions) == 1 {
		return types.Int32
	} else {
		return s.ChildExpressions[0].Type()
	}
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*SRID) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

func (s *SRID) String() string {
	var args = make([]string, len(s.ChildExpressions))
	for i, arg := range s.ChildExpressions {
		args[i] = arg.String()
	}
	return fmt.Sprintf("ST_SRID(%s)", strings.Join(args, ","))
}

// WithChildren implements the Expression interface.
func (s *SRID) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return NewSRID(children...)
}

// Eval implements the sql.Expression interface.
func (s *SRID) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	g, err := s.ChildExpressions[0].Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	if g == nil {
		return nil, nil
	}

	// If just one argument, return SRID
	if len(s.ChildExpressions) == 1 {
		switch g := g.(type) {
		case types.GeometryValue:
			return g.GetSRID(), nil
		default:
			return nil, sql.ErrIllegalGISValue.New(g)
		}
	}

	v, err := s.ChildExpressions[1].Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	if v == nil {
		return nil, nil
	}

	val, _, err := types.Int64.Convert(ctx, v)
	if err != nil {
		return nil, err
	}

	if err = types.ValidateSRID(int(val.(int64)), s.FunctionName()); err != nil {
		return nil, err
	}
	srid := uint32(val.(int64))

	// Create new geometry object with matching SRID
	switch g := g.(type) {
	case types.GeometryValue:
		return g.SetSRID(srid), nil
	default:
		return nil, sql.ErrIllegalGISValue.New(g)
	}
}
