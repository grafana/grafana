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
	"math"
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// STLength is a function that returns the STLength of a LineString
type STLength struct {
	expression.NaryExpression
}

var _ sql.FunctionExpression = (*STLength)(nil)
var _ sql.CollationCoercible = (*STLength)(nil)

// NewSTLength creates a new STLength expression.
func NewSTLength(args ...sql.Expression) (sql.Expression, error) {
	if len(args) != 1 && len(args) != 2 {
		return nil, sql.ErrInvalidArgumentNumber.New("ST_LENGTH", "1 or 2", len(args))
	}
	return &STLength{expression.NaryExpression{ChildExpressions: args}}, nil
}

// FunctionName implements sql.FunctionExpression
func (s *STLength) FunctionName() string {
	return "st_length"
}

// Description implements sql.FunctionExpression
func (s *STLength) Description() string {
	return "returns the length of the given linestring. If given a unit argument, will return the length in those units"
}

// Type implements the sql.Expression interface.
func (s *STLength) Type() sql.Type {
	return types.Float64
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*STLength) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

func (s *STLength) String() string {
	var args = make([]string, len(s.ChildExpressions))
	for i, arg := range s.ChildExpressions {
		args[i] = arg.String()
	}
	return fmt.Sprintf("%s(%s)", s.FunctionName(), strings.Join(args, ","))
}

// WithChildren implements the Expression interface.
func (s *STLength) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return NewSTLength(children...)
}

// calculateLength sums up the line segments formed from a LineString
func calculateLength(l types.LineString) float64 {
	var length float64
	for i := 0; i < len(l.Points)-1; i++ {
		p1 := l.Points[i]
		p2 := l.Points[i+1]
		length += math.Sqrt(math.Pow(p2.X-p1.X, 2) + math.Pow(p2.Y-p1.Y, 2))
	}
	return length
}

// Eval implements the sql.Expression interface.
func (s *STLength) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	// Evaluate first argument
	v1, err := s.ChildExpressions[0].Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	// Return nil if argument is nil
	if v1 == nil {
		return nil, nil
	}

	// Return nil if argument is geometry typ, but not linestring
	var l types.LineString
	switch v := v1.(type) {
	case types.LineString:
		l = v
	case types.Point, types.Polygon:
		return nil, nil
	default:
		return nil, sql.ErrInvalidGISData.New(s.FunctionName())
	}

	// TODO: if SRID is not 0, find geodetic distance
	// If just one argument, return length
	if len(s.ChildExpressions) == 1 {
		return calculateLength(l), nil
	}

	// TODO: support geodetic distance
	return nil, sql.ErrUnsupportedFeature.New("st_length with non-zero SRID")
}
