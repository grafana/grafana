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

package plan

import (
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// Set represents a set statement. This can be variables, but in some instances can also refer to row values.
type Set struct {
	Exprs []sql.Expression
}

var _ sql.Node = (*Set)(nil)
var _ sql.CollationCoercible = (*Set)(nil)

// NewSet creates a new Set node.
func NewSet(vars []sql.Expression) *Set {
	return &Set{Exprs: vars}
}

// Resolved implements the sql.Node interface.
func (s *Set) Resolved() bool {
	for _, v := range s.Exprs {
		if !v.Resolved() {
			return false
		}
	}
	return true
}

// Children implements the sql.Node interface.
func (s *Set) Children() []sql.Node { return nil }

func (s *Set) IsReadOnly() bool { return true }

// WithChildren implements the sql.Node interface.
func (s *Set) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 0 {
		return nil, sql.ErrInvalidChildrenNumber.New(s, len(children), 0)
	}

	return s, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*Set) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

// WithExpressions implements the sql.Expressioner interface.
func (s *Set) WithExpressions(exprs ...sql.Expression) (sql.Node, error) {
	if len(exprs) != len(s.Exprs) {
		return nil, sql.ErrInvalidChildrenNumber.New(s, len(exprs), len(s.Exprs))
	}

	return NewSet(exprs), nil
}

// Expressions implements the sql.Expressioner interface.
func (s *Set) Expressions() []sql.Expression {
	return s.Exprs
}

// Schema implements the sql.Node interface.
func (s *Set) Schema() sql.Schema {
	return types.OkResultSchema
}

func (s *Set) String() string {
	var children = make([]string, len(s.Exprs))
	for i, v := range s.Exprs {
		children[i] = v.String()
	}
	return strings.Join(children, ", ")
}

func (s *Set) DebugString() string {
	var children = make([]string, len(s.Exprs))
	for i, v := range s.Exprs {
		children[i] = sql.DebugString(v)
	}
	return strings.Join(children, ", ")
}
