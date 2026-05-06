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
	"github.com/dolthub/vitess/go/mysql"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// Space implements the sql function "space" which returns a string with the number of spaces specified by the argument
type Space struct {
	*UnaryFunc
}

var _ sql.FunctionExpression = (*Space)(nil)
var _ sql.CollationCoercible = (*Space)(nil)

func NewSpace(arg sql.Expression) sql.Expression {
	return &Space{NewUnaryFunc(arg, "SPACE", types.LongText)}
}

// Description implements sql.FunctionExpression
func (s *Space) Description() string {
	return "return a string of the specified number of spaces."
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (s *Space) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// Eval implements the sql.Expression interface
func (s *Space) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	val, err := s.EvalChild(ctx, row)
	if err != nil {
		return nil, err
	}

	if val == nil {
		return nil, nil
	}

	// TODO: better truncate integer handling
	v, _, err := types.Int64.Convert(ctx, val)
	if err != nil {
		if !sql.ErrTruncatedIncorrect.Is(err) {
			return nil, err
		}
		ctx.Warn(mysql.ERTruncatedWrongValue, "%s", err.Error())
	}

	num := int(v.(int64))
	if num < 0 {
		num = 0
	}

	res := ""
	for i := 0; i < num; i++ {
		res += " "
	}
	return res, nil
}

// WithChildren implements the sql.Expression interface
func (s *Space) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(s, len(children), 1)
	}
	return NewSpace(children[0]), nil
}
