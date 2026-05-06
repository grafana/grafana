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

package function

import (
	"fmt"

	"github.com/dolthub/vitess/go/mysql"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// GtidSubtract implements MySQL's built-in gtid_subtract() function.
// https://dev.mysql.com/doc/refman/8.0/en/gtid-functions.html#function_gtid-subtract
type GtidSubtract struct {
	gtid1 sql.Expression
	gtid2 sql.Expression
}

var _ sql.FunctionExpression = (*GtidSubtract)(nil)
var _ sql.CollationCoercible = (*GtidSubtract)(nil)

func NewGtidSubtract(gtid1, gtid2 sql.Expression) sql.Expression {
	return &GtidSubtract{gtid1, gtid2}
}

// FunctionName implements sql.FunctionExpression
func (gs *GtidSubtract) FunctionName() string {
	return "gtid_subtract"
}

// Description implements sql.FunctionExpression
func (gs *GtidSubtract) Description() string {
	return "Given two sets of global transaction identifiers set1 and set2, " +
		"returns only those GTIDs from set1 that are not in set2. Returns NULL if set1 or set2 is NULL."
}

// Type implements the Expression interface.
func (gs *GtidSubtract) Type() sql.Type { return types.LongText }

// CollationCoercibility implements the interface sql.CollationCoercible.
func (gs *GtidSubtract) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	collation, coercibility = sql.GetCoercibility(ctx, gs.gtid1)
	nextCollation, nextCoercibility := sql.GetCoercibility(ctx, gs.gtid2)
	return sql.ResolveCoercibility(collation, coercibility, nextCollation, nextCoercibility)
}

// IsNullable implements the Expression interface.
func (gs *GtidSubtract) IsNullable() bool {
	return gs.gtid1.IsNullable() || gs.gtid2.IsNullable()
}

func (gs *GtidSubtract) String() string {
	return fmt.Sprintf("%s(%s, %s)", gs.FunctionName(), gs.gtid1, gs.gtid2)
}

func (gs *GtidSubtract) DebugString() string {
	return fmt.Sprintf("%s(%s, %s)", gs.FunctionName(), gs.gtid1, gs.gtid2)
}

// WithChildren implements the Expression interface.
func (gs *GtidSubtract) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 2 {
		return nil, sql.ErrInvalidChildrenNumber.New(gs, len(children), 2)
	}
	return NewGtidSubtract(children[0], children[1]), nil
}

// Resolved implements the Expression interface.
func (gs *GtidSubtract) Resolved() bool {
	return gs.gtid1.Resolved() && gs.gtid2.Resolved()
}

// Children implements the Expression interface.
func (gs *GtidSubtract) Children() []sql.Expression {
	return []sql.Expression{gs.gtid1, gs.gtid2}
}

// Eval implements the Expression interface.
func (gs *GtidSubtract) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	if gs.gtid1 == nil || gs.gtid2 == nil {
		return nil, nil
	}

	left, err := gs.gtid1.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	if left == nil {
		return nil, nil
	}

	right, err := gs.gtid2.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	if right == nil {
		return nil, nil
	}

	if _, ok := left.(string); !ok {
		return nil, sql.ErrInvalidType.New(gs.gtid1)
	}
	if _, ok := right.(string); !ok {
		return nil, sql.ErrInvalidType.New(gs.gtid2)
	}

	gtidSet1, err := mysql.ParseMysql56GTIDSet(left.(string))
	if err != nil {
		return nil, err
	}

	gtidSet2, err := mysql.ParseMysql56GTIDSet(right.(string))
	if err != nil {
		return nil, err
	}

	newGtidSet := gtidSet1.Subtract(gtidSet2)
	return newGtidSet.String(), nil
}
