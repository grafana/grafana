// Copyright 2024 Dolthub, Inc.
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

	"github.com/dolthub/vitess/go/sqltypes"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// AutoUuid is an expression that captures an automatically generated UUID value and stores it in the session for
// later retrieval. AutoUuid is intended to only be used directly on top of a UUID function.
type AutoUuid struct {
	UnaryExpression
	uuidCol   *sql.Column
	foundUuid bool
}

var _ sql.Expression = (*AutoUuid)(nil)
var _ sql.CollationCoercible = (*AutoUuid)(nil)

// NewAutoUuid creates a new AutoUuid expression. The |child| expression must be a function.UUIDFunc, but
// because of package import cycles, we can't enforce that directly here.
func NewAutoUuid(_ *sql.Context, col *sql.Column, child sql.Expression) *AutoUuid {
	return &AutoUuid{
		UnaryExpression: UnaryExpression{Child: child},
		uuidCol:         col,
	}
}

// IsNullable implements the Expression interface.
func (au *AutoUuid) IsNullable() bool {
	return false
}

// Type implements the Expression interface.
func (au *AutoUuid) Type() sql.Type {
	return types.MustCreateString(sqltypes.Char, 36, sql.Collation_Default)
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (au *AutoUuid) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.GetCoercibility(ctx, au.Child)
}

// Eval implements the Expression interface.
func (au *AutoUuid) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	childResult, err := au.Child.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	if !au.foundUuid {
		uuidValue, ok := childResult.(string)
		if !ok {
			// This should never happen – AutoUuid should only ever be placed directly above a UUID function,
			// so the result from eval'ing its child should *always* be a string.
			return nil, fmt.Errorf("unexpected type for UUID value: %T", childResult)
		}

		// TODO: Setting this here means that another call to last_insert_uuid() in the same statement could
		//       read this value too early. We should verify this isn't how MySQL behaves, and then could fix
		//       by setting a PENDING_LAST_INSERT_UUID value in the session query info, then moving it to
		//       LAST_INSERT_UUID in the session query info at the end of execution.
		ctx.Session.SetLastQueryInfoString(sql.LastInsertUuid, uuidValue)
		au.foundUuid = true
	}

	return childResult, nil
}

func (au *AutoUuid) String() string {
	return fmt.Sprintf("AutoUuid(%s)", au.Child.String())
}

// WithChildren implements the Expression interface.
func (au *AutoUuid) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(au, len(children), 1)
	}
	return &AutoUuid{
		UnaryExpression: UnaryExpression{Child: children[0]},
		uuidCol:         au.uuidCol,
		foundUuid:       au.foundUuid,
	}, nil
}

// Children implements the Expression interface.
func (au *AutoUuid) Children() []sql.Expression {
	return []sql.Expression{au.Child}
}
