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

package function

import (
	"fmt"

	"github.com/dolthub/go-mysql-server/sql/types"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
)

// Collation is a function that returns the collation of the inner expression.
type Collation struct {
	expression.UnaryExpression
}

var _ sql.FunctionExpression = (*Collation)(nil)
var _ sql.CollationCoercible = (*Collation)(nil)

// NewCollation creates a new Collation expression.
func NewCollation(e sql.Expression) sql.Expression {
	return &Collation{expression.UnaryExpression{Child: e}}
}

// FunctionName implements sql.FunctionExpression
func (c *Collation) FunctionName() string {
	return "collation"
}

// Description implements sql.FunctionExpression
func (c *Collation) Description() string {
	return "Returns the collation of the inner expression"
}

// Eval implements the sql.Expression.
func (c *Collation) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	val, err := c.Child.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	// If the value is nil, then we return 'binary'
	if val == nil {
		return sql.Collation_binary.Name(), nil
	}
	// Otherwise, we return the collation calculated from the expression
	collation, _ := sql.GetCoercibility(ctx, c.Child)
	return collation.Name(), nil
}

// String implements the fmt.Stringer interface.
func (c *Collation) String() string {
	return fmt.Sprintf("%s(%s)", c.FunctionName(), c.Child.String())
}

// WithChildren implements the Expression interface.
func (c *Collation) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(c, len(children), 1)
	}
	return NewCollation(children[0]), nil
}

// Type implements the Expression interface.
func (c *Collation) Type() sql.Type {
	return types.LongText
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*Collation) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_utf8mb3_general_ci, 4
}

// Coercibility is a function that returns the coercibility of the inner expression.
type Coercibility struct {
	expression.UnaryExpression
}

var _ sql.FunctionExpression = (*Coercibility)(nil)
var _ sql.CollationCoercible = (*Coercibility)(nil)

// NewCoercibility creates a new Coercibility expression.
func NewCoercibility(e sql.Expression) sql.Expression {
	return &Coercibility{expression.UnaryExpression{Child: e}}
}

// FunctionName implements sql.FunctionExpression
func (c *Coercibility) FunctionName() string {
	return "coercibility"
}

// Description implements sql.FunctionExpression
func (c *Coercibility) Description() string {
	return "Returns the coercibility of the inner expression"
}

// Eval implements the sql.Expression.
func (c *Coercibility) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	val, err := c.Child.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	// If the value is nil, then we return 'binary'
	if val == nil {
		return 6, nil
	}
	// Otherwise, we return the collation calculated from the expression
	_, coercibility := sql.GetCoercibility(ctx, c.Child)
	return coercibility, nil
}

// String implements the fmt.Stringer interface.
func (c *Coercibility) String() string {
	return fmt.Sprintf("%s(%s)", c.FunctionName(), c.Child.String())
}

// WithChildren implements the Expression interface.
func (c *Coercibility) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(c, len(children), 1)
	}
	return NewCoercibility(children[0]), nil
}

// Type implements the Expression interface.
func (c *Coercibility) Type() sql.Type {
	return types.Int8
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*Coercibility) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// Charset is a function that returns the character set of the inner expression.
type Charset struct {
	expression.UnaryExpression
}

var _ sql.FunctionExpression = (*Charset)(nil)
var _ sql.CollationCoercible = (*Charset)(nil)

// NewCharset creates a new Charset expression.
func NewCharset(e sql.Expression) sql.Expression {
	return &Charset{expression.UnaryExpression{Child: e}}
}

// FunctionName implements sql.FunctionExpression
func (c *Charset) FunctionName() string {
	return "charset"
}

// Description implements sql.FunctionExpression
func (c *Charset) Description() string {
	return "Returns the charset of the inner expression"
}

// Eval implements the sql.Expression.
func (c *Charset) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	val, err := c.Child.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	// If the value is nil, then we return 'binary'
	if val == nil {
		return sql.CharacterSet_binary.Name(), nil
	}
	// Otherwise, we return the character set calculated from the expression
	collation, _ := sql.GetCoercibility(ctx, c.Child)
	return collation.CharacterSet().Name(), nil
}

// String implements the fmt.Stringer interface.
func (c *Charset) String() string {
	return fmt.Sprintf("%s(%s)", c.FunctionName(), c.Child.String())
}

// WithChildren implements the Expression interface.
func (c *Charset) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(c, len(children), 1)
	}
	return NewCharset(children[0]), nil
}

// Type implements the Expression interface.
func (c *Charset) Type() sql.Type {
	return types.LongText
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*Charset) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_utf8mb3_general_ci, 4
}
