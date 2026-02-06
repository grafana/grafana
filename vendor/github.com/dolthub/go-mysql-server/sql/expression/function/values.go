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
)

// Values is used in an ON DUPLICATE KEY UPDATE statement to return the value stated in the to-be-inserted column.
// For example, given the following statement:
// INSERT INTO table (pk, v1, v2) VALUES (1, 3, 5), (2, 4, 6) ON DUPLICATE KEY UPDATE v2 = values(v1) * 10;
// the values inserted into v2 would be 30 and 40.
type Values struct {
	expression.UnaryExpression
	Value interface{}
}

var _ sql.FunctionExpression = (*Values)(nil)
var _ sql.CollationCoercible = (*Values)(nil)

// NewValues creates a new Values function.
func NewValues(col sql.Expression) sql.Expression {
	return &Values{
		UnaryExpression: expression.UnaryExpression{Child: col},
		Value:           nil,
	}
}

// Eval implements sql.FunctionExpression.
func (v *Values) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	// If Value is never assigned to then it has the nil value. It will only be assigned to in the ON DUPLICATE KEY UPDATE
	// statement, therefore when used in every other context it will return nil, which is the correct and intended behavior.
	return v.Value, nil
}

// FunctionName implements sql.FunctionExpression.
func (v *Values) FunctionName() string {
	return "values"
}

// Description implements sql.FunctionExpression.
func (v *Values) Description() string {
	return "defines the values to be used during an INSERT."
}

// String implements sql.FunctionExpression.
func (v *Values) String() string {
	return fmt.Sprintf("%s(%s)", v.FunctionName(), v.Child.String())
}

// Type implements sql.FunctionExpression.
func (v *Values) Type() sql.Type {
	return v.Child.Type()
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (v *Values) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.GetCoercibility(ctx, v.Child)
}

// WithChildren implements sql.FunctionExpression.
func (v *Values) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(v, len(children), 1)
	}
	return NewValues(children[0]), nil
}
