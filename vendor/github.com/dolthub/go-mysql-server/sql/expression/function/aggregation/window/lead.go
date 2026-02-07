// Copyright 2022 Dolthub, Inc.
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
	"fmt"
	"strings"

	"github.com/dolthub/go-mysql-server/sql/transform"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/expression/function/aggregation"
)

type Lead struct {
	window *sql.WindowDefinition
	expression.NaryExpression
	offset int
	pos    int
	id     sql.ColumnId
}

var _ sql.FunctionExpression = (*Lead)(nil)
var _ sql.WindowAggregation = (*Lead)(nil)
var _ sql.WindowAdaptableExpression = (*Lead)(nil)
var _ sql.CollationCoercible = (*Lead)(nil)

// NewLead accepts variadic arguments to create a new Lead node:
// If 1 expression, use default values for [default] and [offset]
// If 2 expressions, use default value for [default]
// 3 input expression match to [child], [offset], and [default] arguments
// The offset is constrained to a non-negative integer expression.Literal.
// TODO: support user-defined variable offset
func NewLead(e ...sql.Expression) (*Lead, error) {
	switch len(e) {
	case 1:
		return &Lead{NaryExpression: expression.NaryExpression{ChildExpressions: e[:1]}, offset: 1}, nil
	case 2:
		offset, err := expression.LiteralToInt(e[1])
		if err != nil {
			return nil, err
		}
		return &Lead{NaryExpression: expression.NaryExpression{ChildExpressions: e[:1]}, offset: offset}, nil
	case 3:
		offset, err := expression.LiteralToInt(e[1])
		if err != nil {
			return nil, err
		}
		return &Lead{NaryExpression: expression.NaryExpression{ChildExpressions: []sql.Expression{e[0], e[2]}}, offset: offset}, nil
	}
	return nil, sql.ErrInvalidArgumentNumber.New("LEAD", "1, 2, or 3", len(e))
}

// Id implements sql.IdExpression
func (l *Lead) Id() sql.ColumnId {
	return l.id
}

// WithId implements sql.IdExpression
func (l *Lead) WithId(id sql.ColumnId) sql.IdExpression {
	ret := *l
	ret.id = id
	return &ret
}

// Description implements sql.FunctionExpression
func (l *Lead) Description() string {
	return "returns the value of the expression evaluated at the lead offset row"
}

// Window implements sql.WindowExpression
func (l *Lead) Window() *sql.WindowDefinition {
	return l.window
}

// IsNullable implements sql.Expression
func (l *Lead) Resolved() bool {
	childrenResolved := true
	for _, c := range l.ChildExpressions {
		childrenResolved = childrenResolved && c.Resolved()
	}
	return childrenResolved && windowResolved(l.window)
}

func (l *Lead) String() string {
	sb := strings.Builder{}
	if len(l.ChildExpressions) > 1 {
		sb.WriteString(fmt.Sprintf("lead(%s, %d, %s)", l.ChildExpressions[0].String(), l.offset, l.ChildExpressions[1]))
	} else {
		sb.WriteString(fmt.Sprintf("lead(%s, %d)", l.ChildExpressions[0].String(), l.offset))
	}
	if l.window != nil {
		sb.WriteString(" ")
		sb.WriteString(l.window.String())
	}
	return sb.String()
}

func (l *Lead) DebugString() string {
	sb := strings.Builder{}
	if len(l.ChildExpressions) > 1 {
		sb.WriteString(fmt.Sprintf("lead(%s, %d, %s)", l.ChildExpressions[0].String(), l.offset, l.ChildExpressions[1]))
	} else {
		sb.WriteString(fmt.Sprintf("lead(%s, %d)", l.ChildExpressions[0].String(), l.offset))
	}
	if l.window != nil {
		sb.WriteString(" ")
		sb.WriteString(sql.DebugString(l.window))
	}
	return sb.String()
}

// FunctionName implements sql.FunctionExpression
func (l *Lead) FunctionName() string {
	return "LEAD"
}

// Type implements sql.Expression
func (l *Lead) Type() sql.Type {
	return l.ChildExpressions[0].Type()
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (l *Lead) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	// We use the first child for the Type, so we'll use the first child for the coercibility as well
	if l == nil || len(l.ChildExpressions) == 0 {
		return sql.Collation_binary, 6
	}
	return sql.GetCoercibility(ctx, l.ChildExpressions[0])
}

// IsNullable implements sql.Expression
func (l *Lead) IsNullable() bool {
	return true
}

// Eval implements sql.Expression
func (l *Lead) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	return nil, sql.ErrWindowUnsupported.New(l.FunctionName())
}

// Children implements sql.Expression
func (l *Lead) Children() []sql.Expression {
	if l == nil {
		return nil
	}
	return append(l.window.ToExpressions(), l.ChildExpressions...)
}

// WithChildren implements sql.Expression
func (l *Lead) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) < 2 {
		return nil, sql.ErrInvalidChildrenNumber.New(l, len(children), 2)
	}

	nl := *l
	numWindowExpr := len(children) - len(l.ChildExpressions)
	window, err := l.window.FromExpressions(children[:numWindowExpr])
	if err != nil {
		return nil, err
	}

	nl.ChildExpressions = children[numWindowExpr:]
	nl.window = window

	return &nl, nil
}

// WithWindow implements sql.WindowAggregation
func (l *Lead) WithWindow(window *sql.WindowDefinition) sql.WindowAdaptableExpression {
	nl := *l
	nl.window = window
	return &nl
}

func (l *Lead) NewWindowFunction() (sql.WindowFunction, error) {
	c, err := transform.Clone(l.ChildExpressions[0])
	if err != nil {
		return nil, err
	}
	var def sql.Expression
	if len(l.ChildExpressions) > 1 {
		def, err = transform.Clone(l.ChildExpressions[1])
		if err != nil {
			return nil, err
		}
	}
	return aggregation.NewLead(c, def, l.offset), nil
}
