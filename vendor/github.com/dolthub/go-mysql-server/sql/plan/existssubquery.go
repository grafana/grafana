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

package plan

import (
	"fmt"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// ExistsSubquery is an expression that checks that a subquery returns a non-empty result set. It's in the plan package,
// instead of the expression package, because Subquery is itself in the plan package (because it functions more like a
// plan node than an expression in its evaluation).
type ExistsSubquery struct {
	Query *Subquery
}

var _ sql.Expression = (*ExistsSubquery)(nil)
var _ sql.CollationCoercible = (*ExistsSubquery)(nil)

// NewExistsSubquery created an ExistsSubquery expression.
func NewExistsSubquery(sq *Subquery) *ExistsSubquery {
	return &ExistsSubquery{sq}
}

// Eval implements the Expression interface.
func (e *ExistsSubquery) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	hasResultRow, err := e.Query.HasResultRow(ctx, row)
	if err != nil {
		return nil, err
	}

	return hasResultRow, nil
}

// WithChildren implements the Expression interface.
func (e *ExistsSubquery) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(e, len(children), 1)
	}

	sq, ok := children[0].(*Subquery)
	if !ok {
		return nil, fmt.Errorf("expected subquery expression, found: %T", children[0])
	}
	ret := *e
	ret.Query = sq
	return &ret, nil
}

// Resolved implements the Expression interface.
func (e *ExistsSubquery) Resolved() bool {
	return e.Query.Resolved()
}

// IsNullable implements the Expression interface.
func (e *ExistsSubquery) IsNullable() bool {
	return false
}

// Children implements the Expression interface.
func (e *ExistsSubquery) Children() []sql.Expression {
	return []sql.Expression{e.Query}
}

// String implements the Expression interface.
func (e *ExistsSubquery) String() string {
	return fmt.Sprintf("EXISTS %s", e.Query)
}

// DebugString implements the Expression interface.
func (e *ExistsSubquery) DebugString() string {
	return fmt.Sprintf("EXISTS %s", sql.DebugString(e.Query))
}

// Type implements the Expression interface.
func (e *ExistsSubquery) Type() sql.Type {
	return types.Boolean
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*ExistsSubquery) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}
