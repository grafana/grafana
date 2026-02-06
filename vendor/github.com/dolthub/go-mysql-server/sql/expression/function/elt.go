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
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// Elt joins several strings together.
type Elt struct {
	args []sql.Expression
}

var _ sql.FunctionExpression = (*Elt)(nil)
var _ sql.CollationCoercible = (*Elt)(nil)

// NewElt creates a new Elt UDF.
func NewElt(args ...sql.Expression) (sql.Expression, error) {
	if len(args) < 2 {
		return nil, sql.ErrInvalidArgumentNumber.New("ELT", "2 or more", len(args))
	}

	return &Elt{args}, nil
}

// FunctionName implements sql.FunctionExpression
func (e *Elt) FunctionName() string {
	return "elt"
}

// Description implements sql.FunctionExpression
func (e *Elt) Description() string {
	return "returns the string at index number."
}

// Type implements the Expression interface.
func (e *Elt) Type() sql.Type {
	return types.LongText
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (e *Elt) CollationCoercibility(ctx *sql.Context) (sql.CollationID, byte) {
	if len(e.args) == 0 {
		return sql.Collation_binary, 6
	}
	collation, coercibility := sql.GetCoercibility(ctx, e.args[0])
	for i := 1; i < len(e.args); i++ {
		nextCollation, nextCoercibility := sql.GetCoercibility(ctx, e.args[i])
		collation, coercibility = sql.ResolveCoercibility(collation, coercibility, nextCollation, nextCoercibility)
	}
	return collation, coercibility
}

// IsNullable implements the Expression interface.
func (e *Elt) IsNullable() bool {
	return true
}

// String implements the Stringer interface.
func (e *Elt) String() string {
	var args = make([]string, len(e.args))
	for i, arg := range e.args {
		args[i] = arg.String()
	}
	return fmt.Sprintf("%s(%s)", e.FunctionName(), strings.Join(args, ","))
}

// WithChildren implements the Expression interface.
func (*Elt) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return NewElt(children...)
}

// Resolved implements the Expression interface.
func (e *Elt) Resolved() bool {
	for _, arg := range e.args {
		if !arg.Resolved() {
			return false
		}
	}
	return true
}

// Children implements the Expression interface.
func (e *Elt) Children() []sql.Expression {
	return e.args
}

// Eval implements the Expression interface.
func (e *Elt) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	if e.args[0] == nil {
		return nil, nil
	}

	index, err := e.args[0].Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	if index == nil {
		return nil, nil
	}

	indexInt, _, err := types.Int64.Convert(ctx, index)
	if err != nil {
		// TODO: truncate
		ctx.Warn(1292, "Truncated incorrect INTEGER value: '%v'", index)
		indexInt = int64(0)
	}

	idx := int(indexInt.(int64))
	if idx <= 0 || idx >= len(e.args) {
		return nil, nil
	}

	str, err := e.args[idx].Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	res, _, err := types.Text.Convert(ctx, str)
	if err != nil {
		return nil, err
	}

	return res, nil
}
