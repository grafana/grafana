// Copyright 2021 Dolthub, Inc.
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
	"github.com/dolthub/go-mysql-server/sql/types"
)

type ConvertTz struct {
	dt     sql.Expression
	fromTz sql.Expression
	toTz   sql.Expression
}

var _ sql.FunctionExpression = (*ConvertTz)(nil)
var _ sql.CollationCoercible = (*ConvertTz)(nil)

// NewConvertTz returns an implementation of the CONVERT_TZ() function.
func NewConvertTz(dt, fromTz, toTz sql.Expression) sql.Expression {
	return &ConvertTz{
		dt:     dt,
		fromTz: fromTz,
		toTz:   toTz,
	}
}

// FunctionName implements sql.FunctionExpression
func (c *ConvertTz) FunctionName() string {
	return "convert_tz"
}

// Description implements the sql.FunctionExpression interface.
func (c *ConvertTz) Description() string {
	return "converts a datetime value dt from the time zone given by from_tz to the time zone given by to_tz and returns the resulting value."
}

// Resolved implements the sql.Expression interface.
func (c *ConvertTz) Resolved() bool {
	return c.dt.Resolved() && c.fromTz.Resolved() && c.toTz.Resolved()
}

// String implements the sql.Expression interface.
func (c *ConvertTz) String() string {
	return fmt.Sprintf("%s(%s,%s,%s)", c.FunctionName(), c.dt, c.fromTz, c.toTz)
}

// Type implements the sql.Expression interface.
func (c *ConvertTz) Type() sql.Type {
	return types.DatetimeMaxPrecision
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*ConvertTz) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// IsNullable implements the sql.Expression interface.
func (c *ConvertTz) IsNullable() bool {
	return true
}

// Eval implements the sql.Expression interface.
func (c *ConvertTz) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	from, err := c.fromTz.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	to, err := c.toTz.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	dt, err := c.dt.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	// If either the date, or the timezones/offsets are not correct types we return NULL.
	datetime, err := types.DatetimeMaxPrecision.ConvertWithoutRangeCheck(ctx, dt)
	if err != nil {
		return nil, nil
	}

	fromStr, ok := from.(string)
	if !ok {
		return nil, nil
	}

	if fromStr == "SYSTEM" {
		fromStr = sql.SystemTimezoneOffset()
	}

	toStr, ok := to.(string)
	if !ok {
		return nil, nil
	}

	if toStr == "SYSTEM" {
		toStr = sql.SystemTimezoneOffset()
	}

	converted, success := sql.ConvertTimeZone(datetime, fromStr, toStr)
	if !success {
		return nil, nil
	}

	return types.DatetimeMaxPrecision.ConvertWithoutRangeCheck(ctx, converted)
}

// Children implements the sql.Expression interface.
func (c *ConvertTz) Children() []sql.Expression {
	return []sql.Expression{c.dt, c.fromTz, c.toTz}
}

// WithChildren implements the sql.Expression interface.
func (c *ConvertTz) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 3 {
		return nil, sql.ErrInvalidChildrenNumber.New(c, len(children), 3)
	}

	return NewConvertTz(children[0], children[1], children[2]), nil
}
