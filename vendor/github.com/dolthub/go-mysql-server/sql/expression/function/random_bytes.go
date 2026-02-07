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
	"crypto/rand"
	"fmt"

	"github.com/dolthub/vitess/go/sqltypes"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/types"
)

const randomBytesMax = 1024

// RandomBytes returns a random binary string of the given length.
type RandomBytes struct {
	expression.UnaryExpression
}

var _ sql.FunctionExpression = (*RandomBytes)(nil)
var _ sql.CollationCoercible = (*RandomBytes)(nil)

// NewRandomBytes returns a new RANDOM_BYTES function.
func NewRandomBytes(e sql.Expression) sql.Expression {
	return &RandomBytes{expression.UnaryExpression{Child: e}}
}

// FunctionName implements sql.FunctionExpression
func (r *RandomBytes) FunctionName() string {
	return "random_bytes"
}

// Description implements sql.FunctionExpression
func (r *RandomBytes) Description() string {
	return "returns a random binary string of the given length"
}

// WithChildren implements the Expression interface.
func (r *RandomBytes) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(r, len(children), 1)
	}

	return NewRandomBytes(children[0]), nil
}

// Type implements the sql.Expression interface.
func (r *RandomBytes) Type() sql.Type {
	return types.MustCreateString(sqltypes.VarBinary, 1024, sql.Collation_binary)
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*RandomBytes) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// String implements the sql.Expression interface.
func (r *RandomBytes) String() string {
	return fmt.Sprintf("%s(%s)", r.FunctionName(), r.Child)
}

// IsNonDeterministic implements the sql.Expression interface.
func (r *RandomBytes) IsNonDeterministic() bool {
	return true
}

// Eval implements the sql.Expression interface.
func (r *RandomBytes) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	val, err := r.Child.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	if val == nil {
		return nil, nil
	}

	val, _, err = types.Int64.Convert(ctx, val)
	if err != nil {
		val = 0
		ctx.Warn(1292, "Truncated incorrect INTEGER value")
	}

	length, ok := types.CoalesceInt(val)
	if !ok {
		return nil, nil
	}

	if length <= 0 || length > randomBytesMax {
		return nil, sql.ErrValueOutOfRange.New(length, r.FunctionName())
	}

	res := make([]byte, length)
	_, err = rand.Read(res)
	if err != nil {
		return nil, err
	}

	return res, nil
}
