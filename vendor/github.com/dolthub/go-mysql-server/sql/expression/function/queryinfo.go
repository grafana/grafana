// Copyright 2021-2024 Dolthub, Inc.
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

	"github.com/dolthub/vitess/go/sqltypes"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// RowCount implements the ROW_COUNT() function
type RowCount struct{}

func NewRowCount() sql.Expression {
	return &RowCount{}
}

var _ sql.FunctionExpression = &RowCount{}
var _ sql.CollationCoercible = &RowCount{}

// Description implements sql.FunctionExpression
func (r *RowCount) Description() string {
	return "returns the number of rows updated."
}

// Resolved implements sql.Expression
func (r *RowCount) Resolved() bool {
	return true
}

// String implements sql.Expression
func (r *RowCount) String() string {
	return fmt.Sprintf("%s()", r.FunctionName())
}

// Type implements sql.Expression
func (r *RowCount) Type() sql.Type {
	return types.Int64
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*RowCount) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// IsNullable implements sql.Expression
func (r *RowCount) IsNullable() bool {
	return false
}

// Eval implements sql.Expression
func (r *RowCount) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	return ctx.GetLastQueryInfoInt(sql.RowCount), nil
}

// Children implements sql.Expression
func (r *RowCount) Children() []sql.Expression {
	return nil
}

// WithChildren implements sql.Expression
func (r *RowCount) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return sql.NillaryWithChildren(r, children...)
}

// FunctionName implements sql.FunctionExpression
func (r *RowCount) FunctionName() string {
	return "row_count"
}

// IsNonDeterministic implements sql.NonDeterministicExpression
func (r *RowCount) IsNonDeterministic() bool {
	return true
}

// LastInsertUuid implements the LAST_INSERT_UUID() function. This function is
// NOT a standard function in MySQL, but is a useful analogue to LAST_INSERT_ID()
// if customers are inserting UUIDs into a table.
type LastInsertUuid struct{}

var _ sql.FunctionExpression = &LastInsertUuid{}
var _ sql.CollationCoercible = &LastInsertUuid{}

func NewLastInsertUuid(children ...sql.Expression) (sql.Expression, error) {
	if len(children) > 0 {
		return nil, sql.ErrInvalidChildrenNumber.New((&LastInsertUuid{}).String(), len(children), 0)
	}

	return &LastInsertUuid{}, nil
}

func (l *LastInsertUuid) CollationCoercibility(_ *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

func (l *LastInsertUuid) Resolved() bool {
	return true
}

func (l *LastInsertUuid) String() string {
	return fmt.Sprintf("%s()", l.FunctionName())
}

func (l *LastInsertUuid) Type() sql.Type {
	return types.MustCreateStringWithDefaults(sqltypes.VarChar, 36)
}

func (l *LastInsertUuid) IsNullable() bool {
	return false
}

func (l *LastInsertUuid) Eval(ctx *sql.Context, _ sql.Row) (interface{}, error) {
	lastInsertUuid := ctx.GetLastQueryInfoString(sql.LastInsertUuid)
	result, _, err := l.Type().Convert(ctx, lastInsertUuid)
	if err != nil {
		return nil, err
	}
	return result, nil
}

func (l *LastInsertUuid) Children() []sql.Expression {
	return nil
}

func (l *LastInsertUuid) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return NewLastInsertUuid(children...)
}

func (l *LastInsertUuid) FunctionName() string {
	return "last_insert_uuid"
}

func (l *LastInsertUuid) Description() string {
	return "returns the first value of the UUID() function from the last INSERT statement."
}

// LastInsertId implements the LAST_INSERT_ID() function
// https://dev.mysql.com/doc/refman/8.0/en/information-functions.html#function_last-insert-id
type LastInsertId struct {
	expression.UnaryExpression
}

func NewLastInsertId(children ...sql.Expression) (sql.Expression, error) {
	switch len(children) {
	case 0:
		return &LastInsertId{}, nil
	case 1:
		return &LastInsertId{UnaryExpression: expression.UnaryExpression{Child: children[0]}}, nil
	default:
		return nil, sql.ErrInvalidArgumentNumber.New("LastInsertId", len(children), 1)
	}
}

var _ sql.FunctionExpression = &LastInsertId{}
var _ sql.CollationCoercible = &LastInsertId{}

// Description implements sql.FunctionExpression
func (r *LastInsertId) Description() string {
	return "returns value of the AUTOINCREMENT column for the last INSERT."
}

// Resolved implements sql.Expression
func (r *LastInsertId) Resolved() bool {
	return true
}

// String implements sql.Expression
func (r *LastInsertId) String() string {
	return fmt.Sprintf("%s(%s)", r.FunctionName(), r.Child)
}

// Type implements sql.Expression
func (r *LastInsertId) Type() sql.Type {
	return types.Uint64
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*LastInsertId) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// IsNullable implements sql.Expression
func (r *LastInsertId) IsNullable() bool {
	return false
}

// Eval implements sql.Expression
func (r *LastInsertId) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	// With no arguments, just return the last insert id for this session
	if len(r.Children()) == 0 {
		lastInsertId := ctx.GetLastQueryInfoInt(sql.LastInsertId)
		unsigned, _, err := types.Uint64.Convert(ctx, lastInsertId)
		if err != nil {
			return nil, err
		}
		return unsigned, nil
	}

	// If an expression is provided, we set the next insert id for this session as well as returning it
	res, err := r.Child.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	id, _, err := types.Int64.Convert(ctx, res)
	if err != nil {
		return nil, err
	}

	ctx.SetLastQueryInfoInt(sql.LastInsertId, id.(int64))
	return id, nil
}

// Children implements sql.Expression
func (r *LastInsertId) Children() []sql.Expression {
	if r.Child == nil {
		return nil
	}
	return []sql.Expression{r.Child}
}

// WithChildren implements sql.Expression
func (r *LastInsertId) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return NewLastInsertId(children...)
}

// FunctionName implements sql.FunctionExpression
func (r *LastInsertId) FunctionName() string {
	return "last_insert_id"
}

// IsNonDeterministic implements sql.NonDeterministicExpression
func (r *LastInsertId) IsNonDeterministic() bool {
	return true
}

// FoundRows implements the FOUND_ROWS() function
type FoundRows struct{}

func NewFoundRows() sql.Expression {
	return &FoundRows{}
}

var _ sql.FunctionExpression = &FoundRows{}
var _ sql.CollationCoercible = &FoundRows{}

// FunctionName implements sql.FunctionExpression
func (r *FoundRows) FunctionName() string {
	return "found_rows"
}

// Description implements sql.Expression
func (r *FoundRows) Description() string {
	return "for a SELECT with a LIMIT clause, returns the number of rows that would be returned were there no LIMIT clause."
}

// Resolved implements sql.Expression
func (r *FoundRows) Resolved() bool {
	return true
}

// String implements sql.Expression
func (r *FoundRows) String() string {
	return fmt.Sprintf("%s()", r.FunctionName())
}

// Type implements sql.Expression
func (r *FoundRows) Type() sql.Type {
	return types.Int64
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*FoundRows) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// IsNullable implements sql.Expression
func (r *FoundRows) IsNullable() bool {
	return false
}

// Eval implements sql.Expression
func (r *FoundRows) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	return ctx.GetLastQueryInfoInt(sql.FoundRows), nil
}

// Children implements sql.Expression
func (r *FoundRows) Children() []sql.Expression {
	return nil
}

// WithChildren implements sql.Expression
func (r *FoundRows) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return sql.NillaryWithChildren(r, children...)
}

// IsNonDeterministic implements sql.NonDeterministicExpression
func (r *FoundRows) IsNonDeterministic() bool {
	return true
}
