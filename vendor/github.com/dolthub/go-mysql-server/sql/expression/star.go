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

package expression

import (
	"fmt"

	"github.com/dolthub/go-mysql-server/sql"
)

// Star represents the selection of all available fields.
// This is just a placeholder node, it will not actually be evaluated
// but converted to a series of GetFields when the query is analyzed.
type Star struct {
	Table string
}

var _ sql.Expression = (*Star)(nil)
var _ sql.CollationCoercible = (*Star)(nil)

// NewStar returns a new Star expression.
func NewStar() *Star {
	return new(Star)
}

// NewQualifiedStar returns a new star expression only for a specific table.
func NewQualifiedStar(table string) *Star {
	return &Star{table}
}

// Resolved implements the Expression interface.
func (*Star) Resolved() bool {
	return false
}

// Children implements the Expression interface.
func (*Star) Children() []sql.Expression {
	return nil
}

// IsNullable implements the Expression interface.
func (*Star) IsNullable() bool {
	return false
}

// Type implements the Expression interface.
func (*Star) Type() sql.Type {
	panic("star is just a placeholder node, but Type was called")
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*Star) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

func (s *Star) String() string {
	if s.Table != "" {
		return fmt.Sprintf("%s.*", s.Table)
	}
	return "*"
}

// Eval implements the Expression interface.
func (*Star) Eval(ctx *sql.Context, r sql.Row) (interface{}, error) {
	panic("star is just a placeholder node, but Eval was called")
}

// WithChildren implements the Expression interface.
func (s *Star) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 0 {
		return nil, sql.ErrInvalidChildrenNumber.New(s, len(children), 0)
	}
	return s, nil
}
