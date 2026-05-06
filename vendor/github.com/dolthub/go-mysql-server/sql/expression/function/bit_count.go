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

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// BitCount returns the smallest integer value not less than X.
type BitCount struct {
	*UnaryFunc
}

var _ sql.FunctionExpression = (*BitCount)(nil)
var _ sql.CollationCoercible = (*BitCount)(nil)

// NewBitCount creates a new Ceil expression.
func NewBitCount(arg sql.Expression) sql.Expression {
	return &BitCount{NewUnaryFunc(arg, "BIT_COUNT", types.Int32)}
}

// FunctionName implements sql.FunctionExpression
func (b *BitCount) FunctionName() string {
	return "bit_count"
}

// Description implements sql.FunctionExpression
func (b *BitCount) Description() string {
	return "returns the number of bits that are set."
}

// Type implements the Expression interface.
func (b *BitCount) Type() sql.Type {
	return types.Int32
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (b *BitCount) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

func (b *BitCount) String() string {
	return fmt.Sprintf("%s(%s)", b.FunctionName(), b.Child)
}

// WithChildren implements the Expression interface.
func (b *BitCount) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(b, len(children), 1)
	}
	return NewBitCount(children[0]), nil
}

func countBits(n uint64) int32 {
	var res int32
	for n != 0 {
		res++
		n &= n - 1
	}
	return res
}

// Eval implements the Expression interface.
func (b *BitCount) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	if b.Child == nil {
		return nil, nil
	}

	child, err := b.Child.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	if child == nil {
		return nil, nil
	}

	var res int32
	switch val := child.(type) {
	case []byte:
		for _, v := range val {
			res += countBits(uint64(v))
		}
	default:
		num, _, err := types.Int64.Convert(ctx, child)
		if err != nil {
			ctx.Warn(1292, "Truncated incorrect INTEGER value: '%v'", child)
			num = int64(0)
		}

		// Must convert to unsigned because shifting a negative signed value fills with 1s
		res = countBits(uint64(num.(int64)))
	}

	return res, nil
}
