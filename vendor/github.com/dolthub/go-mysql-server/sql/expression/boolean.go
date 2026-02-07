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

package expression

import (
	"fmt"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// Not is a node that negates an expression.
type Not struct {
	UnaryExpression
}

var _ sql.Expression = (*Not)(nil)
var _ sql.CollationCoercible = (*Not)(nil)

// NewNot returns a new Not node.
func NewNot(child sql.Expression) *Not {
	return &Not{UnaryExpression{child}}
}

// Type implements the Expression interface.
func (e *Not) Type() sql.Type {
	if types.IsNull(e.Child) {
		return types.Null
	}
	return types.Boolean
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*Not) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// Eval implements the Expression interface.
func (e *Not) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	v, err := e.Child.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	if v == nil {
		return nil, nil
	}

	b, ok := v.(bool)
	if !ok {
		b, err = sql.ConvertToBool(ctx, v)
		if err != nil {
			return nil, err
		}
	}

	return !b, nil
}

func (e *Not) String() string {
	return fmt.Sprintf("(NOT(%s))", e.Child)
}

func (e *Not) DebugString() string {
	pr := sql.NewTreePrinter()
	_ = pr.WriteNode("NOT")
	children := []string{sql.DebugString(e.Child)}
	_ = pr.WriteChildren(children...)
	return pr.String()
}

// WithChildren implements the Expression interface.
func (e *Not) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(e, len(children), 1)
	}
	return NewNot(children[0]), nil
}
