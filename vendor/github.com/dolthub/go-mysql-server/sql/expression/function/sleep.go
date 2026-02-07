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
	"context"
	"fmt"
	"time"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// Sleep is a function that just waits for the specified number of seconds
// and returns 0.
// It can be useful to test timeouts or long queries.
type Sleep struct {
	expression.UnaryExpression
}

var _ sql.FunctionExpression = (*Sleep)(nil)
var _ sql.CollationCoercible = (*Sleep)(nil)

// NewSleep creates a new Sleep expression.
func NewSleep(e sql.Expression) sql.Expression {
	return &Sleep{expression.UnaryExpression{Child: e}}
}

// FunctionName implements sql.FunctionExpression
func (s *Sleep) FunctionName() string {
	return "sleep"
}

// Description implements sql.FunctionExpression
func (s *Sleep) Description() string {
	return "waits for the specified number of seconds (can be fractional)."
}

// Eval implements the Expression interface.
func (s *Sleep) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	child, err := s.Child.Eval(ctx, row)

	if err != nil {
		return nil, err
	}

	if child == nil {
		return nil, nil
	}

	child, _, err = types.Float64.Convert(ctx, child)
	if err != nil {
		return nil, err
	}

	t := time.NewTimer(time.Duration(child.(float64)*1000) * time.Millisecond)
	defer t.Stop()

	select {
	case <-ctx.Done():
		return 0, context.Canceled
	case <-t.C:
		return 0, nil
	}
}

// String implements the fmt.Stringer interface.
func (s *Sleep) String() string {
	return fmt.Sprintf("%s(%s)", s.FunctionName(), s.Child)
}

// IsNullable implements the Expression interface.
func (s *Sleep) IsNullable() bool {
	return false
}

// WithChildren implements the Expression interface.
func (s *Sleep) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(s, len(children), 1)
	}
	return NewSleep(children[0]), nil
}

// Type implements the Expression interface.
func (s *Sleep) Type() sql.Type {
	return types.Int32
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*Sleep) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}
