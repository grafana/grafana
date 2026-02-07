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
	"bytes"
	"fmt"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// IsBinary is a function that returns whether a blob is binary or not.
type IsBinary struct {
	expression.UnaryExpression
}

var _ sql.FunctionExpression = (*IsBinary)(nil)
var _ sql.CollationCoercible = (*IsBinary)(nil)

// NewIsBinary creates a new IsBinary expression.
func NewIsBinary(e sql.Expression) sql.Expression {
	return &IsBinary{expression.UnaryExpression{Child: e}}
}

// FunctionName implements sql.FunctionExpression
func (ib *IsBinary) FunctionName() string {
	return "is_binary"
}

// Description implements sql.FunctionExpression
func (ib *IsBinary) Description() string {
	return "returns whether a blob is a binary file or not."
}

// Eval implements the Expression interface.
func (ib *IsBinary) Eval(
	ctx *sql.Context,
	row sql.Row,
) (interface{}, error) {
	v, err := ib.Child.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	if v == nil {
		return false, nil
	}

	blob, _, err := types.LongBlob.Convert(ctx, v)
	if err != nil {
		return nil, err
	}

	return isBinary(blob.([]byte)), nil
}

func (ib *IsBinary) String() string {
	return fmt.Sprintf("%s(%s)", ib.FunctionName(), ib.Child)
}

// WithChildren implements the Expression interface.
func (ib *IsBinary) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(ib, len(children), 1)
	}
	return NewIsBinary(children[0]), nil
}

// Type implements the Expression interface.
func (ib *IsBinary) Type() sql.Type {
	return types.Boolean
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*IsBinary) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

const sniffLen = 8000

// isBinary detects if data is a binary value based on:
// http://git.kernel.org/cgit/git/git.git/tree/xdiff-interface.c?id=HEAD#n198
func isBinary(data []byte) bool {
	if len(data) > sniffLen {
		data = data[:sniffLen]
	}

	if bytes.IndexByte(data, byte(0)) == -1 {
		return false
	}

	return true
}
