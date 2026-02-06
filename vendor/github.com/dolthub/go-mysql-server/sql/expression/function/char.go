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

	"github.com/dolthub/vitess/go/sqltypes"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// Char implements the sql function "char" which returns the character for each integer passed
type Char struct {
	args      []sql.Expression
	Collation sql.CollationID
}

var _ sql.FunctionExpression = (*Char)(nil)
var _ sql.CollationCoercible = (*Char)(nil)

func NewChar(args ...sql.Expression) (sql.Expression, error) {
	return &Char{args: args}, nil
}

// FunctionName implements sql.FunctionExpression
func (c *Char) FunctionName() string {
	return "char"
}

// Resolved implements sql.FunctionExpression
func (c *Char) Resolved() bool {
	for _, arg := range c.args {
		if !arg.Resolved() {
			return false
		}
	}
	return true
}

// String implements sql.Expression
func (c *Char) String() string {
	args := make([]string, len(c.args))
	for i, arg := range c.args {
		args[i] = arg.String()
	}
	str := strings.Join(args, ", ")
	return fmt.Sprintf("%s(%s)", c.FunctionName(), str)
}

// Type implements sql.Expression
func (c *Char) Type() sql.Type {
	if c.Collation == sql.Collation_binary || c.Collation == sql.Collation_Unspecified {
		return types.MustCreateString(sqltypes.VarBinary, int64(len(c.args)*4), sql.Collation_binary)
	}
	return types.MustCreateString(sqltypes.VarChar, int64(len(c.args)*16), c.Collation)
}

// IsNullable implements sql.Expression
func (c *Char) IsNullable() bool {
	return true
}

// Description implements sql.FunctionExpression
func (c *Char) Description() string {
	return "interprets each argument N as an integer and returns a string consisting of the characters given by the code values of those integers."
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (c *Char) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// encodeUint32 converts uint32 `num` into a []byte using the fewest number of bytes in big endian (no leading 0s)
func encodeUint32(num uint32) []byte {
	res := []byte{
		byte(num >> 24),
		byte(num >> 16),
		byte(num >> 8),
		byte(num),
	}
	var i int
	for i = 0; i < 3; i++ {
		if res[i] != 0 {
			break
		}
	}
	return res[i:]
}

// Eval implements the sql.Expression interface
func (c *Char) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	var res []byte
	for _, arg := range c.args {
		if arg == nil {
			continue
		}

		val, err := arg.Eval(ctx, row)
		if err != nil {
			return nil, err
		}

		if val == nil {
			continue
		}

		v, _, err := types.Uint32.Convert(ctx, val)
		if err != nil {
			ctx.Warn(1292, "Truncated incorrect INTEGER value: '%v'", val)
		}

		if v == nil {
			res = append(res, 0)
			continue
		}

		res = append(res, encodeUint32(v.(uint32))...)
	}

	result, _, err := c.Type().Convert(ctx, res)
	if err != nil {
		return nil, err
	}

	return result, nil
}

// Children implements sql.Expression
func (c *Char) Children() []sql.Expression {
	return c.args
}

// WithChildren implements the sql.Expression interface
func (c *Char) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return NewChar(children...)
}
