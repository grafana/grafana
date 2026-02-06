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

package function

import (
	"fmt"
	"math"

	"github.com/dolthub/vitess/go/mysql"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// Sqrt is a function that returns the square value of the number provided.
type Sqrt struct {
	expression.UnaryExpression
}

var _ sql.FunctionExpression = (*Sqrt)(nil)
var _ sql.CollationCoercible = (*Sqrt)(nil)

// NewSqrt creates a new Sqrt expression.
func NewSqrt(e sql.Expression) sql.Expression {
	return &Sqrt{expression.UnaryExpression{Child: e}}
}

// FunctionName implements sql.FunctionExpression
func (s *Sqrt) FunctionName() string {
	return "sqrt"
}

// Description implements sql.FunctionExpression
func (s *Sqrt) Description() string {
	return "returns the square root of a nonnegative number X."
}

func (s *Sqrt) String() string {
	return fmt.Sprintf("sqrt(%s)", s.Child.String())
}

// Type implements the Expression interface.
func (s *Sqrt) Type() sql.Type {
	return types.Float64
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*Sqrt) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// IsNullable implements the Expression interface.
func (s *Sqrt) IsNullable() bool {
	return s.Child.IsNullable()
}

// WithChildren implements the Expression interface.
func (s *Sqrt) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(s, len(children), 1)
	}
	return NewSqrt(children[0]), nil
}

// Eval implements the Expression interface.
func (s *Sqrt) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	child, err := s.Child.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	if child == nil {
		return nil, nil
	}

	child, _, err = types.Float64.Convert(ctx, child)
	if err != nil {
		if !sql.ErrTruncatedIncorrect.Is(err) {
			return nil, err
		}
		ctx.Warn(mysql.ERTruncatedWrongValue, "%s", err.Error())
	}

	res := math.Sqrt(child.(float64))
	if math.IsNaN(res) || math.IsInf(res, 0) {
		return nil, nil
	}

	return res, nil
}

// Power is a function that returns value of X raised to the power of Y.
type Power struct {
	expression.BinaryExpressionStub
}

var _ sql.FunctionExpression = (*Power)(nil)
var _ sql.CollationCoercible = (*Power)(nil)

// NewPower creates a new Power expression.
func NewPower(e1, e2 sql.Expression) sql.Expression {
	return &Power{
		expression.BinaryExpressionStub{
			LeftChild:  e1,
			RightChild: e2,
		},
	}
}

// FunctionName implements sql.FunctionExpression
func (p *Power) FunctionName() string {
	return "power"
}

// Description implements sql.FunctionExpression
func (p *Power) Description() string {
	return "returns the value of X raised to the power of Y."
}

// Type implements the Expression interface.
func (p *Power) Type() sql.Type { return types.Float64 }

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*Power) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// IsNullable implements the Expression interface.
func (p *Power) IsNullable() bool { return p.LeftChild.IsNullable() || p.RightChild.IsNullable() }

func (p *Power) String() string {
	return fmt.Sprintf("power(%s, %s)", p.LeftChild, p.RightChild)
}

// WithChildren implements the Expression interface.
func (p *Power) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 2 {
		return nil, sql.ErrInvalidChildrenNumber.New(p, len(children), 2)
	}
	return NewPower(children[0], children[1]), nil
}

// Eval implements the Expression interface.
func (p *Power) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	left, err := p.LeftChild.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	if left == nil {
		return nil, nil
	}
	left, _, err = types.Float64.Convert(ctx, left)
	if err != nil {
		if !sql.ErrTruncatedIncorrect.Is(err) {
			return nil, err
		}
		ctx.Warn(mysql.ERTruncatedWrongValue, "%s", err.Error())
	}

	right, err := p.RightChild.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	if right == nil {
		return nil, nil
	}
	right, _, err = types.Float64.Convert(ctx, right)
	if err != nil {
		if !sql.ErrTruncatedIncorrect.Is(err) {
			return nil, err
		}
		ctx.Warn(mysql.ERTruncatedWrongValue, "%s", err.Error())
	}

	res := math.Pow(left.(float64), right.(float64))
	if math.IsNaN(res) || math.IsInf(res, 0) {
		return nil, nil
	}

	return res, nil
}
