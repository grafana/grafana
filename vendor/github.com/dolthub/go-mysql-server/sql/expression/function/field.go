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

// Field joins several strings together.
type Field struct {
	args []sql.Expression
}

var _ sql.FunctionExpression = (*Field)(nil)
var _ sql.CollationCoercible = (*Field)(nil)

// NewField creates a new Field UDF.
func NewField(args ...sql.Expression) (sql.Expression, error) {
	if len(args) < 2 {
		return nil, sql.ErrInvalidArgumentNumber.New("FIELD", "2 or more", len(args))
	}

	return &Field{args}, nil
}

// FunctionName implements sql.FunctionExpression
func (f *Field) FunctionName() string {
	return "field"
}

// Description implements sql.FunctionExpression
func (f *Field) Description() string {
	return "returns the string at index number."
}

// Type implements the Expression interface.
func (f *Field) Type() sql.Type {
	return types.Int64
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (f *Field) CollationCoercibility(ctx *sql.Context) (sql.CollationID, byte) {
	if len(f.args) == 0 {
		return sql.Collation_binary, 6
	}
	collation, coercibility := sql.GetCoercibility(ctx, f.args[0])
	for i := 1; i < len(f.args); i++ {
		nextCollation, nextCoercibility := sql.GetCoercibility(ctx, f.args[i])
		collation, coercibility = sql.ResolveCoercibility(collation, coercibility, nextCollation, nextCoercibility)
	}
	return collation, coercibility
}

// IsNullable implements the Expression interface.
func (f *Field) IsNullable() bool {
	return false
}

// String implements the Stringer interface.
func (f *Field) String() string {
	var args = make([]string, len(f.args))
	for i, arg := range f.args {
		args[i] = arg.String()
	}
	return fmt.Sprintf("%s(%s)", f.FunctionName(), strings.Join(args, ","))
}

// WithChildren implements the Expression interface.
func (*Field) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return NewField(children...)
}

// Resolved implements the Expression interface.
func (f *Field) Resolved() bool {
	for _, arg := range f.args {
		if !arg.Resolved() {
			return false
		}
	}
	return true
}

// Children implements the Expression interface.
func (f *Field) Children() []sql.Expression {
	return f.args
}

// Eval implements the Expression interface.
func (f *Field) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	if f.args[0] == nil {
		return int64(0), nil
	}

	key, err := f.args[0].Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	if key == nil {
		return int64(0), nil
	}

	key, _, err = types.Text.Convert(ctx, key)
	if err != nil {
		return nil, err
	}

	var val interface{}
	for i := 1; i < len(f.args); i++ {
		if f.args[i] == nil {
			continue
		}

		val, err = f.args[i].Eval(ctx, row)
		if err != nil {
			return nil, err
		}

		if val == nil {
			continue
		}

		val, _, err = types.Text.Convert(ctx, val)
		if err != nil {
			return nil, err
		}

		if strings.EqualFold(key.(string), val.(string)) {
			return int64(i), nil
		}
	}

	return int64(0), nil
}
