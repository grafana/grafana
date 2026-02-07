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

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// IsNull is a function that returns whether a value is null or not.
type IsNull struct {
	expression.UnaryExpression
}

var _ sql.FunctionExpression = (*IsNull)(nil)
var _ sql.CollationCoercible = (*IsNull)(nil)

// NewIsNull creates a new IsNull expression.
func NewIsNull(e sql.Expression) sql.Expression {
	return &IsNull{expression.UnaryExpression{Child: e}}
}

// FunctionName implements sql.FunctionExpression
func (ib *IsNull) FunctionName() string {
	return "isnull"
}

// Description implements sql.FunctionExpression
func (ib *IsNull) Description() string {
	return "returns whether a expr is null or not."
}

// Eval implements the Expression interface.
func (ib *IsNull) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	v, err := ib.Child.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	if v != nil {
		return false, nil
	}

	return true, nil
}

func (ib *IsNull) String() string {
	return fmt.Sprintf("isnull(%s)", ib.Child)
}

// WithChildren implements the Expression interface.
func (ib *IsNull) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(ib, len(children), 1)
	}
	return NewIsNull(children[0]), nil
}

// Type implements the Expression interface.
func (ib *IsNull) Type() sql.Type {
	return types.Boolean
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*IsNull) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}
