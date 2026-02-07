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

	"gopkg.in/src-d/go-errors.v1"

	"github.com/dolthub/go-mysql-server/sql"
)

var (
	// ErrAutoIncrementUnsupported is returned when table does not support AUTO_INCREMENT.
	ErrAutoIncrementUnsupported = errors.NewKind("table %s does not support AUTO_INCREMENT columns")
	// ErrNoAutoIncrementCols is returned when table has no AUTO_INCREMENT columns.
	ErrNoAutoIncrementCols = errors.NewKind("table %s has no AUTO_INCREMENT columns")
)

// AutoIncrement implements AUTO_INCREMENT
type AutoIncrement struct {
	UnaryExpression
	autoTbl sql.AutoIncrementTable
	autoCol *sql.Column
}

var _ sql.Expression = (*AutoIncrement)(nil)
var _ sql.CollationCoercible = (*AutoIncrement)(nil)

// NewAutoIncrement creates a new AutoIncrement expression.
func NewAutoIncrement(ctx *sql.Context, table sql.Table, given sql.Expression) (*AutoIncrement, error) {
	autoTbl, ok := table.(sql.AutoIncrementTable)
	if !ok {
		return nil, ErrAutoIncrementUnsupported.New(table.Name())
	}

	var autoCol *sql.Column
	for _, c := range autoTbl.Schema() {
		if c.AutoIncrement {
			autoCol = c
			break
		}
	}
	if autoCol == nil {
		return nil, ErrNoAutoIncrementCols.New(table.Name())
	}

	return &AutoIncrement{
		UnaryExpression{Child: given},
		autoTbl,
		autoCol,
	}, nil
}

// NewAutoIncrementForColumn creates a new AutoIncrement expression for the column given.
func NewAutoIncrementForColumn(ctx *sql.Context, table sql.Table, autoCol *sql.Column, given sql.Expression) (*AutoIncrement, error) {
	autoTbl, ok := table.(sql.AutoIncrementTable)
	if !ok {
		return nil, ErrAutoIncrementUnsupported.New(table.Name())
	}

	return &AutoIncrement{
		UnaryExpression{Child: given},
		autoTbl,
		autoCol,
	}, nil
}

// IsNullable implements the Expression interface.
func (i *AutoIncrement) IsNullable() bool {
	return false
}

// Type implements the Expression interface.
func (i *AutoIncrement) Type() sql.Type {
	return i.autoCol.Type
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (i *AutoIncrement) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.GetCoercibility(ctx, i.Child)
}

// Eval implements the Expression interface.
func (i *AutoIncrement) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	// get value provided by INSERT
	given, err := i.Child.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	// When a row passes in 0 as the auto_increment value it is equivalent to NULL.
	cmp, err := i.Type().Compare(ctx, given, i.Type().Zero())
	if err != nil {
		return nil, err
	}

	// if given is negative, don't do any auto_increment logic
	if cmp < 0 {
		ret, _, err := i.Type().Convert(ctx, given)
		if err != nil {
			return nil, err
		}
		return ret, nil
	}

	if cmp == 0 {
		if sql.LoadSqlMode(ctx).ModeEnabled(sql.NoAutoValueOnZero) {
			ret, _, err := i.Type().Convert(ctx, given)
			if err != nil {
				return nil, err
			}
			return ret, nil
		}
		// if given is 0, it is equivalent to NULL
		given = nil
	}

	// Update integrator AUTO_INCREMENT sequence with our value
	seq, err := i.autoTbl.GetNextAutoIncrementValue(ctx, given)
	if err != nil {
		return nil, err
	}

	// Use sequence value if NULL or 0 were provided
	if given == nil {
		given = seq
	}

	ret, inRange, err := i.Type().Convert(ctx, given)
	if err == nil && !inRange {
		err = sql.ErrValueOutOfRange.New(given, i.Type())
	}
	if err != nil {
		return nil, err
	}
	return ret, nil
}

func (i *AutoIncrement) String() string {
	return fmt.Sprintf("AutoIncrement(%s)", i.Child.String())
}

// WithChildren implements the Expression interface.
func (i *AutoIncrement) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(i, len(children), 1)
	}
	return &AutoIncrement{
		UnaryExpression{Child: children[0]},
		i.autoTbl,
		i.autoCol,
	}, nil
}

// Children implements the Expression interface.
func (i *AutoIncrement) Children() []sql.Expression {
	return []sql.Expression{i.Child}
}
