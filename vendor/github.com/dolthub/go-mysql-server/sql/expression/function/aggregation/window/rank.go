// Copyright 2021 Dolthub, Inc.
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

package window

import (
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression/function/aggregation"
	"github.com/dolthub/go-mysql-server/sql/types"
)

type Rank struct {
	window *sql.WindowDefinition
	pos    int
	id     sql.ColumnId
}

var _ sql.FunctionExpression = (*Rank)(nil)
var _ sql.WindowAggregation = (*Rank)(nil)
var _ sql.WindowAdaptableExpression = (*Rank)(nil)
var _ sql.CollationCoercible = (*Rank)(nil)

func NewRank() sql.Expression {
	return &Rank{}
}

// Id implements sql.IdExpression
func (p *Rank) Id() sql.ColumnId {
	return p.id
}

// WithId implements sql.IdExpression
func (p *Rank) WithId(id sql.ColumnId) sql.IdExpression {
	ret := *p
	ret.id = id
	return &ret
}

// Description implements sql.FunctionExpression
func (p *Rank) Description() string {
	return "returns rank value."
}

// Window implements sql.WindowExpression
func (p *Rank) Window() *sql.WindowDefinition {
	return p.window
}

func (p *Rank) Resolved() bool {
	return windowResolved(p.window)
}

func (p *Rank) String() string {
	sb := strings.Builder{}
	sb.WriteString("rank()")
	if p.window != nil {
		sb.WriteString(" ")
		sb.WriteString(p.window.String())
	}
	return sb.String()
}

func (p *Rank) DebugString() string {
	sb := strings.Builder{}
	sb.WriteString("rank()")
	if p.window != nil {
		sb.WriteString(" ")
		sb.WriteString(sql.DebugString(p.window))
	}
	return sb.String()
}

// FunctionName implements sql.FunctionExpression
func (p *Rank) FunctionName() string {
	return "RANK"
}

// Type implements sql.Expression
func (p *Rank) Type() sql.Type {
	return types.Uint64
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*Rank) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// IsNullable implements sql.Expression
func (p *Rank) IsNullable() bool {
	return false
}

// Eval implements sql.Expression
func (p *Rank) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	return nil, sql.ErrWindowUnsupported.New(p.FunctionName())
}

// Children implements sql.Expression
func (p *Rank) Children() []sql.Expression {
	return p.window.ToExpressions()
}

// WithChildren implements sql.Expression
func (p *Rank) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	window, err := p.window.FromExpressions(children)
	if err != nil {
		return nil, err
	}

	return p.WithWindow(window), nil
}

// WithWindow implements sql.WindowAggregation
func (p *Rank) WithWindow(window *sql.WindowDefinition) sql.WindowAdaptableExpression {
	nr := *p
	nr.window = window
	return &nr
}

func (p *Rank) NewWindowFunction() (sql.WindowFunction, error) {
	return aggregation.NewRank(p.window.OrderBy.ToExpressions()), nil
}
