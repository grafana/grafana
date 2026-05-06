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
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// Concat joins several strings together.
type Concat struct {
	args []sql.Expression
}

var _ sql.FunctionExpression = (*Concat)(nil)
var _ sql.CollationCoercible = (*Concat)(nil)

// NewConcat creates a new Concat UDF.
func NewConcat(args ...sql.Expression) (sql.Expression, error) {
	if len(args) == 0 {
		return nil, sql.ErrInvalidArgumentNumber.New("CONCAT", "1 or more", 0)
	}

	return &Concat{args}, nil
}

// FunctionName implements sql.FunctionExpression
func (c *Concat) FunctionName() string {
	return "concat"
}

// Description implements sql.FunctionExpression
func (c *Concat) Description() string {
	return "concatenates any group of fields into a single string."
}

// Type implements the Expression interface.
func (c *Concat) Type() sql.Type { return types.LongText }

// CollationCoercibility implements the interface sql.CollationCoercible.
func (c *Concat) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	if len(c.args) == 0 {
		return sql.Collation_binary, 6
	}
	collation, coercibility = sql.GetCoercibility(ctx, c.args[0])
	for i := 1; i < len(c.args); i++ {
		nextCollation, nextCoercibility := sql.GetCoercibility(ctx, c.args[i])
		collation, coercibility = sql.ResolveCoercibility(collation, coercibility, nextCollation, nextCoercibility)
	}
	return collation, coercibility
}

// IsNullable implements the Expression interface.
func (c *Concat) IsNullable() bool {
	for _, arg := range c.args {
		if arg.IsNullable() {
			return true
		}
	}
	return false
}

func (c *Concat) String() string {
	var args = make([]string, len(c.args))
	for i, arg := range c.args {
		args[i] = arg.String()
	}
	return fmt.Sprintf("%s(%s)", c.FunctionName(), strings.Join(args, ","))
}

func (c *Concat) DebugString() string {
	var args = make([]string, len(c.args))
	for i, arg := range c.args {
		args[i] = sql.DebugString(arg)
	}
	return fmt.Sprintf("%s(%s)", c.FunctionName(), strings.Join(args, ","))
}

// WithChildren implements the Expression interface.
func (*Concat) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return NewConcat(children...)
}

// Resolved implements the Expression interface.
func (c *Concat) Resolved() bool {
	for _, arg := range c.args {
		if !arg.Resolved() {
			return false
		}
	}
	return true
}

// Children implements the Expression interface.
func (c *Concat) Children() []sql.Expression { return c.args }

// Eval implements the Expression interface.
func (c *Concat) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	var parts []string

	for _, arg := range c.args {
		val, err := arg.Eval(ctx, row)
		if err != nil {
			return nil, err
		}

		if val == nil {
			return nil, nil
		}

		// Use type-aware conversion for enum types
		content, _, err := types.ConvertToCollatedString(ctx, val, arg.Type())
		if err != nil {
			return nil, err
		}

		parts = append(parts, content)
	}

	return strings.Join(parts, ""), nil
}
